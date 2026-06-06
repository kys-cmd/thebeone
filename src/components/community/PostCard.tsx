import React, { useState } from 'react';
import { Post, Comment as CommunityComment } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
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
}

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
  onEdit
}: PostCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showComments, setShowComments] = useState(true);
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
    const fallback = rawText || '';
    if (!htmlStr) return fallback.substring(0, 120);
    
    const clean = htmlStr
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

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-350 md:hover:shadow-sm transition-all flex flex-col p-4 md:p-6 mb-4 space-y-4">
      
      {/* 1. Header block */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
        <div className="flex items-start gap-3">
          {/* Important star (Gmail Star tied to Like) */}
          <button 
            type="button"
            onClick={() => onLike(post.id)}
            className="text-slate-300 hover:text-yellow-500 hover:scale-115 transition-all p-1 rounded hover:bg-slate-50 mt-1 shrink-0"
            title="중요 표시"
          >
            <Star className={cn("w-4.5 h-4.5", post.is_liked ? "fill-yellow-450 text-yellow-500" : "text-slate-300")} />
          </button>

          <Avatar className="w-10 h-10 border border-slate-200 mt-0.5 shrink-0 ring-2 ring-slate-50">
            <AvatarImage src={post.profiles?.avatar_url || ''} />
            <AvatarFallback className="bg-slate-100 text-slate-700 font-extrabold text-xs">
              {(post.profiles?.nickname || post.profiles?.name || '?').charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                {post.title || '제목 없음'}
              </h2>
              {post.is_pinned && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 gap-1 text-[10px] font-bold border border-blue-100 py-0 px-1.5 rounded w-auto flex items-center shrink-0">
                  <Pin className="w-2.5 h-2.5 fill-blue-500 mr-1" /> 고정됨
                </Badge>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-medium space-x-1.5 flex flex-wrap items-center mt-1 leading-none">
              <span className="font-extrabold text-slate-800">{post.profiles?.nickname || post.profiles?.name || '알 수 없음'}</span>
              <span className="text-slate-350 select-none">&lt;{(post.profiles?.nickname || 'user').toLowerCase()}@academy.internal&gt;</span>
              <span className="text-slate-300 select-none">•</span>
              <span className="text-[10px] font-mono select-none">{new Date(post.created_at).toLocaleString('ko-KR')}</span>
              <span className="text-slate-300 select-none">•</span>
              <span className="bg-slate-50 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[9.5px] select-none text-center">조회수 {post.views || 0}</span>
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
      <div className="bg-slate-50/20 rounded-xl p-1 md:p-2 leading-normal select-text break-words">
        <div 
          className={cn(
            "prose prose-sm prose-slate max-w-none focus:outline-none text-[13.5px] text-slate-800 leading-normal font-sans select-text break-words",
            "prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-headings:mt-2.5 prose-headings:mb-1",
            "prose-h1:text-xl prose-h1:font-extrabold",
            "prose-h2:text-lg prose-h2:font-bold",
            "prose-h3:text-base prose-h3:font-semibold",
            "prose-p:text-[13px] prose-p:leading-normal prose-p:text-slate-700 prose-p:my-1.5 prose-p:break-all",
            "prose-blockquote:border-l-4 prose-blockquote:border-slate-350 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:my-1.5 prose-blockquote:text-slate-500",
            "prose-code:text-red-500 prose-code:bg-slate-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs",
            "prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-md prose-pre:p-3 prose-pre:my-1.5 prose-pre:font-mono prose-pre:text-xs",
            "prose-ul:list-disc prose-ul:pl-4 prose-ul:my-1.5",
            "prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-1.5",
            "prose-li:my-0.5 prose-li:text-slate-700",
            "prose-img:rounded-md prose-img:my-2 prose-img:max-w-full prose-img:h-auto prose-img:inline-block border border-slate-200 shadow-sm"
          )}
          dangerouslySetInnerHTML={{ __html: content?.html || (post.content ? post.content.replace(/\n/g, '<br />') : '') }}
        />

        {post.hashtags && post.hashtags.length > 0 && (
           <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-105">
              {post.hashtags.map(tag => (
                 <span key={tag} className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">#{tag}</span>
              ))}
           </div>
        )}
      </div>

      {/* 3. Media & Inline Attachments display */}
      <div className="space-y-4">
        {/* Attachments inside paper cards */}
        {(post.image_urls && post.image_urls.length > 0) && (
          <div className="space-y-1.5">
             <h5 className="text-[10.5px] font-black text-slate-400 tracking-wider block select-none uppercase">📷 첨부 이미지</h5>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
               {post.image_urls.map((url, idx) => (
                  <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-white group shadow-xs">
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
                    className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-all shadow-xs group"
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
               className="bg-slate-50/50 rounded-xl p-3 border border-slate-200 flex gap-3.5 cursor-pointer hover:bg-slate-50 hover:border-slate-350 transition-all shadow-xs block"
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
              <div className="bg-orange-50/30 rounded-xl p-4 border border-orange-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
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
              <div className="bg-blue-50/20 rounded-xl p-4 border border-blue-200/50">
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
              <div className="bg-purple-50/20 rounded-xl p-4 border border-purple-200/50">
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

      {/* 4. Row interaction metrics */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-105">
        <div className="flex items-center gap-1.5">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={() => onLike(post.id)}
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
            onClick={handleCommentToggle}
            className={cn(
              "rounded-lg gap-1.5 font-bold text-xs h-8 px-3 transition-all",
              showComments ? "bg-slate-100 text-slate-900 border-slate-300" : "text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            댓글 {post.comments_count || 0}
          </Button>
        </div>
        
        <span className="text-[9.5px] text-slate-400 font-mono select-none">ID: {post.id.slice(0, 8).toUpperCase()}</span>
      </div>

      {/* 5. Reply / Comments block rendering */}
      {showComments && (
        <div className="bg-slate-50/60 rounded-xl p-3.5 border border-slate-150 mt-1.5 space-y-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs select-none pl-1">
            <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
            <span>댓글 릴레이 (Reply Thread)</span>
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
              <p className="text-[10px] text-slate-400 font-medium">작성된 답변이 없습니다. 첫 답변을 적어보세요.</p>
            </div>
          )}

          {/* Add comment input */}
          <div className="flex gap-2 pl-3.5">
            <Avatar className="w-5.5 h-5.5 shrink-0 border border-slate-200">
              <AvatarFallback className="bg-slate-800 text-white font-black text-[8px]">ME</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-1.5">
              <Input 
                placeholder="존중을 담은 유익한 덧글을 남겨주세요..." 
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
