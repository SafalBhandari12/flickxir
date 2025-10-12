import { z } from "zod";

// ================================
// ZOD VALIDATION SCHEMAS
// ================================

// Phone number schema
export const phoneNumberSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone number must be exactly 10 digits");

// OTP code schema
export const otpCodeSchema = z
  .string()
  .regex(/^\d{4,6}$/, "OTP code must be 4-6 digits");

// Send OTP validation schema
export const sendOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

// Verify OTP validation schema
export const verifyOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
  verificationId: z.string().min(1, "Verification ID is required"),
  code: otpCodeSchema,
});

// Resend OTP validation schema
export const resendOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

// Vendor registration schema
export const vendorRegistrationSchema = z.object({
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters"),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
  contactNumbers: z
    .array(phoneNumberSchema)
    .min(1, "At least one contact number is required"),
  email: z.string().email("Invalid email format"),
  businessAddress: z
    .string()
    .min(10, "Business address must be at least 10 characters"),
  googleMapsLink: z.string().url("Invalid Google Maps link"),
  gstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST number format"
    ),
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format"),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, "Aadhaar number must be 12 digits"),
  vendorType: z.enum([
    "HOTEL",
    "ADVENTURE",
    "TRANSPORT",
    "LOCAL_MARKET",
    "OTHER",
  ]),
  bankDetails: z.object({
    accountNumber: z
      .string()
      .min(8, "Account number must be at least 8 digits"),
    ifscCode: z
      .string()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
    bankName: z.string().min(2, "Bank name is required"),
    branchName: z.string().min(2, "Branch name is required"),
    accountHolder: z.string().min(2, "Account holder name is required"),
  }),
});

// Admin assignment schema
export const adminAssignmentSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .optional(),
  email: z.string().email("Invalid email format").optional(),
  permissions: z.array(z.string()).optional(),
});

// User status toggle schema
export const toggleStatusSchema = z.object({
  isActive: z.boolean(),
});

// Admin profile update schema
export const adminProfileUpdateSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .optional(),
  email: z.string().email("Invalid email format").optional(),
  permissions: z.array(z.string()).optional(),
});

// ================================
// VALIDATION HELPER FUNCTIONS
// ================================

/**
 * Helper function to format validation errors
 */
export const formatValidationErrors = (error: z.ZodError) => {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
};

/**
 * Generic validation function
 */
export const validateRequest = <T>(schema: z.ZodSchema<T>, data: any) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: formatValidationErrors(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};
