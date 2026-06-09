import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Post, Comment as CommunityComment } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  MoreVertical, 
  Pin, 
  CalendarCheck, 
  ListTodo, 
  Vote, 
  Link as LinkIcon,
  Play,
  FileText,
  Plus,
  Send,
  Pencil,
  Trash2,
  Paperclip,
  Star,
  ChevronDown,
  ChevronUp,
  Download,
  Mail,
  User,
  CornerDownRight
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface PostCardProps {
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
  isFeedMode?: boolean;
  communityName?: string;
  onCardClick?: (post: Post) => void;
}

const getCategoryStyle = (name: string) => {
  const norm = (name || '').trim();
  if (norm.includes('자유')) {
    return 'bg-purple-50 text-purple-650 border-purple-150';
  }
  if (norm.includes('공지') || norm.includes('알림') || norm.includes('pinned')) {
    return 'bg-red-50 text-red-650 border-red-150';
  }
  if (norm.includes('질문') || norm.includes('Q&A') || norm.includes('큐앤에이') || norm.includes('도움')) {
    return 'bg-sky-50 text-sky-650 border-sky-150';
  }
  if (norm.includes('정보') || norm.includes('팁') || norm.includes('자료')) {
    return 'bg-amber-50 text-amber-700 border-amber-150';
  }
  if (norm.includes('보컬') || norm.includes('작곡') || norm.includes('음악') || norm.includes('피드백')) {
    return 'bg-indigo-50 text-indigo-650 border-indigo-150';
  }
  if (norm.includes('인증') || norm.includes('챌린지') || norm.includes('미션') || norm.includes('기록') || norm.includes('출석')) {
    return 'bg-emerald-50 text-emerald-650 border-emerald-150';
  }
  // beautiful default violet
  return 'bg-violet-50 text-violet-650 border-violet-150';
};

export function PostCard({ 
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
  isFeedMode = false,
  communityName,
  onCardClick
}: PostCardProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Parse content_json safely
  let parsedContent = post.content_json;
  if (typeof parsedContent === 'string') {
    try {
      parsedContent = JSON.parse(parsedContent);
    } catch (e) {
      console.error('Failed to parse content_json in PostCard:', e);
      parsedContent = null;
    }
  }
  const content = parsedContent || { text: post.content, media: [], link: null, widget: null };
  const widget = content?.widget || null;

  const renderExcerptWithHashtags = (htmlStr: string, rawText: string) => {
    const text = htmlStr 
      ? htmlStr.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() 
      : (rawText || '');
    
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, index) => {
      if (token.startsWith('#') && token.length > 1) {
        return (
          <span key={index} className="text-blue-600 font-extrabold text-[14.5px] sm:text-[15.5px]">
            {token}
          </span>
        );
      }
      return token;
    });
  };

  // Gmail-style Date format helper
  const getGmailDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      
      if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
      }
      
      return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
    } catch (e) {
      return '날짜 오류';
    }
  };

  // Safe cleaner of HTML tags for producing text summary preview in a row
  const getTextPreview = (htmlStr: string, rawText: string) => {
    const combinedStr = htmlStr || rawText || '';
    const clean = combinedStr
      .replace(/<[^>]*>/g, ' ') // erase tags
      .replace(/\s+/g, ' ')     // replace multiple spaces
      .trim();
    return clean.substring(0, 120);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?id=${post.community_id}&postId=${post.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '비원아카데미 커뮤니티',
          text: post.title || post.content.substring(0, 100),
          url: url
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('게시글 주소가 클립보드에 복사되었습니다.');
      } catch (error) {
        console.error('Clipboard error:', error);
        toast.error('주소 복사에 실패했습니다.');
      }
    }
  };

  const handleCommentToggle = () => {
    const nextState = !showComments;
    setShowComments(nextState);
    if (nextState) {
      onCommentToggle(post.id);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await onCommentSubmit(post.id, commentText);
      setCommentText('');
      toast.success('댓글이 등록되었습니다.');
    } catch (error) {
      toast.error('댓글 등록에 실패했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const hasAttachment = (post.image_urls && post.image_urls.length > 0) || 
                      (post.file_urls && post.file_urls.length > 0) || 
                      (content.link);

  if (isFeedMode) {
    let relativeTime = '';
    try {
      relativeTime = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ko });
    } catch (e) {
      relativeTime = '방금 전';
    }

    // Prepare plain-text clean representation for safer line clamping
    const plainContent = content?.text || post.content || '';
    const cleanBodyText = typeof plainContent === 'string'
      ? plainContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    return (
      <Card 
        id={`feed-post-${post.id}`}
        className={cn(
          "w-full bg-white rounded-xl border border-slate-150 transition-all flex flex-col p-5 sm:p-6 mb-4 text-left relative overflow-hidden select-none shadow-none",
          post.is_pinned && "border-purple-250 bg-purple-50/5"
        )}
      >
        {/* 1. Header: User profile & Category title & popover controls */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Avatar className="w-10 h-10 border border-slate-105 shrink-0 ring-2 ring-slate-50">
              <AvatarImage src={post.profiles?.avatar_url || ''} />
              <AvatarFallback className="bg-purple-600 text-white font-extrabold text-xs flex items-center justify-center">
                {(post.profiles?.nickname || post.profiles?.name || '?').charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex flex-col leading-tight">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-[14px] sm:text-[14.5px] text-slate-900 truncate">
                  {post.profiles?.nickname || post.profiles?.name || '익명'}
                </span>
                {post.is_pinned && (
                  <Badge variant="secondary" className="bg-blue-55 text-blue-600 inline-flex items-center gap-0.5 text-[9px] font-black border border-blue-100 py-0 px-1.5 rounded-md shrink-0 scale-90 select-none">
                    공지
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1 font-mono">
                {relativeTime}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 select-none" onClick={(e) => e.stopPropagation()}>
            <span className="bg-purple-600 text-white font-extrabold text-[11px] px-3 py-1 rounded-full tracking-tight">
              {communityName || '자유'}
            </span>
          </div>
        </div>

        {/* 2. Title & Partially truncated body text */}
        <div 
          className="cursor-pointer group select-text mt-3 text-left" 
          onClick={() => onCardClick?.(post)}
        >
          {/* Post Title */}
          <h3 className="text-base sm:text-md font-black text-slate-900 tracking-tight leading-snug group-hover:text-purple-705 transition-colors">
            {post.title || (cleanBodyText ? cleanBodyText.substring(0, 35) + '...' : '새로운 이야기')}
          </h3>

          {/* clamped content description */}
          {cleanBodyText && (
            <p className="text-[12px] sm:text-[13px] text-slate-600 font-medium leading-relaxed mt-2 line-clamp-3 select-text">
              {cleanBodyText}
            </p>
          )}
        </div>

        {/* 4. Action badges: Pill like count & comment count */}
        <div className="flex items-center gap-2 mt-4 select-none" onClick={(e) => e.stopPropagation()}>
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
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11px] font-black tracking-tight transition-all hover:bg-slate-50/50 cursor-pointer",
              post.is_liked 
                ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100/30" 
                : "bg-white border-slate-150 text-slate-500"
            )}
          >
            <span className="scale-105">❤️</span>
            <span className="font-mono">{post.likes_count || 0}</span>
          </button>

          <div
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-150 bg-white text-slate-500 text-[11px] font-black tracking-tight"
          >
            <span className="scale-105">💬</span>
            <span className="font-mono">{post.comments_count || 0}</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl border border-slate-150 transition-all flex flex-col p-4 md:p-6 mb-4 space-y-4 shadow-none">
      
      {/* 1. Header block */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 border border-slate-200 mt-0.5 shrink-0 ring-2 ring-slate-50">
            <AvatarImage src={post.profiles?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-700 font-extrabold text-xs">
              {(post.profiles?.nickname || post.profiles?.name || '?').charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                {post.title || '제목 없음'}
              </h2>
              {post.is_pinned && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 gap-1 text-xs font-black border border-blue-100 py-0.5 px-2 rounded-xl w-auto flex items-center shrink-0">
                  <Pin className="w-3 h-3 fill-blue-500 mr-1" /> 고정됨
                </Badge>
              )}
            </div>

            <div className="text-xs sm:text-[13px] text-slate-600 font-semibold space-x-2 flex flex-wrap items-center mt-2 leading-none">
              <span className="font-black text-slate-800">{post.profiles?.nickname || post.profiles?.name || '알 수 없음'}</span>
              <span className="text-slate-300 select-none">•</span>
              <span className="text-xs font-mono select-none text-slate-500">{new Date(post.created_at).toLocaleString('ko-KR')}</span>
              <span className="text-slate-300 select-none">•</span>
              <span className="bg-slate-100 text-slate-600 font-black px-2 py-1 rounded-lg text-xs select-none text-center">조회수 {post.views || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onTogglePin && isAdmin && (
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              onClick={() => onTogglePin(post.id, !!post.is_pinned)}
              className={cn(
                "h-8 w-8 rounded-lg",
                post.is_pinned ? "bg-blue-50 text-blue-600 border border-blue-105" : "text-slate-400 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              <Pin className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button 
            type="button"
            variant="ghost" 
            size="icon" 
            onClick={handleShare}
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-50"
          >
            <Share2 className="w-3.5 h-3.5" />
          </Button>

          {(currentUserId === post.user_id || isAdmin) && (
            <Popover>
              <PopoverTrigger className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center">
                <MoreVertical className="w-3.5 h-3.5" />
              </PopoverTrigger>
              <PopoverContent className="w-28 p-1 rounded-xl shadow-lg border border-slate-200 bg-white" align="end">
                <div className="grid grid-cols-1 gap-0.5">
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="justify-start gap-2 rounded-lg hover:bg-slate-50 text-slate-700 h-8 px-2 text-xs font-bold w-full"
                    onClick={() => onEdit?.(post)}
                  >
                    <Pencil className="w-3 h-3 text-slate-400" />
                    수정
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="justify-start gap-2 rounded-lg hover:bg-red-50 text-red-600 h-8 px-2 text-xs font-bold w-full"
                    onClick={() => {
                      if (onDelete) onDelete(post.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                    삭제
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* 2. Body content rendering inside white paper frame */}
      {isRestricted ? (
        <div className="relative overflow-hidden rounded-2xl bg-slate-50/5 p-4 md:p-6 border border-slate-100 shadow-inner select-none mt-2">
          {/* Blurred background preview to show a visual text shape */}
          <div className="relative max-h-32 overflow-hidden select-none pointer-events-none filter blur-[5px] opacity-40 select-none">
            <div 
              className="prose prose-slate max-w-none text-sm text-slate-800 leading-relaxed font-sans"
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(content?.html || post.content || '', {
                  ADD_TAGS: ['iframe', 'span', 'img', 'video', 'blockquote', 'pre', 'code', 'mark'],
                  ADD_ATTR: ['src', 'alt', 'style', 'class', 'href', 'target', 'rel', 'data-type', 'controls', 'height', 'width']
                }) 
              }}
            />
            {post.image_urls && post.image_urls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2 select-none">
                {post.image_urls.slice(0, 3).map((url, idx) => (
                  <div key={idx} className="aspect-video rounded bg-slate-200 select-none" />
                ))}
              </div>
            )}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-white/70 flex flex-col items-center justify-center p-5 text-center">
            <div className="max-w-md mx-auto space-y-3.5">
              <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                비원아카데미 커뮤니티에 가입하시면<br />
                더 많은 정보와 소통을 하실 수 있습니다.
              </h4>
              <p className="text-xs text-slate-500 font-bold leading-relaxed px-2">
                학사일정 달력, 회원 네트워킹 라운지, 정규 코스 수집 과제 참여, 1:1 학습 멘토 서비스 등을 마음껏 이용해 보세요.
              </p>
              
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center items-center w-full">
                <Button
                  onClick={() => navigate('/auth/register')}
                  className="w-full sm:w-auto px-6 h-10 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 border-none cursor-pointer"
                >
                  비원아카데미 가입하기 ➔
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/auth/login')}
                  className="w-full sm:w-auto px-6 h-10 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  로그인하기
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="py-1.5 leading-normal select-text break-words">
            <div 
              className={cn(
                "prose prose-slate max-w-none focus:outline-none text-[12px] sm:text-[14px] text-slate-800 leading-relaxed font-sans select-text break-words",
                "prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-headings:mt-3 prose-headings:mb-1.5",
                "prose-h1:text-[20px] prose-h1:font-black",
                "prose-h2:text-[18px] prose-h2:font-extrabold",
                "prose-h3:text-[16px] prose-h3:font-bold",
                "prose-p:text-[12px] sm:prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-slate-705 prose-p:my-2 prose-p:break-all",
                "prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-2.5 prose-blockquote:text-slate-500",
                "prose-code:text-red-500 prose-code:bg-slate-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs",
                "prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:p-4 prose-pre:my-2.5 prose-pre:font-mono prose-pre:text-sm",
                "prose-ul:list-disc prose-ul:pl-5 prose-ul:my-2",
                "prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-2",
                "prose-li:my-1 prose-li:text-slate-705",
                "prose-img:rounded-xl prose-img:my-3 prose-img:max-w-full prose-img:h-auto prose-img:inline-block prose-img:border-none shadow-none"
              )}
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(content?.html || post.content || '', {
                  ADD_TAGS: ['iframe', 'span', 'img', 'video', 'blockquote', 'pre', 'code', 'mark'],
                  ADD_ATTR: ['src', 'alt', 'style', 'class', 'href', 'target', 'rel', 'data-type', 'controls', 'height', 'width']
                }) 
              }}
            />

            {post.hashtags && post.hashtags.length > 0 && (
               <div className="flex flex-wrap gap-1.5 mt-3 pt-2">
                  {post.hashtags.map(tag => (
                     <span key={tag} className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">#{tag}</span>
                  ))}
               </div>
            )}
          </div>

          {/* 3. Media & Inline Attachments display */}
          {((post.image_urls && post.image_urls.length > 0) || (post.file_urls && post.file_urls.length > 0) || content?.link) && (
            <hr className="border-t border-slate-100 my-4" />
          )}
          <div className="space-y-4">
            {/* Attachments inside paper cards */}
            {(post.image_urls && post.image_urls.length > 0) && (
              <div className="space-y-1.5">
                 <h5 className="text-[10.5px] font-black text-slate-400 tracking-wider block select-none uppercase">📷 첨부 이미지</h5>
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                   {post.image_urls.map((url, idx) => (
                      <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-white group shadow-none">
                         <img src={url} alt="raw media" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                         <a 
                           href={url} 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-white z-10"
                         >
                            <div className="bg-black/60 px-2.5 py-1.5 rounded-md border border-white/10 text-[9.5px] font-bold tracking-tight hover:bg-black/80 transition-colors">
                              원본 다운로드
                            </div>
                         </a>
                      </div>
                   ))}
                 </div>
              </div>
            )}

            {post.file_urls && post.file_urls.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="text-[10.5px] font-black text-slate-400 tracking-wider block select-none uppercase">💾 첨부파일 ({post.file_urls.length}개)</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {post.file_urls.map((url, idx) => {
                    const fileName = url.split('/').pop()?.split('?')[0] || '첨부파일';
                    const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg)$/);

                    if (isVideo) {
                      return (
                        <div key={idx} className="rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video relative group">
                          <video src={url} className="w-full h-full" controls />
                        </div>
                      );
                    }

                    return (
                      <a 
                        key={idx} 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-all shadow-none group"
                      >
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-700 truncate">{decodeURIComponent(fileName)}</p>
                          <p className="text-[9px] text-slate-400 font-medium">첨부 문서</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-7.5 w-7.5 text-slate-400 hover:text-slate-850 shrink-0">
                          <Download className="w-3 h-3" />
                        </Button>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {content.link && (
               <div className="space-y-1.5">
                 <h5 className="text-[10.5px] font-black text-slate-400 tracking-wider block select-none uppercase">🔗 연결 정보 카드</h5>
                 <a 
                   href={content.link.url} 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   className="bg-slate-50/50 rounded-xl p-3 border border-slate-200 flex gap-3.5 cursor-pointer hover:bg-slate-50 hover:border-slate-350 transition-all shadow-none block"
                 >
                    {content.link.image && (
                       <img src={content.link.image} alt="preview" className="w-13 h-13 rounded-lg object-cover shrink-0 border border-slate-100 bg-white" referrerPolicy="no-referrer" />
                    )}
                    <div className="flex-1 min-w-0 relative mt-0.5">
                      <h4 className="text-xs font-black text-slate-900 truncate pr-4">{content.link.title}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{content.link.description}</p>
                      <div className="flex items-center gap-1 mt-1 text-blue-500">
                         <LinkIcon className="w-3 h-3" />
                         <span className="text-[9.5px] font-mono truncate max-w-sm">{content.link.url}</span>
                      </div>
                    </div>
                 </a>
               </div>
            )}

            {/* Embeddable Widgets area */}
            {widget && (
              <div className="pt-2 border-t border-slate-100">
                {widget.type === 'attendance' && (
                  <div className="bg-orange-50/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                     <div className="flex items-center gap-2.5">
                       <div className="w-8.5 h-8.5 bg-white border border-orange-200 rounded-lg flex items-center justify-center shrink-0 shadow-xs">
                          <CalendarCheck className="w-4.5 h-4.5 text-orange-500" />
                       </div>
                       <div>
                          <h4 className="text-xs font-black text-slate-900">{widget.data.title}</h4>
                          <p className="text-[10.5px] text-slate-500 font-medium">오늘 비원아카데미 출석 수첩에 도장을 등록하세요!</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                        <span className="text-[9.5px] text-orange-600 font-bold bg-orange-100/50 px-2 py-0.5 rounded-md">수집: {post.attendance_count || 0}명</span>
                        <Button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onJoinAttendance(post.id); }}
                          disabled={post.has_attended}
                          size="sm"
                          className={cn(
                            "font-bold rounded-lg h-8 px-3.5 text-xs shadow-xs",
                            post.has_attended 
                              ? "bg-slate-100 text-slate-400 border border-slate-300/40 cursor-not-allowed" 
                              : "bg-orange-500 hover:bg-orange-600 text-white"
                          )}
                        >
                          {post.has_attended ? '출석 완료됨' : '출석 체크'}
                        </Button>
                     </div>
                  </div>
                )}

                {widget.type === 'todo' && (
                  <div className="bg-blue-50/20 rounded-xl p-4">
                     <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7.5 h-7.5 bg-white border border-blue-200 rounded-lg flex items-center justify-center shadow-xs">
                           <ListTodo className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <h5 className="text-xs font-black text-slate-900">{widget.data.title}</h5>
                     </div>
                     <div className="grid grid-cols-1 gap-1.5">
                        {widget.data.items.map((todo: string, idx: number) => {
                           const isChecked = post.user_todo_checks?.includes(idx);
                           const checkCount = post.todo_checks?.filter((c: any) => c.todo_index === idx).length || 0;
                           return (
                             <div 
                               key={idx} 
                               onClick={(e) => { e.stopPropagation(); onToggleTodo(post.id, idx, !isChecked); }}
                               className={cn(
                                  "flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer text-xs",
                                  isChecked 
                                    ? "bg-blue-50/50 border-blue-200 text-blue-800" 
                                    : "bg-white border-blue-105 text-slate-700 hover:bg-slate-50/50"
                               )}
                             >
                               <div className="flex items-center gap-2 border-none">
                                 <div className={cn(
                                   "w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0",
                                   isChecked ? "bg-blue-500 border-blue-500" : "border-slate-300 bg-white"
                                 )}>
                                   {isChecked && <Plus className="w-3 h-3 text-white" />}
                                 </div>
                                 <span className={cn(
                                   "font-bold text-[11px]",
                                   isChecked ? "line-through text-slate-450" : ""
                                 )}>{todo}</span>
                               </div>
                               <span className="text-[9.5px] text-blue-500 font-extrabold">{checkCount}명 완료</span>
                             </div>
                           );
                        })}
                     </div>
                  </div>
                )}

                {widget.type === 'poll' && (
                  <div className="bg-purple-50/20 rounded-xl p-4">
                     <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7.5 h-7.5 bg-white border border-purple-200 rounded-lg flex items-center justify-center shadow-xs">
                           <Vote className="w-3.5 h-3.5 text-purple-500" />
                        </div>
                        <h5 className="text-xs font-black text-slate-900">{widget.data.question}</h5>
                     </div>
                     <div className="space-y-1.5">
                        {widget.data.options.map((option: string, idx: number) => {
                           const totalVotes = post.poll_votes?.length || 0;
                           const optionVotes = post.poll_votes?.filter((v: any) => v.option_index === idx).length || 0;
                           const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                           const isSelected = post.user_poll_vote === idx;
                           return (
                             <button 
                               type="button"
                               key={idx} 
                               onClick={(e) => { e.stopPropagation(); onVotePoll(post.id, idx); }}
                               disabled={post.user_poll_vote !== null && !isSelected}
                               className={cn(
                                 "w-full flex items-center justify-between p-2 rounded-lg border transition-all text-[11px] font-bold relative overflow-hidden text-left",
                                 isSelected 
                                   ? "bg-purple-50 border-purple-250 text-purple-950" 
                                   : "bg-white border-slate-200 text-slate-700 hover:border-purple-200",
                                 post.user_poll_vote !== null && !isSelected && "opacity-60 cursor-not-allowed"
                               )}
                             >
                               <div 
                                 className="absolute left-0 top-0 bottom-0 bg-purple-500/5 transition-all duration-700" 
                                 style={{ width: `${percentage}%` }}
                               />
                               <span className="relative z-10">{option}</span>
                               <span className="relative z-10 text-[9.5px] text-purple-500 font-black">{percentage}% ({optionVotes}표)</span>
                             </button>
                           );
                        })}
                     </div>
                     <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-purple-500 font-bold">
                        <span>피드백 설문조사 집계</span>
                        <span>총 {post.poll_votes?.length || 0}명 참여</span>
                     </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 4. Row interaction metrics */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-105">
        <div className="flex items-center gap-1.5">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (isRestricted) {
                toast.info('비원아카데미 회원가입 후 공감하실 수 있습니다.');
                return;
              }
              onLike(post.id);
            }}
            className={cn(
              "rounded-lg gap-1.5 font-bold text-xs h-8 px-3 transition-all",
              post.is_liked ? "text-pink-600 bg-pink-50 border-pink-250" : "text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", post.is_liked && "fill-pink-500 text-pink-500")} />
            공감 {post.likes_count || 0}
          </Button>
          
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (isRestricted) {
                toast.info('비원아카데미 회원가입 후 댓글 확인 및 작성이 가능합니다.');
                return;
              }
              handleCommentToggle();
            }}
            className={cn(
              "rounded-lg gap-1.5 font-bold text-xs h-8 px-3 transition-all",
              showComments && !isRestricted ? "bg-slate-100 text-slate-900 border-slate-300" : "text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            댓글 {post.comments_count || 0}
          </Button>
        </div>
      </div>

      {/* 5. Reply / Comments block rendering */}
      {showComments && !isRestricted && (
        <div className="bg-slate-50/60 rounded-xl p-3.5 border border-slate-150 mt-1.5 space-y-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs select-none pl-1">
            <span>댓글</span>
          </div>

          {/* Comment list rendering */}
          {comments.length > 0 ? (
            <div className="space-y-2.5 pl-3.5 border-l border-slate-200 select-text">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 text-xs">
                  <Avatar className="w-5.5 h-5.5 shrink-0 border border-slate-200 ring-1 ring-slate-50">
                    <AvatarImage src={comment.profiles?.avatar_url || ''} />
                    <AvatarFallback className="text-[8px] font-black bg-slate-200 text-slate-700">
                      {(comment.profiles?.nickname || comment.profiles?.name || '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-white rounded-lg p-2 border border-slate-150 shadow-xs">
                     <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-slate-800 tracking-tight text-[11px]">{comment.profiles?.nickname || comment.profiles?.name || '알 수 없음'}</span>
                        <span className="text-[8.5px] text-slate-400 font-mono">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ko })}</span>
                     </div>
                     <p className="text-[11.5px] text-slate-700 leading-normal whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-3 bg-white/45 rounded-lg border border-dashed border-slate-200">
              <p className="text-[10px] text-slate-400 font-medium">작성된 댓글이 없습니다.</p>
            </div>
          )}

          {/* Add comment input */}
          <div className="flex gap-2 pl-3.5">
            <Avatar className="w-5.5 h-5.5 shrink-0 border border-slate-200">
              <AvatarFallback className="bg-slate-800 text-white font-black text-[8px]">ME</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-1.5">
              <Input 
                placeholder="댓글을 입력해주세요." 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCommentSubmit();
                  }
                }}
                className="h-8 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 placeholder-slate-400"
              />
              <Button 
                type="button"
                onClick={handleCommentSubmit}
                disabled={isSubmittingComment || !commentText.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] px-2.5 rounded-lg h-8 shadow-xs gap-1 shrink-0"
              >
                <Send className="w-3 h-3" />
                전송
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
