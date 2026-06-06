import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Flame,
  Users,
  ChevronRight,
  ChevronLeft,
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
  CheckCircle2
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { PostEditor } from '@/components/community/PostEditor';
import { PostList } from '@/components/community/PostList';
import { ChatRoomView } from '@/components/community/ChatRoomView';
import { type Post, type Message, Comment as CommunityComment, type ChatRoom } from '@/types';

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
  beone_exclusive_online: '비원회원전용 커뮤니티 (온라인)',
  beone_exclusive_offline: '비원회원전용 커뮤니티 (오프라인)',
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
  const [activeTab, setActiveTab] = useState<'feed' | 'chat'>('feed');
  const [showMemberTagList, setShowMemberTagList] = useState<{ postId?: string, type: 'post' | 'comment' | 'chat', active: boolean, query: string }>({ type: 'post', active: false, query: '' });
  const [communityMembers, setCommunityMembers] = useState<any[]>([]);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);

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

  const filteredPosts = posts.filter(post => 
    post.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.profiles?.nickname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        const [allComms, allCourses] = await Promise.all([
          communityService.getAdminCommunities(),
          courseService.getCourses()
        ]);

        setAllCommunitiesReady(allComms);
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
  const isAdmin = user && (user.role === 'super_admin' || user.role === 'admin' || user.email === 'kys@k-learn.co.kr');

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

  if (loading) return (
    <div className="min-h-screen bg-[#f8fafc] pt-32 flex flex-col items-center justify-center font-black text-gray-300 gap-4">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full"
      />
      커뮤니티 공간을 구성하는 중...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-32 pb-32 overflow-x-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        <AnimatePresence mode="wait">
          {!selectedCommunity ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-16"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-4">
                   <Badge className="bg-white text-purple-600 border border-purple-100 font-black px-4 py-1.5 rounded-full text-xs tracking-widest uppercase shadow-sm">
                     BE ONE Circles
                   </Badge>
                   <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter leading-none">
                     비원아카데미 <br /> <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">커뮤니티</span>
                   </h1>
                </div>
                {isAdmin && (
                  <Link 
                    to="/admin/community"
                    className={cn(
                      buttonVariants({ variant: 'default' }),
                      "h-16 px-10 rounded-[28px] bg-gray-900 hover:bg-gray-800 text-white font-black text-lg gap-3 shadow-2xl shadow-gray-200 transition-all hover:scale-105 active:scale-95 flex items-center"
                    )}
                  >
                    <Plus className="w-5 h-5 text-purple-400" /> 커뮤니티 관리
                  </Link>
                )}
              </div>

              <div className="space-y-24">
                {Object.keys(SECTION_TITLES).map(id => (
                  <CommunitySection 
                    key={id}
                    title={SECTION_TITLES[id]}
                    communities={sections[id]}
                    onSelect={async (c) => {
                      try {
                        const hasAccess = await accessService.canAccessCommunity(c.id);
                        if (!hasAccess) {
                          setHasActiveAccess(false);
                          if (user) {
                            const { data: membership } = await supabase
                              .from('community_members')
                              .select('role')
                              .eq('community_id', c.id)
                              .eq('user_id', user.id)
                              .maybeSingle();
                            setIsPendingApproval(membership?.role === 'pending');
                          } else {
                            setIsPendingApproval(false);
                          }
                          setSelectedCommunity(c);
                          setSearchParams({ id: c.id });
                          return;
                        }
                        setHasActiveAccess(true);
                        setIsPendingApproval(false);
                        setSelectedCommunity(c);
                        setSearchParams({ id: c.id });
                      } catch (err) {
                        console.error('Error selecting community:', err);
                        toast.error('상세 조회 권한 확인 중 에러가 발생했습니다.');
                      }
                    }}
                  />
                ))}
              </div>

              {Object.values(sections).every(s => s.length === 0) && (
                <div className="py-32 flex flex-col items-center justify-center bg-white rounded-[40px] border border-dashed border-gray-200">
                   <Users className="w-16 h-16 text-gray-200 mb-4" />
                   <h3 className="text-xl font-bold text-gray-400">등록된 커뮤니티가 없습니다.</h3>
                   <p className="text-gray-300 mt-2">관리자에게 문의해 주세요.</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-[1400px] mx-auto pt-4"
            >
              {/* Mobile header for detailed community space */}
              <div className="lg:hidden flex items-center justify-between bg-white border border-gray-100 rounded-3xl p-4.5 mb-5 shadow-sm">
                <div className="flex items-center gap-3.5 min-w-0 text-left">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      setSelectedCommunity(null);
                      setSearchParams({});
                    }}
                    className="w-10 h-10 rounded-2xl bg-gray-50 text-gray-700 hover:bg-gray-100 shrink-0 border-none transition-all"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="min-w-0 leading-tight">
                    <h2 className="text-sm font-black text-gray-950 truncate">
                      {selectedCommunity.name}
                    </h2>
                    <span className="text-[10px] text-gray-400 font-bold tracking-tight block mt-0.5">수강생 커뮤니티 홈</span>
                  </div>
                </div>
                
                {/* Hamburger button for switching communities or viewing members / channels */}
                <Button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-600 font-black text-xs h-10 px-4 rounded-xl flex items-center gap-2 border-none transition-all shrink-0"
                >
                  <Menu className="w-4.5 h-4.5" />
                  <span>메뉴</span>
                </Button>
              </div>

              {!hasActiveAccess ? (
                <div className="max-w-2xl mx-auto py-12 px-4">
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[40px] border border-gray-100 p-8 md:p-12 shadow-xl shadow-purple-50 flex flex-col items-center text-center relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />
                    
                    <div className="w-24 h-24 rounded-[32px] bg-purple-50 flex items-center justify-center text-purple-600 mb-8 border border-purple-100/50 shadow-inner">
                      <Lock className="w-10 h-10" />
                    </div>

                    <Badge className="bg-purple-100/80 text-purple-700 border-none font-bold px-4 py-1.5 rounded-full text-xs mb-4">
                      비공개 커뮤니티 공간
                    </Badge>

                    <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-4">
                      {selectedCommunity.name}
                    </h2>

                    <p className="text-gray-500 leading-relaxed max-w-md font-medium text-sm mb-8">
                      본 공간은 수강 신청 완료 회원 또는 클럽 멤버십 전용 커뮤니티입니다. 가입 신청을 하시면 아카데미 관리자의 승인 절차를 거쳐 바로 자유롭게 참여 및 교류하실 수 있습니다.
                    </p>

                    <div className="w-full flex flex-col sm:flex-row gap-3 justify-center items-center">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCommunity(null);
                          setSearchParams({});
                        }}
                        className="w-full sm:w-auto h-14 px-8 rounded-2xl font-bold border-gray-200 hover:bg-gray-50 text-gray-700 transition-all active:scale-95"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        목록으로 돌아가기
                      </Button>

                      {isPendingApproval ? (
                        <div className="w-full sm:w-auto bg-amber-50 border border-amber-200 text-amber-700 font-bold h-14 px-8 rounded-2xl flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-amber-600 animate-pulse" />
                          가입 승인 대기 중
                        </div>
                      ) : (
                        <Button
                          disabled={isJoinApplying}
                          onClick={handleApplyToJoin}
                          className="w-full sm:w-auto h-14 px-8 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-lg shadow-purple-100 transition-all active:scale-95"
                        >
                          {isJoinApplying ? (
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              신청 중...
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Award className="w-4.5 h-4.5" />
                              가입 신청하기
                            </div>
                          )}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Sidebar: 3 cols */}
                <div className="hidden lg:block lg:col-span-3 space-y-6 sticky top-4">
                  <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                    <div className="h-32 relative">
                      <img 
                        src={selectedCommunity.banner_url || "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80"} 
                        className="w-full h-full object-cover" 
                        alt="" 
                      />
                    </div>
                    <div className="p-6 space-y-4">
                      <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight">
                        {selectedCommunity.name}
                      </h2>
                      <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                        본 커뮤니티는 강의 또는 시즌제 커뮤니티 가입 시 생성되며 관리자 승인에 의해 가입된 회원만 참여할 수 있습니다.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-10 rounded-xl border-gray-100 font-bold text-xs hover:bg-purple-50 hover:text-purple-600 transition-all active:scale-95"
                          onClick={() => setShowInviteModal(true)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-2" />
                          초대
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-10 rounded-xl border-gray-100 font-bold text-xs hover:bg-gray-50 transition-all active:scale-95"
                          onClick={() => setShowSettingsModal(true)}
                        >
                          <Settings className="w-3.5 h-3.5 mr-2" />
                          설정
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center Content: 6 cols */}
                <div className="lg:col-span-6 space-y-6">
                  {/* Search Bar */}
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-purple-600 transition-colors" />
                    <Input 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="글 내용, #태그, @작성자 검색"
                      className="h-12 pl-11 pr-4 bg-white border-gray-100 rounded-2xl font-bold text-xs focus:ring-purple-600 shadow-sm"
                    />
                  </div>

                  {/* Post Creator */}
                  <PostEditor 
                    communityId={selectedCommunity.id} 
                    onSuccess={(newPost) => setPosts(prev => [newPost, ...prev])} 
                  />

                  {/* Post Feed */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                       <button className="flex items-center gap-1 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-purple-600">
                         최신순 <ChevronRight className="w-3 h-3 rotate-90" />
                       </button>
                       <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-900"><LayoutGrid className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-gray-300"><ChevronRight className="w-4 h-4 rotate-180" /></Button>
                       </div>
                    </div>

                    <PostList 
                      posts={filteredPosts}
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
                    />
                  </div>
                </div>

                {/* Right Sidebar: 3 cols */}
                <div className="hidden lg:block lg:col-span-3 space-y-6 sticky top-4">
                  {/* 커뮤니티 전용 채팅방(소통방) 리스트 */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                       <h3 className="text-xs font-black text-gray-900 tracking-tight flex items-center gap-2">
                         <MessageSquareIcon className="w-4 h-4 text-purple-600" />
                         커뮤니티 소통방 {communityRooms.length > 0 && `(${communityRooms.length})`}
                       </h3>
                       <Button
                         onClick={() => setIsCreatingCommunityRoom(true)}
                         variant="ghost" 
                         size="sm"
                         className="h-7 px-2.5 rounded-lg text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 font-extrabold"
                       >
                         <Plus className="w-3.5 h-3.5 mr-1" />
                         방 개설
                       </Button>
                    </div>
                    
                    <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto">
                      {communityRooms.length === 0 ? (
                        <div className="py-8 text-center text-[10px] text-gray-400 font-bold leading-relaxed">
                          개설된 소통방이 없습니다.<br/>
                          우측 '방 개설' 버튼을 눌러보세요!
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-left">
                          {communityRooms.map((room) => {
                            return (
                              <div 
                                key={room.id}
                                onClick={() => navigate(`/chat?room=${room.id}`)}
                                className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50/50 hover:bg-purple-50/20 active:bg-purple-50 hover:border-purple-200 border border-transparent transition-all cursor-pointer group"
                              >
                                <div className="min-w-0 leading-tight text-left">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-black text-gray-900 truncate max-w-[130px]">
                                      {room.room_name || room.name}
                                    </span>
                                    {room.room_type === 'private' && (
                                      <span className="text-[8px] font-black bg-red-50 text-red-650 px-1.5 py-0.5 rounded-md scale-90">비공개</span>
                                    )}
                                    {room.room_type === 'dm' && (
                                      <span className="text-[8px] font-black bg-blue-50 text-blue-650 px-1.5 py-0.5 rounded-md scale-90">1:1 DM</span>
                                    )}
                                    {(room.room_type === 'public' || !room.room_type) && (
                                      <span className="text-[8px] font-black bg-purple-50 text-purple-650 px-1.5 py-0.5 rounded-md scale-90">공개</span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">
                                    클릭 시 소통방 페이지로 이동
                                  </span>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 참여 수강생 리스트 */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                       <h3 className="text-xs font-black text-gray-900 tracking-tight flex items-center gap-2">
                         <Users className="w-4 h-4 text-purple-600" />
                         참여 수강생
                         <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full font-sans">
                           {communityMembers?.length || 0}
                         </span>
                       </h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <Input
                          placeholder="이름으로 찾기"
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="h-8 pl-8 pr-3 text-[10px] bg-gray-50 border-transparent rounded-xl focus:bg-white focus:ring-purple-600 font-bold"
                        />
                      </div>

                      <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                        {filteredMembers.length === 0 ? (
                          <div className="py-6 text-center text-[10px] text-gray-400 font-bold">
                            참여 수강생이 없습니다.
                          </div>
                        ) : (
                          filteredMembers.map((member) => {
                            const isMe = member.id === user?.id;
                            const isAdminRole = member.role === 'admin' || member.role === 'super_admin' || member.email === 'kys@k-learn.co.kr';

                            return (
                              <div key={member.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-white hover:bg-gray-50/80 transition-colors">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar className="w-8 h-8 rounded-xl shadow-sm bg-white shrink-0">
                                    {member.avatarUrl ? (
                                      <AvatarImage src={member.avatarUrl} referrerPolicy="no-referrer" />
                                    ) : null}
                                    <AvatarFallback className="bg-purple-100 text-purple-600 font-extrabold text-[10px]">
                                      {(member.nickname || member.name || '수')[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 leading-snug">
                                    <div className="flex items-center gap-1 opacity-95">
                                      <span className="text-[11px] font-black text-gray-900 truncate">
                                        {member.nickname || member.name}
                                      </span>
                                      {isMe && (
                                        <span className="text-[8px] font-black bg-purple-100 text-purple-600 px-1 py-0.2 rounded font-sans scale-90">나</span>
                                      )}
                                      {isAdminRole && (
                                        <span className="text-[8px] font-black bg-orange-100 text-orange-600 px-1 py-0.2 rounded font-sans scale-90">관리자</span>
                                      )}
                                    </div>
                                    <span className="text-[8px] text-gray-400 font-bold block truncate tracking-tight font-sans">
                                      {member.email}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* Mobile Sliding Drawer Menu for Community Page */}
              <AnimatePresence>
                {isMobileMenuOpen && (
                  <div className="fixed inset-0 z-50 lg:hidden flex">
                    {/* Dark backdrop overlay */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="absolute inset-0 bg-black/60"
                    />
                    
                    {/* Drawer Content */}
                    <motion.div
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                      className="relative ml-auto w-80 max-w-[85vw] h-full bg-[#f8fafc] text-gray-950 flex flex-col shadow-2xl overflow-hidden"
                    >
                      {/* Close button header */}
                      <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 text-left">
                        <div className="min-w-0 leading-tight">
                          <h3 className="font-black text-slate-900 text-sm tracking-tight truncate max-w-[180px]">
                            {selectedCommunity.name}
                          </h3>
                          <span className="text-[9px] font-bold text-purple-600 block mt-1">커뮤니티 서랍 메뉴</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="w-8 h-8 rounded-xl hover:bg-slate-50 border-none text-slate-400 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Content Scroll area */}
                      <div className="flex-grow overflow-y-auto p-4 space-y-6 text-left">
                        {/* 1. Community circles list switcher */}
                        <div className="space-y-2.5">
                          <h4 className="text-[10px] font-black tracking-wider text-purple-600 uppercase flex items-center gap-1.5 pl-1">
                            <Users className="w-3.5 h-3.5" />
                            가입한 다른 커뮤니티 목록
                          </h4>
                          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                            {allCommunitiesReady.map((comm) => {
                              const isCurrent = comm.id === selectedCommunity.id;
                              return (
                                <button
                                  key={comm.id}
                                  onClick={async () => {
                                    setIsMobileMenuOpen(false);
                                    try {
                                      const hasAccess = await accessService.canAccessCommunity(comm.id);
                                      if (!hasAccess) {
                                        setHasActiveAccess(false);
                                        if (user) {
                                          const { data: membership } = await supabase
                                            .from('community_members')
                                            .select('role')
                                            .eq('community_id', comm.id)
                                            .eq('user_id', user.id)
                                            .maybeSingle();
                                          setIsPendingApproval(membership?.role === 'pending');
                                        } else {
                                          setIsPendingApproval(false);
                                        }
                                        setSelectedCommunity(comm);
                                        setSearchParams({ id: comm.id });
                                        return;
                                      }
                                      setHasActiveAccess(true);
                                      setIsPendingApproval(false);
                                      setSelectedCommunity(comm);
                                      setSearchParams({ id: comm.id });
                                    } catch (err) {
                                      console.error('Error switching community inside mobile menu:', err);
                                    }
                                  }}
                                  className={cn(
                                    "w-full text-left p-2.5 rounded-xl border-none transition-all text-xs font-bold flex items-center justify-between gap-2.5",
                                    isCurrent 
                                      ? "bg-purple-650 text-white shadow-sm" 
                                      : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-100"
                                  )}
                                >
                                  <span className="truncate">{comm.name}</span>
                                  {!isCurrent && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Actions info */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">공간 관리 및 설정</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-10 rounded-xl border-gray-105 font-bold text-xs hover:bg-purple-50 hover:text-purple-600 transition-all bg-slate-50/50"
                              onClick={() => {
                                setIsMobileMenuOpen(false);
                                setShowInviteModal(true);
                              }}
                            >
                              <Plus className="w-3.5 h-3.5 mr-2" />
                              초대하기
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-10 rounded-xl border-gray-105 font-bold text-xs hover:bg-gray-50 transition-all bg-slate-50/50"
                              onClick={() => {
                                setIsMobileMenuOpen(false);
                                setShowSettingsModal(true);
                              }}
                            >
                              <Settings className="w-3.5 h-3.5 mr-2" />
                              설정관리
                            </Button>
                          </div>
                        </div>

                        {/* 3. Community Chat Rooms list */}
                        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                          <div className="p-4.5 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-900 tracking-tight flex items-center gap-2 leading-none">
                              <MessageSquareIcon className="w-4 h-4 text-purple-600" />
                              소통방 목록
                            </h3>
                            <Button
                              onClick={() => {
                                setIsMobileMenuOpen(false);
                                setIsCreatingCommunityRoom(true);
                              }}
                              variant="ghost" 
                              size="sm"
                              className="h-7 px-2.5 rounded-lg text-[9px] bg-purple-50 hover:bg-purple-100 text-purple-600 border-none font-extrabold"
                            >
                              방 개설
                            </Button>
                          </div>
                          
                          <div className="p-3.5 space-y-1.5 max-h-[180px] overflow-y-auto">
                            {communityRooms.length === 0 ? (
                              <div className="py-6 text-center text-[10px] text-gray-400 font-bold">
                                개설된 소통방이 없습니다.
                              </div>
                            ) : (
                              communityRooms.map((room) => (
                                <div 
                                  key={room.id}
                                  onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    navigate(`/chat?room=${room.id}`);
                                  }}
                                  className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50 hover:bg-purple-50/20 active:bg-purple-50 hover:border-purple-200 border border-transparent transition-all cursor-pointer group text-left"
                                >
                                  <div className="min-w-0 leading-tight">
                                    <span className="text-[11px] font-black text-gray-900 truncate block">
                                      {room.room_name || room.name}
                                    </span>
                                  </div>
                                  <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-purple-600 transition-all shrink-0" />
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* 4. Active Members list */}
                        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                          <div className="p-4.5 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-900 tracking-tight flex items-center gap-1.5 leading-none">
                              <Users className="w-4 h-4 text-purple-600" />
                              참여 수강생
                              <span className="text-[9px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full">
                                {communityMembers?.length || 0}
                              </span>
                            </h3>
                          </div>
                          <div className="p-3.5 space-y-2 max-h-[180px] overflow-y-auto">
                            <div className="space-y-1">
                              {communityMembers.map((member) => {
                                if (!member) return null;
                                const isMe = member.id === user?.id;
                                const isAdminRole = member.role === 'admin' || member.role === 'super_admin' || member.email === 'kys@k-learn.co.kr';
                                return (
                                  <div key={member.id} className="flex items-center justify-between p-1.5 rounded-xl bg-white hover:bg-gray-50/80 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Avatar className="w-7 h-7 rounded-lg shrink-0">
                                        {member.avatarUrl ? (
                                          <AvatarImage src={member.avatarUrl} referrerPolicy="no-referrer" />
                                        ) : null}
                                        <AvatarFallback className="bg-purple-100 text-purple-600 font-black text-[9px] flex items-center justify-center">
                                          {(member.name || '수')[0]}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 leading-tight">
                                        <div className="flex items-center gap-1 opacity-95">
                                          <span className="text-[10px] font-black text-gray-900 truncate">
                                            {member.name}
                                          </span>
                                          {isMe && <span className="text-[7px] bg-purple-100 text-purple-600 px-1 py-0.2 rounded font-sans scale-90 text-center flex items-center justify-center">나</span>}
                                          {isAdminRole && <span className="text-[7px] bg-orange-100 text-orange-600 px-1 py-0.2 rounded font-sans scale-90 text-center flex items-center justify-center">관리자</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

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
      </div>

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
