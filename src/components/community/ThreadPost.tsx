import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Lock,
  MessageSquare,
  MoreVertical,
  Pencil,
  Pin,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Post, Comment as CommunityComment } from '@/types';
import { PostBlocks } from './PostBlocks';
import { buildPostBlocks, isCommentingAllowed } from './postContent';

interface ThreadPostProps {
  post: Post;
  currentUserId?: string;
  isAdmin?: boolean;
  comments?: CommunityComment[];
  onLike: (postId: string) => void;
  onCommentToggle: (postId: string) => void;
  onCommentSubmit: (postId: string, content: string) => Promise<void>;
  onTogglePin?: (postId: string, isPinned: boolean) => void;
  onJoinAttendance: (postId: string) => void;
  onToggleTodo: (postId: string, todoIndex: number, completed: boolean) => void;
  onVotePoll: (postId: string, optionIndex: number) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (post: Post) => void;
  isRestricted?: boolean;
  communityName?: string;
  /** 스레드에서 마지막 글이면 세로 연결선을 그리지 않는다. */
  isLast?: boolean;
}

function displayName(profile?: { name?: string | null; nickname?: string | null } | null) {
  return profile?.nickname || profile?.name || '익명';
}

function relativeTime(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ko });
  } catch {
    return '방금 전';
  }
}

/**
 * 스레드 형태의 블록형 게시글.
 *
 * 왼쪽 아바타 레일과 세로 연결선으로 하나의 대화 흐름을 만들고,
 * 본문은 블록 단위로, 댓글은 같은 스레드에 이어지는 답글로 표시한다.
 */
export function ThreadPost({
  post,
  currentUserId,
  isAdmin,
  comments = [],
  onLike,
  onCommentToggle,
  onCommentSubmit,
  onTogglePin,
  onJoinAttendance,
  onToggleTodo,
  onVotePoll,
  onDelete,
  onEdit,
  isRestricted = false,
  communityName,
  isLast = false,
}: ThreadPostProps) {
  const navigate = useNavigate();
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const blocks = buildPostBlocks(post);
  const commentsAllowed = isCommentingAllowed(post);
  const author = displayName(post.profiles);
  const commentCount = post.comments_count || 0;

  const handleToggleReplies = () => {
    if (isRestricted) {
      toast.info('비원아카데미 회원가입 후 댓글 확인 및 작성이 가능합니다.');
      return;
    }
    const next = !showReplies;
    setShowReplies(next);
    if (next) onCommentToggle(post.id);
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCommentSubmit(post.id, replyText.trim());
      setReplyText('');
    } catch {
      toast.error('댓글 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?id=${post.community_id}&postId=${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: '비원아카데미 커뮤니티', text: post.title || '', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('게시글 주소가 클립보드에 복사되었습니다.');
      }
    } catch {
      /* 사용자가 공유를 취소한 경우 등은 무시 */
    }
  };

  const hasThreadLine = !isLast || showReplies || commentCount > 0;

  return (
    <article
      id={`thread-post-${post.id}`}
      className={cn(
        'relative flex gap-3 sm:gap-4 px-4 sm:px-5 py-5 bg-white border border-slate-150 rounded-2xl mb-3 text-left',
        post.is_pinned && 'border-purple-200 bg-purple-50/20'
      )}
    >
      {/* 왼쪽 아바타 레일 + 스레드 연결선 */}
      <div className="flex flex-col items-center shrink-0 w-10">
        <Avatar className="w-10 h-10 border border-slate-150 ring-2 ring-slate-50 shrink-0">
          <AvatarImage src={post.profiles?.avatar_url || ''} referrerPolicy="no-referrer" />
          <AvatarFallback className="bg-purple-600 text-white font-extrabold text-xs">
            {author.charAt(0)}
          </AvatarFallback>
        </Avatar>
        {hasThreadLine && <div className="w-px flex-1 mt-2 bg-slate-150" aria-hidden="true" />}
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* 헤더 */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-[14px] text-slate-900 truncate">{author}</span>
              <span className="text-slate-300 select-none">·</span>
              <span className="text-[11px] text-slate-400 font-semibold">{relativeTime(post.created_at)}</span>
              {post.is_pinned && (
                <Badge className="bg-purple-100 text-purple-700 border-none text-[9px] font-black px-1.5 py-0 rounded-md gap-0.5">
                  <Pin className="w-2.5 h-2.5" /> 공지
                </Badge>
              )}
              {communityName && (
                <Badge className="bg-slate-100 text-slate-600 border-none text-[9px] font-black px-1.5 py-0 rounded-md">
                  {communityName}
                </Badge>
              )}
              {!commentsAllowed && (
                <Badge className="bg-slate-100 text-slate-500 border-none text-[9px] font-black px-1.5 py-0 rounded-md gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> 댓글 잠김
                </Badge>
              )}
            </div>
            {post.title && (
              <h2 className="text-[15px] sm:text-base font-black text-slate-900 tracking-tight leading-snug mt-1.5">
                {post.title}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {onTogglePin && isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onTogglePin(post.id, !!post.is_pinned)}
                className={cn(
                  'h-8 w-8 rounded-lg',
                  post.is_pinned ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:text-slate-800'
                )}
                title={post.is_pinned ? '공지 해제' : '공지로 고정'}
              >
                <Pin className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-800"
              title="공유하기"
            >
              <Share2 className="w-3.5 h-3.5" />
            </Button>
            {(currentUserId === post.user_id || isAdmin) && (
              <Popover>
                <PopoverTrigger className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-800 flex items-center justify-center">
                  <MoreVertical className="w-3.5 h-3.5" />
                </PopoverTrigger>
                <PopoverContent className="w-28 p-1 rounded-xl shadow-lg border border-slate-200 bg-white" align="end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start gap-2 rounded-lg hover:bg-slate-50 text-slate-700 h-8 px-2 text-xs font-bold w-full"
                    onClick={() => onEdit?.(post)}
                  >
                    <Pencil className="w-3 h-3 text-slate-400" /> 수정
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start gap-2 rounded-lg hover:bg-red-50 text-red-600 h-8 px-2 text-xs font-bold w-full"
                    onClick={() => onDelete?.(post.id)}
                  >
                    <Trash2 className="w-3 h-3 text-red-400" /> 삭제
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </header>

        {/* 본문 블록 */}
        {isRestricted ? (
          <RestrictedNotice onRegister={() => navigate('/auth/register')} onLogin={() => navigate('/auth/login')} />
        ) : (
          <PostBlocks
            blocks={blocks}
            post={post}
            onJoinAttendance={onJoinAttendance}
            onToggleTodo={onToggleTodo}
            onVotePoll={onVotePoll}
          />
        )}

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.map(tag => (
              <span key={tag} className="text-[11px] font-bold text-blue-600">#{tag}</span>
            ))}
          </div>
        )}

        {/* 액션 바 */}
        <div className="flex items-center gap-1.5 pt-1">
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
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
          >
            <Heart className={cn('w-3.5 h-3.5', post.is_liked && 'fill-rose-500 text-rose-500')} />
            <span className="font-mono">{post.likes_count || 0}</span>
          </button>

          {commentsAllowed ? (
            <button
              type="button"
              onClick={handleToggleReplies}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black transition-all',
                showReplies
                  ? 'bg-slate-100 border-slate-300 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="font-mono">{commentCount}</span>
              <span className="font-bold">답글</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-150 bg-slate-50 text-[11px] font-black text-slate-400">
              <Lock className="w-3 h-3" /> 댓글 사용 안 함
            </span>
          )}

          <span className="ml-auto text-[10px] text-slate-400 font-bold font-mono">조회 {post.views || 0}</span>
        </div>

        {/* 스레드 답글 */}
        {commentsAllowed && showReplies && !isRestricted && (
          <div className="pt-2 space-y-3">
            {comments.length > 0 ? (
              <ul className="space-y-3">
                {comments.map(comment => (
                  <li key={comment.id} className="relative flex gap-2.5 pl-3 border-l-2 border-slate-100">
                    <Avatar className="w-7 h-7 shrink-0 border border-slate-150">
                      <AvatarImage src={comment.profiles?.avatar_url || ''} referrerPolicy="no-referrer" />
                      <AvatarFallback className="text-[9px] font-black bg-slate-200 text-slate-700">
                        {displayName(comment.profiles).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[12px] text-slate-800 truncate">
                          {displayName(comment.profiles)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {relativeTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                        {comment.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400 font-bold pl-3 border-l-2 border-slate-100 py-2">
                첫 번째 답글을 남겨보세요.
              </p>
            )}

            <div className="flex gap-2 pl-3">
              <Input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReplySubmit();
                  }
                }}
                placeholder="이 스레드에 답글 남기기..."
                className="h-9 rounded-xl border-slate-200 text-xs bg-white"
              />
              <Button
                type="button"
                onClick={handleReplySubmit}
                disabled={isSubmitting || !replyText.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 px-3 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function RestrictedNotice({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-150 bg-slate-50/60 p-5 text-center space-y-3">
      <h4 className="text-sm font-black text-slate-900 leading-snug">
        비원아카데미 커뮤니티에 가입하시면<br />더 많은 정보와 소통을 하실 수 있습니다.
      </h4>
      <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
        학사일정 달력, 회원 네트워킹 라운지, 정규 코스 과제 참여, 1:1 학습 멘토 서비스 등을 이용해 보세요.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
        <Button
          onClick={onRegister}
          className="px-6 h-10 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl"
        >
          비원아카데미 가입하기 ➔
        </Button>
        <Button
          variant="outline"
          onClick={onLogin}
          className="px-6 h-10 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
        >
          로그인하기
        </Button>
      </div>
    </div>
  );
}
