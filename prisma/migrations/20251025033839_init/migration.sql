/*
  Warnings:

  - The values [HANDICRAFT,SAFFRON,DRY_FRUITS,WOOLENS,WOODWORK] on the enum `ProductCategory` will be removed. If these variants are still used in the database, this will fail.
  - The values [HOTEL,ADVENTURE,TRANSPORT,LOCAL_MARKET] on the enum `VendorType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `localMarketProfileId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `productName` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `local_market_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `market_bookings` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `medicineName` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pharmacyProfileId` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ProductCategory_new" AS ENUM ('PRESCRIPTION_MEDICINE', 'OTC_MEDICINE', 'HEALTH_SUPPLEMENTS', 'MEDICAL_DEVICES', 'PERSONAL_CARE', 'BABY_CARE', 'FITNESS_WELLNESS', 'AYURVEDIC_HERBAL', 'OTHER');
ALTER TABLE "public"."products" ALTER COLUMN "category" TYPE "public"."ProductCategory_new" USING ("category"::text::"public"."ProductCategory_new");
ALTER TYPE "public"."ProductCategory" RENAME TO "ProductCategory_old";
ALTER TYPE "public"."ProductCategory_new" RENAME TO "ProductCategory";
DROP TYPE "public"."ProductCategory_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."VendorType_new" AS ENUM ('PHARMACY', 'MEDICAL_STORE', 'HOSPITAL_PHARMACY', 'ONLINE_PHARMACY', 'WELLNESS_STORE', 'OTHER');
ALTER TABLE "public"."vendors" ALTER COLUMN "vendorType" TYPE "public"."VendorType_new" USING ("vendorType"::text::"public"."VendorType_new");
ALTER TABLE "public"."bookings" ALTER COLUMN "bookingType" TYPE "public"."VendorType_new" USING ("bookingType"::text::"public"."VendorType_new");
ALTER TYPE "public"."VendorType" RENAME TO "VendorType_old";
ALTER TYPE "public"."VendorType_new" RENAME TO "VendorType";
DROP TYPE "public"."VendorType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."local_market_profiles" DROP CONSTRAINT "local_market_profiles_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."market_bookings" DROP CONSTRAINT "market_bookings_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."market_bookings" DROP CONSTRAINT "market_bookings_localMarketProfileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."market_bookings" DROP CONSTRAINT "market_bookings_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_localMarketProfileId_fkey";

-- AlterTable
ALTER TABLE "public"."products" DROP COLUMN "localMarketProfileId",
DROP COLUMN "productName",
ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "composition" TEXT,
ADD COLUMN     "dosageForm" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "medicineName" TEXT NOT NULL,
ADD COLUMN     "packSize" TEXT,
ADD COLUMN     "pharmacyProfileId" TEXT NOT NULL,
ADD COLUMN     "requiresPrescription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stockQuantity" INTEGER;

-- DropTable
DROP TABLE "public"."local_market_profiles";

-- DropTable
DROP TABLE "public"."market_bookings";

-- CreateTable
CREATE TABLE "public"."pharmacy_profiles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "pharmacyName" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "gstNumber" TEXT,
    "operatingHours" TEXT,
    "servicesOffered" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pharmacy_bookings" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "pharmacyProfileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "requiresDelivery" BOOLEAN NOT NULL DEFAULT false,
    "deliveryAddress" TEXT,
    "prescriptionUrl" TEXT,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_profiles_vendorId_key" ON "public"."pharmacy_profiles"("vendorId");

-- AddForeignKey
ALTER TABLE "public"."pharmacy_profiles" ADD CONSTRAINT "pharmacy_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_pharmacyProfileId_fkey" FOREIGN KEY ("pharmacyProfileId") REFERENCES "public"."pharmacy_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pharmacy_bookings" ADD CONSTRAINT "pharmacy_bookings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pharmacy_bookings" ADD CONSTRAINT "pharmacy_bookings_pharmacyProfileId_fkey" FOREIGN KEY ("pharmacyProfileId") REFERENCES "public"."pharmacy_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pharmacy_bookings" ADD CONSTRAINT "pharmacy_bookings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
