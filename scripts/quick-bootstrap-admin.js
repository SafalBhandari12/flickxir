#!/usr/bin/env node

/**
 * Quick Bootstrap Admin Script
 * Creates a default admin user - modify the details below before running
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 🔧 MODIFY THESE DETAILS BEFORE RUNNING
const ADMIN_DETAILS = {
  phoneNumber: "9876543210", // Change this to your phone number
  fullName: "System Administrator", // Change this to your name
  email: "admin@sojourn.com", // Change this to your email
};

async function createBootstrapAdmin() {
  try {
    console.log("🚀 Creating Bootstrap Admin...\n");

    // Check if any admin users already exist
    const existingAdminCount = await prisma.user.count({
      where: { role: "ADMIN" },
    });

    if (existingAdminCount > 0) {
      console.log("❌ Admin users already exist in the system.");
      console.log("📋 Current admin count:", existingAdminCount);
      console.log(
        "💡 Use the API endpoint PUT /api/auth/admin/user/:userId/assign-admin instead."
      );
      return;
    }

    // Validate phone number
    if (!/^\d{10}$/.test(ADMIN_DETAILS.phoneNumber)) {
      console.log(
        "❌ Invalid phone number in ADMIN_DETAILS. Must be exactly 10 digits."
      );
      return;
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { phoneNumber: ADMIN_DETAILS.phoneNumber },
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          phoneNumber: ADMIN_DETAILS.phoneNumber,
          role: "ADMIN",
          isActive: true,
        },
      });
      console.log("✅ New user created");
    } else {
      // Update existing user to admin
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      });
      console.log("✅ Existing user updated to admin");
    }

    // Create admin profile
    const adminProfile = await prisma.admin.create({
      data: {
        userId: user.id,
        fullName: ADMIN_DETAILS.fullName,
        email: ADMIN_DETAILS.email,
        permissions: ["MANAGE_VENDORS", "MANAGE_USERS", "SYSTEM_CONFIG"],
      },
    });

    console.log("✅ Admin profile created\n");

    console.log("🎉 Bootstrap admin created successfully!\n");
    console.log("📋 Admin Details:");
    console.log(`   Phone: ${user.phoneNumber}`);
    console.log(`   Name: ${adminProfile.fullName}`);
    console.log(`   Email: ${adminProfile.email}`);
    console.log(`   Permissions: ${adminProfile.permissions.join(", ")}\n`);

    console.log("🔑 Next Steps:");
    console.log(
      `1. Login via API: POST /api/auth/send-otp with phone ${user.phoneNumber}`
    );
    console.log("2. Verify OTP and get access token");
    console.log("3. Use admin endpoints to manage the system");
    console.log(
      "4. Create additional admins using PUT /api/auth/admin/user/:userId/assign-admin\n"
    );
  } catch (error) {
    console.error("❌ Error creating bootstrap admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createBootstrapAdmin();
