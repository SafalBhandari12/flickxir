import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  createSuccessResponse,
  createErrorResponse,
  getPaginationParams,
  createPaginationMeta,
} from "../utils/helpers.js";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
} from "../utils/validators.js";
import { API_MESSAGES } from "../../common/constants.js";
import type { AuthenticatedUser } from "../../common/types.js";

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const prisma = new PrismaClient();

export class CategoryController {
  // ================================
  // Get All Categories (Public)
  // ================================

  async getCategories(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const includeInactive = req.query.includeInactive === "true";

      const { skip, take } = getPaginationParams(page, limit);

      // Build where clause
      const where: any = {};
      if (!includeInactive) {
        where.isActive = true;
      }

      // Get categories with product counts
      const [categories, total] = await Promise.all([
        prisma.category.findMany({
          where,
          skip,
          take,
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            _count: {
              select: { products: { where: { isAvailable: true } } },
            },
          },
        }),
        prisma.category.count({ where }),
      ]);

      const formattedCategories = categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        slug: category.slug,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        productCount: category._count.products,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }));

      const meta = createPaginationMeta(page, limit, total);

      res.json(
        createSuccessResponse(
          "Categories retrieved successfully",
          formattedCategories,
          meta
        )
      );
    } catch (error) {
      console.error("Error getting categories:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve categories"));
    }
  }

  // ================================
  // Get Category by ID (Public)
  // ================================

  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Category ID is required"));
      }

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: { products: { where: { isAvailable: true } } },
          },
        },
      });

      if (!category) {
        return res.status(404).json(createErrorResponse("Category not found"));
      }

      const formattedCategory = {
        id: category.id,
        name: category.name,
        description: category.description,
        slug: category.slug,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        productCount: category._count.products,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      };

      res.json(
        createSuccessResponse(
          "Category retrieved successfully",
          formattedCategory
        )
      );
    } catch (error) {
      console.error("Error getting category:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve category"));
    }
  }

  // ================================
  // Create Category (Admin Only)
  // ================================

  async createCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      // Check if user is admin
      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Validate request data
      const validationResult = categoryCreateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              API_MESSAGES.ERROR.VALIDATION_ERROR,
              validationResult.error.issues
            )
          );
      }

      const categoryData = validationResult.data;

      // Generate slug from name
      const slug = categoryData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      // Check if name or slug already exists
      const existingCategory = await prisma.category.findFirst({
        where: {
          OR: [
            { name: { equals: categoryData.name, mode: "insensitive" } },
            { slug: slug },
          ],
        },
      });

      if (existingCategory) {
        return res
          .status(400)
          .json(createErrorResponse("Category name already exists"));
      }

      // Create category
      const category = await prisma.category.create({
        data: {
          name: categoryData.name,
          description: categoryData.description ?? null,
          slug: slug,
          isActive: categoryData.isActive ?? true,
          sortOrder: categoryData.sortOrder ?? 0,
        },
      });

      res.status(201).json(
        createSuccessResponse("Category created successfully", {
          id: category.id,
          name: category.name,
          description: category.description,
          slug: category.slug,
          isActive: category.isActive,
          sortOrder: category.sortOrder,
          createdAt: category.createdAt,
        })
      );
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json(createErrorResponse("Failed to create category"));
    }
  }

  // ================================
  // Update Category (Admin Only)
  // ================================

  async updateCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Category ID is required"));
      }

      // Check if user is admin
      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Validate request data
      const validationResult = categoryUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              API_MESSAGES.ERROR.VALIDATION_ERROR,
              validationResult.error.issues
            )
          );
      }

      // Check if category exists
      const existingCategory = await prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        return res.status(404).json(createErrorResponse("Category not found"));
      }

      const updateData = validationResult.data;
      const dataToUpdate: any = {};

      // Handle name update (regenerate slug if name changes)
      if (updateData.name && updateData.name !== existingCategory.name) {
        const newSlug = updateData.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        // Check if new name or slug conflicts
        const conflictingCategory = await prisma.category.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [
                  { name: { equals: updateData.name, mode: "insensitive" } },
                  { slug: newSlug },
                ],
              },
            ],
          },
        });

        if (conflictingCategory) {
          return res
            .status(400)
            .json(createErrorResponse("Category name already exists"));
        }

        dataToUpdate.name = updateData.name;
        dataToUpdate.slug = newSlug;
      }

      // Add other fields if they exist
      if (updateData.description !== undefined) {
        dataToUpdate.description = updateData.description ?? null;
      }
      if (updateData.isActive !== undefined) {
        dataToUpdate.isActive = updateData.isActive;
      }
      if (updateData.sortOrder !== undefined) {
        dataToUpdate.sortOrder = updateData.sortOrder;
      }

      // Update category
      const updatedCategory = await prisma.category.update({
        where: { id },
        data: dataToUpdate,
      });

      res.json(
        createSuccessResponse("Category updated successfully", {
          id: updatedCategory.id,
          name: updatedCategory.name,
          description: updatedCategory.description,
          slug: updatedCategory.slug,
          isActive: updatedCategory.isActive,
          sortOrder: updatedCategory.sortOrder,
          updatedAt: updatedCategory.updatedAt,
        })
      );
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json(createErrorResponse("Failed to update category"));
    }
  }

  // ================================
  // Delete Category (Admin Only)
  // ================================

  async deleteCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Category ID is required"));
      }

      // Check if user is admin
      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Check if category exists
      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      if (!category) {
        return res.status(404).json(createErrorResponse("Category not found"));
      }

      // Check if category has products
      if (category._count.products > 0) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "Cannot delete category that has products. Please reassign products to another category first."
            )
          );
      }

      // Delete category
      await prisma.category.delete({
        where: { id },
      });

      res.json(createSuccessResponse("Category deleted successfully"));
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json(createErrorResponse("Failed to delete category"));
    }
  }

  // ================================
  // Toggle Category Status (Admin Only)
  // ================================

  async toggleCategoryStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Category ID is required"));
      }

      // Check if user is admin
      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Check if category exists
      const category = await prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        return res.status(404).json(createErrorResponse("Category not found"));
      }

      // Toggle status
      const updatedCategory = await prisma.category.update({
        where: { id },
        data: { isActive: !category.isActive },
      });

      res.json(
        createSuccessResponse(
          `Category ${
            updatedCategory.isActive ? "activated" : "deactivated"
          } successfully`,
          {
            id: updatedCategory.id,
            isActive: updatedCategory.isActive,
          }
        )
      );
    } catch (error) {
      console.error("Error toggling category status:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to toggle category status"));
    }
  }
}
