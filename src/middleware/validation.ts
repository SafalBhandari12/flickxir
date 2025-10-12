import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

// Extended Request interface for validated data
interface ValidatedRequest extends Request {
  validatedData?: any;
}

// ================================
// ZOD VALIDATION SCHEMAS
// ================================

// Phone number schema - Indian 10-digit numbers starting with 6-9
const phoneNumberSchema = z
  .string()
  .regex(
    /^[6-9]\d{9}$/,
    "Please provide a valid 10-digit phone number starting with 6-9"
  );

// OTP code schema - 4 to 6 digits
const otpCodeSchema = z
  .string()
  .regex(/^\d{4,6}$/, "OTP code must be 4-6 digits");

// Email schema
const emailSchema = z.string().email("Invalid email format");

// GST number schema
const gstSchema = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    "Invalid GST number format"
  );

// PAN number schema
const panSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format");

// Aadhaar number schema
const aadhaarSchema = z
  .string()
  .regex(/^\d{12}$/, "Aadhaar number must be 12 digits");

// Bank details schema
const bankDetailsSchema = z.object({
  accountNumber: z.string().min(8, "Account number must be at least 8 digits"),
  ifscCode: z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
  bankName: z.string().min(2, "Bank name is required"),
  branchName: z.string().min(2, "Branch name is required"),
  accountHolder: z.string().min(2, "Account holder name is required"),
});

// ================================
// REQUEST VALIDATION SCHEMAS
// ================================

// Send OTP schema
export const sendOTPSchema = z.object({
  body: z.object({
    phoneNumber: phoneNumberSchema,
  }),
});

// Verify OTP schema
export const verifyOTPSchema = z.object({
  body: z.object({
    phoneNumber: phoneNumberSchema,
    verificationId: z.string().min(1, "Verification ID is required"),
    code: otpCodeSchema,
  }),
});

// Resend OTP schema
export const resendOTPSchema = z.object({
  body: z.object({
    phoneNumber: phoneNumberSchema,
  }),
});

// Vendor registration schema
export const vendorRegistrationSchema = z.object({
  body: z.object({
    businessName: z
      .string()
      .min(2, "Business name must be at least 2 characters"),
    ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
    contactNumbers: z
      .array(phoneNumberSchema)
      .min(1, "At least one contact number is required"),
    email: emailSchema.optional(),
    businessAddress: z
      .string()
      .min(10, "Business address must be at least 10 characters"),
    googleMapsLink: z.string().url("Invalid Google Maps link").optional(),
    gstNumber: gstSchema.optional(),
    panNumber: panSchema.optional(),
    aadhaarNumber: aadhaarSchema.optional(),
    vendorType: z.enum([
      "HOTEL",
      "ADVENTURE",
      "TRANSPORT",
      "LOCAL_MARKET",
      "OTHER",
    ]),
    bankDetails: bankDetailsSchema.optional(),
  }),
});

// Profile update schema
export const profileUpdateSchema = z.object({
  body: z
    .object({
      role: z.enum(["CUSTOMER", "VENDOR", "ADMIN"]).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required for update",
    }),
});

// Vendor profile update schema
export const vendorProfileUpdateSchema = z.object({
  body: z
    .object({
      businessName: z.string().min(2).optional(),
      ownerName: z.string().min(2).optional(),
      contactNumbers: z.array(phoneNumberSchema).min(1).optional(),
      email: emailSchema.optional(),
      businessAddress: z.string().min(10).optional(),
      googleMapsLink: z.string().url().optional(),
      gstNumber: gstSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required for update",
    }),
});

// Admin approve vendor schema
export const approveVendorSchema = z.object({
  body: z.object({
    commissionRate: z.number().min(0).max(100).optional(),
  }),
  params: z.object({
    vendorId: z.string().min(1, "Vendor ID is required"),
  }),
});

// ================================
// VALIDATION MIDDLEWARE
// ================================

/**
 * Generic validation middleware using Zod
 */
export const validate = (schema: z.ZodSchema) => {
  return (req: ValidatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues.map((error) => ({
            path: error.path.join("."),
            message: error.message,
          })),
        });
      }

      // Attach validated data to request
      req.validatedData = result.data;
      next();
    } catch (error) {
      console.error("Validation Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
};

/**
 * Sanitize string input
 */
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, "");
};

// ================================
// RATE LIMITING MIDDLEWARE
// ================================

/**
 * General API rate limiter - 100 requests per 15 minutes
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * OTP rate limiter - 5 OTP requests per 15 minutes per IP
 */
export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per windowMs
  message: {
    success: false,
    message: "Too many OTP requests. Please wait before requesting again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP and phone number combination using proper IPv6 handling
    const phoneNumber = req.body?.phoneNumber || "";
    const ip = ipKeyGenerator(req.ip || "unknown");
    return `${ip}-${phoneNumber}`;
  },
});

/**
 * Login rate limiter - 10 login attempts per 15 minutes per IP
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per windowMs
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Vendor registration rate limiter - 3 registrations per day per IP
 */
export const vendorRegistrationRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Limit each IP to 3 vendor registrations per day
  message: {
    success: false,
    message:
      "Too many vendor registration attempts. Please try again tomorrow.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ================================
// VALIDATION HELPER FUNCTIONS
// ================================

/**
 * Validate Indian phone number
 */
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  return phoneNumberSchema.safeParse(phoneNumber).success;
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  return emailSchema.safeParse(email).success;
};

/**
 * Validate GST number
 */
export const isValidGST = (gstNumber: string): boolean => {
  return gstSchema.safeParse(gstNumber).success;
};

/**
 * Validate PAN number
 */
export const isValidPAN = (panNumber: string): boolean => {
  return panSchema.safeParse(panNumber).success;
};

/**
 * Validate Aadhaar number
 */
export const isValidAadhaar = (aadhaarNumber: string): boolean => {
  return aadhaarSchema.safeParse(aadhaarNumber).success;
};

// ================================
// CUSTOM ERROR HANDLER
// ================================

/**
 * Error response helper
 */
export const sendValidationError = (
  res: Response,
  message: string,
  errors?: any[]
) => {
  return res.status(400).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};
