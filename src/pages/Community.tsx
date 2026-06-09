import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Flame,
  Users,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowLeft,
  Image as ImageIcon,
  Link as LinkIcon,
  FileUp,
  LayoutGrid,
  Send,
  MessageSquare as MessageSquareIcon,
  Heart,
  Smile,
  Hash,
  Star,
  MoreVertical,
  Pencil,
  Trash2,
  Lock,
  PlayCircle,
  FileText,
  CheckSquare,
  PieChart,
  CalendarDays,
  MapPin,
  BarChart3,
  Search,
  Settings,
  Info,
  ExternalLink,
  Download,
  Eye,
  Clock,
  MoreHorizontal,
  Menu,
  X,
  MailOpen,
  Award,
  Trophy,
  CheckCircle2,
  Bell
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { communityService } from '@/services/communityService';
import { courseService } from '@/services/courseService';
import { chatService } from '@/services/chatService';
import { accessService } from '@/services/accessService';
import { cmsService } from '@/services/cmsService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { PostEditor } from '@/components/community/PostEditor';
import { PostList } from '@/components/community/PostList';
import { ChatRoomView } from '@/components/community/ChatRoomView';
import { type Post, type Message, Comment as CommunityComment, type ChatRoom } from '@/types';
import DOMPurify from 'dompurify';

// Simple Emoji Data for selector
const REACTION_EMOJIS = ['👍', '❤️', '👏', '😂', '😮', '😢', '🔥', '💯'];
const COMMENT_EMOJIS = ['😊', '🥰', '⭐', '🚀', '🙏', '✅', '💡', '🎉', '💪', '🙌', '👀', '✨'];

interface CommunityWithExtras {
  id: string;
  name: string;
  description: string | null;
  type: string;
  icon?: string;
  color?: string;
  banner_url?: string;
  postCount: number;
  memberCount: number;
  post_permission?: string;
}

const SECTION_TITLES: Record<string, string> = {
  season: '비원아카데미 시즌 커뮤니티',
  course: '정규강의 커뮤니티',
  special_online: '특강 커뮤니티 (온라인)',
  special_offline: '특강 커뮤니티 (오프라인)',
  beone_exclusive_online: '비원커뮤니티회원전용 커뮤니티 (온라인)',
  beone_exclusive_offline: '비원커뮤니티회원전용 커뮤니티 (오프라인)',
  board: '일반 커뮤니티',
  other: '기타 커뮤니티'
};

function CommunitySection({ 
  title, 
  communities, 
  onSelect 
}: { 
  title: string; 
  communities: any[]; 
  onSelect: (c: any) => void 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showArrows, setShowArrows] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (containerRef.current) {
        setShowArrows(containerRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [communities]);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const { clientWidth, scrollLeft } = containerRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      containerRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (communities.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <div className="bg-purple-600 w-1.5 h-6 rounded-full" />
          {title}
          <span className="text-gray-300 ml-2 font-bold text-lg">{communities.length}</span>
        </h2>
        {showArrows && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full w-10 h-10 border-gray-200 hover:bg-white hover:border-purple-600 transition-colors bg-white shadow-sm"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full w-10 h-10 border-gray-200 hover:bg-white hover:border-purple-600 transition-colors bg-white shadow-sm"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      <div 
        ref={containerRef}
        className="flex gap-6 overflow-x-auto no-scrollbar pb-6 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {communities.map((community) => {
          let extras: any = {};
          try { extras = JSON.parse(community.description || '{}'); } catch(e) {}
          const icon = community.icon || '🔥';
          const color = community.color || 'bg-purple-600';
          const banner = community.banner_url || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80';

          return (
            <motion.div 
              key={community.id}
              whileHover={{ y: -5 }}
              className="min-w-[280px] md:min-w-[300px] lg:min-w-[calc(25%-18px)] snap-start group shrink-0"
            >
              <button 
                onClick={() => onSelect(community)}
                className="w-full text-left bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 h-full flex flex-col"
              >
                <div className="h-40 relative overflow-hidden">
                  <img src={banner} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-6 flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl ${color} text-white flex items-center justify-center text-lg shadow-lg`}>
                       {icon}
                     </div>
                     <div>
                       <h3 className="text-base font-black text-white tracking-tight leading-tight">{community.name}</h3>
                     </div>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                   <p className="text-gray-500 font-bold text-xs leading-relaxed line-clamp-2">
                     {extras.descriptionText || community.description || '성장하는 비원아카데미 커뮤니티에 오신 것을 환영합니다.'}
                   </p>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-gray-400 text-[10px] font-black uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3 text-purple-500" /> {community.memberCount || 0}</span>
                        <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {Math.floor((community.memberCount || 0) * 0.1)}명 활동 중</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-600 transition-colors" />
                   </div>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const communityIdFromQuery = searchParams.get('id');

  const [activeMenu, setActiveMenu] = useState<string>('home-latest'); 
  const [notices, setNotices] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
    setSelectedDateStr(null);
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
    setSelectedDateStr(null);
  };

  const handleToday = () => {
    const today = new Date();
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
    setSelectedDateStr(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
  };
  
  const toggleExpand = (id: string) => {
    setExpandedNoticeId(prev => prev === id ? null : id);
  };

  const getGmailDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      
      if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
      }
      
      return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
    } catch (e) {
      return '날짜 오류';
    }
  };

  const getKoreanRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / (3600000 * 24));

      if (diffMins < 1) return '방금 전';
      if (diffMins < 60) return `${diffMins}분 전`;
      if (diffHours < 24) return `${diffHours}시간 전`;
      if (diffDays < 7) return `${diffDays}일 전`;
      
      return getGmailDate(dateStr);
    } catch (e) {
      return '날짜 오류';
    }
  };
  const [viewMode, setViewMode] = useState<'board' | 'preview' | 'image'>('preview');
  const [selectedDetailPost, setSelectedDetailPost] = useState<any | null>(null);

  const handlePostClick = (post: any) => {
    if (activeMenu === 'home-latest' || activeMenu === 'home-popular') {
      if (post.community_id) {
        handleMenuClick(post.community_id);
        toast.info('게시글이 속한 커뮤니티 공간으로 안내합니다.');
        return;
      }
    }
    setSelectedDetailPost(post);
  };

  const [banners, setBanners] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    notice: true,
    course: true,
    season: true,
    board: true,
    other: true
  });

  const [sections, setSections] = useState<Record<string, CommunityWithExtras[]>>({
    season: [],
    course: [],
    special_online: [],
    special_offline: [],
    beone_exclusive_online: [],
    beone_exclusive_offline: [],
    board: [],
    other: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedCommunity, setSelectedCommunity] = useState<any | null>(null);
  const [hasActiveAccess, setHasActiveAccess] = useState<boolean>(true);
  const [isPendingApproval, setIsPendingApproval] = useState<boolean>(false);
  const [isJoinApplying, setIsJoinApplying] = useState<boolean>(false);

  const handleApplyToJoin = async () => {
    if (!selectedCommunity) return;
    setIsJoinApplying(true);
    try {
      await communityService.applyToJoinCommunity(selectedCommunity.id);
      setIsPendingApproval(true);
      toast.success('커뮤니티 가입 신청이 성공적으로 전달되었습니다! 관리자 승인 후 즉시 참여 가능합니다. 🎉');
    } catch (err: any) {
      toast.error(err.message || '가입 신청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsJoinApplying(false);
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [communityRooms, setCommunityRooms] = useState<any[]>([]);
  const { openChat } = useChatStore();
  
  // Community exclusive room creator state
  const [isCreatingCommunityRoom, setIsCreatingCommunityRoom] = useState(false);
  const [isRoomCreatingInProgress, setIsRoomCreatingInProgress] = useState(false);
  const [newRoomType, setNewRoomType] = useState<'public' | 'private' | 'dm'>('public');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomTargetMemberId, setNewRoomTargetMemberId] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [visibleCommunitiesCount, setVisibleCommunitiesCount] = useState(5);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Post editor state
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);
  const [postFiles, setPostFiles] = useState<{name: string, url: string}[]>([]);
  const [postLinks, setPostLinks] = useState<{title: string, url: string}[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  
  // Post edit state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation state
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Comment edit state
  const [editingComment, setEditingComment] = useState<{ id: string, postId: string, content: string } | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);

  // Likes & Comments state
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [postComments, setPostComments] = useState<Record<string, CommunityComment[]>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Chat editor state
  const [chatInput, setChatInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [allCommunitiesReady, setAllCommunitiesReady] = useState<any[]>([]);
  const [accessibleCommunityIds, setAccessibleCommunityIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'feed' | 'chat'>('feed');
  const [communityDetailTab, setCommunityDetailTab] = useState<'posts' | 'missions' | 'schedule' | 'members'>('posts');
  const [editorInitialData, setEditorInitialData] = useState<{ title: string, content: string } | null>(null);
  const [showMemberTagList, setShowMemberTagList] = useState<{ postId?: string, type: 'post' | 'comment' | 'chat', active: boolean, query: string }>({ type: 'post', active: false, query: '' });
  const [communityMembers, setCommunityMembers] = useState<any[]>([]);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);

  // --- Mission Challenge States and Handlers ---
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionContent, setNewMissionContent] = useState('');
  const [isRegisteringMission, setIsRegisteringMission] = useState(false);

  const handleRegisterMission = async () => {
    if (!newMissionTitle.trim()) {
      toast.error('미션 제목을 입력해주세요.');
      return;
    }
    if (!newMissionContent.trim()) {
      toast.error('미션 내용을 입력해주세요.');
      return;
    }
    setIsRegisteringMission(true);
    try {
      const result = await communityService.createPost({
        community_id: selectedCommunity.id,
        title: newMissionTitle.trim(),
        content: newMissionContent.trim(),
        type: 'mission_template' as any
      });
      setPosts(prev => [result, ...prev]);
      setIsMissionModalOpen(false);
      setNewMissionTitle('');
      setNewMissionContent('');
      toast.success('신규 미션 챌린지가 등록되었습니다! 🎯');
    } catch (err: any) {
      toast.error(err.message || '미션 등록 실패');
    } finally {
      setIsRegisteringMission(false);
    }
  };

  // States for right sidebar participating students list
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [isCreatingChatForMember, setIsCreatingChatForMember] = useState<string | null>(null);

  const filteredMembers = communityMembers.filter(member => 
    member.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    member.nickname?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const handleStartOneToOneChat = async (targetMember: any) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (targetMember.id === user.id) {
      toast.error('자기 자신과는 1:1 대화를 나눌 수 없습니다.');
      return;
    }

    setIsCreatingChatForMember(targetMember.id);
    const loadingToast = toast.loading(`${targetMember.name}님과의 1:1 채팅방을 개설하는 중...`);
    
    try {
      const roomId = await chatService.getOrCreateOneToOneRoom(
        selectedCommunity.id,
        user.id,
        targetMember.id,
        targetMember.name
      );
      
      toast.dismiss(loadingToast);
      toast.success('채팅방으로 이동합니다.');
      
      // Navigate to chat route with room parameter
      navigate(`/chat?room=${roomId}`);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Failed to start 1:1 chat:', error);
      toast.error('1:1 채팅방 개설 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingChatForMember(null);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatRoom, setActiveChatRoom] = useState<string>('all');
  const [activeChatRoomData, setActiveChatRoomData] = useState<ChatRoom | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  
  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isVerifyingInvitee, setIsVerifyingInvitee] = useState(false);
  const [inviteeProfile, setInviteeProfile] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [receiveChatNotifs, setReceiveChatNotifs] = useState(true);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatConfig, setNewChatConfig] = useState({ name: '', type: 'public' as 'public' | 'private' | 'one_to_one', password: '' });
  const [selectedChatMembers, setSelectedChatMembers] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);

  // Specialized Post Features State
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  
  const [attendanceConfig, setAttendanceConfig] = useState({ title: '', endDate: '' });
  const [todoList, setTodoList] = useState<string[]>(['']);
  const [pollConfig, setPollConfig] = useState({ question: '', options: ['', ''], multiple: false });



  const recentFiles = posts
    .flatMap(p => p.file_urls?.map(url => ({ url, name: url.split('/').pop() || '파일', date: p.created_at })) || [])
    .slice(0, 5);

  const recentPhotos = posts
    .flatMap(p => p.image_urls || [])
    .slice(0, 6);

  // Handle auto-joining via Invite Link
  useEffect(() => {
    const processInvitation = async () => {
      const inviteId = searchParams.get('invite');
      if (!inviteId || !user) return;

      try {
        setLoading(true);
        // Automatically join the user into the community
        await communityService.inviteMemberToCommunityByUserId(inviteId, user.id);
        toast.success('초대장을 통해 커뮤니티 공간에 즉시 가입되었습니다! 환영합니다! 🎉');
        
        // Refresh the community list so the newly joined community shows up
        const [allComms, allCourses] = await Promise.all([
          communityService.getAdminCommunities(),
          courseService.getCourses()
        ]);
        setAllCommunitiesReady(allComms);
        const courseIdMap = new Map(allCourses.map(c => [c.id, c]));
        const grouped: Record<string, CommunityWithExtras[]> = {
          season: [], course: [], special_online: [], special_offline: [],
          beone_exclusive_online: [], beone_exclusive_offline: [], board: [], other: []
        };
        allComms.forEach((c: any) => {
          if (c.type === 'season') {
            grouped.season.push(c);
          } else if (c.type === 'course') {
            const course = courseIdMap.get(c.course_id || '');
            if (course?.category === 'special_online') grouped.special_online.push(c);
            else if (course?.category === 'special_offline') grouped.special_offline.push(c);
            else if (course?.category === 'beone_exclusive_online') grouped.beone_exclusive_online.push(c);
            else if (course?.category === 'beone_exclusive_offline') grouped.beone_exclusive_offline.push(c);
            else grouped.course.push(c);
          } else if (c.type === 'board') grouped.board.push(c);
          else if (c.type === 'other') grouped.other.push(c);
          else grouped.board.push(c);
        });
        setSections(grouped);
        
        // Switch view to the invited community
        setSearchParams({ id: inviteId });
      } catch (err: any) {
        if (err.message && err.message.includes('이미 이 커뮤니티')) {
          // If already a member, simply redirect to show it!
          setSearchParams({ id: inviteId });
        } else {
          console.error('Failed to process invitation auto-join:', err);
          toast.error('초대장을 처리하는 도중 오류가 발생했습니다.');
        }
      } finally {
        setLoading(false);
      }
    };
    processInvitation();
  }, [searchParams, user, setSearchParams]);

  // Handle URL changes (dropdown navigation)
  useEffect(() => {
    const dCheck = async () => {
      if (communityIdFromQuery && allCommunitiesReady.length > 0) {
        const selected = allCommunitiesReady.find((c: any) => c.id === communityIdFromQuery);
        if (selected) {
          try {
            const hasAccess = await accessService.canAccessCommunity(selected.id);
            if (!hasAccess) {
              setHasActiveAccess(false);
              if (user) {
                const { data: membership } = await supabase
                  .from('community_members')
                  .select('role')
                  .eq('community_id', selected.id)
                  .eq('user_id', user.id)
                  .maybeSingle();
                setIsPendingApproval(membership?.role === 'pending');
              } else {
                setIsPendingApproval(false);
              }
              setSelectedCommunity(selected);
              return;
            }
            setHasActiveAccess(true);
            setIsPendingApproval(false);
            setSelectedCommunity(selected);
          } catch (err) {
            console.error('Error verifying community access from URL:', err);
            setSelectedCommunity(null);
            setSearchParams({});
          }
        }
      } else if (!communityIdFromQuery) {
        setSelectedCommunity(null);
      }
    };
    dCheck();
  }, [communityIdFromQuery, allCommunitiesReady, user]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [allComms, allCourses, activeBanners, supportNotices, supportSchedules] = await Promise.all([
          communityService.getAdminCommunities(),
          courseService.getCourses(),
          cmsService.getBanners(),
          cmsService.getSupportContent('notice').then((data) => (data || []).filter(item => item.active)).catch(() => []),
          cmsService.getSupportContent('schedule').then((data) => (data || []).filter(item => item.active)).catch(() => [])
        ]);

        setAllCommunitiesReady(allComms);
        setBanners(activeBanners || []);
        setNotices(supportNotices || []);
        setSchedules(supportSchedules || []);
        const courseIdMap = new Map(allCourses.map(c => [c.id, c]));

        const grouped: Record<string, CommunityWithExtras[]> = {
          season: [],
          course: [],
          special_online: [],
          special_offline: [],
          beone_exclusive_online: [],
          beone_exclusive_offline: [],
          board: [],
          other: []
        };

        allComms.forEach((c: any) => {
          if (c.type === 'season') {
            grouped.season.push(c);
          } else if (c.type === 'course') {
            const course = courseIdMap.get(c.course_id || '');
            if (course?.category === 'special_online') {
              grouped.special_online.push(c);
            } else if (course?.category === 'special_offline') {
              grouped.special_offline.push(c);
            } else if (course?.category === 'beone_exclusive_online') {
              grouped.beone_exclusive_online.push(c);
            } else if (course?.category === 'beone_exclusive_offline') {
              grouped.beone_exclusive_offline.push(c);
            } else {
              grouped.course.push(c);
            }
          } else if (c.type === 'board') {
            grouped.board.push(c);
          } else if (c.type === 'other') {
            grouped.other.push(c);
          } else {
            grouped.board.push(c);
          }
        });

        setSections(grouped);
      } catch (error) {
        console.error('Failed to load communities', error);
        toast.error('커뮤니티 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Sync activeMenu with search query parameters matching community id
  useEffect(() => {
    if (communityIdFromQuery) {
      setActiveMenu(communityIdFromQuery);
    }
  }, [communityIdFromQuery]);

  // Load aggregate feed when "Community Home" is selected or notice menu activated
  useEffect(() => {
    if (activeMenu.startsWith('home')) {
      const loadAllFeed = async () => {
        setLoading(true);
        try {
          const allPosts = await communityService.getAllPosts();
          setPosts(allPosts);
          
          // Also fetch all active public rooms
          const { data: publicRooms } = await supabase
            .from('chat_rooms')
            .select('*')
            .eq('room_type', 'public')
            .order('created_at', { ascending: false });
          setCommunityRooms(publicRooms || []);
        } catch (err) {
          console.error('Failed to load home aggregate feed posts:', err);
        } finally {
          setLoading(false);
        }
      };
      loadAllFeed();
    } else if (activeMenu === 'notice') {
      const loadNotices = async () => {
        setLoading(true);
        try {
          const data = await cmsService.getSupportContent('notice');
          const activeNotices = (data || []).filter(item => item.active);
          setNotices(activeNotices);
        } catch (err) {
          console.error('Failed to load support notices for community section:', err);
        } finally {
          setLoading(false);
        }
      };
      loadNotices();
    } else if (activeMenu === 'schedule') {
      const loadSchedules = async () => {
        setLoading(true);
        try {
          const data = await cmsService.getSupportContent('schedule');
          const activeSchedules = (data || []).filter(item => item.active);
          setSchedules(activeSchedules);
        } catch (err) {
          console.error('Failed to load support schedules for community section:', err);
        } finally {
          setLoading(false);
        }
      };
      loadSchedules();
    }
  }, [activeMenu]);

  // Combined menu router coordinator for 3-column interaction
  const handleMenuClick = async (menuKey: string) => {
    setActiveMenu(menuKey);
    if (menuKey.startsWith('home') || menuKey === 'notice' || menuKey === 'schedule') {
      setSelectedCommunity(null);
      setSearchParams({});
    } else {
      const targetComm = allCommunitiesReady.find((c: any) => c.id === menuKey);
      if (targetComm) {
        try {
          const hasAccess = await accessService.canAccessCommunity(targetComm.id);
          if (!hasAccess) {
            setHasActiveAccess(false);
            if (user) {
              const { data: membership } = await supabase
                .from('community_members')
                .select('role')
                .eq('community_id', targetComm.id)
                .eq('user_id', user.id)
                .maybeSingle();
              setIsPendingApproval(membership?.role === 'pending');
            } else {
              setIsPendingApproval(false);
            }
            setSelectedCommunity(targetComm);
            setSearchParams({ id: targetComm.id });
            return;
          }
          setHasActiveAccess(true);
          setIsPendingApproval(false);
          setSelectedCommunity(targetComm);
          setSearchParams({ id: targetComm.id });
          setCommunityDetailTab('posts');
        } catch (err) {
          console.error('Error verifying community click access:', err);
        }
      }
    }
  };

  // Real-time subscriptions and data fetching for selected community
  useEffect(() => {
    if (!selectedCommunity || !hasActiveAccess) return;

    const currentCommId = selectedCommunity.id;
    const currentCourseId = selectedCommunity.course_id;

    // A. 로컬 데이터 세팅 및 비동기 조회
    const loadCommunityData = async () => {
      try {
        const [fetchedPosts, fetchedMessages, members] = await Promise.all([
          communityService.getPosts(currentCommId),
          communityService.getMessages(currentCommId),
          communityService.getAdminCommunityMembers(currentCommId, currentCourseId)
        ]);
        setPosts(fetchedPosts);
        setMessages(fetchedMessages);
        setCommunityMembers(members);
        setRooms([]);
      } catch (error) {
        console.error('Failed to initialize community data', error);
      }
    };

    loadCommunityData();

    // B. 실시간 구독들을 '동기적'으로 즉시 생성하여 클린업 참조 보장
    const postSub = communityService.subscribeToPosts(currentCommId, (payload) => {
      if (payload.eventType === 'INSERT') {
        const newPost = payload.new;
        setPosts(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev;
          return [newPost, ...prev];
        });
      } else if (payload.eventType === 'UPDATE') {
        const updatedPost = payload.new;
        if (updatedPost.is_deleted) {
          setPosts(prev => prev.filter(p => p.id !== updatedPost.id));
        } else {
          setPosts(prev => prev.map(p => p.id === updatedPost.id ? { ...p, ...updatedPost } : p));
        }
      } else if (payload.eventType === 'DELETE') {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id));
      }
    });

    const messageSub = communityService.subscribeToMessages(currentCommId, (payload) => {
      if (payload.eventType === 'INSERT') {
        const newMsg = payload.new;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      } else if (payload.eventType === 'UPDATE') {
        const updatedMsg = payload.new;
        if (updatedMsg.is_deleted) {
          setMessages(prev => prev.filter(m => m.id !== updatedMsg.id));
        } else {
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
        }
      } else if (payload.eventType === 'DELETE') {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      }
    });

    const likeSub = communityService.subscribeToLikes(currentCommId, (payload) => {
      if (payload.new?.user_id === user?.id) return;
      const targetPostId = payload.eventType === 'DELETE' ? payload.old.post_id : payload.new.post_id;

      setPosts(prev => prev.map(p => {
        if (p.id === targetPostId) {
          return { ...p, likes_count: (p.likes_count || 0) + (payload.eventType === 'INSERT' ? 1 : -1) };
        }
        return p;
      }));
    });

    const reactionSub = communityService.subscribeToPostReactions(currentCommId, (payload) => {
      const targetPostId = payload.eventType === 'DELETE' ? payload.old.post_id : payload.new.post_id;
      const emoji = payload.eventType === 'DELETE' ? payload.old.emoji : payload.new.emoji;
      const userId = payload.eventType === 'DELETE' ? payload.old.user_id : payload.new.user_id;

      if (userId === user?.id) return;

      setPosts(prev => prev.map(p => {
        if (p.id === targetPostId) {
          const reactions = { ...(p.reactions || {}) };
          if (payload.eventType === 'INSERT') {
            if (!reactions[emoji]) reactions[emoji] = { count: 0, user_ids: [] };
            reactions[emoji].count++;
            reactions[emoji].user_ids.push(userId);
          } else if (payload.eventType === 'DELETE') {
            if (reactions[emoji]) {
              reactions[emoji].count = Math.max(0, reactions[emoji].count - 1);
              reactions[emoji].user_ids = reactions[emoji].user_ids.filter(id => id !== userId);
              if (reactions[emoji].count === 0) delete reactions[emoji];
            }
          }
          return { ...p, reactions };
        }
        return p;
      }));
    });

    const commentSub = communityService.subscribeToComments(currentCommId, (payload) => {
      if (payload.new?.user_id === user?.id) return;

      if (payload.eventType === 'INSERT') {
        const newComment = payload.new;
        setPostComments(prev => {
          if (!prev[newComment.post_id]) return prev;
          if (prev[newComment.post_id].some(c => c.id === newComment.id)) return prev;
          return {
            ...prev,
            [newComment.post_id]: [...prev[newComment.post_id], newComment]
          };
        });
        setPosts(prev => prev.map(p => {
          if (p.id === newComment.post_id) {
            return { ...p, comments_count: (p.comments_count || 0) + 1 };
          }
          return p;
        }));
      } else if (payload.eventType === 'UPDATE') {
        const updatedComment = payload.new;
        setPostComments(prev => {
          if (!prev[updatedComment.post_id]) return prev;
          return {
            ...prev,
            [updatedComment.post_id]: prev[updatedComment.post_id].map(c => c.id === updatedComment.id ? updatedComment : c)
          };
        });
      } else if (payload.eventType === 'DELETE') {
        const deletedComment = payload.old;
        setPostComments(prev => {
          const newState = { ...prev };
          Object.keys(newState).forEach(postId => {
            newState[postId] = newState[postId].filter(c => c.id !== deletedComment.id);
          });
          return newState;
        });
      }
    });

    // C. 클린업 단계: 동기 참조를 통해 지연 없는 완벽 해제 처리
    return () => {
      if (postSub) postSub.unsubscribe();
      if (messageSub) messageSub.unsubscribe();
      if (likeSub) likeSub.unsubscribe();
      if (commentSub) commentSub.unsubscribe();
      if (reactionSub) reactionSub.unsubscribe();
    };
  }, [selectedCommunity, user, hasActiveAccess]);

  // Fetch and Sync Community-specific Chat Rooms
  useEffect(() => {
    if (!selectedCommunity || !hasActiveAccess) {
      setCommunityRooms([]);
      return;
    }

    const fetchRooms = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('community_id', selectedCommunity.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setCommunityRooms(data);
        }
      } catch (err) {
        console.error('Failed to fetch community chat rooms', err);
      }
    };

    fetchRooms();

    const channel = supabase
      .channel(`community_rooms_sync_${selectedCommunity.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_rooms', 
          filter: `community_id=eq.${selectedCommunity.id}` 
        },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCommunity, hasActiveAccess]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollChatRef.current) {
      scrollChatRef.current.scrollTop = scrollChatRef.current.scrollHeight;
    }

    // Mark as read if user is looking at chat
    if (selectedCommunity && activeTab === 'chat' && user) {
      chatService.markAsRead(user.id, selectedCommunity.id);
    }
  }, [messages, selectedCommunity, activeTab, user]);

  const scrollChatRef = useRef<HTMLDivElement>(null);
  const isAdmin = user && (user.role === 'super_admin' || user.role === 'admin');

  // Load accessible community IDs for all loaded communities
  useEffect(() => {
    const checkAccessForAll = async () => {
      if (!user) {
        setAccessibleCommunityIds(new Set());
        return;
      }
      if (allCommunitiesReady.length === 0) return;

      try {
        if (isAdmin) {
          setAccessibleCommunityIds(new Set(allCommunitiesReady.map(c => c.id)));
          return;
        }

        const accessPromises = allCommunitiesReady.map(async (c) => {
          const hasAccess = await accessService.canAccessCommunity(c.id, user.id);
          return { id: c.id, hasAccess };
        });

        const results = await Promise.all(accessPromises);
        const accessibleSet = new Set<string>();
        results.forEach(r => {
          if (r.hasAccess) {
            accessibleSet.add(r.id);
          }
        });
        setAccessibleCommunityIds(accessibleSet);
      } catch (err) {
        console.error('Error checking access for all communities:', err);
      }
    };

    checkAccessForAll();
  }, [allCommunitiesReady, user, isAdmin]);

  const inviteIdFromUrl = searchParams.get('invite');
  const invitedComm = inviteIdFromUrl && allCommunitiesReady.find((c: any) => c.id === inviteIdFromUrl);

  if (!user && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl text-center max-w-lg w-full space-y-8 border border-gray-100"
        >
          {inviteIdFromUrl ? (
            <div className="w-24 h-24 bg-purple-100 rounded-3xl flex items-center justify-center mx-auto ring-8 ring-purple-50/50">
              <MailOpen className="w-12 h-12 text-purple-600 animate-bounce" />
            </div>
          ) : (
            <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-purple-50/50">
              <Lock className="w-12 h-12 text-purple-600" />
            </div>
          )}
          <div className="space-y-4">
            {inviteIdFromUrl ? (
              <>
                <Badge className="bg-purple-600 text-white px-3 py-1 text-xs font-black mx-auto tracking-wide w-fit block">SPECIAL INVITATION ✨</Badge>
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter leading-tight break-keep">
                  {invitedComm ? `[${invitedComm.name}]` : '커뮤니티'} 공간 초대장을 받으셨습니다!
                </h2>
                <p className="text-gray-500 font-bold leading-relaxed break-keep text-sm">
                  비원아카데미 회원이 되시면 이 커뮤니티 공간에 즉시 자동 소속되어,<br />
                  동료 수강생들과 자유로운 정보 교류 및 실시간 대화에 참여하실 수 있습니다.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-black text-gray-900 tracking-tighter">로그인이 필요합니다</h2>
                <p className="text-gray-500 font-bold leading-relaxed break-keep">
                  커뮤니티와 채팅방은 비원아카데미 회원만 이용할 수 있습니다.<br/>
                  지금 로그인하고 동료들과 함께 성장의 즐거움을 나눠보세요!
                </p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link to={inviteIdFromUrl ? `/auth/login?invite=${inviteIdFromUrl}` : "/auth/login"} className={cn(buttonVariants({ size: 'lg' }), "bg-purple-600 hover:bg-purple-700 h-14 rounded-2xl text-lg font-black shadow-lg shadow-purple-200 transition-all active:scale-95")}>
              {inviteIdFromUrl ? "가입된 아이디로 로그인하기" : "로그인하러 가기"}
            </Link>
            <Link to={inviteIdFromUrl ? `/auth/register?invite=${inviteIdFromUrl}` : "/auth/register"} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), "h-14 rounded-2xl text-lg font-black border-gray-100 hover:bg-gray-50 transition-all active:scale-95")}>
              3초만에 회원가입
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'post-image' | 'post-file' | 'chat-file') => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      toast.loading('파일 업로드 중...');
      const url = await communityService.uploadFile(file, `community/${selectedCommunity.id}/${type}`);
      
      if (type === 'post-image') {
        setPostImages(prev => [...prev, url]);
      } else if (type === 'post-file') {
        setPostFiles(prev => [...prev, { name: file.name, url }]);
      } else if (type === 'chat-file') {
        // Automatically send chat message for images
        const msgType = file.type.startsWith('image/') ? 'image' : 'file';
        await communityService.sendMessage({
          community_id: selectedCommunity.id,
          user_id: user.id,
          content: file.name,
          media_url: url,
          type: msgType,
          metadata: { file_name: file.name, file_size: file.size }
        });
      }
      toast.dismiss();
      toast.success('업로드 완료!');
    } catch (error) {
      toast.dismiss();
      toast.error('업로드 실패');
      console.error(error);
    }
  };

  const handleCreatePost = async () => {
    if (!user) return toast.error('로그인이 필요합니다.');
    if (!newPostContent) return toast.error('내용을 입력해주세요.');

    // Check permission
    const canPost = selectedCommunity.post_permission === 'all' || isAdmin;
    if (!canPost) return toast.error('이 커뮤니티는 관리자만 게시글을 작성할 수 있습니다.');

    setIsPosting(true);
    try {
      const metadata: any = {};
      if (attendanceConfig.title) metadata.attendance = attendanceConfig;
      if (todoList.some(t => t.trim())) metadata.todos = todoList.filter(t => t.trim());
      if (pollConfig.question) metadata.poll = pollConfig;

      const result = await communityService.createPost({
        community_id: selectedCommunity.id,
        user_id: user.id,
        title: newPostTitle || '새로운 소식',
        content: newPostContent,
        image_urls: postImages,
        file_urls: postFiles.map(f => f.url),
        links: postLinks as any,
        type: 'general',
        metadata: Object.keys(metadata).length > 0 ? metadata : null
      });
      
      // Manually add to state for immediate feedback
      setPosts(prev => [result as Post, ...prev]);
      
      setNewPostContent('');
      setNewPostTitle('');
      setPostImages([]);
      setPostFiles([]);
      setPostLinks([]);
      setAttendanceConfig({ title: '', endDate: '' });
      setTodoList(['']);
      setPollConfig({ question: '', options: ['', ''], multiple: false });
      setShowAttendanceForm(false);
      setShowTodoForm(false);
      setShowPollForm(false);
      toast.success('게시글이 등록되었습니다.');
    } catch (error) {
      toast.error('등록 실패');
    } finally {
      setIsPosting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !chatInput.trim() || !selectedCommunity) return;
    
    setIsSendingChat(true);
    const content = chatInput;
    setChatInput('');
    try {
      const result = await communityService.sendMessage({
        community_id: selectedCommunity.id,
        user_id: user.id,
        content: content,
        type: 'text'
      });
      // Manually update state for immediate feedback
      setMessages(prev => [...prev, result as Message]);
      setShowEmojiPicker(false);
    } catch (error) {
      setChatInput(content); // Restore input on fail
      toast.error('전송 실패');
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSendEmoji = async (emoji: string) => {
    if (!user || !selectedCommunity) return;
    try {
      const result = await communityService.sendMessage({
        community_id: selectedCommunity.id,
        user_id: user.id,
        content: emoji,
        type: 'sticker',
        metadata: { emoji }
      });
      setMessages(prev => [...prev, result as Message]);
      setShowEmojiPicker(false);
    } catch (error) {
      toast.error('전송 실패');
    }
  };

  const handleToggleReaction = async (postId: string, emoji: string) => {
    if (!user) return toast.error('로그인이 필요합니다.');
    
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const reactions = { ...(p.reactions || {}) };
        const alreadyHasEmoji = reactions[emoji]?.user_ids.includes(user.id);
        
        if (alreadyHasEmoji) {
          reactions[emoji].count--;
          reactions[emoji].user_ids = reactions[emoji].user_ids.filter(id => id !== user.id);
          if (reactions[emoji].count === 0) delete reactions[emoji];
        } else {
          if (!reactions[emoji]) reactions[emoji] = { count: 0, user_ids: [] };
          reactions[emoji].count++;
          reactions[emoji].user_ids.push(user.id);
        }
        return { ...p, reactions };
      }
      return p;
    }));

    try {
      await communityService.togglePostReaction(postId, emoji);
    } catch (error) {
      toast.error('반응 처리에 실패했습니다.');
    }
  };

  const handleTogglePin = async (postId: string, currentPinned: boolean) => {
    if (!isAdmin) return;
    try {
      await communityService.togglePin(postId, !currentPinned);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_pinned: !currentPinned } : p).sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }));
      toast.success(!currentPinned ? '게시글이 상단에 고정되었습니다.' : '고정이 해제되었습니다.');
    } catch (error) {
      toast.error('고정 처리에 실패했습니다.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('정말로 이 메시지를 삭제하시겠습니까?')) return;
    try {
      await communityService.deleteMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('메시지가 삭제되었습니다.');
    } catch (error) {
      toast.error('메시지 삭제에 실패했습니다.');
    }
  };

  const handleCreateCommunityRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommunity || !user || isRoomCreatingInProgress) return;

    if (!newRoomName.trim() && newRoomType !== 'dm') {
      toast.error('소통방 이름을 입력하세요.');
      return;
    }

    try {
      setIsRoomCreatingInProgress(true);
      let finalRoomName = newRoomName.trim();
      if (newRoomType === 'dm') {
        if (!newRoomTargetMemberId) {
          toast.error('대화 대상을 한 명 선택해 주세요.');
          return;
        }
        const memberObj = communityMembers.find(m => m.id === newRoomTargetMemberId);
        finalRoomName = `${memberObj?.name || '익명'}와의 1:1 대화`;
      }

      let createdRoom;
      const basePayload: any = {
        community_id: selectedCommunity.id,
        created_at: new Date().toISOString()
      };

      // Try 1: Try inserting with 'name' and 'type' (which are the standard columns in the database) plus 'created_by'
      const { data: firstTry, error: firstErr } = await supabase
        .from('chat_rooms')
        .insert([{
          ...basePayload,
          name: finalRoomName,
          type: newRoomType,
          created_by: user.id
        }])
        .select()
        .single();

      if (!firstErr) {
        createdRoom = firstTry;
      } else {
        console.warn('Insert try 1 (name/type + created_by) failed, trying fallback 2 (room_name/room_type + created_by):', firstErr);
        
        // Try 2: Try with 'room_name' and 'room_type' plus 'created_by'
        const { data: secondTry, error: secondErr } = await supabase
          .from('chat_rooms')
          .insert([{
            ...basePayload,
            room_name: finalRoomName,
            room_type: newRoomType,
            created_by: user.id
          }])
          .select()
          .single();

        if (!secondErr) {
          createdRoom = secondTry;
        } else {
          console.warn('Insert try 2 (room_name/room_type + created_by) failed, trying fallback 3 (name/type without created_by):', secondErr);

          // Try 3: Try with 'name' and 'type' and WITHOUT 'created_by'
          const { data: thirdTry, error: thirdErr } = await supabase
            .from('chat_rooms')
            .insert([{
              ...basePayload,
              name: finalRoomName,
              type: newRoomType
            }])
            .select()
            .single();

          if (!thirdErr) {
            createdRoom = thirdTry;
          } else {
            console.warn('Insert try 3 (name/type without created_by) failed, trying final fallback 4 (room_name/room_type without created_by):', thirdErr);

            // Try 4: Try with 'room_name' and 'room_type' and WITHOUT 'created_by'
            const { data: fourthTry, error: fourthErr } = await supabase
              .from('chat_rooms')
              .insert([{
                ...basePayload,
                room_name: finalRoomName,
                room_type: newRoomType
              }])
              .select()
              .single();

            if (fourthErr) {
              console.error('All insertion fallbacks failed.', fourthErr);
              throw fourthErr;
            }
            createdRoom = fourthTry;
          }
        }
      }

      const membersToInsert = [{ room_id: createdRoom.id, user_id: user.id }];

      if (newRoomType === 'dm' && newRoomTargetMemberId) {
        membersToInsert.push({ room_id: createdRoom.id, user_id: newRoomTargetMemberId });
      } else if (newRoomType === 'private' && newRoomTargetMemberId) {
        membersToInsert.push({ room_id: createdRoom.id, user_id: newRoomTargetMemberId });
      }

      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert(membersToInsert);

      if (memberError) throw memberError;

      toast.success('소통방이 개설되었습니다.');
      setIsCreatingCommunityRoom(false);
      setNewRoomName('');
      setNewRoomTargetMemberId('');

      // 즉시 소통방 페이지로 이동!
      navigate(`/chat?room=${createdRoom.id}`);
    } catch (err: any) {
      console.error('Room creation error:', err);
      const errMsg = err?.message || err?.details || JSON.stringify(err);
      toast.error(`소통방 개설 중 오류가 발생했습니다: ${errMsg}`);
    } finally {
      setIsRoomCreatingInProgress(false);
    }
  };

  const handleEditCommentClick = (comment: any) => {
    setEditingComment({ id: comment.id, postId: comment.post_id, content: comment.content });
    setEditCommentContent(comment.content);
  };

  const handleVerifyInvitee = async () => {
    if (!inviteEmail.trim()) return;
    setIsVerifyingInvitee(true);
    setVerifyError('');
    setInviteeProfile(null);
    try {
      const profile = await communityService.findUserByEmail(inviteEmail.trim());
      if (profile) {
        setInviteeProfile(profile);
      } else {
        setVerifyError('회원이 아닙니다. 회원만 초대 가능');
      }
    } catch (error) {
      setVerifyError('검증 중 오류가 발생했습니다.');
    } finally {
      setIsVerifyingInvitee(false);
    }
  };

  const handleInviteAction = async () => {
    if (!inviteeProfile || !selectedCommunity) return;
    try {
      await communityService.sendInvitation(selectedCommunity.id, inviteeProfile.email);
      toast.success(`${inviteeProfile.name}님에게 초대 알림을 보냈습니다.`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteeProfile(null);
    } catch (error) {
      toast.error('초대 발송 실패');
    }
  };

  const handleLeaveCommunity = async () => {
    if (!selectedCommunity || !confirm('정말로 이 커뮤니티를 탈퇴하시겠습니까?')) return;
    try {
      await communityService.leaveCommunity(selectedCommunity.id);
      toast.success('커뮤니티에서 탈퇴되었습니다.');
      setShowSettingsModal(false);
      setSelectedCommunity(null);
      setSearchParams({ tab: 'feed' });
    } catch (error) {
      toast.error('탈퇴 처리 실패');
    }
  };

  const handleChatRoomClick = async (room: any) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    navigate(`/chat?room=${room.id}`);
  };

  const handleCreateChatRoom = async () => {
    if (!selectedCommunity || !newChatConfig.name.trim()) return;
    try {
      const room = await chatService.createRoom({
        ...newChatConfig,
        community_id: selectedCommunity.id,
        members: selectedChatMembers
      });
      setShowNewChatModal(false);
      setNewChatConfig({ name: '', type: 'public', password: '' });
      toast.success('채팅방이 생성되었습니다.');
    } catch (error) {
      toast.error('채팅방 생성 실패');
    }
  };

  const handleResetAllChats = async () => {
    if (!confirm('정말로 모든 커뮤니티 및 1:1 대화방을 초기화(영구 삭제)하시겠습니까? 데이터가 전부 지워집니다.')) return;
    const toastId = toast.loading('대화방 데이터를 전부 초기화하는 중...');
    try {
      await chatService.resetAllChatData();
      setRooms([]);
      toast.success('모든 대화방 데이터가 완전히 초기화되었습니다.', { id: toastId });
    } catch (error: any) {
      toast.error(`초기화 실패: ${error.message || '오류'}`, { id: toastId });
    }
  };

  const handleSearchUsers = async (q: string) => {
    setUserSearchQuery(q);
    if (q.length < 2) {
      setSearchedUsers([]);
      return;
    }
    try {
      const results = await chatService.searchUsers(q);
      setSearchedUsers(results);
    } catch (error) {}
  };

  const handleUpdateComment = async () => {
    if (!editingComment) return;
    if (!editCommentContent.trim()) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }

    setIsUpdatingComment(true);
    try {
      const updated = await communityService.updateComment(editingComment.id, editCommentContent);
      setPostComments(prev => {
        const comments = prev[editingComment.postId] || [];
        return {
          ...prev,
          [editingComment.postId]: comments.map(c => c.id === updated.id ? updated : c)
        };
      });
      setEditingComment(null);
      toast.success('댓글이 수정되었습니다.');
    } catch (error) {
      toast.error('댓글 수정에 실패했습니다.');
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;
    try {
      await communityService.deleteComment(commentId);
      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
      }));
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) };
        }
        return p;
      }));
      toast.success('댓글이 삭제되었습니다.');
    } catch (error) {
      toast.error('댓글 삭제에 실패했습니다.');
    }
  };

  const handleTagMember = (member: any, type: 'post' | 'comment' | 'chat', postId?: string) => {
    if (type === 'post') {
      setNewPostContent(prev => {
        const parts = prev.split('@');
        parts.pop();
        return parts.join('@') + `@${member.nickname || member.name} `;
      });
    } else if (type === 'comment' && postId) {
      setCommentInputs(prev => {
        const current = prev[postId] || '';
        const parts = current.split('@');
        parts.pop();
        return { ...prev, [postId]: parts.join('@') + `@${member.nickname || member.name} ` };
      });
    } else if (type === 'chat') {
      setChatInput(prev => {
        const parts = prev.split('@');
        parts.pop();
        return parts.join('@') + `@${member.nickname || member.name} `;
      });
    }
    setShowMemberTagList({ type, active: false, query: '' });
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    return content.split(/(\B@[^\s]+|\B#[^\s]+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="text-purple-600 font-bold">{part}</span>;
      }
      if (part.startsWith('#')) {
        return <span key={i} className="text-purple-600 font-bold">{part}</span>;
      }
      return part;
    });
  };
  const handleDeletePost = (postId: string) => {
    setPostToDelete(postId);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete || !user) return;
    
    setIsDeleting(true);
    try {
      await communityService.deletePost(postToDelete);
      setPosts(prev => prev.filter(p => p.id !== postToDelete));
      toast.success('게시글이 삭제되었습니다.');
      setShowDeleteConfirm(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(`게시글 삭제에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsDeleting(false);
      setPostToDelete(null);
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setShowEditDialog(true);
  };

  const handleToggleLike = async (postId: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isLiked = !p.is_liked;
        return {
          ...p,
          is_liked: isLiked,
          likes_count: (p.likes_count || 0) + (isLiked ? 1 : -1)
        };
      }
      return p;
    }));

    try {
      await communityService.toggleLike(postId);
    } catch (error) {
      // Revert on error
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const isLiked = !p.is_liked;
          return {
            ...p,
            is_liked: isLiked,
            likes_count: (p.likes_count || 0) + (isLiked ? 1 : -1)
          };
        }
        return p;
      }));
      toast.error('좋아요 처리에 실패했습니다.');
    }
  };

  const handleInputChangeWithMentions = (val: string, type: 'post' | 'comment' | 'chat', postId?: string) => {
    if (type === 'post') setNewPostContent(val);
    else if (type === 'comment' && postId) setCommentInputs(prev => ({ ...prev, [postId]: val }));
    else if (type === 'chat') setChatInput(val);

    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos !== -1 && (lastAtPos === 0 || val[lastAtPos - 1] === ' ')) {
      const queryStr = val.slice(lastAtPos + 1);
      // If there is no space after the '@', we are still typing the mention
      if (!queryStr.includes(' ')) {
        setShowMemberTagList({ type, active: true, query: queryStr, postId });
        setSelectedTagIndex(0);
      } else {
        setShowMemberTagList(prev => ({ ...prev, active: false }));
      }
    } else {
      setShowMemberTagList(prev => ({ ...prev, active: false }));
    }
  };

  const handleToggleComments = async (postId: string) => {
    const isExpanded = expandedComments.has(postId);
    const newExpanded = new Set(expandedComments);
    
    if (isExpanded) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
      // Load comments if not loaded
      if (!postComments[postId]) {
        try {
          const comments = await communityService.getComments(postId);
          setPostComments(prev => ({ ...prev, [postId]: comments }));
        } catch (error) {
          console.error('Failed to load comments', error);
        }
      }
    }
    setExpandedComments(newExpanded);
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!content.trim()) return;

    try {
      const newComment = await communityService.addComment(postId, content);
      setPostComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));
      // Update comment count
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
    } catch (error) {
      toast.error('댓글 등록 실패');
      throw error;
    }
  };

  const handleJoinAttendance = async (postId: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    try {
      await communityService.joinAttendance(postId);
      toast.success('출석체크가 완료되었습니다!');
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            attendance_count: ((p as any).attendance_count || 0) + 1,
            has_attended: true
          };
        }
        return p;
      }));
    } catch (error: any) {
      toast.error(error.message || '출석 실패');
    }
  };

  const handleVotePoll = async (postId: string, optionIndex: number) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    try {
      const vote = await communityService.votePoll(postId, optionIndex);
      toast.success('투표가 완료되었습니다!');
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            poll_votes: [...((p as any).poll_votes || []), vote],
            user_poll_vote: optionIndex
          };
        }
        return p;
      }));
    } catch (error: any) {
      toast.error(error.message || '투표 실패');
    }
  };

  const handleToggleTodo = async (postId: string, todoIndex: number, currentCompleted: boolean) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    try {
      await communityService.toggleTodo(postId, todoIndex, !currentCompleted);
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const user_todo_checks = [...((p as any).user_todo_checks || [])];
          let todo_checks = [...((p as any).todo_checks || [])];
          
          if (!currentCompleted) {
            user_todo_checks.push(todoIndex);
            todo_checks.push({ post_id: postId, user_id: user.id, todo_index: todoIndex });
          } else {
            const idx = user_todo_checks.indexOf(todoIndex);
            if (idx > -1) user_todo_checks.splice(idx, 1);
            todo_checks = todo_checks.filter(c => !(c.user_id === user.id && c.todo_index === todoIndex));
          }
          
          return {
            ...p,
            user_todo_checks,
            todo_checks
          };
        }
        return p;
      }));
    } catch (error) {
      toast.error('할 일 처리에 실패했습니다.');
    }
  };


  // Full-screen blocking loader removed to ensure seamless page transitions without flashing "Configuring community space..."


  const displayPosts = [...posts];
  if (activeMenu === 'home-popular') {
    displayPosts.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else {
    displayPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const basePosts = activeMenu === 'home-popular' ? displayPosts.slice(0, 10) : displayPosts;

  const filteredPosts = basePosts.filter(post => 
    post.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.profiles?.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 일반 게시판 피드 및 목록에서는 미션 원문(템플릿)은 숨김
  const feedPosts = filteredPosts.filter(post => post.type !== 'mission_template');

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-32 pb-32 overflow-x-hidden font-sans">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* 1. LEFT SIDEBAR MENU (Weolbu Style Category Channel Menu) */}
          <div className="lg:col-span-3 space-y-4 text-left">
            {/* User welcome & creation trigger */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11 border-2 border-purple-50 rounded-xl shadow-sm shrink-0">
                  <AvatarImage src={user?.avatar_url || ''} />
                  <AvatarFallback className="bg-purple-600 text-white font-extrabold text-sm rounded-xl">
                    {(user?.nickname || user?.name || '회')[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 leading-tight">
                  <span className="text-xs uppercase font-black text-purple-650 tracking-wider">비원커뮤니티</span>
                  <h3 className="text-base font-black text-slate-800 truncate">
                    {user ? `${user.nickname || user.name || '회원'}님` : '로그인이 필요합니다'}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => navigate('/chat')}
                className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-xl shadow transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquareIcon className="w-4 h-4 shrink-0" /> 채팅
              </button>
            </div>

            {/* Main Navigation List */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-6 shadow-sm">
              {/* Category: 1depth Common Menu */}
              <div className="space-y-1">
                <button 
                  onClick={() => handleMenuClick('home-latest')}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center",
                    activeMenu === 'home-latest' ? "bg-purple-50 text-purple-700 font-black shadow-sm" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 bg-transparent"
                  )}
                >
                  <span>커뮤니티 홈</span>
                </button>
                <button 
                  onClick={() => handleMenuClick('home-popular')}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center",
                    activeMenu === 'home-popular' ? "bg-purple-50 text-purple-700 font-black shadow-sm" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 bg-transparent"
                  )}
                >
                  <span>인기글</span>
                </button>
                <button 
                  onClick={() => handleMenuClick('notice')}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center",
                    activeMenu === 'notice' ? "bg-purple-50 text-purple-700 font-black shadow-sm" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 bg-transparent"
                  )}
                >
                  <span>공지사항</span>
                </button>
                <button 
                  onClick={() => handleMenuClick('schedule')}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center",
                    activeMenu === 'schedule' ? "bg-purple-50 text-purple-700 font-black shadow-sm" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 bg-transparent"
                  )}
                >
                  <span>강의 일정</span>
                </button>
              </div>

              <hr className="border-slate-100 my-1" />

              {/* Category: 정규강의 */}
              <div>
                <h4 className="px-3 mb-2.5 text-[13px] font-black text-slate-800 leading-none">
                  정규강의
                </h4>
                <div className="ml-3 border-l border-slate-100 pl-3 space-y-1 max-h-52 overflow-y-auto pr-1 no-scrollbar">
                  {[
                    ...sections.course,
                    ...sections.special_online,
                    ...sections.special_offline,
                    ...sections.beone_exclusive_online,
                    ...sections.beone_exclusive_offline
                  ].length === 0 ? (
                    <span className="text-xs text-slate-400 font-medium px-2.5 block py-1 font-bold">참여 중인 강의방이 없습니다.</span>
                  ) : (
                    [
                      ...sections.course,
                      ...sections.special_online,
                      ...sections.special_offline,
                      ...sections.beone_exclusive_online,
                      ...sections.beone_exclusive_offline
                    ].map((comm) => (
                      <button
                        key={comm.id}
                        onClick={() => handleMenuClick(comm.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all block truncate border-none",
                          activeMenu === comm.id ? "bg-purple-50 text-purple-700 font-black shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 bg-transparent"
                        )}
                      >
                        {comm.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Category: 비원 시즌 */}
              <div>
                <h4 className="px-3 mb-2.5 text-[13px] font-black text-slate-800 leading-none">
                  비원 시즌
                </h4>
                <div className="ml-3 border-l border-slate-100 pl-3 space-y-1 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                  {!sections.season || sections.season.length === 0 ? (
                    <span className="text-xs text-slate-400 font-medium px-2.5 block py-1 font-bold">참여 중인 챌린지가 없습니다.</span>
                  ) : (
                    sections.season.map((comm) => (
                      <button
                        key={comm.id}
                        onClick={() => handleMenuClick(comm.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all block truncate",
                          activeMenu === comm.id ? "bg-purple-50 text-purple-700 font-black shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 bg-transparent"
                        )}
                      >
                        {comm.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Category: 일반 커뮤니티 */}
              <div>
                <h4 className="px-3 mb-2.5 text-[13px] font-black text-slate-800 leading-none">
                  일반 커뮤니티
                </h4>
                <div className="ml-3 border-l border-slate-100 pl-3 space-y-1 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                  {!sections.board || sections.board.length === 0 ? (
                    <span className="text-xs text-slate-400 font-medium px-2.5 block py-1 font-bold">활성화된 커뮤니티방이 없습니다.</span>
                  ) : (
                    sections.board.map((comm) => (
                      <button
                        key={comm.id}
                        onClick={() => handleMenuClick(comm.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all block truncate",
                          activeMenu === comm.id ? "bg-purple-50 text-purple-700 font-black shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 bg-transparent"
                        )}
                      >
                        {comm.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Category: 기타 커뮤니티 */}
              <div>
                <h4 className="px-3 mb-2.5 text-[13px] font-black text-slate-800 leading-none">
                  기타 커뮤니티
                </h4>
                <div className="ml-3 border-l border-slate-100 pl-3 space-y-1 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                  {!sections.other || sections.other.length === 0 ? (
                    <span className="text-xs text-slate-400 font-medium px-2.5 block py-1 font-bold">가입된 모임이 없습니다.</span>
                  ) : (
                    sections.other.map((comm) => (
                      <button
                        key={comm.id}
                        onClick={() => handleMenuClick(comm.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all block truncate",
                          activeMenu === comm.id ? "bg-purple-50 text-purple-700 font-black shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 bg-transparent"
                        )}
                      >
                        {comm.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. MIDDLE POST FEED SECTION (Weolbu Dynamic Central Column) */}
          <div className="lg:col-span-9 space-y-5">
            {loading ? (
              <div className="space-y-5 animate-pulse text-left">
                {/* Skeleton notice banner */}
                <div className="bg-amber-50/40 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-16 h-6 bg-slate-200 rounded-md" />
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>

                {/* Skeleton active banner */}
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="h-28 bg-slate-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                </div>

                {/* Skeleton post list */}
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3.5 bg-slate-200 rounded w-1/4" />
                        <div className="h-2.5 bg-slate-150 rounded w-1/12" />
                      </div>
                    </div>
                    <div className="space-y-2 pt-1">
                      <div className="h-4 bg-slate-200 rounded w-full" />
                      <div className="h-3.5 bg-slate-150 rounded w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Rolling Notice Banner (Weolbu Premium Marquee Feature) */}
            {notices.length > 0 && (
              <div 
                onClick={() => {
                  toggleExpand(notices[0].id);
                  setActiveMenu('notice');
                  toast.success('공지사항 상세 페이지로 자동 초점을 맞춥니다.');
                }}
                className="bg-amber-50/70 border border-amber-200/50 hover:border-amber-300 rounded-2xl p-4 flex items-center justify-between text-left cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge className="bg-amber-500 text-white font-black hover:bg-amber-600 text-xs border-none shrink-0 py-1 px-2.5">
                    필독 공지
                  </Badge>
                  <p className="text-sm text-slate-800 font-extrabold truncate flex-1 leading-snug">
                    {notices[0].title}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs text-amber-600 font-black pl-3 group-hover:translate-x-1 transition-transform">
                  보기 ➔
                </div>
              </div>
            )}

            {/* Selected Community Active Info Panel */}
            {selectedCommunity && hasActiveAccess && (
              <div className="space-y-6">
                {/* 🔲 헤더 (상단): 커뮤니티 썸네일 (메인 타이틀/배너 영역) 및 [초대], [옵션] 버튼 */}
                <div className="bg-white rounded-[28px] overflow-hidden shadow-sm border border-slate-100 text-left">
                  <div className="h-40 relative">
                    <img 
                      src={selectedCommunity.banner_url || "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80"} 
                      className="w-full h-full object-cover" 
                      alt="" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent flex items-end p-5 font-sans">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between w-full gap-3">
                        <div className="leading-tight text-white space-y-1">
                          <span className="text-[9px] bg-purple-600 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest text-white shadow-sm">
                            {(SECTION_TITLES[selectedCommunity.type as keyof typeof SECTION_TITLES] || '비원아카데미 전용공간')}
                          </span>
                          <h2 className="text-xl sm:text-2xl font-black mt-1.5 tracking-tight text-white drop-shadow-sm">
                            {selectedCommunity.name}
                          </h2>
                          <p className="text-[11px] text-slate-200 font-medium max-w-md opacity-90 line-clamp-1 dropdown-shadow-xs">
                            {selectedCommunity.description || "이 과정의 회원들과 질문 답변 및 학습 자료 교류를 위한 공간입니다."}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 rounded-xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-black text-[11px] transition-all px-3 flex items-center gap-1 backdrop-blur-md"
                            onClick={() => setShowInviteModal(true)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            초대 양식
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 rounded-xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-black text-[11px] transition-all px-3 flex items-center gap-1 backdrop-blur-md"
                            onClick={() => setShowSettingsModal(true)}
                          >
                            <Settings className="w-3.5 h-3.5" />
                            옵션 변경
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🗺️ 탭 메뉴 (게시글 | 미션 | 일정 | 멤버) */}
                <div className="flex border-b border-slate-150 select-none font-sans">
                  {(['posts', 'missions', 'schedule', 'members'] as const).map((tab) => {
                    const tabLabels = { posts: '게시글', missions: '미션', schedule: '일정', members: '멤버' };
                    return (
                      <button
                        key={tab}
                        onClick={() => {
                          setCommunityDetailTab(tab);
                          setEditorInitialData(null);
                        }}
                        className={cn(
                          "px-5 py-3 text-xs sm:text-sm font-black text-center relative border-b-2 transition-all cursor-pointer border-none bg-transparent outline-none",
                          communityDetailTab === tab ? "text-purple-650 font-extrabold" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {tabLabels[tab]}
                        {communityDetailTab === tab && (
                          <motion.div 
                            layoutId="activeTabUnderline"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" 
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Private Space Invitation Approval Block */}
            {selectedCommunity && !hasActiveAccess ? (
              <div className="bg-white rounded-3xl border border-slate-105 p-8 shadow-sm text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-5 border border-purple-100">
                  <Lock className="w-7 h-7" />
                </div>
                <Badge className="bg-purple-100 text-purple-700 border-none font-black px-3 py-1 rounded-full text-xs mb-3">
                  제한적인 회원전용 채널
                </Badge>
                <h3 className="text-lg font-black text-slate-800 mb-1.5">{selectedCommunity.name}</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-sm font-bold mb-5">
                  본 서브채널은 검증된 소수 정규과정 회원 전용의 공간입니다. 가입 승인을 신청하시면, 담당 지도 튜터가 확인 조치 후 입장해드립니다.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleMenuClick('home-latest')}
                    className="h-10 px-5 rounded-xl font-bold border-slate-150 text-xs sm:text-sm"
                  >
                    일반 홈광장으로 복귀
                  </Button>
                  {isPendingApproval ? (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 font-bold h-10 px-5 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 animate-pulse" />
                      입장 권한 대기중
                    </div>
                  ) : (
                    <Button
                      disabled={isJoinApplying}
                      onClick={handleApplyToJoin}
                      className="h-10 px-5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs sm:text-sm"
                    >
                      {isJoinApplying ? "대기 처리를 올리는중..." : "가입 승인요청"}
                    </Button>
                  )}
                </div>
              </div>
            ) : activeMenu === 'notice' ? (
              
              /* NOTICE BOARD SUBVIEW (Traditional List/Board Style Like footer) */
              <div className="space-y-4 text-left animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                  <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <div className="bg-purple-600 w-1.5 h-4.5 rounded-full" />
                    📢 비원아카데미 공식 공지사항
                  </h2>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="공지사항 제목/내용 검색..."
                      className="h-8.5 pl-8 pr-2.5 text-xs sm:text-sm bg-slate-50 rounded-lg font-bold border-transparent focus:bg-white focus:ring-purple-650"
                    />
                  </div>
                </div>

                {/* Grid Table Index list */}
                <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden">
                  <div className="hidden md:grid grid-cols-12 gap-3 bg-slate-50/80 border-b border-slate-150 px-6 py-3.5 text-[11px] font-black text-slate-400 tracking-wide text-center uppercase select-none">
                    <div className="col-span-1">번호</div>
                    <div className="col-span-2">구분</div>
                    <div className="col-span-6 text-left pl-4">제목</div>
                    <div className="col-span-3">등록일</div>
                  </div>

                  {notices.filter(n => (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (n.content || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-2xl">
                      <p className="text-sm text-slate-400 font-bold">등록된 공지사항이 발견되지 않았습니다.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {notices
                        .filter(n => (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (n.content || '').toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((notice, index, arr) => {
                          const isExpanded = expandedNoticeId === notice.id;
                          const isImportant = notice.title.includes('[필독]') || notice.title.includes('[중요]') || notice.important;
                          return (
                            <div key={notice.id} className="transition-colors group bg-white">
                              {/* Notice Row Clickable Header */}
                              <div 
                                onClick={() => toggleExpand(notice.id)}
                                className={`px-6 py-4 grid grid-cols-12 gap-3 items-center cursor-pointer select-none border-l-4 transition-all duration-150 ${
                                  isExpanded ? 'bg-purple-50/20 border-purple-500 font-black' : 'hover:bg-slate-50/40 border-l-transparent'
                                }`}
                              >
                                {/* Number */}
                                <div className="hidden md:flex col-span-1 justify-center text-xs font-bold text-slate-400 font-mono">
                                  {arr.length - index}
                                </div>

                                {/* Classification Tag */}
                                <div className="col-span-3 md:col-span-2 flex items-center justify-start md:justify-center">
                                  {isImportant ? (
                                    <span className="bg-rose-50 text-rose-500 border border-rose-200/80 text-[10px] font-black px-2.5 py-0.5 rounded-md tracking-tight">
                                      [필독/중요]
                                    </span>
                                  ) : (
                                    <span className="bg-slate-100 text-slate-650 border border-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-md tracking-tight">
                                      일반공지
                                    </span>
                                  )}
                                </div>

                                {/* Title */}
                                <div className="col-span-9 md:col-span-6 pl-0 md:pl-4 min-w-0 flex items-center">
                                  <h3 className={`text-sm tracking-tight truncate leading-normal transition-colors ${
                                    isExpanded ? 'text-purple-600 font-black' : 'text-slate-800 font-extrabold group-hover:text-purple-600'
                                  }`}>
                                    {notice.title}
                                  </h3>
                                </div>

                                {/* Create Date */}
                                <div className="hidden md:flex col-span-3 justify-center items-center text-xs text-slate-400 font-bold font-mono">
                                  {notice.created_at ? new Date(notice.created_at).toLocaleDateString('ko-KR') : '-'}
                                </div>
                              </div>

                              {/* Expandable Notice Body */}
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                                    className="overflow-hidden border-t border-slate-150 bg-slate-50/30"
                                  >
                                    <div className="px-6 py-6 md:px-10 md:py-8 text-left">
                                      <div className="editor-content bg-white border border-slate-150 rounded-2xl p-5 md:p-8 shadow-xs select-text">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-5 gap-2">
                                          <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5 leading-snug">
                                            <FileText className="w-4 h-4 text-purple-500 shrink-0" />
                                            {notice.title}
                                          </h2>
                                          <span className="text-[10px] text-slate-400 font-bold font-mono shrink-0">
                                            작성일자: {notice.created_at ? new Date(notice.created_at).toLocaleString('ko-KR') : '-'}
                                          </span>
                                        </div>

                                        {notice.content && (notice.content.includes('<p>') || notice.content.includes('<h') || notice.content.includes('<div') || notice.content.includes('<ul') || notice.content.includes('<ol')) ? (
                                          <div 
                                            className="editor-content select-text text-slate-700 text-xs sm:text-sm leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notice.content) }}
                                          />
                                        ) : (
                                          <p className="whitespace-pre-wrap select-text text-xs sm:text-sm text-slate-705 leading-relaxed font-semibold">
                                            {notice.content}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            ) : activeMenu === 'schedule' ? (
              
              /* INTERACTIVE MONTHLY LECTURE CALENDAR */
              <div className="bg-white rounded-3xl border border-slate-100 p-4 md:p-6 space-y-6 shadow-sm text-left animate-fade-in">
                
                {/* Header Title Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <div className="bg-purple-600 w-1.5 h-5 rounded-full" />
                      📅 비원아카데미 강의 일정
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-bold">
                      정규 강독반, 기수제 특강, 실습, 멘토링 및 오프라인 모임의 일정을 제공합니다.
                    </p>
                  </div>
                  <Button
                    onClick={handleToday}
                    variant="outline"
                    className="border-slate-200 hover:bg-slate-50 text-slate-705 font-extrabold h-9 text-xs gap-1 sm:self-center"
                  >
                    오늘 날짜로 이동
                  </Button>
                </div>

                {/* Calendar Navigation Controller */}
                <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-2xl border">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="h-10 w-10 hover:bg-white rounded-xl text-slate-605"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                    {calYear}년 {calMonth + 1}월
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    className="h-10 w-10 hover:bg-white rounded-xl text-slate-605"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>

                {/* Calendar Grid Section */}
                <div className="space-y-1">
                  {/* Calendar Weekday Names */}
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-600 py-2 border-b bg-slate-50/50 rounded-t-xl">
                    <div className="text-rose-500 font-black">일</div>
                    <div>월</div>
                    <div>화</div>
                    <div>수</div>
                    <div>목</div>
                    <div>금</div>
                    <div className="text-blue-500 font-black">토</div>
                  </div>

                  {/* Calendar Grid Cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
                      const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
                      const prevTotalDays = new Date(calYear, calMonth, 0).getDate();

                      const calendarCells = [];

                      // Trails of prev month
                      for (let i = firstDayIndex - 1; i >= 0; i--) {
                        const dayNum = prevTotalDays - i;
                        const tempMonth = calMonth === 0 ? 11 : calMonth - 1;
                        const tempYear = calMonth === 0 ? calYear - 1 : calYear;
                        const dateString = `${tempYear}-${String(tempMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        calendarCells.push({ day: dayNum, month: tempMonth, year: tempYear, isCurrentMonth: false, dateString });
                      }

                      // Current month days
                      for (let i = 1; i <= totalDays; i++) {
                        const dateString = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                        calendarCells.push({ day: i, month: calMonth, year: calYear, isCurrentMonth: true, dateString });
                      }

                      // Next month front cells
                      const extraCells = calendarCells.length % 7 === 0 ? 0 : 7 - (calendarCells.length % 7);
                      for (let i = 1; i <= extraCells; i++) {
                        const tempMonth = calMonth === 11 ? 0 : calMonth + 1;
                        const tempYear = calMonth === 11 ? calYear + 1 : calYear;
                        const dateString = `${tempYear}-${String(tempMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                        calendarCells.push({ day: i, month: tempMonth, year: tempYear, isCurrentMonth: false, dateString });
                      }

                      // Map the precalculated active schedules
                      const parsedSchedules = schedules.map(item => {
                        let details = { date: '', time: '', category: '정규 강의', color: 'purple', description: '' };
                        try {
                          if (item.content?.startsWith('{')) {
                            details = JSON.parse(item.content);
                          } else {
                            details.description = item.content;
                          }
                        } catch (e) {}
                        return {
                          id: item.id,
                          title: item.title,
                          active: item.active,
                          ...details
                        };
                      });

                      const todayStr = (() => {
                        const todayObj = new Date();
                        return `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
                      })();

                      return calendarCells.map((cell, idx) => {
                        const cellSchedules = parsedSchedules.filter(s => s.date === cell.dateString);
                        const isSelected = selectedDateStr === cell.dateString;
                        const isToday = todayStr === cell.dateString;

                        // Red color for Sunday (idx % 7 === 0) and Blue for Saturday (idx % 7 === 6)
                        const isSunday = idx % 7 === 0;
                        const isSaturday = idx % 7 === 6;

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (selectedDateStr === cell.dateString) {
                                setSelectedDateStr(null);
                              } else {
                                setSelectedDateStr(cell.dateString);
                              }
                            }}
                            className={cn(
                              "min-h-[75px] sm:min-h-[95px] p-1.5 border border-slate-100 rounded-xl transition-all cursor-pointer select-none flex flex-col justify-between",
                              cell.isCurrentMonth ? "bg-white" : "bg-slate-50/50 opacity-55",
                              isSelected ? "ring-2 ring-purple-600 ring-offset-1 bg-purple-50/20" : "hover:bg-slate-50/70"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={cn(
                                  "text-xs sm:text-sm font-black flex items-center justify-center rounded-full w-5 h-5",
                                  isToday ? "bg-purple-600 text-white" : isSunday ? "text-rose-500" : isSaturday ? "text-blue-500" : "text-slate-800"
                                )}
                              >
                                {cell.day}
                              </span>
                              {cellSchedules.length > 0 && !isToday && (
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                              )}
                            </div>

                            {/* Scheduled events */}
                            <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">
                              {cellSchedules.slice(0, 2).map((s) => {
                                const colorBgMap: Record<string, string> = {
                                  purple: 'bg-purple-50 text-purple-700 border-purple-200/50',
                                  rose: 'bg-rose-50 text-rose-700 border-rose-200/50',
                                  blue: 'bg-blue-50 text-blue-700 border-blue-200/50',
                                  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
                                  amber: 'bg-amber-50 text-amber-700 border-amber-200/50',
                                };
                                return (
                                  <div
                                    key={s.id}
                                    className={cn(
                                      "text-[8px] sm:text-[9.5px] px-1 py-0.5 rounded border leading-tight font-black truncate max-w-full text-left",
                                      colorBgMap[s.color || 'purple'] || colorBgMap.purple
                                    )}
                                    title={s.title}
                                  >
                                    {s.title}
                                  </div>
                                );
                              })}
                              {cellSchedules.length > 2 && (
                                <div className="text-[7.5px] sm:text-[8px] text-slate-400 font-extrabold pl-1 text-left">
                                  +{cellSchedules.length - 2}개 더
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Schedule list bottom container */}
                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        {selectedDateStr ? (
                          <span className="flex items-center gap-1.5 text-purple-650">
                            📅 {selectedDateStr.split('-')[0]}년 {Number(selectedDateStr.split('-')[1])}월 {Number(selectedDateStr.split('-')[2])}일 강의 일정
                          </span>
                        ) : (
                          <span>📚 {calYear}년 {calMonth + 1}월 전체 강의 일정</span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-550 font-bold mt-1">
                        {selectedDateStr ? "해당 날짜에 예정된 강의 상세 및 온라인 자습 좌표입니다." : "이달에 활성화된 모든 아카데미 강의 일정 목록입니다."}
                      </p>
                    </div>

                    {selectedDateStr && (
                      <Button
                        onClick={() => setSelectedDateStr(null)}
                        variant="ghost"
                        className="text-xs font-extrabold text-purple-650 hover:bg-purple-50 h-8 px-2.5 rounded-lg shrink-0 gap-1.5 animate-pulse"
                      >
                        이달 전체일정 보기
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* List Cards */}
                  <div className="space-y-3">
                    {(() => {
                      const parsedSchedules = schedules.map(item => {
                        let details = { date: '', time: '', category: '정규 강의', color: 'purple', description: '' };
                        try {
                          if (item.content?.startsWith('{')) {
                            details = JSON.parse(item.content);
                          } else {
                            details.description = item.content;
                          }
                        } catch (e) {}
                        return {
                          id: item.id,
                          title: item.title,
                          active: item.active,
                          ...details
                        };
                      });

                      const visibleSchedules = parsedSchedules.filter(item => {
                        if (selectedDateStr) {
                          return item.date === selectedDateStr;
                        }
                        const viewedPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
                        return item.date?.startsWith(viewedPrefix);
                      });

                      // Sort chronologically by date and description/time
                      visibleSchedules.sort((a, b) => {
                        if (!a.date) return 1;
                        if (!b.date) return -1;
                        return a.date.localeCompare(b.date);
                      });

                      if (visibleSchedules.length === 0) {
                        return (
                          <div id="no-schedules" className="p-8 border border-dashed rounded-2xl bg-zinc-50/50 text-center text-slate-400 font-bold text-xs sm:text-sm">
                            ⚠️ 예정된 강의 및 학사 일정이 없습니다.
                          </div>
                        );
                      }

                      return (
                        <div id="schedules-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {visibleSchedules.map((item) => {
                            const badgeColorMap: Record<string, string> = {
                              purple: 'bg-purple-100 text-purple-700',
                              rose: 'bg-rose-100 text-rose-700',
                              blue: 'bg-blue-100 text-blue-700',
                              emerald: 'bg-emerald-100 text-emerald-700',
                              amber: 'bg-amber-100 text-amber-700',
                            };
                            return (
                              <div
                                key={item.id}
                                id={`schedule-item-${item.id}`}
                                className="p-4 border border-slate-100 rounded-2xl bg-white hover:border-purple-250 hover:shadow-xs transition-all flex flex-col justify-between gap-3 text-left"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-2.5">
                                    <Badge className={cn("border-none px-2 py-0.5 text-[9.5px] font-black shrink-0", badgeColorMap[item.color || 'purple'] || badgeColorMap.purple)}>
                                      {item.category || '정규 강의'}
                                    </Badge>
                                    <span className="text-[10px] text-slate-400 font-bold font-mono">
                                      {item.date} {item.time}
                                    </span>
                                  </div>
                                  <h4 className="text-xs sm:text-sm font-black text-slate-800 line-clamp-1">
                                    {item.title}
                                  </h4>
                                  <p className="text-[11px] text-slate-505 font-bold leading-relaxed line-clamp-2">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              
              /* POST FEED COLUMN (Weolbu Multi-View Mode Layout & Selected Community Sub-Tabs) */
              <div className="space-y-5">
                {selectedCommunity && hasActiveAccess ? (
                  <div className="space-y-6">
                    {/* A. POSTS TAB CONTENT */}
                    {communityDetailTab === 'posts' && (
                      <div className="w-full text-left font-sans animate-fade-in">
                        {/* Feed Column */}
                        <div className="space-y-5">
                          {/* 🔍 검색창 */}
                          <div className="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                            <div className="relative text-left w-full">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="회원 게시글 검색 및 태그(#) 검색..."
                                className="h-10 pl-9.5 pr-4 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-purple-650 font-bold text-xs sm:text-sm text-slate-705"
                              />
                            </div>
                          </div>

                          {/* ✍️ 입력창: 게시글 입력창 */}
                          {(!selectedCommunity.post_permission || selectedCommunity.post_permission === 'all' || isAdmin) ? (
                            <div id="post-editor-section" className="bg-white rounded-[26px] overflow-hidden border border-slate-100 shadow-xs">
                              <PostEditor 
                                communityId={selectedCommunity.id} 
                                key={editorInitialData ? 'with-data' : 'empty'}
                                initialPost={editorInitialData}
                                onSuccess={(newPost) => {
                                  setPosts(prev => [newPost, ...prev]);
                                  setEditorInitialData(null);
                                  toast.success('새 글이 성공적으로 피드에 등록되었습니다! 🚀');
                                }} 
                              />
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-extrabold">
                              🔒 본 채널은 오직 강사와 튜터만 게시글 작성이 가능한 공간입니다.
                            </div>
                          )}

                          {/* Feed Posts (전체 펼쳐진 형태) */}
                          {feedPosts.length === 0 ? (
                            <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-xs">
                              <p className="text-xs text-slate-400 font-extrabold leading-normal">아직 등록된 게시글이 없습니다. 첫 이야기를 남겨보세요!</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <PostList 
                                posts={feedPosts}
                                isLoading={loading}
                                currentUserId={user?.id}
                                isAdmin={isAdmin}
                                postComments={postComments}
                                onLike={handleToggleLike}
                                onCommentToggle={handleToggleComments}
                                onCommentSubmit={handleAddComment}
                                onJoinAttendance={handleJoinAttendance}
                                onToggleTodo={handleToggleTodo}
                                onVotePoll={handleVotePoll}
                                onDelete={handleDeletePost}
                                onEdit={handleEditPost}
                                accessibleCommunityIds={accessibleCommunityIds}
                                isFeedMode={false}
                                allCommunities={allCommunitiesReady}
                                onCardClick={(post) => handlePostClick(post)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* B. MISSIONS TAB CONTENT */}
                    {communityDetailTab === 'missions' && (
                      <div className="bg-white border border-slate-100 rounded-[30px] p-6 text-left space-y-8 animate-fade-in shadow-xs font-sans">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                          <div className="space-y-1">
                            <h2 className="text-lg font-black text-slate-900">🎯 스터디원 실천 인증 미션 챌린지</h2>
                            <p className="text-xs text-slate-500 font-bold">실천만이 진짜 내 소유가 됩니다. 매일 주어지는 미션에 도전하고 회원들과 함께 도전을 진행하세요!</p>
                          </div>
                          {isAdmin && (
                            <Button
                              onClick={() => setIsMissionModalOpen(true)}
                              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black h-10 text-xs px-4 flex items-center gap-1"
                            >
                              ➕ 새 미션 등록하기
                            </Button>
                          )}
                        </div>

                        {/* 상단: 등록된 고정 미션 보드 */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-black text-purple-700 flex items-center gap-1.5">🏆 챌린지 미션 보드</h3>
                          {posts.filter(p => p.type === 'mission_template' && !p.is_deleted).length === 0 ? (
                            <div className="py-12 border border-slate-100 rounded-3xl bg-slate-50/40 text-center text-xs text-slate-400 font-extrabold leading-normal">
                              등록된 고정 챌린지 미션이 없습니다.{isAdmin ? " 우측 상단의 '새 미션 등록하기' 버튼을 눌각 기수의 목표 미션을 생성해 연동해 보셔요." : " 강사진이 등록해줄 일일 도전을 기다리고 있습니다."}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              {posts.filter(p => p.type === 'mission_template' && !p.is_deleted).map((mission) => {
                                // 현재 로그인한 회원이 이 미션에 쓴 인증글 개수
                                const myVerificationCount = posts.filter(
                                  p => p.type === 'mission_verification' && 
                                  p.user_id === user?.id && 
                                  !p.is_deleted && 
                                  p.content_json?.mission_id === mission.id
                                ).length;

                                return (
                                  <div 
                                    key={mission.id} 
                                    className="border border-slate-100 bg-slate-50/30 rounded-3xl p-5 flex flex-col justify-between gap-5 hover:border-purple-200 transition-all shadow-xs"
                                  >
                                    <div className="space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <Badge className="bg-purple-100 text-purple-700 border-none font-bold text-[9.5px]">고정 챌린지</Badge>
                                        <div className="flex items-center gap-1">
                                          {myVerificationCount > 0 ? (
                                            <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[9.5px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                                              🔥 누적 {myVerificationCount}회차 인증 성공
                                            </span>
                                          ) : (
                                            <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[9.5px] font-bold px-2 py-0.5 rounded-lg">
                                              ⏳ 아직 도전 전
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <h3 className="text-base font-black text-slate-900 flex items-center gap-1">{mission.title}</h3>
                                      <div className="text-xs text-slate-500 font-medium leading-relaxed whitespace-pre-wrap bg-white/50 p-3 rounded-2xl border border-dotted border-slate-150">
                                        {mission.content}
                                      </div>
                                    </div>
                                    <Button
                                      onClick={() => {
                                        const nextCount = myVerificationCount + 1;
                                        setEditorInitialData({
                                          title: `[${nextCount}회차 인증] ${mission.title}`,
                                          content: `🎯 [${mission.title}]의 ${nextCount}번째 찐실천 미션 인증 챌린지입니다.\n\n[오늘 깨달은 놀라운 사실 핵심 요약]\n- \n\n[스터디 주도적 실천 기록]\n1. \n2. \n3. \n\n#미션인증 #챌린지 #${mission.title.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '')} ${nextCount}회차`,
                                          type: 'mission_verification',
                                          mission_id: mission.id
                                        } as any);
                                        setCommunityDetailTab('posts');
                                        toast.success(`[${mission.title}]의 ${nextCount}회차 인증 템플릿이 로드되었습니다. ✍️`);
                                        setTimeout(() => {
                                          document.getElementById('post-editor-section')?.scrollIntoView({ behavior: 'smooth' });
                                        }, 100);
                                      }}
                                      className="bg-purple-600 hover:bg-purple-700 w-full h-10 rounded-xl text-white font-black text-xs"
                                    >
                                      ✍️ 이 미션 인증하기 ({myVerificationCount + 1}회차 도전)
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 하단: 미션 인증 현황 게시판 */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <div className="space-y-1">
                            <h3 className="text-sm font-black text-purple-700 flex items-center gap-1.5">💬 참여 회원들의 실시간 인증 챌린지 피드</h3>
                            <p className="text-xs text-slate-500 font-bold">도전 중인 회원들이 올린 후기 피드입니다. 좋아요와 격려 댓글로 동반 성장해보세요!</p>
                          </div>
                          {posts.filter(p => p.type === 'mission_verification' && !p.is_deleted).length === 0 ? (
                            <div className="py-12 border border-slate-100 rounded-3xl bg-slate-50/10 text-center text-xs text-slate-400 font-extrabold leading-normal">
                              아직 등록된 회원들의 인증글이 없습니다. 첫 주인공으로 오늘 가장 뜻깊었던 실천을 뽐내보셔요!
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {posts.filter(p => p.type === 'mission_verification' && !p.is_deleted).map((post) => {
                                // 현재 회원의 이 미션 인증에 대한 누적 횟수 (해당 글을 썼던 유저 기준)
                                const userVerifyCount = posts.filter(
                                  p => p.type === 'mission_verification' && 
                                  p.user_id === post.user_id && 
                                  !p.is_deleted && 
                                  p.content_json?.mission_id === post.content_json?.mission_id
                                ).length;

                                return (
                                  <div
                                    key={post.id}
                                    onClick={() => handlePostClick(post)}
                                    className="p-5 border border-slate-100 bg-white/70 hover:bg-white hover:border-purple-200 rounded-3xl hover:shadow-md transition-all cursor-pointer space-y-3.5 flex flex-col justify-between group"
                                  >
                                    <div className="space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="w-8 h-8 rounded-lg shrink-0 border border-slate-50">
                                            <AvatarImage src={post.profiles?.avatar_url || ''} />
                                            <AvatarFallback className="bg-purple-100 text-purple-700 font-black text-[10px] rounded-lg">
                                              {(post.profiles?.nickname || post.profiles?.name || '회')[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="text-left leading-none">
                                            <h5 className="text-[11px] font-black text-slate-700">
                                              {post.profiles?.nickname || post.profiles?.name || '익명회원'}
                                            </h5>
                                            <span className="text-[9px] text-slate-400 font-bold">{getGmailDate(post.created_at)}</span>
                                          </div>
                                        </div>
                                        <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black px-2 py-0.5 rounded-md">
                                          🔥 개인 누적 {userVerifyCount}회차 인증
                                        </span>
                                      </div>
                                      <div className="text-left space-y-1">
                                        <h4 className="text-xs sm:text-sm font-black text-slate-850 group-hover:text-purple-650 transition-colors line-clamp-1">
                                          {post.title}
                                        </h4>
                                        <p className="text-xs text-slate-400 font-bold leading-normal line-clamp-2">
                                          {post.content.replace(/<[^>]*>/g, '') || "본문 내용이 없습니다."}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-50/85 pt-2.5 text-slate-400 font-black text-[9.5px]">
                                      <span className="text-[9.5px] font-bold text-slate-400">
                                        ❤️ {post.likes_count || 0}  💬 {post.comments_count || 0}
                                      </span>
                                      <span className="text-[8.5px] font-black text-purple-600 hover:underline">상세 보기 & 격려하기 →</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 미션 등록 다이얼로그 */}
                        <Dialog open={isMissionModalOpen} onOpenChange={setIsMissionModalOpen}>
                          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 border font-sans select-text">
                            <DialogHeader className="space-y-1 text-left">
                              <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-1.5">🎯 새로운 챌린지 미션 등록</DialogTitle>
                              <p className="text-xs text-slate-500 font-bold leading-normal">수강생들이 완수해 나갈 명확한 미션 제목과 지령 본문을 예쁘게 기재해 등록해 주셔요.</p>
                            </DialogHeader>
                            <div className="space-y-4 py-4 text-left">
                              <div className="space-y-1.5">
                                <Label htmlFor="title" className="text-xs font-black text-slate-700">미션 제목</Label>
                                <Input
                                  id="title"
                                  placeholder="예: 📚 일일 개발 서적 30페이지 주도적 읽기"
                                  value={newMissionTitle}
                                  onChange={(e) => setNewMissionTitle(e.target.value)}
                                  className="rounded-xl h-10 border-slate-205 text-xs font-bold bg-slate-50/50"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="content" className="text-xs font-black text-slate-700">미션 본문 및 가이드</Label>
                                <textarea
                                  id="content"
                                  placeholder="🎯 미션의 명확한 목표와 상세 수행 내용 및 양식을 친절하게 작성 장려해 보셔요."
                                  value={newMissionContent}
                                  onChange={(e) => setNewMissionContent(e.target.value)}
                                  rows={6}
                                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-bold bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 leading-normal"
                                />
                              </div>
                            </div>
                            <DialogFooter className="flex sm:justify-end gap-2.5">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsMissionModalOpen(false)}
                                className="rounded-xl font-bold h-10 text-xs text-slate-500"
                              >
                                닫기
                              </Button>
                              <Button
                                type="button"
                                disabled={isRegisteringMission}
                                onClick={handleRegisterMission}
                                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black h-10 text-xs px-5"
                              >
                                {isRegisteringMission ? '등록 중...' : '🚀 미션 생성 발송'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    {/* C. SCHEDULE TAB CONTENT */}
                    {communityDetailTab === 'schedule' && (
                      <div className="bg-white border border-slate-100 rounded-[30px] p-4 sm:p-6 text-left space-y-6 animate-fade-in shadow-xs font-sans">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                          <div className="space-y-1">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">
                              📅 [{selectedCommunity.name}] 주요 클래스 로드맵 일정
                            </h2>
                            <p className="text-xs text-slate-500 font-bold">
                              이 기수 회원들의 실시간 모임, Q&A 라이브 세션, 정기 오프라인 번개 일정을 파악해 참가하세요.
                            </p>
                          </div>
                          <Button
                            onClick={handleToday}
                            variant="outline"
                            className="border-slate-205 hover:bg-slate-50 text-slate-700 font-bold h-9 text-xs shrink-0"
                          >
                            달력 오늘 복귀
                          </Button>
                        </div>

                        {/* Month navigation controller */}
                        <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded-2xl border">
                          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-9 w-9 hover:bg-white rounded-xl">
                            <ChevronLeft className="w-5 h-5" />
                          </Button>
                          <div className="text-xs sm:text-sm font-black text-slate-800">
                            {calYear}년 {calMonth + 1}월 일정표
                          </div>
                          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-9 w-9 hover:bg-white rounded-xl">
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                        </div>

                        {/* Calendar Grid weekdays headings */}
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-500 py-1 border-b">
                          <div className="text-rose-500">일</div>
                          <div>월</div>
                          <div>화</div>
                          <div>수</div>
                          <div>목</div>
                          <div>금</div>
                          <div className="text-blue-500">토</div>
                        </div>

                        {/* Compact Calendar block mapping */}
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
                            const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
                            const prevTotalDays = new Date(calYear, calMonth, 0).getDate();

                            const calendarCells = [];

                            // Preceeding
                            for (let i = firstDayIndex - 1; i >= 0; i--) {
                              const dayNum = prevTotalDays - i;
                              const dateString = `${calMonth === 0 ? calYear - 1 : calYear}-${String(calMonth === 0 ? 12 : calMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                              calendarCells.push({ day: dayNum, isCurrentMonth: false, dateString });
                            }

                            // Current
                            for (let i = 1; i <= totalDays; i++) {
                              const dateString = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                              calendarCells.push({ day: i, isCurrentMonth: true, dateString });
                            }

                            // Succeeding
                            const extraCells = calendarCells.length % 7 === 0 ? 0 : 7 - (calendarCells.length % 7);
                            for (let i = 1; i <= extraCells; i++) {
                              const dateString = `${calMonth === 11 ? calYear + 1 : calYear}-${String(calMonth === 11 ? 1 : calMonth + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                              calendarCells.push({ day: i, isCurrentMonth: false, dateString });
                            }

                            const parsedSchedules = schedules.map(item => {
                              let details = { date: '', time: '', category: '가입 클래스일정', description: '' };
                              try { if (item.content?.startsWith('{')) { details = JSON.parse(item.content); } else { details.description = item.content; } } catch (e) {}
                              return { id: item.id, title: item.title, ...details };
                            });

                            const todayStr = (() => {
                              const todayObj = new Date();
                              return `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
                            })();

                            return calendarCells.map((cell, idx) => {
                              const cellSchedules = parsedSchedules.filter(s => s.date === cell.dateString);
                              const isToday = todayStr === cell.dateString;
                              const isSelected = selectedDateStr === cell.dateString;

                              return (
                                <div
                                  key={idx}
                                  onClick={() => setSelectedDateStr(isSelected ? null : cell.dateString)}
                                  className={cn(
                                    "min-h-[50px] sm:min-h-[66px] p-1 border border-slate-50 rounded-lg cursor-pointer flex flex-col justify-between transition-all",
                                    cell.isCurrentMonth ? "bg-white" : "bg-slate-50/50 opacity-40",
                                    isSelected ? "ring-2 ring-purple-600 ring-offset-1 bg-purple-50/20" : "hover:bg-slate-50"
                                  )}
                                >
                                  <span className={cn("text-[10px] w-4.5 h-4.5 font-bold flex items-center justify-center rounded-full", isToday ? "bg-purple-600 text-white" : "text-slate-700")}>
                                    {cell.day}
                                  </span>
                                  <div className="overflow-hidden flex flex-col gap-0.5 mt-0.5">
                                    {cellSchedules.slice(0, 1).map((s) => (
                                      <div key={s.id} className="text-[7.5px] bg-purple-50 border border-purple-200/50 text-purple-700 font-extrabold truncate px-0.5 rounded leading-none">
                                        {s.title}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl text-[11px] text-slate-505 font-bold space-y-1.5 leading-normal">
                          <p>📑 [정규수강] 전 주차 영상은 강의실 탭에서 비제한적으로 복습할 수 있습니다.</p>
                          <p>🔗 [튜터줌] 라이브 Q&A 상담은 공지된 링크를 통해 예약 후 안전하게 접속하셔요.</p>
                        </div>
                      </div>
                    )}

                    {/* D. MEMBERS TAB CONTENT */}
                    {communityDetailTab === 'members' && (
                      <div className="bg-white border border-slate-100 rounded-[30px] p-6 text-left space-y-6 animate-fade-in shadow-xs font-sans">
                        <div className="space-y-1 pb-4 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div>
                            <h2 className="text-lg font-black text-slate-900">👥 우리 기수 스터디 챌린저 명단</h2>
                            <p className="text-xs text-slate-500 font-bold">함께 미션을 완수하고 질문과 자문 노하우를 나눌 회원 리스트입니다.</p>
                          </div>
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                              value={memberSearchQuery}
                              onChange={(e) => setMemberSearchQuery(e.target.value)}
                              placeholder="회원 이름, 이메일, 닉네임 검색..."
                              className="h-8.5 pl-9 pr-3 bg-slate-100 border-transparent rounded-lg font-bold text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {filteredMembers.length === 0 ? (
                            <div className="col-span-full py-16 text-center text-xs text-slate-400 font-bold bg-slate-50/50 rounded-2xl border-none">
                              🔍 해당 검색어에 일치하는 회원을 찾지 못했습니다.
                            </div>
                          ) : (
                            filteredMembers.map((member) => {
                              const isSelf = member.id === user?.id;
                              const isInstructorOrAdmin = member.role === 'admin' || member.role === 'super_admin' || member.role === 'assistant';
                              return (
                                <div 
                                  key={member.id}
                                  className="p-3.5 border border-slate-50 hover:border-purple-100 hover:shadow-xs transition-all bg-white rounded-2xl flex items-center justify-between gap-2 shadow-inner"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Avatar className="w-9 h-9 rounded-xl shadow-xs shrink-0">
                                      <AvatarImage src={member.avatar_url || ''} />
                                      <AvatarFallback className="bg-purple-650 text-white font-extrabold text-xs">
                                        {(member.nickname || member.name || '회')[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 text-left">
                                      <div className="flex items-center gap-1">
                                        <h3 className="text-xs sm:text-sm font-black text-slate-800 truncate leading-none">
                                          {member.nickname || member.name || '회원'}
                                        </h3>
                                        {isInstructorOrAdmin ? (
                                          <Badge className="bg-rose-50 text-rose-600 text-[8px] border-none font-bold px-1 py-0 select-none">튜터진</Badge>
                                        ) : (
                                          <Badge className="bg-purple-50 text-purple-600 text-[8px] border-none font-bold px-1 py-0 select-none">회원</Badge>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-400 font-semibold truncate pt-1">{member.email}</p>
                                    </div>
                                  </div>
                                  <div className="shrink-0">
                                    {isSelf ? (
                                      <span className="text-[9px] text-purple-600 font-black border border-purple-100 bg-purple-50/60 px-1.5 py-0.5 rounded">나</span>
                                    ) : (
                                      <Button
                                        disabled={isCreatingChatForMember === member.id}
                                        onClick={() => handleStartOneToOneChat(member)}
                                        className="h-7 px-2.5 rounded-lg bg-slate-50 border hover:bg-purple-50 hover:text-purple-600 text-slate-700 font-extrabold text-[10px] shadow-none border-slate-200"
                                      >
                                        {isCreatingChatForMember === member.id ? '개설중...' : '1:1 DM'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  
                  /* B. REVERT FALLBACK GENERAL TIME ACCUMULATOR FEED OR VIEW */
                  <div className="space-y-5">
                    {/* Search Bar */}
                    <div className="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                      <div className="relative text-left w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="회원 게시글 검색 및 태그(#) 검색..."
                          className="h-10 pl-9.5 pr-4 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-purple-650 font-bold text-xs sm:text-sm text-slate-705"
                        />
                      </div>
                    </div>

                    {/* Communities Grid with Latest 3 Posts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                      {allCommunitiesReady.map((community) => {
                        // Filter posts belonging to this community, excluding templates and deleted ones
                        const communityPosts = posts
                          .filter(
                            (p) =>
                              p.community_id === community.id &&
                              p.type !== 'mission_template' &&
                              !p.is_deleted
                          )
                          // Sort by created_at descending (newest first)
                          .sort(
                            (a, b) =>
                              new Date(b.created_at).getTime() -
                              new Date(a.created_at).getTime()
                          );

                        // If there is a search query, filter the posts matching the query
                        const filteredCommPosts = searchQuery
                          ? communityPosts.filter(
                              (p) =>
                                p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                p.profiles?.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                p.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                          : communityPosts;

                        // If searching, and neither community name nor any post matches, skip
                        const matchesSearch =
                          !searchQuery ||
                          community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          filteredCommPosts.length > 0;

                        if (!matchesSearch) return null;

                        // Slice the latest 3 posts
                        const latest3Posts = filteredCommPosts.slice(0, 3);

                        return (
                          <div
                            key={community.id}
                            className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs hover:border-purple-200 hover:shadow-sm transition-all text-left flex flex-col justify-between space-y-4"
                          >
                            <div className="space-y-3.5">
                              {/* Community Header */}
                              <div className="flex items-center justify-between border-b border-slate-50 pb-3 gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-lg text-purple-600 font-extrabold shrink-0">#</span>
                                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                                    {community.name}
                                  </h3>
                                  {communityPosts.length > 0 && (
                                    <Badge className="bg-purple-50 text-purple-600 hover:bg-purple-100 border-none font-bold text-[9.5px] px-1.5 py-0.5 rounded-full shrink-0">
                                      {communityPosts.length}
                                    </Badge>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleMenuClick(community.id)}
                                  className="text-[11px] font-black text-purple-600 hover:text-purple-700 bg-transparent border-none outline-none cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap transition-colors"
                                >
                                  채널 입장하기
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Description, if exists */}
                              {community.description && (
                                <p className="text-[11.5px] text-slate-450 font-medium leading-normal line-clamp-1 pb-1">
                                  {community.description}
                                </p>
                              )}

                              {/* Latest 3 Posts List */}
                              <div className="space-y-2 pt-1 font-sans">
                                {latest3Posts.length === 0 ? (
                                  <div className="py-8 text-center bg-slate-50/20 rounded-2xl border border-dashed border-slate-105">
                                    <p className="text-[11px] text-slate-400 font-bold leading-normal">
                                      ⏳ 아직 등록된 소식이 없습니다. 첫 글을 등록해 보셔요!
                                    </p>
                                  </div>
                                ) : (
                                  latest3Posts.map((post) => {
                                    // Strip html tags for plain preview comparison
                                    const plainContent = (post.content || '').replace(/<[^>]*>/g, '');
                                    const titleStr = post.title || plainContent.substring(0, 25);
                                    
                                    return (
                                      <div
                                        key={post.id}
                                        onClick={() => handlePostClick(post)}
                                        className="p-3 bg-slate-50 hover:bg-purple-50/40 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 text-left group"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          {post.image_urls && post.image_urls.length > 0 && (
                                            <Badge className="bg-purple-100 text-purple-700 border-none font-extrabold text-[8px] px-1 py-0 scale-95 shrink-0 select-none">
                                              사진
                                            </Badge>
                                          )}
                                          <span className="text-xs sm:text-sm font-semibold text-slate-755 group-hover:text-purple-700 transition-colors truncate max-w-full">
                                            {titleStr}
                                          </span>
                                          {post.comments_count && post.comments_count > 0 ? (
                                            <span className="text-purple-650 text-[11px] font-black shrink-0">
                                              [{post.comments_count}]
                                            </span>
                                          ) : null}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[10px] font-bold text-slate-400 truncate max-w-[65px]">
                                            {post.profiles?.nickname || post.profiles?.name || '익명'}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                                            {getKoreanRelativeTime(post.created_at)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
          )}
          </div>



        </div>
      </div>

      {/* Floating Detailed Overlay Dialog Popup to read or write detailed threads cleanly */}
      <Dialog open={!!selectedDetailPost} onOpenChange={(open) => !open && setSelectedDetailPost(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-6 overflow-y-auto bg-white rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              📂 게시글 자세히 보기
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-left">
            {selectedDetailPost && (
              <PostList 
                posts={[selectedDetailPost]}
                isLoading={false}
                currentUserId={user?.id}
                isAdmin={isAdmin}
                postComments={postComments}
                onLike={handleToggleLike}
                onCommentToggle={handleToggleComments}
                onCommentSubmit={handleAddComment}
                onJoinAttendance={handleJoinAttendance}
                onToggleTodo={handleToggleTodo}
                onVotePoll={handleVotePoll}
                accessibleCommunityIds={accessibleCommunityIds}
                onDelete={(id) => {
                  handleDeletePost(id);
                  setSelectedDetailPost(null);
                }}
                onEdit={(post) => {
                  handleEditPost(post);
                  setSelectedDetailPost(null);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

        {/* Invitation Modal */}
        <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
          <DialogContent className="rounded-[32px] sm:max-w-md p-8">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Plus className="w-5 h-5 text-purple-600" />
                </div>
                회원 초대하기
              </DialogTitle>
              <DialogDescription className="text-gray-500 font-bold">
                간편한 초대 링크를 발급하거나 이메일 검색으로 회원을 초대하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Copy Invitation Link Section */}
              {selectedCommunity && (
                <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100/80 rounded-3xl space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-700 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-purple-600" />
                      커뮤니티 초대 링크 (초대장)
                    </span>
                    <Badge className="bg-purple-600 text-white border-0 text-[10px] font-black tracking-tight">자동 가입 지원</Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
                    이 링크를 복사하여 초대하고 싶은 대상에게 전달하세요. 클릭하는 즉시 이 커뮤니티에 자동 가입되며 바로 활동할 수 있습니다! (비회원은 회원가입 후 즉시 가입 완료)
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      readOnly
                      value={`${window.location.origin}/community?invite=${selectedCommunity.id}`}
                      className="text-xs font-bold text-gray-600 bg-white/70 px-3 py-2 rounded-xl border border-purple-100/50 flex-1 overflow-hidden truncate focus:outline-none"
                    />
                    <Button 
                      onClick={() => {
                        const inviteLink = `${window.location.origin}/community?invite=${selectedCommunity.id}`;
                        navigator.clipboard.writeText(inviteLink);
                        toast.success('초대장 링크가 복사되었습니다! 친구나 동료에게 전달해보세요.');
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl px-4 h-9 shadow-md shadow-purple-200 shrink-0"
                    >
                      링크 복사
                    </Button>
                  </div>
                </div>
              )}

              <div className="h-px bg-gray-100 my-2" />

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">이메일 주소로 직접 초대</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="example@email.com" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-12 rounded-2xl border-gray-100 focus:ring-purple-600 flex-1 font-bold"
                  />
                  <Button 
                    onClick={handleVerifyInvitee} 
                    disabled={isVerifyingInvitee || !inviteEmail.trim()}
                    className="h-12 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 font-black shadow-lg shadow-purple-100"
                  >
                    {isVerifyingInvitee ? "확인 중..." : "회원 확인"}
                  </Button>
                </div>
              </div>

              {verifyError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                  <Info className="w-5 h-5 text-red-500" />
                  <p className="text-xs font-black text-red-600">{verifyError}</p>
                </div>
              )}

              {inviteeProfile && (
                <div className="p-6 bg-purple-50 rounded-3xl border border-purple-100 space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-14 h-14 rounded-2xl shadow-sm">
                      <AvatarImage src={inviteeProfile.avatar_url} />
                      <AvatarFallback className="bg-white text-purple-600 font-black text-xl">{(inviteeProfile.nickname || inviteeProfile.name || 'U')[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-lg font-black text-gray-900 truncate tracking-tight">{inviteeProfile.nickname || inviteeProfile.name}</div>
                      <div className="text-xs text-gray-500 font-bold truncate">{inviteeProfile.email}</div>
                    </div>
                  </div>
                  <Button 
                    onClick={handleInviteAction}
                    className="w-full h-12 rounded-2xl bg-white hover:bg-purple-100 text-purple-600 border border-purple-100 font-black shadow-sm"
                  >
                    이 회원 초대하기
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Community Settings Modal */}
        <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
          <DialogContent className="rounded-[32px] sm:max-w-md p-8">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-gray-600" />
                </div>
                커뮤니티 설정
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-8 py-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="space-y-0.5">
                  <div className="text-sm font-black text-gray-900">채팅 바로 받기</div>
                  <div className="text-[10px] text-gray-400 font-bold">채팅 메시지를 바로 수신할 수 있도록 합니다.</div>
                </div>
                <div 
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                    receiveChatNotifs ? "bg-purple-600" : "bg-gray-200"
                  )}
                  onClick={() => setReceiveChatNotifs(!receiveChatNotifs)}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white absolute top-1 transition-all",
                    receiveChatNotifs ? "right-1" : "left-1"
                  )} />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <Button 
                  variant="ghost" 
                  onClick={handleLeaveCommunity}
                  className="w-full h-14 rounded-2xl text-red-500 hover:bg-red-50 hover:text-red-600 font-black flex items-center justify-between px-6"
                >
                  <span>커뮤니티 탈퇴하기</span>
                  <Trash2 className="w-5 h-5" />
                </Button>
                <p className="text-center text-[10px] text-gray-400 font-bold mt-4">탈퇴 후 재가입은 관리자의 승인이 필요할 수 있습니다.</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Chat Room Modal */}
        <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
          <DialogContent className="rounded-[32px] sm:max-w-md p-8">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <MessageSquareIcon className="w-5 h-5 text-purple-600" />
                </div>
                새로운 채팅방
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">채팅방 유형</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['public', 'private', 'one_to_one'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewChatConfig(prev => ({ ...prev, type }))}
                      className={cn(
                        "h-14 rounded-2xl border text-[11px] font-black transition-all flex flex-col items-center justify-center gap-1",
                        newChatConfig.type === type ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-100" : "bg-white border-gray-100 text-gray-400 hover:border-purple-200"
                      )}
                    >
                      {type === 'public' && "공개"}
                      {type === 'private' && "비공개"}
                      {type === 'one_to_one' && "1:1"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">채팅방 이름</Label>
                <Input 
                  placeholder="예: 자유 수다방" 
                  value={newChatConfig.name}
                  onChange={(e) => setNewChatConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="h-12 rounded-2xl border-gray-100 font-bold"
                />
              </div>

              {newChatConfig.type === 'private' && (
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">암호 설정</Label>
                  <Input 
                    type="password"
                    placeholder="입장 암호를 입력하세요" 
                    value={newChatConfig.password}
                    onChange={(e) => setNewChatConfig(prev => ({ ...prev, password: e.target.value }))}
                    className="h-12 rounded-2xl border-gray-100 font-bold"
                  />
                </div>
              )}

              {newChatConfig.type === 'one_to_one' && (
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">회원 찾기</Label>
                  <div className="space-y-4">
                    <Input 
                      placeholder="이름 또는 이메일 검색" 
                      value={userSearchQuery}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      className="h-12 rounded-2xl border-gray-100 font-bold"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-2">
                       {searchedUsers.map(u => (
                         <button 
                           key={u.id}
                           onClick={() => {
                             setSelectedChatMembers([u.id]);
                             setNewChatConfig(prev => ({ ...prev, name: `${u.nickname || u.name}님과의 대화` }));
                           }}
                           className={cn(
                             "w-full flex items-center gap-3 p-3 rounded-2xl transition-all",
                             selectedChatMembers.includes(u.id) ? "bg-purple-50 ring-1 ring-purple-100" : "hover:bg-gray-50 bg-white border border-transparent"
                           )}
                         >
                           <Avatar className="w-8 h-8 rounded-xl">
                             <AvatarImage src={u.avatar_url} />
                             <AvatarFallback className="bg-purple-100 text-purple-600 font-black text-[8px]">{(u.nickname || u.name || 'U')[0]}</AvatarFallback>
                           </Avatar>
                           <div className="text-left flex-1 min-w-0">
                             <div className="text-[11px] font-black text-gray-900 truncate">{u.nickname || u.name}</div>
                             <div className="text-[9px] text-gray-400 font-bold truncate">{u.email}</div>
                           </div>
                         </button>
                       ))}
                    </div>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleCreateChatRoom}
                disabled={!newChatConfig.name.trim()}
                className="w-full h-14 rounded-2xl bg-purple-600 hover:bg-purple-700 font-black shadow-lg shadow-purple-100 text-white mt-4"
              >
                채팅방 개설하기
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Community Specific New Chat Room Dialog */}
        <Dialog open={isCreatingCommunityRoom} onOpenChange={setIsCreatingCommunityRoom}>
          <DialogContent className="rounded-[32px] sm:max-w-md p-8">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <MessageSquareIcon className="w-5 h-5 text-purple-600" />
                </div>
                소통방 개설
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-gray-400">
                이 커뮤니티 전용 실시간 채팅방을 개설합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCommunityRoom} className="space-y-6 pt-2">
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">소통방 유형</Label>
                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setNewRoomType('public'); setNewRoomTargetMemberId(''); }}
                    className={cn(
                      "h-11 rounded-xl text-[11px] font-black transition-all",
                      newRoomType === 'public' ? "bg-purple-600 text-white shadow" : "text-gray-500 hover:bg-white hover:text-purple-600"
                    )}
                  >
                    공개방
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewRoomType('private'); setNewRoomTargetMemberId(''); }}
                    className={cn(
                      "h-11 rounded-xl text-[11px] font-black transition-all",
                      newRoomType === 'private' ? "bg-purple-600 text-white shadow" : "text-gray-500 hover:bg-white hover:text-purple-600"
                    )}
                  >
                    비공개방
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRoomType('dm')}
                    className={cn(
                      "h-11 rounded-xl text-[11px] font-black transition-all",
                      newRoomType === 'dm' ? "bg-purple-600 text-white shadow" : "text-gray-500 hover:bg-white hover:text-purple-600"
                    )}
                  >
                    1:1 DM
                  </button>
                </div>
              </div>

              {newRoomType !== 'dm' && (
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">소통방 이름</Label>
                  <Input 
                    placeholder="예: 과제 질문 피드백방, 공모전 준비..." 
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="h-12 rounded-2xl border-gray-150 font-bold"
                  />
                </div>
              )}

              {newRoomType === 'dm' && (
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">대화 상대 선택 (1:1)</Label>
                  <select
                    value={newRoomTargetMemberId}
                    onChange={(e) => setNewRoomTargetMemberId(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-gray-150 rounded-2xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-600"
                  >
                    <option value="">대화할 수강생을 선택하세요</option>
                    {communityMembers
                      .filter(m => m.id !== user?.id)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {newRoomType === 'private' && (
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase text-gray-400 tracking-widest pl-1">첫 초대 멤버 (선택)</Label>
                  <select
                    value={newRoomTargetMemberId}
                    onChange={(e) => setNewRoomTargetMemberId(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-gray-150 rounded-2xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-600"
                  >
                    <option value="">같이 입장시킬 멤버 선택</option>
                    {communityMembers
                      .filter(m => m.id !== user?.id)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <Button 
                type="submit"
                className="w-full h-14 rounded-2xl bg-purple-600 hover:bg-purple-700 font-black shadow-lg shadow-purple-100 text-white mt-4"
              >
                소통방 개설하기
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Post Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none">
          {editingPost && (
            <PostEditor
              communityId={editingPost.community_id}
              initialPost={editingPost}
              onSuccess={(updatedPost) => {
                setPosts(prev => prev.map(p => p.id === updatedPost.id ? { ...p, ...updatedPost } : p));
                setShowEditDialog(false);
                setEditingPost(null);
              }}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingPost(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Comment Dialog */}
      <Dialog open={!!editingComment} onOpenChange={(open) => !open && setEditingComment(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-[40px] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 tracking-tight">댓글 수정</DialogTitle>
            <DialogDescription className="text-gray-400 font-bold text-[10px] uppercase tracking-widest pt-1">댓글 내용을 수정하세요</DialogDescription>
          </DialogHeader>
          <div className="py-6 font-sans">
            <Textarea 
              value={editCommentContent}
              onChange={(e) => setEditCommentContent(e.target.value)}
              placeholder="내용을 입력하세요"
              className="min-h-[120px] bg-gray-50 border-none rounded-3xl font-medium p-6 focus-visible:ring-2 focus-visible:ring-purple-600 transition-all leading-relaxed resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditingComment(null)} className="h-12 rounded-2xl font-bold px-8 hover:bg-gray-50">취소</Button>
            <Button 
              onClick={handleUpdateComment} 
              disabled={isUpdatingComment}
              className="h-12 rounded-2xl font-black px-10 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-100 transition-all"
            >
              {isUpdatingComment ? '수정 중...' : '수정 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[400px] rounded-[40px] p-8 border-none shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-black text-gray-900 tracking-tight text-center">게시글 삭제</DialogTitle>
            <DialogDescription className="text-gray-500 font-bold text-center">
              정말로 이 게시글을 삭제하시겠습니까? <br/>
              삭제된 게시글은 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-8">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(false)} 
              disabled={isDeleting}
              className="flex-1 h-14 rounded-2xl font-black border-gray-100 hover:bg-gray-50 transition-all active:scale-95"
            >
              취소
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeletePost}
              disabled={isDeleting}
              className="flex-1 h-14 rounded-2xl bg-red-500 hover:bg-red-600 font-black shadow-lg shadow-red-100 transition-all active:scale-95 text-white"
            >
              {isDeleting ? "삭제 중..." : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
