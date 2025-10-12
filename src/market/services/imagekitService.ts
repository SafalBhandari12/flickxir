import ImageKit from "imagekit";

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY!,
  urlEndpoint:
    process.env.IMAGE_KIT_URL_ENDPOINT || "https://ik.imagekit.io/your-id",
});

export interface ImageUploadResult {
  fileId: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  size: number;
  filePath: string;
}

export class ImageKitService {
  /**
   * Upload a single image to ImageKit
   */
  static async uploadImage(
    file: Express.Multer.File,
    folder: string = "products",
    fileName?: string
  ): Promise<ImageUploadResult> {
    try {
      const uploadResponse = await imagekit.upload({
        file: file.buffer,
        fileName: fileName || `${Date.now()}_${file.originalname}`,
        folder: folder,
        useUniqueFileName: true,
        transformation: {
          pre: "l-text,i-Flickxir,fs-50,co-FFFFFF,bg-00000080,l-end", // Optional watermark
        },
      });

      return {
        fileId: uploadResponse.fileId,
        name: uploadResponse.name,
        url: uploadResponse.url,
        thumbnailUrl: uploadResponse.thumbnailUrl || uploadResponse.url,
        size: uploadResponse.size,
        filePath: uploadResponse.filePath,
      };
    } catch (error) {
      console.error("ImageKit upload error:", error);
      throw new Error("Failed to upload image to ImageKit");
    }
  }

  /**
   * Upload multiple images to ImageKit
   */
  static async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string = "products"
  ): Promise<ImageUploadResult[]> {
    try {
      const uploadPromises = files.map((file, index) =>
        this.uploadImage(
          file,
          folder,
          `${Date.now()}_${index}_${file.originalname}`
        )
      );

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error("ImageKit multiple upload error:", error);
      throw new Error("Failed to upload images to ImageKit");
    }
  }

  /**
   * Delete an image from ImageKit
   */
  static async deleteImage(fileId: string): Promise<void> {
    try {
      await imagekit.deleteFile(fileId);
    } catch (error) {
      console.error("ImageKit delete error:", error);
      throw new Error("Failed to delete image from ImageKit");
    }
  }

  /**
   * Delete multiple images from ImageKit
   */
  static async deleteMultipleImages(fileIds: string[]): Promise<void> {
    try {
      const deletePromises = fileIds.map((fileId) => this.deleteImage(fileId));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("ImageKit multiple delete error:", error);
      throw new Error("Failed to delete images from ImageKit");
    }
  }

  /**
   * Get image details from ImageKit
   */
  static async getImageDetails(fileId: string): Promise<any> {
    try {
      return await imagekit.getFileDetails(fileId);
    } catch (error) {
      console.error("ImageKit get details error:", error);
      throw new Error("Failed to get image details from ImageKit");
    }
  }

  /**
   * Generate authentication parameters for client-side upload
   */
  static getAuthenticationParameters() {
    return imagekit.getAuthenticationParameters();
  }
}
