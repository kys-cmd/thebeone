import { supabase } from '@/lib/supabase';
import { Course } from '@/types';

export const courseService = {
  async getCourses() {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('is_deleted', false)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Course[];
  },

  async getAllCoursesAsAdmin() {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Course[];
  },

  async getCourseById(id: string) {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Course;
  },

  async createCourse(course: Partial<Course>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('courses')
      .insert([{ 
        ...course, 
        is_deleted: false, 
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Course;
  },

  async updateCourse(id: string, updates: Partial<Course>) {
    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Course;
  },

  async softDeleteCourse(id: string) {
    // Soft delete as per rule
    const { error } = await supabase
      .from('courses')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) throw error;
  },

  async checkEnrollment(userId: string, courseId: string) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('id, expires_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('is_deleted', false)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return false;

    if (data.expires_at) {
      return new Date(data.expires_at) > new Date();
    }

    return true;
  },

  async enrollCourse(userId: string, courseId: string, customExpiresAt?: string | null) {
    // 1. Ensure user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');
    
    if (user.id !== userId) {
      // 관리자인지 확인하여 타인 등록 허용
      const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const isAdmin = requesterProfile && (requesterProfile.role === 'admin' || requesterProfile.role === 'super_admin');
      
      if (!isAdmin) {
        throw new Error('사용자 정보가 일치하지 않습니다.');
      }
    }

    // 2. Ensure profile exists (Self-Healing)
    const { data: profile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileFetchError) {
      console.warn('Profile fetch error before enrollment:', profileFetchError);
    }

    // 프로필이 없는 경우에만 생성을 시도합니다.
    if (!profile) {
      console.log('Profile not found, attempting to create one for UI sync...');
      const { error: profileSyncError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          role: 'user',
          is_deleted: false,
          created_at: new Date().toISOString()
        });

      if (profileSyncError) {
        console.error('Profile synchronization failed:', profileSyncError);
        
        // RLS 에러인 경우 사용자에게 구체적인 해결 방법을 제시합니다.
        if (profileSyncError.message.includes('row-level security')) {
          throw new Error('데이터베이스 권한 설정(RLS)이 되지 않았습니다. Supabase SQL Editor에서 제공해 드린 SQL을 실행해 주세요.');
        }
        
        // 그 외 에러는 PK 중복 등의 문제일 수 있으므로 로그만 남기고 진행해 봅니다.
        // (이미 트리거로 생성되었을 가능성이 큼)
      }
    }

    // 3. Perform enrollment - Check if already enrolled first (including deleted ones) to prevent unique constraint violations
    const { data: existing, error: checkError } = await supabase
      .from('enrollments')
      .select('id, is_deleted')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (checkError) throw checkError;
    
    if (existing) {
      // 만약 기존에 등록 정보가 있다면 (삭제되었든, 활성 상태이든) 복구 및 정보 업데이트를 수행합니다.
      const updateData: any = {
        is_deleted: false,
        created_at: new Date().toISOString() // 등록일 재설정
      };

      if (customExpiresAt !== undefined) {
        updateData.expires_at = customExpiresAt;
      } else {
        // 코스 기본 기간 기반으로 만료일 계산
        const { data: course, error: courseError } = await supabase
          .from('courses')
          .select('is_duration_based, duration_days')
          .eq('id', courseId)
          .single();
        
        if (!courseError && course) {
          if (course.is_duration_based && course.duration_days) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + course.duration_days);
            updateData.expires_at = expiresAt.toISOString();
          } else {
            updateData.expires_at = null;
          }
        }
      }

      const { data: updated, error: updateError } = await supabase
        .from('enrollments')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();
        
      if (updateError) throw updateError;
      return updated;
    }

    // 4. Check Capacity for offline courses & Fetch duration info
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('category, max_capacity, is_duration_based, duration_days')
      .eq('id', courseId)
      .single();

    if (courseError) throw courseError;

    if (course.category === 'special_offline' && course.max_capacity) {
      const { count, error: countError } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('is_deleted', false);

      if (countError) throw countError;
      
      if (count !== null && count >= course.max_capacity) {
        throw new Error('정원이 초과되어 신청하실 수 없습니다.');
      }
    }

    const enrollmentData: any = { 
      user_id: userId, 
      course_id: courseId,
      created_at: new Date().toISOString(),
      is_deleted: false
    };

    if (customExpiresAt !== undefined) {
      enrollmentData.expires_at = customExpiresAt;
    } else if (course.is_duration_based && course.duration_days) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + course.duration_days);
      enrollmentData.expires_at = expiresAt.toISOString();
    }

    const { data, error } = await supabase
      .from('enrollments')
      .insert([enrollmentData])
      .select()
      .single();
    
    if (error) {
      console.error('Enrollment Insert Error:', error);
      throw error;
    }
    return data;
  },

  async unenrollCourse(userId: string, courseId: string) {
    const { error } = await supabase
      .from('enrollments')
      .update({ is_deleted: true })
      .eq('user_id', userId)
      .eq('course_id', courseId);
    
    if (error) throw error;
  },

  async updateEnrollmentExpiry(userId: string, courseId: string, expiresAt: string | null) {
    const { error } = await supabase
      .from('enrollments')
      .update({ expires_at: expiresAt })
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('is_deleted', false);
    
    if (error) throw error;
  },

  async getMyCourses(userId: string) {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        expires_at,
        course:courses (*)
      `)
      .eq('user_id', userId)
      .eq('is_deleted', false);
    
    if (error) throw error;
    if (!data) return [];
    
    const now = new Date();
    return (data as any[])
      .filter(item => !item.expires_at || new Date(item.expires_at) > now)
      .map(item => item.course)
      .filter(Boolean) as Course[];
  },

  async getEnrollmentCount(courseId: string) {
    const { count, error } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .eq('is_deleted', false);
    
    if (error) throw error;
    return { count };
  },

  async getRecentEnrollments(limit: number = 5) {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        created_at,
        course:courses (title),
        profile:profiles (name)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  async getTotalStats() {
    const { count: enrollmentsCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    const { count: usersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    return {
      enrollmentsCount: enrollmentsCount || 0,
      usersCount: usersCount || 0
    };
  }
};
