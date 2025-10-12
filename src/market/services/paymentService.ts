import Razorpay from "razorpay";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import type {
  PaymentData,
  PaymentVerificationData,
  RazorpayOrderResponse,
} from "../../common/types.js";
import { PAYMENT } from "../../common/constants.js";

const prisma = new PrismaClient();

export class PaymentService {
  private razorpay: Razorpay;

  constructor() {
    if (!PAYMENT.RAZORPAY_KEY_ID || !PAYMENT.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials are not configured");
    }

    this.razorpay = new Razorpay({
      key_id: PAYMENT.RAZORPAY_KEY_ID,
      key_secret: PAYMENT.RAZORPAY_KEY_SECRET,
    });
  }

  // ================================
  // Create Razorpay Order
  // ================================

  async createOrder(paymentData: PaymentData): Promise<RazorpayOrderResponse> {
    try {
      const options = {
        amount: Math.round(paymentData.amount * 100), // Convert to paise
        currency: paymentData.currency,
        receipt: paymentData.orderId,
        notes: {
          orderId: paymentData.orderId,
          customerPhone: paymentData.customerInfo.phone,
          customerName: paymentData.customerInfo.name,
        },
      };

      const order = await this.razorpay.orders.create(options);

      return {
        id: order.id,
        amount: Number(order.amount) / 100, // Convert back to rupees
        currency: order.currency,
        status: order.status,
      };
    } catch (error) {
      console.error("Error creating Razorpay order:", error);
      throw new Error("Failed to create payment order");
    }
  }

  // ================================
  // Verify Payment Signature
  // ================================

  verifyPaymentSignature(data: PaymentVerificationData): boolean {
    try {
      if (!PAYMENT.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay key secret is not configured");
      }

      const generatedSignature = crypto
        .createHmac("sha256", PAYMENT.RAZORPAY_KEY_SECRET)
        .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
        .digest("hex");

      return generatedSignature === data.razorpay_signature;
    } catch (error) {
      console.error("Error verifying payment signature:", error);
      return false;
    }
  }

  // ================================
  // Process Payment Success
  // ================================

  async processPaymentSuccess(
    bookingId: string,
    verificationData: PaymentVerificationData
  ): Promise<void> {
    try {
      // Verify the payment signature
      if (!this.verifyPaymentSignature(verificationData)) {
        throw new Error("Invalid payment signature");
      }

      // Update payment record
      await prisma.payment.update({
        where: { bookingId },
        data: {
          paymentStatus: "SUCCESS",
          razorpayPaymentId: verificationData.razorpay_payment_id,
          razorpaySignature: verificationData.razorpay_signature,
          processedAt: new Date(),
        },
      });

      // Update booking status
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "CONFIRMED" },
      });

      // Update order items status
      await prisma.marketBooking.updateMany({
        where: { bookingId },
        data: { status: "CONFIRMED" },
      });

      console.log(`Payment processed successfully for booking: ${bookingId}`);
    } catch (error) {
      console.error("Error processing payment success:", error);
      throw error;
    }
  }

  // ================================
  // Process Payment Failure
  // ================================

  async processPaymentFailure(
    bookingId: string,
    reason?: string
  ): Promise<void> {
    try {
      // Update payment record
      await prisma.payment.update({
        where: { bookingId },
        data: {
          paymentStatus: "FAILED",
          processedAt: new Date(),
        },
      });

      // Update booking status
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" },
      });

      // Update order items status
      await prisma.marketBooking.updateMany({
        where: { bookingId },
        data: { status: "CANCELLED" },
      });

      console.log(
        `Payment failed for booking: ${bookingId}, Reason: ${reason}`
      );
    } catch (error) {
      console.error("Error processing payment failure:", error);
      throw error;
    }
  }

  // ================================
  // Initiate Refund
  // ================================

  async initiateRefund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<any> {
    try {
      // Get payment details
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });

      if (!payment || !payment.razorpayPaymentId) {
        throw new Error("Payment not found or invalid");
      }

      if (payment.paymentStatus !== "SUCCESS") {
        throw new Error("Cannot refund non-successful payment");
      }

      const refundAmount = amount || payment.totalAmount;

      // Create refund in Razorpay
      const refund = await this.razorpay.payments.refund(
        payment.razorpayPaymentId,
        {
          amount: Math.round(refundAmount * 100), // Convert to paise
          notes: {
            reason: reason || "Customer refund request",
            bookingId: payment.bookingId,
          },
        }
      );

      // Update payment record
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          paymentStatus: "REFUNDED",
          refundId: refund.id,
          refundAmount: refundAmount,
          processedAt: new Date(),
        },
      });

      return {
        refundId: refund.id,
        amount: refundAmount,
        status: refund.status,
      };
    } catch (error) {
      console.error("Error initiating refund:", error);
      throw error;
    }
  }

  // ================================
  // Get Payment Details
  // ================================

  async getPaymentDetails(bookingId: string) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { bookingId },
        include: {
          booking: {
            include: {
              user: true,
              vendor: true,
            },
          },
        },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      return {
        id: payment.id,
        bookingId: payment.bookingId,
        totalAmount: payment.totalAmount,
        commissionAmount: payment.commissionAmount,
        vendorAmount: payment.vendorAmount,
        paymentStatus: payment.paymentStatus,
        paymentMethod: payment.paymentMethod,
        transactionId: payment.transactionId,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
        processedAt: payment.processedAt,
        refundId: payment.refundId,
        refundAmount: payment.refundAmount,
        createdAt: payment.createdAt,
        booking: {
          id: payment.booking.id,
          totalAmount: payment.booking.totalAmount,
          status: payment.booking.status,
          user: {
            id: payment.booking.user.id,
            phoneNumber: payment.booking.user.phoneNumber,
          },
          vendor: {
            id: payment.booking.vendor.id,
            businessName: payment.booking.vendor.businessName,
          },
        },
      };
    } catch (error) {
      console.error("Error getting payment details:", error);
      throw error;
    }
  }

  // ================================
  // Handle Webhook
  // ================================

  async handleWebhook(signature: string, payload: any): Promise<void> {
    try {
      if (!PAYMENT.WEBHOOK_SECRET) {
        throw new Error("Webhook secret is not configured");
      }

      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac("sha256", PAYMENT.WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (signature !== expectedSignature) {
        throw new Error("Invalid webhook signature");
      }

      const event = payload.event;
      const paymentEntity = payload.payload.payment.entity;

      switch (event) {
        case "payment.captured":
          await this.handlePaymentCaptured(paymentEntity);
          break;
        case "payment.failed":
          await this.handlePaymentFailed(paymentEntity);
          break;
        case "refund.processed":
          await this.handleRefundProcessed(payload.payload.refund.entity);
          break;
        default:
          console.log(`Unhandled webhook event: ${event}`);
      }
    } catch (error) {
      console.error("Error handling webhook:", error);
      throw error;
    }
  }

  private async handlePaymentCaptured(paymentEntity: any): Promise<void> {
    try {
      const orderId = paymentEntity.notes?.orderId;
      if (!orderId) {
        console.error("Order ID not found in payment notes");
        return;
      }

      // Find the booking
      const booking = await prisma.booking.findFirst({
        where: { id: orderId },
      });

      if (!booking) {
        console.error(`Booking not found for order ID: ${orderId}`);
        return;
      }

      // Update payment and booking status
      await this.processPaymentSuccess(booking.id, {
        razorpay_payment_id: paymentEntity.id,
        razorpay_order_id: paymentEntity.order_id,
        razorpay_signature: "", // Signature verification not needed for webhooks
      });
    } catch (error) {
      console.error("Error handling payment captured:", error);
    }
  }

  private async handlePaymentFailed(paymentEntity: any): Promise<void> {
    try {
      const orderId = paymentEntity.notes?.orderId;
      if (!orderId) {
        console.error("Order ID not found in payment notes");
        return;
      }

      // Find the booking
      const booking = await prisma.booking.findFirst({
        where: { id: orderId },
      });

      if (!booking) {
        console.error(`Booking not found for order ID: ${orderId}`);
        return;
      }

      await this.processPaymentFailure(
        booking.id,
        paymentEntity.error_description
      );
    } catch (error) {
      console.error("Error handling payment failed:", error);
    }
  }

  private async handleRefundProcessed(refundEntity: any): Promise<void> {
    try {
      // Update payment record with refund status
      await prisma.payment.updateMany({
        where: { refundId: refundEntity.id },
        data: {
          paymentStatus: "REFUNDED",
          processedAt: new Date(),
        },
      });

      console.log(`Refund processed: ${refundEntity.id}`);
    } catch (error) {
      console.error("Error handling refund processed:", error);
    }
  }
}
