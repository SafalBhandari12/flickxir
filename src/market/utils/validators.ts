import { z } from "zod";
import { ProductCategory, VendorType } from "@prisma/client";
import { VALIDATION_RULES } from "../../common/constants.js";

// ================================
// Vendor Validation Schemas
// ================================

export const vendorOnboardingSchema = z.object({
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100),
  ownerName: z
    .string()
    .min(2, "Owner name must be at least 2 characters")
    .max(50),
  contactNumbers: z
    .array(
      z
        .string()
        .regex(
          VALIDATION_RULES.PHONE_NUMBER.pattern,
          VALIDATION_RULES.PHONE_NUMBER.message
        )
    )
    .min(1),
  email: z.string().email("Invalid email format"),
  businessAddress: z
    .string()
    .min(10, "Business address must be at least 10 characters")
    .max(500),
  googleMapsLink: z.string().url("Invalid Google Maps link"),
  gstNumber: z
    .string()
    .regex(
      VALIDATION_RULES.GST_NUMBER.pattern,
      VALIDATION_RULES.GST_NUMBER.message
    ),
  panNumber: z
    .string()
    .regex(
      VALIDATION_RULES.PAN_NUMBER.pattern,
      VALIDATION_RULES.PAN_NUMBER.message
    ),
  aadhaarNumber: z
    .string()
    .regex(
      VALIDATION_RULES.AADHAAR_NUMBER.pattern,
      VALIDATION_RULES.AADHAAR_NUMBER.message
    ),
  vendorType: z.nativeEnum(VendorType),
  shopName: z.string().min(2).max(100).optional(),
  bankDetails: z.object({
    accountNumber: z.string().min(9).max(20),
    ifscCode: z
      .string()
      .regex(
        VALIDATION_RULES.IFSC_CODE.pattern,
        VALIDATION_RULES.IFSC_CODE.message
      ),
    bankName: z.string().min(2).max(100),
    branchName: z.string().min(2).max(100),
    accountHolder: z.string().min(2).max(100),
  }),
});

export const vendorUpdateSchema = z.object({
  businessName: z.string().min(2).max(100).optional(),
  ownerName: z.string().min(2).max(50).optional(),
  contactNumbers: z
    .array(z.string().regex(VALIDATION_RULES.PHONE_NUMBER.pattern))
    .min(1)
    .optional(),
  email: z.string().email().optional(),
  businessAddress: z.string().min(10).max(500).optional(),
  googleMapsLink: z.string().url().optional(),
  shopName: z.string().min(2).max(100).optional(),
});

export const vendorApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  commissionRate: z.number().min(0).max(50).optional(),
  rejectionReason: z.string().max(500).optional(),
});

// ================================
// Product Validation Schemas
// ================================

export const productCreateSchema = z
  .object({
    medicineName: z
      .string()
      .min(2, "Medicine name must be at least 2 characters")
      .max(100),
    category: z.nativeEnum(ProductCategory),
    description: z.string().max(1000).optional(),
    priceMin: z.number().min(0.01, "Minimum price must be greater than 0"),
    priceMax: z.number().min(0.01, "Maximum price must be greater than 0"),
    minOrderQuantity: z
      .number()
      .int()
      .min(1, "Minimum order quantity must be at least 1"),
    hasDelivery: z.boolean().default(false),
    deliveryAreas: z.array(z.string().max(100)).default([]),
    certifications: z.array(z.string().max(100)).default([]),
  })
  .refine((data) => data.priceMax >= data.priceMin, {
    message: "Maximum price must be greater than or equal to minimum price",
    path: ["priceMax"],
  });

export const productUpdateSchema = z
  .object({
    medicineName: z.string().min(2).max(100).optional(),
    category: z.nativeEnum(ProductCategory).optional(),
    description: z.string().max(1000).optional(),
    priceMin: z.number().min(0.01).optional(),
    priceMax: z.number().min(0.01).optional(),
    minOrderQuantity: z.number().int().min(1).optional(),
    hasDelivery: z.boolean().optional(),
    deliveryAreas: z.array(z.string().max(100)).optional(),
    certifications: z.array(z.string().max(100)).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.priceMin && data.priceMax) {
        return data.priceMax >= data.priceMin;
      }
      return true;
    },
    {
      message: "Maximum price must be greater than or equal to minimum price",
      path: ["priceMax"],
    }
  );

// ================================
// Order Validation Schemas
// ================================

export const orderItemSchema = z.object({
  productId: z.string().cuid("Invalid product ID"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0.01, "Unit price must be greater than 0"),
  requiresDelivery: z.boolean().default(false),
  deliveryAddress: z.string().max(500).optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
  totalAmount: z.number().min(0.01, "Total amount must be greater than 0"),
  paymentMethod: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
  notes: z.string().max(500).optional(),
});

// ================================
// Search and Filter Schemas
// ================================

export const productSearchSchema = z.object({
  query: z.string().max(100).optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  hasDelivery: z.boolean().optional(),
  location: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const vendorSearchSchema = z.object({
  query: z.string().max(100).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
  vendorType: z.nativeEnum(VendorType).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const orderSearchSchema = z.object({
  status: z
    .enum(["DRAFT", "PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"])
    .optional(),
  vendorId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// ================================
// Payment Validation Schemas
// ================================

export const paymentVerificationSchema = z.object({
  razorpay_payment_id: z.string().min(1, "Payment ID is required"),
  razorpay_order_id: z.string().min(1, "Order ID is required"),
  razorpay_signature: z.string().min(1, "Signature is required"),
});

// ================================
// Profile Validation Schemas
// ================================

export const userProfileUpdateSchema = z.object({
  // Add user profile fields as needed
});

export const adminPermissionsSchema = z.object({
  permissions: z
    .array(z.string())
    .min(1, "At least one permission is required"),
});

// ================================
// File Upload Validation
// ================================

export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z
    .string()
    .refine(
      (type) =>
        ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(type),
      "Only JPEG, PNG, and WebP images are allowed"
    ),
  size: z.number().max(5 * 1024 * 1024, "File size cannot exceed 5MB"),
});

// Type inference for TypeScript
export type VendorOnboardingData = z.infer<typeof vendorOnboardingSchema>;
export type VendorUpdateData = z.infer<typeof vendorUpdateSchema>;
export type VendorApprovalData = z.infer<typeof vendorApprovalSchema>;
export type ProductCreateData = z.infer<typeof productCreateSchema>;
export type ProductUpdateData = z.infer<typeof productUpdateSchema>;
export type OrderItemData = z.infer<typeof orderItemSchema>;
export type CreateOrderData = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusData = z.infer<typeof updateOrderStatusSchema>;
export type ProductSearchParams = z.infer<typeof productSearchSchema>;
export type VendorSearchParams = z.infer<typeof vendorSearchSchema>;
export type OrderSearchParams = z.infer<typeof orderSearchSchema>;
export type PaymentVerificationData = z.infer<typeof paymentVerificationSchema>;
