import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  Search, 
  Download, 
  MoreVertical, 
  Mail, 
  ShieldAlert, 
  UserMinus, 
  Ban, 
  BookOpen, 
  ChevronDown,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Key,
  Shield,
  MapPin,
  Calendar as CalendarIcon,
  Phone,
  Smartphone,
  Trash2,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { profileService } from '@/services/profileService';
import { courseService } from '@/services/courseService';
import { communityService } from '@/services/communityService';
import { Profile } from '@/types';
import { supabase } from '@/lib/supabase';

// --- Types ---
type UserRole = 'super_admin' | 'admin' | 'user' | 'paid_member' | 'regular_member' | 'bione_member';
type UserStatus = 'active' | 'suspended' | 'withdrawn';

interface User {
  id: string;
  name: string;
  username: string;
  nickname: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
  lastLogin: string;
  enrolledCoursesCount: number;
  suspensionUntil?: string;
  gender: 'male' | 'female' | 'other';
  birthdate: string;
  mobile: string;
  phone: string;
  address: string;
  courses: string[];
  communities: string[];
}

// --- Constants for management ---
const AVAILABLE_COURSES = ['어웨이크 5기', '자본주의 테크트리 입문', '부동산 투자 실전', '에픽테토스의 자유', '난문쾌답', '경제적 자유의 기초', '주식 투자 심화'];
const AVAILABLE_COMMUNITIES = ['어웨이크 5기 독서모임', 'VIP 멤버십 라운지', '자유게시판', '질의응답 채널', '수강생 소통방'];

// --- Constants or State for dynamic data ---
interface AvailableItem {
  id: string;
  title: string;
}

export default function AdminUserManagement() {
  const { id: urlUserId } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableCourses, setAvailableCourses] = useState<AvailableItem[]>([]);
  const [availableCommunities, setAvailableCommunities] = useState<AvailableItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'regular_member' as UserRole });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<User | null>(null);
  const [showBulkRoleModal, setShowBulkRoleModal] = useState(false);
  const [selectedBulkRole, setSelectedBulkRole] = useState<UserRole | ''>('');

  // Edit Mode States
  const [isBasicInfoEditing, setIsBasicInfoEditing] = useState(false);
  const [isActivityEditing, setIsActivityEditing] = useState(false);
  const [tempCourseToAdd, setTempCourseToAdd] = useState('');
  const [tempCommunityToAdd, setTempCommunityToAdd] = useState('');

  // Password Override Control States (Admin Strong Privilege)
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [newCustomPassword, setNewCustomPassword] = useState('');
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  // Password Reset Request States
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);

  const [defaultResetConfirmUser, setDefaultResetConfirmUser] = useState<User | null>(null);

  const loadResetRequests = async () => {
    try {
      setIsRequestsLoading(true);
      const response = await fetch('/api/admin/reset-requests');
      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.message || '요청 목록로드 실패');
      }

      const requestsData = result.data || [];

      const mapped = requestsData.map((item: any) => {
        let meta = { userId: '', name: '', status: 'PENDING', requestedAt: item.created_at };
        try {
          if (item.content) {
            meta = JSON.parse(item.content);
          }
        } catch (e) {
          console.error('Failed to parse reset request content:', e);
        }

        return {
          id: item.id,
          email: item.title,
          userId: meta.userId || '',
          name: meta.name || item.title.split('@')[0],
          status: meta.status || 'PENDING',
          requestedAt: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '-'
        };
      });

      setResetRequests(mapped);
    } catch (err) {
      console.error('Failed to load password reset requests:', err);
    } finally {
      setIsRequestsLoading(false);
    }
  };

  const handleResetRequestPassword = async (requestId: string, email: string, userId: string) => {
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userId, requestId })
      });
      const result = await response.json();
      if (result.status === 'success') {
        toast.success(`'${email}' 회원의 비밀번호가 '123456'으로 성공적으로 초기화되었습니다!`);
        loadResetRequests();
      } else {
        toast.error(result.message || '비밀번호 초기화 전송에 실패했습니다.');
      }
    } catch (err) {
      toast.error('비밀번호 초기화 요청 처리 중 오류가 발생했습니다.');
    }
  };

  // Fetch Users and Dynamic Data from Supabase
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Load password reset requests
      loadResetRequests();
      
      // Load Dynamic Data individually to prevent one failure from blocking everything
      const profiles = await profileService.getAllProfiles().catch(err => {
        console.error('Failed to load profiles:', err);
        return [];
      });
      
      const coursesData = await courseService.getAllCoursesAsAdmin().catch(err => {
        console.error('Failed to load courses:', err);
        return [];
      });
      
      const communitiesData = await communityService.getCommunities().catch(err => {
        console.error('Failed to load communities:', err);
        return [];
      });

      setAvailableCourses((coursesData || []).map(c => ({ id: c.id, title: c.title })));
      setAvailableCommunities((communitiesData || []).map(c => ({ id: c.id, title: c.name })));

      // Fetch all valid enrollments in single query to calculate actual enrolled courses count without N+1 requests
      const { data: enrollsentData, error: enrollError } = await supabase
        .from('enrollments')
        .select('user_id, expires_at')
        .eq('is_deleted', false);

      const enrollmentCounts: Record<string, number> = {};
      if (!enrollError && enrollsentData) {
        const now = new Date();
        enrollsentData.forEach((item: any) => {
          if (!item.expires_at || new Date(item.expires_at) > now) {
            enrollmentCounts[item.user_id] = (enrollmentCounts[item.user_id] || 0) + 1;
          }
        });
      }
      
      const mappedUsers: User[] = (profiles || []).map(p => {
        let joinedDate = '-';
        if (p.created_at) {
          try {
            const date = new Date(p.created_at);
            if (!isNaN(date.getTime())) {
              joinedDate = date.toISOString().split('T')[0];
            }
          } catch (e) {
            console.error('Date parsing failed for:', p.created_at);
          }
        }

        return {
          id: p.id,
          name: p.name || '알수없음',
          username: p.email ? p.email.split('@')[0] : 'user',
          nickname: p.nickname || '',
          email: p.email || '',
          role: (p.role as UserRole) || 'user',
          status: p.is_deleted ? 'withdrawn' : 'active',
          joinedAt: joinedDate,
          lastLogin: '-',
          enrolledCoursesCount: enrollmentCounts[p.id] || 0,
          gender: (p.gender as any) || 'other',
          birthdate: p.birthdate || '',
          mobile: p.mobile_phone || '',
          phone: p.phone || '',
          address: p.address || '',
          courses: [],
          communities: []
        };
      });
      
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Failed in loadInitialData:', error);
      toast.error('회원 목록을 구성하는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Sync selected user with URL ID
  useEffect(() => {
    const fetchUserActivity = async (user: User) => {
      try {
        const userCourses = await courseService.getMyCourses(user.id);
        const updatedUser = {
          ...user,
          courses: userCourses.map(c => c.title),
          enrolledCoursesCount: userCourses.length
        };
        setSelectedUser(updatedUser);
        setEditFormData(updatedUser);
      } catch (error) {
        console.error('Failed to fetch user activity:', error);
        setSelectedUser(user);
        setEditFormData(user);
      }
    };

    if (urlUserId && users.length > 0) {
      const user = users.find(u => u.id === urlUserId);
      if (user) {
        setIsBasicInfoEditing(false);
        setIsActivityEditing(false);
        fetchUserActivity(user);
      } else {
        toast.error('회원을 찾을 수 없습니다.');
        navigate('/admin/users');
      }
    } else if (!urlUserId) {
      setSelectedUser(null);
      setEditFormData(null);
    }
  }, [urlUserId, users, navigate]);

  // --- Handlers ---
  const handleToggleSelect = (userId: string) => {
    setSelectedIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  const [bulkActionType, setBulkActionType] = useState<'soft' | 'hard'>('soft');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showSingleHardDeleteModal, setShowSingleHardDeleteModal] = useState(false);

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      if (bulkActionType === 'hard') {
        await Promise.all(selectedIds.map(id => profileService.deleteProfileHard(id)));
        setUsers(users.filter(u => !selectedIds.includes(u.id)));
        setSelectedIds([]);
        setShowBulkDeleteModal(false);
        toast.success(`${selectedIds.length}명의 회원이 DB에서 완전히 삭제되었습니다.`);
      } else {
        await Promise.all(selectedIds.map(id => profileService.softDeleteProfile(id)));
        setUsers(users.map(u => selectedIds.includes(u.id) ? { ...u, status: 'withdrawn' as UserStatus } : u));
        setSelectedIds([]);
        setShowBulkDeleteModal(false);
        toast.success(`${selectedIds.length}명의 회원이 탈퇴 처리되었습니다.`);
      }
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      toast.error(bulkActionType === 'hard' ? `회원 DB 영구 삭제 처리에 실패했습니다: ${error.message || ''}` : '회원 탈퇴 처리에 실패했습니다.');
    }
  };

  const confirmBulkRoleChange = async () => {
    if (selectedIds.length === 0 || !selectedBulkRole) return;
    try {
      setIsLoading(true);
      await Promise.all(selectedIds.map(id => profileService.updateProfile(id, { role: selectedBulkRole as any })));
      
      const updatedUsers = users.map(u => {
        if (selectedIds.includes(u.id)) {
          return { ...u, role: selectedBulkRole };
        }
        return u;
      });
      setUsers(updatedUsers);
      setSelectedIds([]);
      setShowBulkRoleModal(false);
      setSelectedBulkRole('');
      toast.success(`총 ${selectedIds.length}명 회원의 등급을 [${selectedBulkRole.toUpperCase()}] 등급으로 일괄 변경 완료하였습니다!`);
    } catch (error: any) {
      console.error('Bulk role change failed:', error);
      toast.error(`등급 일괄 변경 중 오류가 발생했습니다: ${error.message || ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSoftDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkActionType('soft');
    setShowBulkDeleteModal(true);
  };

  const handleBulkHardDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkActionType('hard');
    setShowBulkDeleteModal(true);
  };

  const confirmSingleHardDelete = async () => {
    if (!selectedUser) return;
    try {
      await profileService.deleteProfileHard(selectedUser.id);
      setUsers(users.filter(u => u.id !== selectedUser.id));
      setSelectedUser(null);
      setEditFormData(null);
      setShowSingleHardDeleteModal(false);
      navigate('/admin/users');
      toast.success('회원이 DB와 서비스 목록에서 완전히 영구 삭제되었습니다.');
    } catch (error: any) {
      console.error('Hard delete failed:', error);
      toast.error(`회원 영구 삭제 처리에 실패했습니다: ${error.message || ''}`);
    }
  };

  const handleOpenDetail = (user: User) => {
    navigate(`/admin/users/${user.id}`);
  };

  const handleSaveUserEdit = async () => {
    if (!editFormData) return;
    
    if (!editFormData.name.trim()) {
      toast.error('이름은 필수 입력 항목입니다.');
      return;
    }

    try {
      await profileService.updateProfile(editFormData.id, {
        name: editFormData.name,
        nickname: editFormData.nickname || null,
        gender: editFormData.gender,
        birthdate: editFormData.birthdate || null,
        mobile_phone: editFormData.mobile || null,
        phone: editFormData.phone || null,
        address: editFormData.address || null,
        role: editFormData.role as any
      });
      
      const updatedUser = { ...editFormData };
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      setSelectedUser(updatedUser);
      setIsBasicInfoEditing(false);
      toast.success('회원 정보가 수정되었습니다.');
    } catch (error: any) {
      console.error('Update operation failed:', error);
      const errorMsg = error.message || '회원 정보 수정에 실패했습니다.';
      toast.error(errorMsg);
    }
  };

  const handleSaveActivityEdit = () => {
    // Activity edit is purely UI simulation for now as it involves multiple tables
    if (!editFormData) return;
    setUsers(users.map(u => u.id === editFormData.id ? editFormData : u));
    setSelectedUser(editFormData);
    setIsActivityEditing(false);
    toast.success('수강 및 커뮤니티 데이터가 수정되었습니다 (데모 데이터)');
  };

  const handleAddCourseToUser = async () => {
    if (!tempCourseToAdd || !editFormData) return;
    if (editFormData.courses.includes(tempCourseToAdd)) {
      toast.warning('이미 등록된 강의입니다.');
      return;
    }

    const courseObj = availableCourses.find(c => c.title === tempCourseToAdd);
    if (!courseObj) return;

    try {
      await courseService.enrollCourse(editFormData.id, courseObj.id);
      const newCourses = [...editFormData.courses, tempCourseToAdd];
      setEditFormData({
        ...editFormData,
        courses: newCourses,
        enrolledCoursesCount: newCourses.length
      });
      // Update global users list too
      setUsers(prev => prev.map(u => u.id === editFormData.id ? { ...u, enrolledCoursesCount: newCourses.length } : u));
      setTempCourseToAdd('');
      toast.success('강의가 추가되었습니다.');
    } catch (error) {
      console.error('Failed to enroll:', error);
      toast.error('강의 추가에 실패했습니다.');
    }
  };

  const handleRemoveCourseFromUser = async (courseName: string) => {
    if (!editFormData) return;

    const courseObj = availableCourses.find(c => c.title === courseName);
    if (!courseObj) return;

    try {
      await courseService.unenrollCourse(editFormData.id, courseObj.id);
      const newCourses = editFormData.courses.filter(c => c !== courseName);
      setEditFormData({
        ...editFormData,
        courses: newCourses,
        enrolledCoursesCount: Math.max(0, newCourses.length)
      });
      // Update global users list too
      setUsers(prev => prev.map(u => u.id === editFormData.id ? { ...u, enrolledCoursesCount: Math.max(0, newCourses.length) } : u));
      toast.success('강의가 제거되었습니다.');
    } catch (error) {
      console.error('Failed to unenroll:', error);
      toast.error('강의 제거에 실패했습니다.');
    }
  };

  const handleAddCommunityToUser = () => {
    if (!tempCommunityToAdd || !editFormData) return;
    if (editFormData.communities.includes(tempCommunityToAdd)) {
      toast.warning('이미 가입된 커뮤니티입니다.');
      return;
    }
    setEditFormData({
      ...editFormData,
      communities: [...editFormData.communities, tempCommunityToAdd]
    });
    setTempCommunityToAdd('');
  };

  const handleRemoveCommunityFromUser = (communityName: string) => {
    if (!editFormData) return;
    setEditFormData({
      ...editFormData,
      communities: editFormData.communities.filter(c => c !== communityName)
    });
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const result = await response.json();
      if (result.status === 'success') {
        toast.success("비밀번호가 '123456'으로 성공적으로 초기화되었습니다!");
      } else {
        toast.error(result.message || '비밀번호 초기화 처리에 실패했습니다.');
      }
    } catch (err) {
      toast.error('비밀번호 초기화 요청 처리 중 오류가 발생했습니다.');
    }
  };

  const handleCustomPasswordChange = async () => {
    if (!selectedUser) {
      toast.error('선택된 회원이 없습니다.');
      return;
    }
    const targetPassword = newCustomPassword.trim();
    if (!targetPassword) {
      toast.error('변경할 새 비밀번호를 입력해주세요.');
      return;
    }
    if (targetPassword.length < 6) {
      toast.error('비밀번호는 최소 6자 이상으로 견고하게 설정해야 합니다.');
      return;
    }

    try {
      setIsPasswordSubmitting(true);
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, password: targetPassword })
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        toast.success(`'${selectedUser.nickname || selectedUser.name}' 회원의 비밀번호가 성공적으로 '${targetPassword}'(으)로 강제 변경되었습니다.`);
        setIsPasswordChangeOpen(false);
        setNewCustomPassword('');
      } else {
        toast.error(result.message || '비밀번호 강제 변경에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Failed to change custom password:', err);
      toast.error(`비밀번호 처리 도중 예외가 발생했습니다: ${err.message || ''}`);
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(users);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, `BE_ONE_Academy_Users_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('회원 명단이 엑셀로 다운로드되었습니다.');
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) {
      toast.error('이름과 이메일을 입력해주세요.');
      return;
    }
    const user: User = {
      id: Date.now().toString(),
      name: newUser.name,
      username: newUser.email.split('@')[0],
      nickname: '',
      email: newUser.email,
      role: newUser.role,
      status: 'active',
      joinedAt: new Date().toISOString().split('T')[0],
      lastLogin: '-',
      enrolledCoursesCount: 0,
      gender: 'male',
      birthdate: '1990-01-01',
      mobile: '010-0000-0000',
      phone: '',
      address: '',
      courses: [],
      communities: []
    };
    setUsers([user, ...users]);
    setIsAddUserOpen(false);
    setNewUser({ name: '', email: '', role: 'user' });
    toast.success(`${user.name}님이 신규 회원으로 등록되었습니다.`);
  };

  const handleStatusChange = async (userId: string, status: UserStatus, suspensionDays?: number) => {
    try {
      if (status === 'withdrawn') {
        await profileService.softDeleteProfile(userId);
      } else {
        await profileService.updateProfile(userId, { is_deleted: false }); // Reactive reactivate
      }

      const updatedUsers = users.map(u => {
        if (u.id === userId) {
          let suspensionUntil;
          if (suspensionDays) {
            const date = new Date();
            date.setDate(date.getDate() + suspensionDays);
            suspensionUntil = date.toISOString().split('T')[0];
          }
          const updated = { ...u, status, suspensionUntil };
          if (selectedUser?.id === userId) {
            setSelectedUser(updated);
            if (editFormData?.id === userId) setEditFormData(updated);
          }
          return updated;
        }
        return u;
      });
      setUsers(updatedUsers);
      
      const statusMsg = status === 'suspended' ? '활동 정지' : status === 'withdrawn' ? '강제 탈퇴' : '정상 상태';
      toast.info(`회원 상태가 ${statusMsg}로 변경되었습니다.`);
    } catch (error) {
      toast.error('회원 상태 변경에 실패했습니다.');
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      await profileService.updateProfile(userId, { role: role as any });
      const updatedUsers = users.map(u => {
        if (u.id === userId) {
          const updated = { ...u, role };
          if (selectedUser?.id === userId) {
            setSelectedUser(updated);
            if (editFormData?.id === userId) setEditFormData(updated);
          }
          return updated;
        }
        return u;
      });
      setUsers(updatedUsers);
      toast.success('회원 등급이 변경되었습니다.');
    } catch (error) {
      toast.error('회원 등급 변경에 실패했습니다.');
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    
    const nameMatch = (u.name || '').toLowerCase().includes(q);
    const emailMatch = (u.email || '').toLowerCase().includes(q);
    const nicknameMatch = (u.nickname || '').toLowerCase().includes(q);
    
    // Support phone number search even if user inserts or removes hyphens
    const digitOnlyQuery = q.replace(/[^0-9]/g, '');
    const mobileMatch = digitOnlyQuery 
      ? (u.mobile || '').replace(/[^0-9]/g, '').includes(digitOnlyQuery)
      : false;
    const phoneMatch = digitOnlyQuery 
      ? (u.phone || '').replace(/[^0-9]/g, '').includes(digitOnlyQuery)
      : false;
      
    const mobileRawMatch = (u.mobile || '').includes(q);
    const phoneRawMatch = (u.phone || '').includes(q);

    return nameMatch || emailMatch || nicknameMatch || mobileMatch || phoneMatch || mobileRawMatch || phoneRawMatch;
  });

  if (selectedUser && editFormData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/users')} className="gap-2">
             <ChevronDown className="w-4 h-4 rotate-90" /> 목록으로
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">회원 상세 정보</h1>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-purple-600 text-white p-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-white text-purple-600 flex items-center justify-center text-3xl font-bold shadow-lg">
                {(selectedUser.nickname || selectedUser.name)[0]}
              </div>
              <div>
                <CardTitle className="text-3xl font-bold">{selectedUser.nickname || selectedUser.name} <span className="text-xl font-normal opacity-70">({selectedUser.name})</span></CardTitle>
                <CardDescription className="text-purple-100 text-lg">{selectedUser.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-12">
              {/* Profile Overview & Edit Section */}
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Users className="w-6 h-6 text-purple-600" />
                    기본 회원 정보
                  </h3>
                  {!isBasicInfoEditing ? (
                    <Button variant="outline" className="gap-2" onClick={() => setIsBasicInfoEditing(true)}>
                      <Award className="w-4 h-4" /> 회원정보 수정
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => { setIsBasicInfoEditing(false); setEditFormData({ ...selectedUser! }) }}>취소</Button>
                      <Button className="bg-purple-600" onClick={handleSaveUserEdit}>변경사항 저장</Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">이름</Label>
                    {!isBasicInfoEditing ? (
                      <p className="p-3 bg-gray-50 rounded-xl min-h-[48px] flex items-center text-lg">{editFormData.name}</p>
                    ) : (
                      <Input className="h-12 text-lg" value={editFormData.name || ''} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">닉네임</Label>
                    {!isBasicInfoEditing ? (
                      <p className="p-3 bg-gray-50 rounded-xl min-h-[48px] flex items-center text-lg">{editFormData.nickname}</p>
                    ) : (
                      <Input className="h-12 text-lg" value={editFormData.nickname || ''} onChange={e => setEditFormData({ ...editFormData, nickname: e.target.value })} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">이메일 (아이디)</Label>
                    <p className="p-3 bg-gray-50 rounded-xl min-h-[48px] flex items-center text-lg text-muted-foreground">{editFormData.email}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">핸드폰</Label>
                    {!isBasicInfoEditing ? (
                      <p className="p-3 bg-gray-50 rounded-xl min-h-[48px] flex items-center text-lg">{editFormData.mobile || '-'}</p>
                    ) : (
                      <Input className="h-12 text-lg" value={editFormData.mobile || ''} onChange={e => setEditFormData({ ...editFormData, mobile: e.target.value })} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">전화번호</Label>
                    {!isBasicInfoEditing ? (
                      <p className="p-3 bg-gray-50 rounded-xl min-h-[48px] flex items-center text-lg">{editFormData.phone || '-'}</p>
                    ) : (
                      <Input className="h-12 text-lg" value={editFormData.phone || ''} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">생년월일</Label>
                    {!isBasicInfoEditing ? (
                      <p className="p-3 bg-gray-50 rounded-xl min-h-[48px] flex items-center text-lg font-medium">{editFormData.birthdate || '-'}</p>
                    ) : (
                      <Input className="h-12 text-lg" type="date" value={editFormData.birthdate || ''} onChange={e => setEditFormData({ ...editFormData, birthdate: e.target.value })} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">성별</Label>
                    {!isBasicInfoEditing ? (
                      <p className="p-3 bg-gray-50 rounded-xl min-h-[48px] flex items-center text-lg">
                        {editFormData.gender === 'male' ? '남성' : editFormData.gender === 'female' ? '여성' : '기타'}
                      </p>
                    ) : (
                      <Select value={editFormData.gender} onValueChange={(val: any) => setEditFormData({ ...editFormData, gender: val })}>
                        <SelectTrigger className="h-12 text-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">남성</SelectItem>
                          <SelectItem value="female">여성</SelectItem>
                          <SelectItem value="other">기타</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">회원 등급 (권한)</Label>
                    {!isBasicInfoEditing ? (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl min-h-[48px]">
                        <Badge className={cn(
                          "px-3 py-1 font-black",
                          editFormData.role === 'super_admin' ? "bg-red-600 hover:bg-red-600" :
                          editFormData.role === 'admin' ? "bg-purple-600 hover:bg-purple-600" :
                          editFormData.role === 'paid_member' ? "bg-blue-600 hover:bg-blue-600" :
                          editFormData.role === 'regular_member' ? "bg-green-600 hover:bg-green-600" :
                          editFormData.role === 'bione_member' ? "bg-emerald-600 hover:bg-emerald-600" :
                          "bg-gray-400 hover:bg-gray-400"
                        )}>
                          {editFormData.role.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-bold text-gray-500">
                          {editFormData.role === 'admin' || editFormData.role === 'super_admin' ? '(관리자)' : '(일반 회원)'}
                        </span>
                      </div>
                    ) : (
                      <Select value={editFormData.role} onValueChange={(val: any) => setEditFormData({ ...editFormData, role: val })}>
                        <SelectTrigger className="h-12 text-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">일반 회원 (USER)</SelectItem>
                          <SelectItem value="regular_member">정규 회원</SelectItem>
                          <SelectItem value="paid_member">결제 유료 회원</SelectItem>
                          <SelectItem value="bione_member">비원 전용 회원</SelectItem>
                          <SelectItem value="admin">일반 관리자 (ADMIN)</SelectItem>
                          <SelectItem value="super_admin">최고 관리자 (SUPER)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-sm text-muted-foreground font-bold">주소</Label>
                    {!isBasicInfoEditing ? (
                      <p className="p-3 bg-gray-50 rounded-xl min-h-[48px] flex items-center text-lg">{editFormData.address || '-'}</p>
                    ) : (
                      <Input className="h-12 text-lg" placeholder="주소를 입력하세요" value={editFormData.address || ''} onChange={e => setEditFormData({ ...editFormData, address: e.target.value })} />
                    )}
                  </div>
                </div>
              </section>

              {/* Activity Section */}
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                    수강 및 커뮤니티
                  </h3>
                  {!isActivityEditing ? (
                    <Button variant="outline" className="gap-2" onClick={() => setIsActivityEditing(true)}>
                      <ChevronDown className="w-4 h-4" /> 정보 수정
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => { setIsActivityEditing(false); setEditFormData({ ...selectedUser! }) }}>취소</Button>
                      <Button className="bg-purple-600" onClick={handleSaveActivityEdit}>변경사항 저장</Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  <Card className="shadow-none border-gray-200 bg-gray-50/30 rounded-2xl overflow-hidden">
                    <CardHeader className="pb-4 px-8 border-b bg-white">
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800">수강 중인 강의</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      {isActivityEditing && (
                        <div className="flex gap-3 bg-white p-3 rounded-2xl border border-dashed border-gray-300 shadow-sm">
                          <Select value={tempCourseToAdd} onValueChange={setTempCourseToAdd}>
                            <SelectTrigger className="border-none shadow-none focus:ring-0 flex-1">
                              <SelectValue placeholder="강의 선택..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCourses.filter(c => !editFormData.courses.includes(c.title)).map((course) => (
                                <SelectItem key={course.id} value={course.title}>{course.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button className="shrink-0 bg-blue-600" onClick={handleAddCourseToUser}>추가하기</Button>
                        </div>
                      )}

                      <div className="space-y-3">
                        {editFormData.courses.length === 0 ? (
                          <p className="text-center py-10 text-gray-400 italic">등록된 강의가 없습니다.</p>
                        ) : (
                          editFormData.courses.map((courseTitle, idx) => {
                            const courseObj = availableCourses.find(c => c.title === courseTitle);
                            return (
                              <div key={idx} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-blue-100 transition-colors">
                                {courseObj ? (
                                  <Link to={`/admin/courses/edit/${courseObj.id}`} className="font-bold text-gray-800 hover:text-purple-600 transition-colors underline underline-offset-4 decoration-gray-200">
                                    {courseTitle}
                                  </Link>
                                ) : (
                                  <span className="font-bold text-gray-800">{courseTitle}</span>
                                )}
                                {isActivityEditing && (
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full" onClick={() => handleRemoveCourseFromUser(courseTitle)}>
                                    <Trash2 className="w-5 h-5" />
                                  </Button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none border-gray-200 bg-gray-50/30 rounded-2xl overflow-hidden">
                    <CardHeader className="pb-4 px-8 border-b bg-white">
                      <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800">참여 커뮤니티</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      {isActivityEditing && (
                        <div className="flex gap-3 bg-white p-3 rounded-2xl border border-dashed border-gray-300 shadow-sm">
                          <Select value={tempCommunityToAdd} onValueChange={setTempCommunityToAdd}>
                            <SelectTrigger className="border-none shadow-none focus:ring-0 flex-1">
                              <SelectValue placeholder="커뮤니티 선택..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCommunities.filter(c => !editFormData.communities.includes(c.title)).map((comm) => (
                                <SelectItem key={comm.id} value={comm.title}>{comm.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button className="shrink-0 bg-blue-600" onClick={handleAddCommunityToUser}>가입하기</Button>
                        </div>
                      )}

                      <div className="space-y-3">
                        {editFormData.communities.length === 0 ? (
                          <p className="text-center py-10 text-gray-400 italic">참여 중인 커뮤니티가 없습니다.</p>
                        ) : (
                          editFormData.communities.map((commTitle, idx) => {
                            const commObj = availableCommunities.find(c => c.title === commTitle);
                            return (
                              <div key={idx} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-blue-100 transition-colors">
                                {commObj ? (
                                  <Link to={`/admin/community/${commObj.id}`} className="font-bold text-blue-700 hover:text-purple-600 transition-colors underline underline-offset-4 decoration-blue-100">
                                    {commTitle}
                                  </Link>
                                ) : (
                                  <span className="font-bold text-blue-700">{commTitle}</span>
                                )}
                                {isActivityEditing && (
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full" onClick={() => handleRemoveCommunityFromUser(commTitle)}>
                                    <Trash2 className="w-5 h-5" />
                                  </Button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* Management Actions Section */}
              <section className="space-y-6 bg-red-50/30 p-10 rounded-[32px] border border-red-100">
                <h3 className="text-xl font-bold flex items-center gap-2 text-red-700">
                  <ShieldAlert className="w-6 h-6" />
                  계정 위험 관리
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-red-900 border-b border-red-200 pb-2 mb-3 block">활동 정지 설정</Label>
                    <Select onValueChange={(val: string) => handleStatusChange(selectedUser!.id, 'suspended', parseInt(val))}>
                      <SelectTrigger className="bg-white h-12 text-lg">
                        <SelectValue placeholder="기간 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3일 정지</SelectItem>
                        <SelectItem value="7">7일 정지</SelectItem>
                        <SelectItem value="30">30일 정지</SelectItem>
                        <SelectItem value="999">영구 정지</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-red-900 border-b border-red-200 pb-2 mb-3 block">비밀번호 강력 관리</Label>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        className="w-full h-12 gap-2 bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100 text-md font-bold"
                        onClick={() => {
                          setNewCustomPassword('');
                          setIsPasswordChangeOpen(true);
                        }}
                      >
                        <Key className="w-5 h-5 text-purple-600" /> 커스텀 비밀번호 직접 지정
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full h-10 gap-2 text-gray-500 hover:text-red-900 hover:bg-red-50 text-xs font-semibold"
                        onClick={() => {
                          setDefaultResetConfirmUser(selectedUser);
                        }}
                      >
                        기본 임시 비밀번호 발급 ('123456')
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-red-900 border-b border-red-200 pb-2 mb-3 block">회원 상태 변경</Label>
                    <Button
                      variant="destructive"
                      className="w-full h-12 gap-2 shadow-md font-bold text-lg bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleStatusChange(selectedUser!.id, 'withdrawn')}
                    >
                      <UserMinus className="w-5 h-5" /> 강제 탈퇴 처리
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-red-900 border-b border-red-200 pb-2 mb-3 block">관리자 권한 관리</Label>
                    {selectedUser.role === 'admin' || selectedUser.role === 'super_admin' ? (
                      <Button
                        variant="outline"
                        className="w-full h-12 gap-2 bg-white border-orange-200 text-orange-900 hover:bg-orange-50 text-lg font-black"
                        onClick={() => handleRoleChange(selectedUser.id, 'user')}
                      >
                        <Shield className="w-5 h-5" /> 관리자 권한 박탈
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-12 gap-2 bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100 text-lg font-black shadow-sm"
                        onClick={() => handleRoleChange(selectedUser.id, 'admin')}
                      >
                        <Shield className="w-5 h-5" /> 관리자 권한 부여
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-red-900 border-b border-red-200 pb-2 mb-3 block">DB 완전 삭제</Label>
                    <Button
                      variant="destructive"
                      className="w-full h-12 gap-2 shadow-md font-black text-lg bg-red-600 hover:bg-red-700"
                      onClick={() => setShowSingleHardDeleteModal(true)}
                    >
                      <Trash2 className="w-5 h-5" /> DB 영구 삭제
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-gray-500 mt-1">전체 회원 목록 조회 및 권한, 상태를 관리합니다.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="outline" className="gap-2 bg-white" onClick={handleExportExcel}>
            <Download className="w-4 h-4" /> 엑셀 다운로드
          </Button>
          
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger className="inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 h-8 gap-1.5 px-2.5 bg-purple-600 hover:bg-purple-700">
              <UserPlus className="w-4 h-4" /> 수동 회원 등록
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>신규 회원 수동 등록</DialogTitle>
                <DialogDescription>관리자가 직접 회원을 시스템에 등록합니다.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>이름</Label>
                  <Input 
                    placeholder="이름 입력" 
                    value={newUser.name || ''}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>이메일</Label>
                  <Input 
                    type="email" 
                    placeholder="email@example.com" 
                    value={newUser.email || ''}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>회원 등급</Label>
                  <Select 
                    value={newUser.role || 'user'} 
                    onValueChange={(val: UserRole) => setNewUser({...newUser, role: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">슈퍼 어드민</SelectItem>
                      <SelectItem value="admin">어드민</SelectItem>
                      <SelectItem value="paid_member">유료회원</SelectItem>
                      <SelectItem value="regular_member">일반회원</SelectItem>
                      <SelectItem value="bione_member">비원아카데미 회원</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>취소</Button>
                <Button className="bg-purple-600" onClick={handleAddUser}>회원 등록</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <div className="border-b">
          <TabsList className="bg-transparent border-none p-0 flex gap-6 h-12">
            <TabsTrigger 
              value="all" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 data-[state=active]:text-purple-600 font-bold px-1 h-full shadow-none bg-transparent"
            >
              전체 회원 목록 ({users.length})
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 data-[state=active]:text-purple-600 font-bold px-1 h-full shadow-none bg-transparent relative"
            >
              비밀번호 초기화 요청
              {resetRequests.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse">
                  {resetRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="이름, 전화번호, 닉네임, 이메일로 검색..." 
                    className="pl-10 h-11 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {selectedIds.length > 0 && (
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select 
                        value={selectedBulkRole} 
                        onValueChange={(val: UserRole) => {
                          setSelectedBulkRole(val);
                          setShowBulkRoleModal(true);
                        }}
                      >
                        <SelectTrigger className="h-9 w-44 rounded-xl border-purple-200 text-purple-700 font-black bg-purple-50 hover:bg-purple-100 shrink-0">
                          <SelectValue placeholder="일괄 등급 변경" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border rounded-xl shadow-lg">
                          <SelectItem value="user">일반 회원 (USER)</SelectItem>
                          <SelectItem value="regular_member">정규 회원</SelectItem>
                          <SelectItem value="paid_member">결제 유료 회원</SelectItem>
                          <SelectItem value="bione_member">비원아카데미 회원</SelectItem>
                          <SelectItem value="admin">일반 관리자 (ADMIN)</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 font-bold"
                        onClick={handleBulkSoftDelete}
                      >
                        <UserMinus className="w-4 h-4" />
                        ({selectedIds.length}) 강제 탈퇴
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="gap-2 bg-red-600 hover:bg-red-700 font-extrabold"
                        onClick={handleBulkHardDelete}
                      >
                        <Trash2 className="w-4 h-4 animate-bounce" />
                        ({selectedIds.length}) DB 완전 삭제
                      </Button>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Filter className="w-4 h-4" /> 필터
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-6">
              {(() => {
                const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
                const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                return (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-y">
                          <tr>
                            <th className="px-6 py-4 text-left w-12">
                              <Checkbox 
                                checked={selectedIds.length > 0 && selectedIds.length === filteredUsers.length}
                                onCheckedChange={handleSelectAll}
                              />
                            </th>
                            <th className="px-6 py-4 text-left font-bold text-gray-600">닉네임(회원명)</th>
                            <th className="px-6 py-4 text-left font-bold text-gray-600">이메일</th>
                            <th className="px-6 py-4 text-left font-bold text-gray-600">휴대폰번호</th>
                            <th className="px-6 py-4 text-left font-bold text-gray-600">등급</th>
                            <th className="px-6 py-4 text-left font-bold text-gray-600">상태</th>
                            <th className="px-6 py-4 text-left font-bold text-gray-600">가입일</th>
                            <th className="px-6 py-4 text-center font-bold text-gray-600">수강강의</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y relative min-h-[200px]">
                          {isLoading ? (
                            <tr>
                              <td colSpan={8} className="py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                                  <p className="text-gray-500 font-medium">회원 데이터를 불러오는 중입니다...</p>
                                </div>
                              </td>
                            </tr>
                          ) : filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Users className="w-10 h-10 text-gray-300" />
                                  <p className="text-gray-500 font-medium">검색 결과가 없습니다.</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            paginatedUsers.map((user) => (
                            <tr 
                              key={user.id} 
                              className={cn(
                                "hover:bg-gray-50/50 transition-colors cursor-pointer",
                                selectedIds.includes(user.id) && "bg-purple-50/30"
                              )}
                              onClick={() => handleOpenDetail(user)}
                            >
                              <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                  checked={selectedIds.includes(user.id)}
                                  onCheckedChange={() => handleToggleSelect(user.id)}
                                />
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">
                                    {(user.nickname || user.name)[0]}
                                  </div>
                                  <div>
                                    <p className="font-black text-gray-900 text-sm">
                                      {user.nickname ? `${user.nickname}(${user.name})` : user.name}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-gray-500 font-medium">
                                {user.email || '-'}
                              </td>
                              <td className="px-6 py-4 text-gray-500 font-medium">
                                {user.mobile || '-'}
                              </td>
                              <td className="px-6 py-4">
                                <Badge className={cn(
                                  "border-none px-3 py-1 rounded-full text-[11px] font-black",
                                  user.role === 'super_admin' ? "bg-purple-600 text-white shadow-sm" :
                                  user.role === 'admin' ? "bg-red-500 text-white shadow-sm" :
                                  user.role === 'paid_member' ? "bg-blue-100 text-blue-700" :
                                  user.role === 'bione_member' ? "bg-green-100 text-green-700" :
                                  "bg-gray-100 text-gray-500"
                                )}>
                                  {user.role === 'super_admin' ? '슈퍼 어드민' :
                                   user.role === 'admin' ? '어드민' :
                                   user.role === 'paid_member' ? '유료회원' :
                                   user.role === 'bione_member' ? '비원아카데미 회원' : '일반회원'}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    {user.status === 'active' ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : user.status === 'suspended' ? (
                                      <Clock className="w-4 h-4 text-orange-500" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-red-500" />
                                    )}
                                    <span className={cn(
                                      "font-medium",
                                      user.status === 'active' ? "text-green-600" :
                                      user.status === 'suspended' ? "text-orange-600" :
                                      "text-red-600"
                                    )}>
                                      {user.status === 'active' ? '정상' : user.status === 'suspended' ? '정지' : '탈퇴'}
                                    </span>
                                  </div>
                                  {user.status === 'suspended' && user.suspensionUntil && (
                                    <span className="text-[10px] text-gray-400">~{user.suspensionUntil}까지</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-gray-500 font-medium">{user.joinedAt}</td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-1 font-bold text-purple-600">
                                  <BookOpen className="w-3 h-3" />
                                  {user.enrolledCoursesCount}
                                </div>
                              </td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t px-6 py-4 bg-white rounded-b-xl border-gray-100">
                        <div className="text-sm text-gray-500">
                          전체 <span className="font-bold text-purple-600">{filteredUsers.length}</span>명 중{' '}
                          <span className="font-bold text-gray-700">{startIndex + 1}</span>-{Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)}명 표시
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            className="h-9 px-3 text-sm font-medium border-gray-200 text-gray-600 hover:bg-gray-50"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          >
                            이전
                          </Button>
                          
                          {(() => {
                            const maxButtons = 5;
                            let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
                            let endPage = startPage + maxButtons - 1;
                            
                            if (endPage > totalPages) {
                              endPage = totalPages;
                              startPage = Math.max(1, endPage - maxButtons + 1);
                            }
                            
                            const buttons = [];
                            for (let i = startPage; i <= endPage; i++) {
                              if (i >= 1 && i <= totalPages) {
                                buttons.push(i);
                              }
                            }
                            
                            return buttons.map((pageNum) => (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                className={currentPage === pageNum 
                                  ? "bg-purple-600 hover:bg-purple-700 text-white font-bold h-9 w-9 shadow-sm" 
                                  : "h-9 w-9 border-gray-200 text-gray-600 hover:bg-gray-50"
                                }
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            ));
                          })()}

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            className="h-9 px-3 text-sm font-medium border-gray-200 text-gray-600 hover:bg-gray-50"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          >
                            다음
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-blue-50">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-bold">전체 회원</p>
                  <h3 className="text-xl font-bold text-blue-900">{users.length}명</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-orange-50">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-orange-600 font-bold">정지 회원</p>
                  <h3 className="text-xl font-bold text-orange-900">{users.filter(u => u.status === 'suspended').length}명</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-purple-50">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-purple-600 font-bold">유료 회원</p>
                  <h3 className="text-xl font-bold text-purple-900">{users.filter(u => u.role === 'paid_member').length}명</h3>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="text-lg font-bold text-gray-900">비밀번호 초기화 요청 목록</CardTitle>
              <CardDescription>
                인쇄된 설명: 회원이 가입한 이메일을 통해 비밀번호 변경을 요청한 목록입니다. 
                행 내의 <b>초기화 승인</b> 버튼을 클릭하면, 대상 유저의 실제 비밀번호가 즉각 <b>"123456"</b>으로 안전하게 업데이트됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left font-bold text-gray-600">회원명 (닉네임)</th>
                      <th className="px-6 py-4 text-left font-bold text-gray-600">이메일</th>
                      <th className="px-6 py-4 text-left font-bold text-gray-600">요청 날짜</th>
                      <th className="px-6 py-4 text-right font-bold text-gray-600">관리 작용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y relative min-h-[150px]">
                    {isRequestsLoading ? (
                      <tr>
                        <td colSpan={4} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                            <p className="text-gray-500 font-bold">대기 중인 요청들을 불러오는 중...</p>
                          </div>
                        </td>
                      </tr>
                    ) : resetRequests.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-gray-400 font-medium">
                          대기 중인 비밀번호 초기화 요청이 존재하지 않습니다.
                        </td>
                      </tr>
                    ) : (
                      resetRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-black text-gray-900">
                            {req.name}
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-medium">
                            {req.email}
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-medium">
                            {req.requestedAt}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              onClick={() => handleResetRequestPassword(req.id, req.email, req.userId)}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg shadow-sm gap-1.5 h-9 text-xs"
                            >
                              <Key className="w-3.5 h-3.5" /> 승인 (비밀번호 '123456'으로 초기화)
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-6 shadow-xl">
            <div className="space-y-2">
              <h3 className="text-lg font-black text-gray-900">
                {bulkActionType === 'hard' ? '⚠️ DB 영구 삭제 개시' : '회원 탈퇴 처리'}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed font-bold">
                {bulkActionType === 'hard' ? (
                  <span className="text-red-600">
                    선택하신 {selectedIds.length}명의 모든 데이터를 데이터베이스에서 흔적 없이 완전히 영구 삭제하시겠습니까? 이 작업은 결코 되돌릴 수 없습니다.
                  </span>
                ) : (
                  `정말 선택하신 ${selectedIds.length}명의 회원을 강제 탈퇴 처리하시겠습니까?`
                )}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200 font-bold"
                onClick={() => setShowBulkDeleteModal(false)}
              >
                취소
              </Button>
              <Button 
                variant="destructive" 
                className={cn(
                  "rounded-xl font-bold",
                  bulkActionType === 'hard' ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-orange-600 hover:bg-orange-700"
                )}
                onClick={confirmBulkDelete}
              >
                {bulkActionType === 'hard' ? '영구 삭제 진행' : '탈퇴 진행'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single Member Hard-Delete Confirmation Modal */}
      {showSingleHardDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-[24px] p-8 max-w-md w-full space-y-6 shadow-2xl border border-red-100">
            <div className="space-y-3">
              <h3 className="text-xl font-black text-red-600 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
                DB 회원 영구 삭제 확인
              </h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed bg-red-50 p-4 rounded-2xl border border-red-100">
                현재 선택된 수강생 <span className="text-red-750 font-black">{(selectedUser?.nickname || selectedUser?.name)} ({selectedUser?.email})</span>의 모든 프로필 정보, 수강 이력, 결제 내역 및 소속 커뮤니티 데이터가 DB에서 영구 삭제됩니다.
              </p>
              <p className="text-xs text-slate-400 font-medium">
                * 이 작업은 단순 탈퇴 처리가 아니며 데이터베이스 레벨에서 즉각 행이 제거되므로 철회가 불가합니다.
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200 font-bold px-5 h-11"
                onClick={() => setShowSingleHardDeleteModal(false)}
              >
                취소
              </Button>
              <Button 
                variant="destructive" 
                className="rounded-xl bg-red-600 hover:bg-red-700 font-black px-5 h-11"
                onClick={confirmSingleHardDelete}
              >
                DB에서 완전히 삭제하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Custom Password Override Modal */}
      {isPasswordChangeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-[24px] p-8 max-w-md w-full space-y-6 shadow-2xl border border-purple-100">
            <div className="space-y-3">
              <h3 className="text-xl font-black text-purple-700 flex items-center gap-2">
                <Key className="w-6 h-6 text-purple-600 shrink-0" />
                회원 비밀번호 강력 강제 변경
              </h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed bg-purple-50 p-4 rounded-2xl border border-purple-100">
                선택한 회원(<strong>{selectedUser?.nickname || selectedUser?.name}</strong>)의 로그인 패스워드를 관리자 특별 권한으로 강제 수정합니다. 변경 후 사용자는 새 설정 비밀번호로만 로그인이 가능합니다.
              </p>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-gray-700">새 강력한 비밀번호 입력</Label>
                <Input
                  type="text"
                  placeholder="새 비밀번호 입력 (최소 6자 이상)"
                  value={newCustomPassword}
                  onChange={(e) => setNewCustomPassword(e.target.value)}
                  className="h-12 text-md border-purple-100 focus:border-purple-300"
                />
              </div>
              <p className="text-xs text-amber-600 font-medium">
                ⚠️ 주의: 이 비밀번호 변경은 Supabase Auth에 도달하여 DB 비밀번호 해시데이터를 즉각 대체합니다.
              </p>
            </div>
            <div className="flex gap-4 justify-end pt-2">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200 font-bold px-5 h-11"
                onClick={() => {
                  setIsPasswordChangeOpen(false);
                  setNewCustomPassword('');
                }}
                disabled={isPasswordSubmitting}
              >
                취소
              </Button>
              <Button 
                className="rounded-xl bg-purple-600 hover:bg-purple-700 font-black px-5 h-11 text-white gap-2"
                onClick={handleCustomPasswordChange}
                disabled={isPasswordSubmitting}
              >
                {isPasswordSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    변경 진행 중...
                  </>
                ) : (
                  '강제 비밀번호 변경'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Default Password Reset Confirmation Modal */}
      {defaultResetConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-[24px] p-8 max-w-md w-full space-y-6 shadow-2xl border border-red-150">
            <div className="space-y-3">
              <h3 className="text-xl font-black text-rose-700 flex items-center gap-2">
                <Key className="w-6 h-6 text-rose-600 shrink-0" />
                기본 비밀번호('123456') 리셋 실행
              </h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed bg-rose-50 p-4 rounded-2xl border border-rose-100">
                선택한 회원(<strong>{defaultResetConfirmUser.nickname || defaultResetConfirmUser.name}</strong>)의 로그인 암호를 <strong>"123456"</strong>으로 즉시 초기화 실행하시겠습니까? 이 작업은 즉시 인증 DB를 변동시킵니다.
              </p>
            </div>
            <div className="flex gap-4 justify-end pt-2">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200 font-bold px-5 h-11"
                onClick={() => setDefaultResetConfirmUser(null)}
              >
                취소
              </Button>
              <Button 
                className="rounded-xl bg-rose-600 hover:bg-rose-700 font-black px-5 h-11 text-white"
                onClick={() => {
                  handleResetPassword(defaultResetConfirmUser.id);
                  setDefaultResetConfirmUser(null);
                }}
              >
                확인 및 초기화 진행
              </Button>
            </div>
          </div>
        </div>
      )}



      {/* Bulk Role Confirmation Modal */}
      {showBulkRoleModal && selectedBulkRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-[24px] p-8 max-w-md w-full space-y-6 shadow-2xl border border-purple-100 animate-in fade-in zoom-in duration-200">
            <div className="space-y-3">
              <h3 className="text-xl font-black text-purple-750 flex items-center gap-2">
                <Shield className="w-6 h-6 text-purple-600 shrink-0" />
                회원 등급 일괄 변경 확인
              </h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed bg-purple-50 p-4 rounded-2xl border border-purple-100">
                선택하신 <span className="text-purple-750 font-black">{selectedIds.length}명</span>의 회원 등급을{' '}
                <span className="text-purple-800 font-black underline underline-offset-2">
                  {selectedBulkRole === 'user' ? '일반 회원 (USER)' :
                   selectedBulkRole === 'regular_member' ? '정규 회원' :
                   selectedBulkRole === 'paid_member' ? '결제 유료 회원' :
                   selectedBulkRole === 'bione_member' ? '비원아카데미 회원' : '일반 관리자 (ADMIN)'}
                </span>
                (으)로 일괄 변경하시겠습니까?
              </p>
              <p className="text-xs text-slate-400 font-medium">
                * 이 작업은 해당 회원들의 수강 권한 및 비원 전용 컨텐츠 수강 가능 여부에 즉각적인 영향을 미칩니다.
              </p>
            </div>
            <div className="flex gap-4 justify-end pt-2">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200 font-bold px-5 h-11"
                onClick={() => {
                  setShowBulkRoleModal(false);
                  setSelectedBulkRole('');
                }}
              >
                취소
              </Button>
              <Button 
                className="rounded-xl bg-purple-600 hover:bg-purple-700 font-black px-5 h-11 text-white"
                onClick={confirmBulkRoleChange}
              >
                등급 일괄 변경 실행
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
