import { supabase } from '@/lib/supabase';

export interface Instructor {
  id: string;
  name: string;
  title: string;
  bio: string;
  image_url: string;
  tags?: string[];
  is_deleted: boolean;
  created_at: string;
}

export const instructorService = {
  async getInstructors() {
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .eq('is_deleted', false)
      .order('name');
    if (error) throw error;
    return data as Instructor[];
  },

  async getInstructor(id: string) {
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Instructor;
  },

  async createInstructor(instructor: Partial<Instructor>) {
    const { data, error } = await supabase
      .from('instructors')
      .insert([instructor])
      .select()
      .single();
    if (error) throw error;
    return data as Instructor;
  },

  async updateInstructor(id: string, instructor: Partial<Instructor>) {
    // 1. Update the instructor table
    const { data, error } = await supabase
      .from('instructors')
      .update(instructor)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // 2. Cascade update to courses table (denormalized instructor fields)
    const syncData: any = {};
    if (instructor.name) syncData.instructor = instructor.name;
    if (instructor.title) syncData.instructor_title = instructor.title;
    if (instructor.bio) syncData.instructor_bio = instructor.bio;
    if (instructor.image_url) syncData.instructor_image = instructor.image_url;
    if (instructor.tags) syncData.instructor_tags = instructor.tags;

    if (Object.keys(syncData).length > 0) {
      const { error: syncError } = await supabase
        .from('courses')
        .update(syncData)
        .eq('instructor_id', id);
      
      if (syncError) {
        console.error('Cascading instructor sync to courses failed:', syncError);
        // Note: We don't throw here to avoid failing the instructor update itself, 
        // as the data is already saved in the main table.
      }
    }

    return data as Instructor;
  },

  async deleteInstructor(id: string) {
    const { error } = await supabase
      .from('instructors')
      .update({ is_deleted: true })
      .eq('id', id);
    if (error) throw error;
  }
};
