import multer from "multer";
import path from "path";

// Configure multer for memory storage (since we're uploading to ImageKit)
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, JPG, PNG, WebP) are allowed!"));
  }
};

// Configure multer
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Middleware for multiple hotel images
export const uploadHotelImages = upload.array("images", 10); // Max 10 images

// Middleware for single image
export const uploadSingleImage = upload.single("image");

// Error handling middleware for multer
export const handleMulterError = (
  error: any,
  req: any,
  res: any,
  next: any
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 10 images.",
      });
    }
  }

  if (error.message.includes("Only image files")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
};
