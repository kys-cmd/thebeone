import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Trash2, 
  RefreshCw, 
  Search, 
  Filter, 
  Inbox, 
  Clock,
  HelpCircle,
  Megaphone,
  Plus,
  Edit,
  Save,
  X,
  UserCheck,
  CheckCircle,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cmsService } from '@/services/cmsService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { PostEditor } from '@/components/community/PostEditor';

export default function SupportInquiries() {
  const [activeTab, setActiveTab] = useState('inquiries');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]); // holds contents of current tab's content
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('전체');

  // Form State for editing / creating notices or faqs
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formActive, setFormActive] = useState(true);
  // Delete confirm modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // FAQ specific category
  const [faqCategory, setFaqCategory] = useState('강의');

  // Schedule specific fields
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleCategory, setScheduleCategory] = useState('정규 강의');
  const [scheduleColor, setScheduleColor] = useState('purple');

  // Load support contents based on tab
  const loadTabContents = async (tab: string) => {
    setLoading(true);
    setIsEditing(false);
    setEditId(null);
    clearForm();

    let dbType = 'inquiry';
    if (tab === 'notices') dbType = 'notice';
    if (tab === 'faqs') dbType = 'faq';
    if (tab === 'suggestions') dbType = 'suggestion';
    if (tab === 'master_applies') dbType = 'master_apply';
    if (tab === 'schedules') dbType = 'schedule';

    try {
      const data = await cmsService.getSupportContent(dbType);
      setItems(data || []);
    } catch (err: any) {
      console.error(`Failed to load ${tab}`, err);
      toast.error('내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabContents(activeTab);
  }, [activeTab]);

  const clearForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormActive(true);
    setFaqCategory('강의');
    setEditId(null);
    setScheduleDate(new Date().toISOString().split('T')[0]);
    setScheduleTime('19:30 - 21:00');
    setScheduleCategory('정규 강의');
    setScheduleColor('purple');
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      setLoading(true);
      await cmsService.deleteSupportContent(deleteConfirmId);
      toast.success('항목이 정상적으로 삭제되었습니다.');
      setDeleteConfirmId(null);
      loadTabContents(activeTab);
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    clearForm();
    setIsEditing(true);
  };

  const startEdit = (item: any) => {
    setEditId(item.id);
    setFormTitle(item.title);
    setFormActive(item.active);

    if (activeTab === 'faqs') {
      try {
        const parsed = JSON.parse(item.content);
        setFormContent(parsed.answer || '');
        setFaqCategory(parsed.category || '강의');
      } catch (e) {
        setFormContent(item.content || '');
        setFaqCategory('기타');
      }
    } else if (activeTab === 'schedules') {
      try {
        const parsed = JSON.parse(item.content);
        setScheduleDate(parsed.date || '');
        setScheduleTime(parsed.time || '');
        setScheduleCategory(parsed.category || '정규 강의');
        setScheduleColor(parsed.color || 'purple');
        setFormContent(parsed.description || '');
      } catch (e) {
        setScheduleDate('');
        setScheduleTime('');
        setScheduleCategory('정규 강의');
        setScheduleColor('purple');
        setFormContent(item.content || '');
      }
    } else {
      setFormContent(item.content || '');
    }

    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error('제목을 작성해주세요.');
      return;
    }
    if (!formContent.trim()) {
      toast.error('설명 또는 본문 내용을 작성해주세요.');
      return;
    }

    try {
      setLoading(true);

      let finalContent = formContent;
      if (activeTab === 'faqs') {
        finalContent = JSON.stringify({
          answer: formContent,
          category: faqCategory
        });
      } else if (activeTab === 'schedules') {
        finalContent = JSON.stringify({
          date: scheduleDate,
          time: scheduleTime,
          category: scheduleCategory,
          color: scheduleColor,
          description: formContent
        });
      }

      let typeCode = 'faq';
      if (activeTab === 'notices') typeCode = 'notice';
      if (activeTab === 'schedules') typeCode = 'schedule';

      const payload: any = {
        type: typeCode,
        title: formTitle,
        content: finalContent,
        active: formActive,
        is_deleted: false
      };

      if (editId) {
        payload.id = editId;
      }

      await cmsService.saveSupportContent([payload]);
      
      toast.success(editId ? '수정이 완료되었습니다.' : '성공적으로 등록되었습니다.');
      setIsEditing(false);
      clearForm();
      loadTabContents(activeTab);
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Filtration based on simple keyword matches
  const filteredData = items.filter(item => {
    const titleMatch = item.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const contentMatch = item.content?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Category match for Inquiry tab
    if (activeTab === 'inquiries') {
      let parsed = { category: '기타' };
      try {
        if (item.content?.startsWith('{')) parsed = JSON.parse(item.content);
      } catch (e) { }

      if (filterCategory !== '전체' && parsed.category !== filterCategory) {
        return false;
      }
    }

    return titleMatch || contentMatch;
  });

  return (
    <div className="space-y-8 text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">게시판 및 내역 관리</h1>
          <p className="text-sm text-slate-500 font-bold mt-1">
            공지사항과 자주묻는질문(FAQ)을 등록하고, 1:1 문의/강의 건의/강사 지원을 통합 검토합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          {['notices', 'faqs', 'schedules'].includes(activeTab) && !isEditing && (
            <Button 
              onClick={startCreate}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black hover:scale-105 transition-all gap-1.5 shadow-lg shadow-purple-100"
            >
              <Plus className="w-4 h-4" /> 
              {activeTab === 'notices' ? '공지사항 등록' : activeTab === 'schedules' ? '강의 일정 추가' : 'FAQ 추가'}
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => loadTabContents(activeTab)} 
            disabled={loading}
            className="border-slate-200 font-bold gap-2 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); }} className="w-full">
        <TabsList className="bg-slate-100/60 border rounded-2xl p-1.5 gap-1.5 flex flex-wrap h-auto justify-start max-w-fit">
          <TabsTrigger value="inquiries" className="rounded-xl font-bold gap-1 px-4 py-2 text-xs md:text-sm">
            <MessageSquare className="w-4 h-4 text-purple-500" /> 1:1 문의사항
          </TabsTrigger>
          <TabsTrigger value="notices" className="rounded-xl font-bold gap-1 px-4 py-2 text-xs md:text-sm">
            <Megaphone className="w-4 h-4 text-purple-500" /> 공지사항 관리
          </TabsTrigger>
          <TabsTrigger value="faqs" className="rounded-xl font-bold gap-1 px-4 py-2 text-xs md:text-sm">
            <HelpCircle className="w-4 h-4 text-purple-500" /> FAQ 관리
          </TabsTrigger>
          <TabsTrigger value="schedules" className="rounded-xl font-bold gap-1 px-4 py-2 text-xs md:text-sm">
            <Calendar className="w-4 h-4 text-purple-500" /> 강의 일정 관리
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="rounded-xl font-bold gap-1 px-4 py-2 text-xs md:text-sm">
            <UserCheck className="w-4 h-4 text-purple-500" /> 강의 건의내역
          </TabsTrigger>
          <TabsTrigger value="master_applies" className="rounded-xl font-bold gap-1 px-4 py-2 text-xs md:text-sm">
            <CheckCircle className="w-4 h-4 text-purple-500" /> 강사 지원현황
          </TabsTrigger>
        </TabsList>

        {/* List & Edit Area */}
        {isEditing ? (
          <div className="mt-8 bg-zinc-100 p-1 md:p-4 rounded-3xl">
            {activeTab === 'notices' ? (
              <div className="space-y-4 animate-fade-in">
                <Card className="border border-slate-200 shadow-2xl rounded-3xl overflow-hidden p-4 md:p-6 bg-zinc-50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 mb-4 bg-white p-4 rounded-2xl shadow-sm gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        {editId ? '공지사항 수정' : '새 공지사항 등록'}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        커뮤니티와 동일한 에디터로 이미지, 비디오, 하이퍼링크가 포함된 정교한 형식의 공지사항을 작성하세요.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="checkbox"
                        id="form_active"
                        checked={formActive}
                        onChange={(e) => setFormActive(e.target.checked)}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                      <label htmlFor="form_active" className="text-sm font-extrabold text-slate-700 cursor-pointer select-none">
                        사용자 화면 노출 활성화 (Active)
                      </label>
                    </div>
                  </div>

                  <PostEditor
                    communityId="notices"
                    initialPost={editId ? { title: formTitle, content: formContent } : undefined}
                    onCancel={() => setIsEditing(false)}
                    submitButtonText="공지사항 저장 완료"
                    onSubmit={async (data) => {
                      if (!data.title.trim()) {
                        toast.error('공지사항 제목을 입력해주세요.');
                        return;
                      }

                      try {
                        setLoading(true);
                        const payload: any = {
                          type: 'notice',
                          title: data.title,
                          content: data.html, // HTML representation
                          active: formActive,
                          is_deleted: false
                        };

                        if (editId) {
                          payload.id = editId;
                        }

                        await cmsService.saveSupportContent([payload]);
                        
                        toast.success(editId ? '공지사항이 수정되었습니다.' : '공지사항이 등록되었습니다.');
                        setIsEditing(false);
                        clearForm();
                        loadTabContents(activeTab);
                      } catch (err: any) {
                        toast.error('공지사항 저장 중 오류가 발생했습니다.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  />
                </Card>
              </div>
            ) : activeTab === 'schedules' ? (
              <Card className="border border-slate-150 shadow-2xl rounded-3xl overflow-hidden animate-fade-in bg-white">
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black text-slate-900">
                      {editId ? '강의 일정 수정' : '새 강의 일정 등록'}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-bold mt-1">
                      월별 캘린더 및 강의 일정 목록에 표시되는 일정을 직접 등록/관리합니다.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200" onClick={() => setIsEditing(false)}>
                    <X className="w-5 h-5 text-gray-500" />
                  </Button>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-extrabold text-slate-800">일정 구분 카테고리</label>
                      <select
                        value={scheduleCategory}
                        onChange={(e) => setScheduleCategory(e.target.value)}
                        className="w-full h-12 bg-slate-50 border rounded-xl font-bold px-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        <option value="정규 강의">정규 강의 📚</option>
                        <option value="특강(오프라인)">특강(오프라인) 🚀</option>
                        <option value="특강(온라인)">특강(온라인) 💻</option>
                        <option value="비원Live">비원Live 🎥</option>
                        <option value="회원모임">회원모임 👥</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-extrabold text-slate-800">새 테마 컬러 지정</label>
                      <div className="flex items-center gap-3 h-12">
                        {['purple', 'rose', 'blue', 'emerald', 'amber'].map((c) => {
                          const bgMap: Record<string, string> = {
                            purple: 'bg-purple-500',
                            rose: 'bg-rose-500',
                            blue: 'bg-blue-500',
                            emerald: 'bg-emerald-500',
                            amber: 'bg-amber-500',
                          };
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setScheduleColor(c)}
                              className={`w-8 h-8 rounded-full ${bgMap[c]} border-2 transition-all ${
                                scheduleColor === c ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent hover:opacity-80'
                              }`}
                              title={c}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-extrabold text-slate-800">일정 날짜 (Date)</label>
                      <Input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="h-12 bg-slate-50 rounded-xl font-bold"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-extrabold text-slate-800">일정 시간 (Time range)</label>
                      <Input
                        type="text"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        placeholder="예: 19:30 - 21:00"
                        className="h-12 bg-slate-50 rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-extrabold text-slate-800">일정 제목</label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="예: 6월 정규 1기 오리엔테이션 및 오프라인 실습 가동"
                      className="h-12 bg-slate-50 rounded-xl font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-extrabold text-slate-800">상세 내용</label>
                    <Textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder="줌 접속 좌표, 준비물, 또는 세부적인 진행 타임라인 등을 상세 안내하세요."
                      className="min-h-[140px] bg-slate-50 rounded-2xl font-semibold p-4"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <input
                      type="checkbox"
                      id="form_active"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                    />
                    <label htmlFor="form_active" className="text-sm font-extrabold text-slate-700 cursor-pointer select-none">
                      사용자 화면 노출 활성화 (Active)
                    </label>
                  </div>

                  <div className="flex gap-3 justify-end pt-4">
                    <Button variant="outline" className="rounded-xl font-bold px-6 h-12" onClick={() => setIsEditing(false)}>
                      취소하기
                    </Button>
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl px-8 h-12 gap-1.5" onClick={handleSave}>
                      <Save className="w-4 h-4" /> 저장하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-slate-100 shadow-2xl rounded-3xl overflow-hidden animate-fade-in bg-white">
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black text-slate-900">
                      {editId ? '작성글 수정제한' : '새 자주묻는질문(FAQ) 등록'}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-bold mt-1">
                      게시판에 실시간으로 반영되는 데이터를 작성합니다.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200" onClick={() => setIsEditing(false)}>
                    <X className="w-5 h-5 text-gray-500" />
                  </Button>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-extrabold text-slate-800">FAQ 분류 카테고리</label>
                    <select
                      value={faqCategory}
                      onChange={(e) => setFaqCategory(e.target.value)}
                      className="w-full h-12 bg-slate-50 border rounded-xl font-bold px-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="강의">강의</option>
                      <option value="결제 및 환불">결제 및 환불</option>
                      <option value="계정">계정</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-extrabold text-slate-800">FAQ 핵심 질문</label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="예: 환불 조건과 절차는 어떻게 되나요?"
                      className="h-12 bg-slate-50 rounded-xl font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-extrabold text-slate-800">FAQ 상세 안내 답변</label>
                    <Textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder="해당 사안에 대한 가이드라인을 상세히 작성해 주세요."
                      className="min-h-[220px] bg-slate-50 rounded-2xl font-semibold p-4"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <input
                      type="checkbox"
                      id="form_active"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                    />
                    <label htmlFor="form_active" className="text-sm font-extrabold text-slate-700 cursor-pointer select-none">
                      사용자 화면 노출 활성화 (Active)
                    </label>
                  </div>

                  <div className="flex gap-3 justify-end pt-4">
                    <Button variant="outline" className="rounded-xl font-bold px-6 h-12" onClick={() => setIsEditing(false)}>
                      취소하기
                    </Button>
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl px-8 h-12 gap-1.5" onClick={handleSave}>
                      <Save className="w-4 h-4" /> 저장하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Filter and Search Box */}
            <div className="bg-white p-4 border border-slate-100 shadow-sm rounded-2xl flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="통합 키워드 검색..."
                  className="pl-10 h-11 bg-slate-50/50 border-slate-100 rounded-xl font-bold text-sm"
                />
              </div>

              {activeTab === 'inquiries' && (
                <div className="flex items-center gap-2 w-full md:w-56 shrink-0">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-xl font-bold px-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="전체">전체 카테고리</option>
                    <option value="사이트 오류">사이트 오류</option>
                    <option value="강의 오류">강의 오류</option>
                    <option value="커뮤니티/채팅">커뮤니티/채팅</option>
                    <option value="계정/정보">계정/정보</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              )}
            </div>

            {/* List Table/Containers */}
            <Card className="border-none shadow-sm overflow-hidden bg-white">
              <CardContent className="p-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
                    <p className="text-gray-400 text-xs font-bold font-mono">가장 최근 상태의 데이터 목록을 불러오고 있습니다...</p>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <Inbox className="w-12 h-12 text-slate-300 animate-bounce" />
                    <div>
                      <h4 className="text-base font-black text-slate-700">해당 분류의 데이터 사항이 없습니다</h4>
                      <p className="text-xs text-gray-400 font-bold mt-1">사용자의 제출 내역이나 CMS 등록 레코드가 비어있을 수 있습니다.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredData.map((item) => {
                      // Custom Rendering configurations based on Active tab
                      if (activeTab === 'inquiries') {
                        let parsed = { category: '기타', email: '익명', message: item.content || '' };
                        try {
                          if (item.content?.startsWith('{')) parsed = JSON.parse(item.content);
                        } catch (e) {}

                        return (
                          <div key={item.id} className="p-6 border rounded-2xl hover:border-purple-200 hover:bg-purple-50/5 transition-all space-y-3 relative text-left">
                            <div className="flex items-center justify-between border-b pb-3">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-purple-600 text-white font-bold">{parsed.category}</Badge>
                                <span className="font-bold text-xs text-purple-600 font-mono">{parsed.email}</span>
                                <span className="text-[10px] text-gray-400 border-l pl-2 font-bold font-mono">
                                  {new Date(item.created_at).toLocaleString()}
                                </span>
                              </div>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-8 self-end" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4 mr-1" /> 삭제
                              </Button>
                            </div>
                            <h4 className="font-extrabold text-slate-900 text-base">{item.title}</h4>
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl whitespace-pre-wrap">{parsed.message}</p>
                          </div>
                        );
                      }

                      if (activeTab === 'notices') {
                        const isImportant = item.title.includes('[필독]') || item.title.includes('[중요]');
                        return (
                          <div key={item.id} className="p-6 border rounded-2xl hover:border-purple-200 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                {isImportant && <Badge className="bg-red-500 text-white text-[10px]">중요</Badge>}
                                <Badge className={item.active ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-gray-100 text-gray-500"}>
                                  {item.active ? '노출중' : '비활성'}
                                </Badge>
                                <span className="text-xs text-gray-400 font-bold font-mono">
                                  {new Date(item.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <h4 className="font-extrabold text-slate-900 text-lg">{item.title}</h4>
                              <p className="text-sm text-gray-500 line-clamp-2 leading-normal whitespace-pre-wrap">{item.content}</p>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                              <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 font-bold gap-1" onClick={() => startEdit(item)}>
                                <Edit className="w-3.5 h-3.5" /> 수정
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-9 rounded-xl font-bold" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4" /> 
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      if (activeTab === 'faqs') {
                        let parsed = { answer: item.content || '', category: '일반' };
                        try {
                          if (item.content?.startsWith('{')) {
                            parsed = JSON.parse(item.content);
                          }
                        } catch (e) {}

                        return (
                          <div key={item.id} className="p-6 border rounded-2xl hover:border-purple-200 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-purple-100 text-purple-600">{parsed.category}</Badge>
                                <Badge className={item.active ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-gray-100 text-gray-400"}>
                                  {item.active ? '노출중' : '비활성'}
                                </Badge>
                                <span className="text-xs text-slate-400 font-bold font-mono">{new Date(item.created_at).toLocaleDateString()}</span>
                              </div>
                              <h4 className="font-extrabold text-slate-900 text-base">{item.title}</h4>
                              <p className="text-sm text-slate-500 whitespace-pre-wrap">{parsed.answer}</p>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                              <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 font-bold gap-1" onClick={() => startEdit(item)}>
                                <Edit className="w-3.5 h-3.5" /> 수정
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-9 rounded-xl font-bold" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4" /> 
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      if (activeTab === 'schedules') {
                        let parsed = { date: '', time: '', category: '정규 강의', color: 'purple', description: item.content || '' };
                        try {
                          if (item.content?.startsWith('{')) {
                            parsed = JSON.parse(item.content);
                          }
                        } catch (e) {}

                        const colorClasses: Record<string, string> = {
                          purple: 'bg-purple-50 text-purple-700 border-purple-200',
                          rose: 'bg-rose-50 text-rose-700 border-rose-200',
                          blue: 'bg-blue-50 text-blue-700 border-blue-200',
                          emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          amber: 'bg-amber-50 text-amber-700 border-amber-200',
                        };

                        return (
                          <div key={item.id} className="p-6 border rounded-2xl hover:border-purple-200 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-2">
                                <Badge className={colorClasses[parsed.color || 'purple'] || colorClasses.purple}>
                                  {parsed.category}
                                </Badge>
                                <span className="text-xs bg-slate-100 text-slate-750 font-bold px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                                  📅 {parsed.date || '날짜 미정'}
                                </span>
                                <span className="text-xs bg-slate-100 text-slate-750 font-bold px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                                  ⏱️ {parsed.time || '시간 미정'}
                                </span>
                                <Badge className={item.active ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-gray-100 text-gray-400"}>
                                  {item.active ? '노출중' : '비활성'}
                                </Badge>
                              </div>
                              <h4 className="font-extrabold text-slate-900 text-base">{item.title}</h4>
                              {parsed.description && (
                                <p className="text-xs sm:text-sm text-slate-500 whitespace-pre-wrap font-medium leading-relaxed mt-1">{parsed.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                              <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 font-bold gap-1" onClick={() => startEdit(item)}>
                                <Edit className="w-3.5 h-3.5" /> 수정
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-9 rounded-xl font-bold" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4" /> 
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      if (activeTab === 'suggestions') {
                        let parsed = { suggestionDetail: item.content || '', master: '없음', authorName: '익명', authorEmail: 'anonymous' };
                        try {
                          if (item.content?.startsWith('{')) {
                            parsed = JSON.parse(item.content);
                          }
                        } catch (e) {}

                        return (
                          <div key={item.id} className="p-6 border rounded-2xl bg-white hover:border-purple-200 hover:bg-slate-50/5 transition-all text-left space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-amber-100 text-amber-700 font-bold">강의 건의</Badge>
                                <span className="font-black text-xs text-slate-700">{parsed.authorName} 마스터 기여자 ({parsed.authorEmail})</span>
                                <span className="text-[10px] text-gray-400 font-bold font-mono pl-2 border-l">
                                  {new Date(item.created_at).toLocaleString()}
                                </span>
                              </div>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-8 self-end" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-lg font-black text-rose-950">💡 희망 강의 주제: {item.title}</h4>
                              <div className="bg-slate-50 p-4 rounded-xl border space-y-2">
                                <p className="text-xs font-black text-gray-400 uppercase">수강생 건의 내용:</p>
                                <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{parsed.suggestionDetail}</p>
                              </div>
                              {parsed.master && (
                                <p className="text-xs font-bold text-purple-600 pl-1 mt-1">⭐️ 희망하는 타겟 마스터: {parsed.master}</p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (activeTab === 'master_applies') {
                        let parsed = { name: '익명', field: '미공개', phone: '010', email: '', experience: '', link: '없음' };
                        try {
                          if (item.content?.startsWith('{')) {
                            parsed = JSON.parse(item.content);
                          }
                        } catch (e) {}

                        return (
                          <div key={item.id} className="p-6 border rounded-2xl bg-white hover:border-purple-200 transition-all text-left space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-emerald-100 text-emerald-700 font-black">강사 지원서</Badge>
                                <span className="font-black text-sm text-slate-800">{parsed.name} 마스터 지원 후보자</span>
                                <span className="text-xs text-gray-400 font-black border-l pl-2">{parsed.email} ({parsed.phone})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-bold font-mono mr-2">{new Date(item.created_at).toLocaleDateString()}</span>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-8 self-end" onClick={() => handleDelete(item.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-100/50">
                                <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">지원 희망 과목분야</p>
                                <p className="text-sm font-extrabold text-slate-800 mt-1">{parsed.field}</p>
                              </div>

                              <div className="bg-slate-50 p-4 rounded-xl border md:col-span-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">참고 링크 (유튜브/블로그 등)</p>
                                {parsed.link && parsed.link.startsWith('http') ? (
                                  <a href={parsed.link} target="_blank" rel="noreferrer" className="text-xs font-black text-purple-600 hover:underline block mt-1 break-all">
                                    {parsed.link} ➔
                                  </a>
                                ) : (
                                  <p className="text-sm font-bold text-slate-600 mt-1">{parsed.link}</p>
                                )}
                              </div>

                              <div className="p-4 bg-slate-50 rounded-xl border md:col-span-3 space-y-1.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">경력 및 활동 사항 기술내용:</p>
                                <p className="text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap">{parsed.experience}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setDeleteConfirmId(null)} />
          
          <Card className="relative w-full max-w-md border border-slate-200 bg-white p-6 shadow-2xl rounded-3xl text-center">
            <div className="pt-4 flex flex-col items-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900">정말로 삭제하시겠습니까?</h3>
              <p className="text-sm font-semibold text-slate-500 mt-2">
                이 작업은 되돌릴 수 없습니다. 삭제 후 화면에서 영구적으로 숨겨집니다.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl font-bold border-slate-200 hover:bg-slate-50"
                onClick={() => setDeleteConfirmId(null)}
                disabled={loading}
              >
                취소
              </Button>
              <Button
                className="w-full h-12 rounded-2xl font-black bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100"
                onClick={executeDelete}
                disabled={loading}
              >
                {loading ? '삭제 중...' : '확인 및 삭제'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
