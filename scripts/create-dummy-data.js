import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Dummy data arrays
const dummyUsers = [
  { phoneNumber: "9876543210", role: "ADMIN" }, // Admin test number
  { phoneNumber: "9876543211", role: "CUSTOMER" },
  { phoneNumber: "9876543212", role: "CUSTOMER" },
  { phoneNumber: "9876543213", role: "CUSTOMER" },
  { phoneNumber: "9876543214", role: "VENDOR" },
  { phoneNumber: "9876543215", role: "VENDOR" },
  { phoneNumber: "9876543216", role: "CUSTOMER" },
  { phoneNumber: "9876543217", role: "CUSTOMER" },
  { phoneNumber: "9876543218", role: "VENDOR" }, // Added for transport vendor
];

const dummyVendors = [
  {
    phoneNumber: "9876543214",
    businessName: "Himalayan Adventures",
    ownerName: "Ram Bahadur",
    contactNumbers: ["9876543214"],
    email: "ram@himalayanadventures.com",
    businessAddress: "Pokhara-8, Lakeside",
    googleMapsLink: "https://maps.google.com/himalayan-adventures",
    gstNumber: "27ABCDE1234F1Z1",
    panNumber: "QWERT1234B",
    aadhaarNumber: "903456781235",
    vendorType: "ADVENTURE", // Changed from TOUR_OPERATOR
    status: "APPROVED",
    bankDetails: {
      accountNumber: "12345671",
      ifscCode: "HDFC0ABCD11",
      bankName: "HDFC Bank",
      branchName: "Pokhara Branch",
      accountHolder: "Ram Bahadur",
    },
  },
  {
    phoneNumber: "9876543215",
    businessName: "Hotel Mountain View",
    ownerName: "Sita Sharma",
    contactNumbers: ["9876543215"],
    email: "sita@hotelmountainview.com",
    businessAddress: "Kathmandu-3, Thamel",
    googleMapsLink: "https://maps.google.com/hotel-mountain-view",
    gstNumber: "27ABCDE1234F1Z2",
    panNumber: "QWERT1234C",
    aadhaarNumber: "903456781236",
    vendorType: "HOTEL",
    status: "APPROVED",
    bankDetails: {
      accountNumber: "12345672",
      ifscCode: "HDFC0ABCD12",
      bankName: "HDFC Bank",
      branchName: "Thamel Branch",
      accountHolder: "Sita Sharma",
    },
  },
  {
    phoneNumber: "9876543216",
    businessName: "Dal Bhat Restaurant",
    ownerName: "Krishna Thapa",
    contactNumbers: ["9876543216"],
    email: "krishna@dalbhatrestaurant.com",
    businessAddress: "Chitwan-1, Sauraha",
    googleMapsLink: "https://maps.google.com/dal-bhat-restaurant",
    gstNumber: "27ABCDE1234F1Z3",
    panNumber: "QWERT1234D",
    aadhaarNumber: "903456781237",
    vendorType: "LOCAL_MARKET", // Changed from RESTAURANT
    status: "PENDING",
    bankDetails: {
      accountNumber: "12345673",
      ifscCode: "HDFC0ABCD13",
      bankName: "HDFC Bank",
      branchName: "Chitwan Branch",
      accountHolder: "Krishna Thapa",
    },
  },
  {
    phoneNumber: "9876543218",
    businessName: "Kashmir Transport Services",
    ownerName: "Ajay Kumar",
    contactNumbers: ["9876543218"],
    email: "ajay@kashmirtransport.com",
    businessAddress: "Srinagar-2, Dal Lake",
    googleMapsLink: "https://maps.google.com/kashmir-transport",
    gstNumber: "27ABCDE1234F1Z4",
    panNumber: "QWERT1234E",
    aadhaarNumber: "903456781238",
    vendorType: "TRANSPORT",
    status: "APPROVED",
    bankDetails: {
      accountNumber: "12345674",
      ifscCode: "HDFC0ABCD14",
      bankName: "HDFC Bank",
      branchName: "Srinagar Branch",
      accountHolder: "Ajay Kumar",
    },
  },
];

const dummyAdmins = [
  {
    phoneNumber: "9876543210",
    fullName: "Super Admin",
    email: "admin@sojourn.com",
    permissions: [
      "MANAGE_VENDORS",
      "MANAGE_USERS",
      "MANAGE_BOOKINGS",
      "SYSTEM_ADMIN",
    ],
  },
];

async function createDummyData() {
  try {
    console.log("🚀 Starting dummy data creation...");

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log("🗑️  Clearing existing data...");
    try {
      await prisma.bankDetails.deleteMany();
    } catch (error) {
      console.log(
        "⚠️  BankDetails table might not exist or is empty, continuing..."
      );
    }

    try {
      await prisma.vendor.deleteMany();
    } catch (error) {
      console.log(
        "⚠️  Vendor table might not exist or is empty, continuing..."
      );
    }

    try {
      await prisma.admin.deleteMany();
    } catch (error) {
      console.log("⚠️  Admin table might not exist or is empty, continuing...");
    }

    try {
      await prisma.otpRecord.deleteMany();
    } catch (error) {
      console.log(
        "⚠️  OtpRecord table might not exist or is empty, continuing..."
      );
    }

    try {
      await prisma.user.deleteMany();
    } catch (error) {
      console.log("⚠️  User table might not exist or is empty, continuing...");
    }

    // Create Users
    console.log("👥 Creating users...");
    const createdUsers = [];
    for (const userData of dummyUsers) {
      try {
        const user = await prisma.user.create({
          data: {
            phoneNumber: userData.phoneNumber,
            role: userData.role,
            isActive: true,
          },
        });
        createdUsers.push(user);
        console.log(`✅ Created user: ${user.phoneNumber} (${user.role})`);
      } catch (error) {
        console.log(
          `⚠️  User ${userData.phoneNumber} might already exist, skipping...`
        );
      }
    }

    // Create Admins
    console.log("👑 Creating admin profiles...");
    for (const adminData of dummyAdmins) {
      try {
        const user = await prisma.user.findUnique({
          where: { phoneNumber: adminData.phoneNumber },
        });

        if (user) {
          await prisma.admin.create({
            data: {
              userId: user.id,
              fullName: adminData.fullName,
              email: adminData.email,
              permissions: adminData.permissions,
            },
          });
          console.log(`✅ Created admin profile for: ${adminData.phoneNumber}`);
        }
      } catch (error) {
        console.log(
          `⚠️  Admin profile for ${adminData.phoneNumber} might already exist, skipping...`
        );
      }
    }

    // Create Vendors
    console.log("🏪 Creating vendors...");
    for (const vendorData of dummyVendors) {
      try {
        // Find the user first
        let user = await prisma.user.findUnique({
          where: { phoneNumber: vendorData.phoneNumber },
        });

        // Create user if doesn't exist
        if (!user) {
          user = await prisma.user.create({
            data: {
              phoneNumber: vendorData.phoneNumber,
              role: "VENDOR",
              isActive: true,
            },
          });
          console.log(`✅ Created user for vendor: ${vendorData.phoneNumber}`);
        } else {
          // Update role to VENDOR if approved
          if (vendorData.status === "APPROVED") {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: "VENDOR" },
            });
          }
        }

        // Create vendor profile
        const vendor = await prisma.vendor.create({
          data: {
            userId: user.id,
            businessName: vendorData.businessName,
            ownerName: vendorData.ownerName,
            contactNumbers: vendorData.contactNumbers,
            email: vendorData.email,
            businessAddress: vendorData.businessAddress,
            googleMapsLink: vendorData.googleMapsLink,
            gstNumber: vendorData.gstNumber,
            panNumber: vendorData.panNumber,
            aadhaarNumber: vendorData.aadhaarNumber,
            vendorType: vendorData.vendorType,
            status: vendorData.status,
            commissionRate: 15.0, // Default commission rate
            paymentFrequency: "MONTHLY",
            bankDetails: {
              create: vendorData.bankDetails,
            },
          },
          include: {
            bankDetails: true,
          },
        });

        console.log(
          `✅ Created vendor: ${vendor.businessName} (${vendor.status})`
        );
      } catch (error) {
        console.error(
          `❌ Error creating vendor ${vendorData.businessName}:`,
          error.message
        );
      }
    }

    // Display summary
    console.log("\n📊 Data Creation Summary:");
    const userCount = await prisma.user.count();
    const vendorCount = await prisma.vendor.count();
    const adminCount = await prisma.admin.count();

    console.log(`👥 Total Users: ${userCount}`);
    console.log(`🏪 Total Vendors: ${vendorCount}`);
    console.log(`👑 Total Admins: ${adminCount}`);

    // Show test credentials
    console.log("\n🔑 Test Credentials:");
    console.log("📱 Admin Login: 9876543210 (bypasses OTP)");
    console.log(
      "📱 Vendor Login: 9876543214 (Adventure), 9876543215 (Hotel), 9876543218 (Transport)"
    );
    console.log(
      "📱 Customer Login: 9876543211, 9876543212, 9876543213, 9876543216, 9876543217"
    );
    console.log("\n✨ Dummy data creation completed successfully!");
  } catch (error) {
    console.error("❌ Error creating dummy data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createDummyData().catch(console.error);
