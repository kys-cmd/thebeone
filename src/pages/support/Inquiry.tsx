import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, FileUp, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InquiryPage() {
  const [category, setCategory] = useState('사이트 오류');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !email.trim() || !title.trim() || !message.trim()) {
      toast.error('모든 빈칸은 필수 입력 사항입니다. 다시 확인해 주세요.');
      return;
    }

    // 간단한 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('올바른 이메일 형식을 주시기 바랍니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'submit-inquiry',
          category,
          email,
          title,
          message
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        toast.success(result.message);
        // 입력 박스 리셋
        setEmail('');
        setTitle('');
        setMessage('');
        setCategory('사이트 오류');
      } else {
        throw new Error(result.message || '서버 응답 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error('[Inquiry submit error]', err);
      toast.error(`문의하기 전송 실패: ${err.message || '오류가 발생했습니다.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="space-y-12">
          <div className="space-y-4 text-center">
            <Badge className="bg-blue-100 text-blue-600 border-none px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-widest">
              Direct Contact
            </Badge>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter">1:1 문의</h1>
            <p className="text-gray-500 font-bold">
              서비스 이용 중 불편한 점이나 궁금한 점이 있으시면<br />
              언제든지 문의해 주세요. 담당자가 확인 후 답변 드립니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-2xl space-y-8 max-w-3xl mx-auto w-full">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-900 ml-1">문의 유형 <span className="text-red-500">*</span></label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="사이트 오류">사이트 오류</option>
                    <option value="강의 오류">강의 오류</option>
                    <option value="커뮤니티/채팅">커뮤니티/채팅</option>
                    <option value="환불 문의">환불 문의</option>
                    <option value="계정/정보">계정/정보</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-900 ml-1">이메일 <span className="text-red-500">*</span></label>
                  <Input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="답변 받을 이메일 주소" 
                    className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 focus-visible:ring-2 focus-visible:ring-blue-500" 
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-gray-900 ml-1">문의 제목 <span className="text-red-500">*</span></label>
                <Input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="제목을 입력해 주세요" 
                  className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 focus-visible:ring-2 focus-visible:ring-blue-500" 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-gray-900 ml-1">상세 내용 <span className="text-red-500">*</span></label>
                <Textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="상세한 내용을 기재해 주시면 더 정확한 안내가 가능합니다." 
                  className="min-h-[200px] bg-gray-50 border-none rounded-[24px] font-bold p-6 focus-visible:ring-2 focus-visible:ring-blue-500" 
                  required
                />
              </div>
              
              <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-[11px] font-bold text-blue-800 leading-snug">
                  개인정보 수집 및 이용에 동의하며 작성하신 내용이 본 서비스 관리를 위해 제출됩니다.
                </p>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-[24px] gap-3 shadow-xl shadow-blue-200 transition-all hover:scale-[1.02] active:scale-95 duration-250 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  제출 중...
                </>
              ) : (
                '문의하기 제출'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
