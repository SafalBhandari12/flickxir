import { ProductCategory } from "@prisma/client";

// ================================
// API Constants
// ================================

export const API_MESSAGES = {
  // Success Messages
  SUCCESS: {
    VENDOR_CREATED: "Vendor profile created successfully",
    VENDOR_APPROVED: "Vendor approved successfully",
    VENDOR_REJECTED: "Vendor rejected",
    PRODUCT_CREATED: "Product created successfully",
    PRODUCT_UPDATED: "Product updated successfully",
    PRODUCT_DELETED: "Product deleted successfully",
    ORDER_CREATED: "Order placed successfully",
    ORDER_UPDATED: "Order status updated",
    PAYMENT_SUCCESS: "Payment processed successfully",
    PROFILE_UPDATED: "Profile updated successfully",
  },

  // Error Messages
  ERROR: {
    UNAUTHORIZED: "Unauthorized access",
    FORBIDDEN: "Access forbidden",
    NOT_FOUND: "Resource not found",
    VALIDATION_ERROR: "Validation error",
    VENDOR_NOT_FOUND: "Vendor not found",
    PRODUCT_NOT_FOUND: "Product not found",
    ORDER_NOT_FOUND: "Order not found",
    INSUFFICIENT_STOCK: "Insufficient stock",
    PAYMENT_FAILED: "Payment processing failed",
    VENDOR_NOT_APPROVED: "Vendor is not approved",
    PRODUCT_UNAVAILABLE: "Product is not available",
    INVALID_ORDER_STATUS: "Invalid order status transition",
  },
} as const;

// ================================
// Pagination Constants
// ================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// ================================
// Order Status Flow
// ================================

export const ORDER_STATUS_FLOW = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
} as const;

// ================================
// Commission Rates
// ================================

export const COMMISSION_RATES = {
  LOCAL_MARKET: 10.0, // 10%
  DEFAULT: 16.0, // 16%
} as const;

// ================================
// File Upload Constants
// ================================

export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES_PER_PRODUCT: 5,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
} as const;

// ================================
// Product Categories with Labels
// ================================

export const PRODUCT_CATEGORIES = {
  [ProductCategory.PRESCRIPTION_MEDICINE]: {
    label: "Prescription Medicine",
    description: "Prescription drugs requiring doctor's prescription",
  },
  [ProductCategory.OTC_MEDICINE]: {
    label: "Over-the-Counter Medicine",
    description: "Non-prescription medicines and supplements",
  },
  [ProductCategory.HEALTH_SUPPLEMENTS]: {
    label: "Health Supplements",
    description: "Vitamins, minerals, and nutritional supplements",
  },
  [ProductCategory.MEDICAL_DEVICES]: {
    label: "Medical Devices",
    description: "Medical equipment and diagnostic devices",
  },
  [ProductCategory.PERSONAL_CARE]: {
    label: "Personal Care",
    description: "Personal hygiene and beauty products",
  },
  [ProductCategory.BABY_CARE]: {
    label: "Baby Care",
    description: "Baby care products and infant supplies",
  },
  [ProductCategory.FITNESS_WELLNESS]: {
    label: "Fitness & Wellness",
    description: "Fitness equipment and wellness products",
  },
  [ProductCategory.AYURVEDIC_HERBAL]: {
    label: "Ayurvedic & Herbal",
    description: "Traditional ayurvedic and herbal medicines",
  },
  [ProductCategory.OTHER]: {
    label: "Other",
    description: "Other pharmacy and health products",
  },
} as const;

// ================================
// Notification Templates
// ================================

export const NOTIFICATION_TEMPLATES = {
  ORDER_PLACED: {
    title: "Order Placed Successfully",
    message:
      "Your order #{orderId} has been placed and is awaiting vendor confirmation.",
  },
  ORDER_CONFIRMED: {
    title: "Order Confirmed",
    message: "Your order #{orderId} has been confirmed by the vendor.",
  },
  ORDER_COMPLETED: {
    title: "Order Completed",
    message:
      "Your order #{orderId} has been completed. Thank you for shopping with us!",
  },
  ORDER_CANCELLED: {
    title: "Order Cancelled",
    message: "Your order #{orderId} has been cancelled.",
  },
  VENDOR_APPROVED: {
    title: "Vendor Application Approved",
    message:
      "Congratulations! Your vendor application has been approved. You can now start listing products.",
  },
  VENDOR_REJECTED: {
    title: "Vendor Application Rejected",
    message:
      "Your vendor application has been rejected. Please contact support for more information.",
  },
  NEW_ORDER_VENDOR: {
    title: "New Order Received",
    message: "You have received a new order #{orderId} worth ₹{amount}.",
  },
  PAYMENT_SUCCESS: {
    title: "Payment Successful",
    message:
      "Payment of ₹{amount} for order #{orderId} has been processed successfully.",
  },
} as const;

// ================================
// Validation Rules
// ================================

export const VALIDATION_RULES = {
  PHONE_NUMBER: {
    pattern: /^[6-9]\d{9}$/,
    message: "Phone number must be a valid 10-digit Indian mobile number",
  },
  EMAIL: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Invalid email format",
  },
  GST_NUMBER: {
    pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    message: "Invalid GST number format",
  },
  PAN_NUMBER: {
    pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    message: "Invalid PAN number format",
  },
  AADHAAR_NUMBER: {
    pattern: /^[2-9]{1}[0-9]{11}$/,
    message: "Invalid Aadhaar number format",
  },
  IFSC_CODE: {
    pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    message: "Invalid IFSC code format",
  },
} as const;

// ================================
// Payment Constants
// ================================

export const PAYMENT = {
  CURRENCY: "INR",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
} as const;

// ================================
// Database Query Limits
// ================================

export const DB_LIMITS = {
  MAX_SEARCH_RESULTS: 1000,
  BATCH_SIZE: 100,
  MAX_INCLUDE_DEPTH: 3,
} as const;

// ================================
// Cache Constants
// ================================

export const CACHE = {
  TTL: {
    PRODUCTS: 300, // 5 minutes
    VENDORS: 600, // 10 minutes
    DASHBOARD_STATS: 900, // 15 minutes
  },
  KEYS: {
    PRODUCTS: "products:",
    VENDORS: "vendors:",
    STATS: "stats:",
  },
} as const;

// ================================
// Rate Limiting
// ================================

export const RATE_LIMITS = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
  },
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // requests per window
  },
  UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // requests per window
  },
} as const;
