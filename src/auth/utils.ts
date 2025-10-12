const jwt = require("jsonwebtoken");

/**
 * JWT Utility functions
 */
class JWTUtils {
  /**
   * Generate JWT token
   */
  static generateToken(payload: any, expiresIn: string = "7d"): string {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET || "your-secret-key-change-in-production",
      { expiresIn }
    );
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: any): string {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET || "your-secret-key-change-in-production",
      { expiresIn: "30d" }
    );
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): any {
    try {
      return jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key-change-in-production"
      );
    } catch (error) {
      throw new Error("Invalid token");
    }
  }

  /**
   * Decode JWT token without verification
   */
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }
}

/**
 * Response utility functions
 */
class ResponseUtils {
  /**
   * Success response
   */
  static success(
    res: any,
    data: any = null,
    message: string = "Success",
    statusCode: number = 200
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Error response
   */
  static error(
    res: any,
    message: string = "Error",
    statusCode: number = 400,
    errors: any = null
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors && { errors }),
    });
  }

  /**
   * Validation error response
   */
  static validationError(res: any, errors: any) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  /**
   * Unauthorized response
   */
  static unauthorized(res: any, message: string = "Unauthorized") {
    return res.status(401).json({
      success: false,
      message,
    });
  }

  /**
   * Forbidden response
   */
  static forbidden(res: any, message: string = "Forbidden") {
    return res.status(403).json({
      success: false,
      message,
    });
  }

  /**
   * Not found response
   */
  static notFound(res: any, message: string = "Not found") {
    return res.status(404).json({
      success: false,
      message,
    });
  }

  /**
   * Internal server error response
   */
  static serverError(res: any, message: string = "Internal server error") {
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * Database utility functions
 */
class DatabaseUtils {
  /**
   * Pagination helper
   */
  static getPagination(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    return {
      skip: offset,
      take: limit,
    };
  }

  /**
   * Build pagination response
   */
  static buildPaginationResponse(
    data: any[],
    total: number,
    page: number,
    limit: number
  ) {
    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}

/**
 * Validation utility functions
 */
class ValidationUtils {
  /**
   * Validate Indian phone number
   */
  static isValidPhoneNumber(phone: string): boolean {
    return /^[6-9]\d{9}$/.test(phone);
  }

  /**
   * Validate email
   */
  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Validate GST number
   */
  static isValidGST(gst: string): boolean {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
      gst
    );
  }

  /**
   * Validate PAN number
   */
  static isValidPAN(pan: string): boolean {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  }

  /**
   * Validate Aadhaar number
   */
  static isValidAadhaar(aadhaar: string): boolean {
    return /^[0-9]{12}$/.test(aadhaar);
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(str: string): string {
    return str.trim().replace(/[<>]/g, "");
  }
}

/**
 * Date utility functions
 */
class DateUtils {
  /**
   * Format date to IST
   */
  static toIST(date: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  /**
   * Add minutes to date
   */
  static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  /**
   * Check if date is expired
   */
  static isExpired(date: Date): boolean {
    return date < new Date();
  }
}

module.exports = {
  JWTUtils,
  ResponseUtils,
  DatabaseUtils,
  ValidationUtils,
  DateUtils,
};
