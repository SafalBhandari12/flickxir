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
import { ImageKitService } from "../services/imagekitService.js";

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
      const files = req.files as Express.Multer.File[];
      console.log("Safasl");
      console.log(user.role);
      console.log(user.vendorId);
      console.log(user.userId);

      // Validate vendor permissions
      if (user.role !== "VENDOR" || !user.userId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Check if vendor is approved
      const vendor = await prisma.vendor.findUnique({
        where: { userId: user.userId },
        include: { pharmacyProfile: true },
      });
      console.log("=== VENDOR LOOKUP DEBUG ===");
      console.log("Looking for vendor with userId:", user.userId);
      console.log("Found vendor:", vendor);
      console.log("Vendor status:", vendor?.status);
      console.log("Vendor pharmacy profile:", vendor?.pharmacyProfile);
      console.log("=== END DEBUG ===");

      if (!vendor || vendor.status !== "APPROVED") {
        console.log("Vendor approval check failed:");
        console.log("- Vendor exists:", !!vendor);
        console.log("- Vendor status:", vendor?.status);
        console.log("- Expected status: APPROVED");
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.VENDOR_NOT_APPROVED));
      }

      if (!vendor.pharmacyProfile) {
        return res
          .status(400)
          .json(createErrorResponse("Vendor does not have a pharmacy profile"));
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

      // Upload images to ImageKit if files are provided
      let uploadedImages: any[] = [];
      if (files && files.length > 0) {
        try {
          const imageResults = await ImageKitService.uploadMultipleImages(
            files,
            "products"
          );
          uploadedImages = imageResults.map((img) => ({
            vendorId: vendor.id,
            imageUrl: img.url,
            imageType: "product",
            description: `Product image for ${productData.medicineName}`,
            isPrimary: false,
          }));
          // Set first image as primary
          if (uploadedImages.length > 0) {
            uploadedImages[0].isPrimary = true;
          }
        } catch (uploadError) {
          console.error("Image upload error:", uploadError);
          return res
            .status(500)
            .json(createErrorResponse("Failed to upload product images"));
        }
      }

      // Create product
      const product = await prisma.product.create({
        data: {
          pharmacyProfileId: vendor.pharmacyProfile.id,
          medicineName: productData.medicineName,
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

      // Create product images if any were uploaded
      let createdImages: any[] = [];
      if (uploadedImages.length > 0) {
        try {
          createdImages = await Promise.all(
            uploadedImages.map(async (imageData) => {
              return await prisma.vendorImage.create({
                data: {
                  ...imageData,
                  description: `${imageData.description} - Product ID: ${product.id}`,
                },
              });
            })
          );
        } catch (imageError) {
          console.error("Error saving product images:", imageError);
          // If product was created but images failed, we'll still return success
          // but log the issue
        }
      }

      res.status(201).json(
        createSuccessResponse(API_MESSAGES.SUCCESS.PRODUCT_CREATED, {
          id: product.id,
          productName: product.medicineName,
          category: product.category,
          description: product.description,
          priceMin: product.priceMin,
          priceMax: product.priceMax,
          minOrderQuantity: product.minOrderQuantity,
          hasDelivery: product.hasDelivery,
          deliveryAreas: product.deliveryAreas,
          certifications: product.certifications,
          isAvailable: product.isAvailable,
          images: createdImages.map((img) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            description: img.description,
            isPrimary: img.isPrimary,
          })),
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
            pharmacyProfile: {
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

      // Get images for all products
      const productIds = products.map((p) => p.id);
      const productImages = await prisma.vendorImage.findMany({
        where: {
          imageType: "product",
          description: {
            contains: "Product ID:",
          },
          OR: productIds.map((id) => ({
            description: {
              contains: `Product ID: ${id}`,
            },
          })),
        },
        select: {
          id: true,
          imageUrl: true,
          description: true,
          isPrimary: true,
        },
      });

      const formattedProducts = products.map((product) => {
        // Filter images for this specific product
        const productImageList = productImages.filter((img) =>
          img.description?.includes(`Product ID: ${product.id}`)
        );

        return {
          id: product.id,
          productName: product.medicineName,
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
            id: product.pharmacyProfile.vendor.id,
            businessName: product.pharmacyProfile.vendor.businessName,
            businessAddress: product.pharmacyProfile.vendor.businessAddress,
            contactNumbers: product.pharmacyProfile.vendor.contactNumbers,
          },
          images: productImageList.map((img) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            isPrimary: img.isPrimary,
          })),
          createdAt: product.createdAt,
        };
      });

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
          pharmacyProfile: {
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

      // Get images for this product
      const productImages = await prisma.vendorImage.findMany({
        where: {
          imageType: "product",
          description: {
            contains: `Product ID: ${product.id}`,
          },
        },
        select: {
          id: true,
          imageUrl: true,
          description: true,
          isPrimary: true,
        },
        orderBy: [{ isPrimary: "desc" }, { uploadedAt: "asc" }],
      });

      const formattedProduct = {
        id: product.id,
        productName: product.medicineName,
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
          id: product.pharmacyProfile.vendor.id,
          businessName: product.pharmacyProfile.vendor.businessName,
          businessAddress: product.pharmacyProfile.vendor.businessAddress,
          contactNumbers: product.pharmacyProfile.vendor.contactNumbers,
          googleMapsLink: product.pharmacyProfile.vendor.googleMapsLink,
        },
        images: productImages.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          isPrimary: img.isPrimary,
        })),
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

      if (user.role !== "VENDOR" || !user.userId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const { skip, take } = getPaginationParams(page, limit);

      // Get vendor's pharmacy profile
      const vendor = await prisma.vendor.findUnique({
        where: { userId: user.userId },
        include: { pharmacyProfile: true },
      });

      if (!vendor?.pharmacyProfile) {
        return res
          .status(400)
          .json(createErrorResponse("Vendor does not have a pharmacy profile"));
      }

      // Get products
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: { pharmacyProfileId: vendor.pharmacyProfile.id },
          skip,
          take,
          orderBy: { createdAt: "desc" },
        }),
        prisma.product.count({
          where: { pharmacyProfileId: vendor.pharmacyProfile.id },
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

      if (user.role !== "VENDOR" || !user.userId) {
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

      // Get vendor first to get the actual vendor ID
      const vendor = await prisma.vendor.findUnique({
        where: { userId: user.userId },
        include: { pharmacyProfile: true },
      });

      if (!vendor) {
        return res.status(404).json(createErrorResponse("Vendor not found"));
      }

      // Check if product belongs to vendor
      const product = await prisma.product.findFirst({
        where: {
          id,
          pharmacyProfile: {
            vendorId: vendor.id,
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

      if (user.role !== "VENDOR" || !user.userId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Get vendor first to get the actual vendor ID
      const vendor = await prisma.vendor.findUnique({
        where: { userId: user.userId },
      });

      if (!vendor) {
        return res.status(404).json(createErrorResponse("Vendor not found"));
      }

      // Check if product belongs to vendor
      const product = await prisma.product.findFirst({
        where: {
          id,
          pharmacyProfile: {
            vendorId: vendor.id,
          },
        },
      });

      if (!product) {
        return res
          .status(404)
          .json(createErrorResponse(API_MESSAGES.ERROR.PRODUCT_NOT_FOUND));
      }

      // Check if product has active orders
      const activeOrders = await prisma.pharmacyBooking.count({
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

      if (user.role !== "VENDOR" || !user.userId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      // Get vendor first to get the actual vendor ID
      const vendor = await prisma.vendor.findUnique({
        where: { userId: user.userId },
      });

      if (!vendor) {
        return res.status(404).json(createErrorResponse("Vendor not found"));
      }

      // Check if product belongs to vendor
      const product = await prisma.product.findFirst({
        where: {
          id,
          pharmacyProfile: {
            vendorId: vendor.id,
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

  // ================================
  // Add Images to Product (Vendor)
  // ================================

  async addProductImages(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id: productId } = req.params;
      const files = req.files as Express.Multer.File[];

      // Validate vendor permissions
      if (user.role !== "VENDOR" || !user.userId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      if (!productId) {
        return res
          .status(400)
          .json(createErrorResponse("Product ID is required"));
      }

      if (!files || files.length === 0) {
        return res.status(400).json(createErrorResponse("No images provided"));
      }

      // Get vendor first to get the actual vendor ID
      const vendor = await prisma.vendor.findUnique({
        where: { userId: user.userId },
      });

      if (!vendor) {
        return res.status(404).json(createErrorResponse("Vendor not found"));
      }

      // Check if product exists and belongs to vendor
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          pharmacyProfile: {
            vendorId: vendor.id,
          },
        },
      });

      if (!product) {
        return res
          .status(404)
          .json(
            createErrorResponse("Product not found or not owned by vendor")
          );
      }

      // Upload images to ImageKit
      try {
        const imageResults = await ImageKitService.uploadMultipleImages(
          files,
          "products"
        );

        const uploadedImages = imageResults.map((img) => ({
          vendorId: vendor.id,
          imageUrl: img.url,
          imageType: "product",
          description: `Product image for ${product.medicineName} - Product ID: ${productId}`,
          isPrimary: false,
        }));

        // Create product images
        const createdImages = await Promise.all(
          uploadedImages.map(async (imageData) => {
            return await prisma.vendorImage.create({
              data: imageData,
            });
          })
        );

        res.status(201).json(
          createSuccessResponse("Images added successfully", {
            productId: productId,
            images: createdImages.map((img) => ({
              id: img.id,
              imageUrl: img.imageUrl,
              description: img.description,
              isPrimary: img.isPrimary,
            })),
          })
        );
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res
          .status(500)
          .json(createErrorResponse("Failed to upload product images"));
      }
    } catch (error) {
      console.error("Error adding product images:", error);
      res.status(500).json(createErrorResponse("Failed to add product images"));
    }
  }

  // ================================
  // Delete Product Image (Vendor)
  // ================================

  async deleteProductImage(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id: productId, imageId } = req.params;

      // Validate vendor permissions
      if (user.role !== "VENDOR" || !user.userId) {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      if (!productId || !imageId) {
        return res
          .status(400)
          .json(createErrorResponse("Product ID and Image ID are required"));
      }

      // Get vendor first to get the actual vendor ID
      const vendor = await prisma.vendor.findUnique({
        where: { userId: user.userId },
      });

      if (!vendor) {
        return res.status(404).json(createErrorResponse("Vendor not found"));
      }

      // Check if product exists and belongs to vendor
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          pharmacyProfile: {
            vendorId: vendor.id,
          },
        },
      });

      if (!product) {
        return res
          .status(404)
          .json(
            createErrorResponse("Product not found or not owned by vendor")
          );
      }

      // Find and delete the image
      const image = await prisma.vendorImage.findFirst({
        where: {
          id: imageId,
          vendorId: vendor.id,
          imageType: "product",
          description: {
            contains: `Product ID: ${productId}`,
          },
        },
      });

      if (!image) {
        return res.status(404).json(createErrorResponse("Image not found"));
      }

      // Delete from database
      await prisma.vendorImage.delete({
        where: { id: imageId },
      });

      res.json(
        createSuccessResponse("Image deleted successfully", {
          deletedImageId: imageId,
        })
      );
    } catch (error) {
      console.error("Error deleting product image:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to delete product image"));
    }
  }
}
