import { z } from 'zod';

// ── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
});

export const RegisterSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.')
    .regex(/[A-Za-z]/, '영문자를 포함해야 합니다.')
    .regex(/[0-9]/, '숫자를 포함해야 합니다.'),
  name: z.string().min(1, '이름을 입력해주세요.').max(50),
  nickname: z.string().min(1, '닉네임을 입력해주세요.').max(30).optional(),
  phone: z.string().regex(/^01[0-9]{8,9}$/, '올바른 휴대폰 번호를 입력해주세요.').optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요.'),
});

export const OTPVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'OTP는 6자리입니다.'),
});

export const PasswordChangeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.')
    .regex(/[A-Za-z]/, '영문자를 포함해야 합니다.')
    .regex(/[0-9]/, '숫자를 포함해야 합니다.'),
});

// ── Community / Posts ───────────────────────────────────────────────────────

export const PostCreateSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.').max(200, '제목은 200자 이내여야 합니다.'),
  content: z.string().min(1, '내용을 입력해주세요.').max(100_000),
  community_id: z.string().uuid('유효한 커뮤니티 ID가 필요합니다.'),
  type: z.enum(['general', 'notice', 'poll', 'todo']).default('general'),
  is_anonymous: z.boolean().default(false),
});

export const CommentCreateSchema = z.object({
  post_id: z.string().uuid(),
  content: z.string().min(1, '내용을 입력해주세요.').max(5000),
  parent_id: z.string().uuid().optional().nullable(),
});

// ── Chat ────────────────────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  room_id: z.string().uuid(),
  content: z.string().min(1).max(10_000),
  message_type: z.enum(['text', 'image', 'file', 'system']).default('text'),
});

export const ChatRoomCreateSchema = z.object({
  name: z.string().min(1, '채팅방 이름을 입력해주세요.').max(100),
  description: z.string().max(500).optional(),
  is_private: z.boolean().default(false),
  community_id: z.string().uuid().optional().nullable(),
});

// ── Payment ─────────────────────────────────────────────────────────────────

export const InitPaySchema = z.object({
  price: z.number().int().positive('결제 금액이 유효하지 않습니다.'),
  oid: z.string().min(1).max(100),
  timestamp: z.string().or(z.number()),
  userId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  orderName: z.string().max(200).optional(),
});

// ── Profile ──────────────────────────────────────────────────────────────────

export const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  nickname: z.string().min(1).max(30).optional(),
  phone: z.string().regex(/^01[0-9]{8,9}$/).optional().nullable(),
  mobile_phone: z.string().regex(/^01[0-9]{8,9}$/).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

export function validate<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!errors[path]) errors[path] = issue.message;
  }
  return { success: false, errors };
}
