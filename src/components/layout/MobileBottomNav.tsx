import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Users, 
  MessageSquare, 
  MessageCircle, 
  GraduationCap, 
  Sparkles, 
  Award, 
  Tv, 
  ChevronRight, 
  X,
  Compass
} from 'lucide-react';
import { cmsService, CommunityCategory } from '@/services/cmsService';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSheet, setActiveSheet] = useState<'lectures' | 'community' | null>(null);
  const [communities, setCommunities] = useState<CommunityCategory[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);

  // Load actual database communities list when the sheet is opened or mounted
  useEffect(() => {
    const fetchCommunities = async () => {
      setLoadingCommunities(true);
      try {
        const list = await cmsService.getCommunityCategories();
        // Only active non-deleted ones
        setCommunities(list.filter(c => c.active));
      } catch (err) {
        console.error('Failed to load communities on mobile bottom-nav:', err);
      } finally {
        setLoadingCommunities(false);
      }
    };
    fetchCommunities();
  }, []);

  // Determine current active button based on routing path
  const isLecturesActive = ['/courses', '/special', '/beone', '/live'].some(path => location.pathname.startsWith(path));
  const isCommunityActive = location.pathname.startsWith('/community');
  const isChatActive = location.pathname.startsWith('/chat');

  const handleTabClick = (tab: 'lectures' | 'community' | 'chat') => {
    if (tab === 'chat') {
      setActiveSheet(null);
      navigate('/chat');
    } else if (tab === 'community') {
      setActiveSheet(null);
      navigate('/community');
    } else {
      if (activeSheet === tab) {
        setActiveSheet(null); // Toggle close
      } else {
        setActiveSheet(tab); // Open sheet
      }
    }
  };

  return (
    <>
      {/* 1. Backdrop Overlay for Bottom Sheets */}
      <AnimatePresence>
        {activeSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveSheet(null)}
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* 2. Interactive Bottom Sheets */}
      <AnimatePresence>
        {activeSheet === 'lectures' && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-16 left-0 right-0 z-50 bg-white rounded-t-[2.5rem] border-t border-slate-100 p-6 pb-10 shadow-2xl flex flex-col gap-4 md:hidden"
          >
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" onClick={() => setActiveSheet(null)} />
            
            <div className="flex items-center justify-between mt-2">
              <h3 className="text-lg font-black text-slate-900">비원 아카데미 강의실</h3>
              <button 
                onClick={() => setActiveSheet(null)} 
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 active:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-slate-400 font-bold mb-2">원하시는 학습 강의 형태를 선택해 보세요.</p>
            
            {/* Lecture Submenus Selection Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              <Link 
                to="/courses" 
                onClick={() => setActiveSheet(null)}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-28 transition-all ${
                  location.pathname === '/courses' 
                    ? 'border-purple-200 bg-purple-50/40 text-purple-900 shadow-sm' 
                    : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-[14px]">정규 강의</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">체계적인 명품 과정</p>
                </div>
              </Link>

              <Link 
                to="/special" 
                onClick={() => setActiveSheet(null)}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-28 transition-all ${
                  location.pathname === '/special' 
                    ? 'border-purple-200 bg-purple-50/40 text-purple-900 shadow-sm' 
                    : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-[14px]">특강</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">최신 트렌드 특별 수강</p>
                </div>
              </Link>

              <Link 
                to="/live" 
                onClick={() => setActiveSheet(null)}
                className={`col-span-2 p-4 rounded-2xl border text-left flex items-center justify-between h-20 transition-all ${
                  location.pathname === '/live' 
                    ? 'border-purple-200 bg-purple-50/40 text-purple-900 shadow-sm' 
                    : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-600 relative shrink-0">
                    <Tv className="w-5 h-5" />
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  </div>
                  <div>
                    <h4 className="font-black text-[14px] flex items-center gap-1">
                      비원Live
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">실시간 스트리밍</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </Link>
            </div>
          </motion.div>
        )}

        {activeSheet === 'community' && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-16 left-0 right-0 z-50 bg-white rounded-t-[2.5rem] border-t border-slate-100 p-6 pb-10 shadow-2xl flex flex-col gap-4 md:hidden"
          >
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" onClick={() => setActiveSheet(null)} />
            
            <div className="flex items-center justify-between mt-2">
              <h3 className="text-lg font-black text-slate-900">비원 소통 공간</h3>
              <button 
                onClick={() => setActiveSheet(null)} 
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 active:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-bold mb-1">참가하고 싶으신 소통 채널과 가입 승인 커뮤니티 목록입니다.</p>

            <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2.5">
              {/* Default Channel (All Community) */}
              <Link
                to="/community"
                onClick={() => setActiveSheet(null)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-50/30 to-slate-50 border border-slate-100 hover:bg-slate-50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                    <Compass className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-800">커뮤니티 광장 전체보기</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">모든 회원 간의 폭넓은 비즈니스 소통</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
              </Link>

              {/* Real-time Dynamic community lists */}
              {loadingCommunities ? (
                <div className="py-8 text-center text-xs text-slate-400 font-bold animate-pulse">
                  열린 통로(커뮤니티)를 로드하는 중...
                </div>
              ) : communities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  현재 개설된 세부 전용 채널이 없습니다.
                </div>
              ) : (
                communities.map((comm) => (
                  <Link
                    key={comm.id}
                    to={`/community?category=${encodeURIComponent(comm.name)}`}
                    onClick={() => setActiveSheet(null)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: comm.color || '#9333ea' }}
                      >
                        <span className="text-xs font-black">{comm.name.substring(0, 2)}</span>
                      </div>
                      <div>
                        <h4 className="font-black text-xs text-slate-800 block leading-tight">{comm.name}</h4>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5 max-w-[200px] truncate">{comm.description || '비원 회원전용 소통 공간'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                  </Link>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Floating Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center px-6 pb-2.5 pt-1.5 z-40 md:hidden shadow-lg select-none">
        {/* Tab 1: Lectures */}
        <button 
          onClick={() => handleTabClick('lectures')}
          className="flex flex-col items-center justify-center w-20 h-full gap-1 outline-none transition-transform active:scale-95"
          id="btn_m_lectures"
        >
          <div className={`p-1 rounded-xl transition-all ${isLecturesActive || activeSheet === 'lectures' ? 'text-purple-600' : 'text-slate-400'}`}>
            <BookOpen className="w-6 h-6 stroke-[2.3]" />
          </div>
          <span className={`text-[10px] font-black tracking-tight transition-colors ${isLecturesActive || activeSheet === 'lectures' ? 'text-purple-600' : 'text-slate-400'}`}>
            강의
          </span>
        </button>

        {/* Tab 2: Community */}
        <button 
          onClick={() => handleTabClick('community')}
          className="flex flex-col items-center justify-center w-20 h-full gap-1 outline-none transition-transform active:scale-95"
          id="btn_m_community"
        >
          <div className={`p-1 rounded-xl transition-all ${isCommunityActive || activeSheet === 'community' ? 'text-purple-600' : 'text-slate-400'}`}>
            <Users className="w-6 h-6 stroke-[2.3]" />
          </div>
          <span className={`text-[10px] font-black tracking-tight transition-colors ${isCommunityActive || activeSheet === 'community' ? 'text-purple-600' : 'text-slate-400'}`}>
            커뮤니티
          </span>
        </button>

        {/* Tab 3: Chat */}
        <button 
          onClick={() => handleTabClick('chat')}
          className="flex flex-col items-center justify-center w-20 h-full gap-1 outline-none transition-transform active:scale-95"
          id="btn_m_chat"
        >
          <div className={`p-1 rounded-xl transition-all ${isChatActive ? 'text-purple-600 animate-pulse' : 'text-slate-400'}`}>
            <MessageCircle className="w-6 h-6 stroke-[2.3]" />
          </div>
          <span className={`text-[10px] font-black tracking-tight transition-colors ${isChatActive ? 'text-purple-600 font-black' : 'text-slate-400'}`}>
            채팅
          </span>
        </button>
      </div>
    </>
  );
}
