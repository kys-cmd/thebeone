import React, { useEffect, useState, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { ChatWindow } from './ChatWindow';
import { 
  MessageSquare, X, ChevronLeft, Plus, Hash, ShieldAlert, Users, 
  Lock, MessageCircle, Send, Globe, ChevronRight, UserMinus 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export function FloatingChat() {
  const { isOpen, activeRoomId, activeRoomName, closeChat, setActiveRoom } = useChatStore();
  const { user } = useAuthStore();
  
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 모달/폼 상태
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<'public' | 'private' | 'dm'>('public');
  const [targetStudentId, setTargetStudentId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. 참여자용 학생 목록 로드 (1:1/비공개 방 목적)
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
          setStudents(data);
        }
      } catch (err) {
        console.error('Failed to load students', err);
      }
    };
    fetchStudents();
  }, [user]);

  // 2. 내 채팅방 목록 가져오기 + 공개방 가져오기
  const fetchMyRooms = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 2-1. 내가 멤버로 들어가 있는 방 조회
      const { data: memberData, error: memberError } = await supabase
        .from('chat_room_members')
        .select(`
          room_id,
          chat_rooms (
            id,
            room_name,
            name,
            room_type,
            created_at,
            community_id
          )
        `)
        .eq('user_id', user.id);

      // 2-2. 모든 공개(public) 방 조회
      const { data: publicData, error: publicError } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          room_name,
          name,
          room_type,
          created_at,
          community_id
        `)
        .eq('room_type', 'public');

      if (memberError || publicError) throw memberError || publicError;

      // 둘을 병합하고 중복 제거
      const mergedMap = new Map();
      
      // 우선 공개(public)방 등록
      if (publicData) {
        publicData.forEach((room: any) => {
          mergedMap.set(room.id, {
            ...room,
            isJoined: false,
          });
        });
      }

      // 내 참여방 추가 및 joined 표시
      if (memberData) {
        memberData.forEach((m: any) => {
          if (m.chat_rooms) {
            mergedMap.set(m.chat_rooms.id, {
              ...m.chat_rooms,
              isJoined: true,
            });
          }
        });
      }

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

      const roomList = Array.from(mergedMap.values()).filter((room: any) => {
        // 커뮤니티 소속 Chat Room 필터링: 방의 커뮤니티 ID가 설정되어 있는데 사용자가 해당 커뮤니티 회원이 아닌 경우 무조건 필터링 제외!
        if (room.community_id && room.community_id !== 'default') {
          return joinedCommunityIds.includes(room.community_id);
        }
        return true;
      });
      // 정렬
      roomList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setRooms(roomList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchMyRooms();

      // Realtime subscription for room additions
      const channel = supabase
        .channel('floating_chat_rooms_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_rooms' },
          () => {
            fetchMyRooms();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // 3. 채팅방 개설하기
  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() && roomType !== 'dm') {
      toast.error('채팅방 이름을 입력하세요.');
      return;
    }

    try {
      // DM의 경우 방 이름 자동생성
      let finalRoomName = roomName.trim();
      if (roomType === 'dm') {
        if (!targetStudentId) {
          toast.error('대화할 상대를 한 명 선택해 주세요.');
          return;
        }
        const student = students.find(s => s.id === targetStudentId);
        finalRoomName = `${student?.nickname || student?.name || '익명'}와의 1:1 대화`;
      }

      // A. chat_rooms 인서트
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert([
          {
            room_name: finalRoomName,
            room_type: roomType,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (roomError) throw roomError;

      // B. 멤버 등록
      const membersToInsert = [{ room_id: newRoom.id, user_id: user.id }];
      
      if (roomType === 'dm' && targetStudentId) {
        membersToInsert.push({ room_id: newRoom.id, user_id: targetStudentId });
      } else if (roomType === 'private' && targetStudentId) {
        // 비공개 이더라도 첫 사용자를 바로 초대할 수 있음 (선택사항)
        membersToInsert.push({ room_id: newRoom.id, user_id: targetStudentId });
      }

      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert(membersToInsert);

      if (memberError) throw memberError;

      toast.success('새 채팅방이 개설되었습니다.');
      setRoomName('');
      setTargetStudentId('');
      setIsCreating(false);
      fetchMyRooms();

      // 생성 직후 해당 방으로 즉시 접속
      setActiveRoom(newRoom.id, newRoom.room_name || newRoom.name);
    } catch (err: any) {
      console.error(err);
      toast.error('채팅방 생성 도중 문제가 발생했습니다.');
    }
  };

  // 4. 유휴방 입장하기 (공개방 참여 시 멤버 자동 추가)
  const handleJoinPublicRoom = async (room: any) => {
    if (room.isJoined) {
      setActiveRoom(room.id, room.room_name || room.name);
      return;
    }

    try {
      // 멤버 가입 등록
      await supabase.from('chat_room_members').insert([
        { room_id: room.id, user_id: user.id }
      ]);
      toast.success(`${room.room_name || room.name} 대화방에 입장했습니다.`);
      fetchMyRooms();
      setActiveRoom(room.id, room.room_name || room.name);
    } catch (err) {
      console.error(err);
      toast.error('입장 도중 오류가 발생했습니다.');
    }
  };

  const getRoomTypeBadge = (type: string) => {
    switch (type) {
      case 'private':
        return <Badge className="bg-red-50 text-red-600 border-none font-sans text-[8px] px-1.5 py-0.5 leading-none">비공개</Badge>;
      case 'dm':
        return <Badge className="bg-blue-50 text-blue-650 border-none font-sans text-[8px] px-1.5 py-0.5 leading-none">1:1 DM</Badge>;
      case 'public':
      default:
        return <Badge className="bg-purple-50 text-purple-650 border-none font-sans text-[8px] px-1.5 py-0.5 leading-none">공개</Badge>;
    }
  };

  const filteredRooms = rooms.filter(r => 
    (r.room_name || r.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed md:bottom-6 bottom-20 md:right-6 right-4 sm:w-96 w-[calc(100vw-32px)] h-[540px] md:h-[580px] bg-white rounded-[32px] shadow-2xl border border-slate-150 flex flex-col overflow-hidden z-[9999] transition-all animate-fade-in-up">
      {/* HEADER SECTION */}
      <div className="bg-purple-650 py-4.5 px-6 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          {activeRoomId ? (
            <button 
              onClick={() => setActiveRoom(null)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors -ml-1"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          ) : (
            <div className="p-1.5 bg-white/10 rounded-xl">
              <MessageCircle className="w-5 h-5" />
            </div>
          )}
          <div className="text-left">
            <h3 className="font-extrabold text-sm tracking-tight leading-none">
              {activeRoomId ? activeRoomName : '메신저 Lounge'}
            </h3>
            <span className="text-[10px] text-purple-100 font-bold leading-none mt-1 block">
              {activeRoomId ? '실시간 연동 중' : '아카데미 전원 실시간 소통'}
            </span>
          </div>
        </div>

        <button 
          onClick={closeChat}
          className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white/90 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* BODY WORKSPACE */}
      <div className="flex-grow flex flex-col overflow-hidden bg-slate-50/50">
        {activeRoomId ? (
          /* A. ACTIVE CHAT STATE */
          <div className="flex-grow h-full overflow-hidden">
            <ChatWindow 
              roomId={activeRoomId} 
              roomName={activeRoomName} 
              currentUserId={user.id} 
            />
          </div>
        ) : isCreating ? (
          /* B. CREATE ROOM FORM STATE */
          <div className="flex-grow p-5 overflow-y-auto space-y-4 text-left">
            <div className="flex items-center justify-between pb-1 shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">새 대화방 성격 정의</span>
              <button 
                onClick={() => setIsCreating(false)}
                className="text-xs text-purple-600 font-bold hover:underline"
              >
                뒤로가기
              </button>
            </div>

            <form onSubmit={handleCreateRoomSubmit} className="space-y-4.5">
              {/* Type Select */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">채팅방 유형 선택</label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => { setRoomType('public'); setTargetStudentId(''); }}
                    className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all ${
                      roomType === 'public' ? 'bg-purple-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    공개방
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRoomType('private'); setTargetStudentId(''); }}
                    className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all ${
                      roomType === 'private' ? 'bg-purple-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    비공개방
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomType('dm')}
                    className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all ${
                      roomType === 'dm' ? 'bg-purple-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    1:1 DM
                  </button>
                </div>
              </div>

              {/* Name (hidden for DM) */}
              {roomType !== 'dm' && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">대화방 이름</label>
                  <Input 
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="예: 과제 질문 피드백방, 취모임..."
                    className="h-10.5 rounded-xl text-xs font-semibold focus-visible:ring-purple-650"
                  />
                </div>
              )}

              {/* Targets for DM / Private */}
              {roomType === 'dm' && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">대화 상대 선택 (1:1)</label>
                  <select
                    value={targetStudentId}
                    onChange={(e) => setTargetStudentId(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-650"
                  >
                    <option value="">상대 회원을 선택해 주세요</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.nickname} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {roomType === 'private' && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">첫 대화 상대 매칭 (선택사항)</label>
                  <select
                    value={targetStudentId}
                    onChange={(e) => setTargetStudentId(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-650"
                  >
                    <option value="">처음으로 같이 입장시킬 멤버 선택</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.nickname} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button 
                type="submit"
                className="w-full h-11 bg-purple-650 hover:bg-purple-700 text-white rounded-xl font-extrabold text-xs mt-3.5 shadow-md shadow-purple-100"
              >
                방 개설 및 연결 시작
              </Button>
            </form>
          </div>
        ) : (
          /* C. MAIN ROOMS LIST STATE */
          <div className="flex-grow flex flex-col overflow-hidden">
            {/* Action Bar Search & Create */}
            <div className="p-4 bg-white border-b border-slate-100 flex gap-2 items-center shrink-0">
              <div className="relative flex-grow">
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="대화방을 검색해 보세요..."
                  className="h-9.5 pl-8 pr-3 text-[11px] bg-slate-50 border-0 rounded-xl font-bold placeholder:text-slate-400 w-full"
                />
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
              <Button
                onClick={() => setIsCreating(true)}
                size="icon"
                className="w-9.5 h-9.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                title="방 만들기"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            {/* List scrollarea */}
            <div className="flex-grow overflow-y-auto p-4 space-y-2">
              <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase block mb-1 text-left">
                가입 가능 소통룸 목록 ({filteredRooms.length})
              </span>

              {loading ? (
                <div className="text-center py-12 text-xs font-medium text-slate-400">
                  로비 서버 연동 중...
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="py-16 text-center space-y-3.5">
                  <div className="bg-slate-100 p-3 rounded-full w-12 h-12 flex items-center justify-center text-slate-400 mx-auto">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-slate-700">개설된 방이 어울리지 않습니다</h5>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">'+' 버튼을 눌러 첫 신규 채팅방을 생성해 보세요!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-left">
                  {filteredRooms.map((room) => {
                    const roomNameText = room.room_name || room.name || '알 수 없음';
                    return (
                      <div
                        key={room.id}
                        onClick={() => handleJoinPublicRoom(room)}
                        className="bg-white hover:bg-purple-50/20 active:bg-purple-50/50 p-3.5 rounded-2xl border border-slate-200/40 hover:border-purple-200 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-extrabold text-xs text-slate-800 truncate tracking-tight max-w-[160px]">
                              {roomNameText}
                            </h4>
                            {getRoomTypeBadge(room.room_type)}
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold mt-1">
                            {room.isJoined ? '✓ 참여 중' : '클릭하여 즉시 가입 및 입장'}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
