# Supabase DB Schema Design (PostgreSQL)

이 프로젝트는 패스트캠퍼스 스타일의 교육 플랫폼과 커뮤니티 연동을 위해 다음과 같은 데이터베이스 스키마를 사용합니다.

## 1. Profiles (사용자 프로필)
- `id`: UUID (auth.users 참조, PK)
- `email`: TEXT (Unique)
- `full_name`: TEXT
- `avatar_url`: TEXT
- `role`: TEXT (admin/user)
- `created_at`: TIMESTAMPTZ
- `is_deleted`: BOOLEAN (Soft Delete)

## 2. Courses (강의)
- `id`: UUID (PK)
- `title`: TEXT
- `description`: TEXT
- `thumbnail_url`: TEXT
- `price`: BIGINT (정수형 금액, 원 단위)
- `curriculum`: JSONB (섹션, 비디오 링크 등 동적 데이터)
- `instructor_info`: JSONB (강사 프로필)
- `vimeo_url`: TEXT (대표 영상)
- `is_published`: BOOLEAN
- `created_at`: TIMESTAMPTZ
- `is_deleted`: BOOLEAN (Soft Delete)

## 3. Orders (결제/주문)
- `id`: UUID (PK)
- `user_id`: UUID (profiles.id 참조)
- `course_id`: UUID (courses.id 참조)
- `amount`: BIGINT (결제 금액)
- `status`: TEXT (pending/completed/cancelled)
- `created_at`: TIMESTAMPTZ

## 4. Communities (커뮤니티)
- `id`: UUID (PK)
- `course_id`: UUID (courses.id 참조, Optional)
- `name`: TEXT
- `description`: TEXT
- `created_at`: TIMESTAMPTZ
- `is_deleted`: BOOLEAN

## 5. CommunityMembers (커뮤니티 멤버십)
- `id`: UUID (PK)
- `community_id`: UUID (communities.id 참조)
- `user_id`: UUID (profiles.id 참조)
- `joined_at`: TIMESTAMPTZ

## 6. Messages (실시간 채팅 메시지)
- `id`: UUID (PK)
- `community_id`: UUID (communities.id 참조)
- `user_id`: UUID (profiles.id 참조)
- `content`: TEXT
- `created_at`: TIMESTAMPTZ

---
### [회계 시스템 3대 절대 규칙 적용]
1. **금액 계산**: `price`, `amount` 필드는 `BIGINT` 정수형으로 관리하여 소수점 오차를 방지합니다.
2. **데이터 보존**: `is_deleted` 필드를 통한 **Soft Delete**를 구현합니다.
3. **복식부기 원칙**: 주문(`Orders`) 생성 시 결제 상태와 금액을 엄격히 기록하며, 커뮤니티 가입(`CommunityMembers`)은 결제 완료(`completed`) 시점에 트리거됩니다.
