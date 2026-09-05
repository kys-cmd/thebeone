import React from 'react';
import DOMPurify from 'dompurify';
import {
  CalendarCheck,
  Check,
  Download,
  FileText,
  Link as LinkIcon,
  ListTodo,
  Vote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { cn } from '@/lib/utils';
import { Post } from '@/types';
import { IMAGE_WIDTHS, getFileNameFromUrl, getOptimizedImageUrl } from '@/lib/image';
import { PostBlock } from './postContent';

const SANITIZE_CONFIG = {
  ADD_TAGS: ['iframe', 'span', 'img', 'video', 'source', 'blockquote', 'pre', 'code', 'mark'],
  ADD_ATTR: [
    'src', 'alt', 'style', 'class', 'href', 'target', 'rel',
    'data-type', 'data-id', 'data-label', 'controls', 'height', 'width', 'loading',
  ],
};

const RICHTEXT_CLASS = cn(
  'prose prose-slate max-w-none text-[13px] sm:text-[14px] text-slate-800 leading-relaxed font-sans break-words',
  'prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-headings:mt-3 prose-headings:mb-1.5',
  'prose-h1:text-[20px] prose-h1:font-black',
  'prose-h2:text-[18px] prose-h2:font-extrabold',
  'prose-h3:text-[16px] prose-h3:font-bold',
  'prose-p:leading-relaxed prose-p:my-2 prose-p:break-words',
  'prose-a:text-blue-600 prose-a:font-semibold',
  'prose-blockquote:border-l-4 prose-blockquote:border-purple-200 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-2.5 prose-blockquote:text-slate-500',
  'prose-code:text-rose-500 prose-code:bg-slate-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs',
  'prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:p-4 prose-pre:my-2.5 prose-pre:font-mono prose-pre:text-xs',
  'prose-ul:list-disc prose-ul:pl-5 prose-ul:my-2',
  'prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-2',
  'prose-li:my-1',
  'prose-img:rounded-xl prose-img:my-2 prose-img:max-w-full prose-img:h-auto'
);

interface PostBlocksProps {
  blocks: PostBlock[];
  post: Post;
  onJoinAttendance?: (postId: string) => void;
  onToggleTodo?: (postId: string, todoIndex: number, completed: boolean) => void;
  onVotePoll?: (postId: string, optionIndex: number) => void;
  /** 목록 요약 등 상호작용이 필요 없는 곳에서는 false */
  interactive?: boolean;
}

/** 블록 배열을 순서대로 렌더링한다. 각 블록은 독립된 시각 요소로 표시된다. */
export function PostBlocks({
  blocks,
  post,
  onJoinAttendance,
  onToggleTodo,
  onVotePoll,
  interactive = true,
}: PostBlocksProps) {
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => (
        <PostBlockView
          key={`${block.type}-${idx}`}
          block={block}
          post={post}
          onJoinAttendance={onJoinAttendance}
          onToggleTodo={onToggleTodo}
          onVotePoll={onVotePoll}
          interactive={interactive}
        />
      ))}
    </div>
  );
}

function PostBlockView({
  block,
  post,
  onJoinAttendance,
  onToggleTodo,
  onVotePoll,
  interactive,
}: {
  block: PostBlock;
  post: Post;
  onJoinAttendance?: (postId: string) => void;
  onToggleTodo?: (postId: string, todoIndex: number, completed: boolean) => void;
  onVotePoll?: (postId: string, optionIndex: number) => void;
  interactive: boolean;
}) {
  switch (block.type) {
    case 'richtext':
      return (
        <div
          className={RICHTEXT_CLASS}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html, SANITIZE_CONFIG) }}
        />
      );

    case 'image':
      return (
        <a
          href={getOptimizedImageUrl(block.url, { width: IMAGE_WIDTHS.full, quality: 85 })}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl overflow-hidden border border-slate-150 bg-slate-50 group"
        >
          <OptimizedImage
            src={block.url}
            alt={block.alt || '첨부 이미지'}
            displayWidth={IMAGE_WIDTHS.grid}
            sizes="(max-width: 768px) 100vw, 640px"
            wrapperClassName="max-h-[520px]"
            className="object-contain max-h-[520px] group-hover:opacity-95"
          />
        </a>
      );

    case 'video':
      return (
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black">
          <video
            src={block.url}
            controls
            preload="metadata"
            playsInline
            className="w-full max-h-[520px] bg-black"
          />
        </div>
      );

    case 'file': {
      const name = block.name || getFileNameFromUrl(block.url);
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200 hover:border-purple-250 hover:bg-slate-50/70 transition-all"
        >
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-slate-800 truncate">{name}</p>
            <p className="text-[10px] text-slate-400 font-medium">
              {block.size ? `${(block.size / 1024 / 1024).toFixed(2)}MB · ` : ''}첨부파일
            </p>
          </div>
          <Download className="w-4 h-4 text-slate-400 shrink-0" />
        </a>
      );
    }

    case 'link':
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3.5 p-3 bg-slate-50/60 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
        >
          {block.image && (
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-150 bg-white">
              <OptimizedImage
                src={block.image}
                alt=""
                displayWidth={IMAGE_WIDTHS.thumb}
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-[12.5px] font-black text-slate-900 truncate">{block.title || block.url}</h4>
            {block.description && (
              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{block.description}</p>
            )}
            <div className="flex items-center gap-1 mt-1 text-blue-500">
              <LinkIcon className="w-3 h-3 shrink-0" />
              <span className="text-[10px] font-mono truncate">{block.url}</span>
            </div>
          </div>
        </a>
      );

    case 'attendance':
      return (
        <div className="bg-orange-50/50 border border-orange-150 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white border border-orange-200 rounded-xl flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">{block.title}</h4>
              <p className="text-[10.5px] text-slate-500 font-medium">
                오늘의 출석 도장을 남겨보세요! (참여 {post.attendance_count || 0}명)
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!interactive || post.has_attended}
            onClick={e => {
              e.stopPropagation();
              onJoinAttendance?.(post.id);
            }}
            className={cn(
              'font-bold rounded-xl h-9 px-4 text-xs shrink-0',
              post.has_attended
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            )}
          >
            {post.has_attended ? '출석 완료' : '출석 체크'}
          </Button>
        </div>
      );

    case 'todo':
      return (
        <div className="bg-blue-50/40 border border-blue-150 rounded-2xl p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 bg-white border border-blue-200 rounded-xl flex items-center justify-center">
              <ListTodo className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <h5 className="text-xs font-black text-slate-900">{block.title}</h5>
          </div>
          <div className="space-y-1.5">
            {block.items.map((todo, idx) => {
              const isChecked = post.user_todo_checks?.includes(idx);
              const checkCount = post.todo_checks?.filter(c => c.todo_index === idx).length || 0;
              return (
                <button
                  type="button"
                  key={idx}
                  disabled={!interactive}
                  onClick={e => {
                    e.stopPropagation();
                    onToggleTodo?.(post.id, idx, !isChecked);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left',
                    isChecked
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-white border-blue-100 text-slate-700 hover:bg-slate-50/70'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                        isChecked ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'
                      )}
                    >
                      {isChecked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className={cn('font-bold text-[11.5px] truncate', isChecked && 'line-through text-slate-400')}>
                      {todo}
                    </span>
                  </span>
                  <span className="text-[9.5px] text-blue-500 font-extrabold shrink-0 ml-2">{checkCount}명 완료</span>
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'poll': {
      const totalVotes = post.poll_votes?.length || 0;
      const hasVoted = post.user_poll_vote !== null && post.user_poll_vote !== undefined;
      return (
        <div className="bg-purple-50/40 border border-purple-150 rounded-2xl p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 bg-white border border-purple-200 rounded-xl flex items-center justify-center shrink-0">
              <Vote className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <h5 className="text-xs font-black text-slate-900">{block.question}</h5>
          </div>
          <div className="space-y-1.5">
            {block.options.map((option, idx) => {
              const optionVotes = post.poll_votes?.filter(v => v.option_index === idx).length || 0;
              const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
              const isSelected = post.user_poll_vote === idx;
              return (
                <button
                  type="button"
                  key={idx}
                  disabled={!interactive || (hasVoted && !isSelected)}
                  onClick={e => {
                    e.stopPropagation();
                    onVotePoll?.(post.id, idx);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-[11.5px] font-bold relative overflow-hidden text-left',
                    isSelected
                      ? 'bg-purple-50 border-purple-250 text-purple-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-purple-200',
                    hasVoted && !isSelected && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <span
                    className="absolute left-0 top-0 bottom-0 bg-purple-500/10 transition-all duration-700"
                    style={{ width: `${percentage}%` }}
                  />
                  <span className="relative z-10 truncate">{option}</span>
                  <span className="relative z-10 text-[9.5px] text-purple-600 font-black shrink-0 ml-2">
                    {percentage}% ({optionVotes}표)
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-purple-500 font-bold">
            <span>{hasVoted ? '투표 완료' : '한 항목을 선택해 투표하세요'}</span>
            <span>총 {totalVotes}명 참여</span>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
