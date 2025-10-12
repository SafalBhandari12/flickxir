import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import {
  sendOTPSchema,
  verifyOTPSchema,
  resendOTPSchema,
  vendorRegistrationSchema,
  adminAssignmentSchema,
  toggleStatusSchema,
  adminProfileUpdateSchema,
  validateRequest,
} from "./validator.js";
import {
  getOTPConfig,
  sendOTPToMessageCentral,
  validateOTPWithMessageCentral,
  createOTPRecord,
  findOrCreateUser,
  hasActiveOTP,
  markPreviousOTPsAsUsed,
  findOTPRecord,
  markOTPAsVerified,
  incrementOTPAttempts,
} from "./otpUtils.js";

const prisma = new PrismaClient();

class AuthController {
  // ================================
  // OTP MANAGEMENT
  // ================================

  /**
   * Send OTP to phone number using MessageCentral
   */
  static async sendOTP(req: Request, res: Response) {
    try {
      // Validate request body using helper function
      const validation = validateRequest(sendOTPSchema, req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const { phoneNumber } = validation.data!;

      // Check if there's a recent active OTP
      if (await hasActiveOTP(phoneNumber)) {
        return res.status(429).json({
          success: false,
          message: "OTP already sent. Please wait before requesting again.",
        });
      }

      // Dummy data arrays - bypass OTP for these phone numbers
      const dummyPhoneNumbers = [
        "9876543210", // Admin test number
        "9876543211", // Customer
        "9876543212", // Customer
        "9876543213", // Customer
        "9876543214", // Vendor
        "9876543215", // Vendor
        "9876543216", // Customer
        "9876543217", // Customer
        "9876543218", // Vendor (transport)
        "9876543219", // Vendor (transport)
        "7847915622", // My number (Normal user)
      ];

      // For dummy numbers, create a fake OTP record without actually sending OTP
      if (dummyPhoneNumbers.includes(phoneNumber)) {
        // Find or create user
        const user = await findOrCreateUser(phoneNumber);

        // Create a fake OTP record with a dummy verification ID
        const fakeVerificationId = `dummy_${Date.now()}_${phoneNumber}`;
        const timeout = 300; // 5 minutes

        await createOTPRecord(
          user.id,
          phoneNumber,
          fakeVerificationId,
          timeout.toString()
        );

        return res.status(200).json({
          success: true,
          message: "OTP sent successfully (dummy mode)",
          data: {
            verificationId: fakeVerificationId,
            timeout: timeout,
          },
        });
      }

      // Get OTP service configuration
      const config = await getOTPConfig();

      if (!config) {
        return res.status(500).json({
          success: false,
          message: "OTP service not configured",
        });
      }

      // Send OTP using MessageCentral API
      const otpResult = await sendOTPToMessageCentral(phoneNumber, config);

      if (otpResult.success && otpResult.data) {
        // Find or create user
        const user = await findOrCreateUser(phoneNumber);

        // Store OTP record
        await createOTPRecord(
          user.id,
          otpResult.data.mobileNumber,
          otpResult.data.verificationId,
          otpResult.data.timeout.toString()
        );

        return res.status(200).json({
          success: true,
          message: "OTP sent successfully",
          data: {
            verificationId: otpResult.data.verificationId,
            timeout: otpResult.data.timeout,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to send OTP",
          error: otpResult.error,
        });
      }
    } catch (error) {
      console.error("Send OTP Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Verify OTP and login/register user
   */
  static async verifyOTP(req: Request, res: Response) {
    try {
      // Validate request body using helper function
      const validation = validateRequest(verifyOTPSchema, req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const { verificationId, code, phoneNumber } = validation.data!;

      // Find OTP record
      const otpRecord = await findOTPRecord(verificationId, phoneNumber);

      if (!otpRecord) {
        return res.status(404).json({
          success: false,
          message: "Invalid verification ID or OTP already used",
        });
      }

      // Check if OTP expired
      if (otpRecord.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired",
        });
      }

      // Check max attempts
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        return res.status(429).json({
          success: false,
          message: "Maximum OTP attempts exceeded",
        });
      }

      // Get OTP service configuration
      const config = await getOTPConfig();

      if (!config) {
        return res.status(500).json({
          success: false,
          message: "OTP service not configured",
        });
      }

      // Dummy data arrays - bypass OTP for these phone numbers
      const dummyPhoneNumbers = [
        "9876543210", // Admin test number
        "9876543211", // Customer
        "9876543212", // Customer
        "9876543213", // Customer
        "9876543214", // Vendor
        "9876543215", // Vendor
        "9876543216", // Customer
        "9876543217", // Customer
        "9876543218", // Vendor (transport)
        "9876543219", // Vendor (transport)
        "7847915622", // My number (Normal user)
      ];

      // Validate OTP using MessageCentral API - bypass for dummy numbers
      if (dummyPhoneNumbers.includes(phoneNumber)) {
        const accessToken = jwt.sign(
          {
            userId: otpRecord.user.id,
            role: otpRecord.user.role,
            type: "access", // Mark as access token
          },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "15m" } // Short-lived access token (15 minutes)
        );

        const refreshToken = jwt.sign(
          {
            userId: otpRecord.user.id,
            role: otpRecord.user.role,
            type: "refresh", // Mark as refresh token
            refreshCount: 0, // Initial refresh count
            originalIat: Math.floor(Date.now() / 1000), // Store original issue time
          },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "30d" } // Maximum lifetime (30 days)
        );
        return res.status(200).json({
          success: true,
          message: "OTP verified successfully",
          data: {
            accessToken,
            refreshToken,
            user: {
              id: otpRecord.user.id,
              phoneNumber: otpRecord.user.phoneNumber,
              role: otpRecord.user.role,
              isActive: otpRecord.user.isActive,
            },
          },
        });
      }
      const validateResult = await validateOTPWithMessageCentral(
        phoneNumber,
        verificationId,
        code,
        config
      );

      if (validateResult.success) {
        // Mark OTP as verified
        await markOTPAsVerified(otpRecord.id);

        // Generate JWT tokens with proper types
        const accessToken = jwt.sign(
          {
            userId: otpRecord.user.id,
            role: otpRecord.user.role,
            type: "access", // Mark as access token
          },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "15m" } // Short-lived access token (15 minutes)
        );

        const refreshToken = jwt.sign(
          {
            userId: otpRecord.user.id,
            role: otpRecord.user.role,
            type: "refresh", // Mark as refresh token
            refreshCount: 0, // Initial refresh count
            originalIat: Math.floor(Date.now() / 1000), // Store original issue time
          },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "30d" } // Maximum lifetime (30 days)
        );

        return res.status(200).json({
          success: true,
          message: "OTP verified successfully",
          data: {
            accessToken,
            refreshToken,
            user: {
              id: otpRecord.user.id,
              phoneNumber: otpRecord.user.phoneNumber,
              role: otpRecord.user.role,
              isActive: otpRecord.user.isActive,
            },
          },
        });
      } else {
        // Increment attempt count
        await incrementOTPAttempts(otpRecord.id);

        return res.status(400).json({
          success: false,
          message: "Invalid OTP code",
          attemptsLeft: otpRecord.maxAttempts - (otpRecord.attempts + 1),
        });
      }
    } catch (error) {
      console.error("Verify OTP Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Resend OTP to phone number
   */
  static async resendOTP(req: Request, res: Response) {
    try {
      // Validate request body using helper function
      const validation = validateRequest(resendOTPSchema, req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const { phoneNumber } = validation.data!;

      // Check if user exists (resend OTP should only work for existing users)
      const existingUser = await prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found. Please use send OTP first.",
        });
      }

      // Check if there's a recent active OTP
      if (!(await hasActiveOTP(phoneNumber))) {
        return res.status(400).json({
          success: false,
          message: "No active OTP found to resend. Please request a new OTP.",
        });
      }

      // Dummy data arrays - bypass OTP for these phone numbers
      const dummyPhoneNumbers = [
        "9876543210", // Admin test number
        "9876543211", // Customer
        "9876543212", // Customer
        "9876543213", // Customer
        "9876543214", // Vendor
        "9876543215", // Vendor
        "9876543216", // Customer
        "9876543217", // Customer
        "9876543218", // Vendor (transport)
        "9876543219", // Vendor (transport)
        "7847915622", // My number (Normal user)
      ];

      // Mark previous OTPs as used
      await markPreviousOTPsAsUsed(phoneNumber);

      // For dummy numbers, create a fake OTP record without actually sending OTP
      if (dummyPhoneNumbers.includes(phoneNumber)) {
        // Create a fake OTP record with a dummy verification ID
        const fakeVerificationId = `dummy_${Date.now()}_${phoneNumber}`;
        const timeout = 300; // 5 minutes

        await createOTPRecord(
          existingUser.id,
          phoneNumber,
          fakeVerificationId,
          timeout.toString()
        );

        return res.status(200).json({
          success: true,
          message: "OTP resent successfully (dummy mode)",
          data: {
            verificationId: fakeVerificationId,
            timeout: timeout,
          },
        });
      }

      // Get OTP service configuration
      const config = await getOTPConfig();

      if (!config) {
        return res.status(500).json({
          success: false,
          message: "OTP service not configured",
        });
      }

      // Send new OTP using MessageCentral API
      const otpResult = await sendOTPToMessageCentral(phoneNumber, config);

      if (otpResult.success && otpResult.data) {
        // Store new OTP record for existing user
        await createOTPRecord(
          existingUser.id,
          otpResult.data.mobileNumber,
          otpResult.data.verificationId,
          otpResult.data.timeout.toString()
        );

        return res.status(200).json({
          success: true,
          message: "OTP resent successfully",
          data: {
            verificationId: otpResult.data.verificationId,
            timeout: otpResult.data.timeout,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to resend OTP",
          error: otpResult.error,
        });
      }
    } catch (error) {
      console.error("Resend OTP Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ================================
  // USER PROFILE MANAGEMENT
  // ================================

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Get Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get detailed user profile with role-specific data
   */
  static async getDetailedProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          vendorProfile: {
            include: {
              bankDetails: true,
              hotelProfile: true,
              adventureProfile: true,
              transportProfile: true,
              pharmacyProfile: true,
            },
          },
          adminProfile: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Get Detailed Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Logout user (invalidate session)
   */
  static async logout(req: AuthRequest, res: Response) {
    try {
      // In a more complex setup, you'd maintain a blacklist of tokens
      // For now, we'll just send a success response
      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ================================
  // VENDOR MANAGEMENT
  // ================================

  /**
   * Register as vendor
   */
  static async registerVendor(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Validate request body using helper function
      const validation = validateRequest(vendorRegistrationSchema, req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const {
        businessName,
        ownerName,
        contactNumbers,
        email,
        businessAddress,
        googleMapsLink,
        gstNumber,
        panNumber,
        aadhaarNumber,
        vendorType,
        bankDetails,
      } = validation.data!;

      // Map old vendor types to new pharmacy-focused types
      const mappedVendorType =
        vendorType === "LOCAL_MARKET"
          ? "PHARMACY"
          : vendorType === "HOTEL"
          ? "WELLNESS_STORE"
          : vendorType === "ADVENTURE"
          ? "WELLNESS_STORE"
          : vendorType === "TRANSPORT"
          ? "OTHER"
          : vendorType || "PHARMACY";

      // Check if user already has a vendor profile
      const existingVendor = await prisma.vendor.findUnique({
        where: { userId: req.user.userId },
      });

      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: "User already has a vendor profile",
        });
      }

      // Create vendor profile
      const vendor = await prisma.vendor.create({
        data: {
          userId: req.user.userId,
          businessName,
          ownerName,
          contactNumbers,
          email,
          businessAddress,
          googleMapsLink,
          gstNumber,
          panNumber,
          aadhaarNumber,
          vendorType: mappedVendorType,
          status: "PENDING",
          bankDetails: {
            create: bankDetails,
          },
        },
        include: {
          bankDetails: true,
          user: {
            select: {
              phoneNumber: true,
              role: true,
            },
          },
        },
      });

      // NOTE: User role remains "CUSTOMER" until vendor application is approved by admin
      // Role will be changed to "VENDOR" only when admin approves the vendor application
      // This prevents unauthorized role escalation

      return res.status(201).json({
        success: true,
        message:
          "Vendor registration submitted successfully. Pending admin approval.",
        data: {
          ...vendor,
          note: "Your application is pending approval. You will remain a customer until approved.",
        },
      });
    } catch (error) {
      console.error("Register Vendor Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get vendor status
   */
  static async getVendorStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.userId },
        include: {
          bankDetails: true,
        },
      });

      if (!vendor) {
        return res.status(200).json({
          success: true,
          data: {
            status: "NOT_APPLIED",
            message:
              "No vendor application found. You can apply to become a vendor.",
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          status: vendor.status,
          businessName: vendor.businessName,
          vendorType: vendor.vendorType,
          createdAt: vendor.createdAt,
        },
      });
    } catch (error) {
      console.error("Get Vendor Status Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Update vendor profile
   */
  static async updateVendorProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.userId },
      });

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: "Vendor profile not found",
        });
      }

      const allowedUpdates = [
        "businessName",
        "ownerName",
        "contactNumbers",
        "email",
        "businessAddress",
        "googleMapsLink",
        "gstNumber",
      ];

      const updates: any = {};
      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const updatedVendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: updates,
        include: {
          bankDetails: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Vendor profile updated successfully",
        data: updatedVendor,
      });
    } catch (error) {
      console.error("Update Vendor Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ================================
  // ADMIN FUNCTIONS
  // ================================

  /**
   * Test admin endpoint to verify middleware is working
   */
  static async testAdminAccess(req: AuthRequest, res: Response) {
    try {
      return res.status(200).json({
        success: true,
        message: "Admin access successful",
        data: {
          user: req.user,
          timestamp: new Date().toISOString(),
          serverTime: Date.now(),
        },
      });
    } catch (error) {
      console.error("Test Admin Access Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  /**
   * Get all vendors for admin review
   */
  static async getVendorsForAdmin(req: AuthRequest, res: Response) {
    console.log("🏢 Admin Controller - getVendorsForAdmin called");
    console.log("🏢 User:", req.user);
    console.log("🏢 Query params:", req.query);

    try {
      // Check if user is admin
      if (!req.user || req.user.role !== "ADMIN") {
        console.log("🏢 Access denied - not admin");
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      console.log("🏢 Admin access confirmed, processing query...");
      const { status, vendorType, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (status && typeof status === "string") {
        where.status = status.toUpperCase();
      }
      if (vendorType && typeof vendorType === "string") {
        where.vendorType = vendorType.toUpperCase();
      }

      console.log("🏢 Database query where:", where);
      console.log("🏢 Pagination - skip:", skip, "take:", Number(limit));

      console.log("🏢 Executing database query...");
      const vendors = await prisma.vendor.findMany({
        where,
        include: {
          user: {
            select: {
              phoneNumber: true,
              createdAt: true,
            },
          },
          bankDetails: true,
        },
        skip: skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      });

      console.log("🏢 Vendors found:", vendors.length);

      console.log("🏢 Getting total count...");
      const total = await prisma.vendor.count({ where });
      console.log("🏢 Total count:", total);

      console.log("🏢 Sending response...");
      return res.status(200).json({
        success: true,
        data: {
          vendors,
          pagination: {
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("🏢 Get Vendors For Admin Error:", error);
      console.error(
        "🏢 Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Approve vendor
   */
  static async approveVendor(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { vendorId } = req.params;

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          message: "Vendor ID is required",
        });
      }

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          status: "APPROVED",
        },
        include: {
          user: true,
        },
      });

      // SECURITY: Only when admin approves, change user role to VENDOR
      await prisma.user.update({
        where: { id: vendor.userId },
        data: { role: "VENDOR" },
      });

      return res.status(200).json({
        success: true,
        message: "Vendor approved successfully. User role updated to VENDOR.",
        data: vendor,
      });
    } catch (error) {
      console.error("Approve Vendor Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Reject vendor
   */
  static async rejectVendor(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { vendorId } = req.params;

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          message: "Vendor ID is required",
        });
      }

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { status: "REJECTED" },
        include: {
          user: true,
        },
      });

      // SECURITY: When vendor is rejected, revert user role back to CUSTOMER
      await prisma.user.update({
        where: { id: vendor.userId },
        data: { role: "CUSTOMER" },
      });

      return res.status(200).json({
        success: true,
        message:
          "Vendor rejected successfully. User role reverted to CUSTOMER.",
        data: vendor,
      });
    } catch (error) {
      console.error("Reject Vendor Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Suspend vendor
   */
  static async suspendVendor(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { vendorId } = req.params;

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          message: "Vendor ID is required",
        });
      }

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { status: "SUSPENDED" },
        include: {
          user: true,
        },
      });

      // SECURITY: When vendor is suspended, revert user role back to CUSTOMER
      await prisma.user.update({
        where: { id: vendor.userId },
        data: { role: "CUSTOMER" },
      });

      return res.status(200).json({
        success: true,
        message:
          "Vendor suspended successfully. User role reverted to CUSTOMER.",
        data: vendor,
      });
    } catch (error) {
      console.error("Suspend Vendor Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Assign admin role to a user (Only existing admins can do this)
   */
  static async assignAdminRole(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { userId } = req.params;
      const validation = validateRequest(adminAssignmentSchema, req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const { fullName, email, permissions } = validation.data!;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (targetUser.role === "ADMIN") {
        return res.status(400).json({
          success: false,
          message: "User is already an admin",
        });
      }

      // Update user role to ADMIN
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: "ADMIN" },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Create admin profile
      const adminProfile = await AuthController.createAdminProfile(
        userId,
        fullName || "Admin User",
        email || undefined,
        permissions || ["MANAGE_VENDORS", "MANAGE_USERS"]
      );

      return res.status(200).json({
        success: true,
        message: "Admin role assigned successfully",
        data: {
          user: updatedUser,
          adminProfile,
        },
      });
    } catch (error) {
      console.error("Assign Admin Role Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Revoke admin role from a user (Only existing admins can do this)
   */
  static async revokeAdminRole(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      // Prevent self-demotion
      if (userId === req.user.userId) {
        return res.status(400).json({
          success: false,
          message: "Cannot revoke your own admin role",
        });
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (targetUser.role !== "ADMIN") {
        return res.status(400).json({
          success: false,
          message: "User is not an admin",
        });
      }

      // Delete admin profile
      await prisma.admin.delete({
        where: { userId },
      });

      // Update user role back to CUSTOMER
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: "CUSTOMER" },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Admin role revoked successfully. User role set to CUSTOMER.",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Revoke Admin Role Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Create admin profile when assigning admin role
   */
  static async createAdminProfile(
    userId: string,
    fullName?: string,
    email?: string,
    permissions: string[] = ["MANAGE_VENDORS", "MANAGE_USERS"]
  ) {
    return await prisma.admin.create({
      data: {
        userId,
        fullName: fullName || "Admin User",
        email: email || null,
        permissions,
      },
    });
  }

  /**
   * Get all users for admin review
   */
  static async getAllUsers(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { role, isActive, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === "true";

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          vendorProfile: {
            select: {
              businessName: true,
              status: true,
              vendorType: true,
            },
          },
          adminProfile: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
        skip: skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.user.count({ where });

      return res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Get All Users Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Activate/Deactivate user account
   */
  static async toggleUserStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { userId } = req.params;
      const validation = validateRequest(toggleStatusSchema, req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const { isActive } = validation.data!;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      // Prevent self-deactivation
      if (userId === req.user.userId && !isActive) {
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate your own account",
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: `User ${isActive ? "activated" : "deactivated"} successfully`,
        data: updatedUser,
      });
    } catch (error) {
      console.error("Toggle User Status Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Update admin profile information
   */
  static async updateAdminProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const validation = validateRequest(adminProfileUpdateSchema, req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const { fullName, email, permissions } = validation.data!;

      // Find admin profile
      const adminProfile = await prisma.admin.findUnique({
        where: { userId: req.user.userId },
      });

      if (!adminProfile) {
        return res.status(404).json({
          success: false,
          message: "Admin profile not found",
        });
      }

      const updates: any = {};
      if (fullName) updates.fullName = fullName;
      if (email !== undefined) updates.email = email;
      if (permissions && Array.isArray(permissions))
        updates.permissions = permissions;

      const updatedAdmin = await prisma.admin.update({
        where: { id: adminProfile.id },
        data: updates,
      });

      return res.status(200).json({
        success: true,
        message: "Admin profile updated successfully",
        data: updatedAdmin,
      });
    } catch (error) {
      console.error("Update Admin Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Check if phone number exists
   */
  static async checkPhoneExists(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      const user = await prisma.user.findUnique({
        where: { phoneNumber },
        select: { id: true, role: true },
      });

      return res.status(200).json({
        success: true,
        data: {
          exists: !!user,
          role: user?.role || null,
        },
      });
    } catch (error) {
      console.error("Check Phone Exists Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Refresh authentication token with proper security measures
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      // Extract refresh token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: "Authorization header is required",
        });
      }

      // Check if header starts with "Bearer "
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Authorization header must start with 'Bearer '",
        });
      }

      // Extract the refresh token
      const refreshToken = authHeader.substring(7); // Remove "Bearer " prefix

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      try {
        // Verify the refresh token
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_SECRET || "your-secret-key"
        ) as any;

        // Check if this is actually a refresh token (not an access token)
        if (decoded.type !== "refresh") {
          return res.status(401).json({
            success: false,
            message: "Invalid token type. Refresh token required.",
          });
        }

        // Security: Check refresh count to prevent indefinite refresh
        const refreshCount = decoded.refreshCount || 0;
        const maxRefreshes = 20; // Maximum 20 refreshes before requiring re-login

        if (refreshCount >= maxRefreshes) {
          return res.status(401).json({
            success: false,
            message:
              "Refresh token has reached maximum usage limit. Please login again.",
          });
        }

        // Security: Check if original token is too old (30 days max)
        const originalIssuedAt = decoded.originalIat || decoded.iat;
        const maxTokenAge = 30 * 24 * 60 * 60; // 30 days in seconds
        const currentTime = Math.floor(Date.now() / 1000);

        if (currentTime - originalIssuedAt > maxTokenAge) {
          return res.status(401).json({
            success: false,
            message: "Refresh token has expired. Please login again.",
          });
        }

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (!user || !user.isActive) {
          return res.status(401).json({
            success: false,
            message: "Invalid refresh token or user inactive",
          });
        }

        // Generate new access token (short-lived)
        const newAccessToken = jwt.sign(
          {
            userId: user.id,
            role: user.role,
            type: "access", // Mark as access token
          },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "15m" } // Very short-lived access token (15 minutes)
        );

        // Generate new refresh token with incremented count and preserved original timestamp
        const newRefreshToken = jwt.sign(
          {
            userId: user.id,
            role: user.role,
            type: "refresh", // Mark as refresh token
            refreshCount: refreshCount + 1, // Increment refresh count
            originalIat: originalIssuedAt, // Preserve original issue time
          },
          process.env.JWT_SECRET || "your-secret-key",
          {
            expiresIn: Math.floor(
              maxTokenAge - (currentTime - originalIssuedAt)
            ), // Remaining time until absolute expiration
          }
        );

        return res.status(200).json({
          success: true,
          message: "Tokens refreshed successfully",
          data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken, // Return new refresh token (token rotation)
            user: {
              id: user.id,
              phoneNumber: user.phoneNumber,
              role: user.role,
              isActive: user.isActive,
            },
          },
        });
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token",
        });
      }
    } catch (error) {
      console.error("Refresh Token Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

export default AuthController;
