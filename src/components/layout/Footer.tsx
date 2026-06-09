import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, AtSign, Github, MessageCircle } from 'lucide-react';
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
    <footer className="w-full bg-gray-900 text-gray-300 pt-16 pb-8 border-t border-gray-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Col */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tighter text-white">{config?.site_name || '비원아카데미'}</span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              {config?.site_name || '비원아카데미'}는 여러분들이 당당한 단독자의 삶을 살고<br />
              시간으로부터의 자유를 얻는 데 도움을 드립니다.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-white transition-colors" title="네이버 블로그">
                <div className="w-5 h-5 bg-[#03C75A] text-white flex items-center justify-center rounded-sm text-xs font-black">N</div>
              </a>
              <a href="#" className="hover:text-white transition-colors" title="스레드">
                <AtSign className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Svc Col */}
          <div>
            <h4 className="text-white font-bold mb-6">강의 서비스</h4>
            <ul className="space-y-4 text-sm">
              <li><Link to="/courses" className="hover:text-purple-400 transition-colors">정규강의</Link></li>
              <li><Link to="/special?type=online" className="hover:text-purple-400 transition-colors">온라인 특강</Link></li>
              <li><Link to="/special?type=offline" className="hover:text-purple-400 transition-colors">오프라인 특강</Link></li>
              <li><Link to="/beone" className="hover:text-purple-400 transition-colors">비원커뮤니티회원전용</Link></li>
              <li><Link to="/live" className="hover:text-purple-400 transition-colors">비원아카데미 Live</Link></li>
              <li><Link to="/lifecoaching" className="hover:text-purple-400 transition-colors">라이프코칭</Link></li>
              <li><Link to="/techtree" className="hover:text-purple-400 transition-colors">자본주의 테크트리</Link></li>
            </ul>
          </div>

          {/* Support Col */}
          <div>
            <h4 className="text-white font-bold mb-6">고객지원</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><Link to="/support/notice" className="hover:text-purple-400 transition-colors">공지사항</Link></li>
              <li><Link to="/support/suggestion" className="hover:text-purple-400 transition-colors">강의 건의하기</Link></li>
              <li><Link to="/support/inquiry" className="hover:text-purple-400 transition-colors">1:1 문의</Link></li>
              <li><Link to="/support/faq" className="hover:text-purple-400 transition-colors">자주 묻는 질문(FAQ)</Link></li>
              <li><Link to="/support/apply" className="hover:text-purple-400 transition-colors">강사 지원</Link></li>
              <li className="pt-2">
                <div className="bg-gray-800 p-4 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">수강문의</p>
                  <p className="text-white font-bold">02-522-4777</p>
                  <p className="text-[10px] text-gray-500 mt-1">평일 11:00~18:00(주말/공휴일 제외)</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Legal Col */}
          <div>
            <h4 className="text-white font-bold mb-6">기업정보</h4>
            <div className="space-y-4 text-xs leading-relaxed text-gray-500 whitespace-pre-line">
              {config?.footer_info || `상호명: (주)비원아카데미\n대표자: 김*수\n사업자등록번호: 000-00-00000\n통신판매업신고: 2026-서울강남-0000\n주소: 서울특별시 강남구`}
              <div className="flex gap-4 pt-4 border-t border-gray-800">
                <Link to="/legal/terms" className="text-gray-400 hover:text-white">이용약관</Link>
                <Link to="/legal/privacy" className="text-gray-400 hover:text-white font-bold">개인정보처리방침</Link>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-gray-600">
          <p>© 2026 {config?.site_name || 'BE ONE: 비원아카데미'}. Built for your success.</p>
          <div className="flex gap-6">
            <Link to="/admin" className="hover:text-purple-400">ADMIN</Link>
            <Link to="/sitemap" className="hover:text-purple-400">SITEMAP</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
