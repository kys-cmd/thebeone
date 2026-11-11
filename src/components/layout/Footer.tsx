import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AtSign } from 'lucide-react';
import { cmsService, SiteConfig } from '@/services/cmsService';

export default function Footer() {
  const [config, setConfig] = useState<SiteConfig | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const data = await cmsService.getSiteConfig();
      setConfig(data);
    };
    loadConfig();

    const sub = cmsService.subscribeToSiteConfig((updatedConfig) => {
      setConfig(prev => ({ ...prev, ...updatedConfig }));
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  return (
    <footer className="w-full bg-slate-950 text-slate-300 pt-10 sm:pt-14 md:pt-16 pb-8 border-t border-slate-800/80 pb-safe">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
          {/* Brand Col */}
          <div className="col-span-2 lg:col-span-1 space-y-4 sm:space-y-5">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="text-lg sm:text-xl font-black tracking-tight text-white">
                {config?.site_name || '비원아카데미'}
              </span>
            </Link>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-400 break-keep">
              {config?.site_name || '비원아카데미'}는 여러분들이 당당한 단독자의 삶을 살고 시간으로부터의 자유를 얻는 데 도움을 드립니다.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="#"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center transition-colors"
                title="네이버 블로그"
              >
                <span className="w-4 h-4 bg-[#03C75A] text-white flex items-center justify-center rounded-xs text-[10px] font-black">
                  N
                </span>
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                title="스레드"
              >
                <AtSign className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Svc Col */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4 sm:mb-5">강의 서비스</h4>
            <ul className="space-y-2.5 sm:space-y-3.5 text-xs sm:text-sm text-slate-400">
              <li><Link to="/courses" className="hover:text-white transition-colors inline-block py-0.5">정규강의</Link></li>
              <li><Link to="/special?type=online" className="hover:text-white transition-colors inline-block py-0.5">온라인 특강</Link></li>
              <li><Link to="/special?type=offline" className="hover:text-white transition-colors inline-block py-0.5">오프라인 특강</Link></li>
              <li><Link to="/live" className="hover:text-white transition-colors inline-block py-0.5">비원Live</Link></li>
              <li><Link to="/membership" className="hover:text-white transition-colors inline-block py-0.5">비원 멤버십</Link></li>
            </ul>
          </div>

          {/* Support Col */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4 sm:mb-5">고객지원</h4>
            <ul className="space-y-2.5 sm:space-y-3.5 text-xs sm:text-sm text-slate-400">
              <li><Link to="/support/notice" className="hover:text-white transition-colors inline-block py-0.5">공지사항</Link></li>
              <li><Link to="/support/suggestion" className="hover:text-white transition-colors inline-block py-0.5">강의 건의하기</Link></li>
              <li><Link to="/support/inquiry" className="hover:text-white transition-colors inline-block py-0.5">1:1 문의</Link></li>
              <li><Link to="/support/faq" className="hover:text-white transition-colors inline-block py-0.5">자주 묻는 질문</Link></li>
              <li><Link to="/support/apply" className="hover:text-white transition-colors inline-block py-0.5">강사 지원</Link></li>
            </ul>
          </div>

          {/* Legal & Contact Col */}
          <div className="col-span-2 lg:col-span-1 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800/80 p-4 rounded-2xl">
              <p className="text-[11px] text-slate-400 mb-0.5">고객센터 수강문의</p>
              <p className="text-base sm:text-lg text-white font-extrabold tabular-nums">02-522-4777</p>
              <p className="text-[11px] text-slate-500 mt-0.5">평일 11:00 ~ 18:00 (주말·공휴일 휴무)</p>
            </div>
            <div className="space-y-3 text-[11px] sm:text-xs leading-relaxed text-slate-500 whitespace-pre-line">
              {config?.footer_info || `상호명: (주)비원아카데미\n대표자: 김*수 | 사업자등록번호: 000-00-00000\n통신판매업신고: 2026-서울강남-0000\n주소: 서울특별시 강남구`}
              <div className="flex items-center gap-4 pt-2 border-t border-slate-800/80">
                <Link to="/legal/terms" className="text-slate-400 hover:text-white transition-colors">이용약관</Link>
                <Link to="/legal/privacy" className="text-slate-300 hover:text-white font-bold transition-colors">개인정보처리방침</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 sm:mt-14 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-slate-500">
          <p>© 2026 {config?.site_name || 'BE ONE: 비원아카데미'}. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/admin" className="hover:text-slate-300 transition-colors">ADMIN</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
