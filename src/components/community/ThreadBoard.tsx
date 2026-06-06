import React, { useState } from 'react';
import { useCommunityBoard } from '@/hooks/useCommunityBoard';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, MessageSquare, Clock, User, X, Trash2, Send, 
  Sparkles, FileText, ChevronRight, CornerDownRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ThreadBoardProps {
  communityId: string;
  currentUserId?: string | null;
}

export function ThreadBoard({ communityId, currentUserId }: ThreadBoardProps) {
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  
  // Post inputs
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  
  // Reply input
  const [replyText, setReplyText] = useState('');

  const {
    posts,
    replies,
    postsLoading,
    repliesLoading,
    createPost,
    createReply,
    deletePost,
    deleteReply
  } = useCommunityBoard(communityId, activePostId || undefined);

  const selectedPost = posts.find(p => p.id === activePostId);

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) {
      toast.error('제목과 내용을 써주세요.');
      return;
    }

    const success = await createPost(postTitle, postContent);
    if (success) {
      setPostTitle('');
      setPostContent('');
      setIsCreatingPost(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activePostId) return;

    const success = await createReply(activePostId, replyText);
    if (success) {
      setReplyText('');
    }
  };

  const handleDeletePostClick = async (postId: string) => {
    if (window.confirm('정말로 이 스레드 게시글을 삭제하시겠습니까? 관련 댓글도 함께 삭제됩니다.')) {
      const success = await deletePost(postId);
      if (success && activePostId === postId) {
        setActivePostId(null);
      }
    }
  };

  const handleDeleteReplyClick = async (replyId: string) => {
    if (window.confirm('댓글을 삭제하시겠습니까?')) {
      await deleteReply(replyId);
    }
  };

  return (
    <div className="relative flex w-full h-full gap-5 overflow-hidden">
      {/* LEFT: Posts Grid / List Workspace */}
      <div className="flex-grow flex flex-col h-full overflow-hidden">
        {/* Board Top Action Row */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5 leading-none">
              <Sparkles className="w-4 h-4 text-purple-600" />
              스레드 토론 게시판
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">
              주제에 맞춰 새로운 게시글을 작성하고 우측 스레드에서 댓글 토론에 참가하세요.
            </p>
          </div>
          <Button 
            onClick={() => setIsCreatingPost(!isCreatingPost)}
            className="bg-purple-600 hover:bg-purple-700 font-extrabold text-xs text-white rounded-2xl h-10 px-4 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 스레드 작성
          </Button>
        </div>

        {/* Create Post Area (Inline Dropdown) */}
        {isCreatingPost && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-5 bg-white border border-slate-200/60 rounded-3xl shadow-sm shrink-0"
          >
            <form onSubmit={handlePostSubmit} className="space-y-3.5 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-700 tracking-wider uppercase mb-1.5">스레드 제목</label>
                <Input
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="제목을 입력하세요..."
                  className="h-11 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 tracking-wider uppercase mb-1.5">상세 내용</label>
                <Textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="의견이나 질문을 자세하게 공유해 보세요..."
                  rows={4}
                  className="rounded-xl text-xs font-semibold leading-relaxed"
                />
              </div>
              <div className="flex justify-end gap-2 shrink-0">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsCreatingPost(false)}
                  className="rounded-xl h-9 text-xs font-semibold border-slate-200 hover:bg-slate-50"
                >
                  취소
                </Button>
                <Button 
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 text-xs font-semibold"
                >
                  올리기
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Posts List Scroll Container */}
        <div className="flex-grow overflow-y-auto pr-1">
          {postsLoading ? (
            <div className="h-full flex items-center justify-center p-6 text-slate-400">
              <span className="w-5 h-5 rounded-full border-2 border-purple-600 border-t-transparent animate-spin mr-2" />
              게시글을 실시간으로 가져오는 중...
            </div>
          ) : posts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-slate-200 bg-slate-50 rounded-3xl text-slate-400 space-y-3.5">
              <div className="bg-slate-100 p-4 rounded-full text-slate-500">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-700">작성된 토론 스레드가 전혀 없습니다</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">우측 상단 '새 스레드 작성' 버튼을 눌러 스레드를 게시해 보세요!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                const authorProfile = post.profiles as any;
                const authorName = authorProfile?.nickname || authorProfile?.name || '알 수 없음';
                const avatar = authorProfile?.avatar_url;
                const isSelected = post.id === activePostId;

                return (
                  <div
                    key={post.id}
                    onClick={() => setActivePostId(post.id)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between h-auto gap-4 group ${
                      isSelected 
                        ? 'bg-purple-50/50 border-purple-300 ring-2 ring-purple-100' 
                        : 'bg-white border-slate-200/60 hover:border-purple-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-extrabold text-xs text-slate-800 tracking-tight group-hover:text-purple-700 transition-colors line-clamp-1">
                          {post.title}
                        </h4>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold leading-relaxed line-clamp-2">
                        {post.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-bold text-slate-500 shrink-0">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-5 h-5 border border-white shrink-0">
                          <AvatarImage src={avatar || undefined} referrerPolicy="no-referrer" />
                          <AvatarFallback className="bg-purple-100 text-purple-600 font-black text-[9px] uppercase">
                            {authorName.substring(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-slate-700 font-extrabold">{authorName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(post.created_at).toLocaleDateString('ko-KR', {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                          <MessageSquare className="w-3.5 h-3.5" />
                          스레드 보기
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Slide-In Side Panel (Replies Thread) */}
      <AnimatePresence>
        {activePostId && selectedPost && (
          <motion.div
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="w-96 min-w-[384px] max-w-full border-l border-slate-200/80 bg-white h-full shadow-lg rounded-l-3xl overflow-hidden flex flex-col z-10 shrink-0 text-left"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4.5 h-4.5 text-purple-600 animate-pulse" />
                <h3 className="font-extrabold text-xs text-slate-800">토론 스레드 답글</h3>
              </div>
              <button 
                onClick={() => setActivePostId(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable conversation thread */}
            <div className="flex-grow overflow-y-auto p-5 space-y-6">
              {/* Target Post content */}
              <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl relative">
                {selectedPost.user_id === currentUserId && (
                  <button
                    onClick={() => handleDeletePostClick(selectedPost.id)}
                    className="absolute top-3.5 right-3.5 p-1.5 rounded-full hover:bg-rose-50 border border-slate-100 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                
                <h4 className="font-extrabold text-xs text-slate-800 pr-8">{selectedPost.title}</h4>
                <p className="text-[11px] text-slate-600 font-semibold leading-relaxed mt-2.5 whitespace-pre-wrap">
                  {selectedPost.content}
                </p>

                <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-500 font-bold border-t border-slate-200/40 pt-3">
                  <Avatar className="w-5 h-5 border border-white shrink-0">
                    <AvatarImage src={(selectedPost.profiles as any)?.avatar_url || undefined} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-purple-100 text-purple-600 font-black text-[9px] uppercase">
                      {((selectedPost.profiles as any)?.nickname || (selectedPost.profiles as any)?.name || 'U').substring(0,1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-slate-800 font-extrabold">
                    {(selectedPost.profiles as any)?.nickname || (selectedPost.profiles as any)?.name || '알 수 없음'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-200" />
                  <span>
                    {new Date(selectedPost.created_at).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Replies feed */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 tracking-wider uppercase">답글 {replies.length}개</p>
                
                {repliesLoading ? (
                  <div className="text-center py-6 text-[11px] text-slate-400 font-bold">
                    실시간 답글 동기화 중...
                  </div>
                ) : replies.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-100 rounded-xl text-[11px] text-slate-400 font-bold">
                    아직 달린 답글이 없습니다. 첫 답변을 올려주세요!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {replies.map((rep) => {
                      const repProfile = rep.profiles as any;
                      const repName = repProfile?.nickname || repProfile?.name || '알 수 없음';
                      const repAvatar = repProfile?.avatar_url;

                      return (
                        <div key={rep.id} className="flex gap-2.5 items-start">
                          <CornerDownRight className="w-4 h-4 text-slate-300 mt-1 shrink-0" />
                          <div className="flex-grow bg-slate-50/50 hover:bg-slate-50 border border-slate-100 p-3 rounded-2xl relative text-left group">
                            {rep.user_id === currentUserId && (
                              <button
                                onClick={() => handleDeleteReplyClick(rep.id)}
                                className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                              >
                                <Trash2 className="w-3" />
                              </button>
                            )}
                            
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                              <Avatar className="w-4.5 h-4.5 border border-white shrink-0">
                                <AvatarImage src={repAvatar || undefined} referrerPolicy="no-referrer" />
                                <AvatarFallback className="bg-purple-100 text-purple-600 font-extrabold text-[8px] uppercase">
                                  {repName.substring(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-slate-800 font-extrabold">{repName}</span>
                              <span className="w-0.5 h-0.5 rounded-full bg-slate-200" />
                              <span>
                                {new Date(rep.created_at).toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700 font-semibold leading-relaxed mt-2 pl-6">
                              {rep.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Reply Input block */}
            <form onSubmit={handleReplySubmit} className="p-4 border-t border-slate-100 shrink-0">
              <div className="relative">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="댓글 답글 남기기..."
                  disabled={!currentUserId}
                  className="h-11 pl-4 pr-12 rounded-xl text-xs font-semibold"
                />
                <Button
                  type="submit"
                  disabled={!replyText.trim() || !currentUserId}
                  size="icon"
                  className="absolute right-1.5 top-1.5 w-8 h-8 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-300 rounded-lg"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              {!currentUserId && (
                <p className="text-[9px] font-black tracking-wider text-rose-500 mt-1 uppercase text-center">댓글을 쓰려면 먼저 로그인하세요.</p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
