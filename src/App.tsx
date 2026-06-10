import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
import Header from './components/layout/Header';
import { FloatingChat } from './components/community/FloatingChat';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import CourseDetail from './pages/CourseDetail';
import CommunityPage from './pages/Community';
import Courses from './pages/Courses';
import SpecialLectures from './pages/SpecialLectures';
import BeOneExclusive from './pages/BeOneExclusive';
import LifeCoaching from './pages/LifeCoaching';
import LivePage from './pages/Live';
import TechTreePage from './pages/TechTree';
import ChatPage from './pages/Chat';
import AdminCourseEditor from './pages/admin/CourseEditor';
import AboutPage from './pages/About';
import MyPage from './pages/MyPage';
import LearningPlayer from './pages/LearningPlayer';
import CartPage from './pages/Cart';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AuthCallback from './pages/auth/AuthCallback';
import ResetPassword from './pages/auth/ResetPassword';
import PaymentCallback from './pages/payment/Callback';

// Support & Legal Pages
import NoticePage from './pages/support/Notice';
import SuggestionPage from './pages/support/Suggestion';
import InquiryPage from './pages/support/Inquiry';
import FAQPage from './pages/support/FAQ';
import MasterApplyPage from './pages/support/MasterApply';
import TermsPage from './pages/legal/Terms';
import PrivacyPage from './pages/legal/Privacy';

import AdminLayout from './components/layout/AdminLayout';
import MobileBottomNav from './components/layout/MobileBottomNav';
import AdminDashboard from './pages/admin/Dashboard';
import AdminCourseManagement from './pages/admin/CourseManagement';
import AdminCMS from './pages/admin/CMS';
import AdminUserManagement from './pages/admin/UserManagement';
import AdminCommunityManagement from './pages/admin/CommunityManagement';
import AdminCommunityEditor from './pages/admin/CommunityEditor';
import AdminStatistics from './pages/admin/Statistics';
import AdminSystemSettings from './pages/admin/SystemSettings';
import AdminSalesManagement from './pages/admin/SalesManagement';
import AdminInstructorManagement from './pages/admin/InstructorManagement';
import AdminReviewManagement from './pages/admin/ReviewManagement';
import AdminSupportInquiries from './pages/admin/SupportInquiries';
import AdminErrorLogs from './pages/admin/ErrorLogs';
import { Outlet } from 'react-router-dom';

function AdminPrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, setLoading } = useAuthStore();

  useEffect(() => {
    // Safety timeout: If isLoading is still true after 5s, force it to false
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('AdminPrivateRoute: Forced loading to false after timeout');
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [isLoading, setLoading]);

  const isAdmin = user && (user.role === 'super_admin' || user.role === 'admin');
  
  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      console.warn('AdminPrivateRoute: Denied access for role', user.role);
      toast.error(`관리자 권한이 없습니다. (현재 권한: ${user.role})`);
    }
  }, [user, isAdmin, isLoading]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold text-purple-600">
      관리자 권한 확인 중...
    </div>
  );

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PublicLayout() {
  const { user, provider, isLoading } = useAuthStore();
  const location = useLocation();

  const isAuthRoute = location.pathname.startsWith('/auth') || location.pathname.startsWith('/payment');

  const isGoogleUser = provider === 'google';
  const isIncomplete = user && isGoogleUser && (!user.name || !user.nickname || !(user.mobile_phone || user.phone) || !user.gender || !user.birthdate);

  const isPopup = typeof window !== 'undefined' && (
    location.pathname === '/chat' ||
    new URLSearchParams(location.search).get('popup') === 'true' ||
    new URLSearchParams(window.location.search).get('popup') === 'true' ||
    sessionStorage.getItem('is_popup_chat') === 'true' ||
    window.name === 'BOneChatWindow'
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('popup') === 'true') {
      sessionStorage.setItem('is_popup_chat', 'true');
    }
  }, [location.search]);

  if (!isLoading && isIncomplete && !isAuthRoute && location.pathname !== '/mypage') {
    return <Navigate to="/mypage" replace />;
  }

  if (isPopup) {
    return (
      <main className="w-screen h-screen overflow-hidden flex flex-col bg-white">
        <Outlet />
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </>
  );
}

export default function App() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    // Safety fallback: if anything hangs, stop loading after 8s
    const loadingTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    const handleAuthStateChange = async (event: string, session: any) => {
      console.log('Auth event:', event);
      
      if (!mounted) return;

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          setLoading(true);
        }
        try {
          if (session?.user) {
            const profile = await authService.getCurrentProfile();
            const provider = session?.user?.app_metadata?.provider || null;
            if (mounted) setUser(profile, provider);
          } else {
            if (mounted) setUser(null, null);
          }
        } catch (err: any) {
          console.error('Error in onAuthStateChange:', err);
          // If we catch the "Refresh Token Not Found" error here, ensure we clear state
          if (err?.message?.includes('Refresh Token Not Found')) {
            console.warn('Refresh token missing, clearing auth state...');
            await supabase.auth.signOut().catch(() => {});
          }
          if (mounted) setUser(null, null);
        } finally {
          if (mounted) setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null, null);
        setLoading(false);
      }
    };

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthStateChange(event, session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  const isPopup = typeof window !== 'undefined' && (
    window.location.pathname === '/chat' ||
    new URLSearchParams(window.location.search).get('popup') === 'true' ||
    sessionStorage.getItem('is_popup_chat') === 'true' ||
    window.name === 'BOneChatWindow'
  );

  return (
    <Router>
      <div className={isPopup ? "w-screen h-screen overflow-hidden flex flex-col font-sans antialiased bg-white" : "flex min-h-screen flex-col font-sans antialiased"}>
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin" element={
            <AdminPrivateRoute>
              <AdminLayout />
            </AdminPrivateRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="courses" element={<AdminCourseManagement />} />
            <Route path="courses/edit/:id" element={<AdminCourseEditor />} />
            <Route path="instructors" element={<AdminInstructorManagement />} />
            <Route path="reviews" element={<AdminReviewManagement />} />
            <Route path="cms" element={<AdminCMS />} />
            <Route path="users" element={<AdminUserManagement />} />
            <Route path="users/:id" element={<AdminUserManagement />} />
            <Route path="community" element={<AdminCommunityManagement />} />
            <Route path="community/create" element={<AdminCommunityEditor />} />
            <Route path="community/edit/:id" element={<AdminCommunityEditor />} />
            <Route path="community/:id" element={<AdminCommunityManagement />} />
            <Route path="sales" element={<AdminSalesManagement />} />
            <Route path="stats" element={<AdminStatistics />} />
            <Route path="settings" element={<AdminSystemSettings />} />
            <Route path="support" element={<AdminSupportInquiries />} />
            <Route path="errors" element={<AdminErrorLogs />} />
          </Route>

          <Route path="/course/:id/learn" element={<LearningPlayer />} />

          {/* Public Routes with Shared Layout */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/special" element={<SpecialLectures />} />
            <Route path="/beone" element={<BeOneExclusive />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/live/:id" element={<LivePage />} />
            <Route path="/techtree" element={<TechTreePage />} />
            <Route path="/lifecoaching" element={<LifeCoaching />} />
            <Route path="/course/:id" element={<CourseDetail />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />
            
            {/* Support Routes */}
            <Route path="/support/notice" element={<NoticePage />} />
            <Route path="/support/suggestion" element={<SuggestionPage />} />
            <Route path="/support/inquiry" element={<InquiryPage />} />
            <Route path="/support/faq" element={<FAQPage />} />
            <Route path="/support/apply" element={<MasterApplyPage />} />
            
            {/* Legal Routes */}
            <Route path="/legal/terms" element={<TermsPage />} />
            <Route path="/legal/privacy" element={<PrivacyPage />} />
            
            {/* Fallback */}
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
        <Toaster position="top-center" richColors />
        {!isPopup && <FloatingChat />}
      </div>
    </Router>
  );
}
