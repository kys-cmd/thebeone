import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, Search, Plus, Trash2, Link as LinkIcon, Users, Calendar, MessageSquare, CreditCard, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { communityService } from '@/services/communityService';
import { courseService } from '@/services/courseService';

export default function AdminCommunityEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'board',
    course_id: '',
    startDate: '',
    endDate: '',
    status: 'active',
    isChatEnabled: true,
    postPermission: 'all',
    isPaid: false,
    price: ''
  });

  const [courses, setCourses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showUserList, setShowUserList] = useState(false);

  useEffect(() => {
    loadDependencies();
    if (isEditing) {
      loadCommunity();
    }
    loadAllUsers();
  }, [id]);

  const loadAllUsers = async () => {
    try {
      const users = await communityService.getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

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

  const loadDependencies = async () => {
    try {
      const allCourses = await courseService.getCourses();
      setCourses(allCourses);
    } catch (error) {
      console.error('Failed to load courses', error);
    }
  };

  const loadCommunity = async () => {
    if (!id) return;
    try {
      const communities = await communityService.getAdminCommunities();
      const comm = communities.find((c: any) => c.id === id);
      
      if (comm) {
        let extraInfo: any = {};
        try {
          extraInfo = JSON.parse(comm.description || '{}');
        } catch {}

        setFormData({
          ...formData,
          name: comm.name,
          type: comm.type || 'board',
          course_id: comm.course_id || '',
          description: extraInfo.descriptionText || comm.description || '',
          startDate: extraInfo.startDate || '',
          endDate: extraInfo.endDate || '',
          status: extraInfo.status || 'active',
          isChatEnabled: extraInfo.isChatEnabled ?? true,
          postPermission: extraInfo.postPermission || comm.post_permission || 'all',
          isPaid: extraInfo.isPaid || false,
          price: extraInfo.price?.toString() || ''
        });
        
        const commMembers = await communityService.getAdminCommunityMembers(comm.id, comm.course_id).catch(err => {
          console.warn('[Community Editor] Failed to fetch community members, returning fallback empty array:', err);
          return [];
        });
        setMembers(commMembers);
      }
    } catch (error) {
      console.error('Failed to load community', error);
      toast.error('커뮤니티 정보를 불러오는 데 실패했습니다.');
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('커뮤니티 이름을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Pack ONLY extra display info into JSON for description column
      const extraPayload = {
        descriptionText: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        isChatEnabled: formData.isChatEnabled,
        isPaid: formData.isPaid,
        postPermission: formData.postPermission,
        price: parseInt(formData.price || '0', 10)
      };

      const submitData: any = {
        name: formData.name,
        type: formData.type,
        course_id: formData.course_id || null,
        description: JSON.stringify(extraPayload)
      };

      let communityId = id;
      if (isEditing) {
        await communityService.updateCommunity(id, submitData);
      } else {
        const newComm = await communityService.createCommunity(submitData);
        communityId = newComm.id;
        // Add manual members
        for (const m of members.filter(mem => mem.source === 'manual' && mem.id && !mem.id.startsWith('temp-'))) {
             try {
                 await communityService.inviteMemberToCommunityByUserId(communityId!, m.id);
             } catch(e) {
                 console.error('Member invite fail silently for list', e);
             }
        }
      }

      // Sync course members if linked
      if (submitData.course_id && communityId) {
        await communityService.syncCourseMembers(communityId, submitData.course_id);
      }

      toast.success(isEditing ? '커뮤니티가 수정되었습니다.' : '커뮤니티가 생성되었습니다.');
      navigate('/admin/community');
    } catch (error: any) {
      console.error('Failed to save community', error);
      toast.error('저장에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!id || !isEditing) return;
    
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      toast.info('정말 삭제하시려면 한번 더 눌러주세요.');
      return;
    }

    setIsDeleting(true);
    try {
      await communityService.deleteCommunity(id);
      toast.success('커뮤니티가 성공적으로 삭제되었습니다.');
      navigate('/admin/community', { replace: true });
    } catch (error: any) {
      console.error('Failed to delete community', error);
      toast.error('삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectUser = async (user: any) => {
    if (members.some(m => m.id === user.id)) {
      toast.error('이미 멤버에 포함되어 있습니다.');
      return;
    }

    const newMember = {
      ...user,
      joinedAt: new Date().toISOString(),
      source: 'manual'
    };

    if (isEditing) {
      try {
        await communityService.inviteMemberToCommunityByUserId(id!, user.id);
        toast.success(`${user.name}님이 추가되었습니다.`);
        setMembers([...members, newMember]);
      } catch (error: any) {
        toast.error(error.message || '추가 실패');
      }
    } else {
      setMembers([...members, newMember]);
      toast.success('목록에 추가되었습니다. 생성 시 반영됩니다.');
    }
    
    setMemberSearchQuery('');
    setSearchResults([]);
    setShowUserList(false);
  };

  const handleAddMember = async () => {
    if (!memberSearchQuery) return;
    
    if (memberSearchQuery.includes('@')) {
      // Direct email invite fallback
      if (isEditing) {
        try {
          await communityService.inviteMemberToCommunityByEmail(id!, memberSearchQuery);
          toast.success('추가되었습니다.');
          loadCommunity();
        } catch (error: any) {
          toast.error(error.message || '추가 실패');
        }
      } else {
        const newMember = {
          id: 'temp-' + Date.now(),
          name: '초대 대기',
          email: memberSearchQuery,
          joinedAt: new Date().toISOString(),
          source: 'manual'
        };
        setMembers([...members, newMember]);
        toast.success('목록에 추가되었습니다.');
      }
      setMemberSearchQuery('');
    } else {
      toast.error('이메일 형식을 입력하거나 검색 결과에서 선택해주세요.');
    }
  };

  const handleRemoveMemberLocal = async (userId: string) => {
    if (isEditing) {
      try {
        await communityService.removeMember(id!, userId);
        toast.success('멤버가 제외되었습니다.');
        setMembers(members.filter(m => m.id !== userId));
      } catch (error: any) {
        toast.error(error.message || '제외 실패');
      }
    } else {
      setMembers(members.filter(m => m.id !== userId));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {isEditing ? '커뮤니티 수정' : '새 커뮤니티 생성'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            소통 채팅방에 필요한 모든 정보를 꼼꼼하게 설정할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm pb-2">
            <CardHeader className="bg-purple-50/50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" /> 커뮤니티 기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <Label className="text-gray-900 font-bold">커뮤니티 이름</Label>
                <Input 
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="커뮤니티 이름을 입력하세요 (예: 어웨이크 5기 스터디룸)"
                  className="h-12 bg-gray-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-purple-600 font-bold"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-gray-900 font-bold">연동 유형 선택</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val) => setFormData({...formData, type: val, course_id: val !== 'course' ? '' : formData.course_id})}
                >
                  <SelectTrigger className="h-12 bg-gray-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-purple-600">
                    <SelectValue placeholder="유형을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">교육 과정 커뮤니티 (강의 연동)</SelectItem>
                    <SelectItem value="season">비원아카데미 시즌 커뮤니티</SelectItem>
                    <SelectItem value="board">일반 커뮤니티</SelectItem>
                    <SelectItem value="other">기타 네트워킹</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'course' && (
                <div className="space-y-3 animate-in fade-in zoom-in duration-200">
                  <Label className="text-purple-700 font-bold flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" /> 연동할 교육 과정
                  </Label>
                  <Select 
                    value={formData.course_id} 
                    onValueChange={(val) => {
                      const selectedCourse = courses.find(c => c.id === val);
                      setFormData(prev => ({
                        ...prev, 
                        course_id: val,
                        name: prev.name || (selectedCourse ? `${selectedCourse.title} 커뮤니티` : ''),
                        description: prev.description || (selectedCourse ? `${selectedCourse.title} 강의 수강생 전용 커뮤니티입니다.` : '')
                      }));
                    }}
                  >
                    <SelectTrigger className="h-12 border-purple-200 bg-purple-50 rounded-xl focus:ring-purple-600">
                      <SelectValue placeholder="연동할 과정을 선택해주세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-purple-600/80 font-bold ml-1">해당 과정을 수강하는 회원은 멤버로도 자동 연동됩니다.</p>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-gray-900 font-bold">커뮤니티 설명</Label>
                <Input 
                  value={formData.description || ''}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="해당 커뮤니티의 목적과 활동 사항을 한 줄로 입력해주세요."
                  className="h-12 bg-gray-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-purple-600 font-bold"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="bg-gray-50/50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> 운영 기간 및 상태
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-gray-900 font-bold text-sm">시작일</Label>
                  <Input 
                    type="date"
                    value={formData.startDate || ''}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    className="h-12 bg-gray-50 border-none rounded-xl"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-900 font-bold text-sm">종료일</Label>
                  <Input 
                    type="date"
                    value={formData.endDate || ''}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    className="h-12 bg-gray-50 border-none rounded-xl"
                  />
                </div>
              </div>

              <div className="border-t pt-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-gray-900 font-bold text-sm">게시글 등록 권한</Label>
                  <Select 
                    value={formData.postPermission} 
                    onValueChange={(val) => setFormData({...formData, postPermission: val})}
                  >
                    <SelectTrigger className="h-12 bg-gray-50 border-none rounded-xl">
                      <SelectValue placeholder="권한 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 회원 등록 가능 (기본)</SelectItem>
                      <SelectItem value="admin">관리자만 등록 가능</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-gray-400 font-bold ml-1">커뮤니티 성격에 따라 게시글 작성 권한을 제한할 수 있습니다.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="space-y-0.5">
                    <Label className="font-bold text-gray-900">운영 상태</Label>
                    <p className="text-xs text-gray-500 font-bold">운영/정지 여부</p>
                  </div>
                  <Switch 
                    checked={formData.status === 'active'}
                    onCheckedChange={(c) => setFormData({...formData, status: c ? 'active' : 'inactive'})}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="space-y-0.5 flex flex-col">
                    <Label className="font-bold text-gray-900 flex items-center gap-1.5">
                       <MessageSquare className="w-3.5 h-3.5" /> 실시간 채팅
                    </Label>
                    <p className="text-xs text-gray-500 font-bold">채팅방 사용 여부</p>
                  </div>
                  <Switch 
                    checked={formData.isChatEnabled}
                    onCheckedChange={(c) => setFormData({...formData, isChatEnabled: c})}
                    className="data-[state=checked]:bg-blue-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

        <div className="lg:col-span-1 space-y-6">
          {/* Payment Card */}
          <Card className="border-none shadow-sm">
            <CardHeader className="bg-orange-50/50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-500" /> 과금 체계 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-bold text-gray-900">유료 커뮤니티</Label>
                  <p className="text-xs text-gray-500 font-bold">입장료 결제 시 활성화</p>
                </div>
                <Switch 
                  checked={formData.isPaid}
                  onCheckedChange={(c) => setFormData({...formData, isPaid: c})}
                  className="data-[state=checked]:bg-orange-500"
                />
              </div>

              {formData.isPaid && (
                <div className="space-y-3 pt-6 border-t border-dashed animate-in fade-in zoom-in">
                  <Label className="text-gray-900 font-bold">금액 설정 (원)</Label>
                  <Input 
                    type="number"
                    value={formData.price || 0}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    placeholder="숫자만 입력하세요"
                    className="h-12 bg-gray-50 border-none rounded-xl font-bold"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Members Search Card */}
          <Card className="border-none shadow-sm flex flex-col h-[600px]">
            <CardHeader className="bg-gray-50/50 border-b pb-4">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" /> 커뮤니티 멤버
                </span>
                <Badge className="bg-purple-100 text-purple-800 border-none">{members.length}명</Badge>
              </CardTitle>
              <div className="pt-4 flex flex-col gap-2 relative">
                 <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input 
                        value={memberSearchQuery}
                        onChange={(e) => handleSearchUsers(e.target.value)}
                        placeholder="이름 또는 이메일 검색"
                        className="pl-9 bg-white border-gray-200 h-10 text-sm font-bold w-full rounded-xl"
                      />
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => setShowUserList(!showUserList)} 
                      className="h-10 rounded-xl px-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      전체보기
                    </Button>
                 </div>

                 {/* Search Results Dropdown */}
                 {searchResults.length > 0 && (
                   <div className="absolute top-11 left-0 right-14 z-50 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y">
                     {searchResults.map(user => (
                       <button
                         key={user.id}
                         onClick={() => handleSelectUser(user)}
                         className="w-full px-4 py-3 text-left hover:bg-purple-50 flex items-center gap-3 transition-colors"
                       >
                         <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs uppercase">
                           {user.avatar_url ? (
                             <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" />
                           ) : (
                             user.name.substring(0, 1)
                           )}
                         </div>
                         <div>
                           <p className="text-sm font-bold text-gray-900">{user.name}</p>
                           <p className="text-xs text-gray-500">{user.email}</p>
                         </div>
                       </button>
                     ))}
                   </div>
                 )}
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 bg-white">
              {showUserList ? (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-gray-900">전체 회원 리스트 (100명까지)</h4>
                    <Button variant="ghost" size="sm" onClick={() => setShowUserList(false)} className="text-xs">닫기</Button>
                  </div>
                  <div className="space-y-1">
                    {allUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                            {user.name.substring(0, 1)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">{user.name}</p>
                            <p className="text-[10px] text-gray-500">{user.email}</p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleSelectUser(user)}
                          disabled={members.some(m => m.id === user.id)}
                          className="h-7 text-[10px] font-bold text-purple-600"
                        >
                          {members.some(m => m.id === user.id) ? '이미 멤버' : '추가'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="divide-y min-h-[200px]">
                  {members.length === 0 ? (
                    <div className="py-20 text-center text-sm font-bold text-gray-400">
                       추가된 멤버가 없습니다.<br/>위에서 검색하여 초대해보세요.
                    </div>
                  ) : (
                    members.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-xs">
                            {member.name.substring(0, 1)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{member.name}</p>
                            <p className="text-xs text-gray-500 font-bold">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {member.source === 'course' ? (
                            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none font-bold text-[10px]">수강생</Badge>
                          ) : (
                            <>
                              <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-none font-bold text-[10px]">초대됨</Badge>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleRemoveMemberLocal(member.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {isEditing && (
        <Card className="border-red-100 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-red-600 text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> 위험 구역 (Danger Zone)
            </CardTitle>
            <CardDescription className="font-bold text-red-500/80">
              커뮤니티 삭제는 되돌릴 수 없는 영구적인 작업입니다. 신중하게 결정해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-bold text-gray-900 text-sm">해당 커뮤니티 데이터 영구 삭제</p>
              <p className="text-xs text-gray-500 font-bold">등록된 멤버 정보와 게시글이 모두 소멸됩니다.</p>
            </div>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className={`h-12 px-8 rounded-xl font-black shadow-lg transition-all duration-200 ${
                showDeleteConfirm ? 'bg-red-700 ring-4 ring-red-200' : 'bg-red-600'
              }`}
            >
              {isDeleting ? '지우는 중...' : (showDeleteConfirm ? '진짜로 삭제하기 (확인)' : '지금 바로 삭제하기')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pt-6 border-t gap-4">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="h-14 px-8 rounded-2xl font-bold border-gray-200"
        >
          취소하기
        </Button>
        <Button 
          onClick={handleSave}
          disabled={isSubmitting}
          className="h-14 px-10 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-lg shadow-xl shadow-purple-200"
        >
          {isSubmitting ? '저장 중...' : (isEditing ? '변경사항 저장하기' : '커뮤니티 생성완료')}
        </Button>
      </div>
    </div>
  );
}
