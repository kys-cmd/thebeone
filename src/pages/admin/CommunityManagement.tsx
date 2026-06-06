import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Users, 
  MessageSquare, 
  Filter,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Calendar,
  Link as LinkIcon,
  Bell,
  Eye,
  EyeOff,
  UserPlus,
  Trash2,
  FileText,
  Hash as HashIcon,
  Lock
} from 'lucide-react';
import { motion } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { communityService } from '@/services/communityService';
import { courseService } from '@/services/courseService';
import { chatService } from '@/services/chatService';
import { ChatRoom } from '@/types';
import { useChatStore } from '@/store/useChatStore';

export default function AdminCommunityManagement() {
  const { id: urlCommId } = useParams();
  const { openChat } = useChatStore();
  const navigate = useNavigate();
  
  const [communities, setCommunities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComm, setSelectedComm] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [courses, setCourses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showMemberAddPanel, setShowMemberAddPanel] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [activeMenuTab, setActiveMenuTab] = useState<'communities' | 'joinRequests'>('communities');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const comms = await communityService.getAdminCommunities();
      setCommunities(comms);
      
      const allCourses = await courseService.getCourses();
      setCourses(allCourses);

      const users = await communityService.getAllUsers();
      setAllUsers(users);

      const reqs = await communityService.getJoinRequests();
      setJoinRequests(reqs);
    } catch (error: any) {
      console.error('Failed to load community data', error);
      toast.error(`데이터 로드 실패: ${error.message || '알 수 없는 오류'}`);
    }
  };

  const handleApproveRequest = async (id: string, userName: string) => {
    try {
      await communityService.approveJoinRequest(id);
      toast.success(`${userName}님의 가입 신청을 완전히 승인했습니다! 🎉`);
      loadData();
    } catch (error: any) {
      toast.error(`가입 승인 실패: ${error.message || '오류 발생'}`);
    }
  };

  const handleRejectRequest = async (id: string, userName: string) => {
    try {
      await communityService.rejectJoinRequest(id);
      toast.info(`${userName}님의 가입 신청을 반려 처리했습니다.`);
      loadData();
    } catch (error: any) {
      toast.error(`반려 처리 실패: ${error.message || '오류 발생'}`);
    }
  };

  useEffect(() => {
    if (urlCommId) {
      const comm = communities.find(c => c.id === urlCommId);
      if (comm) {
        setSelectedComm(comm);
        loadCommunityDetails(comm);
      }
    } else {
      setSelectedComm(null);
    }
  }, [urlCommId, communities]);

  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const loadCommunityDetails = async (comm: any) => {
    try {
      setIsDetailLoading(true);
      console.log('Loading community details for:', comm.id, 'linked course:', comm.course_id);
      
      const [commMembers, commPosts, commRooms] = await Promise.all([
        communityService.getAdminCommunityMembers(comm.id, comm.course_id).catch(err => {
          console.warn('[Community Details] Failed to load members, returning fallback empty array:', err);
          return [];
        }),
        communityService.getPosts(comm.id).catch(err => {
          console.warn('[Community Details] Failed to load posts, returning fallback empty array:', err);
          return [];
        }),
        chatService.getRooms(comm.id).catch(err => {
          console.warn('[Community Details] Failed to load chat rooms, returning fallback empty array:', err);
          return [];
        })
      ]);
      
      console.log('Loaded members count:', commMembers.length);
      setMembers(commMembers);
      setPosts(commPosts);
      setChatRooms(commRooms);
    } catch (error) {
      console.error('Failed to load community details', error);
      toast.error('상세 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRefreshDetails = () => {
    if (selectedComm) loadCommunityDetails(selectedComm);
  };

  const filteredCommunities = communities.filter(c => 
    c.name.includes(searchQuery) || c.type.includes(searchQuery)
  );

  const handleSearchUsers = async (query: string) => {
    setMemberSearchQuery(query);
    if (query.length > 1) {
      try {
        const results = await communityService.searchUsers(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed', error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectUser = async (user: any) => {
    if (!selectedComm) return;
    if (members.some(m => m.id === user.id)) {
      toast.error('이미 멤버에 포함되어 있습니다.');
      return;
    }

    try {
      await communityService.inviteMemberToCommunityByUserId(selectedComm.id, user.id);
      toast.success(`${user.name}님이 추가되었습니다.`);
      loadCommunityDetails(selectedComm);
      loadData();
      setMemberSearchQuery('');
      setSearchResults([]);
    } catch (error: any) {
      toast.error(error.message || '추가 실패');
    }
  };

  const [showDetailDeleteConfirm, setShowDetailDeleteConfirm] = useState(false);

  const handleDeleteCommunity = async (id: string, name: string) => {
    console.log('Attempting to delete community:', id, name);
    
    if (!showDetailDeleteConfirm) {
      setShowDetailDeleteConfirm(true);
      toast.info('정말 삭제하시려면 한번 더 눌러주세요.');
      return;
    }

    try {
      setIsDeleting(true);
      // 1. 커뮤니티 삭제 (서비스에서 멤버와 게시글을 먼저 삭제함)
      await communityService.deleteCommunity(id);
      
      toast.success('커뮤니티가 성공적으로 삭제되었습니다.');
      setShowDetailDeleteConfirm(false);
      
      // 2. 상태 초기화 및 이동
      setSelectedComm(null);
      navigate('/admin/community', { replace: true });
      
      // 3. 목록 데이터 새로고침
      await loadData();
    } catch (error: any) {
      console.error('Delete community error:', error);
      toast.error(`삭제 실패: ${error.message || '데이터 연동 오류가 발생했습니다.'}`);
      setShowDetailDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<ChatRoom | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteChatRoom = async () => {
    if (!roomToDelete) return;
    
    const toastId = toast.loading('채팅방을 삭제하는 중입니다...');
    try {
      setDeletingRoomId(roomToDelete.id);
      await chatService.deleteRoom(roomToDelete.id);
      toast.success('채팅방이 성공적으로 삭제되었습니다.', { id: toastId });
      
      // Refresh the room list
      if (selectedComm) {
        const rooms = await chatService.getRooms(selectedComm.id);
        setChatRooms(rooms);
      }
      setShowDeleteConfirm(false);
      setRoomToDelete(null);
    } catch (error: any) {
      console.error('Delete chat room error:', error);
      toast.error(`삭제 실패: ${error.message || '데이터베이스 권한을 확인해주세요.'}`, { id: toastId });
    } finally {
      setDeletingRoomId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedComm) return;
    
    // 로컬 상태에서만 먼저 제거 (낙관적 업데이트)
    const originalMembers = [...members];
    const member = members.find(m => m.id === memberId);
    const memberName = member ? member.name : '이 멤버';

    try {
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setRemovingMemberId(null); // 확인 상태 초기화
      
      await communityService.removeMember(selectedComm.id, memberId);
      toast.success(`${memberName}님이 커뮤니티에서 제외되었습니다.`);
      
      // 실제 데이터 싱크를 위해 백그라운드 로드
      await Promise.all([
        loadCommunityDetails(selectedComm),
        loadData()
      ]);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      toast.error(`제외 실패: ${error.message || '데이터베이스 연동 오류'}`);
      setMembers(originalMembers); // 실패 시 복구
    }
  };

  if (selectedComm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/community')} className="gap-2">
            <ChevronDown className="w-4 h-4 rotate-90" /> 목록으로
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">커뮤니티 상세 정보</h1>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button 
               onClick={() => navigate(`/admin/community/edit/${selectedComm.id}`)} 
               variant="outline" 
               className="border-purple-200 text-purple-700 bg-purple-50 font-bold hover:bg-purple-100"
               disabled={isDeleting}
            >
               설정 수정하기
            </Button>
            <Button 
               variant="outline" 
               className={`transition-all duration-200 font-bold ${
                 showDetailDeleteConfirm ? 'border-red-500 text-white bg-red-600 hover:bg-red-700' : 'border-red-200 text-red-600 hover:bg-red-50'
               }`} 
               onClick={() => handleDeleteCommunity(selectedComm.id, selectedComm.name)}
               disabled={isDeleting}
            >
              {isDeleting ? (
                <>삭제 중...</>
              ) : showDetailDeleteConfirm ? (
                <>정말 삭제하시겠습니까? (확인)</>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" /> 삭제
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-purple-600 text-white rounded-t-xl">
                <CardTitle className="text-xl">{selectedComm.name}</CardTitle>
                <CardDescription className="text-purple-100">
                  {selectedComm.type === 'course' ? '강의 커뮤니티' : 
                   selectedComm.type === 'season' ? '비원아카데미 시즌 커뮤니티' : 
                   selectedComm.type === 'other' ? '기타 커뮤니티' : '일반 커뮤니티'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  {selectedComm.course_id && (
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 space-y-2">
                      <Label className="text-purple-900 font-bold flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" /> 연동된 강의
                      </Label>
                      <p className="text-sm font-medium text-purple-800">
                        {courses.find(c => c.id === selectedComm.course_id)?.title || selectedComm.course_id}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 pt-4">
                     <Label className="text-sm font-bold flex items-center gap-2">
                       <FileText className="w-4 h-4 text-gray-500" /> 커뮤니티 설명
                     </Label>
                     <p className="text-sm text-gray-700 font-bold leading-relaxed">
                        {(() => {
                           try {
                              const extras = JSON.parse(selectedComm.description);
                              if (typeof extras === 'object' && extras.descriptionText) return extras.descriptionText;
                              return selectedComm.description || '설명이 없습니다.';
                           } catch {
                              return selectedComm.description || '설명이 없습니다.';
                           }
                        })()}
                     </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Members & Posts */}
          <div className="xl:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Member List */}
              <Card className="border-none shadow-sm flex flex-col h-[600px] overflow-hidden">
                <CardHeader className="pb-3 border-b shrink-0 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                       <div className="p-1.5 bg-purple-100 rounded-lg">
                        <Users className="w-4 h-4 text-purple-600" />
                       </div>
                       커뮤니티 멤버 
                       {isDetailLoading ? (
                         <span className="text-xs font-normal text-muted-foreground ml-1">로딩 중...</span>
                       ) : (
                         <Badge variant="secondary" className="ml-1 bg-purple-50 text-purple-700 border-none font-bold">
                           {members.length}명
                         </Badge>
                       )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500"
                        onClick={handleRefreshDetails}
                        disabled={isDetailLoading}
                      >
                        <motion.div
                          animate={isDetailLoading ? { rotate: 360 } : { rotate: 0 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <ChevronDown className="w-4 h-4 rotate-180" />
                        </motion.div>
                      </Button>
                      <Button 
                        variant={showMemberAddPanel ? "ghost" : "outline"}
                        size="sm" 
                        className="h-8 gap-1 font-bold" 
                        onClick={() => setShowMemberAddPanel(!showMemberAddPanel)}
                        disabled={isDetailLoading}
                      >
                        {showMemberAddPanel ? '닫기' : <><UserPlus className="w-3 h-3" /> 멤버 추가</>}
                      </Button>
                    </div>
                  </div>
                  
                  {showMemberAddPanel && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="pt-4 space-y-2 relative overflow-visible"
                    >
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input 
                          value={memberSearchQuery}
                          onChange={(e) => handleSearchUsers(e.target.value)}
                          placeholder="회원 이름 또는 이메일 검색"
                          className="pl-9 h-10 text-sm font-bold rounded-lg border-purple-200 focus:border-purple-400"
                        />
                      </div>
                      
                      {searchResults.length > 0 && (
                        <div className="absolute top-[3.5rem] left-0 right-0 z-[100] bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-gray-100 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                          {searchResults.map(user => (
                            <button
                              key={user.id}
                              onClick={() => handleSelectUser(user)}
                              className="w-full px-4 py-3 text-left hover:bg-purple-50 flex items-center gap-3 transition-colors"
                            >
                              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                                {user.name.substring(0, 1)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              </div>
                              <Plus className="w-4 h-4 text-gray-300" />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="max-h-48 overflow-y-auto bg-gray-50/50 border rounded-xl p-2 space-y-1">
                        <p className="text-[10px] font-black text-gray-500 px-2 pb-1 uppercase tracking-widest">추천 회원 리스트</p>
                        {allUsers.filter(u => !members.some(m => m.id === u.id)).slice(0, 5).map(user => (
                          <div key={user.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 min-w-0">
                               <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                                {user.name.substring(0, 1)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-gray-900 truncate leading-tight">{user.name}</p>
                                <p className="text-[9px] text-gray-400 truncate leading-tight">{user.email}</p>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleSelectUser(user)}
                              className="h-7 text-[10px] font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-100 flex-shrink-0"
                            >
                              추가
                            </Button>
                          </div>
                        ))}
                        {allUsers.length === 0 && <p className="text-xs text-center text-gray-400 py-4">사용자 목록이 없습니다.</p>}
                        {allUsers.length > 5 && <p className="text-[9px] text-center text-gray-500 font-medium pt-2">더 많은 회원은 검색창을 이용해 보세요.</p>}
                      </div>
                    </motion.div>
                  )}
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                  {members.length === 0 && !isDetailLoading ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 px-10 text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-gray-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-900">멤버가 아직 없습니다</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {selectedComm.type === 'course' 
                            ? '강의 수강생이 없거나 직접 추가된 멤버가 없습니다.' 
                            : '직접 멤버를 추가해 주세요.'}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowMemberAddPanel(true)}
                        className="rounded-full px-6 border-purple-200 text-purple-700 font-bold"
                      >
                        첫 멤버 추가하기
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {members.map((member, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={member.id} 
                          className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/80 transition-colors group"
                        >
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center text-purple-700 font-bold border-2 border-white shadow-sm overflow-hidden text-sm">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                member.name.substring(0, 1)
                              )}
                            </div>
                            {member.source === 'course' && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center" title="수강생">
                                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-gray-900 text-sm truncate">{member.nickname || member.name}</span>
                              {member.role === 'admin' && (
                                <Badge className="bg-amber-100 text-amber-700 border-none text-[9px] h-4 font-bold px-1.5">관리자</Badge>
                              )}
                              <Badge className={`text-[9px] h-4 font-bold px-1.5 border-none ${
                                member.source === 'course' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                              }`}>
                                {member.source === 'course' ? '수강생' : '직접 추가'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-gray-500 font-medium truncate mb-1">{member.email}</p>
                            <p className="text-[9px] text-gray-400 font-bold flex items-center gap-1 uppercase tracking-tight">
                              <Calendar className="w-2.5 h-2.5" /> 
                              {new Date(member.joinedAt).toLocaleDateString()} 가입
                            </p>
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            {removingMemberId === member.id ? (
                              <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-100 shadow-sm"
                              >
                                <span className="text-[10px] font-black text-red-600 px-2 whitespace-nowrap uppercase tracking-tighter">제외하시겠습니까?</span>
                                <div className="flex gap-1">
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-7 px-3 text-[10px] font-black rounded-lg"
                                    onClick={() => handleRemoveMember(member.id)}
                                  >
                                    확인
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 px-3 text-[10px] font-black rounded-lg text-gray-500"
                                    onClick={() => setRemovingMemberId(null)}
                                  >
                                    취소
                                  </Button>
                                </div>
                              </motion.div>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                onClick={() => setRemovingMemberId(member.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Post List */}
              <Card className="border-none shadow-sm flex flex-col h-[500px]">
                <CardHeader className="pb-3 border-b shrink-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> 최근 게시글 목록 ({posts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1">
                   <div className="divide-y">
                    {posts.length === 0 ? (
                      <div className="py-20 text-center text-muted-foreground italic">게시글이 없습니다.</div>
                    ) : (
                      posts.map(post => (
                        <div key={post.id} className="p-6 hover:bg-gray-50/50 transition-colors space-y-2">
                          <p className="font-bold text-gray-800 line-clamp-1">{post.title}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>작성자: {post.profiles?.nickname || post.profiles?.name || '알 수 없음'}</span>
                            <span>{new Date(post.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                   </div>
                </CardContent>
              </Card>

              {/* Chat Rooms Management */}
              <Card className="border-none shadow-sm flex flex-col h-[500px] md:col-span-2">
                <CardHeader className="pb-3 border-b shrink-0 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                       <div className="p-1.5 bg-purple-100 rounded-lg">
                        <MessageSquare className="w-4 h-4 text-purple-600" />
                       </div>
                       연동된 채팅방 목록
                       <Badge variant="secondary" className="ml-1 bg-purple-50 text-purple-700 border-none font-bold">
                         {chatRooms.length}개
                       </Badge>
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-1 font-bold border-purple-200 text-purple-700"
                      onClick={() => navigate(`/chat?communityId=${selectedComm.id}`)}
                    >
                      <Plus className="w-3 h-3" /> 새 채팅방 만들기
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                  {chatRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-900">개설된 채팅방이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {chatRooms.map((room) => (
                        <div key={room.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                              room.type === 'private' ? "bg-orange-100 text-orange-600" : "bg-purple-100 text-purple-600"
                            )}>
                              {room.type === 'private' ? <Lock className="w-5 h-5" /> : <HashIcon className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{room.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{room.type === 'public' ? '공개방' : '비밀방'}</span>
                                <span className="text-[10px] text-gray-400 font-bold">•</span>
                                <span className="text-[10px] text-gray-400 font-bold">멤버 {room.member_count}명</span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('Room delete request:', room.id, room.name);
                              setRoomToDelete(room);
                              setShowDeleteConfirm(true);
                            }}
                            disabled={deletingRoomId === room.id}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> 삭제
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Chat Room Delete Confirmation Modal */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="rounded-[40px] sm:max-w-md p-10 border-none shadow-2xl overflow-hidden">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                채팅방 영구 삭제
              </DialogTitle>
              <div className="text-gray-400 font-bold leading-relaxed px-1">
                정말로 <span className="text-red-600 font-black">"{roomToDelete?.name}"</span> 채팅방과 모든 대화 내용을 삭제하시겠습니까?<br/>
                이 작업은 되돌릴 수 없으며, 모든 멤버의 대화 목록에서 사라집니다.
              </div>
            </DialogHeader>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-8">
               <Button 
                 variant="outline"
                 onClick={() => setShowDeleteConfirm(false)}
                 className="w-full h-14 rounded-2xl border-gray-100 font-bold text-gray-500 hover:bg-gray-50"
               >
                 취소
               </Button>
               <Button 
                 onClick={handleDeleteChatRoom}
                 disabled={!!deletingRoomId}
                 className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 font-black text-white shadow-xl shadow-red-100"
               >
                 {deletingRoomId ? '삭제 중...' : '영구 삭제하기'}
               </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">커뮤니티 관리</h1>
          <p className="text-muted-foreground mt-1">커뮤니티 생성, 멤버십 관리 및 가입 신청 승인 처리를 수행합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            className="gap-2 bg-purple-600 hover:bg-purple-700 shadow-md font-bold"
            onClick={() => navigate('/admin/community/create')}
          >
            <Plus className="w-4 h-4" />
            새 커뮤니티 생성
          </Button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveMenuTab('communities')}
          className={cn(
            "px-6 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2",
            activeMenuTab === 'communities'
              ? "border-purple-600 text-purple-700 font-extrabold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          커뮤니티 목록
          <Badge className="ml-1 bg-purple-100 text-purple-700 border-none font-bold">
            {filteredCommunities.length}
          </Badge>
        </button>
        <button
          onClick={() => setActiveMenuTab('joinRequests')}
          className={cn(
            "px-6 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2",
            activeMenuTab === 'joinRequests'
              ? "border-purple-600 text-purple-700 font-extrabold"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          가입 신청 대기 목록
          {joinRequests.length > 0 && (
            <Badge className="ml-1 bg-red-500 text-white border-none font-bold animate-pulse text-xs px-1.5 py-0.5">
              {joinRequests.length}
            </Badge>
          )}
        </button>
      </div>

      {activeMenuTab === 'communities' ? (
        <Card className="border-none shadow-md overflow-hidden bg-white">
          <CardHeader className="border-b bg-gray-50/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">커뮤니티 목록</CardTitle>
                <CardDescription className="text-gray-500 font-medium">현재 운영 중인 모든 커뮤니티 목록입니다.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="커뮤니티 검색..." 
                    className="pl-9 w-full md:w-[280px] bg-white border-gray-200" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative w-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80">
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider">이름</th>
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider">유형</th>
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider text-center">멤버 수</th>
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider text-center">게시글</th>
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCommunities.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="h-32 text-center text-muted-foreground font-medium">
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredCommunities.map((community) => {
                      let statusLabel = '활성';
                      try {
                        const extras = JSON.parse(community.description || '{}');
                        if (typeof extras === 'object') {
                          statusLabel = extras.status === 'inactive' ? '정지' : '활성';
                        }
                      } catch {}

                      return (
                        <motion.tr 
                          key={community.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-purple-50/30 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/admin/community/${community.id}`)}
                        >
                          <td className="px-6 py-5 font-bold text-gray-900 group-hover:text-purple-700 transition-colors">{community.name}</td>
                          <td className="px-6 py-5">
                            <span className="text-gray-500 font-bold px-3 py-1 bg-gray-100 rounded-full text-xs">
                              {community.type === 'course' ? '강의 커뮤니티' : 
                               community.type === 'season' ? '비원아카데미 시즌 커뮤니티' : 
                               community.type === 'other' ? '기타 커뮤니티' : '일반 커뮤니티'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex items-center justify-center gap-2 font-bold text-gray-700">
                              <Users className="w-4 h-4 text-purple-500" />
                              {community.memberCount || 0}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex items-center justify-center gap-2 font-bold text-gray-700">
                              <MessageSquare className="w-4 h-4 text-blue-500" />
                              {community.postCount || 0}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <Badge className={`${statusLabel === '활성' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} border-none px-3 py-1 rounded-full font-bold`}>{statusLabel}</Badge>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-md overflow-hidden bg-white">
          <CardHeader className="border-b bg-gray-50/50">
            <div>
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                가입 신청 승인 대기 목록
                {joinRequests.length > 0 && (
                  <Badge className="bg-red-500 text-white border-none font-bold animate-pulse text-xs px-2 py-0.5">
                    {joinRequests.length}건
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-gray-500 font-medium">학습자들이 가입 신청을 보낸 커뮤니티 목록입니다. 우측의 "승인" 또는 "반려" 버튼을 통해 처리하세요.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative w-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80">
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider">신청 일시</th>
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider">목표 커뮤니티</th>
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider">신청 회원</th>
                    <th className="h-14 px-6 text-left align-middle font-bold text-gray-600 uppercase tracking-wider">이메일</th>
                    <th className="h-14 px-6 text-center align-middle font-bold text-gray-600 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {joinRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="h-48 text-center text-muted-foreground font-bold leading-relaxed py-10">
                        현재 대기 중인 커뮤니티 가입 신청건이 없습니다. 🎉
                      </td>
                    </tr>
                  ) : (
                    joinRequests.map((request) => {
                      const reqUser = request.profiles || {};
                      const reqComm = request.communities || {};
                      const displayName = reqUser.nickname 
                        ? `${reqUser.name} (${reqUser.nickname})` 
                        : (reqUser.name || '알 수 없음');

                      return (
                        <motion.tr 
                          key={request.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-purple-50/10 transition-colors"
                        >
                          <td className="px-6 py-5 text-gray-500 font-bold whitespace-nowrap">
                            {new Date(request.joined_at).toLocaleString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-extrabold text-purple-700 block">{reqComm.name || '알 수 없는 커뮤니티'}</span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase">
                              {reqComm.type === 'course' ? '강의 동문' : 
                               reqComm.type === 'season' ? '시즌 클럽' : '일반 공간'}
                            </span>
                          </td>
                          <td className="px-6 py-5 font-bold text-gray-900">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                                {(reqUser.name || 'N').substring(0, 1)}
                              </div>
                              <div>
                                <span className="block font-black text-gray-900">{displayName}</span>
                                {reqUser.nickname && (
                                  <Badge className="bg-purple-600 text-white font-black text-[9px] px-1 py-0 h-4 rounded-md">닉네임</Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-gray-500 font-bold">{reqUser.email || '-'}</td>
                          <td className="px-6 py-5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold h-9 px-3.5 rounded-lg flex items-center gap-1 shadow-md shadow-purple-100"
                                onClick={() => handleApproveRequest(request.id, reqUser.name || '회원')}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                승인
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 font-extrabold h-9 px-3.5 rounded-lg flex items-center gap-1"
                                onClick={() => handleRejectRequest(request.id, reqUser.name || '회원')}
                              >
                                <Trash2 className="w-4 h-4" />
                                반려
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
