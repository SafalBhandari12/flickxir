import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import type { Request, Response, NextFunction } from "express";

const prisma = new PrismaClient();

// Extend Request interface to include user data
export interface AuthRequest extends Request {
  user?:
    | {
        userId: string;
        phoneNumber: string;
        role: string;
      }
    | undefined;
  adminPermissions?: string[];
}

/**
 * Authentication middleware - Requires valid ACCESS JWT token
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as any;

      // Ensure this is an access token, not a refresh token
      if (decoded.type !== "access") {
        return res.status(401).json({
          success: false,
          message: "Invalid token type. Access token required.",
        });
      }

      // Get user from database to ensure they still exist and are active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Access denied. Invalid or inactive user.",
        });
      }

      req.user = {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid token.",
      });
    }
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Optional authentication middleware - Doesn't require token but sets user if present
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      req.user = undefined;
      return next();
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as any;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
        },
      });

      if (user && user.isActive) {
        req.user = {
          userId: user.id,
          phoneNumber: user.phoneNumber,
          role: user.role,
        };
      } else {
        req.user = undefined;
      }
    } catch (jwtError) {
      req.user = undefined;
    }

    next();
  } catch (error) {
    console.error("Optional Auth Middleware Error:", error);
    req.user = undefined;
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

/**
 * Admin authorization middleware - Only admins with specific permissions
 */
export const authorizeAdmin = (permission?: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      // If specific permission is required, check admin permissions
      if (permission) {
        const admin = await prisma.admin.findUnique({
          where: { userId: req.user.userId },
        });

        if (!admin || !admin.permissions.includes(permission)) {
          return res.status(403).json({
            success: false,
            message: "Insufficient admin permissions.",
          });
        }

        req.adminPermissions = admin.permissions;
      }

      next();
    } catch (error) {
      console.error("Admin Auth Middleware Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
};

/**
 * Simple admin authorization middleware - Just checks for admin role
 */
export const simpleAdminAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }

    next();
  } catch (error) {
    console.error("Simple Admin Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Vendor authorization middleware - Only approved vendors
 */
export const authorizeVendor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || req.user.role !== "VENDOR") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Vendor role required.",
      });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.userId },
    });

    if (!vendor || vendor.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Vendor approval required.",
      });
    }

    next();
  } catch (error) {
    console.error("Vendor Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Customer authorization middleware - Only customers
 */
export const authorizeCustomer = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.role !== "CUSTOMER") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Customer role required.",
    });
  }

  next();
};

/**
 * Self-authorization middleware - User can only access their own data
 */
export const authorizeSelf = (userIdParam: string = "userId") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];

    if (req.user.userId !== targetUserId && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own data.",
      });
    }

    next();
  };
};

/**
 * Combined authorization middleware - User can access their own data or admin can access any
 */
export const authorizeSelfOrAdmin = (userIdParam: string = "userId") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];

    if (
      req.user.userId !== targetUserId &&
      req.user.role !== "ADMIN" &&
      req.user.role !== "VENDOR"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    next();
  };
};
