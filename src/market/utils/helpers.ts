import type {
  ApiResponse,
  ProductSearchParams,
  VendorSearchParams,
  OrderSearchParams,
} from "../../common/types.js";
import {
  PAGINATION,
  ORDER_STATUS_FLOW,
  COMMISSION_RATES,
} from "../../common/constants.js";
import { BookingStatus, VendorType } from "@prisma/client";

// ================================
// Response Helpers
// ================================

export function createSuccessResponse<T>(
  message: string,
  data?: T,
  meta?: any
): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    message,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (meta !== undefined) {
    response.meta = meta;
  }

  return response;
}

export function createErrorResponse(
  message: string,
  errors?: any
): ApiResponse {
  return {
    success: false,
    message,
    errors,
  };
}

// ================================
// Pagination Helpers
// ================================

export function getPaginationParams(page?: number, limit?: number) {
  const currentPage = Math.max(1, page || PAGINATION.DEFAULT_PAGE);
  const currentLimit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, limit || PAGINATION.DEFAULT_LIMIT)
  );
  const skip = (currentPage - 1) * currentLimit;

  return {
    page: currentPage,
    limit: currentLimit,
    skip,
    take: currentLimit,
  };
}

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ================================
// Search and Filter Helpers
// ================================

export function buildProductSearchQuery(params: ProductSearchParams) {
  const where: any = {
    isAvailable: true,
  };

  if (params.query) {
    where.OR = [
      { productName: { contains: params.query, mode: "insensitive" } },
      { description: { contains: params.query, mode: "insensitive" } },
    ];
  }

  if (params.category) {
    where.category = params.category;
  }

  if (params.minPrice !== undefined) {
    where.priceMin = { gte: params.minPrice };
  }

  if (params.maxPrice !== undefined) {
    where.priceMax = { lte: params.maxPrice };
  }

  if (params.hasDelivery !== undefined) {
    where.hasDelivery = params.hasDelivery;
  }

  if (params.location) {
    where.deliveryAreas = {
      has: params.location,
    };
  }

  return where;
}

export function buildVendorSearchQuery(params: VendorSearchParams) {
  const where: any = {};

  if (params.query) {
    where.OR = [
      { businessName: { contains: params.query, mode: "insensitive" } },
      { ownerName: { contains: params.query, mode: "insensitive" } },
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.vendorType) {
    where.vendorType = params.vendorType;
  }

  return where;
}

export function buildOrderSearchQuery(params: OrderSearchParams) {
  const where: any = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.vendorId) {
    where.vendorId = params.vendorId;
  }

  if (params.userId) {
    where.userId = params.userId;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.createdAt.lte = new Date(params.endDate);
    }
  }

  return where;
}

// ================================
// Business Logic Helpers
// ================================

export function calculateCommission(
  amount: number,
  vendorType: VendorType
): number {
  const rate =
    vendorType === VendorType.LOCAL_MARKET
      ? COMMISSION_RATES.LOCAL_MARKET
      : COMMISSION_RATES.DEFAULT;

  return (amount * rate) / 100;
}

export function calculateVendorAmount(
  totalAmount: number,
  commissionAmount: number
): number {
  return totalAmount - commissionAmount;
}

export function isValidOrderStatusTransition(
  currentStatus: BookingStatus,
  newStatus: BookingStatus
): boolean {
  const allowedTransitions = ORDER_STATUS_FLOW[
    currentStatus
  ] as readonly BookingStatus[];
  return allowedTransitions.includes(newStatus);
}

export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

export function generateInvoiceNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `INV-${timestamp}-${random}`.toUpperCase();
}

// ================================
// Date and Time Helpers
// ================================

export function getDateRange(period: "day" | "week" | "month" | "year") {
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case "day":
      startDate.setHours(0, 0, 0, 0);
      break;
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return { startDate, endDate: now };
}

export function formatCurrency(
  amount: number,
  currency: string = "INR"
): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// ================================
// File and Image Helpers
// ================================

export function generateImagePath(
  vendorId: string,
  productId?: string,
  fileName?: string
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  if (productId) {
    return `vendors/${vendorId}/products/${productId}/${timestamp}-${randomSuffix}`;
  }

  return `vendors/${vendorId}/profile/${timestamp}-${randomSuffix}`;
}

export function extractFileExtension(fileName: string): string {
  return fileName.substring(fileName.lastIndexOf("."));
}

export function isValidImageFile(mimetype: string): boolean {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  return allowedTypes.includes(mimetype);
}

// ================================
// Validation Helpers
// ================================

export function sanitizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");

  // Remove country code if present
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return cleaned.substring(2);
  }

  return cleaned;
}

export function validatePhoneNumber(phone: string): boolean {
  const sanitized = sanitizePhoneNumber(phone);
  return /^[6-9]\d{9}$/.test(sanitized);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateGSTNumber(gst: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst);
}

export function validatePANNumber(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
}

export function validateAADHAARNumber(aadhaar: string): boolean {
  return /^[2-9]{1}[0-9]{11}$/.test(aadhaar);
}

// ================================
// Error Handling Helpers
// ================================

export function isUniqueConstraintError(error: any): boolean {
  return error.code === "P2002";
}

export function isForeignKeyConstraintError(error: any): boolean {
  return error.code === "P2003";
}

export function isRecordNotFoundError(error: any): boolean {
  return error.code === "P2025";
}

export function extractPrismaErrorField(error: any): string | undefined {
  if (error.meta?.target) {
    return Array.isArray(error.meta.target)
      ? error.meta.target[0]
      : error.meta.target;
  }
  return undefined;
}

// ================================
// Analytics Helpers
// ================================

export function calculateGrowthPercentage(
  current: number,
  previous: number
): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function groupByPeriod<T>(
  data: T[],
  dateField: keyof T,
  period: "day" | "week" | "month"
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  data.forEach((item) => {
    const date = new Date(item[dateField] as any);
    let key: string;

    switch (period) {
      case "day":
        key = date.toISOString().split("T")[0] || "";
        break;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0] || "";
        break;
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        break;
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key]!.push(item);
  });

  return grouped;
}
