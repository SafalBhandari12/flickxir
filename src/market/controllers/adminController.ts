import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/helpers.js";
import { API_MESSAGES } from "../../common/constants.js";
import type { AuthenticatedUser } from "../../common/types.js";
import { ReportService } from "../services/reportService.js";

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const prisma = new PrismaClient();
const reportService = new ReportService();

export class AdminController {
  // ================================
  // Dashboard Statistics
  // ================================

  async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const stats = await reportService.getDashboardStats();

      res.json(
        createSuccessResponse(
          "Dashboard statistics retrieved successfully",
          stats
        )
      );
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve dashboard statistics"));
    }
  }

  // ================================
  // User Management
  // ================================

  async getAllUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const role = req.query.role as string;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (role) {
        where.role = role;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            phoneNumber: true,
            role: true,
            isActive: true,
            createdAt: true,
            vendorProfile: {
              select: {
                businessName: true,
                status: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      const formattedUsers = users.map((user) => ({
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        businessName: user.vendorProfile?.businessName,
        vendorStatus: user.vendorProfile?.status,
        createdAt: user.createdAt,
      }));

      const meta = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };

      res.json(
        createSuccessResponse(
          "Users retrieved successfully",
          formattedUsers,
          meta
        )
      );
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve users"));
    }
  }

  // ================================
  // Order Management
  // ================================

  async getAllOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const skip = (page - 1) * limit;

      const where: any = {
        bookingType: "PHARMACY",
      };

      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                phoneNumber: true,
              },
            },
            vendor: {
              select: {
                businessName: true,
              },
            },
            payment: {
              select: {
                paymentStatus: true,
                paymentMethod: true,
              },
            },
            _count: {
              select: {
                pharmacyBooking: true,
              },
            },
          },
        }),
        prisma.booking.count({ where }),
      ]);

      const formattedOrders = orders.map((order) => ({
        id: order.id,
        customerPhone: order.user.phoneNumber,
        vendorName: order.vendor.businessName,
        totalAmount: order.totalAmount,
        commissionAmount: order.commissionAmount,
        status: order.status,
        itemCount: order._count.pharmacyBooking,
        paymentStatus: order.payment?.paymentStatus,
        paymentMethod: order.payment?.paymentMethod,
        createdAt: order.createdAt,
      }));

      const meta = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };

      res.json(
        createSuccessResponse(
          "Orders retrieved successfully",
          formattedOrders,
          meta
        )
      );
    } catch (error) {
      console.error("Error getting orders:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve orders"));
    }
  }

  // ================================
  // Analytics and Reports
  // ================================

  async getSalesAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const period = (req.query.period as "week" | "month" | "year") || "month";
      const vendorId = req.query.vendorId as string;

      const analytics = await reportService.getSalesAnalytics(period, vendorId);

      res.json(
        createSuccessResponse(
          "Sales analytics retrieved successfully",
          analytics
        )
      );
    } catch (error) {
      console.error("Error getting sales analytics:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve sales analytics"));
    }
  }

  // ================================
  // Product Performance
  // ================================

  async getProductPerformance(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const vendorId = req.query.vendorId as string;

      const performance = await reportService.getProductPerformance(
        vendorId,
        limit
      );

      res.json(
        createSuccessResponse(
          "Product performance retrieved successfully",
          performance
        )
      );
    } catch (error) {
      console.error("Error getting product performance:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve product performance"));
    }
  }

  // ================================
  // Vendor Performance
  // ================================

  async getVendorPerformance(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const limit = parseInt(req.query.limit as string) || 20;

      const performance = await reportService.getVendorPerformance(limit);

      res.json(
        createSuccessResponse(
          "Vendor performance retrieved successfully",
          performance
        )
      );
    } catch (error) {
      console.error("Error getting vendor performance:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve vendor performance"));
    }
  }

  // ================================
  // User Activity Report
  // ================================

  async getUserActivityReport(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const period = (req.query.period as "week" | "month" | "year") || "month";

      const report = await reportService.getUserActivityReport(period);

      res.json(
        createSuccessResponse(
          "User activity report retrieved successfully",
          report
        )
      );
    } catch (error) {
      console.error("Error getting user activity report:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve user activity report"));
    }
  }

  // ================================
  // Export Data
  // ================================

  async exportOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;
      const vendorId = req.query.vendorId as string;

      const ordersData = await reportService.exportOrdersData(
        startDate,
        endDate,
        vendorId
      );

      res.json(
        createSuccessResponse("Orders data exported successfully", ordersData)
      );
    } catch (error) {
      console.error("Error exporting orders:", error);
      res.status(500).json(createErrorResponse("Failed to export orders data"));
    }
  }

  // ================================
  // System Configuration
  // ================================

  async getSystemConfig(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const configs = await prisma.systemConfig.findMany({
        orderBy: { key: "asc" },
      });

      const configObject = configs.reduce((acc, config) => {
        acc[config.key] = config.value;
        return acc;
      }, {} as Record<string, string>);

      res.json(
        createSuccessResponse(
          "System configuration retrieved successfully",
          configObject
        )
      );
    } catch (error) {
      console.error("Error getting system config:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve system configuration"));
    }
  }

  // ================================
  // Update System Configuration
  // ================================

  async updateSystemConfig(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const { key, value } = req.body;

      if (!key || value === undefined) {
        return res
          .status(400)
          .json(createErrorResponse("Key and value are required"));
      }

      const config = await prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });

      res.json(
        createSuccessResponse(
          "System configuration updated successfully",
          config
        )
      );
    } catch (error) {
      console.error("Error updating system config:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to update system configuration"));
    }
  }

  // ================================
  // User Account Management
  // ================================

  async toggleUserStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json(createErrorResponse("User ID is required"));
      }

      if (user.role !== "ADMIN") {
        return res
          .status(403)
          .json(createErrorResponse(API_MESSAGES.ERROR.FORBIDDEN));
      }

      const targetUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!targetUser) {
        return res.status(404).json(createErrorResponse("User not found"));
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: !targetUser.isActive },
      });

      res.json(
        createSuccessResponse(
          `User ${
            updatedUser.isActive ? "activated" : "deactivated"
          } successfully`,
          {
            id: updatedUser.id,
            isActive: updatedUser.isActive,
            updatedAt: updatedUser.updatedAt,
          }
        )
      );
    } catch (error) {
      console.error("Error toggling user status:", error);
      res.status(500).json(createErrorResponse("Failed to update user status"));
    }
  }
}
