import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ChevronDown, Search, Bell, Loader2, Calendar, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cmsService } from '@/services/cmsService';

export default function NoticePage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cmsService.getSupportContent('notice')
      .then((data) => {
        // Filter out inactive/deleted ones
        const activeNotices = (data || []).filter(item => item.active);
        setNotices(activeNotices);

        // Parse search query ID and expand & scroll smoothly
        const params = new URLSearchParams(window.location.search);
        const noticeId = params.get('id');
        if (noticeId) {
          setExpandedNoticeId(noticeId);
          setTimeout(() => {
            const el = document.getElementById(`notice-${noticeId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 350);
        }
      })
      .catch((err) => console.error('[Notice] Fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedNoticeId(prev => (prev === id ? null : id));
  };

  const filteredNotices = notices.filter(notice => 
    notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notice.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-32 pb-20">
      {/* RichText Editor Rendering CSS Enhancements */}
      <style dangerouslySetInnerHTML={{ __html: `
        .editor-content, .editor-content p, .editor-content li {
          font-size: 14px !important;
          line-height: 1.55 !important;
          color: #334155 !important;
        }
        .editor-content p {
          margin-bottom: 0.5rem !important;
        }
        .editor-content ul {
          list-style-type: disc !important;
          padding-left: 1.25rem !important;
          margin-top: 0.4rem !important;
          margin-bottom: 0.8rem !important;
        }
        .editor-content ol {
          list-style-type: decimal !important;
          padding-left: 1.25rem !important;
          margin-top: 0.4rem !important;
          margin-bottom: 0.8rem !important;
        }
        .editor-content li {
          display: list-item !important;
          margin-bottom: 0.25rem !important;
        }
        .editor-content strong, .editor-content b {
          font-weight: 700 !important;
          color: #0f172a !important;
        }
        .editor-content h1 {
          font-size: 1.4rem !important;
          font-weight: 800 !important;
          margin-top: 1.25rem !important;
          margin-bottom: 0.6rem !important;
          color: #0f172a !important;
          line-height: 1.3 !important;
        }
        .editor-content h2 {
          font-size: 1.25rem !important;
          font-weight: 800 !important;
          margin-top: 1.1rem !important;
          margin-bottom: 0.5rem !important;
          color: #1e293b !important;
          line-height: 1.3 !important;
        }
        .editor-content h3 {
          font-size: 1.1rem !important;
          font-weight: 700 !important;
          margin-top: 1rem !important;
          margin-bottom: 0.4rem !important;
          color: #334155 !important;
          line-height: 1.3 !important;
        }
        .editor-content img {
          max-width: 100% !important;
          height: auto !important;
          border-radius: 0.5rem !important;
          margin: 1rem auto !important;
          display: block !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05) !important;
        }
        .editor-content iframe, .editor-content video {
          max-width: 100% !important;
          aspect-ratio: 16/9 !important;
          border-radius: 0.5rem !important;
          margin: 1rem auto !important;
          display: block !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05) !important;
        }
        .editor-content a {
          color: #7c3aed !important;
          text-decoration: underline !important;
          font-weight: 600 !important;
        }
        .editor-content blockquote {
          border-left: 3px solid #7c3aed !important;
          padding-left: 1rem !important;
          color: #475569 !important;
          font-style: italic !important;
          margin: 1rem 0 !important;
          background-color: #f8fafc !important;
          padding-top: 0.4rem !important;
          padding-bottom: 0.4rem !important;
          border-radius: 0 0.4rem 0.4rem 0 !important;
        }
        .editor-content hr {
          border-top: 2px solid #e2e8f0 !important;
          margin: 1.25rem 0 !important;
        }
        .editor-content pre {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          padding: 1rem !important;
          border-radius: 0.5rem !important;
          font-family: 'JetBrains Mono', monospace !important;
          overflow-x: auto !important;
          margin-bottom: 1rem !important;
          font-size: 0.85em !important;
        }
        .editor-content code {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
          padding: 0.15rem 0.35rem !important;
          border-radius: 0.25rem !important;
          font-size: 0.8em !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-weight: 600 !important;
        }
      `}} />

      <div className="container mx-auto px-4 max-w-4xl">
        <div className="space-y-10">
          {/* Header */}
          <div className="space-y-4 text-center">
            <Badge className="bg-purple-100/80 text-purple-600 border-none px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-widest select-none">
              Announcements
            </Badge>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">공지사항</h1>
            <p className="text-slate-500 font-bold max-w-lg mx-auto text-sm md:text-base">
              비원아카데미의 새롭고 다채로운 소식들을 가장 신속하게 확인해보세요.
            </p>
          </div>

          {/* Search input */}
          <div className="relative max-w-2xl mx-auto">
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="궁금한 공지사항 제목 또는 소식을 검색해 보세요..." 
              className="h-14 pl-12 pr-6 bg-white border border-slate-200 rounded-2xl shadow-sm font-bold text-base focus-visible:ring-2 focus-visible:ring-purple-600 transition-all placeholder:text-slate-400"
            />
            <Search className="absolute left-5.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          </div>

          {/* Traditional Board Table Section */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-4" />
                <p className="text-slate-400 text-sm font-bold">공지사항 리스트를 동기화하는 중입니다...</p>
              </div>
            ) : filteredNotices.length > 0 ? (
              <div className="w-full">
                {/* Desktop Board Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 bg-slate-50/70 border-b border-slate-200 px-6 py-4 text-xs font-black text-slate-500 tracking-wide text-center uppercase select-none">
                  <div className="col-span-1">번호</div>
                  <div className="col-span-2">구분</div>
                  <div className="col-span-6 text-left pl-4">제목</div>
                  <div className="col-span-3">등록일</div>
                </div>

                {/* Board List Rows */}
                <div className="divide-y divide-slate-150">
                  {filteredNotices.map((notice, index) => {
                    const isExpanded = expandedNoticeId === notice.id;
                    const isImportant = notice.title.includes('[필독]') || notice.title.includes('[중요]') || notice.important;

                    return (
                      <div 
                        key={notice.id} 
                        id={`notice-${notice.id}`}
                        className="transition-colors group"
                      >
                        {/* Notice Row Clickable Header */}
                        <div 
                          onClick={() => toggleExpand(notice.id)}
                          className={`px-6 py-4.5 md:py-5 grid grid-cols-12 gap-4 items-center cursor-pointer select-none border-l-4 transition-all duration-150 ${
                            isExpanded ? 'bg-purple-50/30 border-purple-500' : 'hover:bg-slate-50 border-l-transparent'
                          }`}
                        >
                          {/* Number */}
                          <div className="hidden md:flex col-span-1 justify-center text-xs font-bold text-slate-400 font-mono">
                            {filteredNotices.length - index}
                          </div>

                          {/* Classification Tag */}
                          <div className="col-span-3 md:col-span-2 flex items-center justify-start md:justify-center">
                            {isImportant ? (
                              <span className="bg-rose-50 text-rose-500 border border-rose-200/80 text-[10.5px] font-black px-2.5 py-1 rounded-md tracking-tight">
                                [필독/중요]
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10.5px] font-bold px-2.5 py-1 rounded-md tracking-tight">
                                일반공지
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <div className="col-span-9 md:col-span-6 pl-0 md:pl-4 min-w-0 flex items-center">
                            <h3 className={`text-sm md:text-[15px] font-extrabold tracking-tight truncate leading-normal transition-colors ${
                              isExpanded ? 'text-purple-600' : 'text-slate-800 group-hover:text-purple-600'
                            }`}>
                              {notice.title}
                            </h3>
                          </div>

                          {/* Create Date */}
                          <div className="col-span-3 md:col-span-3 flex justify-end md:justify-center items-center text-xs text-slate-400 font-bold font-mono">
                            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-350 shrink-0 md:hidden" />
                            {notice.created_at ? new Date(notice.created_at).toLocaleDateString('ko-KR') : '-'}
                          </div>
                        </div>

                        {/* Expandable Notice Body */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeInOut' }}
                              className="overflow-hidden border-t border-slate-150 bg-slate-50/30"
                            >
                              <div className="px-6 py-8 md:px-14 md:py-10 text-left border-b border-slate-200/60">
                                <div className="editor-content bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-sm">
                                  {/* Inner Title & Date bar */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 mb-6 gap-3">
                                    <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                                      <FileText className="w-5 h-5 text-purple-500 shrink-0" />
                                      {notice.title}
                                    </h2>
                                    <span className="text-xs text-slate-400 font-bold font-mono shrink-0">
                                      작성일자: {notice.created_at ? new Date(notice.created_at).toLocaleString('ko-KR') : '-'}
                                    </span>
                                  </div>

                                  {/* Real editor content rendering */}
                                  {notice.content && (notice.content.includes('<p>') || notice.content.includes('<h') || notice.content.includes('<div') || notice.content.includes('<ul') || notice.content.includes('<ol') || notice.content.includes('<img') || notice.content.includes('<span') || notice.content.includes('<video')) ? (
                                    <div 
                                      className="editor-content select-text"
                                      dangerouslySetInnerHTML={{ __html: notice.content }}
                                    />
                                  ) : (
                                    <p className="whitespace-pre-wrap select-text text-sm text-slate-700 leading-relaxed font-semibold">
                                      {notice.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-24 text-slate-400 text-sm font-black select-none">
                {searchQuery ? "검색조건에 일치하는 결과가 발견되지 않았습니다." : "등록글 목록이 없습니다."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

