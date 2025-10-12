import { Router } from "express";
import { productRoutes } from "./productRoutes.js";
import { orderRoutes } from "./orderRoutes.js";
import { vendorRoutes } from "./vendorRoutes.js";
import { adminRoutes } from "./adminRoutes.js";

const router = Router();

// Mount all market routes
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/vendors", vendorRoutes);
router.use("/admin", adminRoutes);

export { router as marketRoutes };
