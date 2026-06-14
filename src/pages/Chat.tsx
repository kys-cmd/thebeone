import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { storageService } from '@/services/storageService';
import { 
  Hash, Lock, Users, Plus, Send, Search, Paperclip, Trash2, 
  MessageSquare, UserMinus, ShieldAlert, ArrowLeft, LogOut, Check,
  Sparkles, Smile, Image as ImageIcon, CheckCircle, FileText, ChevronDown,
  Bold, Italic, Underline, Strikethrough, Link as LinkIcon, List, ListOrdered, 
  Quote, Code, Braces, AtSign, HelpCircle, ExternalLink, Menu, X, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { notificationService } from '@/services/notificationService';

// 캐시 객체 정의 (메시지를 오갈 때 불필요한 링크 메타데이터 재호출 방지)
const previewCache: Record<string, any> = {};

function LinkPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<any>(previewCache[url] || null);
  const [loading, setLoading] = useState(!previewCache[url]);

  useEffect(() => {
    if (preview) return;

    let isMounted = true;
    const fetchPreview = async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Preview fetch failed');
        const data = await res.json();
        if (isMounted) {
          previewCache[url] = data;
          setPreview(data);
        }
      } catch (err) {
        console.warn('Failed to fetch link preview:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPreview();
    return () => {
      isMounted = false;
    };
  }, [url, preview]);

  if (loading) {
    return (
      <div className="mt-2 text-left flex gap-3 p-3 bg-slate-50 border border-slate-200/50 rounded-2xl max-w-[340px] animate-pulse">
        <div className="w-12 h-12 bg-slate-200 rounded-xl shrink-0" />
        <div className="flex-grow space-y-1.5 py-1">
          <div className="h-3 bg-slate-200 rounded w-1/3" />
          <div className="h-2.5 bg-slate-200 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={preview.url || url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 text-left flex flex-col bg-slate-50 border border-slate-200/50 rounded-2xl max-w-[340px] hover:bg-slate-100/50 transition-all overflow-hidden group shadow-sm hover:shadow"
    >
      {preview.image && (
        <div className="w-full h-32 overflow-hidden bg-slate-100 border-b border-slate-200/30">
          <img
            src={preview.image}
            alt={preview.title}
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div className="p-3.5 leading-normal">
        {preview.siteName && (
          <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wide">
            {preview.siteName}
          </span>
        )}
        <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-purple-600 transition-colors">
          {preview.title}
        </h4>
        {preview.description && (
          <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // URL에서 선택된 room_id 추출
  const selectedRoomId = searchParams.get('room');
  const isPopup = searchParams.get('popup') === 'true' || (
    typeof window !== 'undefined' && (
      new URLSearchParams(window.location.search).get('popup') === 'true' ||
      sessionStorage.getItem('is_popup_chat') === 'true' ||
      window.name === 'BOneChatWindow'
    )
  );

  // 채팅방 리스트 및 필터 상태
  const [rooms, setRooms] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [isRoomOwner, setIsRoomOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);

  // 팝업 모드일 시 body 스크롤 방지 및 꽉 채우기
  useEffect(() => {
    if (isPopup) {
      document.body.style.overflow = 'hidden';
      document.body.style.width = '100vw';
      document.body.style.height = '100vh';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100vh';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
    };
  }, [isPopup]);

  // 실시간 메시지 상태
  const [messages, setMessages] = useState<any[]>([]);
  const [lastMessagesMap, setLastMessagesMap] = useState<Record<string, { message: string, created_at: string, nickname: string }>>({});
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // 파일 업로드 관련 상태
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 방 개설 모달 관련 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<'public' | 'private' | 'dm'>('public');
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRoomTargetId, setCreateRoomTargetId] = useState('');
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  
  // 커뮤니티 목록 및 초대 모달 추가 상태
  const [communitiesMap, setCommunitiesMap] = useState<Record<string, any>>({});
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedInviteUserId, setSelectedInviteUserId] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  // 검색 필터
  const [channelSearch, setChannelSearch] = useState('');
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Formatting & Tool states
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [tenorSearchQuery, setTenorSearchQuery] = useState('');
  const [tenorGifs, setTenorGifs] = useState<any[]>([]);
  const [loadingTenor, setLoadingTenor] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'emoji' | 'gif'>('emoji');

  const POPULAR_EMOJIS = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌',
    '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓',
    '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫',
    '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
    '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🤫', '🫠', '✍️', '👍', '👎', '👊',
    '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇',
    '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🤝', '🙏', '👏', '🙌', '🎉', '🔥',
    '🚀', '⭐', '✨', '🎈', '🎁', '🎂', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍'
  ];

  const isAdmin = user && (user.role === 'super_admin' || user.role === 'admin');

  // 방 이름 도우미
  const getRoomDisplayName = (room: any) => {
    if (!room) return '';
    
    // 1:1 대화(dm) 또는 1:1 매칭 방인 경우 상대방 이름을 획득해 리턴
    if (room.room_type === 'dm' || room.room_type === 'one_to_one' || (room.room_name && room.room_name.includes('1:1'))) {
      const otherMembers = room.chat_room_members?.filter((m: any) => m.user_id !== user?.id) || [];
      if (otherMembers.length > 0) {
        let otherProfiles = otherMembers.map((m: any) => m.profiles).filter(Boolean);
        if (otherProfiles.length === 0 && Object.keys(profilesMap).length > 0) {
          otherProfiles = otherMembers.map((m: any) => profilesMap[m.user_id]).filter(Boolean);
        }
        if (otherProfiles.length > 0) {
          const names = otherProfiles.map((p: any) => p.nickname || p.name).join(', ');
          return `👤 ${names} 님과의 1:1 대화`;
        }
      }
    }

    let nameStr = room.room_name || room.name || '소통방';
    
    // 혹시라도 방 명칭 자체에 #이 들어있다면 앞에 있는 것을 가볍게 제거하여 #의 중복 노출 방지
    nameStr = nameStr.replace(/^#+/, '').trim();
    
    if (room.community_id && communitiesMap[room.community_id]) {
      const comm = communitiesMap[room.community_id];
      const prefix = `[${comm.name}]`;
      
      // 혹시라도 구 형태 또는 겹쳐 생성된 prefix 제거
      const escapedCommName = comm.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const patterns = [
        new RegExp(`^\\[${escapedCommName}\\]\\s*`, 'i'),
        new RegExp(`^\\(${escapedCommName}\\)\\s*`, 'i'),
        new RegExp(`^#\\(${escapedCommName}\\)\\s*`, 'i'),
        new RegExp(`^#\\[${escapedCommName}\\]\\s*`, 'i'),
      ];
      patterns.forEach(pat => {
        nameStr = nameStr.replace(pat, '');
      });
      nameStr = nameStr.trim();
      
      return `${prefix} ${nameStr}`;
    }
    return nameStr;
  };

  const formatTimeKorean = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      
      const isToday = date.toDateString() === now.toDateString();
      
      if (diffMins < 1) return '방금 전';
      if (diffMins < 60) return `${diffMins}분 전`;
      if (isToday) return `${diffHours}시간 전`;
      
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();
      if (isYesterday) return '어제';
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}월 ${day}일`;
    } catch (e) {
      return '';
    }
  };

  const getRoomAvatar = (room: any) => {
    if (room.room_type === 'dm' || room.room_type === 'one_to_one') {
      const otherMembers = room.chat_room_members?.filter((m: any) => m.user_id !== user?.id) || [];
      if (otherMembers.length > 0) {
        const profile = otherMembers[0].profiles;
        if (profile?.avatar_url) {
          return (
            <Avatar className="w-12 h-12 border border-slate-100 shrink-0">
              <AvatarImage src={profile.avatar_url} referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-purple-600 text-white font-extrabold text-sm">
                {(profile.nickname || profile.name || 'U')[0]}
              </AvatarFallback>
            </Avatar>
          );
        }
      }
    }

    const name = getRoomDisplayName(room);
    const firstChar = name ? name.replace(/[\[\]]/g, '').trim()[0] : '소';
    
    const colors = [
      'bg-purple-100 text-purple-700 font-extrabold',
      'bg-indigo-100 text-indigo-700 font-extrabold',
      'bg-emerald-100 text-emerald-700 font-extrabold',
      'bg-rose-100 text-rose-700 font-extrabold',
      'bg-amber-100 text-amber-700 font-extrabold',
      'bg-blue-100 text-blue-700 font-extrabold',
    ];
    const colorIndex = name ? name.length % colors.length : 0;
    const colorClass = colors[colorIndex];

    return (
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm shrink-0 font-extrabold ${colorClass}`}>
        {firstChar}
      </div>
    );
  };

  // 1. 기초 사용자, 커뮤니티 및 회원 데이터 목록 로딩
  useEffect(() => {
    if (!user) return;
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, nickname, email, avatar_url')
          .neq('id', user.id)
          .order('name', { ascending: true });

        if (!error && data) {
          setAvailableStudents(data);
          const pMap: Record<string, any> = {};
          data.forEach(p => { pMap[p.id] = p; });
          setProfilesMap(pMap);
        }
      } catch (err) {
        console.error('Available students fetch failed:', err);
      }
    };

    const fetchCommunities = async () => {
      try {
        const { data, error } = await supabase
          .from('communities')
          .select('id, name');
        if (!error && data) {
          const cMap: Record<string, any> = {};
          data.forEach(c => { cMap[c.id] = c; });
          setCommunitiesMap(cMap);
        }
      } catch (err) {
        console.error('Communities fetch error:', err);
      }
    };

    fetchStudents();
    fetchCommunities();
  }, [user]);

  // 2. 가입 가능한 모든 방 + 내 참여방 리스트 구하기
  const fetchAllRooms = async () => {
    if (!user) return;
    try {
      // 내 참여 Room ID 검색
      const { data: memberData, error: memberError } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;
      const joinedIds = memberData?.map(m => m.room_id) || [];

      // 내 가입 및 수강중인 커뮤니티 연동 목록 조회 (수강생 권한 포함)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .eq('is_deleted', false)
        .maybeSingle();

      let joinedCommunityIds: string[] = [];

      if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
        // 관리자는 모든 커뮤니티 자동 통과
        const { data: allComms } = await supabase
          .from('communities')
          .select('id')
          .eq('is_deleted', false);
        joinedCommunityIds = allComms?.map(c => c.id) || [];
      } else {
        // 일반 유저는 수강신청을 바탕으로 한 커뮤니티 + 직접 가입 커뮤니티 목록 결합
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id, expires_at')
          .eq('user_id', user.id)
          .eq('is_deleted', false);
        
        const activeCourseIds = (enrollments || [])
          .filter(e => !e.expires_at || new Date(e.expires_at) > new Date())
          .map(e => e.course_id);

        let courseComms: string[] = [];
        if (activeCourseIds.length > 0) {
          const { data: commsByCourse } = await supabase
            .from('communities')
            .select('id')
            .in('course_id', activeCourseIds)
            .eq('is_deleted', false);
          courseComms = commsByCourse?.map(c => c.id) || [];
        }

        const { data: memberships } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .neq('role', 'excluded');
        
        const membershipComms = memberships?.map(m => m.community_id) || [];
        joinedCommunityIds = Array.from(new Set([...courseComms, ...membershipComms]));
      }

      // 전체 활성 Chat Room 검색
      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          chat_room_members(
            user_id,
            profiles(id, name, nickname, avatar_url)
          )
        `)
        .order('created_at', { ascending: false });

      if (roomsError) throw roomsError;

      const preparedRooms = (roomsData || [])
        .filter((room: any) => {
          // 커뮤니티 소속 Chat Room 필터링: 방의 커뮤니티 ID가 설정되어 있는데 사용자가 해당 커뮤니티 회원이 아닌 경우 무조건 필터링 제외! (공개방이라도 참여 불가)
          if (room.community_id && room.community_id !== 'default') {
            return joinedCommunityIds.includes(room.community_id);
          }
          return true; // 커뮤니티에 소속되지 않은 일반/글로벌 방은 패스
        })
        .map((room: any) => {
          const isJoined = joinedIds.includes(room.id);
          const memberCount = room.chat_room_members?.length || 0;
          return {
            ...room,
            isJoined,
            memberCount
          };
        });

      // RLS 및 가시성 필터링 (공개는 무조건 가능, 비공개/DM은 멤버만)
      const visibleRooms = preparedRooms.filter(room => {
        if (room.room_type === 'public' || !room.room_type) return true;
        // 비공개/DM은 소속되어 있어야 보임
        return room.isJoined;
      });

      setRooms(visibleRooms);

      // 각 방의 최근 메시지 상세 정보 및 시각을 1:1 매핑 비동기 로드해 프론트엔드 캐싱
      const fetchLastMessages = async (roomsList: any[]) => {
        try {
          const promises = roomsList.map(async (room) => {
            const { data: rawMsg } = await supabase
              .from('chat_messages')
              .select('id, message, content, created_at, user_id')
              .eq('room_id', room.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (rawMsg) {
              let nickname = '익명';
              if (rawMsg.user_id) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('nickname, name')
                  .eq('id', rawMsg.user_id)
                  .maybeSingle();
                if (profile) {
                  nickname = profile.nickname || profile.name || '익명';
                }
              }
              return {
                roomId: room.id,
                message: rawMsg.message || rawMsg.content || '',
                created_at: rawMsg.created_at,
                nickname
              };
            }
            return { roomId: room.id, message: '', created_at: '', nickname: '' };
          });
          const results = await Promise.all(promises);
          const map: Record<string, any> = {};
          results.forEach((res) => {
            if (res.created_at) {
              map[res.roomId] = {
                message: res.message,
                created_at: res.created_at,
                nickname: res.nickname
              };
            }
          });
          setLastMessagesMap(map);
        } catch (e) {
          console.error("Last messages fetch error:", e);
        }
      };
      
      fetchLastMessages(visibleRooms);

      // URL에 지정된 방이 있는 상태에서 활성화 처리
      if (selectedRoomId) {
        const target = visibleRooms.find(r => r.id === selectedRoomId);
        if (target) {
          setActiveRoom(target);
          setIsRoomOwner(target.created_by === user.id);
        } else {
          // 다른 공개방 탐색 시도
          const anyPublic = visibleRooms.find(r => r.room_type === 'public' || !r.room_type);
          if (anyPublic) {
            setSearchParams({ room: anyPublic.id });
          } else if (visibleRooms.length > 0) {
            setSearchParams({ room: visibleRooms[0].id });
          } else {
            setActiveRoom(null);
          }
        }
      } else {
        setActiveRoom(null);
      }
    } catch (err) {
      console.error('All rooms fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAllRooms();

      // 실시간 방 변경 트리거 등록
      const roomChannel = supabase
        .channel('slack_rooms_auto_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
          fetchAllRooms();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(roomChannel);
      };
    }
  }, [user, selectedRoomId]);

  // 3. 현재 활성화 된 방 변경 시 멤버, 대화내역 로드
  useEffect(() => {
    if (!activeRoom || !user) return;

    // A. 활성방 멤버 로드
    const fetchActiveRoomMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_room_members')
          .select(`
            user_id,
            profiles(id, name, nickname, email, avatar_url)
          `)
          .eq('room_id', activeRoom.id);

        if (!error && data) {
          setRoomMembers(data.map((d: any) => d.profiles));
        }
      } catch (err) {
        console.error('Room members fetch error:', err);
      }
    };

    // B. 활성방의 메시지 로드 (인메모리 조인을 통해 Join/Relation 이슈 완벽 제거)
    const fetchActiveRoomMessages = async () => {
      try {
        // [1단계] chat_messages에서 메시지 독자 로드
        const { data: rawMessages, error: msgsError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', activeRoom.id)
          .order('created_at', { ascending: true });

        if (!msgsError && rawMessages) {
          // 메시지를 작성한 유저들의 ID 목록 추출 및 고유화
          const userIds = [...new Set(rawMessages.map((m: any) => m.user_id).filter(id => !!id))];
          let pMap: Record<string, any> = {};

          if (userIds.length > 0) {
            // 작성자 정보 한번에 로드 (인메모리 조인용)
            const { data: pData, error: pError } = await supabase
              .from('profiles')
              .select('id, name, nickname, avatar_url')
              .in('id', userIds);

            if (!pError && pData) {
              pData.forEach((p: any) => {
                pMap[p.id] = p;
              });
            }
          }

          const normalized = rawMessages.map((item: any) => ({
            ...item,
            message: item.message || item.content || '',
            profiles: pMap[item.user_id] || { 
              name: '탈퇴한 회원 또는 익명', 
              nickname: '익명' 
            }
          }));

          setMessages(normalized);
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
          return;
        }

        console.warn('First try with chat_messages raw query failed/empty, trying fallback messages table:', msgsError);

        // [2단계] fallback - messages 테이블 독자 로드
        const { data: fallbackRaw, error: fallbackError } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', activeRoom.id)
          .order('created_at', { ascending: true });

        if (!fallbackError && fallbackRaw) {
          // 데이터 보존 및 Soft Delete 적용 원칙에 따른 필터링 추가
          const activeFallbackRaw = fallbackRaw.filter(
            (m: any) => m.is_deleted !== true && m.is_deleted !== 'true'
          );
          const userIds = [...new Set(activeFallbackRaw.map((m: any) => m.user_id).filter(id => !!id))];
          let pMap: Record<string, any> = {};

          if (userIds.length > 0) {
            const { data: pData, error: pError } = await supabase
              .from('profiles')
              .select('id, name, nickname, avatar_url')
              .in('id', userIds);

            if (!pError && pData) {
              pData.forEach((p: any) => {
                pMap[p.id] = p;
              });
            }
          }

          const normalized = activeFallbackRaw.map((item: any) => ({
            ...item,
            message: item.message || item.content || '',
            profiles: pMap[item.user_id] || { 
              name: '탈퇴한 회원 또는 익명', 
              nickname: '익명' 
            }
          }));

          setMessages(normalized);
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
          return;
        }

        console.error('All fallback efforts to load messages failed:', fallbackError);
      } catch (err) {
        console.error('Messages fetch exception:', err);
      }
    };

    fetchActiveRoomMembers();
    fetchActiveRoomMessages();

    // C. 실시간 메시지 연동 채널 할당 (모두 구독)
    const chatMsgChannel = supabase
      .channel(`slack_active_room_chat_msgs_${activeRoom.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_messages', 
          filter: `room_id=eq.${activeRoom.id}` 
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new;
            const { data: pData } = await supabase
              .from('profiles')
              .select('name, nickname, avatar_url')
              .eq('id', raw.user_id)
              .single();

            const enriched: any = {
              ...raw,
              message: raw.message || raw.content,
              profiles: pData || { name: '알 수 없음', nickname: '알 수 없음' }
            };

            setMessages(prev => {
              if (prev.some(m => m.id === enriched.id)) return prev;
              return [...prev, enriched];
            });
            setLastMessagesMap(prev => ({
              ...prev,
              [activeRoom.id]: {
                message: enriched.message || enriched.content || '',
                created_at: enriched.created_at,
                nickname: enriched.profiles?.nickname || enriched.profiles?.name || '익명'
              }
            }));
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old.id;
            setMessages(prev => prev.filter(m => m.id !== oldId));
          }
        }
      )
      .subscribe();

    const msgChannel = supabase
      .channel(`slack_active_room_msgs_${activeRoom.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'messages', 
          filter: `room_id=eq.${activeRoom.id}` 
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new;
            const { data: pData } = await supabase
              .from('profiles')
              .select('name, nickname, avatar_url')
              .eq('id', raw.user_id)
              .single();

            const enriched: any = {
              ...raw,
              message: raw.message || raw.content,
              profiles: pData || { name: '알 수 없음', nickname: '알 수 없음' }
            };

            setMessages(prev => {
              if (prev.some(m => m.id === enriched.id)) return prev;
              return [...prev, enriched];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            if (updated.is_deleted === true || updated.is_deleted === 'true') {
              setMessages(prev => prev.filter(m => m.id !== updated.id));
            } else {
              // 일반 수정 시 데이터 수신
              setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated, message: updated.message || updated.content } : m));
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old.id;
            setMessages(prev => prev.filter(m => m.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatMsgChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [activeRoom]);

  // Tenor API Search & Formatting Actions
  const fetchTenorGifs = async (query = '') => {
    setLoadingTenor(true);
    try {
      const key = 'LIVDTRZ9VRH7';
      let url = '';
      if (query.trim() === '') {
        url = `https://g.tenor.com/v1/trending?key=${key}&limit=12&media_filter=minimal`;
      } else {
        url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${key}&limit=12&media_filter=minimal`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        const formatted = results.map((item: any) => {
          const mediaFormats = item.media_formats;
          const media = item.media;
          let gifUrl = '';
          let tinyGifUrl = '';
          
          if (mediaFormats && mediaFormats.gif) {
            gifUrl = mediaFormats.gif.url;
            tinyGifUrl = mediaFormats.tinygif?.url || gifUrl;
          } else if (media && media[0] && media[0].gif) {
            gifUrl = media[0].gif.url;
            tinyGifUrl = media[0].tinygif?.url || gifUrl;
          } else {
            gifUrl = item.url;
            tinyGifUrl = item.url;
          }

          return {
            id: item.id,
            title: item.title,
            gifUrl: gifUrl,
            tinyGifUrl: tinyGifUrl,
          };
        });
        setTenorGifs(formatted);
      }
    } catch (e) {
      console.error('Error fetching Tenor GIFs:', e);
    } finally {
      setLoadingTenor(false);
    }
  };

  useEffect(() => {
    if (showEmojiPicker && emojiTab === 'gif') {
      const delayDebounceFn = setTimeout(() => {
        fetchTenorGifs(tenorSearchQuery);
      }, 400);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [showEmojiPicker, emojiTab, tenorSearchQuery]);

  // 페이지 스크롤 자동 하방 고정 비활성화 (작성한 화면 그대로 고정)

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-12 rounded-[40px] shadow-2xl text-center max-w-lg w-full space-y-8 border border-gray-100">
          <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-12 h-12 text-purple-600" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">로그인이 필요합니다</h2>
            <p className="text-gray-500 font-bold leading-relaxed">
              소통 서비스는 회원만 이용할 수 있습니다.<br/>
              로그인 후 다른 회원들과 교류하고 의견을 나누어보세요!
            </p>
          </div>
          <Link to="/auth/login" className="inline-flex items-center justify-center w-full h-14 bg-purple-600 hover:bg-purple-700 rounded-2xl text-lg font-black text-white shadow-lg transition-transform hover:-translate-y-0.5">
            로그인하러 가기
          </Link>
        </div>
      </div>
    );
  }

  // 4. 메시지 전송 기능
  const insertChatMessage = async (contentStr: string) => {
    if (!activeRoom || !user) return null;
    const basePayload = {
      room_id: activeRoom.id,
      user_id: user.id,
      created_at: new Date().toISOString()
    };

    const senderProfile = {
      name: user.name || null,
      nickname: user.nickname || null,
      avatar_url: user.avatar_url || null
    };

    let insertedRow: any = null;

    // Try 1: chat_messages table, message column
    const { data: data1, error: err1 } = await supabase
      .from('chat_messages')
      .insert([{
        ...basePayload,
        message: contentStr
      }])
      .select();

    if (!err1 && data1 && data1[0]) {
      const row = data1[0];
      insertedRow = {
        ...row,
        message: row.message || row.content || contentStr,
        profiles: senderProfile
      };
    } else {
      console.warn('[Insert fallback 1 failed]:', err1);

      // Try 2: chat_messages table, content column
      const { data: data2, error: err2 } = await supabase
        .from('chat_messages')
        .insert([{
          ...basePayload,
          content: contentStr
        }])
        .select();

      if (!err2 && data2 && data2[0]) {
        const row = data2[0];
        insertedRow = {
          ...row,
          message: row.message || row.content || contentStr,
          profiles: senderProfile
        };
      } else {
        console.warn('[Insert fallback 2 failed]:', err2);

        // Try 3: messages table, content column (With community_id & type defined for full table compatibility)
        const { data: data3, error: err3 } = await supabase
          .from('messages')
          .insert([{
            ...basePayload,
            content: contentStr,
            community_id: activeRoom.community_id && activeRoom.community_id !== 'default' ? activeRoom.community_id : 'default',
            type: 'text'
          }])
          .select();

        if (!err3 && data3 && data3[0]) {
          const row = data3[0];
          insertedRow = {
            ...row,
            message: row.message || row.content || contentStr,
            profiles: senderProfile
          };
        } else {
          console.warn('[Insert fallback 3 failed]:', err3);

          // Try 4: messages table, message column (With community_id & type defined for full table compatibility)
          const { data: data4, error: err4 } = await supabase
            .from('messages')
            .insert([{
              ...basePayload,
              message: contentStr,
              community_id: activeRoom.community_id && activeRoom.community_id !== 'default' ? activeRoom.community_id : 'default',
              type: 'text'
            }])
            .select();

          if (!err4 && data4 && data4[0]) {
            const row = data4[0];
            insertedRow = {
              ...row,
              message: row.message || row.content || contentStr,
              profiles: senderProfile
            };
          } else {
            console.error('All message table inserts failed.', err4);
            throw new Error(err1?.message || err4?.message || '데이터베이스 쓰기 권한이 없거나 컬럼이 불일치합니다.');
          }
        }
      }
    }

    if (insertedRow) {
      if (roomMembers && roomMembers.length > 0) {
        roomMembers.forEach((member: any) => {
          if (member && member.id && member.id !== user.id) {
            notificationService.createNotification(
              member.id,
              `${user.nickname || user.name || '알림'}님이 채팅 메시지를 보냈습니다.`,
              contentStr.substring(0, 60),
              'chat',
              `/chat?roomId=${activeRoom.id}`,
              user.nickname || user.name || undefined
            ).catch(e => console.error('[Notification dispatch fail]:', e));
          }
        });
      }
      return insertedRow;
    }

    return null;
  };

  const applyFormatting = (format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = inputText;
    const selectedText = text.substring(start, end);

    let replacement = '';
    switch (format) {
      case 'bold':
        replacement = `**${selectedText || '텍스트'}**`;
        break;
      case 'italic':
        replacement = `*${selectedText || '텍스트'}*`;
        break;
      case 'underline':
        replacement = `<u>${selectedText || '텍스트'}<u>`;
        break;
      case 'strikethrough':
        replacement = `~~${selectedText || '텍스트'}~~`;
        break;
      case 'link':
        replacement = `[${selectedText || '링크 텍스트'}](https://example.com)`;
        break;
      case 'ordered-list':
        replacement = `\n1. ${selectedText || '항목'}`;
        break;
      case 'bullet-list':
        replacement = `\n- ${selectedText || '항목'}`;
        break;
      case 'blockquote':
        replacement = `\n> ${selectedText || '인용구'}`;
        break;
      case 'code':
        replacement = `\`${selectedText || '코드'}\``;
        break;
      case 'code-block':
        replacement = `\n\`\`\`\n${selectedText || '코드 작성'}\n\`\`\`\n`;
        break;
      default:
        return;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    setInputText(newText);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  const handleSelectEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setInputText(prev => prev + emoji);
      return;
    }
    const text = inputText;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setInputText(newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + emoji.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 50);
  };

  const handleSelectMention = (member: any) => {
    const nameText = member.nickname || member.name || '알 수 없음';
    const textarea = textareaRef.current;
    if (!textarea) {
      setInputText(prev => prev + `@${nameText} `);
      setShowMentionPopover(false);
      return;
    }

    const text = inputText;
    const start = textarea.selectionStart;
    
    // Find where the '@' starts before the cursor
    const textBeforeCursor = text.substring(0, start);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const newText = text.substring(0, lastAtIndex) + `@${nameText} ` + text.substring(start);
      setInputText(newText);
      setShowMentionPopover(false);
      setTimeout(() => {
        textarea.focus();
        const newPos = lastAtIndex + nameText.length + 2; // +1 for @, +1 for space
        textarea.setSelectionRange(newPos, newPos);
      }, 50);
    } else {
      setInputText(prev => prev + `@${nameText} `);
      setShowMentionPopover(false);
      setTimeout(() => textarea.focus(), 50);
    }
  };

  const filteredMentionMembers = roomMembers.filter(member => {
    if (!member) return false;
    const nameText = (member.nickname || member.name || '').toLowerCase();
    const queryMatch = inputText.match(/@(\w*)$/);
    if (queryMatch) {
      const q = queryMatch[1].toLowerCase();
      return nameText.includes(q);
    }
    return true; // if clicked via button, show all
  });

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeRoom || sending) return;

    setSending(true);
    const content = inputText;
    setInputText('');

    try {
      const inserted = await insertChatMessage(content);
      if (inserted) {
        setMessages(prev => {
          if (prev.some(m => m.id === inserted.id)) return prev;
          return [...prev, inserted];
        });
      }
    } catch (err: any) {
      console.error('Failed to send text:', err);
      const errMsg = err?.message || JSON.stringify(err);
      toast.error(`메시지 발송 오류가 발생했습니다: ${errMsg}`);
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  // Quick 텍스트 전송
  const handleQuickSend = async (phrase: string) => {
    if (!activeRoom || sending) return;
    setSending(true);
    try {
      const inserted = await insertChatMessage(phrase);
      if (inserted) {
        setMessages(prev => {
          if (prev.some(m => m.id === inserted.id)) return prev;
          return [...prev, inserted];
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || JSON.stringify(err);
      toast.error(`메시지 전송 실패: ${errMsg}`);
    } finally {
      setSending(false);
    }
  };

  // 5. 파일 전송 기능
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;

    setUploading(true);
    setUploadProgress(20);

    try {
      // 20% -> 50%
      setUploadProgress(50);
      const res = await storageService.uploadFile(file, 'community-files');
      setUploadProgress(90);

      // 파일 형식 판별 (이미지여부)
      const isImg = file.type.startsWith('image/');
      const fileMarkdown = isImg 
        ? `![이미지 첨부](${res.url})` 
        : `📁 **[파일 다운로드: ${res.name}](${res.url})** (${(res.size/1024/1024).toFixed(2)} MB)`;

      const inserted = await insertChatMessage(fileMarkdown);
      if (inserted) {
        setMessages(prev => {
          if (prev.some(m => m.id === inserted.id)) return prev;
          return [...prev, inserted];
        });
      }
      toast.success('파일 업로드 완료!');
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || JSON.stringify(err);
      toast.error(`파일 업로드 및 전송에 실패했습니다: ${errMsg}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. 소통방 개설 처리
  const handleModalCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingRoom) return;
    if (!createRoomName.trim() && createType !== 'dm') {
      toast.error('채팅방 명칭을 입력하세요.');
      return;
    }

    try {
      setIsCreatingRoom(true);
      let finalRoomName = createRoomName.trim();
      if (createType === 'dm') {
        if (!createRoomTargetId) {
          toast.error('1:1 대화 상대를 지정해 주세요.');
          setIsCreatingRoom(false);
          return;
        }
        const student = availableStudents.find(s => s.id === createRoomTargetId);
        finalRoomName = `${student?.nickname || student?.name || '익명'} 님과의 1:1 대화`;
      }

      // insert chat_room - 데이터베이스 컬럼(room_name, community_id, created_at)에 맞춘 단일하고 완벽한 인서트문
      const { data: created, error: roomErr } = await supabase
        .from('chat_rooms')
        .insert([{
          room_name: finalRoomName,
          community_id: null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (roomErr) {
        console.error('Failed to create chat room in Chat.tsx:', roomErr);
        throw roomErr;
      }

      // insert members
      const insertMembers = [{ room_id: created.id, user_id: user.id }];
      if (createType === 'dm' && createRoomTargetId) {
        insertMembers.push({ room_id: created.id, user_id: createRoomTargetId });
      } else if (createType === 'private' && createRoomTargetId) {
        insertMembers.push({ room_id: created.id, user_id: createRoomTargetId });
      }

      const { error: memberErr } = await supabase
        .from('chat_room_members')
        .insert(insertMembers);

      if (memberErr) throw memberErr;

      toast.success('새로운 Slack형 채팅방이 개설되었습니다.');
      setIsCreateModalOpen(false);
      setCreateRoomName('');
      setCreateRoomTargetId('');

      // 즉시 전환
      setSearchParams({ room: created.id });
    } catch (err: any) {
      console.error(err);
      toast.error('소통방 개설 도중 오류가 발생했습니다.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // 7. 채팅방 가입하기
  const handleJoinRoom = async (room: any) => {
    try {
      const { error } = await supabase
        .from('chat_room_members')
        .insert([{ room_id: room.id, user_id: user.id }]);

      if (error && error.code !== '23505') throw error; // 무조건 통과 (가입 완료)

      toast.success(`${room.room_name || room.name} 채팅방에 참여했습니다.`);
      fetchAllRooms();
      setSearchParams({ room: room.id });
    } catch {
      toast.error('가입 도중 오류 발생');
    }
  };

  // 8. 채팅방 나가기 / 삭제
  const handleLeaveRoom = async () => {
    if (!activeRoom) return;
    if (!confirm('정말로 이 소통 채팅방에서 나가시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('chat_room_members')
        .delete()
        .eq('room_id', activeRoom.id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('소통방을 이탈했습니다.');
      
      // 방 리스트 다시 로드
      const { data: visibleRooms } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: false });

      const filtered = (visibleRooms || []).filter(r => r.room_type === 'public' || !r.room_type);
      if (filtered.length > 0) {
        setSearchParams({ room: filtered[0].id });
      } else {
        setSearchParams({});
      }
    } catch (err) {
      console.error(err);
      toast.error('채팅방 나가기 처리 오류가 발생했습니다.');
    }
  };

  // 삭제 처리 (관리자 권한으로 완전 삭제 모달 트리거)
  const handleDeleteRoom = () => {
    if (!activeRoom) return;
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteRoom = async () => {
    try {
      // 1. 메시지 삭제
      await supabase.from('chat_messages').delete().eq('room_id', activeRoom.id);
      // 2. 멤버 삭제
      await supabase.from('chat_room_members').delete().eq('room_id', activeRoom.id);
      // 3. 방 삭제
      const { error } = await supabase.from('chat_rooms').delete().eq('id', activeRoom.id);
      
      if (error) throw error;
      toast.success('채팅방이 완전히 영구 데이터베이스에서 삭제되었습니다.');
      
      setIsDeleteConfirmOpen(false);
      
      // 방 리스트 다시 불러온 후, 남은 첫번째 방으로 선택
      await fetchAllRooms();
    } catch (err) {
      console.error(err);
      toast.error('채팅방 삭제 오류가 발생했습니다.');
    }
  };

  const handleMessageDelete = async (msgId: string) => {
    const isConfirmed = window.confirm('정말 이 메시지를 삭제하시겠습니까?');
    if (!isConfirmed) return;

    try {
      // 1. chat_messages 테이블에서는 물리 삭제 시도 (임시 또는 지원되는 메커니즘인 경우)
      const { error: err1 } = await supabase.from('chat_messages').delete().eq('id', msgId);
      
      // 2. messages 테이블은 회계 데이터 보존 규칙에 근거하여 물리 삭제를 하지 않고 soft delete (is_deleted: true) 처리
      const { error: err2 } = await supabase.from('messages').update({ is_deleted: true }).eq('id', msgId);
      
      // 로컬 상태 즉시 조정 (데이터베이스 딜레이 혹은 RLS 권한 제약을 무시하고 즉각 지움 처리 제공)
      setMessages(prev => prev.filter(m => m.id !== msgId));
      toast.success('메시지가 성공적으로 삭제되었습니다.');
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      toast.success('메시지가 삭제되었습니다.');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeRoom) return;

    const confirmKick = window.confirm('정말 이 참여자를 채팅방에서 퇴장시키시겠습니까?');
    if (!confirmKick) return;

    try {
      const { error } = await supabase
        .from('chat_room_members')
        .delete()
        .eq('room_id', activeRoom.id)
        .eq('user_id', memberId);

      if (error) throw error;
      
      toast.success('참여자가 성공적으로 퇴장되었습니다.');
      
      // 멤버를 로컬 리스트에서 제거하여 즉시 반영 후 보완 Fetch
      setRoomMembers(prev => prev.filter(m => m && m.id !== memberId));

      // 데이터 정합성을 위한 추가 Fetch
      const { data, error: mError } = await supabase
        .from('chat_room_members')
        .select(`
          user_id,
          profiles(id, name, nickname, email, avatar_url)
        `)
        .eq('room_id', activeRoom.id);

      if (!mError && data) {
        setRoomMembers(data.map((d: any) => d.profiles).filter(p => !!p));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('퇴장 처리 중 오류가 발생했습니다.');
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !selectedInviteUserId) return;

    try {
      const { error } = await supabase
        .from('chat_room_members')
        .insert([{
          room_id: activeRoom.id,
          user_id: selectedInviteUserId
        }]);

      if (error) {
        if (error.code === '23505') {
          toast.info('이미 참여 중인 회원입니다.');
        } else {
          throw error;
        }
      } else {
        toast.success('참여자를 성공적으로 초대하였습니다.');
      }

      setIsInviteModalOpen(false);
      setSelectedInviteUserId('');

      // Refresh members
      const { data, error: mError } = await supabase
        .from('chat_room_members')
        .select(`
          user_id,
          profiles(id, name, nickname, email, avatar_url)
        `)
        .eq('room_id', activeRoom.id);

      if (!mError && data) {
        setRoomMembers(data.map((d: any) => d.profiles));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('초대 중 오류가 발생했습니다.');
    }
  };

  // 카테고리별 채널 필터링
  const getFilteredByCategory = (type: 'public' | 'private' | 'dm') => {
    return rooms.filter(r => {
      const isMatchName = (r.room_name || r.name || '').toLowerCase().includes(channelSearch.toLowerCase());
      if (!isMatchName) return false;
      if (type === 'public') return r.room_type === 'public' || !r.room_type;
      return r.room_type === type;
    });
  };

  const publicRooms = getFilteredByCategory('public');
  const privateRooms = getFilteredByCategory('private');
  const dmRooms = getFilteredByCategory('dm');

  // 도우미 렌더러 - 유저 프로필 추출 (메시지용)
  const renderMessageContent = (msgText: string) => {
    const text = msgText || '';
    // 만약 이미지인 경우 마크다운식 컴포넌트 렌더 (업로드 이미지 및 Tenor GIF 모두 연동 가능하게 고도화)
    const imgRegex = /!\[.*?\]\((https?:\/\/.*?)\)/;
    const isImgMatch = text.match(imgRegex);
    if (isImgMatch) {
      return (
        <div className="mt-2.5 max-w-[320px] rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:brightness-95">
          <img 
            src={isImgMatch[1]} 
            alt="첨부 이미지" 
            className="w-full h-auto object-contain max-h-[220px]" 
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    // 만약 일반 파일 다운로드 마크다운인 경우 처리
    const fileRegex = /📁 \*\*\[파일 다운로드: (.*?)\]\((.*?)\)\*\* \((.*?) MB\)/;
    const isFileMatch = text.match(fileRegex);
    if (isFileMatch) {
      const fileName = isFileMatch[1];
      const fileUrl = isFileMatch[2];
      const fileSize = isFileMatch[3];
      return (
        <a 
          href={fileUrl} 
          target="_blank" 
          rel="noreferrer"
          className="mt-2 text-left flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl max-w-[340px] hover:bg-slate-100/80 transition-all group"
        >
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 group-hover:scale-105 transition-all">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-grow leading-normal">
            <p className="text-xs font-bold text-slate-800 truncate">{fileName}</p>
            <span className="text-[10px] text-slate-400 font-semibold">{fileSize} MB · 즉시 다운로드</span>
          </div>
        </a>
      );
    }

    // 텍스트 기재 링크 자동 완성 (하단에 하이퍼링크 카드 렌더링)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    const urls = text.match(urlRegex) || [];

    if (urls.length > 0) {
      return (
        <div className="flex flex-col gap-1.5 text-left">
          <p className="text-slate-800 leading-normal text-sm whitespace-pre-wrap">
            {parts.map((part, index) => {
              if (urlRegex.test(part) || part.startsWith('http://') || part.startsWith('https://')) {
                return (
                  <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:underline font-semibold break-all inline"
                  >
                    {part}
                  </a>
                );
              }
              return part;
            })}
          </p>
          {Array.from(new Set(urls)).slice(0, 3).map((url, uidx) => (
            <LinkPreview key={uidx} url={url} />
          ))}
        </div>
      );
    }

    // 일반 텍스트
    return <p className="text-slate-800 leading-normal text-sm whitespace-pre-wrap text-left">{text}</p>;
  };

  return (
    <div className={isPopup ? "w-screen h-screen bg-white flex flex-col overflow-hidden font-sans" : `font-sans flex flex-col min-h-screen bg-[#F8F9FA] ${activeRoom ? 'h-screen w-screen md:w-auto md:h-auto pt-0 pb-0 px-0 md:pt-20 md:pb-4 md:px-4 overflow-hidden' : 'pt-5 md:pt-20 pb-4 px-4'}`}>
      <div className={isPopup ? "w-full h-full bg-white flex border-none shadow-none rounded-none" : `w-full bg-white flex ${activeRoom ? 'h-screen md:h-[78vh] max-w-7xl mx-auto rounded-none border-none shadow-none md:rounded-[32px] md:border border-slate-200/50 md:shadow-2xl' : 'max-w-7xl mx-auto h-[78vh] rounded-none border-none shadow-none md:rounded-[32px] md:border border-slate-200/50 md:shadow-2xl'}`}>
        
        {/* ===================================
            1. LEFT WORKSPACE SIDEBAR (Eggplant/Slate Black on Desktop, Beautiful Native Chat List on Mobile)
            =================================== */}
        <div className={`${activeRoom ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-col shrink-0 border-r border-[#2D1D34] overflow-hidden bg-[#1F1523]`}>
          
          {/* MOBILE VIEW LIST (White Theme, matching Kakao/Telegram reference image) */}
          <div className="flex md:hidden w-full h-full bg-white flex-col">
            {/* Mobile Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">채팅</h1>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setCreateType('public'); setIsCreateModalOpen(true); }}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-950 transition-all"
                  title="새로운 소통방 만들기"
                >
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Mobile Unified List */}
            <div className="flex-grow overflow-y-auto px-4 py-2 space-y-0.5 divide-y divide-slate-100/50">
              {(() => {
                const sortedMobileRooms = [...rooms].sort((a, b) => {
                  const aLast = lastMessagesMap[a.id]?.created_at || a.created_at;
                  const bLast = lastMessagesMap[b.id]?.created_at || b.created_at;
                  return new Date(bLast).getTime() - new Date(aLast).getTime();
                });

                if (sortedMobileRooms.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <p className="text-sm text-slate-400 font-bold">참여 가능한 소통방이 존재하지 않습니다.</p>
                      <Button 
                        onClick={() => { setCreateType('public'); setIsCreateModalOpen(true); }}
                        className="mt-3 bg-purple-600 hover:bg-purple-700 font-bold rounded-lg text-xs"
                      >
                        신규 소통방 생성
                      </Button>
                    </div>
                  );
                }

                return sortedMobileRooms.map(room => {
                  const isActive = activeRoom?.id === room.id;
                  const lastMsg = lastMessagesMap[room.id];
                  const lastMsgText = lastMsg ? lastMsg.message : (room.description || '대화 기록이 아직 없습니다.');
                  const lastMsgTime = lastMsg ? formatTimeKorean(lastMsg.created_at) : formatTimeKorean(room.created_at);
                  const lastMsgNickname = lastMsg ? lastMsg.nickname : '';

                  return (
                    <div 
                      key={room.id}
                      onClick={() => setSearchParams({ room: room.id })}
                      className="flex items-center gap-3.5 py-4 cursor-pointer active:bg-slate-50 hover:bg-slate-50/50 transition-all text-left border-none"
                    >
                      {/* Circle Avatar */}
                      {getRoomAvatar(room)}

                      {/* Main Info */}
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-extrabold text-slate-900 text-[14px] sm:text-base truncate leading-snug">
                              {getRoomDisplayName(room)}
                            </span>
                            <span className="text-xs text-slate-400 font-bold shrink-0">
                              ({room.memberCount || 1})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium shrink-0">
                            {lastMsgTime}
                          </span>
                        </div>

                        {/* Latest message text preview snippet */}
                        <p className="text-[13px] text-slate-500 font-medium leading-relaxed truncate max-w-[200px] sm:max-w-[260px] mt-0.5">
                          {lastMsgNickname ? `${lastMsgNickname} : ` : ''}{lastMsgText}
                        </p>

                        {/* Small metadata tag line */}
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                          {room.room_type === 'private' ? '비공개 협업그룹' : room.room_type === 'dm' ? '1:1 비밀대화' : '공개 소통방'}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            {/* Mobile Exit Bar */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 shrink-0 text-left flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="w-8 h-8 border border-purple-500/10">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-purple-650 text-white font-black text-xs">{(user.nickname || user.name || 'U')[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 leading-tight">
                  <h4 className="font-extrabold text-xs text-slate-800 truncate">{user.nickname || user.name || '본인'}</h4>
                  <p className="text-[9px] text-slate-400 font-bold tracking-tight truncate">온라인</p>
                </div>
              </div>
              <Link to="/" className="p-1.5 hover:bg-slate-200/50 rounded-lg text-slate-500 hover:text-slate-950 transition-colors" title="웹사이트 나가기">
                <LogOut className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* DESKTOP VIEW LIST (Eggplant Dark Theme Workspace) */}
          <div className="hidden md:flex w-full h-full bg-[#1F1523] text-white flex-col">
            {/* Header */}
            <div className="p-5 border-b border-[#2D1D34] flex items-center justify-between shrink-0 bg-[#160E1A]">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base tracking-tight leading-none text-white">Beone Chat</h2>
                  <span className="text-xs font-bold text-purple-300 block mt-1 leading-none">비원아카데미 채팅</span>
                </div>
              </div>
              <div className="relative group">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block ring-4 ring-emerald-500/20" title="서버 정상 연결 중" />
              </div>
            </div>

            {/* Categories Grid Scroll Area */}
            <div className="flex-grow overflow-y-auto px-2 py-3 space-y-6 text-left">
              {/* 1. PUBLIC CHANNELS */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 pb-1">
                  <span className="text-xs font-black tracking-wider text-purple-300/60 uppercase">📢 공개 소통방 ({publicRooms.length})</span>
                  <button 
                     onClick={() => { setCreateType('public'); setIsCreateModalOpen(true); }}
                     className="p-1 hover:bg-white/10 rounded-md text-purple-300 hover:text-white transition-all"
                     title="공개 채널 생성"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {publicRooms.map(room => {
                    const isActive = activeRoom?.id === room.id;
                    const isCurJoined = room.isJoined;
                    return (
                      <div 
                        key={room.id}
                        onClick={() => setSearchParams({ room: room.id })}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
                          isActive 
                            ? 'bg-purple-600 text-white font-extrabold shadow' 
                            : 'text-purple-100/85 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Hash className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-300/40'}`} />
                          <span className="truncate">{getRoomDisplayName(room)}</span>
                        </div>
                        
                        {/* 상태 뱃지 */}
                        {!isCurJoined ? (
                          <span className="text-xs font-bold bg-white/10 text-purple-200 px-2 py-0.5 rounded-md group-hover:bg-purple-500 group-hover:text-white transition-all scale-95 uppercase">미참여</span>
                        ) : (
                          <span className="text-xs font-bold text-purple-300/50">{room.memberCount || 1}명</span>
                        )}
                      </div>
                    );
                  })}
                  {publicRooms.length === 0 && (
                    <span className="text-xs text-purple-300/30 pl-3 block py-1">조건에 만족하는 공개 채널이 없습니다.</span>
                  )}
                </div>
              </div>

              {/* 2. PRIVATE GROUPS */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 pb-1">
                  <span className="text-xs font-black tracking-wider text-purple-300/60 uppercase">🔒 비공개 소통방 ({privateRooms.length})</span>
                  <button 
                    onClick={() => { setCreateType('private'); setIsCreateModalOpen(true); }}
                    className="p-1 hover:bg-white/10 rounded-md text-purple-300 hover:text-white transition-all"
                    title="비공개 협업방 생성"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {privateRooms.map(room => {
                    const isActive = activeRoom?.id === room.id;
                    return (
                      <div 
                        key={room.id}
                        onClick={() => setSearchParams({ room: room.id })}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
                          isActive 
                          ? 'bg-purple-600 text-white font-extrabold shadow' 
                          : 'text-purple-100/85 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Lock className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-300/40'}`} />
                          <span className="truncate">{getRoomDisplayName(room)}</span>
                        </div>
                        <span className="text-xs font-bold text-purple-300/50">{room.memberCount || 1}명</span>
                      </div>
                    );
                  })}
                  {privateRooms.length === 0 && (
                    <span className="text-xs text-purple-300/30 pl-3 block py-1">소속된 비공개방이 없습니다.</span>
                  )}
                </div>
              </div>

              {/* 3. DIRECT MESSAGES */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 pb-1">
                  <span className="text-xs font-black tracking-wider text-purple-300/60 uppercase">👤 1:1 대화방 ({dmRooms.length})</span>
                  <button 
                    onClick={() => { setCreateType('dm'); setIsCreateModalOpen(true); }}
                    className="p-1 hover:bg-white/10 rounded-md text-purple-300 hover:text-white transition-all"
                    title="1:1 소통 매칭"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {dmRooms.map(room => {
                    const isActive = activeRoom?.id === room.id;
                    return (
                      <div 
                        key={room.id}
                        onClick={() => setSearchParams({ room: room.id })}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
                          isActive 
                          ? 'bg-purple-600 text-white font-extrabold shadow' 
                          : 'text-purple-100/85 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Users className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-300/40'}`} />
                          <span className="truncate">{getRoomDisplayName(room)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {dmRooms.length === 0 && (
                    <span className="text-xs text-purple-300/30 pl-3 block py-1">1:1 소통 전력이 없습니다.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Compact User bottom card */}
            <div className="p-4 bg-[#140D17] border-t border-[#2D1D34] shrink-0 text-left flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="w-10 h-10 border border-purple-500/20">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-purple-600 text-white font-black text-sm">{(user.nickname || user.name || 'U')[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 leading-tight">
                  <h4 className="font-extrabold text-sm text-slate-100 truncate">{user.nickname || user.name || '본인'}</h4>
                  <p className="text-xs text-slate-400 font-bold tracking-tight truncate mt-0.5">접속 상태: ONLINE</p>
                </div>
              </div>
              <Link to="/" className="p-1.5 hover:bg-white/5 rounded-lg text-purple-300 hover:text-white transition-colors" title="웹사이트 나가기">
                <LogOut className="w-4.5 h-4.5" />
              </Link>
            </div>
          </div>

        </div>

        {/* ===================================
            2. CENTRAL MESSAGES FEED FRAME
            =================================== */}
        <div className={`${activeRoom ? 'flex' : 'hidden md:flex'} flex-grow flex flex-col bg-[#FDFDFD] overflow-hidden`}>
          
          {activeRoom ? (
            <>
              {/* TOP HUB BAR */}
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0 text-left">
                {/* 1) MOBILE HEADER (visible on screens under md) */}
                <div className="flex md:hidden items-center justify-between w-full">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Button
                      onClick={() => setSearchParams({})}
                      variant="ghost"
                      size="icon"
                      className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 shrink-0 text-slate-700 border-none transition-all flex items-center justify-center mr-1"
                      title="대화 목록으로 돌아가기"
                    >
                      <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Button>
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-900 text-[14px] sm:text-[15px] tracking-tight truncate max-w-[170px] leading-tight">
                        {getRoomDisplayName(activeRoom)}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5 leading-none">
                        총 {roomMembers.length}명 참여중
                      </span>
                    </div>
                  </div>
                  
                  {/* Hamburger menu positioned on the far top-right on mobile */}
                  {!isPopup && (
                    <Button
                      onClick={() => setIsMobileListOpen(true)}
                      variant="ghost"
                      size="icon"
                      className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 shrink-0 text-slate-700 border-none transition-all flex items-center justify-center"
                    >
                      <Menu className="w-5 h-5 text-slate-600" />
                    </Button>
                  )}
                </div>

                {/* 2) DESKTOP HEADER (visible on screen md:flex and larger) */}
                <div className="hidden md:flex items-center justify-between w-full">
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 leading-none flex-wrap">
                        <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight truncate max-w-[160px] sm:max-w-[280px]">
                          {getRoomDisplayName(activeRoom)}
                        </h3>
                        <Badge className="bg-purple-50 hover:bg-purple-100 text-purple-600 border-none font-bold text-[8px] leading-none px-1.5 py-0.5 whitespace-nowrap">
                          {activeRoom.room_type === 'private' ? '비공개' : activeRoom.room_type === 'dm' ? '1:1' : '공개채팅방'}
                        </Badge>

                        {/* 드롭다운 빠른 이동 메뉴 트리거 */}
                        <div className="relative inline-block ml-1 z-30">
                          <Button
                            onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-600 font-extrabold text-[11px] rounded-lg border-none flex items-center gap-1 transition-all"
                          >
                            <span>채팅방 선택</span>
                            <ChevronDown className="w-3 h-3 shrink-0" />
                          </Button>

                          <AnimatePresence>
                            {isRoomDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsRoomDropdownOpen(false)} />
                                <motion.div
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  className="absolute left-0 mt-1 w-72 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 overflow-hidden text-left max-h-80 overflow-y-auto"
                                >
                                  <div className="p-2.5 bg-slate-50 border-b border-slate-100/80 sticky top-0 flex items-center justify-between z-10 shrink-0">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">입장 가능한 채팅방 선택</span>
                                    <span className="text-[9px] font-bold text-slate-400 text-right shrink-0">Beone Messenger</span>
                                  </div>
                                  <div className="p-1.5 space-y-3.5 py-3.5">
                                    {/* public */}
                                    {publicRooms.length > 0 && (
                                      <div className="space-y-1">
                                        <div className="text-[9px] font-black text-purple-500 pl-2 block tracking-wider uppercase">📢 공개 소통방 ({publicRooms.length})</div>
                                        <div className="space-y-0.5">
                                          {publicRooms.map(r => {
                                            const isActive = activeRoom?.id === r.id;
                                            return (
                                              <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => {
                                                  setSearchParams({ room: r.id, popup: isPopup ? 'true' : 'false' });
                                                  setIsRoomDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-all ${
                                                  isActive ? 'bg-purple-600 text-white shadow font-black' : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                              >
                                                <span className="truncate pr-2">{getRoomDisplayName(r)}</span>
                                                {r.isJoined && (
                                                  <span className={`text-[8px] px-1 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-600'} font-extrabold shrink-0`}>참여 중</span>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* private */}
                                    {privateRooms.length > 0 && (
                                      <div className="space-y-1">
                                        <div className="text-[9px] font-black text-rose-500 pl-2 block tracking-wider uppercase">🔒 *비공개 협업방* ({privateRooms.length})</div>
                                        <div className="space-y-0.5">
                                          {privateRooms.map(r => {
                                            const isActive = activeRoom?.id === r.id;
                                            return (
                                              <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => {
                                                  setSearchParams({ room: r.id, popup: isPopup ? 'true' : 'false' });
                                                  setIsRoomDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-all ${
                                                  isActive ? 'bg-purple-600 text-white shadow font-black' : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                              >
                                                <span className="truncate pr-2">{getRoomDisplayName(r)}</span>
                                                <span className={`text-[8px] font-bold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{r.memberCount || 1}명</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* DM */}
                                    {dmRooms.length > 0 && (
                                      <div className="space-y-1">
                                        <div className="text-[9px] font-black text-blue-500 pl-2 block tracking-wider uppercase">👤 1:1 대화방 ({dmRooms.length})</div>
                                        <div className="space-y-0.5">
                                          {dmRooms.map(r => {
                                            const isActive = activeRoom?.id === r.id;
                                            return (
                                              <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => {
                                                  setSearchParams({ room: r.id, popup: isPopup ? 'true' : 'false' });
                                                  setIsRoomDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-all ${
                                                  isActive ? 'bg-purple-600 text-white shadow font-black' : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                              >
                                                <span className="truncate pr-2">{getRoomDisplayName(r)}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1 tracking-normal truncate">
                        {activeRoom.room_type === 'dm' 
                          ? '상호 간의 비밀 대화 및 일대일 매칭 대화방입니다.'
                          : `수강생 전용 소통 구역 · 총 ${roomMembers.length}명의 회원이 함께하는 중`
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 h-9 shrink-0">
                    {/* 관리자 완전 삭제 */}
                    {isAdmin && (
                      <Button 
                        onClick={handleDeleteRoom}
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50 h-8 text-[11px] font-black rounded-lg px-2.5 border border-rose-100/60"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        채팅방 완전 삭제
                      </Button>
                    )}

                    {/* 방 탈퇴 */}
                    <Button
                      type="button"
                      onClick={handleLeaveRoom}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:bg-gray-50 border border-slate-200 h-8 text-[11px] font-bold rounded-lg px-2.5"
                    >
                      <UserMinus className="w-3.5 h-3.5 mr-1" />
                      채팅방 나가기
                    </Button>
                  </div>
                </div>
              </div>

              {/* TIMELINE MESSAGES SCROLL */}
              <div className="flex-grow p-6 overflow-y-auto bg-slate-50/20">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">새 소통방의 첫 페이지입니다</h4>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        아래 대화창에 첫 인사 메시지를 발송하거나 유용한 파일을 전송해 소통을 유도해 보세요!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isMine = msg.user_id === user.id;
                      const sender = msg.profiles || {};
                      const senderName = sender.nickname || sender.name || '알 수 없음';
                      const senderAvatar = sender.avatar_url;

                      return (
                        <div 
                          key={msg.id} 
                          className={`flex gap-3 text-left group items-start ${
                            isMine ? 'flex-row-reverse text-right' : 'flex-row'
                          }`}
                        >
                          {/* Avatar */}
                          <Avatar className="w-8.5 h-8.5 border shadow-sm shrink-0">
                            <AvatarImage src={senderAvatar || undefined} referrerPolicy="no-referrer" />
                            <AvatarFallback className="bg-purple-100 text-purple-605 text-xs font-black">
                              {senderName[0]}
                            </AvatarFallback>
                          </Avatar>

                          {/* Detail bubble frame */}
                          <div className={`max-w-[70%] space-y-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400">
                              <span className="text-slate-700 font-black">{senderName}</span>
                              <span className="scale-90 opacity-80">
                                {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            <div className="relative group/bubble flex items-center gap-1">
                              <div className={`p-3 rounded-2xl text-sm font-medium shadow-sm leading-relaxed overflow-hidden ${
                                isMine 
                                ? 'bg-purple-650 text-white rounded-tr-none text-left' 
                                : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                              }`}>
                                {renderMessageContent(msg.message)}
                              </div>

                              {/* Hover actions */}
                              {(isMine || isAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => handleMessageDelete(msg.id)}
                                  className={`p-1 bg-white border border-slate-150 rounded-md shadow-sm text-slate-400 hover:text-red-500 hover:bg-slate-50 opacity-0 group-hover/bubble:opacity-100 transition-all ${
                                    isMine ? 'order-first' : 'order-last'
                                  }`}
                                  title="메시지 지우기"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mt-0.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>
                )}
              </div>

              {/* MESSAGE COMPOSER EDITOR (Slack style) */}
              {!activeRoom.isJoined ? (
                <div className="p-6 bg-purple-50/40 border-t border-purple-100/65 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl shrink-0 m-4 text-left">
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm text-slate-900">새로운 채팅방에 오신 것을 환영합니다!</h4>
                    <p className="text-xs text-slate-500 mt-1">이 채팅방의 메시지를 읽을 수 있지만, 메시지를 보내려면 먼저 참여를 등록해야 합니다.</p>
                  </div>
                  <Button
                    onClick={() => handleJoinRoom(activeRoom)}
                    className="bg-purple-600 hover:bg-purple-700 font-extrabold text-xs text-white shadow-md border-none px-6 py-2 rounded-xl whitespace-nowrap h-10 shrink-0"
                  >
                    이 채팅방 참여하기
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                {/* 파일업로드 진행기 표시 */}
                {uploading && (
                  <div className="mb-2 bg-slate-100 p-2 rounded-xl flex items-center justify-between text-[10px] font-black text-purple-600 animate-pulse">
                    <span>📁 파일을 서버에 전송 중... ({uploadProgress}%)</span>
                    <span className="text-slate-400">잠시만 기다려주세요.</span>
                  </div>
                )}

                <form 
                  onSubmit={handleSendMessage} 
                  className="relative flex flex-col border border-slate-255 focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-150 rounded-2xl bg-[#FBFBFC] transition-all overflow-visible"
                >
                  {/* Floating Mentions Autocomplete Popover */}
                  {showMentionPopover && (
                    <div className="absolute bottom-14 left-4 z-50 w-64 max-h-56 bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
                        <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                          <AtSign className="w-3.5 h-3.5 text-purple-600" />
                          소환할 대화 참여자 선택 (@)
                        </span>
                      </div>
                      <div className="flex-grow overflow-y-auto p-1.5 space-y-0.5">
                        {filteredMentionMembers.length === 0 ? (
                          <span className="text-[10px] text-slate-400 font-semibold block text-center py-4">
                            소환 가능한 참여자가 없습니다.
                          </span>
                        ) : (
                          filteredMentionMembers.map((member) => {
                            if (!member) return null;
                            const nameText = member.nickname || member.name || '익명 수강생';
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => handleSelectMention(member)}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-purple-50 transition-all rounded-xl text-left border-none"
                              >
                                <Avatar className="w-6.5 h-6.5 shrink-0 border border-slate-150 shadow-sm">
                                  <AvatarImage src={member.avatar_url || undefined} referrerPolicy="no-referrer" />
                                  <AvatarFallback className="text-[10px] bg-slate-100 font-black text-slate-600">
                                    {nameText[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-grow leading-tight">
                                  <span className="text-xs font-bold text-slate-800 truncate block">{nameText}</span>
                                  <span className="text-[9px] text-slate-455 font-semibold truncate block mt-0.5">{member.email}</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Floating Emoji vs Tenor GIFs Tabbed Popover */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-14 left-4 z-50 w-76 h-84 bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                      {/* Tab selection */}
                      <div className="flex border-b border-slate-105 bg-slate-50/70 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEmojiTab('emoji')}
                          className={`flex-1 py-2.5 text-xs font-black border-b-2 tracking-tight transition-all border-none ${
                            emojiTab === 'emoji' 
                              ? 'text-purple-600 bg-white border-b-purple-600 font-extrabold shadow-sm' 
                              : 'text-slate-500 hover:text-slate-850'
                          }`}
                        >
                          이모티콘 전체
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmojiTab('gif')}
                          className={`flex-1 py-2.5 text-xs font-black border-b-2 tracking-tight transition-all border-none ${
                            emojiTab === 'gif' 
                              ? 'text-purple-600 bg-white border-b-purple-600 font-extrabold shadow-sm' 
                              : 'text-slate-500 hover:text-slate-850'
                          }`}
                        >
                          GIF (Tenor Search)
                        </button>
                      </div>

                      {/* Tab content: Emoji Picker */}
                      {emojiTab === 'emoji' && (
                        <div className="flex-grow overflow-y-auto p-3.5 grid grid-cols-6 gap-2 bg-[#FDFDFD]">
                          {POPULAR_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                handleSelectEmoji(emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="text-xl p-1 hover:bg-purple-100/70 rounded transition-all flex items-center justify-center border-none"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Tab content: GIF Search */}
                      {emojiTab === 'gif' && (
                        <div className="flex-grow flex flex-col overflow-hidden p-3 bg-[#FDFDFD]">
                          {/* Inner search query */}
                          <div className="relative shrink-0 mb-2.5">
                            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                            <input
                              type="text"
                              value={tenorSearchQuery}
                              onChange={(e) => setTenorSearchQuery(e.target.value)}
                              placeholder="원하는 GIF 키워드를 입력해 보세요..."
                              className="w-full h-9 pl-8.5 pr-3 text-xs text-slate-800 font-bold bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white transition-all placeholder:text-slate-400"
                            />
                          </div>

                          {/* Loading vs Results listing */}
                          {loadingTenor ? (
                            <div className="flex-grow flex flex-col items-center justify-center space-y-2 text-slate-400">
                              <span className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                              <span className="text-[10px] font-black animate-pulse">Tenor GIF 검색결과 검색 중...</span>
                            </div>
                          ) : tenorGifs.length === 0 ? (
                            <div className="flex-grow flex items-center justify-center text-[10px] text-slate-400 font-bold">
                              검색 결과가 없습니다. 다른 키워드를 제안해 주세요.
                            </div>
                          ) : (
                            <div className="flex-grow overflow-y-auto grid grid-cols-2 gap-2 p-0.5 scrollbar-thin">
                              {tenorGifs.map((gif) => (
                                <button
                                  key={gif.id}
                                  type="button"
                                  onClick={() => {
                                    const gifMd = `![GIF](${gif.gifUrl})`;
                                    handleSelectEmoji(gifMd);
                                    setShowEmojiPicker(false);
                                  }}
                                  className="relative group border border-slate-100 rounded-2xl overflow-hidden h-20 bg-slate-50/50 cursor-pointer hover:border-purple-500 transition-all outline-none flex items-center justify-center border-none shadow-sm"
                                >
                                  <img 
                                    src={gif.tinyGifUrl || gif.gifUrl} 
                                    alt={gif.title || 'Tenor GIF'} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-all"
                                    referrerPolicy="no-referrer"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1. TOP FORMATTING ROW BAR */}
                  {showFormattingToolbar && (
                    <div className="flex items-center gap-1 px-3.5 py-2 border-b border-slate-150 bg-slate-50/50 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => applyFormatting('bold')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="굵게 (B)"
                      >
                        <Bold className="w-3.5 h-3.5 font-bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('italic')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="기울임 (I)"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('underline')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="밑줄 (U)"
                      >
                        <Underline className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('strikethrough')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="취소선 (S)"
                      >
                        <Strikethrough className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-[1px] h-3.5 bg-slate-250 mx-1.5 shrink-0" />

                      <button
                        type="button"
                        onClick={() => applyFormatting('link')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="하이퍼링크 연결"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('ordered-list')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="번호 순서 목록 리스트"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('bullet-list')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="점머리 목록 리스트"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-[1px] h-3.5 bg-slate-250 mx-1.5 shrink-0" />

                      <button
                        type="button"
                        onClick={() => applyFormatting('blockquote')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="인용 대화구"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('code')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="인라인 소스코드"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('code-block')}
                        className="p-1 text-slate-655 hover:text-purple-600 hover:bg-white hover:shadow-sm rounded transition-all border-none"
                        title="다중 코드 블럭"
                      >
                        <Braces className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* 2. MAIN TEXTAREA COMPOSER AREA */}
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputText(val);
                      // Auto-summon showMentionPopover if they end with '@' typed
                      if (val.endsWith('@')) {
                        setShowMentionPopover(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`#${getRoomDisplayName(activeRoom)}에 메시지 보내기`}
                    className="w-full min-h-[5rem] max-h-[14rem] px-4.5 py-3.5 bg-transparent border-0 resize-none outline-none focus:ring-0 text-xs text-slate-800 placeholder:text-slate-400 placeholder:font-bold leading-relaxed overflow-y-auto"
                  />

                  {/* 3. LOWER SHELF ACTIONS ROW */}
                  <div className="px-3 py-2 bg-slate-50/30 border-t border-slate-105 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {/* Plus button formatting file upload */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="p-2 text-slate-550 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all border-none"
                        title="파일 및 클립보드 이미지 첨부 (+)"
                      >
                        <Plus className="w-4 h-4 font-black" />
                      </button>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      {/* Aa Toggle button */}
                      <button
                        type="button"
                        onClick={() => setShowFormattingToolbar(prev => !prev)}
                        className={`p-2 rounded-xl transition-all border-none flex items-center justify-center ${
                          showFormattingToolbar 
                            ? 'text-purple-600 bg-purple-50 font-black' 
                            : 'text-slate-555 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                        title="포맷 툴바 상시 노출 토글 (Aa)"
                      >
                        <span className="text-xs font-black tracking-tighter leading-none">Aa</span>
                      </button>

                      {/* Emoji & GIF😄 picker trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmojiPicker(prev => !prev);
                          setShowMentionPopover(false);
                        }}
                        className={`p-2 rounded-xl transition-all border-none flex items-center justify-center ${
                          showEmojiPicker 
                            ? 'text-purple-600 bg-purple-50' 
                            : 'text-slate-555 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                        title="전체 이모티콘 및 Tenor GIF 가동 (😄)"
                      >
                        <Smile className="w-4 h-4" />
                      </button>

                      {/* Mention @ picker trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowMentionPopover(prev => !prev);
                          setShowEmojiPicker(false);
                        }}
                        className={`p-2 rounded-xl transition-all border-none flex items-center justify-center ${
                          showMentionPopover 
                            ? 'text-purple-600 bg-purple-50' 
                            : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                        title="참여자 조준소환 언급 (@)"
                      >
                        <AtSign className="w-4 h-4" />
                      </button>

                      {/* HelpCircle tips information helper */}
                      <button
                        type="button"
                        className="p-2 text-slate-400 hover:text-slate-655 hover:bg-slate-100/80 rounded-xl transition-all border-none"
                        title="줄바꿈: Shift+Enter · 소환: @입력"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Right align send icon with chevron */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="submit"
                        disabled={!inputText.trim() || sending}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-350 text-white rounded-xl h-8.5 px-3.5 font-bold text-xs shrink-0 flex items-center gap-1 border-none shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
              <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center ring-8 ring-purple-50/50">
                <MessageSquare className="w-10 h-10 text-purple-600" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-lg font-black tracking-tight text-gray-950">
                  {rooms.length > 0 ? '대화를 선택해 주세요' : '개설된 소통 채팅방이 없습니다'}
                </h3>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  {rooms.length > 0 
                    ? '왼쪽 대화 리스트에서 원하는 채팅방을 클릭하여 실시간 소통을 시작해 보세요!' 
                    : '좌측 메인 바의 \'+\' 버튼을 클릭하시어 신규 공개/비공개 채팅 또는 1:1 대화방을 개설해 보세요!'}
                </p>
              </div>
              {rooms.length === 0 && (
                <Button
                  onClick={() => { setCreateType('public'); setIsCreateModalOpen(true); }}
                  className="bg-purple-600 hover:bg-purple-700 h-11 px-6 rounded-2xl font-black text-xs text-white"
                >
                  첫 소통 채팅방 개설하기
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ===================================
            3. RIGHT SIDEBAR (Active Room Members list)
            =================================== */}
        {activeRoom && (
          <div className="hidden md:flex w-60 lg:w-64 border-l border-slate-100 bg-white flex flex-col shrink-0 overflow-hidden text-left">
            <div className="p-4 border-b border-slate-50 shrink-0 flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-600" />
                참여자 리스트 ({roomMembers.length})
              </h4>
              {activeRoom.room_type !== 'dm' && (
                <Button
                  onClick={() => setIsInviteModalOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-600 font-extrabold rounded-lg flex items-center border-none"
                >
                  <Plus className="w-3 h-3 mr-0.5" />
                  초대
                </Button>
              )}
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-3">
              {roomMembers.map(member => {
                if (!member) return null;
                const nameText = member.nickname || member.name || '익명 수강생';
                const avatar = member.avatar_url;
                return (
                  <div key={member.id} className="flex items-center justify-between gap-2.5 py-0.5 group/member">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="w-8 h-8 border border-slate-100 shrink-0">
                        <AvatarImage src={avatar || undefined} referrerPolicy="no-referrer" />
                        <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-black">{nameText[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 leading-tight">
                        <span className="text-xs font-bold text-slate-800 truncate block">{nameText}</span>
                        <span className="text-[9px] text-slate-400 font-semibold truncate block mt-0.5">{member.email}</span>
                      </div>
                    </div>
                    {/* 참여자 강제 퇴장 버튼 (관리자 전용, 본인은 제외) */}
                    {isAdmin && member.id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover/member:opacity-100 transition-all shrink-0"
                        title="참여자 내보내기"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {roomMembers.length === 0 && (
                <span className="text-[10px] text-slate-400 font-semibold block text-center py-6">멤버 목록 확인 오류</span>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Mobile Sliding Drawer Menu for Chat Lounge */}
      <AnimatePresence>
        {isMobileListOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Dark blur backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileListOpen(false)}
              className="absolute inset-0 bg-black/60"
            />
            
            {/* Drawer Content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-80 max-w-[85vw] h-full bg-[#1F1523] text-white flex flex-col shadow-2xl overflow-hidden text-left"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#2D1D34] flex items-center justify-between shrink-0 bg-[#160E1A]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm tracking-tight leading-none text-white">Beone Chat</h2>
                    <span className="text-[9px] font-bold text-purple-300 block mt-1 leading-none">비원아카데미 채팅 목록</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileListOpen(false)}
                  className="w-8 h-8 rounded-lg text-purple-300 hover:text-white hover:bg-white/10 shrink-0 border-none transition-all"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Categories Navigation List */}
              <div className="flex-grow overflow-y-auto px-2 py-4 space-y-6">
                {/* 1. PUBLIC CHANNELS */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-3 pb-1">
                    <span className="text-[10px] font-black tracking-wider text-purple-300/50 uppercase">📢 공개 소통방 ({publicRooms.length})</span>
                    <button 
                       onClick={() => { setCreateType('public'); setIsCreateModalOpen(true); setIsMobileListOpen(false); }}
                       className="p-1 hover:bg-white/10 rounded-md text-purple-300 hover:text-white border-none transition-all"
                       title="공개 채널 생성"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {publicRooms.map(room => {
                      const isActive = activeRoom?.id === room.id;
                      return (
                        <div 
                          key={room.id}
                          onClick={() => {
                            setSearchParams({ room: room.id });
                            setIsMobileListOpen(false);
                          }}
                          className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                            isActive 
                              ? 'bg-purple-600 text-white font-extrabold shadow-md' 
                              : 'text-purple-100/85 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Hash className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-purple-300/40'}`} />
                            <span className="truncate">{getRoomDisplayName(room)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {publicRooms.length === 0 && (
                      <span className="text-[9px] text-purple-300/30 pl-3 block py-1">공개 소통방이 없습니다.</span>
                    )}
                  </div>
                </div>

                {/* 2. PRIVATE GROUPS */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-3 pb-1">
                    <span className="text-[10px] font-black tracking-wider text-purple-300/50 uppercase">🔒  비공개 소통그룹 ({privateRooms.length})</span>
                    <button 
                       onClick={() => { setCreateType('private'); setIsCreateModalOpen(true); setIsMobileListOpen(false); }}
                       className="p-1 hover:bg-white/10 rounded-md text-purple-300 hover:text-white border-none transition-all"
                       title="비공개 채널 생성"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {privateRooms.map(room => {
                      const isActive = activeRoom?.id === room.id;
                      return (
                        <div 
                          key={room.id}
                          onClick={() => {
                            setSearchParams({ room: room.id });
                            setIsMobileListOpen(false);
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                            isActive 
                              ? 'bg-purple-600 text-white font-extrabold shadow-md' 
                              : 'text-purple-100/85 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-purple-300/40'}`} />
                            <span className="truncate">{getRoomDisplayName(room)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {privateRooms.length === 0 && (
                      <span className="text-[9px] text-purple-300/30 pl-3 block py-1">참여 중인 비공개 그룹이 없습니다.</span>
                    )}
                  </div>
                </div>

                {/* 3. 1:1 DIRECT MESSAGES */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-3 pb-1">
                    <span className="text-[10px] font-black tracking-wider text-purple-300/50 uppercase">💬 1:1 대화 ({dmRooms.length})</span>
                    <button 
                       onClick={() => { setCreateType('dm'); setIsCreateModalOpen(true); setIsMobileListOpen(false); }}
                       className="p-1 hover:bg-white/10 rounded-md text-purple-300 hover:text-white border-none transition-all"
                       title="1:1 DM 시작"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {dmRooms.map(room => {
                      const isActive = activeRoom?.id === room.id;
                      return (
                        <div 
                          key={room.id}
                          onClick={() => {
                            setSearchParams({ room: room.id });
                            setIsMobileListOpen(false);
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                            isActive 
                              ? 'bg-purple-650 text-white font-extrabold shadow-md' 
                              : 'text-purple-100/85 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Users className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-purple-300/40'}`} />
                            <span className="truncate">{getRoomDisplayName(room)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {dmRooms.length === 0 && (
                      <span className="text-[9px] text-purple-300/30 pl-3 block py-1">1:1 소통 기록이 없습니다.</span>
                    )}
                  </div>
                </div>

                {/* 4. Active Room Members list for Mobile view inside the drawer */}
                {activeRoom && (
                  <div className="pt-4 border-t border-[#2D1D34] space-y-3">
                    <div className="flex items-center justify-between px-3">
                      <span className="text-[10px] font-black tracking-wider text-purple-300/50 uppercase flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        참여자 리스트 ({roomMembers.length})
                      </span>
                      {activeRoom.room_type !== 'dm' && (
                        <button
                          onClick={() => {
                            setIsInviteModalOpen(true);
                            setIsMobileListOpen(false);
                          }}
                          className="text-[9px] bg-purple-600 hover:bg-purple-700 text-white font-bold p-1 px-2 rounded-md border-none transition-all shadow-sm"
                        >
                          초대
                        </button>
                      )}
                    </div>
                    <div className="max-h-[140px] overflow-y-auto px-2 space-y-2">
                      {roomMembers.map(member => {
                        if (!member) return null;
                        const nameText = member.nickname || member.name || '익명 수강생';
                        const avatar = member.avatar_url;
                        return (
                          <div key={member.id} className="flex items-center justify-between gap-2.5 py-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="w-6 h-6 border border-purple-500/10 shrink-0">
                                <AvatarImage src={avatar || undefined} referrerPolicy="no-referrer" />
                                <AvatarFallback className="bg-white/10 text-slate-300 text-[8px] font-bold">{nameText[0]}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 leading-none">
                                <span className="text-[10px] font-bold text-slate-100 truncate block">{nameText}</span>
                              </div>
                            </div>
                            {isAdmin && member.id !== user?.id && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member.id)}
                                className="p-0.5 text-purple-300 hover:text-red-400 shrink-0 border-none"
                                title="내보내기"
                              >
                                <UserMinus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Compact User bottom card */}
              <div className="p-4 bg-[#140D17] border-t border-[#2D1D34] shrink-0 text-left flex items-center justify-between gap-2.5 font-sans">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="w-8 h-8 border border-purple-500/20">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-purple-600 text-white font-black text-[10px]">{(user.nickname || user.name || 'U')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 leading-tight">
                    <h4 className="font-extrabold text-[11px] text-slate-100 truncate">{user.nickname || user.name || '본인'}</h4>
                    <p className="text-[8px] text-slate-400 font-bold tracking-tight truncate mt-0.5">접속 상태: 온라인</p>
                  </div>
                </div>
                <Link to="/" className="p-1.5 hover:bg-white/5 rounded-lg text-purple-300 hover:text-white transition-colors border-none" title="웹사이트 나가기">
                  <LogOut className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================
          SLACK WORKSPACE NEW ROOM DIALOG
          =================================== */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="rounded-[32px] sm:max-w-md p-8 text-left">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              채팅방 개설하기
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-gray-400">
              실시간 라운지에 올라갈 카테고리별 채팅방을 개설합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleModalCreateRoom} className="space-y-5.5 pt-2">
            {/* Type grid */}
            <div className="space-y-2">
              <Label className="text-xs font-black text-gray-400 tracking-wider">채팅방 성격 정의</Label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => { setCreateType('public'); setCreateRoomTargetId(''); }}
                  className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all ${
                    createType === 'public' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-purple-600 hover:bg-white'
                  }`}
                >
                  공개 채팅방
                </button>
                <button
                  type="button"
                  onClick={() => { setCreateType('private'); setCreateRoomTargetId(''); }}
                  className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all ${
                    createType === 'private' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-purple-600 hover:bg-white'
                  }`}
                >
                  비공개 그룹
                </button>
                <button
                  type="button"
                  onClick={() => setCreateType('dm')}
                  className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all ${
                    createType === 'dm' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-purple-600 hover:bg-white'
                  }`}
                >
                  1:1 DM
                </button>
              </div>
            </div>

            {/* Room Name */}
            {createType !== 'dm' && (
              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 tracking-wider">소통방 명칭</Label>
                <Input
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                  placeholder="예: 과제 피드백방, 공모전 준비 스터디..."
                  className="h-11.5 rounded-xl text-xs font-bold border-slate-200"
                />
              </div>
            )}

            {/* Target Select for Private/DM */}
            {createType === 'dm' && (
              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 tracking-wider">대화할 상대 선택 (1:1)</Label>
                <select
                  value={createRoomTargetId}
                  onChange={(e) => setCreateRoomTargetId(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-605"
                >
                  <option value="">대화할 수강생을 선택하세요</option>
                  {availableStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.nickname || student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {createType === 'private' && (
              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 tracking-wider">첫 초대 멤버 매칭 (선택)</Label>
                <select
                  value={createRoomTargetId}
                  onChange={(e) => setCreateRoomTargetId(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-605"
                >
                  <option value="">같이 입장시킬 멤버를 선택해 주세요</option>
                  {availableStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.nickname || student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black mt-3.5 shadow-md shadow-purple-50"
            >
              성공적으로 채팅방 개설하기
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================================
          PARTICIPANT INVITATION DIALOG
          =================================== */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="rounded-[32px] sm:max-w-md p-8 text-left">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              참여자 초대하기
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-gray-400">
              현재 채팅방에 새로운 수강생을 초대합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteUser} className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-black text-gray-400 tracking-wider">초대할 대상 선택</Label>
              <select
                value={selectedInviteUserId}
                onChange={(e) => setSelectedInviteUserId(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-600"
                required
              >
                <option value="">초대 가능한 수강생 목록</option>
                {availableStudents
                  .filter(student => !roomMembers.some(member => member?.id === student.id))
                  .map(student => (
                    <option key={student.id} value={student.id}>
                      {student.nickname || student.name} ({student.email})
                    </option>
                  ))
                }
              </select>
            </div>

            <Button
              type="submit"
              disabled={!selectedInviteUserId}
              className="w-full h-11.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black mt-3.5 shadow-md shadow-purple-50"
            >
              성공적으로 참여자 초대하기
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================================
          CHANNEL DELETE CONFIRM DIALOG
          =================================== */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="rounded-[32px] sm:max-w-md p-8 text-left">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2.5 text-rose-600">
              <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              채팅방 완전 삭제
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-gray-500">
              경고: 이 동작은 취소할 수 없습니다. 이 채팅방의 대화 내역 전체를 초기화하고 데이터베이스에서 영구적으로 완전히 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={() => setIsDeleteConfirmOpen(false)}
              variant="outline"
              className="flex-1 h-11 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              취소
            </Button>
            <Button
              onClick={executeDeleteRoom}
              className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-50"
            >
              예, 완전히 삭제합니다
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
