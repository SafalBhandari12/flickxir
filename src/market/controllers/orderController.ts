import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  createSuccessResponse,
  createErrorResponse,
  getPaginationParams,
  createPaginationMeta,
  calculateCommission,
  calculateVendorAmount,
  generateOrderId,
} from "../utils/helpers.js";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "../utils/validators.js";
import { API_MESSAGES, COMMISSION_RATES } from "../../common/constants.js";
import type { AuthenticatedUser } from "../../common/types.js";
import { PaymentService } from "../services/paymentService.js";
import { NotificationService } from "../services/notificationService.js";

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const prisma = new PrismaClient();
const paymentService = new PaymentService();
const notificationService = new NotificationService();

export class OrderController {
  // ================================
  // Create Order (Customer)
  // ================================

  async createOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "CUSTOMER") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Validate request data
      const validationResult = createOrderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              API_MESSAGES.ERROR.VALIDATION_ERROR,
              validationResult.error.issues
            )
          );
      }

      const orderData = validationResult.data;

      // Verify all products exist and are available
      const productIds = orderData.items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isAvailable: true,
        },
        include: {
          pharmacyProfile: {
            include: {
              vendor: {
                select: {
                  id: true,
                  status: true,
                  vendorType: true,
                  commissionRate: true,
                },
              },
            },
          },
        },
      });

      if (products.length !== productIds.length) {
        return res
          .status(400)
          .json(createErrorResponse("Some products are not available"));
      }

      // Validate all products belong to the same vendor
      const vendorIds = [
        ...new Set(products.map((p) => p.pharmacyProfile.vendor.id)),
      ];
      if (vendorIds.length > 1) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "Cannot order from multiple vendors in one order"
            )
          );
      }

      const vendor = products[0]?.pharmacyProfile?.vendor;
      if (!vendor) {
        return res.status(400).json(createErrorResponse("Invalid vendor data"));
      }
      if (vendor.status !== "APPROVED") {
        return res
          .status(400)
          .json(createErrorResponse(API_MESSAGES.ERROR.VENDOR_NOT_APPROVED));
      }

      // Validate order items and calculate totals
      let calculatedTotal = 0;
      const validatedItems: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        totalAmount: number;
        requiresDelivery: boolean;
        deliveryAddress: string | null;
      }> = [];

      for (const item of orderData.items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;

        // Check minimum order quantity
        if (item.quantity < product.minOrderQuantity) {
          return res
            .status(400)
            .json(
              createErrorResponse(
                `Minimum order quantity for ${product.medicineName} is ${product.minOrderQuantity}`
              )
            );
        }

        // Validate unit price is within product price range
        if (
          item.unitPrice < product.priceMin ||
          item.unitPrice > product.priceMax
        ) {
          return res
            .status(400)
            .json(
              createErrorResponse(
                `Invalid price for ${product.medicineName}. Price should be between ₹${product.priceMin} and ₹${product.priceMax}`
              )
            );
        }

        const itemTotal = item.unitPrice * item.quantity;
        calculatedTotal += itemTotal;

        validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: itemTotal,
          requiresDelivery: item.requiresDelivery || false,
          deliveryAddress: item.deliveryAddress || null,
        });
      }

      // Validate total amount matches
      if (Math.abs(calculatedTotal - orderData.totalAmount) > 0.01) {
        return res
          .status(400)
          .json(createErrorResponse("Total amount mismatch"));
      }

      // Calculate commission
      const commissionAmount = calculateCommission(
        calculatedTotal,
        vendor.vendorType
      );
      const vendorAmount = calculateVendorAmount(
        calculatedTotal,
        commissionAmount
      );

      // Create booking transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create main booking
        const booking = await tx.booking.create({
          data: {
            userId: user.userId,
            vendorId: vendor.id,
            bookingType: "PHARMACY",
            totalAmount: calculatedTotal,
            commissionAmount,
            status: "PENDING",
          },
        });

        // Create pharmacy booking items
        const pharmacyBookings = await Promise.all(
          validatedItems.map((item) =>
            tx.pharmacyBooking.create({
              data: {
                bookingId: booking.id,
                pharmacyProfileId: products.find(
                  (p) => p.id === item.productId
                )!.pharmacyProfileId,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalAmount: item.totalAmount,
                requiresDelivery: item.requiresDelivery,
                deliveryAddress: item.deliveryAddress,
                status: "PENDING",
              },
            })
          )
        );

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            vendorId: vendor.id,
            totalAmount: calculatedTotal,
            commissionAmount,
            vendorAmount,
            paymentMethod: orderData.paymentMethod || "RAZORPAY",
            paymentStatus: "PENDING",
          },
        });

        return { booking, pharmacyBookings, payment };
      });

      // Create Razorpay order if payment method is RAZORPAY
      let razorpayOrder = null;
      if (orderData.paymentMethod === "RAZORPAY" || !orderData.paymentMethod) {
        try {
          razorpayOrder = await paymentService.createOrder({
            amount: calculatedTotal,
            currency: "INR",
            orderId: result.booking.id,
            customerInfo: {
              name: "Customer", // You might want to get this from user profile
              phone: user.phoneNumber,
            },
          });

          // Update payment record with Razorpay order ID
          await prisma.payment.update({
            where: { bookingId: result.booking.id },
            data: { razorpayOrderId: razorpayOrder.id },
          });
        } catch (error) {
          console.error("Error creating Razorpay order:", error);
          // Continue without payment gateway for now
        }
      }

      // Send notifications
      try {
        await notificationService.sendOrderNotification(
          "ORDER_PLACED",
          result.booking.id,
          user.userId,
          vendor.id,
          calculatedTotal
        );
      } catch (error) {
        console.error("Error sending notification:", error);
      }

      // Return order details
      res.status(201).json(
        createSuccessResponse(API_MESSAGES.SUCCESS.ORDER_CREATED, {
          orderId: result.booking.id,
          totalAmount: calculatedTotal,
          commissionAmount,
          status: result.booking.status,
          items: validatedItems,
          payment: {
            paymentStatus: result.payment.paymentStatus,
            paymentMethod: result.payment.paymentMethod,
            razorpayOrderId: razorpayOrder?.id,
          },
          createdAt: result.booking.createdAt,
        })
      );
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json(createErrorResponse("Failed to create order"));
    }
  }

  // ================================
  // Get Orders (Customer)
  // ================================

  async getCustomerOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "CUSTOMER") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;

      const { skip, take } = getPaginationParams(page, limit);

      const where: any = {
        userId: user.userId,
        bookingType: "PHARMACY",
      };

      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            vendor: {
              select: {
                businessName: true,
                contactNumbers: true,
              },
            },
            pharmacyBooking: {
              include: {
                product: {
                  select: {
                    medicineName: true,
                    category: true,
                  },
                },
              },
            },
            payment: {
              select: {
                paymentStatus: true,
                paymentMethod: true,
                transactionId: true,
              },
            },
          },
        }),
        prisma.booking.count({ where }),
      ]);

      const formattedOrders = orders.map((order) => ({
        id: order.id,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
        vendor: {
          businessName: order.vendor.businessName,
          contactNumbers: order.vendor.contactNumbers,
        },
        items: order.pharmacyBooking.map((item) => ({
          id: item.id,
          productName: item.product.medicineName,
          category: item.product.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
          requiresDelivery: item.requiresDelivery,
          deliveryAddress: item.deliveryAddress,
        })),
        payment: order.payment,
      }));

      const meta = createPaginationMeta(page, limit, total);

      res.json(
        createSuccessResponse(
          "Orders retrieved successfully",
          formattedOrders,
          meta
        )
      );
    } catch (error) {
      console.error("Error getting customer orders:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve orders"));
    }
  }

  // ================================
  // Get Vendor Orders (Vendor)
  // ================================

  async getVendorOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;

      const { skip, take } = getPaginationParams(page, limit);

      const where: any = {
        vendorId: user.vendorId,
        bookingType: "LOCAL_MARKET",
      };

      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                phoneNumber: true,
              },
            },
            pharmacyBooking: {
              include: {
                product: {
                  select: {
                    medicineName: true,
                    category: true,
                  },
                },
              },
            },
            payment: {
              select: {
                paymentStatus: true,
                paymentMethod: true,
              },
            },
          },
        }),
        prisma.booking.count({ where }),
      ]);

      const formattedOrders = orders.map((order) => ({
        id: order.id,
        totalAmount: order.totalAmount,
        commissionAmount: order.commissionAmount,
        status: order.status,
        createdAt: order.createdAt,
        customer: {
          phoneNumber: order.user.phoneNumber,
        },
        items: order.pharmacyBooking.map((item) => ({
          id: item.id,
          productName: item.product.medicineName,
          category: item.product.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
          requiresDelivery: item.requiresDelivery,
          deliveryAddress: item.deliveryAddress,
        })),
        payment: order.payment,
      }));

      const meta = createPaginationMeta(page, limit, total);

      res.json(
        createSuccessResponse(
          "Orders retrieved successfully",
          formattedOrders,
          meta
        )
      );
    } catch (error) {
      console.error("Error getting vendor orders:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve orders"));
    }
  }

  // ================================
  // Get Order by ID
  // ================================

  async getOrderById(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Order ID is required"));
      }

      // Build where clause based on user role
      const where: any = { id };

      if (user.role === "CUSTOMER") {
        where.userId = user.userId;
      } else if (user.role === "VENDOR") {
        where.vendorId = user.vendorId;
      } else if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const order = await prisma.booking.findFirst({
        where,
        include: {
          user: {
            select: {
              phoneNumber: true,
            },
          },
          vendor: {
            select: {
              businessName: true,
              contactNumbers: true,
              businessAddress: true,
            },
          },
          pharmacyBooking: {
            include: {
              product: {
                select: {
                  medicineName: true,
                  category: true,
                },
              },
            },
          },
          payment: true,
        },
      });

      if (!order) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.ORDER_NOT_FOUND));
      }

      const formattedOrder = {
        id: order.id,
        totalAmount: order.totalAmount,
        commissionAmount: order.commissionAmount,
        status: order.status,
        createdAt: order.createdAt,
        customer: {
          phoneNumber: order.user.phoneNumber,
        },
        vendor: {
          businessName: order.vendor.businessName,
          contactNumbers: order.vendor.contactNumbers,
          businessAddress: order.vendor.businessAddress,
        },
        items: order.pharmacyBooking.map((item) => ({
          id: item.id,
          productName: item.product.medicineName,
          category: item.product.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
          requiresDelivery: item.requiresDelivery,
          deliveryAddress: item.deliveryAddress,
          status: item.status,
        })),
        payment: order.payment,
      };

      res.json(
        createSuccessResponse("Order retrieved successfully", formattedOrder)
      );
    } catch (error) {
      console.error("Error getting order:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve order"));
    }
  }

  // ================================
  // Update Order Status (Vendor)
  // ================================

  async updateOrderStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Order ID is required"));
      }

      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Validate request data
      const validationResult = updateOrderStatusSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              API_MESSAGES.ERROR.VALIDATION_ERROR,
              validationResult.error.issues
            )
          );
      }

      const { status, notes } = validationResult.data;

      // Check if order belongs to vendor
      const order = await prisma.booking.findFirst({
        where: {
          id,
          vendorId: user.vendorId,
        },
        include: {
          user: { select: { id: true } },
        },
      });

      if (!order) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.ORDER_NOT_FOUND));
      }

      // Validate status transition (simplified)
      if (order.status === "COMPLETED" || order.status === "CANCELLED") {
        return res
          .status(400)
          .json(
            createErrorResponse("Cannot update completed or cancelled orders")
          );
      }

      // Update order status
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // Update main booking
        const booking = await tx.booking.update({
          where: { id },
          data: { status },
        });

        // Update pharmacy booking items
        await tx.pharmacyBooking.updateMany({
          where: { bookingId: id },
          data: { status },
        });

        return booking;
      });

      // Send notification to customer
      try {
        const notificationType =
          status === "CONFIRMED"
            ? "ORDER_CONFIRMED"
            : status === "COMPLETED"
            ? "ORDER_COMPLETED"
            : "ORDER_CANCELLED";

        await notificationService.sendOrderNotification(
          notificationType as any,
          order.id,
          order.user.id
        );
      } catch (error) {
        console.error("Error sending notification:", error);
      }

      res.json(
        createSuccessResponse(API_MESSAGES.SUCCESS.ORDER_UPDATED, {
          id: updatedOrder.id,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt,
        })
      );
    } catch (error) {
      console.error("Error updating order status:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to update order status"));
    }
  }

  // ================================
  // Cancel Order (Customer)
  // ================================

  async cancelOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Order ID is required"));
      }

      if (user.role !== "CUSTOMER") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Check if order belongs to customer
      const order = await prisma.booking.findFirst({
        where: {
          id,
          userId: user.userId,
        },
        include: {
          payment: true,
        },
      });

      if (!order) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.ORDER_NOT_FOUND));
      }

      // Check if order can be cancelled
      if (order.status === "COMPLETED") {
        return res
          .status(400)
          .json(createErrorResponse("Cannot cancel completed orders"));
      }

      if (order.status === "CANCELLED") {
        return res
          .status(400)
          .json(createErrorResponse("Order is already cancelled"));
      }

      // Cancel order
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // Update main booking
        const booking = await tx.booking.update({
          where: { id },
          data: { status: "CANCELLED" },
        });

        // Update pharmacy booking items
        await tx.pharmacyBooking.updateMany({
          where: { bookingId: id },
          data: { status: "CANCELLED" },
        });

        return booking;
      });

      // Initiate refund if payment was successful
      if (order.payment && order.payment.paymentStatus === "SUCCESS") {
        try {
          await paymentService.initiateRefund(
            order.payment.id,
            order.payment.totalAmount,
            "Customer cancellation"
          );
        } catch (error) {
          console.error("Error processing refund:", error);
        }
      }

      res.json(
        createSuccessResponse("Order cancelled successfully", {
          id: updatedOrder.id,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updatedAt,
        })
      );
    } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json(createErrorResponse("Failed to cancel order"));
    }
  }
}
