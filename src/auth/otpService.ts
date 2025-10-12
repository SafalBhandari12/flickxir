import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class OTPService {
  /**
   * Initialize OTP service configuration in database
   */
  static async initializeConfig() {
    try {
      const existingConfig = await prisma.oTPServiceConfig.findFirst({
        where: { isActive: true },
      });

      if (!existingConfig) {
        await prisma.oTPServiceConfig.create({
          data: {
            serviceName: "MessageCentral",
            baseUrl: "https://cpaas.messagecentral.com",
            customerId: process.env.CUSTOMER_ID || "",
            authToken: process.env.AUTH_TOKEN || "",
            countryCode: "91",
            flowType: "SMS",
            defaultTimeout: 60,
            maxAttempts: 3,
            isActive: true,
          },
        });
        console.log("OTP service configuration initialized");
      }
    } catch (error) {
      console.error("Error initializing OTP config:", error);
    }
  }

  /**
   * Get active OTP service configuration
   */
  static async getConfig() {
    const config = await prisma.oTPServiceConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      throw new Error("OTP service not configured");
    }

    return config;
  }

  /**
   * Send OTP using MessageCentral API
   */
  static async sendOTP(phoneNumber: string) {
    try {
      const config = await this.getConfig();

      const response = await fetch(
        `${config.baseUrl}/verification/v3/send?countryCode=${config.countryCode}&customerId=${config.customerId}&flowType=${config.flowType}&mobileNumber=${phoneNumber}`,
        {
          method: "POST",
          headers: {
            authToken: config.authToken,
          },
        }
      );

      const result = (await response.json()) as any;

      if (result.responseCode === 200) {
        return {
          success: true,
          data: {
            verificationId: result.data.verificationId,
            mobileNumber: result.data.mobileNumber,
            timeout: result.data.timeout,
          },
        };
      } else {
        return {
          success: false,
          error: result.message || "Failed to send OTP",
        };
      }
    } catch (error) {
      console.error("Send OTP Error:", error);
      return {
        success: false,
        error: "Failed to send OTP",
      };
    }
  }

  /**
   * Validate OTP using MessageCentral API
   */
  static async validateOTP(
    phoneNumber: string,
    verificationId: string,
    code: string
  ) {
    try {
      const config = await this.getConfig();

      const response = await fetch(
        `${config.baseUrl}/verification/v3/validateOtp?countryCode=${config.countryCode}&mobileNumber=${phoneNumber}&verificationId=${verificationId}&customerId=${config.customerId}&code=${code}`,
        {
          method: "GET",
          headers: {
            authToken: config.authToken,
          },
        }
      );

      const result = (await response.json()) as any;

      if (
        result.responseCode === 200 &&
        result.data.verificationStatus === "VERIFICATION_COMPLETED"
      ) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        return {
          success: false,
          error: "Invalid OTP code",
        };
      }
    } catch (error) {
      console.error("Validate OTP Error:", error);
      return {
        success: false,
        error: "Failed to validate OTP",
      };
    }
  }

  /**
   * Clean up expired OTP records
   */
  static async cleanupExpiredOTPs() {
    try {
      const result = await prisma.oTP.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
          isUsed: true,
        },
      });

      console.log(`Cleaned up ${result.count} expired OTP records`);
      return result.count;
    } catch (error) {
      console.error("Cleanup OTP Error:", error);
      return 0;
    }
  }

  /**
   * Get OTP statistics
   */
  static async getOTPStats(startDate?: Date, endDate?: Date) {
    try {
      const whereClause: any = {};
      if (startDate && endDate) {
        whereClause.createdAt = {
          gte: startDate,
          lte: endDate,
        };
      }

      const total = await prisma.oTP.count({ where: whereClause });
      const verified = await prisma.oTP.count({
        where: { ...whereClause, isVerified: true },
      });
      const failed = await prisma.oTP.count({
        where: { ...whereClause, isVerified: false, attempts: { gte: 3 } },
      });

      return {
        total,
        verified,
        failed,
        successRate: total > 0 ? ((verified / total) * 100).toFixed(2) : 0,
      };
    } catch (error) {
      console.error("Get OTP Stats Error:", error);
      return {
        total: 0,
        verified: 0,
        failed: 0,
        successRate: 0,
      };
    }
  }
}

export { OTPService };
