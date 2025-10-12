import { PrismaClient } from "@prisma/client";
import type { NotificationData } from "../../common/types.js";
import { NOTIFICATION_TEMPLATES } from "../../common/constants.js";

const prisma = new PrismaClient();

export class NotificationService {
  // ================================
  // Send Order Notification
  // ================================

  async sendOrderNotification(
    type:
      | "ORDER_PLACED"
      | "ORDER_CONFIRMED"
      | "ORDER_COMPLETED"
      | "ORDER_CANCELLED",
    orderId: string,
    userId: string,
    vendorId?: string,
    amount?: number
  ): Promise<void> {
    try {
      const templates = NOTIFICATION_TEMPLATES;
      let template;
      let targetUserId = userId;

      switch (type) {
        case "ORDER_PLACED":
          template = templates.ORDER_PLACED;
          // Also notify vendor
          if (vendorId) {
            await this.sendNotification({
              userId: vendorId,
              title: templates.NEW_ORDER_VENDOR.title,
              message: templates.NEW_ORDER_VENDOR.message
                .replace("{orderId}", orderId)
                .replace("{amount}", amount?.toString() || "0"),
              type: "ORDER_UPDATE",
              data: { orderId, amount },
            });
          }
          break;
        case "ORDER_CONFIRMED":
          template = templates.ORDER_CONFIRMED;
          break;
        case "ORDER_COMPLETED":
          template = templates.ORDER_COMPLETED;
          break;
        case "ORDER_CANCELLED":
          template = templates.ORDER_CANCELLED;
          break;
      }

      await this.sendNotification({
        userId: targetUserId,
        title: template.title,
        message: template.message.replace("{orderId}", orderId),
        type: "ORDER_UPDATE",
        data: { orderId, status: type },
      });
    } catch (error) {
      console.error("Error sending order notification:", error);
    }
  }

  // ================================
  // Send Payment Notification
  // ================================

  async sendPaymentNotification(
    userId: string,
    orderId: string,
    amount: number,
    status: "SUCCESS" | "FAILED"
  ): Promise<void> {
    try {
      if (status === "SUCCESS") {
        const template = NOTIFICATION_TEMPLATES.PAYMENT_SUCCESS;
        await this.sendNotification({
          userId,
          title: template.title,
          message: template.message
            .replace("{amount}", amount.toString())
            .replace("{orderId}", orderId),
          type: "PAYMENT_SUCCESS",
          data: { orderId, amount, status },
        });
      }
    } catch (error) {
      console.error("Error sending payment notification:", error);
    }
  }

  // ================================
  // Send Vendor Approval Notification
  // ================================

  async sendVendorApprovalNotification(
    vendorUserId: string,
    status: "APPROVED" | "REJECTED",
    reason?: string
  ): Promise<void> {
    try {
      const template =
        status === "APPROVED"
          ? NOTIFICATION_TEMPLATES.VENDOR_APPROVED
          : NOTIFICATION_TEMPLATES.VENDOR_REJECTED;

      await this.sendNotification({
        userId: vendorUserId,
        title: template.title,
        message: template.message,
        type: "VENDOR_APPROVAL",
        data: { status, reason },
      });
    } catch (error) {
      console.error("Error sending vendor approval notification:", error);
    }
  }

  // ================================
  // Send General Notification
  // ================================

  async sendNotification(data: NotificationData): Promise<void> {
    try {
      // For now, we'll log the notification
      // In production, you might integrate with:
      // - Push notification services (FCM, APNS)
      // - SMS services
      // - Email services
      // - WebSocket for real-time notifications

      console.log(`📱 Notification sent to user ${data.userId}:`);
      console.log(`   Title: ${data.title}`);
      console.log(`   Message: ${data.message}`);
      console.log(`   Type: ${data.type}`);
      console.log(`   Data:`, data.data);

      // Store notification in database for user history
      await this.storeNotification(data);

      // Here you would implement actual notification delivery:
      // await this.sendPushNotification(data);
      // await this.sendSMSNotification(data);
      // await this.sendEmailNotification(data);
      // await this.sendWebSocketNotification(data);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  // ================================
  // Store Notification in Database
  // ================================

  private async storeNotification(data: NotificationData): Promise<void> {
    try {
      // Note: You might want to create a notifications table in your schema
      // For now, we'll use a simple log approach

      // Example schema addition:
      // model Notification {
      //   id        String   @id @default(cuid())
      //   userId    String
      //   title     String
      //   message   String
      //   type      String
      //   data      Json?
      //   isRead    Boolean  @default(false)
      //   createdAt DateTime @default(now())
      //   user      User     @relation(fields: [userId], references: [id])
      // }

      console.log(`Stored notification for user: ${data.userId}`);
    } catch (error) {
      console.error("Error storing notification:", error);
    }
  }

  // ================================
  // Send Push Notification (Placeholder)
  // ================================

  private async sendPushNotification(data: NotificationData): Promise<void> {
    try {
      // Implement FCM or other push notification service
      // Example with Firebase Admin SDK:
      /*
      const message = {
        notification: {
          title: data.title,
          body: data.message,
        },
        data: data.data ? JSON.stringify(data.data) : undefined,
        token: userFCMToken, // Get from user profile
      };

      await admin.messaging().send(message);
      */

      console.log(`Push notification would be sent to user: ${data.userId}`);
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  }

  // ================================
  // Send SMS Notification (Placeholder)
  // ================================

  private async sendSMSNotification(data: NotificationData): Promise<void> {
    try {
      // Get user phone number
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { phoneNumber: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Implement SMS service (MessageCentral, Twilio, etc.)
      // Example:
      /*
      const smsData = {
        to: user.phoneNumber,
        message: `${data.title}: ${data.message}`,
      };

      await smsService.send(smsData);
      */

      console.log(`SMS would be sent to ${user.phoneNumber}: ${data.message}`);
    } catch (error) {
      console.error("Error sending SMS notification:", error);
    }
  }

  // ================================
  // Send Email Notification (Placeholder)
  // ================================

  private async sendEmailNotification(data: NotificationData): Promise<void> {
    try {
      // Get user email if available
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        include: {
          vendorProfile: true,
          adminProfile: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      let email = user.adminProfile?.email || user.vendorProfile?.email;

      if (!email) {
        console.log(`No email found for user: ${data.userId}`);
        return;
      }

      // Implement email service (SendGrid, AWS SES, etc.)
      // Example:
      /*
      const emailData = {
        to: email,
        subject: data.title,
        html: `<p>${data.message}</p>`,
      };

      await emailService.send(emailData);
      */

      console.log(`Email would be sent to ${email}: ${data.message}`);
    } catch (error) {
      console.error("Error sending email notification:", error);
    }
  }

  // ================================
  // Send WebSocket Notification (Placeholder)
  // ================================

  private async sendWebSocketNotification(
    data: NotificationData
  ): Promise<void> {
    try {
      // Implement WebSocket real-time notifications
      // Example with Socket.IO:
      /*
      const socketId = await redisClient.get(`user:${data.userId}:socket`);
      if (socketId) {
        io.to(socketId).emit('notification', {
          title: data.title,
          message: data.message,
          type: data.type,
          data: data.data,
          timestamp: new Date().toISOString(),
        });
      }
      */

      console.log(
        `WebSocket notification would be sent to user: ${data.userId}`
      );
    } catch (error) {
      console.error("Error sending WebSocket notification:", error);
    }
  }

  // ================================
  // Bulk Notifications
  // ================================

  async sendBulkNotification(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationData["type"] = "GENERAL",
    data?: any
  ): Promise<void> {
    try {
      const notifications = userIds.map((userId) => ({
        userId,
        title,
        message,
        type,
        data,
      }));

      // Send notifications in batches to avoid overwhelming the system
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        await Promise.all(
          batch.map((notificationData) =>
            this.sendNotification(notificationData)
          )
        );
      }

      console.log(`Bulk notification sent to ${userIds.length} users`);
    } catch (error) {
      console.error("Error sending bulk notification:", error);
    }
  }

  // ================================
  // Get User Notifications (if stored in DB)
  // ================================

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any[]> {
    try {
      // This would require a notifications table
      // For now, return empty array
      return [];

      // Example implementation:
      /*
      const skip = (page - 1) * limit;
      
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      return notifications;
      */
    } catch (error) {
      console.error("Error getting user notifications:", error);
      return [];
    }
  }

  // ================================
  // Mark Notification as Read
  // ================================

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      // This would require a notifications table
      console.log(
        `Marked notification ${notificationId} as read for user ${userId}`
      );

      // Example implementation:
      /*
      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId: userId,
        },
        data: {
          isRead: true,
        },
      });
      */
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }
}
