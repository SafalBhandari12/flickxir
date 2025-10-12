import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// Maximum refresh token lifetime (30 days)
const MAX_REFRESH_TOKEN_LIFETIME_DAYS = 30;

// Maximum refresh uses before requiring re-authentication (e.g., 20 refreshes)
const MAX_REFRESH_USES = 20;

interface RefreshTokenData {
  userId: string;
  role: string;
  type: string;
  tokenId: string;
  refreshCount: number;
}

/**
 * Create a new refresh token with absolute expiration
 */
export async function createRefreshToken(
  userId: string,
  role: string
): Promise<string> {
  // Generate unique token ID
  const tokenId = randomUUID();

  // Set absolute expiration (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MAX_REFRESH_TOKEN_LIFETIME_DAYS);

  // Clean up old refresh tokens for this user (optional: keep last 3)
  await cleanupOldRefreshTokens(userId);

  // Create refresh token record in database
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenId,
      expiresAt,
    },
  });

  // Create JWT with absolute expiration and refresh count
  const refreshToken = jwt.sign(
    {
      userId,
      role,
      type: "refresh",
      tokenId,
      refreshCount: 0, // Track how many times this has been refreshed
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: `${MAX_REFRESH_TOKEN_LIFETIME_DAYS}d` }
  );

  return refreshToken;
}

/**
 * Validate and use refresh token with security checks
 */
export async function validateAndUseRefreshToken(
  refreshToken: string
): Promise<{
  valid: boolean;
  userId?: string;
  role?: string;
  newRefreshToken?: string;
  error?: string;
}> {
  try {
    // Verify JWT
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET || "your-secret-key"
    ) as RefreshTokenData;

    // Check if it's actually a refresh token
    if (decoded.type !== "refresh") {
      return { valid: false, error: "Invalid token type" };
    }

    // Find refresh token in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenId: decoded.tokenId },
      include: { user: true },
    });

    if (!tokenRecord) {
      return { valid: false, error: "Refresh token not found" };
    }

    // Check if token is revoked
    if (tokenRecord.isRevoked) {
      return { valid: false, error: "Refresh token has been revoked" };
    }

    // Check if token has expired (absolute expiration)
    if (tokenRecord.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      });
      return {
        valid: false,
        error: "Refresh token has expired - please login again",
      };
    }

    // Check if user is still active
    if (!tokenRecord.user.isActive) {
      return { valid: false, error: "User account is inactive" };
    }

    // Check refresh count limit (prevent indefinite refresh)
    if (decoded.refreshCount >= MAX_REFRESH_USES) {
      // Revoke this token and require re-authentication
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });
      return {
        valid: false,
        error:
          "Refresh token has reached maximum usage limit - please login again",
      };
    }

    // Update last used timestamp
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { lastUsedAt: new Date() },
    });

    // Create new refresh token with incremented count (token rotation)
    const newRefreshToken = jwt.sign(
      {
        userId: decoded.userId,
        role: decoded.role,
        type: "refresh",
        tokenId: decoded.tokenId, // Keep same tokenId for tracking
        refreshCount: decoded.refreshCount + 1, // Increment refresh count
      },
      process.env.JWT_SECRET || "your-secret-key",
      {
        expiresIn: Math.floor(
          (tokenRecord.expiresAt.getTime() - Date.now()) / 1000
        ), // Remaining time
      }
    );

    return {
      valid: true,
      userId: decoded.userId,
      role: decoded.role,
      newRefreshToken,
    };
  } catch (error) {
    return { valid: false, error: "Invalid or expired refresh token" };
  }
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenId },
    data: { isRevoked: true },
  });
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserRefreshTokens(
  userId: string
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { isRevoked: true },
  });
}

/**
 * Clean up old/expired refresh tokens
 */
export async function cleanupOldRefreshTokens(userId?: string): Promise<void> {
  const where: any = {
    OR: [
      { expiresAt: { lt: new Date() } }, // Expired tokens
      { isRevoked: true }, // Revoked tokens
    ],
  };

  if (userId) {
    // For specific user, also clean up old tokens (keep only last 3)
    const userTokens = await prisma.refreshToken.findMany({
      where: { userId, isRevoked: false },
      orderBy: { createdAt: "desc" },
      skip: 3, // Keep last 3 tokens
    });

    if (userTokens.length > 0) {
      where.OR.push({
        id: { in: userTokens.map((t) => t.id) },
      });
    }
  }

  await prisma.refreshToken.deleteMany({ where });
}

/**
 * Get refresh token statistics for a user
 */
export async function getUserRefreshTokenStats(userId: string): Promise<{
  activeTokens: number;
  totalTokens: number;
  lastUsed?: Date;
}> {
  const [activeCount, totalCount, lastUsed] = await Promise.all([
    prisma.refreshToken.count({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    }),
    prisma.refreshToken.count({ where: { userId } }),
    prisma.refreshToken.findFirst({
      where: { userId, isRevoked: false },
      orderBy: { lastUsedAt: "desc" },
      select: { lastUsedAt: true },
    }),
  ]);

  const result: {
    activeTokens: number;
    totalTokens: number;
    lastUsed?: Date;
  } = {
    activeTokens: activeCount,
    totalTokens: totalCount,
  };

  if (lastUsed?.lastUsedAt) {
    result.lastUsed = lastUsed.lastUsedAt;
  }

  return result;
}
