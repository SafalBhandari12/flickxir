import { Router } from "express";
import { AdminController } from "../controllers/adminController.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = Router();
const adminController = new AdminController();

// ================================
// Dashboard Routes
// ================================

// Get dashboard statistics
router.get(
  "/dashboard/stats",
  authMiddleware,
  adminController.getDashboardStats.bind(adminController)
);

// ================================
// User Management Routes
// ================================

// Get all users
router.get(
  "/users",
  authMiddleware,
  adminController.getAllUsers.bind(adminController)
);

// Toggle user status (activate/deactivate)
router.patch(
  "/users/:id/toggle-status",
  authMiddleware,
  adminController.toggleUserStatus.bind(adminController)
);

// ================================
// Order Management Routes
// ================================

// Get all orders
router.get(
  "/orders",
  authMiddleware,
  adminController.getAllOrders.bind(adminController)
);

// Export orders data
router.get(
  "/orders/export",
  authMiddleware,
  adminController.exportOrders.bind(adminController)
);

// ================================
// Analytics and Reports Routes
// ================================

// Get sales analytics
router.get(
  "/analytics/sales",
  authMiddleware,
  adminController.getSalesAnalytics.bind(adminController)
);

// Get product performance
router.get(
  "/analytics/products",
  authMiddleware,
  adminController.getProductPerformance.bind(adminController)
);

// Get vendor performance
router.get(
  "/analytics/vendors",
  authMiddleware,
  adminController.getVendorPerformance.bind(adminController)
);

// Get user activity report
router.get(
  "/analytics/users",
  authMiddleware,
  adminController.getUserActivityReport.bind(adminController)
);

// ================================
// System Configuration Routes
// ================================

// Get system configuration
router.get(
  "/config",
  authMiddleware,
  adminController.getSystemConfig.bind(adminController)
);

// Update system configuration
router.post(
  "/config",
  authMiddleware,
  adminController.updateSystemConfig.bind(adminController)
);

export { router as adminRoutes };
