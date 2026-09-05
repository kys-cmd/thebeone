import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PostEditor } from './PostEditor';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Post } from '@/types';

interface ThreadsComposerProps {
  user: any;
  communityId: string;
  isExpanded: boolean;
  onExpand: () => void;
  onCancel: () => void;
  onSuccess: (newPost: Post) => void;
  initialPost?: Post | null;
  canWrite?: boolean;
}

export function ThreadsComposer({
  user,
  communityId,
  isExpanded,
  onExpand,
  onCancel,
  onSuccess,
  initialPost,
  canWrite = true,
}: ThreadsComposerProps) {
  const navigate = useNavigate();

  if (!canWrite) {
    return (
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-extrabold">
        🔒 커뮤니티 스레드는 관리자만 작성할 수 있습니다. 답글로 참여해보세요.
      </div>
    );
  }

  if (isExpanded) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-md p-4 transition-all">
        <PostEditor
          communityId={communityId}
          key={initialPost ? 'with-data' : 'empty'}
          initialPost={initialPost}
          onCancel={onCancel}
          onSuccess={onSuccess}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (!user) {
          toast.info('로그인이 필요한 서비스입니다.');
          navigate('/auth/login');
          return;
        }
        onExpand();
      }}
      className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between gap-3 select-none text-left"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="w-9 h-9 border border-slate-150 shrink-0">
          <AvatarImage src={user?.avatar_url || ''} />
          <AvatarFallback className="bg-purple-600 text-white font-black text-xs">
            {(user?.nickname || user?.name || 'ME').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 text-slate-400 font-semibold text-xs sm:text-sm truncate">
          새로운 스레드를 시작하세요...
        </div>
      </div>

      <div className="flex items-center gap-2 text-slate-400 shrink-0">
        <span className="text-base" title="사진 추가">🖼️</span>
        <span className="text-base" title="투표">📊</span>
        <Button
          type="button"
          size="sm"
          className="h-7.5 px-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-none"
        >
          게시
        </Button>
      </div>
    </div>
  );
}
