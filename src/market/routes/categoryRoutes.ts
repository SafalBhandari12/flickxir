import { Router } from "express";
import { CategoryController } from "../controllers/categoryController.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = Router();
const categoryController = new CategoryController();

// ================================
// Public Routes
// ================================

// Get all categories
router.get("/", categoryController.getCategories.bind(categoryController));

// Get category by ID
router.get("/:id", categoryController.getCategoryById.bind(categoryController));

// ================================
// Admin Routes (Authentication Required)
// ================================

// Create category
router.post(
  "/",
  authMiddleware,
  categoryController.createCategory.bind(categoryController)
);

// Update category
router.put(
  "/:id",
  authMiddleware,
  categoryController.updateCategory.bind(categoryController)
);

// Delete category
router.delete(
  "/:id",
  authMiddleware,
  categoryController.deleteCategory.bind(categoryController)
);

// Toggle category status
router.patch(
  "/:id/toggle-status",
  authMiddleware,
  categoryController.toggleCategoryStatus.bind(categoryController)
);

export { router as categoryRoutes };
