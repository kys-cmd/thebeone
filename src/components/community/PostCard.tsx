import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Heart,
  Images,
  Lock,
  MessageSquare,
  Paperclip,
  Pin,
  Play,
  Vote,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Post, Comment as CommunityComment } from '@/types';
import { IMAGE_WIDTHS } from '@/lib/image';
import {
  buildPostBlocks,
  getPostImageUrls,
  getPostPlainText,
  isCommentingAllowed,
} from './postContent';

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  isAdmin?: boolean;
  comments?: CommunityComment[];
  onLike: (postId: string) => void;
  onCommentToggle: (postId: string) => void;
  onCommentSubmit: (postId: string, content: string) => Promise<void>;
  onTogglePin?: (postId: string, isPinned: boolean) => void;
  onJoinAttendance?: (postId: string) => void;
  onToggleTodo?: (postId: string, todoIndex: number, completed: boolean) => void;
  onVotePoll?: (postId: string, optionIndex: number) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (post: Post) => void;
  isRestricted?: boolean;
  isFeedMode?: boolean;
  communityName?: string;
  onCardClick?: (post: Post) => void;
}

/**
 * 커뮤니티 목록에서 쓰는 요약 카드.
 *
 * 목록에서는 원본 이미지를 그대로 내려받지 않고 카드 크기에 맞게 리사이즈된
 * 썸네일(OptimizedImage)만 lazy 로딩해 스크롤 성능과 트래픽을 아낀다.
 * 본문 전체는 카드를 눌러 스레드 상세로 들어가서 확인한다.
 */
export function PostCard({
  post,
  onLike,
  isRestricted = false,
  communityName,
  onCardClick,
}: PostCardProps) {
  const author = post.profiles?.nickname || post.profiles?.name || '익명';
  const images = getPostImageUrls(post);
  const cover = images[0];
  const preview = getPostPlainText(post);
  const commentsAllowed = isCommentingAllowed(post);

  const blocks = buildPostBlocks(post);
  const hasVideo = blocks.some(b => b.type === 'video');
  const hasFile = blocks.some(b => b.type === 'file');
  const hasPoll = blocks.some(b => b.type === 'poll');

  let relativeTime = '방금 전';
  try {
    relativeTime = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ko });
  } catch {
    /* 날짜 파싱 실패 시 기본값 사용 */
  }

  return (
    <Card
      id={`feed-post-${post.id}`}
      className={cn(
        'w-full bg-white rounded-2xl border border-slate-150 flex flex-col p-4 sm:p-5 mb-3 text-left relative overflow-hidden shadow-none transition-colors hover:border-purple-200',
        post.is_pinned && 'border-purple-200 bg-purple-50/20'
      )}
    >
      {/* 작성자 / 커뮤니티 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-9 h-9 border border-slate-150 shrink-0 ring-2 ring-slate-50">
            <AvatarImage src={post.profiles?.avatar_url || ''} referrerPolicy="no-referrer" />
            <AvatarFallback className="bg-purple-600 text-white font-extrabold text-[11px]">
              {author.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-[13.5px] text-slate-900 truncate">{author}</span>
              {post.is_pinned && (
                <Badge className="bg-purple-100 text-purple-700 border-none text-[9px] font-black px-1.5 py-0 rounded-md gap-0.5">
                  <Pin className="w-2.5 h-2.5" /> 공지
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold font-mono">{relativeTime}</span>
          </div>
        </div>

        {communityName && (
          <span className="bg-purple-600 text-white font-extrabold text-[10.5px] px-2.5 py-1 rounded-full shrink-0">
            {communityName}
          </span>
        )}
      </div>

      {/* 제목 · 미리보기 · 최적화 썸네일 */}
      <button
        type="button"
        onClick={() => onCardClick?.(post)}
        className="mt-3 flex gap-3.5 justify-between items-start text-left w-full bg-transparent border-none p-0 cursor-pointer group"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-snug group-hover:text-purple-700 transition-colors line-clamp-2">
            {post.title || (preview ? `${preview.substring(0, 35)}…` : '새로운 이야기')}
          </h3>
          {preview && (
            <p className="text-[12.5px] text-slate-600 font-medium leading-relaxed mt-1.5 line-clamp-2">
              {preview}
            </p>
          )}
        </div>

        {cover && (
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-slate-150 bg-slate-50 relative">
            <OptimizedImage
              src={cover}
              alt=""
              displayWidth={IMAGE_WIDTHS.thumb}
              sizes="96px"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {images.length > 1 && (
              <span className="absolute bottom-1 right-1 bg-black/65 text-white font-black text-[9px] px-1.5 py-0.5 rounded-md">
                +{images.length - 1}
              </span>
            )}
          </div>
        )}
      </button>

      {/* 첨부 요약 배지 */}
      {(images.length > 0 || hasVideo || hasFile || hasPoll) && (
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {images.length > 0 && <MetaBadge icon={<Images className="w-3 h-3" />} label={`사진 ${images.length}`} />}
          {hasVideo && <MetaBadge icon={<Play className="w-3 h-3" />} label="동영상" />}
          {hasFile && <MetaBadge icon={<Paperclip className="w-3 h-3" />} label="첨부파일" />}
          {hasPoll && <MetaBadge icon={<Vote className="w-3 h-3" />} label="투표" />}
        </div>
      )}

      {/* 공감 / 댓글 */}
      <div className="flex items-center gap-2 mt-3.5">
        <button
          type="button"
          onClick={() => {
            if (isRestricted) {
              toast.info('비원아카데미 회원가입 후 공감하실 수 있습니다.');
              return;
            }
            onLike(post.id);
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black transition-all',
            post.is_liked
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'bg-white border-slate-150 text-slate-500 hover:bg-slate-50'
          )}
        >
          <Heart className={cn('w-3.5 h-3.5', post.is_liked && 'fill-rose-500 text-rose-500')} />
          <span className="font-mono">{post.likes_count || 0}</span>
        </button>

        {commentsAllowed ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-150 bg-white text-slate-500 text-[11px] font-black">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="font-mono">{post.comments_count || 0}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-150 bg-slate-50 text-slate-400 text-[11px] font-black">
            <Lock className="w-3 h-3" /> 댓글 사용 안 함
          </span>
        )}
      </div>
    </Card>
  );
}

function MetaBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-150 text-[10px] font-bold text-slate-500">
      {icon}
      {label}
    </span>
  );
}
