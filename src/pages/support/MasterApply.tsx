import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Award, Globe, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function MasterApplyPage() {
  const { user } = useAuthStore();
  
  // Inputs state
  const [name, setName] = useState(user?.nickname || user?.name || '');
  const [field, setField] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [experience, setExperience] = useState('');
  const [link, setLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error('성함 또는 활동명을 기입해 주세요.');
    if (!field.trim()) return toast.error('희망 분야를 기입해 주세요.');
    if (!phone.trim()) return toast.error('연락처(전화번호)를 기입해 주세요.');
    if (!email.trim()) return toast.error('이메일 주소를 기입해 주세요.');
    if (!experience.trim()) return toast.error('경력 및 활동 사항을 기입해 주세요.');

    try {
      setIsSubmitting(true);

      const payload = {
        name,
        field,
        phone,
        email,
        experience,
        link: link || '없음',
        applicantUserId: user?.id || 'anonymous'
      };

      const title = `${name} 마스터 지원서 - ${field}`;

      const { error } = await supabase
        .from('support_contents')
        .insert([{
          type: 'master_apply',
          title: title,
          content: JSON.stringify(payload),
          active: true,
          is_deleted: false
        }]);

      if (error) {
        toast.error('오류가 발생했습니다: ' + error.message);
        return;
      }

      toast.success('마스터 강사 지원서가 성공적으로 접수되었습니다. 검토 후 신속히 연락드리겠습니다! 🌟');
      
      // Clear form
      setField('');
      setPhone('');
      setExperience('');
      setLink('');
    } catch (err: any) {
      console.error('[MasterApply] Submit error:', err);
      toast.error('접수 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-[50px] pb-20">
      <div className="container mx-auto px-4 max-w-7xl text-left">
        <div className="space-y-16">
          <div className="space-y-6 text-center">
            <Badge className="bg-purple-600 text-white border-none px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest">
              BECOME A MASTER
            </Badge>
            <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter leading-tight text-center">
              당신의 압도적인 재능을<br />
              <span className="text-purple-600">세상과 나누세요</span>
            </h1>
            <p className="text-gray-500 font-bold text-lg max-w-2xl mx-auto text-center">
              비원아카데미는 각 분야별 최정상 전문가들의 합류를 환영합니다.<br />
              지식의 가치를 실현하고 함께 성장할 파트너를 기다립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Sparkles, title: '압도적 인사이트', desc: '자신만의 독보적인 실전 노하우' },
              { icon: Award, title: '최고의 대우', desc: '업계 최고 수준의 수익 쉐어' },
              { icon: Globe, title: '강력한 브랜딩', desc: '비원아카데미만의 전폭적인 마케팅 지원' },
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm text-center space-y-4">
                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mx-auto">
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-gray-950 tracking-tight">{item.title}</h3>
                <p className="text-xs text-gray-400 font-extrabold">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 md:p-16 rounded-[48px] border border-slate-100 shadow-2xl space-y-10 max-w-4xl mx-auto w-full">
            <div className="border-b-4 border-gray-900 pb-6">
              <h2 className="text-2xl font-black text-gray-900">강사 지원 양식</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">이름 / 활동명 <span className="text-red-500">*</span></label>
                <Input 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 text-sm focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-0" 
                  placeholder="성함 또는 닉네임" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">희망 분야 <span className="text-red-500">*</span></label>
                <Input 
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  disabled={isSubmitting}
                  className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 text-sm focus-visible:ring-2 focus-visible:ring-purple-600" 
                  placeholder="예: 부동산 투자, AI 기술 코딩 등" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">연락처 <span className="text-red-500">*</span></label>
                <Input 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                  className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 text-sm focus-visible:ring-2 focus-visible:ring-purple-600" 
                  placeholder="010-0000-0000" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">이메일 <span className="text-red-500">*</span></label>
                <Input 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 text-sm focus-visible:ring-2 focus-visible:ring-purple-600" 
                  placeholder="email@example.com" 
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">경력 및 활동 사항 <span className="text-red-500">*</span></label>
                <Textarea 
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[200px] bg-gray-50 border-none rounded-3xl font-bold p-6 text-sm focus-visible:ring-2 focus-visible:ring-purple-600 whitespace-pre-wrap" 
                  placeholder="주요 경력, 현재 운영 중인 채널, 출간 서적 등을 기재해 주세요." 
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-extrabold text-gray-900 ml-1">참고 링크 (유튜브/주요블로그/SNS 등)</label>
                <Input 
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  disabled={isSubmitting}
                  className="h-14 bg-gray-50 border-none rounded-2xl font-bold px-6 text-sm focus-visible:ring-2 focus-visible:ring-purple-600" 
                  placeholder="https://yourprofile.link" 
                />
              </div>
            </div>

            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-20 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-[32px] gap-3 shadow-2xl hover:shadow-purple-200 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" /> 접수하는 중...
                </>
              ) : (
                "마스터 지원 신청하기"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
