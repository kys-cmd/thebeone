import { supabase } from '@/lib/supabase';

export interface LessonProgress {
  id?: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  is_completed: boolean;
  watched_time: number;
  created_at?: string;
  updated_at?: string;
}

export const accessService = {
  /**
   * 코스/강의 접근 권한 확인 (Course Access Resolver)
   */
  async canAccessCourse(courseId: string, userId?: string): Promise<boolean> {
    const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!resolvedUserId) return false;

    // 1. 관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', resolvedUserId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
      return true;
    }

    // 2. 수강 신청 여부 확인
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        expires_at,
        course:courses (
          is_duration_based,
          end_date
        )
      `)
      .eq('user_id', resolvedUserId)
      .eq('course_id', courseId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error || !enrollment) return false;

    const now = new Date();
    // 만료일 검사
    if (enrollment.expires_at) {
      if (new Date(enrollment.expires_at) <= now) {
        return false;
      }
    }

    const course = (enrollment as any).course;
    if (course && !course.is_duration_based && course.end_date) {
      if (new Date(course.end_date) <= now) {
        return false;
      }
    }

    return true;
  },

  /**
   * 강좌 속 개별 레슨 접근 권한 확인 (Lesson Access Resolver)
   */
  async canAccessLesson(courseId: string, lessonId: string, userId?: string): Promise<boolean> {
    const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!resolvedUserId) return false;
    
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          action: 'verify-lesson-access',
          courseId,
          lessonId,
          userId: resolvedUserId
        })
      });

      const result = await response.json();
      return !!result.allowed;
    } catch (e) {
      console.error('Error verifying lesson access via central API:', e);
      return false;
    }
  },

  /**
   * 커뮤니티 공간 접근 권한 확인 (Community Access Resolver)
   */
  async canAccessCommunity(communityId: string, userId?: string): Promise<boolean> {
    const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!resolvedUserId) return false;

    // 1. 관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', resolvedUserId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
      return true;
    }

    // 2. 커뮤니티 테이블 조회하여 course_id 연동 확인
    const { data: community, error: commError } = await supabase
      .from('communities')
      .select('course_id')
      .eq('id', communityId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (commError || !community) return false;

    // 3. 만약 연동된 강좌가 있는 커뮤니티라면 해당 강좌의 열성 수강생인지 확인
    if (community.course_id) {
      const hasAccess = await this.canAccessCourse(community.course_id, resolvedUserId);
      if (hasAccess) return true;
    }

    // 4. 개별 멤버십 (community_members) 테이블 직접 가입 확인
    const { data: membership } = await supabase
      .from('community_members')
      .select('id, role')
      .eq('community_id', communityId)
      .eq('user_id', resolvedUserId)
      .maybeSingle();

    if (membership && membership.role !== 'excluded' && membership.role !== 'pending') {
      return true;
    }

    return false;
  },

  /**
   * 학습자의 특정 코스 전체 진도율 내역 로드
   */
  async getCourseProgress(courseId: string, userId?: string): Promise<LessonProgress[]> {
    const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!resolvedUserId) return [];

    // Helper to load fallback local progress
    const loadFromLocal = (): LessonProgress[] => {
      try {
        const key = `local_progress_${resolvedUserId}_${courseId}`;
        const localData = localStorage.getItem(key);
        if (localData) {
          return JSON.parse(localData);
        }
      } catch (err) {
        console.error('Failed to load local progress from localStorage:', err);
      }
      return [];
    };

    const { data, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', resolvedUserId)
      .eq('course_id', courseId)
      .eq('is_deleted', false);

    if (error) {
      console.warn('Could not load lesson progress from DB:', error);
      const isTableMissing = error.message?.includes('schema cache') || error.code === 'PGRST205' || error.message?.includes('does not exist');
      if (isTableMissing) {
        console.log('Database lesson_progress is missing. Falling back to local storage.');
        return loadFromLocal();
      }
      return [];
    }

    // Merge with any local storage values to be absolutely safe
    const localData = loadFromLocal();
    if (localData.length > 0) {
      const mergedMap = new Map<string, LessonProgress>();
      // Put remote data first
      (data || []).forEach((p: any) => {
        mergedMap.set(p.lesson_id, p as LessonProgress);
      });
      // Put local data if it's more recently updated or if remote doesn't have it
      localData.forEach(p => {
        const remote = mergedMap.get(p.lesson_id);
        if (!remote || new Date(p.updated_at || 0) > new Date(remote.updated_at || 0)) {
          mergedMap.set(p.lesson_id, p);
        }
      });
      return Array.from(mergedMap.values());
    }

    return data as LessonProgress[];
  },

  /**
   * 학습자의 특정 레슨 수강 완료 및 시청 시간 수강 통계 기록 업데이트
   */
  async updateLessonProgress(
    courseId: string,
    lessonId: string,
    isCompleted: boolean,
    watchedTime: number = 0,
    userId?: string
  ): Promise<boolean> {
    const resolvedUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!resolvedUserId) return false;

    // Local storage backup saving function helper
    const saveToLocal = (uid: string, cid: string, lid: string, done: boolean, seconds: number) => {
      try {
        const key = `local_progress_${uid}_${cid}`;
        const localDataRaw = localStorage.getItem(key);
        let progressList: LessonProgress[] = [];
        if (localDataRaw) {
          try {
            progressList = JSON.parse(localDataRaw);
          } catch (e) {}
        }
        
        const idx = progressList.findIndex(p => p.lesson_id === lid);
        const record: LessonProgress = {
          user_id: uid,
          course_id: cid,
          lesson_id: lid,
          is_completed: done,
          watched_time: seconds,
          updated_at: new Date().toISOString()
        };
        
        if (idx >= 0) {
          progressList[idx] = record;
        } else {
          progressList.push(record);
        }
        localStorage.setItem(key, JSON.stringify(progressList));
      } catch (err) {
        console.error('Local progress storage error:', err);
      }
    };

    try {
      // Try updating via the secure server-side API proxy first
      const session = (await supabase.auth.getSession()).data.session;
      if (session) {
        try {
          const response = await fetch('/api/video/progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              courseId,
              lessonId,
              event: isCompleted ? 'complete' : 'progress',
              isCompleted,
              watchedTime
            })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
              saveToLocal(resolvedUserId, courseId, lessonId, isCompleted, watchedTime);
              return true;
            } else if (result.status === 'db_table_missing') {
              console.log('Server reported db_table_missing. Saved to localStorage fallback.');
              saveToLocal(resolvedUserId, courseId, lessonId, isCompleted, watchedTime);
              return true;
            }
          }
        } catch (apiErr) {
          console.warn('API progression save failed, trying direct fallback:', apiErr);
        }
      }

      // Fallback: direct database upsert (with correct comma-separated column string for onConflict)
      const progressRecord = {
        user_id: resolvedUserId,
        course_id: courseId,
        lesson_id: lessonId,
        is_completed: isCompleted,
        watched_time: watchedTime,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('lesson_progress')
        .upsert(progressRecord, { onConflict: 'user_id,course_id,lesson_id' });

      if (error) {
        console.error('Error saving lesson progress via fallback:', error);
        const isTableMissing = error.message?.includes('schema cache') || error.code === 'PGRST205' || error.message?.includes('does not exist');
        if (isTableMissing) {
          console.log('Database lesson_progress is missing. Kept in local storage fallback.');
          saveToLocal(resolvedUserId, courseId, lessonId, isCompleted, watchedTime);
          return true; // Return true as user action successfully stored locally
        }
        return false;
      }

      saveToLocal(resolvedUserId, courseId, lessonId, isCompleted, watchedTime);
      return true;
    } catch (e) {
      console.error('Failed to update lesson progress', e);
      saveToLocal(resolvedUserId, courseId, lessonId, isCompleted, watchedTime);
      return true;
    }
  }
};
