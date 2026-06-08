import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function SuggestionPage() {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [master, setMaster] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('희망하는 강의 주제를 입력해 주세요.');
      return;
    }
    if (!content.trim()) {
      toast.error('강의 건의 상세 내용을 입력해 주세요.');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        suggestionDetail: content,
        master: master || '없음',
        authorId: user?.id || 'anonymous',
        authorName: user?.nickname || user?.name || '익명 기여자',
        authorEmail: user?.email || 'anonymous@k-learn.co.kr'
      };

      const { error } = await supabase
        .from('support_contents')
        .insert([{
          type: 'suggestion',
          title: title,
          content: JSON.stringify(payload),
          active: true,
          is_deleted: false
        }]);

      if (error) {
        toast.error('오류가 발생했습니다: ' + error.message);
        return;
      }

      toast.success('학습 건의사항이 성공적으로 전달되었습니다! 감사합니다 😊');
      setTitle('');
      setContent('');
      setMaster('');
    } catch (err: any) {
      console.error('[Suggestion] Submit error:', err);
      toast.error('제출에 실패했습니다: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-7xl text-left">
        <div className="space-y-12">
          <div className="space-y-4 text-center">
            <Badge className="bg-yellow-100 text-yellow-600 border-none px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-widest">
              GIVE US YOUR IDEA
            </Badge>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter text-center">강의 건의하기</h1>
            <p className="text-gray-500 font-bold text-center">
              배우고 싶은 분야나 특정 마스터가 있다면 말씀해 주세요.<br />
              여러분의 의견을 바탕으로 최고의 커리큘럼을 만듭니다.
            </p>
          </div>

          <div className="bg-white p-6 md:p-10 rounded-[48px] border border-slate-100 shadow-xl space-y-8 max-w-3xl mx-auto w-full">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">희망하는 강의 주제 <span className="text-red-500">*</span></label>
                <Input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: AI를 활용한 부동산 경매 분석" 
                  disabled={isSubmitting}
                  className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 focus-visible:ring-2 focus-visible:ring-purple-600 transition-all text-sm md:text-base" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">상세 내용 <span className="text-red-500">*</span></label>
                <Textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="어떤 내용을 중점적으로 배우고 싶으신가요? 최대한 구체적으로 써 주시면 적극 반영됩니다." 
                  disabled={isSubmitting}
                  className="min-h-[200px] bg-gray-50 border-none rounded-3xl font-bold p-6 focus-visible:ring-2 focus-visible:ring-purple-600 transition-all text-sm md:text-base" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">추천하는 마스터 (선택)</label>
                <Input 
                  value={master}
                  onChange={(e) => setMaster(e.target.value)}
                  placeholder="강의를 해주셨으면 하는 마스터의 성함 또는 대표 채널명" 
                  disabled={isSubmitting}
                  className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 focus-visible:ring-2 focus-visible:ring-purple-600 transition-all text-sm md:text-base" 
                />
              </div>
            </div>

            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black text-lg rounded-[24px] gap-3 shadow-xl hover:shadow-purple-200 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> 제출하는 중...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" /> 건의사항 제출하기
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
