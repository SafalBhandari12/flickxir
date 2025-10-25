import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Dummy data arrays
const dummyUsers = [
  { phoneNumber: "9876543210", role: "ADMIN" }, // Admin test number
  { phoneNumber: "9876543211", role: "CUSTOMER" },
  { phoneNumber: "9876543212", role: "CUSTOMER" },
  { phoneNumber: "9876543213", role: "CUSTOMER" },
  { phoneNumber: "9876543214", role: "VENDOR" }, // Local market vendor
  { phoneNumber: "9876543215", role: "CUSTOMER" },
  { phoneNumber: "9876543216", role: "CUSTOMER" },
  { phoneNumber: "9876543217", role: "CUSTOMER" },
];

const dummyVendors = [
  {
    phoneNumber: "9876543214",
    businessName: "HealthCare Pharmacy",
    ownerName: "Dr. Rajesh Kumar",
    contactNumbers: ["9876543214"],
    email: "rajesh@healthcarepharmacy.com",
    businessAddress:
      "Medical Complex, Lal Chowk, Srinagar, Jammu & Kashmir 190001",
    googleMapsLink: "https://maps.google.com/healthcare-pharmacy",
    gstNumber: "01ABCDE1234F1Z1",
    panNumber: "RAJKM1234A",
    aadhaarNumber: "123456789012",
    vendorType: "PHARMACY",
    status: "APPROVED",
    bankDetails: {
      accountNumber: "12345678901",
      ifscCode: "SBIN0001234",
      bankName: "State Bank of India",
      branchName: "Lal Chowk Branch",
      accountHolder: "Dr. Rajesh Kumar",
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

// Category mapping for dummy products
const getCategoryIdByName = async (categoryName) => {
  const category = await prisma.category.findFirst({
    where: { name: categoryName },
  });
  return category?.id;
};

const dummyProductsTemplate = [
  {
    medicineName: "Paracetamol",
    brandName: "Crocin",
    categoryName: "OTC Medicine",
    description:
      "Pain reliever and fever reducer. Safe for all ages when used as directed.",
    composition: "Paracetamol 500mg",
    manufacturer: "GSK Pharmaceuticals",
    priceMin: 15,
    priceMax: 25,
    minOrderQuantity: 1,
    packSize: "15 tablets",
    dosageForm: "Tablet",
    requiresPrescription: false,
    hasDelivery: true,
    deliveryAreas: ["Srinagar", "Delhi", "Mumbai", "Bangalore", "Kolkata"],
    certifications: ["CDSCO Approved", "WHO-GMP Certified"],
    stockQuantity: 100,
  },
  {
    medicineName: "Amoxicillin",
    brandName: "Amoxil",
    categoryName: "Prescription Medicine",
    description: "Antibiotic used to treat bacterial infections.",
    composition: "Amoxicillin 500mg",
    manufacturer: "Cipla Ltd",
    priceMin: 120,
    priceMax: 150,
    minOrderQuantity: 1,
    packSize: "10 capsules",
    dosageForm: "Capsule",
    requiresPrescription: true,
    hasDelivery: true,
    deliveryAreas: ["Srinagar", "Delhi", "Mumbai", "Bangalore", "Pune"],
    certifications: ["CDSCO Approved", "ISO Certified"],
    stockQuantity: 50,
  },
  {
    medicineName: "Vitamin D3",
    brandName: "Calcirol",
    categoryName: "Health Supplements",
    description: "Vitamin D3 supplement for bone health and immunity.",
    composition: "Cholecalciferol 60,000 IU",
    manufacturer: "Cadila Healthcare",
    priceMin: 80,
    priceMax: 120,
    minOrderQuantity: 1,
    packSize: "4 sachets",
    dosageForm: "Granules",
    requiresPrescription: false,
    hasDelivery: true,
    deliveryAreas: ["Srinagar", "Delhi", "Mumbai"],
    certifications: ["FSSAI Approved", "GMP Certified"],
    stockQuantity: 75,
  },
  {
    medicineName: "Digital Thermometer",
    brandName: "Omron",
    categoryName: "Medical Devices",
    description: "Digital thermometer for accurate temperature measurement.",
    composition: "Electronic device with LCD display",
    manufacturer: "Omron Healthcare",
    priceMin: 200,
    priceMax: 350,
    minOrderQuantity: 1,
    packSize: "1 piece",
    dosageForm: "Device",
    requiresPrescription: false,
    hasDelivery: true,
    deliveryAreas: ["Srinagar", "Delhi"],
    certifications: ["CE Marked", "FDA Approved"],
    stockQuantity: 25,
  },
  {
    medicineName: "Baby Lotion",
    brandName: "Johnson's",
    categoryName: "Baby Care",
    description: "Gentle moisturizing lotion for baby's delicate skin.",
    composition: "Glycerin, Mineral Oil, Dimethicone",
    manufacturer: "Johnson & Johnson",
    priceMin: 150,
    priceMax: 200,
    minOrderQuantity: 1,
    packSize: "200ml",
    dosageForm: "Lotion",
    requiresPrescription: false,
    hasDelivery: true,
    deliveryAreas: ["Srinagar", "Delhi"],
    certifications: ["Dermatologically Tested", "Hypoallergenic"],
    stockQuantity: 40,
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

        // Create PharmacyProfile for PHARMACY vendors
        if (
          vendorData.vendorType === "PHARMACY" &&
          vendorData.status === "APPROVED"
        ) {
          try {
            const pharmacyProfile = await prisma.pharmacyProfile.create({
              data: {
                vendorId: vendor.id,
                pharmacyName: vendorData.businessName,
                licenseNumber: "DL-" + vendorData.gstNumber.substring(0, 10),
                gstNumber: vendorData.gstNumber,
                operatingHours: "9:00 AM - 10:00 PM",
                servicesOffered: [
                  "Home Delivery",
                  "Online Consultation",
                  "Prescription Verification",
                ],
              },
            });
            console.log(
              `✅ Created pharmacy profile for vendor: ${vendor.businessName}`
            );
          } catch (error) {
            console.error(
              `❌ Error creating pharmacy profile for ${vendor.businessName}:`,
              error.message
            );
          }
        }

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

    // Create Medicines for Pharmacy Vendor
    console.log("💊 Creating medicines for pharmacy vendor...");
    try {
      // Find the approved pharmacy vendor
      const pharmacyVendor = await prisma.vendor.findFirst({
        where: {
          vendorType: "PHARMACY",
          status: "APPROVED",
        },
        include: {
          pharmacyProfile: true,
        },
      });

      if (pharmacyVendor && pharmacyVendor.pharmacyProfile) {
        for (const productData of dummyProductsTemplate) {
          try {
            // Get the category ID from the category name
            const categoryId = await getCategoryIdByName(
              productData.categoryName
            );

            if (!categoryId) {
              console.warn(
                `⚠️  Category '${productData.categoryName}' not found, skipping product ${productData.medicineName}`
              );
              continue;
            }

            const product = await prisma.product.create({
              data: {
                pharmacyProfileId: pharmacyVendor.pharmacyProfile.id,
                medicineName: productData.medicineName,
                brandName: productData.brandName,
                categoryId: categoryId,
                description: productData.description,
                composition: productData.composition,
                manufacturer: productData.manufacturer,
                priceMin: productData.priceMin,
                priceMax: productData.priceMax,
                minOrderQuantity: productData.minOrderQuantity,
                packSize: productData.packSize,
                dosageForm: productData.dosageForm,
                requiresPrescription: productData.requiresPrescription,
                hasDelivery: productData.hasDelivery,
                deliveryAreas: productData.deliveryAreas,
                certifications: productData.certifications,
                stockQuantity: productData.stockQuantity,
                isAvailable: true,
              },
            });
            console.log(`✅ Created medicine: ${product.medicineName}`);
          } catch (error) {
            console.error(
              `❌ Error creating medicine ${productData.medicineName}:`,
              error.message
            );
          }
        }
      } else {
        console.log(
          "⚠️ No approved pharmacy vendor found or vendor doesn't have pharmacy profile, skipping medicines creation"
        );
      }
    } catch (error) {
      console.error("❌ Error creating medicines:", error.message);
    }

    // Display summary
    console.log("\n📊 Data Creation Summary:");
    const userCount = await prisma.user.count();
    const vendorCount = await prisma.vendor.count();
    const adminCount = await prisma.admin.count();
    const productCount = await prisma.product.count();

    console.log(`👥 Total Users: ${userCount}`);
    console.log(`🏪 Total Vendors: ${vendorCount}`);
    console.log(`👑 Total Admins: ${adminCount}`);
    console.log(`� Total Medicines: ${productCount}`);

    // Show test credentials
    console.log("\n🔑 Test Credentials:");
    console.log("📱 Admin Login: 9876543210 (bypasses OTP)");
    console.log("📱 Pharmacy Vendor Login: 9876543214");
    console.log(
      "📱 Customer Login: 9876543211, 9876543212, 9876543213, 9876543215, 9876543216, 9876543217"
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
