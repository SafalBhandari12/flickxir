import { Router } from "express";
import { VendorController } from "../controllers/vendorController.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = Router();
const vendorController = new VendorController();

// ================================
// Public Routes
// ================================

// Get vendor by ID (public - for customers to view vendor details)
router.get("/:id", vendorController.getVendorById.bind(vendorController));

// ================================
// Customer/Vendor Routes (Authentication Required)
// ================================

// Vendor onboarding - allows customers to become vendors
router.post(
  "/onboard",
  authMiddleware,
  vendorController.onboardVendor.bind(vendorController)
);

// ================================
// Vendor Routes (Authentication Required)
// ================================

// Get vendor's own profile
router.get(
  "/profile/me",
  authMiddleware,
  vendorController.getVendorProfile.bind(vendorController)
);

// Update vendor profile
router.put(
  "/profile/me",
  authMiddleware,
  vendorController.updateVendorProfile.bind(vendorController)
);

// ================================
// Admin Routes (Authentication Required)
// ================================

// Get all vendors (admin only)
router.get(
  "/",
  authMiddleware,
  vendorController.getAllVendors.bind(vendorController)
);

// Approve/reject vendor (admin only)
router.patch(
  "/:id/status",
  authMiddleware,
  vendorController.updateVendorStatus.bind(vendorController)
);

export { router as vendorRoutes };
