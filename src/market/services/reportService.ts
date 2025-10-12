import { PrismaClient } from "@prisma/client";
import type { DashboardStats, VendorEarnings } from "../../common/types.js";
import {
  getDateRange,
  calculateGrowthPercentage,
  groupByPeriod,
} from "../utils/helpers.js";

const prisma = new PrismaClient();

export class ReportService {
  // ================================
  // Admin Dashboard Statistics
  // ================================

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const { startDate: monthStart } = getDateRange("month");
      const { startDate: dayStart } = getDateRange("day");

      // Parallel queries for better performance
      const [
        totalUsers,
        totalVendors,
        totalOrders,
        totalRevenue,
        pendingApprovals,
        monthlyOrders,
        monthlyRevenue,
        dailyUsers,
        dailyVendors,
        previousMonthOrders,
        previousMonthRevenue,
      ] = await Promise.all([
        // Total counts
        prisma.user.count({ where: { role: "CUSTOMER" } }),
        prisma.vendor.count(),
        prisma.booking.count(),

        // Total revenue (sum of commission amounts)
        prisma.payment
          .aggregate({
            where: { paymentStatus: "SUCCESS" },
            _sum: { commissionAmount: true },
          })
          .then((result) => result._sum.commissionAmount || 0),

        // Pending vendor approvals
        prisma.vendor.count({ where: { status: "PENDING" } }),

        // Monthly orders
        prisma.booking.count({
          where: { createdAt: { gte: monthStart } },
        }),

        // Monthly revenue
        prisma.payment
          .aggregate({
            where: {
              paymentStatus: "SUCCESS",
              createdAt: { gte: monthStart },
            },
            _sum: { commissionAmount: true },
          })
          .then((result) => result._sum.commissionAmount || 0),

        // Daily new users
        prisma.user.count({
          where: {
            role: "CUSTOMER",
            createdAt: { gte: dayStart },
          },
        }),

        // Daily new vendors
        prisma.vendor.count({
          where: { createdAt: { gte: dayStart } },
        }),

        // Previous month orders for growth calculation
        prisma.booking.count({
          where: {
            createdAt: {
              gte: new Date(monthStart.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days before
              lt: monthStart,
            },
          },
        }),

        // Previous month revenue for growth calculation
        prisma.payment
          .aggregate({
            where: {
              paymentStatus: "SUCCESS",
              createdAt: {
                gte: new Date(monthStart.getTime() - 30 * 24 * 60 * 60 * 1000),
                lt: monthStart,
              },
            },
            _sum: { commissionAmount: true },
          })
          .then((result) => result._sum.commissionAmount || 0),
      ]);

      return {
        totalUsers,
        totalVendors,
        totalOrders,
        totalRevenue,
        pendingApprovals,
        monthlyStats: {
          orders: monthlyOrders,
          revenue: monthlyRevenue,
          newUsers: dailyUsers,
          newVendors: dailyVendors,
        },
        // Add growth percentages
        growth: {
          orders: calculateGrowthPercentage(monthlyOrders, previousMonthOrders),
          revenue: calculateGrowthPercentage(
            monthlyRevenue,
            previousMonthRevenue
          ),
        },
      } as DashboardStats & { growth: any };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      throw new Error("Failed to fetch dashboard statistics");
    }
  }

  // ================================
  // Vendor Earnings Report
  // ================================

  async getVendorEarnings(vendorId: string): Promise<VendorEarnings> {
    try {
      const { startDate: monthStart } = getDateRange("month");

      const [
        totalEarnings,
        currentMonthEarnings,
        totalOrders,
        pendingPayments,
        recentOrders,
      ] = await Promise.all([
        // Total lifetime earnings
        prisma.payment
          .aggregate({
            where: {
              vendorId,
              paymentStatus: "SUCCESS",
            },
            _sum: { vendorAmount: true },
          })
          .then((result) => result._sum.vendorAmount || 0),

        // Current month earnings
        prisma.payment
          .aggregate({
            where: {
              vendorId,
              paymentStatus: "SUCCESS",
              createdAt: { gte: monthStart },
            },
            _sum: { vendorAmount: true },
          })
          .then((result) => result._sum.vendorAmount || 0),

        // Total orders
        prisma.booking.count({ where: { vendorId } }),

        // Pending payments
        prisma.payment
          .aggregate({
            where: {
              vendorId,
              paymentStatus: "PENDING",
            },
            _sum: { vendorAmount: true },
          })
          .then((result) => result._sum.vendorAmount || 0),

        // Recent orders
        prisma.booking.findMany({
          where: { vendorId },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            user: { select: { phoneNumber: true } },
            marketBooking: {
              include: {
                product: { select: { productName: true } },
              },
            },
          },
        }),
      ]);

      const recentOrdersSummary = recentOrders.map((order) => ({
        id: order.id,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
        itemCount: order.marketBooking.length,
        vendorName: "", // Will be filled by the vendor's own name
      }));

      return {
        totalEarnings,
        currentMonthEarnings,
        totalOrders,
        pendingPayments,
        recentOrders: recentOrdersSummary,
      };
    } catch (error) {
      console.error("Error getting vendor earnings:", error);
      throw new Error("Failed to fetch vendor earnings");
    }
  }

  // ================================
  // Sales Analytics
  // ================================

  async getSalesAnalytics(
    period: "week" | "month" | "year" = "month",
    vendorId?: string
  ) {
    try {
      const { startDate, endDate } = getDateRange(period);

      const whereClause: any = {
        createdAt: { gte: startDate, lte: endDate },
        status: { not: "CANCELLED" },
      };

      if (vendorId) {
        whereClause.vendorId = vendorId;
      }

      // Get orders data
      const orders = await prisma.booking.findMany({
        where: whereClause,
        include: {
          payment: true,
          marketBooking: {
            include: {
              product: { select: { category: true } },
            },
          },
        },
      });

      // Group by time period
      const groupedOrders = groupByPeriod(
        orders,
        "createdAt",
        period === "week" ? "day" : period === "month" ? "day" : "month"
      );

      // Calculate metrics for each period
      const salesData = Object.entries(groupedOrders).map(([date, orders]) => ({
        date,
        ordersCount: orders.length,
        revenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
        commission: orders.reduce(
          (sum, order) => sum + order.commissionAmount,
          0
        ),
      }));

      // Category breakdown
      const categoryData: Record<string, number> = {};
      orders.forEach((order) => {
        order.marketBooking.forEach((item) => {
          const category = item.product.category;
          categoryData[category] = (categoryData[category] || 0) + 1;
        });
      });

      return {
        salesData: salesData.sort((a, b) => a.date.localeCompare(b.date)),
        categoryBreakdown: Object.entries(categoryData).map(
          ([category, count]) => ({
            category,
            count,
            percentage: (count / orders.length) * 100,
          })
        ),
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
        totalCommission: orders.reduce(
          (sum, order) => sum + order.commissionAmount,
          0
        ),
        averageOrderValue:
          orders.length > 0
            ? orders.reduce((sum, order) => sum + order.totalAmount, 0) /
              orders.length
            : 0,
      };
    } catch (error) {
      console.error("Error getting sales analytics:", error);
      throw new Error("Failed to fetch sales analytics");
    }
  }

  // ================================
  // Product Performance Report
  // ================================

  async getProductPerformance(vendorId?: string, limit: number = 20) {
    try {
      const whereClause: any = {};
      if (vendorId) {
        whereClause.localMarketProfile = { vendorId };
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        include: {
          localMarketProfile: {
            include: { vendor: { select: { businessName: true } } },
          },
          bookings: {
            where: { status: { not: "CANCELLED" } },
            include: { booking: { include: { payment: true } } },
          },
        },
        take: limit,
      });

      const productPerformance = products.map((product) => {
        const totalQuantity = product.bookings.reduce(
          (sum, booking) => sum + booking.quantity,
          0
        );
        const totalRevenue = product.bookings.reduce(
          (sum, booking) => sum + booking.totalAmount,
          0
        );
        const orderCount = product.bookings.length;

        return {
          productId: product.id,
          productName: product.productName,
          category: product.category,
          vendorName: product.localMarketProfile.vendor.businessName,
          totalQuantitySold: totalQuantity,
          totalRevenue,
          orderCount,
          averageOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
          isAvailable: product.isAvailable,
        };
      });

      // Sort by total revenue descending
      productPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);

      return productPerformance;
    } catch (error) {
      console.error("Error getting product performance:", error);
      throw new Error("Failed to fetch product performance");
    }
  }

  // ================================
  // Vendor Performance Report
  // ================================

  async getVendorPerformance(limit: number = 20) {
    try {
      const vendors = await prisma.vendor.findMany({
        where: { status: "APPROVED" },
        include: {
          bookings: {
            where: { status: { not: "CANCELLED" } },
            include: { payment: true },
          },
          marketProfile: {
            include: {
              products: { select: { id: true, isAvailable: true } },
            },
          },
        },
        take: limit,
      });

      const vendorPerformance = vendors.map((vendor) => {
        const totalRevenue = vendor.bookings.reduce(
          (sum, booking) => sum + booking.totalAmount,
          0
        );
        const totalCommission = vendor.bookings.reduce(
          (sum, booking) => sum + booking.commissionAmount,
          0
        );
        const orderCount = vendor.bookings.length;
        const activeProducts =
          vendor.marketProfile?.products.filter((p) => p.isAvailable).length ||
          0;
        const totalProducts = vendor.marketProfile?.products.length || 0;

        return {
          vendorId: vendor.id,
          businessName: vendor.businessName,
          ownerName: vendor.ownerName,
          totalRevenue,
          totalCommission,
          orderCount,
          averageOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
          activeProducts,
          totalProducts,
          commissionRate: vendor.commissionRate,
          joinedDate: vendor.createdAt,
        };
      });

      // Sort by total revenue descending
      vendorPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);

      return vendorPerformance;
    } catch (error) {
      console.error("Error getting vendor performance:", error);
      throw new Error("Failed to fetch vendor performance");
    }
  }

  // ================================
  // User Activity Report
  // ================================

  async getUserActivityReport(period: "week" | "month" | "year" = "month") {
    try {
      const { startDate } = getDateRange(period);

      const [newUsers, activeUsers, totalOrders, repeatCustomers] =
        await Promise.all([
          // New users in period
          prisma.user.count({
            where: {
              role: "CUSTOMER",
              createdAt: { gte: startDate },
            },
          }),

          // Active users (users who placed orders)
          prisma.user.count({
            where: {
              role: "CUSTOMER",
              bookings: {
                some: {
                  createdAt: { gte: startDate },
                },
              },
            },
          }),

          // Total orders in period
          prisma.booking.count({
            where: { createdAt: { gte: startDate } },
          }),

          // Repeat customers (users with more than one order) - simplified approach
          prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM "users" u
          WHERE u.role = 'CUSTOMER'
          AND (
            SELECT COUNT(*) 
            FROM "bookings" b 
            WHERE b."userId" = u.id 
            AND b."createdAt" >= ${startDate}
          ) > 1
        `.then((result: any) => Number(result[0]?.count || 0)),
        ]);

      const totalUsers = await prisma.user.count({
        where: { role: "CUSTOMER" },
      });

      return {
        totalUsers,
        newUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalOrders,
        repeatCustomers,
        userEngagement: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
        repeatCustomerRate:
          activeUsers > 0 ? (repeatCustomers / activeUsers) * 100 : 0,
      };
    } catch (error) {
      console.error("Error getting user activity report:", error);
      throw new Error("Failed to fetch user activity report");
    }
  }

  // ================================
  // Export Data
  // ================================

  async exportOrdersData(
    startDate?: Date,
    endDate?: Date,
    vendorId?: string
  ): Promise<any[]> {
    try {
      const whereClause: any = {};

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      if (vendorId) {
        whereClause.vendorId = vendorId;
      }

      const orders = await prisma.booking.findMany({
        where: whereClause,
        include: {
          user: { select: { phoneNumber: true } },
          vendor: { select: { businessName: true } },
          payment: { select: { paymentStatus: true, paymentMethod: true } },
          marketBooking: {
            include: {
              product: { select: { productName: true, category: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return orders.map((order) => ({
        orderId: order.id,
        customerPhone: order.user.phoneNumber,
        vendorName: order.vendor.businessName,
        totalAmount: order.totalAmount,
        commissionAmount: order.commissionAmount,
        status: order.status,
        paymentStatus: order.payment?.paymentStatus || "PENDING",
        paymentMethod: order.payment?.paymentMethod || "",
        itemCount: order.marketBooking.length,
        products: order.marketBooking.map((item) => ({
          name: item.product.productName,
          category: item.product.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        orderDate: order.createdAt,
      }));
    } catch (error) {
      console.error("Error exporting orders data:", error);
      throw new Error("Failed to export orders data");
    }
  }
}
