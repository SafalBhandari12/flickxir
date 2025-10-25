import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Default categories that match the existing ProductCategory enum
const defaultCategories = [
  {
    name: "Prescription Medicine",
    description:
      "Medicines that require a valid prescription from a licensed healthcare provider",
    slug: "prescription-medicine",
  },
  {
    name: "OTC Medicine",
    description: "Over-the-counter medicines available without prescription",
    slug: "otc-medicine",
  },
  {
    name: "Health Supplements",
    description: "Vitamins, minerals, and nutritional supplements",
    slug: "health-supplements",
  },
  {
    name: "Medical Devices",
    description: "Medical equipment and devices for healthcare",
    slug: "medical-devices",
  },
  {
    name: "Personal Care",
    description: "Personal hygiene and care products",
    slug: "personal-care",
  },
  {
    name: "Baby Care",
    description: "Products for infant and baby care",
    slug: "baby-care",
  },
  {
    name: "Fitness & Wellness",
    description: "Products for fitness, wellness, and healthy living",
    slug: "fitness-wellness",
  },
  {
    name: "Ayurvedic & Herbal",
    description: "Traditional Ayurvedic and herbal medicines",
    slug: "ayurvedic-herbal",
  },
  {
    name: "Other",
    description: "Other pharmaceutical and healthcare products",
    slug: "other",
  },
];

async function createDefaultCategories() {
  try {
    console.log("Creating default categories...");

    for (const categoryData of defaultCategories) {
      // Check if category already exists
      const existingCategory = await prisma.category.findFirst({
        where: {
          OR: [{ name: categoryData.name }, { slug: categoryData.slug }],
        },
      });

      if (!existingCategory) {
        const category = await prisma.category.create({
          data: categoryData,
        });
        console.log(`Created category: ${category.name} (ID: ${category.id})`);
      } else {
        console.log(`Category already exists: ${categoryData.name}`);
      }
    }

    console.log("Default categories creation completed!");
  } catch (error) {
    console.error("Error creating default categories:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Map enum values to category names for migration
const enumToCategoryMap = {
  PRESCRIPTION_MEDICINE: "Prescription Medicine",
  OTC_MEDICINE: "OTC Medicine",
  HEALTH_SUPPLEMENTS: "Health Supplements",
  MEDICAL_DEVICES: "Medical Devices",
  PERSONAL_CARE: "Personal Care",
  BABY_CARE: "Baby Care",
  FITNESS_WELLNESS: "Fitness & Wellness",
  AYURVEDIC_HERBAL: "Ayurvedic & Herbal",
  OTHER: "Other",
};

async function migrateCategoryData() {
  try {
    console.log("Starting category data migration...");

    // Get all products with their current enum category values
    const products = await prisma.$queryRaw`
      SELECT id, category FROM products WHERE category IS NOT NULL
    `;

    console.log(`Found ${products.length} products to migrate`);

    for (const product of products) {
      const categoryName = enumToCategoryMap[product.category];
      if (!categoryName) {
        console.warn(
          `Unknown category enum: ${product.category} for product ${product.id}`
        );
        continue;
      }

      // Find the corresponding category
      const category = await prisma.category.findFirst({
        where: { name: categoryName },
      });

      if (category) {
        // Update product with categoryId
        await prisma.$queryRaw`
          UPDATE products 
          SET "categoryId" = ${category.id} 
          WHERE id = ${product.id}
        `;
        console.log(
          `Updated product ${product.id} with category ${categoryName}`
        );
      } else {
        console.error(`Category not found: ${categoryName}`);
      }
    }

    console.log("Category data migration completed!");
  } catch (error) {
    console.error("Error migrating category data:", error);
    throw error;
  }
}

async function main() {
  await createDefaultCategories();
  await migrateCategoryData();
}

main()
  .then(() => {
    console.log("✅ Category setup completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Category setup failed:", error);
    process.exit(1);
  });

export { createDefaultCategories, migrateCategoryData, enumToCategoryMap };
