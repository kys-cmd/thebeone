import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  User, 
  Edit2, 
  Trash2, 
  Camera
} from 'lucide-react';
import { 
  instructorService, 
  Instructor 
} from '@/services/instructorService';
import { storageService } from '@/services/storageService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function InstructorManagement() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInstructors();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      toast.loading('이미지 업로드 중...', { id: 'upload' });
      const url = await storageService.uploadImage(file);
      setImageUrl(url);
      toast.success('이미지가 업로드되었습니다.', { id: 'upload' });
    } catch (error) {
      console.error(error);
      toast.error('이미지 업로드에 실패했습니다.', { id: 'upload' });
    } finally {
      setIsUploading(false);
    }
  };

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const data = await instructorService.getInstructors();
      setInstructors(data);
    } catch (error) {
      console.error(error);
      toast.error('강사 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (instructor: Instructor | null = null) => {
    setEditingInstructor(instructor);
    if (instructor) {
      setName(instructor.name);
      setTitle(instructor.title);
      setBio(instructor.bio);
      setImageUrl(instructor.image_url);
      setTags(instructor.tags || []);
      setTagInput((instructor.tags || []).join(', '));
    } else {
      setName('');
      setTitle('');
      setBio('');
      setImageUrl('');
      setTags([]);
      setTagInput('');
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name) {
      toast.error('이름을 입력해주세요.');
      return;
    }

    try {
      // 태그 처리: 콤마나 공백으로 분리, 빈값 제거, 최대 10개
      const finalTags = tagInput
        .split(/[ ,]+/)
        .map(t => t.trim())
        .filter(t => t !== '' && t.startsWith('#') ? t : `#${t}`.replace('##', '#')) // # 붙여주기
        .filter((v, i, a) => a.indexOf(v) === i) // 중복 제거
        .slice(0, 10);

      const payload = { name, title, bio, image_url: imageUrl, tags: finalTags };
      if (editingInstructor) {
        await instructorService.updateInstructor(editingInstructor.id, payload);
        toast.success('강사 정보가 수정되었습니다.');
      } else {
        await instructorService.createInstructor(payload);
        toast.success('새 강사가 등록되었습니다.');
      }
      setIsDialogOpen(false);
      fetchInstructors();
    } catch (error) {
      console.error(error);
      toast.error('저장에 실패했습니다.');
    }
  };

  const [deleteDialogInstructorId, setDeleteDialogInstructorId] = useState<string | null>(null);

  const confirmDeleteInstructor = async () => {
    if (!deleteDialogInstructorId) return;
    const id = deleteDialogInstructorId;
    setDeleteDialogInstructorId(null);
    try {
      await instructorService.deleteInstructor(id);
      toast.success('삭제되었습니다.');
      fetchInstructors();
    } catch (error) {
      console.error(error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteDialogInstructorId(id);
  };

  const filteredInstructors = instructors.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">강사 관리</h2>
          <p className="text-muted-foreground">강의에 등록할 강사 정보를 관리합니다.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" /> 새 강사 등록
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="이름 또는 직함으로 검색..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">프로필</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>직함</TableHead>
              <TableHead>등록일</TableHead>
              <TableHead className="w-[80px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : filteredInstructors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                  검색 결과가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              filteredInstructors.map((instructor) => (
                <TableRow key={instructor.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border">
                    {instructor.image_url ? (
                        <img src={instructor.image_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{instructor.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{instructor.title}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(instructor.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors outline-none">
                        <MoreHorizontal className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(instructor)}>
                          <Edit2 className="w-4 h-4 mr-2" /> 수정
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => handleDeleteClick(instructor.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>강사 {editingInstructor ? '수정' : '등록'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <div className="flex justify-center mb-2">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                  {imageUrl ? (
                    <img src={imageUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User className="w-10 h-10 text-gray-400" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                    </div>
                  )}
                </div>
                <button 
                  className="absolute bottom-0 right-0 p-1.5 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input 
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input 
                  id="name" 
                  value={name || ''} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="강사명"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">직함/소속</Label>
                <Input 
                  id="title" 
                  value={title || ''} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="예: 비원아카데미 수석 강사"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">약력/소개</Label>
              <Textarea 
                id="bio" 
                rows={5} 
                value={bio || ''} 
                onChange={(e) => setBio(e.target.value)} 
                placeholder="강사 소개 및 주요 경력을 입력하세요."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags" className="text-purple-600 font-bold">강사 해시태그 (최대 10개)</Label>
              <Input 
                id="tags" 
                value={tagInput} 
                onChange={(e) => setTagInput(e.target.value)} 
                placeholder="콤마(,)나 공백으로 구분 (예: 실무중심, 초보자환영)"
                className="border-purple-100 focus:border-purple-400"
              />
              <p className="text-[11px] text-gray-500 bg-purple-50 p-2 rounded-lg">
                💡 <strong>팁:</strong> 단어를 입력하고 콤마를 치면 자동으로 태그가 생성됩니다. (최대 10개)
              </p>
              {tagInput && (
                <div className="flex flex-wrap gap-1.5 mt-2 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  {tagInput.split(/[ ,]+/).filter(t => t.trim() !== '').slice(0, 10).map((tag, idx) => (
                    <span key={idx} className="bg-purple-600 text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm">
                      #{tag.replace('#', '')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
            <Button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700" disabled={isUploading}>
              {editingInstructor ? '수정하기' : '등록하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {deleteDialogInstructorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-6 shadow-xl">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900">강사 삭제</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                정말로 강사를 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다.)
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200"
                onClick={() => setDeleteDialogInstructorId(null)}
              >
                취소
              </Button>
              <Button 
                variant="destructive" 
                className="rounded-xl bg-red-600 hover:bg-red-700"
                onClick={confirmDeleteInstructor}
              >
                삭제하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
