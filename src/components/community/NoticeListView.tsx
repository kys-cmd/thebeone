import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import DOMPurify from 'dompurify';

interface NoticeListViewProps {
  notices: any[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  expandedNoticeId: string | null;
  onToggleExpand: (id: string) => void;
}

export function NoticeListView({
  notices,
  searchQuery,
  onSearchChange,
  expandedNoticeId,
  onToggleExpand,
}: NoticeListViewProps) {
  const filtered = notices.filter(
    (n) =>
      (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.content || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3 text-left">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="공지사항 제목/내용 검색..."
          className="h-10 pl-9.5 pr-3 bg-white border-slate-200/80 rounded-2xl font-bold text-xs sm:text-sm focus:ring-purple-600 shadow-xs"
        />
      </div>

      {/* Notice List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 font-bold">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          filtered.map((notice, idx, arr) => {
            const isExpanded = expandedNoticeId === notice.id;
            const isImportant =
              notice.title?.includes('[필독]') ||
              notice.title?.includes('[중요]') ||
              notice.important;

            return (
              <div key={notice.id} className="transition-colors group bg-white">
                <div
                  onClick={() => onToggleExpand(notice.id)}
                  className={`p-4 flex items-center justify-between gap-3 cursor-pointer select-none transition-all ${
                    isExpanded ? 'bg-purple-50/20 font-black' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isImportant ? (
                      <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-black px-2 py-0.5 rounded-md shrink-0">
                        필독
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0">
                        공지
                      </span>
                    )}
                    <h3
                      className={`text-xs sm:text-sm tracking-tight truncate leading-normal ${
                        isExpanded ? 'text-purple-600 font-black' : 'text-slate-800 font-bold'
                      }`}
                    >
                      {notice.title}
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold font-mono shrink-0">
                    {notice.created_at ? new Date(notice.created_at).toLocaleDateString('ko-KR') : '-'}
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-slate-100 bg-slate-50/30 p-4 sm:p-5"
                    >
                      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-purple-600" />
                            {notice.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {notice.created_at ? new Date(notice.created_at).toLocaleString('ko-KR') : '-'}
                          </span>
                        </div>
                        <div
                          className="editor-content select-text text-slate-700 text-xs sm:text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(notice.content || '', {
                              ADD_TAGS: ['iframe', 'span', 'img', 'video', 'blockquote', 'pre', 'code', 'mark'],
                              ADD_ATTR: ['src', 'alt', 'style', 'class', 'href', 'target', 'rel', 'data-type', 'controls', 'height', 'width'],
                            }),
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
