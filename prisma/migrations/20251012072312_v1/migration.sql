-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'VENDOR', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "public"."VendorType" AS ENUM ('HOTEL', 'ADVENTURE', 'TRANSPORT', 'LOCAL_MARKET', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."HotelCategory" AS ENUM ('RESORT', 'HOMESTAY', 'HOUSEBOAT', 'GUESTHOUSE');

-- CreateEnum
CREATE TYPE "public"."RoomType" AS ENUM ('STANDARD', 'DELUXE', 'SUITE', 'DORMITORY');

-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('SEDAN', 'SUV', 'HATCHBACK', 'SHIKARA', 'TEMPO', 'BUS');

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('TREKKING', 'RAFTING', 'GONDOLA', 'SKIING', 'CAMPING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ProductCategory" AS ENUM ('HANDICRAFT', 'SAFFRON', 'DRY_FRUITS', 'WOOLENS', 'WOODWORK', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PaymentFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."otps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "otpCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "contactNumbers" TEXT[],
    "email" TEXT NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "googleMapsLink" TEXT NOT NULL,
    "gstNumber" TEXT NOT NULL,
    "panNumber" TEXT NOT NULL,
    "aadhaarNumber" TEXT NOT NULL,
    "vendorType" "public"."VendorType" NOT NULL,
    "status" "public"."VendorStatus" NOT NULL DEFAULT 'PENDING',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 16.0,
    "paymentFrequency" "public"."PaymentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_details" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendor_documents" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendor_images" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "description" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "roomId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vendor_agreements" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "cancellationTerms" TEXT NOT NULL,
    "insuranceCoverage" TEXT,
    "trialOffers" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vendor_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hotel_profiles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "category" "public"."HotelCategory" NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "amenities" TEXT[],
    "cancellationPolicy" TEXT NOT NULL,
    "checkInTime" TEXT NOT NULL,
    "checkOutTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rooms" (
    "id" TEXT NOT NULL,
    "hotelProfileId" TEXT NOT NULL,
    "roomType" "public"."RoomType" NOT NULL,
    "roomNumber" TEXT,
    "capacity" INTEGER NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "summerPrice" DOUBLE PRECISION,
    "winterPrice" DOUBLE PRECISION,
    "amenities" TEXT[],
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hotel_bookings" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "hotelProfileId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "numberOfGuests" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."adventure_profiles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adventure_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activities" (
    "id" TEXT NOT NULL,
    "adventureProfileId" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "activityType" "public"."ActivityType" NOT NULL,
    "location" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "pricePerPerson" DOUBLE PRECISION NOT NULL,
    "pricePerGroup" DOUBLE PRECISION,
    "maxGroupSize" INTEGER NOT NULL,
    "safetyMeasures" TEXT[],
    "requiredDocuments" TEXT[],
    "seasonalAvailability" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."adventure_bookings" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "adventureProfileId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "numberOfPeople" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adventure_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transport_profiles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehicles" (
    "id" TEXT NOT NULL,
    "transportProfileId" TEXT NOT NULL,
    "vehicleType" "public"."VehicleType" NOT NULL,
    "seatingCapacity" INTEGER NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverLicense" TEXT NOT NULL,
    "driverContact" TEXT NOT NULL,
    "pricePerKm" DOUBLE PRECISION,
    "pricePerHour" DOUBLE PRECISION,
    "pricePerRide" DOUBLE PRECISION,
    "availability" TEXT NOT NULL,
    "insuranceDetails" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transport_bookings" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "transportProfileId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "dropLocation" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "pickupTime" TIMESTAMP(3) NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."local_market_profiles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_market_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "localMarketProfileId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" "public"."ProductCategory" NOT NULL,
    "description" TEXT,
    "priceMin" DOUBLE PRECISION NOT NULL,
    "priceMax" DOUBLE PRECISION NOT NULL,
    "minOrderQuantity" INTEGER NOT NULL DEFAULT 1,
    "hasDelivery" BOOLEAN NOT NULL DEFAULT false,
    "deliveryAreas" TEXT[],
    "certifications" TEXT[],
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_bookings" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "localMarketProfileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "requiresDelivery" BOOLEAN NOT NULL DEFAULT false,
    "deliveryAddress" TEXT,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bookings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "bookingType" "public"."VendorType" NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "vendorAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "processedAt" TIMESTAMP(3),
    "refundId" TEXT,
    "refundAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."otp_service_configs" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL DEFAULT 'MessageCentral',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://cpaas.messagecentral.com',
    "customerId" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT '91',
    "flowType" TEXT NOT NULL DEFAULT 'SMS',
    "defaultTimeout" INTEGER NOT NULL DEFAULT 60,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_service_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "public"."users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenId_key" ON "public"."refresh_tokens"("tokenId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "public"."refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenId_idx" ON "public"."refresh_tokens"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "admins_userId_key" ON "public"."admins"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "public"."admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_userId_key" ON "public"."vendors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_details_vendorId_key" ON "public"."bank_details"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_profiles_vendorId_key" ON "public"."hotel_profiles"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "adventure_profiles_vendorId_key" ON "public"."adventure_profiles"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_profiles_vendorId_key" ON "public"."transport_profiles"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registrationNumber_key" ON "public"."vehicles"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "local_market_profiles_vendorId_key" ON "public"."local_market_profiles"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_bookingId_key" ON "public"."payments"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "public"."system_configs"("key");

-- AddForeignKey
ALTER TABLE "public"."otps" ADD CONSTRAINT "otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admins" ADD CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendors" ADD CONSTRAINT "vendors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bank_details" ADD CONSTRAINT "bank_details_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendor_documents" ADD CONSTRAINT "vendor_documents_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendor_images" ADD CONSTRAINT "vendor_images_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendor_images" ADD CONSTRAINT "vendor_images_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vendor_agreements" ADD CONSTRAINT "vendor_agreements_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hotel_profiles" ADD CONSTRAINT "hotel_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rooms" ADD CONSTRAINT "rooms_hotelProfileId_fkey" FOREIGN KEY ("hotelProfileId") REFERENCES "public"."hotel_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hotel_bookings" ADD CONSTRAINT "hotel_bookings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hotel_bookings" ADD CONSTRAINT "hotel_bookings_hotelProfileId_fkey" FOREIGN KEY ("hotelProfileId") REFERENCES "public"."hotel_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hotel_bookings" ADD CONSTRAINT "hotel_bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."adventure_profiles" ADD CONSTRAINT "adventure_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_adventureProfileId_fkey" FOREIGN KEY ("adventureProfileId") REFERENCES "public"."adventure_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."adventure_bookings" ADD CONSTRAINT "adventure_bookings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."adventure_bookings" ADD CONSTRAINT "adventure_bookings_adventureProfileId_fkey" FOREIGN KEY ("adventureProfileId") REFERENCES "public"."adventure_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."adventure_bookings" ADD CONSTRAINT "adventure_bookings_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transport_profiles" ADD CONSTRAINT "transport_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_transportProfileId_fkey" FOREIGN KEY ("transportProfileId") REFERENCES "public"."transport_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transport_bookings" ADD CONSTRAINT "transport_bookings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transport_bookings" ADD CONSTRAINT "transport_bookings_transportProfileId_fkey" FOREIGN KEY ("transportProfileId") REFERENCES "public"."transport_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transport_bookings" ADD CONSTRAINT "transport_bookings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."local_market_profiles" ADD CONSTRAINT "local_market_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_localMarketProfileId_fkey" FOREIGN KEY ("localMarketProfileId") REFERENCES "public"."local_market_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_bookings" ADD CONSTRAINT "market_bookings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_bookings" ADD CONSTRAINT "market_bookings_localMarketProfileId_fkey" FOREIGN KEY ("localMarketProfileId") REFERENCES "public"."local_market_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_bookings" ADD CONSTRAINT "market_bookings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
