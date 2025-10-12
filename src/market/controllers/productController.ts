import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  createSuccessResponse,
  createErrorResponse,
  getPaginationParams,
  createPaginationMeta,
} from "../utils/helpers.js";
import {
  productCreateSchema,
  productUpdateSchema,
  productSearchSchema,
} from "../utils/validators.js";
import { API_MESSAGES } from "../../common/constants.js";
import type { AuthenticatedUser } from "../../common/types.js";

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const prisma = new PrismaClient();

export class ProductController {
  // ================================
  // Create Product (Vendor)
  // ================================

  async createProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      // Validate vendor permissions
      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Check if vendor is approved
      const vendor = await prisma.vendor.findUnique({
        where: { id: user.vendorId },
        include: { marketProfile: true },
      });

      if (!vendor || vendor.status !== "APPROVED") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.VENDOR_NOT_APPROVED));
      }

      if (!vendor.marketProfile) {
        return res
          .status(400)
          .json(createErrorResponse("Vendor does not have a market profile"));
      }

      // Validate request data
      const validationResult = productCreateSchema.safeParse(req.body);
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

      const productData = validationResult.data;

      // Create product
      const product = await prisma.product.create({
        data: {
          localMarketProfileId: vendor.marketProfile.id,
          productName: productData.productName,
          category: productData.category,
          description: productData.description ?? null,
          priceMin: productData.priceMin,
          priceMax: productData.priceMax,
          minOrderQuantity: productData.minOrderQuantity,
          hasDelivery: productData.hasDelivery,
          deliveryAreas: productData.deliveryAreas,
          certifications: productData.certifications,
        },
      });

      res.status(201).json(
        createSuccessResponse(API_MESSAGES.SUCCESS.PRODUCT_CREATED, {
          id: product.id,
          productName: product.productName,
          category: product.category,
          description: product.description,
          priceMin: product.priceMin,
          priceMax: product.priceMax,
          minOrderQuantity: product.minOrderQuantity,
          hasDelivery: product.hasDelivery,
          deliveryAreas: product.deliveryAreas,
          certifications: product.certifications,
          isAvailable: product.isAvailable,
          createdAt: product.createdAt,
        })
      );
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json(createErrorResponse("Failed to create product"));
    }
  }

  // ================================
  // Get Products (Public - with search and filters)
  // ================================

  async getProducts(req: Request, res: Response) {
    try {
      // Simple query parameter parsing without strict validation for now
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const query = req.query.query as string;
      const category = req.query.category as string;
      const hasDelivery = req.query.hasDelivery === "true";

      const { skip, take } = getPaginationParams(page, limit);

      // Build where clause
      const where: any = {
        isAvailable: true,
      };

      if (query) {
        where.OR = [
          { productName: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ];
      }

      if (category) {
        where.category = category;
      }

      if (req.query.hasDelivery !== undefined) {
        where.hasDelivery = hasDelivery;
      }

      // Get products with pagination
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            localMarketProfile: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    businessName: true,
                    businessAddress: true,
                    contactNumbers: true,
                  },
                },
              },
            },
          },
        }),
        prisma.product.count({ where }),
      ]);

      const formattedProducts = products.map((product) => ({
        id: product.id,
        productName: product.productName,
        category: product.category,
        description: product.description,
        priceMin: product.priceMin,
        priceMax: product.priceMax,
        minOrderQuantity: product.minOrderQuantity,
        hasDelivery: product.hasDelivery,
        deliveryAreas: product.deliveryAreas,
        certifications: product.certifications,
        isAvailable: product.isAvailable,
        vendor: {
          id: product.localMarketProfile.vendor.id,
          businessName: product.localMarketProfile.vendor.businessName,
          businessAddress: product.localMarketProfile.vendor.businessAddress,
          contactNumbers: product.localMarketProfile.vendor.contactNumbers,
        },
        images: [], // TODO: Add image URLs when image upload is implemented
        createdAt: product.createdAt,
      }));

      const meta = createPaginationMeta(page, limit, total);

      res.json(
        createSuccessResponse(
          "Products retrieved successfully",
          formattedProducts,
          meta
        )
      );
    } catch (error) {
      console.error("Error getting products:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve products"));
    }
  }

  // ================================
  // Get Product by ID (Public)
  // ================================

  async getProductById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Product ID is required"));
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          localMarketProfile: {
            include: {
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  businessAddress: true,
                  contactNumbers: true,
                  googleMapsLink: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.PRODUCT_NOT_FOUND));
      }

      if (!product.isAvailable) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.PRODUCT_UNAVAILABLE));
      }

      const formattedProduct = {
        id: product.id,
        productName: product.productName,
        category: product.category,
        description: product.description,
        priceMin: product.priceMin,
        priceMax: product.priceMax,
        minOrderQuantity: product.minOrderQuantity,
        hasDelivery: product.hasDelivery,
        deliveryAreas: product.deliveryAreas,
        certifications: product.certifications,
        isAvailable: product.isAvailable,
        vendor: {
          id: product.localMarketProfile.vendor.id,
          businessName: product.localMarketProfile.vendor.businessName,
          businessAddress: product.localMarketProfile.vendor.businessAddress,
          contactNumbers: product.localMarketProfile.vendor.contactNumbers,
          googleMapsLink: product.localMarketProfile.vendor.googleMapsLink,
        },
        images: [], // TODO: Add image URLs when image upload is implemented
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };

      res.json(
        createSuccessResponse(
          "Product retrieved successfully",
          formattedProduct
        )
      );
    } catch (error) {
      console.error("Error getting product:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve product"));
    }
  }

  // ================================
  // Get Vendor's Products (Vendor)
  // ================================

  async getVendorProducts(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const { skip, take } = getPaginationParams(page, limit);

      // Get vendor's market profile
      const vendor = await prisma.vendor.findUnique({
        where: { id: user.vendorId },
        include: { marketProfile: true },
      });

      if (!vendor?.marketProfile) {
        return res
          .status(400)
          .json(createErrorResponse("Vendor does not have a market profile"));
      }

      // Get products
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: { localMarketProfileId: vendor.marketProfile.id },
          skip,
          take,
          orderBy: { createdAt: "desc" },
        }),
        prisma.product.count({
          where: { localMarketProfileId: vendor.marketProfile.id },
        }),
      ]);

      const meta = createPaginationMeta(page, limit, total);

      res.json(
        createSuccessResponse(
          "Vendor products retrieved successfully",
          products,
          meta
        )
      );
    } catch (error) {
      console.error("Error getting vendor products:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve vendor products"));
    }
  }

  // ================================
  // Update Product (Vendor)
  // ================================

  async updateProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Product ID is required"));
      }

      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Validate request data
      const validationResult = productUpdateSchema.safeParse(req.body);
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

      // Check if product belongs to vendor
      const product = await prisma.product.findFirst({
        where: {
          id,
          localMarketProfile: {
            vendorId: user.vendorId,
          },
        },
      });

      if (!product) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.PRODUCT_NOT_FOUND));
      }

      const updateData = validationResult.data;

      // Create clean update object
      const cleanUpdateData: any = {};
      Object.keys(updateData).forEach((key) => {
        const value = updateData[key as keyof typeof updateData];
        if (value !== undefined) {
          cleanUpdateData[key] = value;
        }
      });

      // Update product
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: cleanUpdateData,
      });

      res.json(
        createSuccessResponse(
          API_MESSAGES.SUCCESS.PRODUCT_UPDATED,
          updatedProduct
        )
      );
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json(createErrorResponse("Failed to update product"));
    }
  }

  // ================================
  // Delete Product (Vendor)
  // ================================

  async deleteProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Product ID is required"));
      }

      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Check if product belongs to vendor
      const product = await prisma.product.findFirst({
        where: {
          id,
          localMarketProfile: {
            vendorId: user.vendorId,
          },
        },
      });

      if (!product) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.PRODUCT_NOT_FOUND));
      }

      // Check if product has active orders
      const activeOrders = await prisma.marketBooking.count({
        where: {
          productId: id,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });

      if (activeOrders > 0) {
        return res
          .status(400)
          .json(
            createErrorResponse("Cannot delete product with active orders")
          );
      }

      // Soft delete by setting isAvailable to false
      await prisma.product.update({
        where: { id },
        data: { isAvailable: false },
      });

      res.json(createSuccessResponse(API_MESSAGES.SUCCESS.PRODUCT_DELETED));
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json(createErrorResponse("Failed to delete product"));
    }
  }

  // ================================
  // Toggle Product Availability (Vendor)
  // ================================

  async toggleProductAvailability(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json(createErrorResponse("Product ID is required"));
      }

      if (user.role !== "VENDOR" || !user.vendorId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Check if product belongs to vendor
      const product = await prisma.product.findFirst({
        where: {
          id,
          localMarketProfile: {
            vendorId: user.vendorId,
          },
        },
      });

      if (!product) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.PRODUCT_NOT_FOUND));
      }

      // Toggle availability
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: { isAvailable: !product.isAvailable },
      });

      res.json(
        createSuccessResponse(
          `Product ${
            updatedProduct.isAvailable ? "enabled" : "disabled"
          } successfully`,
          { isAvailable: updatedProduct.isAvailable }
        )
      );
    } catch (error) {
      console.error("Error toggling product availability:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to toggle product availability"));
    }
  }

  // ================================
  // Get Product Categories (Public)
  // ================================

  async getProductCategories(req: Request, res: Response) {
    try {
      // Get categories with product counts
      const categoryCounts = await prisma.product.groupBy({
        by: ["category"],
        where: { isAvailable: true },
        _count: { category: true },
      });

      const categories = categoryCounts.map((item) => ({
        category: item.category,
        count: item._count.category,
      }));

      res.json(
        createSuccessResponse(
          "Product categories retrieved successfully",
          categories
        )
      );
    } catch (error) {
      console.error("Error getting product categories:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve product categories"));
    }
  }
}
