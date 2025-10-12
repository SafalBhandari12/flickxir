import { Router } from "express";
import { OrderController } from "../controllers/orderController.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = Router();
const orderController = new OrderController();

// ================================
// Customer Routes (Authentication Required)
// ================================

// Create order
router.post(
  "/",
  authMiddleware,
  orderController.createOrder.bind(orderController)
);

// Get customer's orders
router.get(
  "/customer/my-orders",
  authMiddleware,
  orderController.getCustomerOrders.bind(orderController)
);

// Cancel order
router.patch(
  "/:id/cancel",
  authMiddleware,
  orderController.cancelOrder.bind(orderController)
);

// ================================
// Vendor Routes (Authentication Required)
// ================================

// Get vendor's orders
router.get(
  "/vendor/my-orders",
  authMiddleware,
  orderController.getVendorOrders.bind(orderController)
);

// Update order status
router.patch(
  "/:id/status",
  authMiddleware,
  orderController.updateOrderStatus.bind(orderController)
);

// ================================
// Common Routes (Authentication Required)
// ================================

// Get order by ID (accessible by customer, vendor, or admin)
router.get(
  "/:id",
  authMiddleware,
  orderController.getOrderById.bind(orderController)
);

export { router as orderRoutes };
