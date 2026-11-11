import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
import { cmsService, SiteConfig } from '@/services/cmsService';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Menu,
  MessageSquare,
  BookOpen,
  LogOut,
  ChevronRight,
  Star,
  User,
  Bell,
  Inbox,
  ShoppingCart,
  Award,
  Radio,
  HelpCircle,
  Megaphone,
  Shield
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { motion } from 'motion/react';
import { notificationService } from '@/services/notificationService';

export default function Header() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer automatically on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

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
      setSiteConfig(prev => ({
        ...prev,
        ...updatedConfig
      } as SiteConfig));
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await authService.signOut();
    setUser(null);
    navigate('/');
  };

  const isNavActive = (path: string) => {
    if (path === '/mypage?tab=classroom') {
      return location.pathname === '/mypage' && location.search.includes('classroom');
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="sticky top-0 w-full z-50 flex flex-col">
      {/* Top Event Banner */}
      {siteConfig?.event_banner_show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => {
            if (siteConfig.event_banner_link) {
              const link = siteConfig.event_banner_link.trim();
              if (link.startsWith('http')) {
                window.location.href = link;
              } else if (link.startsWith('/')) {
                navigate(link);
              } else {
                navigate(`/${link}`);
              }
            }
          }}
          style={{
            backgroundColor: siteConfig.event_banner_bg_color || '#9333ea',
            color: siteConfig.event_banner_text_color || '#ffffff'
          }}
          className="w-full overflow-hidden flex items-center justify-center font-bold py-2 sm:py-2.5 px-4 text-center cursor-pointer hover:brightness-105 transition-all"
        >
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden max-w-full">
            <span className="bg-white/95 text-slate-900 px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0">
              NOTICE
            </span>
            <p className="text-xs sm:text-sm tracking-tight truncate">
              {siteConfig.event_banner_text}
            </p>
          </div>
        </motion.div>
      )}

      <header className="w-full border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="container mx-auto px-4 h-14 sm:h-16 lg:h-20 flex items-center justify-between gap-4">
          {/* Brand Logo (Left) */}
          <div className="flex items-center shrink-0">
            <Link to="/" className="flex items-center gap-2 group py-1">
              {siteConfig?.logo_url ? (
                <img
                  src={siteConfig.logo_url}
                  alt={siteConfig.site_name}
                  className="h-[20px] sm:h-[24px] w-auto object-contain"
                />
              ) : (
                <>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-600 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-sm sm:text-lg">
                      {siteConfig?.site_name ? siteConfig.site_name.charAt(0) : 'B'}
                    </span>
                  </div>
                  <span className="text-base sm:text-xl lg:text-2xl font-black tracking-tight text-slate-900 whitespace-nowrap">
                    {siteConfig?.site_name || '비원아카데미'}
                  </span>
                </>
              )}
            </Link>
          </div>

          {/* Desktop GNAV (Center) */}
          <div className="hidden lg:flex flex-1 items-center justify-center px-6">
            <nav className="flex items-center gap-8 text-[15px] font-bold text-slate-700">
              <Link
                to="/courses"
                className={cn(
                  'hover:text-purple-600 transition-colors whitespace-nowrap',
                  isNavActive('/courses') && 'text-purple-600'
                )}
              >
                정규강의
              </Link>
              <Link
                to="/special"
                className={cn(
                  'hover:text-purple-600 transition-colors whitespace-nowrap',
                  isNavActive('/special') && 'text-purple-600'
                )}
              >
                특강
              </Link>
              <Link
                to="/live"
                className={cn(
                  'hover:text-purple-600 transition-colors flex items-center gap-1.5 whitespace-nowrap',
                  isNavActive('/live') && 'text-purple-600'
                )}
              >
                <span>비원Live</span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </Link>
              <Link
                to="/membership"
                className={cn(
                  'hover:text-purple-600 transition-colors whitespace-nowrap',
                  isNavActive('/membership') && 'text-purple-600'
                )}
              >
                비원 멤버십
              </Link>
              <Link
                to="/support/inquiry"
                className={cn(
                  'hover:text-purple-600 transition-colors whitespace-nowrap',
                  isNavActive('/support/inquiry') && 'text-purple-600'
                )}
              >
                1:1 문의
              </Link>
              {user && (
                <Link
                  to="/mypage?tab=classroom"
                  className="text-purple-600 hover:text-purple-700 font-extrabold transition-colors whitespace-nowrap"
                >
                  내 강의실
                </Link>
              )}
            </nav>
          </div>

          {/* Actions (Right) */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
            {/* Notification Bell */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  <div
                    className="relative cursor-pointer rounded-full h-10 w-10 text-slate-700 hover:bg-slate-100 active:bg-slate-200/70 transition-colors shrink-0 flex items-center justify-center"
                    title="알림"
                  >
                    <Bell className="h-5 w-5 text-slate-700" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-red-500 text-white font-mono text-[9px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[calc(100vw-24px)] max-w-[340px] max-h-[440px] p-2 shadow-2xl rounded-2xl border border-slate-100 mt-2 flex flex-col"
                >
                  <div className="p-3 border-b flex justify-between items-center bg-slate-50/70 rounded-t-xl shrink-0">
                    <span className="font-extrabold text-xs text-slate-800">새로운 알림</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[11px] text-purple-600 hover:underline font-extrabold cursor-pointer"
                      >
                        전체 읽음
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto max-h-[340px] py-1 text-left select-none no-scrollbar flex-1">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center gap-2 p-4">
                        <Inbox className="w-8 h-8 text-slate-300" />
                        받은 새 알림이 없습니다.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <DropdownMenuItem
                          key={notif.id}
                          onClick={() => handleMarkAsRead(notif.id, notif.link)}
                          className={cn(
                            'p-3 rounded-xl cursor-pointer flex flex-col items-start gap-1 font-semibold text-xs leading-normal border-b border-slate-50 last:border-none focus:bg-purple-50',
                            notif.isRead ? 'opacity-60 bg-white' : 'bg-purple-50/30'
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-extrabold text-purple-700 text-[10px]">
                              {notif.category === 'chat' ? '채팅' : notif.category === 'notice' ? '공지' : '알림'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium font-mono tabular-nums">
                              {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 leading-tight block truncate w-full">{notif.title}</span>
                          <span className="text-slate-500 font-medium line-clamp-2 leading-relaxed">{notif.message}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Cart Button (Visible on both Mobile & Desktop when logged in) */}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/cart')}
                className="relative rounded-full h-10 w-10 text-slate-700 hover:bg-slate-100 shrink-0"
                title="수강 바구니"
              >
                <ShoppingCart className="h-5 w-5 text-slate-700" />
                {cartCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-purple-600 text-white font-mono text-[9px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-xs tabular-nums">
                    {cartCount}
                  </span>
                )}
              </Button>
            )}

            {/* Desktop Chat Trigger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (user) {
                  navigate('/chat');
                } else {
                  toast.error('로그인이 필요한 서비스입니다.');
                  navigate('/auth/login');
                }
              }}
              className="hidden lg:flex relative rounded-full h-10 w-10 text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              title="실시간 메신저"
            >
              <MessageSquare className="h-5 w-5 text-slate-700" />
            </Button>

            {/* User Profile Dropdown (Desktop) or Guest Auth Buttons */}
            {user ? (
              <div className="hidden lg:flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-full outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 transition-all">
                    <Avatar className="h-9 w-9 cursor-pointer border border-slate-200 hover:border-purple-300 transition-all">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-purple-600 text-white font-bold text-sm">
                        {(user.nickname || user.name || 'U')[0]}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 p-2 shadow-2xl rounded-2xl border-slate-100 mt-2">
                    <div className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-sm text-slate-900 truncate">
                          {user.nickname || user.name || '사용자'}
                        </span>
                        <span className="text-xs text-slate-400 truncate">{user.email}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/mypage')} className="p-2.5 rounded-xl cursor-pointer font-semibold text-sm">
                      마이페이지
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/mypage?tab=classroom')} className="p-2.5 rounded-xl cursor-pointer font-semibold text-sm">
                      내 강의실
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/cart')} className="p-2.5 rounded-xl cursor-pointer flex items-center justify-between text-sm">
                      <span className="font-semibold">수강 바구니</span>
                      {cartCount > 0 && (
                        <Badge className="bg-purple-600 text-white font-bold font-mono text-[10px] h-5 min-w-5 rounded-full flex items-center justify-center px-1.5">
                          {cartCount}
                        </Badge>
                      )}
                    </DropdownMenuItem>
                    {(user.role === 'admin' || user.role === 'super_admin') && (
                      <DropdownMenuItem
                        onClick={() => navigate('/admin')}
                        className="p-2.5 rounded-xl text-purple-600 font-bold cursor-pointer text-sm"
                      >
                        관리자 페이지
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="p-2.5 rounded-xl text-red-600 font-semibold focus:text-red-600 cursor-pointer text-sm"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link to="/auth/login">
                  <Button variant="ghost" className="font-bold text-slate-700 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 rounded-xl whitespace-nowrap">
                    로그인
                  </Button>
                </Link>
                <Link to="/auth/register" className="hidden sm:inline-block">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm h-10 rounded-full px-5 shadow-sm whitespace-nowrap">
                    회원가입
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Drawer (Right Side for Thumb Ergonomics) */}
            <div className="lg:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="메뉴 열기"
                      className="text-slate-800 h-10 w-10 rounded-full hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                    />
                  }
                >
                  <Menu className="h-5.5 w-5.5" />
                </SheetTrigger>
                <SheetContent side="right" className="w-[86vw] max-w-[340px] p-0 border-l border-slate-100">
                  <SheetTitle className="sr-only">모바일 전체 메뉴</SheetTitle>
                  <div className="flex flex-col h-full bg-white">
                    {/* Mobile Drawer Header / Profile Summary */}
                    <div className="p-5 pt-6 border-b border-slate-100 bg-slate-50/60">
                      {user ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 pr-6">
                            <Avatar className="h-11 w-11 border-2 border-white shadow-xs shrink-0">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-purple-600 text-white font-bold">
                                {(user.nickname || user.name || 'U')[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-sm text-slate-900 truncate">
                                {user.nickname || user.name || '수강생'} 님
                              </p>
                              <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Link
                              to="/mypage?tab=classroom"
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-transform"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              내 강의실
                            </Link>
                            <Link
                              to="/mypage"
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold active:scale-[0.98] transition-transform"
                            >
                              <User className="w-3.5 h-3.5" />
                              마이페이지
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 pr-6">
                          <div>
                            <p className="text-base font-extrabold text-slate-900">
                              {siteConfig?.site_name || '비원아카데미'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              로그인하고 맞춤형 강의를 만나보세요.
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <Link to="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                              <Button variant="outline" className="w-full h-10 rounded-xl font-bold text-xs">
                                로그인
                              </Button>
                            </Link>
                            <Link to="/auth/register" onClick={() => setIsMobileMenuOpen(false)}>
                              <Button className="w-full h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs">
                                회원가입
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobile Navigation Links */}
                    <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
                      <div className="space-y-1">
                        <p className="px-3 text-[11px] font-bold text-slate-400 mb-1.5">클래스 & 프로그램</p>
                        {[
                          { to: '/courses', label: '정규강의', icon: BookOpen },
                          { to: '/special', label: '특강', icon: Star },
                          { to: '/live', label: '비원Live', icon: Radio, liveDot: true },
                          { to: '/membership', label: '비원 멤버십', icon: Award },
                        ].map((item) => {
                          const Icon = item.icon;
                          const active = isNavActive(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center justify-between px-3.5 min-h-[48px] rounded-xl font-bold text-sm transition-colors',
                                active
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Icon className={cn('w-4.5 h-4.5', active ? 'text-purple-600' : 'text-slate-400')} />
                                <span>{item.label}</span>
                                {item.liveDot && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300" />
                            </Link>
                          );
                        })}
                      </div>

                      <div className="space-y-1 pt-3 border-t border-slate-100">
                        <p className="px-3 text-[11px] font-bold text-slate-400 mb-1.5">고객지원</p>
                        {[
                          { to: '/support/notice', label: '공지사항', icon: Megaphone },
                          { to: '/support/faq', label: '자주 묻는 질문', icon: HelpCircle },
                          { to: '/support/inquiry', label: '1:1 문의', icon: MessageSquare },
                        ].map((item) => {
                          const Icon = item.icon;
                          const active = isNavActive(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center justify-between px-3.5 min-h-[46px] rounded-xl font-semibold text-sm transition-colors',
                                active
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Icon className={cn('w-4.5 h-4.5', active ? 'text-purple-600' : 'text-slate-400')} />
                                <span>{item.label}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300" />
                            </Link>
                          );
                        })}
                      </div>

                      {user && (user.role === 'admin' || user.role === 'super_admin') && (
                        <div className="pt-3 border-t border-slate-100">
                          <Link
                            to="/admin"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center justify-between px-3.5 min-h-[46px] rounded-xl font-bold text-sm text-purple-700 bg-purple-50/70 hover:bg-purple-100/70 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Shield className="w-4.5 h-4.5 text-purple-600" />
                              <span>관리자 페이지</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-purple-400" />
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Mobile Drawer Footer */}
                    {user && (
                      <div className="p-4 border-t border-slate-100 pb-safe bg-slate-50/40">
                        <button
                          onClick={handleLogout}
                          className="w-full min-h-[44px] px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          로그아웃
                        </button>
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
