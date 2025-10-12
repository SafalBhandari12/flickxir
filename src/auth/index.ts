const authRoutes = require("./authRoutes");
const { AuthController } = require("./authController");
const { OTPService } = require("./otpService");
const {
  JWTUtils,
  ResponseUtils,
  DatabaseUtils,
  ValidationUtils,
  DateUtils,
} = require("./utils");

/**
 * Initialize authentication module
 */
const initializeAuth = async () => {
  try {
    // Initialize OTP service configuration
    await OTPService.initializeConfig();
    console.log("Authentication module initialized successfully");
  } catch (error) {
    console.error("Failed to initialize authentication module:", error);
  }
};

module.exports = {
  authRoutes,
  AuthController,
  OTPService,
  JWTUtils,
  ResponseUtils,
  DatabaseUtils,
  ValidationUtils,
  DateUtils,
  initializeAuth,
};
