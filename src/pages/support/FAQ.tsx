import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Search, Loader2, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cmsService } from '@/services/cmsService';

const CATEGORIES = ['전체', '강의', '결제 및 환불', '계정', '기타'];

export default function FAQPage() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');

  useEffect(() => {
    cmsService.getSupportContent('faq')
      .then((data) => {
        const activeFaqs = (data || []).filter(item => item.active);
        
        // Parse the question and answer
        const mapped = activeFaqs.map(item => {
          let category = '일반';
          let answer = item.content;

          try {
            // Check if it's dynamic JSON { answer, category }
            const parsed = JSON.parse(item.content);
            if (parsed && typeof parsed === 'object') {
              if (parsed.answer) answer = parsed.answer;
              if (parsed.category) category = parsed.category;
            }
          } catch (e) {
            // Just raw string content fallback
          }

          return {
            id: item.id,
            question: item.title,
            answer,
            category
          };
        });

        setFaqs(mapped);
      })
      .catch(err => console.error('[FAQ] Fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  // Filter based on category & search text
  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = activeCategory === '전체' || faq.category === activeCategory;
    const matchesSearch = 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-6 sm:pt-12 pb-16 sm:pb-20">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="space-y-6 sm:space-y-12">
          {/* Header */}
          <div className="space-y-3 sm:space-y-4 text-center">
            <Badge className="bg-green-100 text-green-600 border-none px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-widest">
              HELPCENTER
            </Badge>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tighter">자주 묻는 질문</h1>
            <p className="text-sm sm:text-base text-gray-500 font-bold max-w-lg mx-auto break-keep">
              자주 발생하는 문제와 질문들을 모았습니다.<br className="hidden sm:block" /> 궁금하신 점이 있다면 아래 내용을 먼저 확인해 보세요.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-2xl mx-auto">
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="궁금한 단어를 입력해 보세요..." 
              className="h-12 sm:h-16 pl-11 sm:pl-14 pr-4 sm:pr-6 bg-white border border-slate-100 rounded-2xl sm:rounded-[24px] shadow-sm font-bold text-sm sm:text-lg focus-visible:ring-2 focus-visible:ring-purple-600 transition-all"
            />
            <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar sm:justify-center sm:flex-wrap max-w-2xl mx-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 transition-all duration-200 shadow-xs border ${
                  activeCategory === cat
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-white text-gray-700 border-slate-100 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* List Section */}
          <div className="bg-white rounded-3xl sm:rounded-[40px] border border-gray-100 shadow-sm overflow-hidden p-4 sm:p-6 md:p-12 text-left">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-4" />
                <p className="text-gray-400 font-bold text-sm">자주묻는질문을 불러오는 중입니다...</p>
              </div>
            ) : filteredFaqs.length > 0 ? (
              <Accordion className="w-full space-y-2 sm:space-y-4">
                {filteredFaqs.map((faq, index) => (
                  <AccordionItem 
                    key={faq.id || index} 
                    value={`item-${faq.id || index}`} 
                    className="border-b border-gray-100 last:border-none py-1 sm:py-2"
                  >
                    <AccordionTrigger className="hover:no-underline py-3.5 sm:py-4 group">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-left pr-2">
                        <Badge className="bg-purple-50 hover:bg-purple-100 text-purple-600 border-none px-2.5 py-0.5 font-bold text-[10px] shrink-0 w-fit">
                          {faq.category}
                        </Badge>
                        <div className="flex items-center gap-3">
                          <HelpCircle className="w-5 h-5 text-purple-500 shrink-0 select-none hidden sm:block" />
                          <span className="font-extrabold text-sm sm:text-base text-[#111827] group-hover:text-purple-600 transition-colors tracking-tight leading-snug break-keep">
                            {faq.question}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-600 text-sm font-medium leading-relaxed pl-3.5 sm:pl-9 border-l-2 border-purple-200 mt-2 whitespace-pre-wrap break-keep">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-12 text-gray-400 font-bold">
                {searchQuery || activeCategory !== '전체' 
                  ? "조건에 맞는 자주 묻는 질문이 발견되지 않았습니다." 
                  : "등록된 자주 묻는 질문 내역이 없습니다."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
