import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
import { cmsService, SiteConfig } from '@/services/cmsService';
import { communityService } from '@/services/communityService';
import { chatService } from '@/services/chatService';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, LogIn, UserPlus, MessageSquare, BookOpen, Search, LogOut, Instagram, AtSign, ChevronRight, ChevronDown, Hash, Star, User, Bell, Inbox, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger
} from "@/components/ui/sheet";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService } from '@/services/notificationService';
import { Community } from '@/types';

export default function Header() {
  const { user, setUser } = useAuthStore();
  const { openChat } = useChatStore();
  const navigate = useNavigate();
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = async () => {
    if (!user) {
      setCartCount(0);
      return;
    }
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'PENDING');
      if (error) throw error;
      setCartCount(count || 0);
    } catch (err) {
      console.error('[Header] Fetch cart count err:', err);
    }
  };

  useEffect(() => {
    fetchCartCount();

    const handleCartUpdate = () => {
      fetchCartCount();
    };

    window.addEventListener('cart-updated', handleCartUpdate);
    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await notificationService.getNotificationsForUser(user.id);
      setNotifications(data || []);
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('[Header] Notify fetch err:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    
    fetchNotifications();

    const sub = notificationService.subscribeToNotifications(() => {
      fetchNotifications();
    });

    return () => {
      sub.unsubscribe();
    };
  }, [user]);

  const handleMarkAsRead = async (id: string, link?: string) => {
    if (!user) return;
    try {
      await notificationService.markAsRead(id, user.id);
      fetchNotifications();
      if (link) {
        navigate(link);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    try {
      await notificationService.markAllAsRead(user.id);
      toast.success('모든 알림을 읽음 처리했습니다.');
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      const config = await cmsService.getSiteConfig();
      setSiteConfig(config);
    };

    loadConfig();

    const sub = cmsService.subscribeToSiteConfig((updatedConfig) => {
      // Merge with default/current config to ensure no fields are lost
      setSiteConfig(prev => ({
        ...prev,
        ...updatedConfig
      } as SiteConfig));
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      communityService.getJoinedCommunities(user.id).then(setJoinedCommunities);
    } else {
      setJoinedCommunities([]);
    }
  }, [user]);

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
    navigate('/');
  };



  return (
    <div className="flex flex-col w-full relative z-50">
      {/* Top Event Banner */}
      {siteConfig?.event_banner_show && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          onClick={() => {
            if (siteConfig.event_banner_link) {
              const link = siteConfig.event_banner_link.trim();
              if (link.startsWith('http')) {
                window.open(link, '_blank');
              } else if (link.startsWith('/')) {
                navigate(link);
              } else {
                // Default to navigate if it's a relative path
                navigate(`/${link}`);
              }
            }
          }}
          style={{ 
            backgroundColor: siteConfig.event_banner_bg_color || '#9333ea',
            color: siteConfig.event_banner_text_color || '#ffffff'
          }}
          className="w-full overflow-hidden flex items-center justify-center font-bold py-3 px-4 text-center cursor-pointer relative hover:brightness-110 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
            <span className="bg-white text-gray-900 px-2 py-0.5 rounded-full text-[10px] shrink-0">HOT</span>
            <p className="text-xs md:text-base tracking-tight truncate">
              {siteConfig.event_banner_text}
            </p>
          </div>
        </motion.div>
      )}

      <header className="sticky top-0 w-full border-b bg-white/95 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          {/* Logo (Left) */}
          <div className="flex items-center gap-10 flex-shrink-0">
            <Link to="/" className="flex items-center gap-2 group">
              {siteConfig?.logo_url ? (
                <img src={siteConfig.logo_url} alt={siteConfig.site_name} className="h-[18px] sm:h-[25px] w-auto object-contain" />
              ) : (
                <>
                  <div className="w-7 h-7 sm:w-9 sm:h-9 bg-purple-600 rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shrink-0">
                    <span className="text-white font-black text-sm sm:text-xl">
                      {siteConfig?.site_name ? siteConfig.site_name.charAt(0) : 'B'}
                    </span>
                  </div>
                  <span className="text-base sm:text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-600">
                    {siteConfig?.site_name || '비원아카데미'}
                  </span>
                </>
              )}
            </Link>
          </div>

          {/* GNAV (Center) */}
          <div className="hidden lg:flex flex-1 items-center justify-center px-8">
            
            <nav className="flex items-center gap-8 text-[15px] font-bold text-gray-700">
              <Link to="/courses" className="hover:text-purple-600 transition-colors">정규강의</Link>
              <Link to="/special" className="hover:text-purple-600 transition-colors">특강</Link>
              
              {/* 비원커뮤니티회원전용 & 비원Live 드롭다운 */}
              <DropdownMenu>
                <DropdownMenuTrigger className="hover:text-purple-600 transition-colors flex items-center gap-1 outline-none cursor-pointer">
                  <span>비원커뮤니티회원전용</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="p-2 w-48 rounded-xl shadow-xl border border-slate-100 bg-white mt-2">
                  <DropdownMenuItem className="focus:bg-purple-50 rounded-lg cursor-pointer">
                    <Link to="/beone" className="w-full h-full block py-1.5 text-sm font-bold text-gray-700 hover:text-purple-600">
                      비원커뮤니티회원전용 메인
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-purple-50 rounded-lg cursor-pointer">
                    <Link to="/live" className="w-full h-full block py-1.5 text-sm font-bold text-gray-700 hover:text-purple-600 flex items-center justify-between">
                      <span>비원Live</span>
                      <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link to="/lifecoaching" className="hover:text-purple-600 transition-colors">라이프코칭</Link>
              <Link to="/techtree" className="hover:text-purple-600 transition-colors">자본주의 테크트리</Link>
              <Link to="/community" className="hover:text-purple-600 transition-colors">커뮤니티</Link>
              {user && (
                <Link to="/mypage?tab=classroom" className="text-purple-600 hover:text-purple-700 font-extrabold transition-colors flex items-center gap-1">
                  <span>내 강의실</span>
                  <span className="flex h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse" />
                </Link>
              )}
            </nav>
          </div>

          {/* Actions & Social (Right) */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {/* 알림 서비스 벨 버튼 */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <div
                    className="relative cursor-pointer rounded-full h-10 w-10 text-gray-700 hover:bg-slate-50 transition-colors mr-1 shrink-0 flex items-center justify-center"
                    title="실시간 알림창"
                  >
                    <Bell className="h-5.5 w-5.5 text-purple-600" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 bg-red-500 text-white font-mono text-[9px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[340px] max-h-[480px] p-2 shadow-2xl rounded-2xl border border-slate-100 mt-2 flex flex-col">
                  <div className="p-3 border-b flex justify-between items-center bg-slate-50/50 rounded-t-xl shrink-0">
                    <span className="font-extrabold text-xs text-slate-800">새로운 알림</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] text-purple-600 hover:underline font-extrabold cursor-pointer"
                      >
                        전체 읽음
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto max-h-[360px] py-1 text-left select-none no-scrollbar flex-1">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 p-4">
                        <Inbox className="w-8 h-8 text-gray-300" />
                        받은 새 알림 메시지가 없습니다.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <DropdownMenuItem 
                           key={notif.id}
                           onClick={() => handleMarkAsRead(notif.id, notif.link)}
                           className={cn(
                             "p-3 rounded-xl cursor-pointer flex flex-col items-start gap-1 font-semibold text-xs leading-normal border-b border-white last:border-none focus:bg-purple-50",
                             notif.isRead ? "opacity-60 bg-white" : "bg-purple-50/30"
                           )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-extrabold text-purple-800 text-[10px] uppercase">
                              {notif.category === 'chat' ? '채팅' : notif.category === 'notice' ? '공지' : '서비스 알림'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold font-mono">
                              {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <span className="font-black text-slate-900 leading-tight block truncate w-full">{notif.title}</span>
                          <span className="text-slate-500 font-bold line-clamp-2 leading-relaxed">{notif.message}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 채팅방 띄우기 버튼 - 모바일에서는 숨김(hidden lg:flex) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (user) {
                  const width = 1300;
                  const height = 800;
                  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
                  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
                  window.open(
                    '/chat?popup=true',
                    'BOneChatWindow',
                    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,location=no,scrollbars=yes,resizable=yes`
                  );
                } else {
                  toast.error('로그인이 필요한 서비스입니다.');
                  navigate('/auth/login');
                }
              }}
              className="hidden lg:flex relative rounded-full h-10 w-10 text-gray-700 hover:bg-slate-50 transition-colors mr-1 shrink-0"
              title="실시간 메신저 Lounge"
            >
              <MessageSquare className="h-5.5 w-5.5 text-purple-600" />
              {user && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
              )}
            </Button>

            {/* 수강 바구니 퀵 버튼 - 모바일에서는 숨김(hidden lg:flex) */}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/cart')}
                className="hidden lg:flex relative rounded-full h-10 w-10 text-gray-700 hover:bg-slate-50 transition-colors mr-1 shrink-0"
                title="수강 바구니"
              >
                <ShoppingCart className="h-5.5 w-5.5 text-purple-600" />
                {cartCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-purple-600 text-white font-mono text-[9px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                    {cartCount}
                  </span>
                )}
              </Button>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-full outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 transition-all">
                    <Avatar className="h-10 w-10 cursor-pointer border-2 border-purple-100 hover:border-purple-300 transition-all shadow-sm">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-purple-600 text-white font-bold">{(user.nickname || user.name || 'U')[0]}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-2 shadow-2xl rounded-xl border-purple-100 mt-2">
                    <div className="p-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-base text-gray-900">{user.nickname || user.name || '사용자'}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/mypage')} className="p-3 rounded-lg cursor-pointer">마이페이지</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/mypage?tab=classroom')} className="p-3 rounded-lg cursor-pointer">내 강의실</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/cart')} className="p-3 rounded-lg cursor-pointer flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-purple-600 animate-pulse" />
                        <span className="font-semibold text-slate-700">수강 바구니 (장바구니)</span>
                      </div>
                      {cartCount > 0 && (
                        <Badge className="bg-purple-600 text-white font-bold font-mono text-[10px] h-5 min-w-5 rounded-full flex items-center justify-center p-0.5">
                          {cartCount}
                        </Badge>
                      )}
                    </DropdownMenuItem>
                    {(user.role === 'admin' || user.role === 'super_admin') && (
                      <DropdownMenuItem 
                        onClick={() => navigate('/admin')}
                        className="p-3 rounded-lg text-purple-600 font-bold cursor-pointer"
                      >
                        관리자 페이지
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="p-3 rounded-lg text-red-600 font-medium focus:text-red-600 cursor-pointer" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/auth/login">
                  <Button variant="ghost" className="font-bold text-gray-700 text-xs sm:text-sm px-2.5 sm:px-4">로그인</Button>
                </Link>
                <Link to="/auth/register" className="hidden sm:inline-block">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full px-6 shadow-lg shadow-purple-200">회원가입</Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Trigger - 가장 오른쪽에 위치 */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="text-gray-700 h-10 w-10 active:scale-95 transition-transform cursor-pointer" />}>
                    <Menu className="h-6 w-6" />
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] p-0">
                  <div className="flex flex-col h-full bg-white">
                    <div className="p-6 border-b">
                      <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center animate-pulse">
                          <span className="text-white font-black text-lg">
                            {siteConfig?.site_name ? siteConfig.site_name.charAt(0) : 'B'}
                          </span>
                        </div>
                        <span className="text-xl font-black tracking-tighter text-gray-900">
                          {siteConfig?.site_name || '비원아카데미'}
                        </span>
                      </Link>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto py-6 px-4">
                      <nav className="flex flex-col gap-2">
                        {user && (
                          <Link to="/mypage?tab=classroom" className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors font-black text-purple-700 border border-purple-100/50">
                            <BookOpen className="w-5 h-5 text-purple-600 animate-bounce" /> 내 강의실 바로가기
                          </Link>
                        )}
                        <Link to="/courses" className="flex items-center gap-3 p-4 rounded-xl hover:bg-purple-50 transition-colors font-bold text-gray-700">
                          <BookOpen className="w-5 h-5 text-purple-600" /> 정규강의
                        </Link>
                        <Link to="/special" className="flex items-center gap-3 p-4 rounded-xl hover:bg-purple-50 transition-colors font-bold text-gray-700">
                          <Star className="w-5 h-5 text-purple-600" /> 특강
                        </Link>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/30 overflow-hidden flex flex-col">
                          <Link to="/beone" className="flex items-center gap-3 p-4 hover:bg-purple-50 transition-colors font-bold text-gray-700 border-b border-dashed border-slate-100">
                            <Badge className="bg-purple-100 text-purple-600 border-none scale-90">B1</Badge> 비원커뮤니티회원전용 메인
                          </Link>
                          <Link to="/live" className="flex items-center gap-3 p-4 pl-10 hover:bg-purple-50 transition-colors font-bold text-gray-700">
                            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> 비원Live
                          </Link>
                        </div>
                        <Link to="/lifecoaching" className="flex items-center gap-3 p-4 rounded-xl hover:bg-purple-50 transition-colors font-bold text-gray-700">
                          <User className="w-5 h-5 text-purple-600" /> 라이프코칭
                        </Link>
                        <Link to="/techtree" className="flex items-center gap-3 p-4 rounded-xl hover:bg-purple-50 transition-colors font-bold text-gray-700">
                          <Hash className="w-5 h-5 text-purple-600" /> 자본주의 테크트리
                        </Link>
                        <Link to="/community" className="flex items-center gap-3 p-4 rounded-xl hover:bg-purple-50 transition-colors font-bold text-gray-700">
                          <MessageSquare className="w-5 h-5 text-purple-600" /> 커뮤니티
                        </Link>
                      </nav>
                    </div>

                    {!user && (
                      <div className="p-6 border-t bg-gray-50 flex flex-col gap-2">
                        <Link to="/auth/login" className="w-full">
                          <Button variant="outline" className="w-full rounded-xl font-bold">로그인</Button>
                        </Link>
                        <Link to="/auth/register" className="w-full">
                          <Button className="w-full bg-purple-600 text-white rounded-xl font-bold">회원가입</Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
