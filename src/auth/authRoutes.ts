import express from "express";
import AuthController from "./authController.js";
import {
  otpRateLimit,
  loginRateLimit,
  vendorRegistrationRateLimit,
  generalRateLimit,
} from "../middleware/validation.js";
import {
  authMiddleware,
  optionalAuth,
  authorize,
  authorizeVendor,
  simpleAdminAuth,
} from "../middleware/auth.js";

const router = express.Router();

// Apply general rate limiting to all routes
router.use(generalRateLimit);

// ================================
// PUBLIC ROUTES (No Authentication)
// ================================

/**
 * @route POST /api/auth/send-otp
 * @desc Send OTP to phone number for registration/login
 * @access Public
 */
router.post("/send-otp", otpRateLimit, AuthController.sendOTP);

/**
 * @route POST /api/auth/verify-otp
 * @desc Verify OTP and login/register user
 * @access Public
 */
router.post("/verify-otp", loginRateLimit, AuthController.verifyOTP);

/**
 * @route POST /api/auth/resend-otp
 * @desc Resend OTP to phone number
 * @access Public
 */
router.post("/resend-otp", otpRateLimit, AuthController.resendOTP);
/**
 * @route GET /api/auth/check-phone/:phoneNumber
 * @desc Check if phone number is already registered
 * @access Public
 */
router.get("/check-phone/:phoneNumber", AuthController.checkPhoneExists);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh authentication token
 * @access Public (with valid refresh token in Authorization header)
 * @headers Authorization: Bearer <refresh_token>
 */
router.post("/refresh-token", AuthController.refreshToken);

// ================================
// PROTECTED ROUTES (Requires Authentication)
// ================================

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get("/profile", authMiddleware, AuthController.getProfile);

/**
 * @route POST /api/auth/logout
 * @desc Logout user (invalidate session)
 * @access Private
 */
router.post("/logout", authMiddleware, AuthController.logout);

/**
 * @route GET /api/auth/me
 * @desc Get detailed user information with role-specific data
 * @access Private
 */
router.get("/me", authMiddleware, AuthController.getDetailedProfile);

// ================================
// VENDOR SPECIFIC ROUTES
// ================================

/**
 * @route POST /api/auth/vendor/register
 * @desc Register as vendor (after OTP verification)
 * @access Private (Must be authenticated user)
 */
router.post(
  "/vendor/register",
  authMiddleware,
  vendorRegistrationRateLimit,
  AuthController.registerVendor
);
/**
 * @route GET /api/auth/vendor/status
 * @desc Get vendor application status
 * @access Private (Any authenticated user can check their vendor status)
 */
router.get("/vendor/status", authMiddleware, AuthController.getVendorStatus);

/**
 * @route PUT /api/auth/vendor/profile
 * @desc Update vendor profile information
 * @access Private (Vendor only)
 */
router.put(
  "/vendor/profile",
  authMiddleware,
  authorize("VENDOR"),
  AuthController.updateVendorProfile
);

// ================================
// ADMIN SPECIFIC ROUTES
// ================================

/**
 * @route GET /api/auth/admin/test
 * @desc Test admin access
 * @access Private (Admin only)
 */
router.get(
  "/admin/test",
  authMiddleware,
  simpleAdminAuth,
  AuthController.testAdminAccess
);

/**
 * @route GET /api/auth/admin/vendors
 * @desc Get all vendors for admin review
 * @access Private (Admin only)
 */
router.get(
  "/admin/vendors",
  authMiddleware,
  simpleAdminAuth,
  AuthController.getVendorsForAdmin
);

/**
 * @route PUT /api/auth/admin/vendor/:vendorId/approve
 * @desc Approve vendor application
 * @access Private (Admin only)
 */
router.put(
  "/admin/vendor/:vendorId/approve",
  authMiddleware,
  simpleAdminAuth,
  AuthController.approveVendor
);

/**
 * @route PUT /api/auth/admin/vendor/:vendorId/reject
 * @desc Reject vendor application
 * @access Private (Admin only)
 */
router.put(
  "/admin/vendor/:vendorId/reject",
  authMiddleware,
  simpleAdminAuth,
  AuthController.rejectVendor
);

/**
 * @route PUT /api/auth/admin/vendor/:vendorId/suspend
 * @desc Suspend vendor
 * @access Private (Admin only)
 */
router.put(
  "/admin/vendor/:vendorId/suspend",
  authMiddleware,
  simpleAdminAuth,
  AuthController.suspendVendor
);

/**
 * @route PUT /api/auth/admin/user/:userId/assign-admin
 * @desc Assign admin role to a user
 * @access Private (Admin only)
 */
router.put(
  "/admin/user/:userId/assign-admin",
  authMiddleware,
  simpleAdminAuth,
  AuthController.assignAdminRole
);

/**
 * @route PUT /api/auth/admin/user/:userId/revoke-admin
 * @desc Revoke admin role from a user
 * @access Private (Admin only)
 */
router.put(
  "/admin/user/:userId/revoke-admin",
  authMiddleware,
  simpleAdminAuth,
  AuthController.revokeAdminRole
);

/**
 * @route GET /api/auth/admin/users
 * @desc Get all users for admin review
 * @access Private (Admin only)
 */
router.get(
  "/admin/users",
  authMiddleware,
  simpleAdminAuth,
  AuthController.getAllUsers
);

/**
 * @route PUT /api/auth/admin/user/:userId/toggle-status
 * @desc Activate or deactivate a user account
 * @access Private (Admin only)
 */
router.put(
  "/admin/user/:userId/toggle-status",
  authMiddleware,
  simpleAdminAuth,
  AuthController.toggleUserStatus
);

/**
 * @route PUT /api/auth/admin/profile
 * @desc Update admin profile information
 * @access Private (Admin only)
 */
router.put(
  "/admin/profile",
  authMiddleware,
  simpleAdminAuth,
  AuthController.updateAdminProfile
);

export default router;
