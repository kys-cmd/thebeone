import { supabase } from '@/lib/supabase';

/**
 * Client-size canvas compression helper for images.
 * Downsizes file if resolution is huge, and compresses quality if size is > 1MB.
 */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    // Only compress standard images (exclude animated gifs and vector svgs)
    if (!file.type.startsWith('image/') || file.type.includes('gif') || file.type.includes('svg')) {
      resolve(file);
      return;
    }

    // If file size is already small (e.g. under 1MB), bypass compression for performance
    if (file.size <= 1024 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1920;
        const maxH = 1920;
        let width = img.width;
        let height = img.height;

        // Perform proportional scaling if the image size overflows max boundary
        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Output JPEG by default to maximize compression, keep PNG if transparent PNG upload
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = 0.85;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            
            const extension = outputType === 'image/png' ? 'png' : 'jpg';
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const newName = `${baseName}_optimized.${extension}`;
            const compressedFile = new File([blob], newName, {
              type: outputType,
              lastModified: Date.now(),
            });

            // Only return the compressed file if it's smaller than the original upload
            if (compressedFile.size >= file.size) {
              resolve(file);
            } else {
              resolve(compressedFile);
            }
          },
          outputType,
          outputType === 'image/jpeg' ? quality : undefined
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export const storageService = {
  /**
   * Upload an image to Supabase Storage with dynamic client-side compression
   * @param file The file object to upload
   * @param bucketName The name of the storage bucket ('public-assets' by default)
   * @returns The public URL of the uploaded image
   */
  async uploadImage(file: File, bucketName: string = 'public-assets'): Promise<string> {
    try {
      // Automatically compress image before uploading
      const compressedFile = await compressImage(file);
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      return `/api/assets/${bucketName}/${filePath}`;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('이미지 업로드에 실패했습니다.');
    }
  },

  /**
   * Upload a video to Supabase Storage
   * @param file The file object to upload
   * @param bucketName The name of the storage bucket ('public-assets' by default)
   * @returns The public URL of the uploaded video
   */
  async uploadVideo(file: File, bucketName: string = 'public-assets'): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      return `/api/assets/${bucketName}/${filePath}`;
    } catch (error) {
      console.error('Error uploading video:', error);
      throw new Error('동영상 업로드에 실패했습니다.');
    }
  },

  /**
   * Upload any file to Supabase Storage
   * @param file The file object to upload
   * @param bucketName The name of the storage bucket ('public-assets' by default)
   * @returns The public URL and file info
   */
  async uploadFile(file: File, bucketName: string = 'public-assets'): Promise<{ url: string; name: string; size: number }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
      const filePath = `materials/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      return {
        url: `/api/assets/${bucketName}/${filePath}`,
        name: file.name,
        size: file.size
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('파일 업로드에 실패했습니다.');
    }
  }
};
