import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Import routes
import authRoutes from "./auth/authRoutes.js";
import { marketRoutes } from "./market/routes/index.js";

// Import services
import { OTPService } from "./auth/otpService.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ================================
// SECURITY MIDDLEWARE
// ================================

// Helmet for security headers
app.use(helmet());

app.use(
  cors({
    origin: "*",
    optionsSuccessStatus: 200,
  })
);
// ================================
// GLOBAL RATE LIMITING
// ================================

// General API rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// ================================
// PARSING MIDDLEWARE
// ================================

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ================================
// HEALTH CHECK ENDPOINT
// ================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Sojourn Multi-Vendor Platform API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
  });
});

// ================================
// API ROUTES
// ================================

// Authentication routes
app.use("/api/auth", authRoutes);

// Market platform routes
app.use("/api/market", marketRoutes);

// ================================
// ERROR HANDLING MIDDLEWARE
// ================================

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global Error Handler:", err);

    // Handle specific error types
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: err.errors,
      });
    }

    if (err.name === "UnauthorizedError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Resource already exists",
        field: err.meta?.target,
      });
    }

    // Default error response
    res.status(err.status || 500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message || "Something went wrong!",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  }
);

// ================================
// START SERVER
// ================================

// Initialize services before starting server
async function initializeServices() {
  try {
    console.log("Initializing services...");
    await OTPService.initializeConfig();
    console.log("Services initialized successfully");
  } catch (error) {
    console.error("Failed to initialize services:", error);
    process.exit(1);
  }
}

// Graceful shutdown handler
let serverInstance: any = null;

const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  if (serverInstance) {
    serverInstance.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Start the server with initialization
async function startServer() {
  try {
    // Initialize services first
    await initializeServices();

    // Start the server
    serverInstance = app.listen(PORT, () => {
      console.log(`
Sojourn Multi-Vendor Platform API is running!
Server: http://localhost:${PORT}
Health: http://localhost:${PORT}/health  
Environment: ${process.env.NODE_ENV || "development"}
Started at: ${new Date().toISOString()}
      `);
    });

    // Handle graceful shutdown
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      // Close server & exit process
      if (serverInstance) {
        serverInstance.close(() => {
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error);
      process.exit(1);
    });

    return serverInstance;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the application
startServer();

export default app;
