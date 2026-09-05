import React from 'react';
import { Post, Comment as CommunityComment } from '@/types';
import { PostCard } from './PostCard';
import { ThreadPost } from './ThreadPost';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { PostEditor } from './PostEditor';

interface PostListProps {
  posts: Post[];
  isLoading: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  postComments?: Record<string, CommunityComment[]>;
  onLike: (postId: string) => void;
  onCommentToggle: (postId: string) => void;
  onCommentSubmit: (postId: string, content: string) => Promise<void>;
  onJoinAttendance: (postId: string) => void;
  onToggleTodo: (postId: string, todoIndex: number, completed: boolean) => void;
  onVotePoll: (postId: string, optionIndex: number) => void;
  onTogglePin?: (postId: string, isPinned: boolean) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (post: Post) => void;
  accessibleCommunityIds?: Set<string>;
  /** true면 요약 카드 목록, false면 스레드 형태의 블록형 게시글 */
  isFeedMode?: boolean;
  allCommunities?: any[];
  onCardClick?: (post: Post) => void;
  editingPostId?: string | null;
  onEditCancel?: () => void;
  onEditSuccess?: (updatedPost: Post) => void;
}

export function PostList({ 
  posts, 
  isLoading, 
  currentUserId,
  isAdmin,
  postComments = {},
  onLike,
  onCommentToggle,
  onCommentSubmit,
  onJoinAttendance,
  onToggleTodo,
  onVotePoll,
  onTogglePin,
  onDelete,
  onEdit,
  accessibleCommunityIds,
  isFeedMode = false,
  allCommunities = [],
  onCardClick,
  editingPostId,
  onEditCancel,
  onEditSuccess
}: PostListProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-5 bg-white rounded-3xl space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-16 h-3" />
              </div>
            </div>
            <Skeleton className="w-full h-32 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
        <p className="text-gray-400 font-bold">아직 등록된 게시글이 없습니다.</p>
        <p className="text-xs text-gray-300 mt-1">첫 번째 소식을 전해보세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {posts.map((post, idx) => {
        const isEditing = editingPostId === post.id;
        const isRestricted = accessibleCommunityIds ? !accessibleCommunityIds.has(post.community_id) : false;
        const communityName = allCommunities?.find((c: any) => c.id === post.community_id)?.name;

        return (
          <motion.div
             key={post.id}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: Math.min(idx, 6) * 0.05 }}
          >
            {isEditing ? (
              <div className="my-4 p-5 bg-white rounded-3xl border border-slate-200 shadow-lg">
                <PostEditor
                  communityId={post.community_id}
                  initialPost={post}
                  onSuccess={(updatedPost) => {
                    onEditSuccess?.(updatedPost);
                  }}
                  onCancel={() => {
                    onEditCancel?.();
                  }}
                />
              </div>
            ) : isFeedMode ? (
              <PostCard 
                post={post}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                comments={postComments[post.id]}
                onLike={onLike}
                onCommentToggle={onCommentToggle}
                onCommentSubmit={onCommentSubmit}
                onJoinAttendance={onJoinAttendance}
                onToggleTodo={onToggleTodo}
                onVotePoll={onVotePoll}
                onDelete={onDelete}
                onEdit={onEdit}
                isRestricted={isRestricted}
                isFeedMode
                communityName={communityName}
                onCardClick={onCardClick}
              />
            ) : (
              <ThreadPost
                post={post}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                comments={postComments[post.id]}
                onLike={onLike}
                onCommentToggle={onCommentToggle}
                onCommentSubmit={onCommentSubmit}
                onTogglePin={onTogglePin}
                onJoinAttendance={onJoinAttendance}
                onToggleTodo={onToggleTodo}
                onVotePoll={onVotePoll}
                onDelete={onDelete}
                onEdit={onEdit}
                isRestricted={isRestricted}
                communityName={communityName}
                isLast={idx === posts.length - 1}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
