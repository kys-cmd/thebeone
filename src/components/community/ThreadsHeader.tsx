import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Search, 
  MessageSquare, 
  Settings, 
  Plus, 
  Flame, 
  Bell, 
  Calendar,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Community } from '@/types';

interface ThreadsHeaderProps {
  user: any;
  activeMenu: string;
  onMenuClick: (menuKey: string) => void;
  selectedCommunity: Community | null;
  onBackToFeed: () => void;
  allCommunities: Community[];
  myJoinedCommunities: Community[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  onOpenChat: () => void;
  onOpenSettings?: () => void;
  onOpenInvite?: () => void;
}

export function ThreadsHeader({
  user,
  activeMenu,
  onMenuClick,
  selectedCommunity,
  onBackToFeed,
  allCommunities,
  myJoinedCommunities,
  searchQuery,
  onSearchChange,
  showSearch,
  onToggleSearch,
  onOpenChat,
  onOpenSettings,
  onOpenInvite,
}: ThreadsHeaderProps) {
  const mainTabs = [
    { key: 'home-latest', label: '추천 피드', icon: Sparkles },
    { key: 'home-popular', label: '인기 피드', icon: Flame },
    { key: 'notice', label: '공지사항', icon: Bell },
    { key: 'schedule', label: '강의 일정', icon: Calendar },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-[640px] mx-auto px-4">
        {/* Top bar */}
        <div className="h-14 flex items-center justify-between gap-3">
          {selectedCommunity ? (
            /* Selected Community Header */
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBackToFeed}
                className="w-9 h-9 rounded-full text-slate-700 hover:bg-slate-100 shrink-0 -ml-1.5"
                title="전체 피드로 돌아가기"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-black text-slate-900 truncate">
                    {selectedCommunity.name}
                  </h1>
                </div>
                <p className="text-[11px] text-slate-400 font-bold truncate">
                  {((selectedCommunity as any).member_count ?? (selectedCommunity as any).memberCount)
                    ? `${(selectedCommunity as any).member_count ?? (selectedCommunity as any).memberCount}명의 회원 참여 중`
                    : '전용 커뮤니티 공간'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onOpenInvite && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenInvite}
                    className="w-8 h-8 rounded-full text-slate-600 hover:bg-slate-100"
                    title="초대 양식"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
                {onOpenSettings && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    className="w-8 h-8 rounded-full text-slate-600 hover:bg-slate-100"
                    title="커뮤니티 옵션"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Threads Main Brand & Navigation */
            <div className="flex items-center justify-between w-full">
              <div 
                onClick={onBackToFeed}
                className="flex items-center gap-2 cursor-pointer select-none group"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
                  @
                </div>
                <span className="text-lg font-black text-slate-900 tracking-tight">
                  커뮤니티
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSearch}
                  className={cn(
                    "w-9 h-9 rounded-full transition-colors",
                    showSearch ? "bg-purple-50 text-purple-600" : "text-slate-600 hover:bg-slate-100"
                  )}
                  title="검색"
                >
                  <Search className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  onClick={onOpenChat}
                  className="h-8 px-3 rounded-full text-xs font-black border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-all flex items-center gap-1.5 shadow-none"
                  title="1:1 실시간 채팅 창 열기"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>채팅</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Search Bar Collapsible */}
        {showSearch && !selectedCommunity && (
          <div className="pb-3 pt-1 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="스레드 본문, 작성자, 태그(#) 검색..."
                className="h-9.5 pl-9.5 pr-8 bg-slate-100/80 border-transparent rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:ring-purple-600"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Threads Main Tabs */}
        {!selectedCommunity && (
          <div className="flex items-center justify-between border-t border-slate-100 select-none">
            {mainTabs.map((tab) => {
              const isActive = activeMenu === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => onMenuClick(tab.key)}
                  className={cn(
                    "flex-1 py-3 text-xs sm:text-sm font-black text-center relative transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
                    isActive ? "text-slate-900 font-extrabold" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-purple-600" : "text-slate-400")} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="threadsHeaderActiveTab"
                      className="absolute bottom-0 left-3 right-3 h-[2px] bg-slate-900 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Communities Filter Pill Bar */}
        {!selectedCommunity && (activeMenu === 'home-latest' || activeMenu === 'home-popular') && (
          <div className="py-2.5 overflow-x-auto no-scrollbar flex items-center gap-1.5 border-t border-slate-100/70">
            <button
              onClick={() => onMenuClick('home-latest')}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-black whitespace-nowrap transition-all shrink-0 cursor-pointer",
                activeMenu === 'home-latest' && !selectedCommunity
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              전체 피드
            </button>

            {myJoinedCommunities.map((comm) => (
              <button
                key={comm.id}
                onClick={() => onMenuClick(comm.id)}
                className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all shrink-0 flex items-center gap-1 border border-purple-100 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                {comm.name}
              </button>
            ))}

            {allCommunities
              .filter((c) => !myJoinedCommunities.some((m) => m.id === c.id))
              .slice(0, 10)
              .map((comm) => (
                <button
                  key={comm.id}
                  onClick={() => onMenuClick(comm.id)}
                  className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all shrink-0 cursor-pointer"
                >
                  {comm.name}
                </button>
              ))}
          </div>
        )}
      </div>
    </header>
  );
}
