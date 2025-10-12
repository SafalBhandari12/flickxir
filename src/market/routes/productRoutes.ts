import { Router } from "express";
import { ProductController } from "../controllers/productController.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  uploadProductImages,
  handleMulterError,
} from "../../middleware/upload.js";

const router = Router();
const productController = new ProductController();

// ================================
// Public Routes
// ================================

// Get all products with search and filters
router.get("/", productController.getProducts.bind(productController));

// Get product by ID
router.get("/:id", productController.getProductById.bind(productController));

// Get product categories
router.get(
  "/categories/list",
  productController.getProductCategories.bind(productController)
);

// ================================
// Vendor Routes (Authentication Required)
// ================================

// Create product
router.post(
  "/",
  authMiddleware,
  uploadProductImages,
  handleMulterError,
  productController.createProduct.bind(productController)
);

// Get vendor's own products
router.get(
  "/vendor/my-products",
  authMiddleware,
  productController.getVendorProducts.bind(productController)
);

// Update product
router.put(
  "/:id",
  authMiddleware,
  productController.updateProduct.bind(productController)
);

// Delete product (soft delete)
router.delete(
  "/:id",
  authMiddleware,
  productController.deleteProduct.bind(productController)
);

// Toggle product availability
router.patch(
  "/:id/toggle-availability",
  authMiddleware,
  productController.toggleProductAvailability.bind(productController)
);

// Add images to product
router.post(
  "/:id/images",
  authMiddleware,
  uploadProductImages,
  handleMulterError,
  productController.addProductImages.bind(productController)
);

// Delete product image
router.delete(
  "/:id/images/:imageId",
  authMiddleware,
  productController.deleteProductImage.bind(productController)
);

export { router as productRoutes };
