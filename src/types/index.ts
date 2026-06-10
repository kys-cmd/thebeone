export type UserRole = 'super_admin' | 'admin' | 'user' | 'paid_member' | 'regular_member' | 'beone_member' | 'bione_member';

export interface Profile {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  avatar_url: string | null;
  role: UserRole;
  gender: string | null;
  birthdate: string | null;
  mobile_phone: string | null;
  phone: string | null;
  address: string | null;
  mileage?: number;
  is_deleted: boolean;
  created_at: string;
}

export interface CourseMaterial {
  id: string;
  name: string;
  url: string;
  size?: number;
  created_at?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  price: number;
  discount_price: number | null;
  instructor_id?: string | null;
  instructor: string;
  instructor_title?: string | null;
  instructor_bio?: string | null;
  instructor_image?: string | null;
  instructor_tags?: string[] | null;
  hero_bg_color?: string | null;
  hero_text_color?: string | null;
  hero_image?: string | null;
  outcomes?: string[] | null;
  recommended_for?: string[] | null;
  materials?: CourseMaterial[] | null;
  category: string; // 'regular', 'special_online', 'special_offline', 'live'
  status: string; // 'draft', 'published', 'private'
  start_date: string | null;
  end_date: string | null;
  reg_start_date?: string | null;
  reg_end_date?: string | null;
  study_start_date?: string | null;
  study_end_date?: string | null;
  access_type: string; // 'automatic', 'manual'
  min_member_grade?: string | null; // e.g. 'beone_member', 'paid_member', etc.
  curriculum: CurriculumSection[];
  layout?: CourseLayout | null;
  created_at: string;
  is_deleted: boolean;
  location?: string | null;
  is_free: boolean;
  max_capacity?: number | null;
  enrolled_count?: number;
  is_force_closed?: boolean;
  is_duration_based?: boolean | null;
  duration_days?: number | null;
}

export type CourseBlockType = 'video' | 'image' | 'text' | 'heading';

export interface CourseBlock {
  id: string;
  type: CourseBlockType;
  content: string; // vimeo id, image url, or text content
  metadata?: {
    caption?: string;
    style?: string;
    title?: string;
  };
}

export interface CourseLayout {
  blocks: CourseBlock[];
}

export interface CurriculumSection {
  id: string;
  title: string;
  items: CurriculumItem[];
}

export interface CurriculumItem {
  id: string;
  title: string;
  vimeo_id?: string;
  duration?: string;
  is_free?: boolean;
}

export interface InstructorInfo {
  name: string;
  bio: string;
  avatar_url?: string;
}

export interface Order {
  id: string;
  user_id: string;
  course_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Community {
  id: string;
  course_id?: string;
  name: string;
  description: string | null;
  type: 'season' | 'course' | 'board';
  season_number?: number;
  post_permission: 'all' | 'admin';
  created_at: string;
  is_deleted: boolean;
}

export interface Post {
  id: string;
  community_id: string;
  user_id: string;
  title: string;
  content: string;
  content_json?: any;
  hashtags?: string[];
  type: 'notice' | 'general' | 'mission_template' | 'mission_verification';
  views: number;
  image_urls?: string[];
  file_urls?: string[];
  links?: { title: string; url: string }[];
  created_at: string;
  is_deleted: boolean;
  profiles?: {
    name: string | null;
    nickname: string | null;
    avatar_url: string | null;
  };
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_pinned?: boolean;
  metadata?: any;
  reactions?: Record<string, { count: number; user_ids: string[] }>;
  has_attended?: boolean;
  attendance_count?: number;
  user_todo_checks?: number[];
  todo_checks?: { user_id: string; todo_index: number }[];
  poll_votes?: { user_id: string; option_index: number }[];
  user_poll_vote?: number | null;
}

export interface Reaction {
  id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    name: string | null;
    nickname: string | null;
    avatar_url: string | null;
  };
}

export interface Message {
  id: string;
  community_id: string;
  room_id?: string | null;
  user_id: string;
  content: string;
  type: 'text' | 'gif' | 'sticker' | 'image' | 'file';
  media_url?: string;
  metadata?: {
    file_name?: string;
    file_size?: number;
    emoji?: string;
  };
  created_at: string;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  reply_to?: Message | null;
  reactions?: Record<string, { count: number; user_ids: string[] }>;
  profiles?: {
    name: string | null;
    nickname: string | null;
    avatar_url: string | null;
  };
}

export interface ChatRoom {
  id: string;
  community_id?: string | null;
  name: string;
  type: 'public' | 'private' | 'one_to_one';
  password?: string;
  created_by: string;
  created_at: string;
  is_deleted: boolean;
  member_count?: number;
}

export interface ChatRoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface CommunityInvitation {
  id: string;
  community_id: string;
  inviter_id: string;
  invitee_email: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface BoardPost {
  id: string;
  community_id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  profiles?: {
    name: string | null;
    nickname: string | null;
    avatar_url: string | null;
  } | null;
}

export interface BoardReply {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    name: string | null;
    nickname: string | null;
    avatar_url: string | null;
  } | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles?: {
    name: string | null;
    nickname: string | null;
    avatar_url: string | null;
  } | null;
}

