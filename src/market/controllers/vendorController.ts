import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  createSuccessResponse,
  createErrorResponse,
  getPaginationParams,
  createPaginationMeta,
} from "../utils/helpers.js";
import {
  vendorOnboardingSchema,
  vendorUpdateSchema,
  vendorApprovalSchema,
} from "../utils/validators.js";
import { API_MESSAGES, COMMISSION_RATES } from "../../common/constants.js";
import type { AuthenticatedUser } from "../../common/types.js";
import { NotificationService } from "../services/notificationService.js";

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const prisma = new PrismaClient();
const notificationService = new NotificationService();

export class VendorController {
  // ================================
  // Vendor Onboarding
  // ================================

  async onboardVendor(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "CUSTOMER") {
        return res
          .status(403)
          .json(
            createErrorResponse("Only customers can apply to become vendors")
          );
      }

      // Check if user already has a vendor profile
      const existingVendor = await prisma.vendor.findUnique({
        where: { userId: user.userId },
      });

      if (existingVendor) {
        return res
          .status(400)
          .json(createErrorResponse("User already has a vendor profile"));
      }

      // Validate request data
      const validationResult = vendorOnboardingSchema.safeParse(req.body);
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

      const vendorData = validationResult.data;

      // Create vendor profile with transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update user role
        await tx.user.update({
          where: { id: user.userId },
          data: { role: "VENDOR" },
        });

        // Create vendor profile
        const vendor = await tx.vendor.create({
          data: {
            userId: user.userId,
            businessName: vendorData.businessName,
            ownerName: vendorData.ownerName,
            contactNumbers: vendorData.contactNumbers,
            email: vendorData.email,
            businessAddress: vendorData.businessAddress,
            googleMapsLink: vendorData.googleMapsLink,
            gstNumber: vendorData.gstNumber,
            panNumber: vendorData.panNumber,
            aadhaarNumber: vendorData.aadhaarNumber,
            vendorType: vendorData.vendorType,
            commissionRate:
              vendorData.vendorType === "LOCAL_MARKET"
                ? COMMISSION_RATES.LOCAL_MARKET
                : COMMISSION_RATES.DEFAULT,
            status: "PENDING",
          },
        });

        // Create bank details
        const bankDetails = await tx.bankDetails.create({
          data: {
            vendorId: vendor.id,
            accountNumber: vendorData.bankDetails.accountNumber,
            ifscCode: vendorData.bankDetails.ifscCode,
            bankName: vendorData.bankDetails.bankName,
            branchName: vendorData.bankDetails.branchName,
            accountHolder: vendorData.bankDetails.accountHolder,
          },
        });

        // Create market profile if vendor type is LOCAL_MARKET
        let marketProfile = null;
        if (vendorData.vendorType === "LOCAL_MARKET" && vendorData.shopName) {
          marketProfile = await tx.localMarketProfile.create({
            data: {
              vendorId: vendor.id,
              shopName: vendorData.shopName,
            },
          });
        }

        return { vendor, bankDetails, marketProfile };
      });

      res.status(201).json(
        createSuccessResponse(API_MESSAGES.SUCCESS.VENDOR_CREATED, {
          id: result.vendor.id,
          businessName: result.vendor.businessName,
          ownerName: result.vendor.ownerName,
          vendorType: result.vendor.vendorType,
          status: result.vendor.status,
          commissionRate: result.vendor.commissionRate,
          shopName: result.marketProfile?.shopName,
          createdAt: result.vendor.createdAt,
        })
      );
    } catch (error) {
      console.error("Error onboarding vendor:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to create vendor profile"));
    }
  }

  // ================================
  // Get Vendor Profile
  // ================================

  async getVendorProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const vendor = await prisma.vendor.findUnique({
        where: { id: user.vendorId },
        include: {
          bankDetails: true,
          marketProfile: {
            include: {
              products: {
                select: {
                  id: true,
                  productName: true,
                  category: true,
                  isAvailable: true,
                },
                take: 5, // Latest 5 products
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });

      if (!vendor) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.VENDOR_NOT_FOUND));
      }

      const formattedVendor = {
        id: vendor.id,
        businessName: vendor.businessName,
        ownerName: vendor.ownerName,
        contactNumbers: vendor.contactNumbers,
        email: vendor.email,
        businessAddress: vendor.businessAddress,
        googleMapsLink: vendor.googleMapsLink,
        gstNumber: vendor.gstNumber,
        panNumber: vendor.panNumber,
        aadhaarNumber: vendor.aadhaarNumber,
        vendorType: vendor.vendorType,
        status: vendor.status,
        commissionRate: vendor.commissionRate,
        paymentFrequency: vendor.paymentFrequency,
        bankDetails: vendor.bankDetails,
        marketProfile: vendor.marketProfile
          ? {
              shopName: vendor.marketProfile.shopName,
              totalProducts: vendor.marketProfile.products.length,
              recentProducts: vendor.marketProfile.products,
            }
          : null,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
      };

      res.json(
        createSuccessResponse(
          "Vendor profile retrieved successfully",
          formattedVendor
        )
      );
    } catch (error) {
      console.error("Error getting vendor profile:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve vendor profile"));
    }
  }

  // ================================
  // Update Vendor Profile
  // ================================

  async updateVendorProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Validate request data
      const validationResult = vendorUpdateSchema.safeParse(req.body);
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

      const updateData = validationResult.data;

      // Create clean update object
      const cleanUpdateData: any = {};
      Object.keys(updateData).forEach((key) => {
        const value = updateData[key as keyof typeof updateData];
        if (value !== undefined) {
          cleanUpdateData[key] = value;
        }
      });

      const updatedVendor = await prisma.vendor.update({
        where: { id: user.vendorId },
        data: cleanUpdateData,
      });

      res.json(
        createSuccessResponse(API_MESSAGES.SUCCESS.PROFILE_UPDATED, {
          id: updatedVendor.id,
          businessName: updatedVendor.businessName,
          ownerName: updatedVendor.ownerName,
          contactNumbers: updatedVendor.contactNumbers,
          email: updatedVendor.email,
          businessAddress: updatedVendor.businessAddress,
          googleMapsLink: updatedVendor.googleMapsLink,
          updatedAt: updatedVendor.updatedAt,
        })
      );
    } catch (error) {
      console.error("Error updating vendor profile:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to update vendor profile"));
    }
  }

  // ================================
  // Get All Vendors (Admin)
  // ================================

  async getAllVendors(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const vendorType = req.query.vendorType as string;
      const query = req.query.query as string;

      const { skip, take } = getPaginationParams(page, limit);

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (vendorType) {
        where.vendorType = vendorType;
      }

      if (query) {
        where.OR = [
          { businessName: { contains: query, mode: "insensitive" } },
          { ownerName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ];
      }

      const [vendors, total] = await Promise.all([
        prisma.vendor.findMany({
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
            marketProfile: {
              select: {
                shopName: true,
                _count: {
                  select: { products: true },
                },
              },
            },
            _count: {
              select: {
                bookings: true,
              },
            },
          },
        }),
        prisma.vendor.count({ where }),
      ]);

      const formattedVendors = vendors.map((vendor) => ({
        id: vendor.id,
        businessName: vendor.businessName,
        ownerName: vendor.ownerName,
        phoneNumber: vendor.user.phoneNumber,
        email: vendor.email,
        vendorType: vendor.vendorType,
        status: vendor.status,
        commissionRate: vendor.commissionRate,
        shopName: vendor.marketProfile?.shopName,
        totalProducts: vendor.marketProfile?._count?.products || 0,
        totalOrders: vendor._count.bookings,
        createdAt: vendor.createdAt,
      }));

      const meta = createPaginationMeta(page, limit, total);

      res.json(
        createSuccessResponse(
          "Vendors retrieved successfully",
          formattedVendors,
          meta
        )
      );
    } catch (error) {
      console.error("Error getting vendors:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve vendors"));
    }
  }

  // ================================
  // Approve/Reject Vendor (Admin)
  // ================================

  async updateVendorStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Vendor ID is required"));
      }

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Validate request data
      const validationResult = vendorApprovalSchema.safeParse(req.body);
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

      const { status, commissionRate, rejectionReason } = validationResult.data;

      // Find vendor
      const vendor = await prisma.vendor.findUnique({
        where: { id },
        include: {
          user: { select: { id: true } },
        },
      });

      if (!vendor) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.VENDOR_NOT_FOUND));
      }

      // Update vendor status
      const updateData: any = { status };
      if (commissionRate !== undefined) {
        updateData.commissionRate = commissionRate;
      }

      const updatedVendor = await prisma.vendor.update({
        where: { id },
        data: updateData,
      });

      // Send notification to vendor
      try {
        await notificationService.sendVendorApprovalNotification(
          vendor.user.id,
          status,
          rejectionReason
        );
      } catch (error) {
        console.error("Error sending notification:", error);
      }

      const message =
        status === "APPROVED"
          ? API_MESSAGES.SUCCESS.VENDOR_APPROVED
          : API_MESSAGES.SUCCESS.VENDOR_REJECTED;

      res.json(
        createSuccessResponse(message, {
          id: updatedVendor.id,
          status: updatedVendor.status,
          commissionRate: updatedVendor.commissionRate,
          updatedAt: updatedVendor.updatedAt,
        })
      );
    } catch (error) {
      console.error("Error updating vendor status:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to update vendor status"));
    }
  }

  // ================================
  // Get Vendor by ID (Admin/Public)
  // ================================

  async getVendorById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Vendor ID is required"));
      }

      const vendor = await prisma.vendor.findUnique({
        where: { id },
        include: {
          marketProfile: {
            include: {
              products: {
                where: { isAvailable: true },
                select: {
                  id: true,
                  productName: true,
                  category: true,
                  priceMin: true,
                  priceMax: true,
                },
                take: 10,
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });

      if (!vendor) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.VENDOR_NOT_FOUND));
      }

      // Only show approved vendors to public
      if (vendor.status !== "APPROVED") {
        return res.status(404).json(createErrorResponse("Vendor not found"));
      }

      const formattedVendor = {
        id: vendor.id,
        businessName: vendor.businessName,
        businessAddress: vendor.businessAddress,
        contactNumbers: vendor.contactNumbers,
        googleMapsLink: vendor.googleMapsLink,
        vendorType: vendor.vendorType,
        marketProfile: vendor.marketProfile
          ? {
              shopName: vendor.marketProfile.shopName,
              products: vendor.marketProfile.products,
            }
          : null,
        createdAt: vendor.createdAt,
      };

      res.json(
        createSuccessResponse("Vendor retrieved successfully", formattedVendor)
      );
    } catch (error) {
      console.error("Error getting vendor:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve vendor"));
    }
  }
}
