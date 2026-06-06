import { supabase } from '@/lib/supabase';

export const storageService = {
  /**
   * Upload an image to Supabase Storage
   * @param file The file object to upload
   * @param bucketName The name of the storage bucket ('public-assets' by default)
   * @returns The public URL of the uploaded image
   */
  async uploadImage(file: File, bucketName: string = 'public-assets'): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return publicUrl;
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

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return publicUrl;
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

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        url: publicUrl,
        name: file.name,
        size: file.size
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('파일 업로드에 실패했습니다.');
    }
  }
};
