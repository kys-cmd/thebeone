import React, { useState, useEffect } from 'react';
import { useMyChatRooms } from '@/hooks/useMyChatRooms';
import { supabase } from '@/lib/supabase';
import { ChatWindow } from './ChatWindow';
import { ThreadBoard } from './ThreadBoard';
import { 
  Users, MessageSquare, Hash, Plus, Sparkles, LogOut, 
  Compass, ChevronRight, CornerDownRight, Grid, Search, BookOpen,
  User, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface SidebarLayoutProps {
  currentUserId?: string | null;
}

export function SidebarLayout({ currentUserId }: SidebarLayoutProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'community' | 'chat'>('community');
  
  // Selection State
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [selectedCommunityName, setSelectedCommunityName] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoomName, setSelectedRoomName] = useState<string>('');
  
  // Sidebar data
  const [communities, setCommunities] = useState<any[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / Inputs
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isCreatingCommunity, setIsCreatingCommunity] = useState(false);

  // Chat Room Custom Hook
  const { rooms, loading: roomsLoading, createChatRoom } = useMyChatRooms();

  // Load communities
  const fetchCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCommunities(data || []);
      
      // Auto-select first community if none chosen
      if (data && data.length > 0 && !selectedCommunityId) {
        setSelectedCommunityId(data[0].id);
        setSelectedCommunityName(data[0].name);
      }
    } catch (e) {
      console.error('Error fetching communities:', e);
    } finally {
      setCommunitiesLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || isCreatingRoom) return;

    try {
      setIsCreatingRoom(true);
      // We can link the chat room to the active community if applicable
      const room = await createChatRoom(selectedCommunityId, newRoomName);
      if (room) {
        setNewRoomName('');
        setShowCreateRoom(false);
        // Auto-select the newly created room
        setSelectedRoomId(room.id);
        setSelectedRoomName(room.room_name || room.name);
        setActiveTab('chat');
      }
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleCreateCommunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommunityName.trim() || isCreatingCommunity) return;

    try {
      setIsCreatingCommunity(true);
      const { data, error } = await supabase
        .from('communities')
        .insert([
          {
            name: newCommunityName,
            description: newCommunityDesc || null,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;
      toast.success('커뮤니티 공간이 개설되었습니다.');
      setNewCommunityName('');
      setNewCommunityDesc('');
      setShowCreateCommunity(false);
      
      // Select the new community
      setSelectedCommunityId(data.id);
      setSelectedCommunityName(data.name);
      fetchCommunities();
    } catch (e: any) {
      toast.error('커뮤니티 개설 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingCommunity(false);
    }
  };

  // Filter lists based on search
  const filteredCommunities = communities.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRooms = rooms.filter(r => 
    (r.room_name || r.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-80px)] w-full max-w-7xl mx-auto rounded-3xl overflow-hidden border border-slate-200/60 bg-white shadow-md">
      {/* 1. SIDEBAR WRAPPER */}
      <div className="w-80 border-r border-slate-150 flex flex-col h-full bg-slate-50/50 shrink-0 text-left">
        
        {/* Workspace tabs - Modern Sliding Navigation Pill */}
        <div className="p-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('community')}
              className={`py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'community'
                  ? 'bg-purple-650 text-white font-extrabold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-4 h-4" />
              스레드 포럼
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-purple-650 text-white font-extrabold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              실시간 채팅
            </button>
          </div>
        </div>

        {/* Global Search box */}
        <div className="p-4 shrink-0 bg-white/50 border-b border-slate-100/60">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'community' ? '커뮤니티 검색...' : '채팅방 검색...'}
              className="h-10 pl-10 pr-4 bg-white focus-visible:bg-white border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Dynamic List Content */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          
          {/* A. If Community Tab selected */}
          {activeTab === 'community' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">커뮤니티 목록 ({filteredCommunities.length})</span>
                <button 
                  onClick={() => setShowCreateCommunity(true)}
                  className="p-1 rounded-md hover:bg-purple-50 text-purple-600 hover:text-purple-700 transition-colors"
                  title="새 공간 개설"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {communitiesLoading ? (
                <div className="text-center py-8 text-xs text-slate-400 font-bold">공간 목록 로드 중...</div>
              ) : filteredCommunities.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-semibold">검색된 공간이 없습니다.</div>
              ) : (
                <div className="space-y-1.5">
                  {filteredCommunities.map((c) => {
                    const isSelected = selectedCommunityId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCommunityId(c.id);
                          setSelectedCommunityName(c.name);
                        }}
                        className={`w-full p-3.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-500'}`}>
                            <Compass className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold truncate leading-tight">{c.name}</p>
                            <p className={`text-[9px] font-semibold mt-0.5 truncate leading-tight ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                              {c.description || '이 커뮤니티 공간에 정보가 아직 공란입니다.'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* B. If Chat Tab selected */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">참여 중인 대화방 ({filteredRooms.length})</span>
                <button 
                  onClick={() => setShowCreateRoom(true)}
                  className="p-1 rounded-md hover:bg-purple-50 text-purple-600 hover:text-purple-700 transition-colors"
                  title="채팅방 생성"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {roomsLoading ? (
                <div className="text-center py-8 text-xs text-slate-400 font-bold">대화방 데이터를 읽는 중...</div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-8 p-4 border border-dashed border-slate-200 bg-white/50 rounded-2xl space-y-2.5">
                  <p className="text-[10px] text-slate-400 font-bold">참여 중인 실시간 채팅방이 없습니다.</p>
                  <Button 
                    onClick={() => setShowCreateRoom(true)}
                    className="w-full bg-purple-50 hover:bg-purple-150 text-purple-600 font-extrabold text-[10px] uppercase rounded-xl h-8 tracking-wider shadow-none"
                  >
                    새 소통방 생성하기
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredRooms.map((r) => {
                    const isSelected = selectedRoomId === r.id;
                    const nameToShow = r.room_name || r.name || '알 수 없는 방';
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedRoomId(r.id);
                          setSelectedRoomName(nameToShow);
                        }}
                        className={`w-full p-3.5 rounded-2xl text-left transition-all block ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black truncate">{nameToShow}</span>
                          {r.community_name && (
                            <Badge className={`text-[8px] px-1.5 py-0.5 leading-none shrink-0 border-0 ${isSelected ? 'bg-purple-500 text-purple-50' : 'bg-slate-100 text-slate-500'}`}>
                              {r.community_name}
                            </Badge>
                          )}
                        </div>

                        {/* Last Message preview */}
                        {r.last_message && (
                          <p className={`text-[10px] font-semibold truncate mt-1.5 ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                            {r.sender_nickname ? `${r.sender_nickname}: ` : ''}{r.last_message}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User profile footer info block */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase shadow-inner">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-700 leading-none">로그인 계정</p>
              <p className="text-[9px] text-slate-500 font-bold leading-none mt-1 truncate max-w-[140px]">{currentUserId ? '인증 완료 상태' : '게스트 모드'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-grow p-6 h-full overflow-hidden bg-slate-50/20">
        
        {/* A. If Spreads Forum selected */}
        {activeTab === 'community' && selectedCommunityId && (
          <ThreadBoard 
            communityId={selectedCommunityId} 
            currentUserId={currentUserId} 
          />
        )}

        {/* B. If Live Chat selected */}
        {activeTab === 'chat' && selectedRoomId && (
          <ChatWindow 
            roomId={selectedRoomId} 
            roomName={selectedRoomName} 
            currentUserId={currentUserId} 
          />
        )}

        {/* C. Empty View fallback */}
        {((activeTab === 'community' && !selectedCommunityId) || (activeTab === 'chat' && !selectedRoomId)) && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="bg-slate-100 p-5 rounded-full text-slate-500 mb-4 animate-pulse">
              <BookOpen className="w-10 h-10" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-700">이동하거나 대화방을 선택해 주세요</h4>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">
              좌측 사이드바에서 커뮤니티 공간 혹은 실시간 채팅방을 탐색하고 클릭하세요!
            </p>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 3. MODALS (Create Room & Create Community) */}
      {/* ========================================== */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-left space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-4.5 h-4.5 text-purple-600" />
                새로운 소통방 생성
              </h4>
              <button onClick={() => setShowCreateRoom(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">대화방 이름명</label>
                <Input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="예: 자유 수다방, 디자인 피드백..."
                  className="rounded-xl h-11 text-xs font-semibold"
                />
              </div>
              <div className="flex justify-end gap-2 shrink-0 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateRoom(false)} className="rounded-xl h-9 text-xs font-semibold">
                  취소
                </Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 text-xs font-semibold">
                  방 개설하기
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateCommunity && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-left space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                <Compass className="w-4.5 h-4.5 text-purple-600" />
                새 커뮤니티 공간 개설
              </h4>
              <button onClick={() => setShowCreateCommunity(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <form onSubmit={handleCreateCommunitySubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">공간 이름</label>
                <Input
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                  placeholder="예: 프론트엔드 질문방, 네트워킹..."
                  className="rounded-xl h-11 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">한 줄 설명</label>
                <Input
                  value={newCommunityDesc}
                  onChange={(e) => setNewCommunityDesc(e.target.value)}
                  placeholder="이 공부방의 용도에 대해 안내해 주세요..."
                  className="rounded-xl h-11 text-xs font-semibold"
                />
              </div>
              <div className="flex justify-end gap-2 shrink-0 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateCommunity(false)} className="rounded-xl h-9 text-xs font-semibold">
                  취소
                </Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 text-xs font-semibold">
                  공간 개설하기
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
