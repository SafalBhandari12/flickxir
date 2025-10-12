import {
  UserRole,
  VendorType,
  VendorStatus,
  ProductCategory,
  BookingStatus,
} from "@prisma/client";

// ================================
// API Response Types
// ================================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// ================================
// Authentication Types
// ================================

export interface JWTPayload {
  userId: string;
  phoneNumber: string;
  role: UserRole;
  tokenId?: string;
}

export interface AuthenticatedUser {
  userId: string;
  phoneNumber: string;
  role: UserRole;
  vendorId?: string;
  adminId?: string;
}

// ================================
// Vendor Types
// ================================

export interface VendorOnboardingData {
  businessName: string;
  ownerName: string;
  contactNumbers: string[];
  email: string;
  businessAddress: string;
  googleMapsLink: string;
  gstNumber: string;
  panNumber: string;
  aadhaarNumber: string;
  vendorType: VendorType;
  shopName?: string; // For local market vendors
  bankDetails: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName: string;
    accountHolder: string;
  };
}

export interface VendorProfile {
  id: string;
  businessName: string;
  ownerName: string;
  contactNumbers: string[];
  email: string;
  businessAddress: string;
  status: VendorStatus;
  vendorType: VendorType;
  commissionRate: number;
  createdAt: Date;
  marketProfile?: {
    shopName: string;
    products: ProductSummary[];
  };
}

// ================================
// Product Types
// ================================

export interface ProductData {
  productName: string;
  category: ProductCategory;
  description?: string;
  priceMin: number;
  priceMax: number;
  minOrderQuantity: number;
  hasDelivery: boolean;
  deliveryAreas: string[];
  certifications: string[];
  images?: string[]; // URLs
}

export interface ProductSummary {
  id: string;
  productName: string;
  category: ProductCategory;
  priceMin: number;
  priceMax: number;
  isAvailable: boolean;
  images: string[];
}

export interface ProductDetails extends ProductSummary {
  description?: string;
  minOrderQuantity: number;
  hasDelivery: boolean;
  deliveryAreas: string[];
  certifications: string[];
  vendor: {
    id: string;
    businessName: string;
    shopName: string;
    contactNumbers: string[];
    businessAddress: string;
  };
}

// ================================
// Order Types
// ================================

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  requiresDelivery?: boolean;
  deliveryAddress?: string;
}

export interface CreateOrderData {
  items: OrderItem[];
  totalAmount: number;
  paymentMethod?: string;
}

export interface OrderSummary {
  id: string;
  totalAmount: number;
  status: BookingStatus;
  createdAt: Date;
  itemCount: number;
  vendorName: string;
}

export interface OrderDetails extends OrderSummary {
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    requiresDelivery: boolean;
    deliveryAddress?: string;
  }[];
  vendor: {
    id: string;
    businessName: string;
    contactNumbers: string[];
    businessAddress: string;
  };
  payment?: {
    paymentStatus: string;
    paymentMethod?: string;
    transactionId?: string;
  };
}

// ================================
// Payment Types
// ================================

export interface PaymentData {
  amount: number;
  currency: string;
  orderId: string;
  customerInfo: {
    name: string;
    phone: string;
    email?: string;
  };
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentVerificationData {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// ================================
// Notification Types
// ================================

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: "ORDER_UPDATE" | "PAYMENT_SUCCESS" | "VENDOR_APPROVAL" | "GENERAL";
  data?: any;
}

// ================================
// Analytics Types
// ================================

export interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  totalOrders: number;
  totalRevenue: number;
  pendingApprovals: number;
  monthlyStats: {
    orders: number;
    revenue: number;
    newUsers: number;
    newVendors: number;
  };
}

export interface VendorEarnings {
  totalEarnings: number;
  currentMonthEarnings: number;
  totalOrders: number;
  pendingPayments: number;
  recentOrders: OrderSummary[];
}

// ================================
// Search and Filter Types
// ================================

export interface ProductSearchParams {
  query?: string;
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  hasDelivery?: boolean;
  location?: string;
  page?: number;
  limit?: number;
}

export interface VendorSearchParams {
  query?: string;
  status?: VendorStatus;
  vendorType?: VendorType;
  page?: number;
  limit?: number;
}

export interface OrderSearchParams {
  status?: BookingStatus;
  vendorId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}
