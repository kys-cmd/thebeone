import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Video,
  FileText,
  User,
  Calendar as CalendarIcon,
  Clock,
  Shield,
  DollarSign,
  Eye,
  GripVertical,
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  Users,
  UserPlus,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { extractVimeoId } from "@/lib/vimeo";
import { courseService } from "@/services/courseService";
import { storageService } from "@/services/storageService";
import { instructorService, Instructor } from "@/services/instructorService";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Course,
  CurriculumSection,
  CourseBlock,
  CourseBlockType,
  CourseMaterial,
} from "@/types";

const fetchVimeoDuration = async (vimeoId: string): Promise<string> => {
  if (!vimeoId) return "00:00";
  try {
    // For unlisted videos, we need to pass the full URL including hash to oEmbed
    // vimeoId might be in the form "12345?h=abcde" or just "12345"
    let vimeoUrl = `https://vimeo.com/${vimeoId.replace("?h=", "/")}`;
    const response = await fetch(
      `https://vimeo.com/api/oembed.json?url=${vimeoUrl}`,
    );
    if (!response.ok) return "00:00";
    const data = await response.json();
    if (data.duration) {
      const minutes = Math.floor(data.duration / 60);
      const seconds = data.duration % 60;
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return "00:00";
  } catch (error) {
    console.warn("Vimeo duration fetch skipped or failed (unlisted / offline):", error);
    return "00:00";
  }
};

export default function AdminCourseEditor() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { id } = useParams();
  const isEdit = id && id !== "new";

  const [loading, setLoading] = useState(isEdit ? true : false);
  const [saving, setSaving] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);

  // --- State ---
  const [courseInfo, setCourseInfo] = useState<{
    title: string;
    instructor_id: string;
    instructor: string;
    instructor_title: string;
    instructor_bio: string;
    instructor_image: string;
    instructor_tags: string[];
    price: number;
    discount_price: number;
    description: string;
    category: string;
    status: string;
    start_date: string;
    end_date: string;
    reg_start_date: string;
    reg_end_date: string;
    study_start_date: string;
    study_end_date: string;
    access_type: string;
    min_member_grade: string | null;
    thumbnail: string;
    hero_bg_color: string;
    hero_text_color: string;
    hero_image: string;
    outcomes: string[];
    recommended_for: string[];
    materials: CourseMaterial[];
    is_free: boolean;
    max_capacity: number | null;
    is_force_closed: boolean;
    is_duration_based: boolean;
    duration_days: number | null;
  }>({
    title: "",
    instructor_id: "",
    instructor: user?.name || "",
    instructor_title: "",
    instructor_bio: "",
    instructor_image: "",
    instructor_tags: [],
    price: 0,
    discount_price: 0,
    description: "",
    category: "regular",
    status: "published",
    start_date: new Date().toISOString(),
    end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
    reg_start_date: new Date().toISOString(),
    reg_end_date: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
    study_start_date: new Date().toISOString(),
    study_end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
    access_type: "automatic",
    min_member_grade: null,
    thumbnail: "",
    hero_bg_color: "#0f172a",
    hero_text_color: "#ffffff",
    hero_image: "",
    outcomes: [""],
    recommended_for: [""],
    materials: [],
    is_free: false,
    max_capacity: null,
    is_force_closed: false,
    is_duration_based: false,
    duration_days: 90,
  });

  const [curriculum, setCurriculum] = useState<CurriculumSection[]>([]);
  const [layout, setLayout] = useState<Course["layout"]>({ blocks: [] });

  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isAddingStudentsProgress, setIsAddingStudentsProgress] = useState(false);

  // --- Member-specific Study Period States ---
  const [isCustomStudentExpiry, setIsCustomStudentExpiry] = useState(false);
  const [customStudentExpiryType, setCustomStudentExpiryType] = useState<'days' | 'date'>('days');
  const [customStudentExpiryDays, setCustomStudentExpiryDays] = useState<number>(90);
  const [customStudentExpiryDate, setCustomStudentExpiryDate] = useState<string>(
    new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]
  );

  // --- Individual Expiry Edit States ---
  const [isEditExpiryModalOpen, setIsEditExpiryModalOpen] = useState(false);
  const [selectedStudentForExpiry, setSelectedStudentForExpiry] = useState<any | null>(null);
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");
  const [editExpiryInfinite, setEditExpiryInfinite] = useState<boolean>(false);

  // --- Unenroll Confirmation States ---
  const [isUnenrollConfirmOpen, setIsUnenrollConfirmOpen] = useState(false);
  const [studentToUnenroll, setStudentToUnenroll] = useState<{ userId: string; studentName: string } | null>(null);
  const [isUnenrollingProgress, setIsUnenrollingProgress] = useState(false);

  const loadEnrolledStudents = async () => {
    if (!id || id === 'new') return;
    setIsLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          user_id,
          created_at,
          expires_at,
          profiles:profiles (
            id,
            name,
            nickname,
            email,
            mobile_phone,
            phone,
            role
          )
        `)
        .eq('course_id', id)
        .eq('is_deleted', false);

      if (error) throw error;
      setEnrolledStudents(data || []);
    } catch (error) {
      console.error('Error loading enrolled students:', error);
      toast.error('수강생 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const loadAllProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_deleted', false);

      if (error) throw error;
      setAllProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('회원 목록을 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleToggleStudentSelection = (userId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleEnrollSelectedMembers = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('추가할 회원을 선택해주세요.');
      return;
    }
    
    setIsAddingStudentsProgress(true);
    toast.loading(`${selectedMemberIds.length}명의 수강생을 추가하는 중...`, { id: 'adding-students' });
    
    // 계산된 expires_at 정의
    let customExpiresAt: string | null = null;
    if (isCustomStudentExpiry) {
      if (customStudentExpiryType === 'days') {
        const expiresAtDate = new Date();
        expiresAtDate.setDate(expiresAtDate.getDate() + customStudentExpiryDays);
        customExpiresAt = expiresAtDate.toISOString();
      } else if (customStudentExpiryType === 'date') {
        if (!customStudentExpiryDate) {
          toast.error('만료 일자를 선택해주세요.', { id: 'adding-students' });
          setIsAddingStudentsProgress(false);
          return;
        }
        customExpiresAt = new Date(customStudentExpiryDate).toISOString();
      }
    } else {
      // custom 수강 만료일을 수동 적용하지 않는 경우: 
      // undefined를 인수로 넘겨 `courseService.enrollCourse` 가 강의에 설정된 수강기간 속성(is_duration_based / duration_days)을 따르도록 설정
      customExpiresAt = undefined as any;
    }

    try {
      await Promise.all(
        selectedMemberIds.map(userId => courseService.enrollCourse(userId, id!, customExpiresAt))
      );
      toast.success('수강생이 성공적으로 추가되었습니다.', { id: 'adding-students' });
      setSelectedMemberIds([]);
      setIsEnrollModalOpen(false);
      setIsCustomStudentExpiry(false); // Reset
      await loadEnrolledStudents();
    } catch (error: any) {
      console.error('Enroll error:', error);
      toast.error(`수강생 추가 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`, { id: 'adding-students' });
    } finally {
      setIsAddingStudentsProgress(false);
    }
  };

  const handleOpenUnenrollConfirm = (userId: string, studentName: string) => {
    setStudentToUnenroll({ userId, studentName });
    setIsUnenrollConfirmOpen(true);
  };

  const handleUnenrollStudentConfirmed = async () => {
    if (!id || id === 'new' || !studentToUnenroll) return;
    setIsUnenrollingProgress(true);
    try {
      await courseService.unenrollCourse(studentToUnenroll.userId, id);
      toast.success(`${studentToUnenroll.studentName} 회원의 수강 권한이 회수되었습니다.`);
      setIsUnenrollConfirmOpen(false);
      setStudentToUnenroll(null);
      await loadEnrolledStudents();
    } catch (error: any) {
      toast.error(`수강권한 해제 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsUnenrollingProgress(false);
    }
  };

  const handleOpenEditExpiryModal = (student: any) => {
    setSelectedStudentForExpiry(student);
    if (student.expires_at) {
      setEditExpiryDate(new Date(student.expires_at).toISOString().split('T')[0]);
      setEditExpiryInfinite(false);
    } else {
      setEditExpiryDate(new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]);
      setEditExpiryInfinite(true);
    }
    setIsEditExpiryModalOpen(true);
  };

  const handleUpdateStudentExpiry = async () => {
    if (!id || id === 'new' || !selectedStudentForExpiry) return;
    try {
      const expiresAt = editExpiryInfinite ? null : new Date(editExpiryDate).toISOString();
      await courseService.updateEnrollmentExpiry(selectedStudentForExpiry.user_id, id, expiresAt);
      toast.success('수강 만료일이 성공적으로 수정되었습니다.');
      setIsEditExpiryModalOpen(false);
      await loadEnrolledStudents();
    } catch (error: any) {
      console.error('Update expiry error:', error);
      toast.error(`만료일 수정 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  };

  useEffect(() => {
    fetchInstructors();
    if (isEdit) {
      loadCourse();
      loadEnrolledStudents();
    } else if (user) {
      setCourseInfo((prev) => ({ ...prev, instructor: user.name || "" }));
    }
  }, [id, user]);

  const fetchInstructors = async () => {
    try {
      const data = await instructorService.getInstructors();
      setInstructors(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadCourse = async () => {
    try {
      const data = await courseService.getCourseById(id!);
      setCourseInfo({
        title: data.title || "",
        instructor_id: data.instructor_id || "",
        instructor: data.instructor || "",
        instructor_title: data.instructor_title || "",
        instructor_bio: data.instructor_bio || "",
        instructor_image: data.instructor_image || "",
        instructor_tags: data.instructor_tags || [],
        price: data.price || 0,
        discount_price: data.discount_price || 0,
        description: data.description || "",
        category: data.category || "regular",
        status: data.status || "draft",
        start_date: data.start_date || new Date().toISOString(),
        end_date: data.end_date || new Date().toISOString(),
        reg_start_date: data.reg_start_date || new Date().toISOString(),
        reg_end_date: data.reg_end_date || new Date().toISOString(),
        study_start_date: data.study_start_date || new Date().toISOString(),
        study_end_date: data.study_end_date || new Date().toISOString(),
        access_type: data.access_type || "automatic",
        min_member_grade: data.min_member_grade || null,
        thumbnail: data.thumbnail || "",
        hero_bg_color: data.hero_bg_color || "#0f172a",
        hero_text_color: data.hero_text_color || "#ffffff",
        hero_image: data.hero_image || "",
        outcomes: data.outcomes || [""],
        recommended_for: data.recommended_for || [""],
        materials: data.materials || [],
        is_free: data.is_free || false,
        max_capacity: data.max_capacity ?? null,
        is_force_closed: data.is_force_closed || false,
        is_duration_based: data.is_duration_based || false,
        duration_days: data.duration_days ?? 90,
      });
      setCurriculum(data.curriculum || []);
      setLayout(data.layout || { blocks: [] });
    } catch (error) {
      toast.error("강의 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSection = () => {
    const newSection: CurriculumSection = {
      id: crypto.randomUUID(),
      title: `새 섹션 ${curriculum.length + 1}`,
      items: [],
    };
    setCurriculum([...curriculum, newSection]);
  };

  const handleAddLesson = (sectionId: string) => {
    setCurriculum(
      curriculum.map((sec) => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            items: [
              ...sec.items,
              {
                id: crypto.randomUUID(),
                title: "새 강의",
                vimeo_id: "",
                duration: "00:00",
                is_free: false,
              },
            ],
          };
        }
        return sec;
      }),
    );
  };

  const addLayoutBlock = (type: CourseBlockType) => {
    const newBlock: CourseBlock = {
      id: crypto.randomUUID(),
      type,
      content: "",
    };
    setLayout({ blocks: [...(layout?.blocks || []), newBlock] });
  };

  const removeLayoutBlock = (id: string) => {
    setLayout({ blocks: (layout?.blocks || []).filter((b) => b.id !== id) });
  };

  const updateLayoutBlock = (id: string, updates: Partial<CourseBlock>) => {
    setLayout({
      blocks: (layout?.blocks || []).map((b) =>
        b.id === id ? { ...b, ...updates } : b,
      ),
    });
  };

  const moveLayoutBlock = (index: number, direction: "up" | "down") => {
    if (!layout?.blocks) return;
    const newBlocks = [...layout.blocks];
    if (direction === "up" && index > 0) {
      [newBlocks[index - 1], newBlocks[index]] = [
        newBlocks[index],
        newBlocks[index - 1],
      ];
    } else if (direction === "down" && index < newBlocks.length - 1) {
      [newBlocks[index + 1], newBlocks[index]] = [
        newBlocks[index],
        newBlocks[index + 1],
      ];
    }
    setLayout({ blocks: newBlocks });
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const publicUrl = await storageService.uploadImage(file);
      setCourseInfo({ ...courseInfo, thumbnail: publicUrl });
      toast.success("썸네일이 업로드되었습니다.");
    } catch (error) {
      toast.error("썸네일 업로드에 실패했습니다.");
    }
  };

  const handleBlockImageUpload = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const publicUrl = await storageService.uploadImage(file);
      updateLayoutBlock(blockId, { content: publicUrl });
      toast.success("블록 이미지가 업로드되었습니다.");
    } catch (error) {
      toast.error("블록 이미지 업로드에 실패했습니다.");
    }
  };

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading("강의 자료 업로드 중...", { id: "upload" });
      const { url, name, size } = await storageService.uploadFile(file);
      const newMaterial: CourseMaterial = {
        id: crypto.randomUUID(),
        name,
        url,
        size,
        created_at: new Date().toISOString(),
      };
      setCourseInfo({
        ...courseInfo,
        materials: [...courseInfo.materials, newMaterial],
      });
      toast.success("강의 자료가 업로드되었습니다.", { id: "upload" });
    } catch (error) {
      toast.error("강의 자료 업로드에 실패했습니다.", { id: "upload" });
    }
  };

  const removeMaterial = (id: string) => {
    setCourseInfo({
      ...courseInfo,
      materials: courseInfo.materials.filter((m) => m.id !== id),
    });
  };

  const handleSave = async () => {
    try {
      if (!courseInfo.title.trim()) {
        toast.error("강의 제목을 입력해주세요.");
        return;
      }

      setSaving(true);
      
      // instructor_id가 존재하지 않거나 유효하지 않은 경우 null로 처리
      let finalInstructorId = courseInfo.instructor_id;
      if (!finalInstructorId || finalInstructorId.trim() === "" || finalInstructorId === "null" || finalInstructorId === "undefined") {
        finalInstructorId = null;
      }

      const payload: Partial<Course> = {
        ...courseInfo,
        instructor_id: finalInstructorId,
        curriculum,
        layout,
      };

      console.log("Saving course with payload:", payload);

      if (isEdit) {
        await courseService.updateCourse(id!, payload);
        toast.success("강의가 성공적으로 수정되었습니다.");
      } else {
        await courseService.createCourse(payload);
        toast.success("새 강의가 성공적으로 등록되었습니다.");
      }
      navigate("/admin/courses");
    } catch (error: any) {
      console.error("Save error details:", error);
      toast.error(`저장에 실패했습니다: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center">로딩 중...</div>;

  const enrolledUserIds = new Set(enrolledStudents.map(s => s.user_id));
  const availableMembers = allProfiles.filter(p => !enrolledUserIds.has(p.id));
  
  const filteredAvailableMembers = availableMembers.filter(p => {
    const q = memberSearchQuery.toLowerCase();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const nicknameMatch = (p.nickname || '').toLowerCase().includes(q);
    const emailMatch = (p.email || '').toLowerCase().includes(q);
    const phoneMatch = (p.mobile_phone || p.phone || '').includes(q);
    return nameMatch || nicknameMatch || emailMatch || phoneMatch;
  });

  const isAllFilteredSelected = filteredAvailableMembers.length > 0 && filteredAvailableMembers.every(m => selectedMemberIds.includes(m.id));
  const handleSelectAllToggle = () => {
    if (isAllFilteredSelected) {
      setSelectedMemberIds(prev => prev.filter(id => !filteredAvailableMembers.some(m => m.id === id)));
    } else {
      const newSelects = [...selectedMemberIds];
      filteredAvailableMembers.forEach(m => {
        if (!newSelects.includes(m.id)) {
          newSelects.push(m.id);
        }
      });
      setSelectedMemberIds(newSelects);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/courses")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">
                {isEdit ? "강의 수정" : "새 강의 등록"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Save className="h-4 w-4" /> {saving ? "저장 중..." : "저장하기"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="basic" className="w-full">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 min-w-0 space-y-8">
              {/* Scrollable Tabs List */}
              <div className="relative group">
                <TabsList className="flex w-full justify-start h-auto bg-gray-100/50 rounded-xl p-1 gap-1 overflow-x-auto scrollbar-hide">
                  <TabsTrigger 
                    value="basic" 
                    className="flex-shrink-0 min-w-[100px] rounded-lg py-2.5 px-4 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    기본 정보
                  </TabsTrigger>
                  <TabsTrigger 
                    value="curriculum" 
                    className="flex-shrink-0 min-w-[100px] rounded-lg py-2.5 px-4 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    커리큘럼
                  </TabsTrigger>
                  <TabsTrigger 
                    value="design" 
                    className="flex-shrink-0 min-w-[100px] rounded-lg py-2.5 px-4 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    디자인 블록
                  </TabsTrigger>
                  <TabsTrigger 
                    value="materials" 
                    className="flex-shrink-0 min-w-[100px] rounded-lg py-2.5 px-4 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    강의 자료
                  </TabsTrigger>
                  <TabsTrigger 
                    value="access" 
                    className="flex-shrink-0 min-w-[100px] rounded-lg py-2.5 px-4 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    접수/수강기간
                  </TabsTrigger>
                  <TabsTrigger 
                    value="students" 
                    className="flex-shrink-0 min-w-[100px] rounded-lg py-2.5 px-4 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    수강생 관리
                  </TabsTrigger>
                </TabsList>
                {/* Visual hint for more tabs */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100/50 to-transparent pointer-events-none lg:hidden" />
              </div>

              <div className="w-full">
                <TabsContent value="basic" className="mt-0 space-y-6">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>강의 기본 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>강의 제목</Label>
                      <Input
                        value={courseInfo.title || ''}
                        onChange={(e) =>
                          setCourseInfo({
                            ...courseInfo,
                            title: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>강사 선택</Label>
                          <Button variant="link" size="sm" onClick={() => navigate('/admin/instructors')} className="h-auto p-0 text-xs">강사 관리 바로가기</Button>
                        </div>
                        <Select
                          value={courseInfo.instructor_id || ""}
                          onValueChange={(val) => {
                            const inst = instructors.find(i => i.id === val);
                            setCourseInfo({ 
                              ...courseInfo, 
                              instructor_id: val,
                              instructor: inst?.name || "",
                              instructor_title: inst?.title || "",
                              instructor_bio: inst?.bio || "",
                              instructor_image: inst?.image_url || "",
                              instructor_tags: inst?.tags || []
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="강사를 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            {instructors.map(inst => (
                              <SelectItem key={inst.id} value={inst.id}>{inst.name} ({inst.title})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>카테고리</Label>
                        <Select
                          value={courseInfo.category || '기본'}
                          onValueChange={(val) => {
                            const isBeOne = val === 'beone_exclusive_online' || val === 'beone_exclusive_offline';
                            setCourseInfo({ 
                              ...courseInfo, 
                              category: val,
                              ...(isBeOne ? {
                                access_type: 'manual',
                                is_free: true,
                                price: 0,
                                discount_price: 0,
                                min_member_grade: courseInfo.min_member_grade || 'bione_member'
                              } : {})
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">정규강의</SelectItem>
                            <SelectItem value="special_online">온라인 특강</SelectItem>
                            <SelectItem value="special_offline">오프라인 특강</SelectItem>
                            <SelectItem value="beone_exclusive_online">온라인 비원커뮤니티회원전용</SelectItem>
                            <SelectItem value="beone_exclusive_offline">오프라인 비원커뮤니티회원전용</SelectItem>
                            <SelectItem value="live">비원아카데미 라이브</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {(courseInfo.category === 'beone_exclusive_online' || courseInfo.category === 'beone_exclusive_offline') && (
                        <div className="space-y-2">
                          <Label>수강 가능 회원 등급</Label>
                          <Select
                            value={courseInfo.min_member_grade || 'bione_member'}
                            onValueChange={(val) =>
                              setCourseInfo({ ...courseInfo, min_member_grade: val })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="회원 등급 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bione_member">비원아카데미 회원</SelectItem>
                              <SelectItem value="paid_member">유료 회원</SelectItem>
                              <SelectItem value="regular_member">일반 회원</SelectItem>
                              <SelectItem value="user">회원</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-purple-600 font-bold">선택하신 등급과 같거나 높은 등급을 가진 회원이 강의 진행 및 비원 전용 컨텐츠 학습을 시작할 수 있습니다.</p>
                        </div>
                      )}

                      {(courseInfo.category === 'special_offline' || courseInfo.category === 'beone_exclusive_offline') && (
                        <div className="space-y-2">
                          <Label>수강 최대 정원 (명)</Label>
                          <Input
                            type="number"
                            value={courseInfo.max_capacity || ""}
                            onChange={(e) =>
                              setCourseInfo({
                                ...courseInfo,
                                max_capacity: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            placeholder="무제한일 경우 비워두세요"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>수강권 부여 방식</Label>
                        <Select
                          value={courseInfo.access_type}
                          disabled={courseInfo.category === 'beone_exclusive_online' || courseInfo.category === 'beone_exclusive_offline'}
                          onValueChange={(val) =>
                            setCourseInfo({ ...courseInfo, access_type: val })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="automatic">
                              자동승인 (결제시)
                            </SelectItem>
                            <SelectItem value="manual">
                              수동승인 (관리자)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {(courseInfo.category === 'beone_exclusive_online' || courseInfo.category === 'beone_exclusive_offline') && (
                          <p className="text-xs text-amber-600 font-bold">비원커뮤니티회원전용 강의는 수동승인(관리자) 방식만 적용 가능합니다.</p>
                        )}
                      </div>

                      {!(courseInfo.category === 'beone_exclusive_online' || courseInfo.category === 'beone_exclusive_offline') && (
                        <div className="space-y-2">
                          <Label>유료/무료 설정</Label>
                          <div className="flex items-center space-x-2 pt-2">
                            <Switch 
                              checked={courseInfo.is_free} 
                              onCheckedChange={(checked) => setCourseInfo({...courseInfo, is_free: checked, price: checked ? 0 : courseInfo.price})} 
                            />
                            <span className="text-sm font-medium">{courseInfo.is_free ? '무료 강의' : '유료 강의'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                {!(courseInfo.category === 'beone_exclusive_online' || courseInfo.category === 'beone_exclusive_offline') && !courseInfo.is_free && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>가격 (원)</Label>
                        <Input
                          type="number"
                          value={courseInfo.price || 0}
                          onChange={(e) =>
                            setCourseInfo({
                              ...courseInfo,
                              price: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>할인가격 (원)</Label>
                        <Input
                          type="number"
                          value={courseInfo.discount_price || 0}
                          onChange={(e) =>
                            setCourseInfo({
                              ...courseInfo,
                              discount_price: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                )}
                    <div className="space-y-4 lg:col-span-2">
                      <Label>썸네일 이미지 URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={courseInfo.thumbnail || ''}
                          onChange={(e) =>
                            setCourseInfo({
                              ...courseInfo,
                              thumbnail: e.target.value,
                            })
                          }
                          placeholder="https://example.com/image.jpg"
                          className="flex-1"
                        />
                        <Label htmlFor="thumbnail-upload" className="cursor-pointer shrink-0">
                          <div className="border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-md inline-flex items-center justify-center text-sm font-medium">
                            이미지 업로드
                          </div>
                        </Label>
                        <input
                          type="file"
                          id="thumbnail-upload"
                          className="hidden"
                          accept="image/*"
                          onChange={handleThumbnailUpload}
                        />
                      </div>
                      {courseInfo.thumbnail && (
                        <div className="rounded-xl overflow-hidden aspect-video border relative">
                          <img
                            src={courseInfo.thumbnail}
                            alt="Thumbnail preview"
                            className="object-cover w-full h-full"
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <Label>요약 설명</Label>
                      <Textarea
                        className="min-h-[100px]"
                        value={courseInfo.description || ''}
                        onChange={(e) =>
                          setCourseInfo({
                            ...courseInfo,
                            description: e.target.value,
                          })
                        }
                        placeholder="강의 목록과 배너에 노출될 짧은 요약 설명을 적어주세요."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

<TabsContent value="curriculum" className="mt-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">커리큘럼</h3>
                  <Button onClick={handleAddSection} size="sm">
                    <Plus className="w-4 h-4 mr-2" /> 섹션 추가
                  </Button>
                </div>
                {curriculum.map((section) => (
                  <Card
                    key={section.id}
                    className="overflow-hidden border-none shadow-sm"
                  >
                    <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                      <div className="flex-1 flex items-center gap-2">
                        <Label className="shrink-0 text-gray-500">섹션 제목:</Label>
                        <Input
                          value={section.title}
                          className="bg-white font-bold w-1/2"
                          onChange={(e) =>
                            setCurriculum(
                              curriculum.map((s) =>
                                s.id === section.id
                                  ? { ...s, title: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddLesson(section.id)}
                          className="text-purple-600 hover:text-purple-700 font-bold"
                        >
                          <Plus className="w-4 h-4 mr-1" /> 강의 추가
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCurriculum(curriculum.filter(s => s.id !== section.id))}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-0 divide-y">
                      {section.items.map((item) => (
                        <div key={item.id} className="p-4 space-y-4 group">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 grid grid-cols-2 gap-4">
                              <Input
                                placeholder="강의 제목"
                                value={item.title}
                                onChange={(e) => {
                                  setCurriculum(
                                    curriculum.map((s) => {
                                      if (s.id === section.id) {
                                        return {
                                          ...s,
                                          items: s.items.map((i) =>
                                            i.id === item.id
                                              ? { ...i, title: e.target.value }
                                              : i,
                                          ),
                                        };
                                      }
                                      return s;
                                    }),
                                  );
                                }}
                              />
                              <Input
                                placeholder="Vimeo 동영상 주소 또는 ID"
                                value={item.vimeo_id}
                                onChange={async (e) => {
                                  const vId = extractVimeoId(e.target.value);
                                  const duration = await fetchVimeoDuration(vId);
                                  setCurriculum(
                                    curriculum.map((s) => {
                                      if (s.id === section.id) {
                                        return {
                                          ...s,
                                          items: s.items.map((i) =>
                                            i.id === item.id
                                              ? { ...i, vimeo_id: vId, duration }
                                              : i,
                                          ),
                                        };
                                      }
                                      return s;
                                    }),
                                  );
                                }}
                              />
                              <Input
                                placeholder="길이 (예: 12:34)"
                                value={item.duration || ""}
                                onChange={(e) => {
                                  setCurriculum(
                                    curriculum.map((s) => {
                                      if (s.id === section.id) {
                                        return {
                                          ...s,
                                          items: s.items.map((i) =>
                                            i.id === item.id
                                              ? { ...i, duration: e.target.value }
                                              : i,
                                          ),
                                        };
                                      }
                                      return s;
                                    }),
                                  );
                                }}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCurriculum(
                                  curriculum.map(s => {
                                    if (s.id === section.id) {
                                      return {
                                        ...s,
                                        items: s.items.filter(i => i.id !== item.id)
                                      };
                                    }
                                    return s;
                                  })
                                );
                              }}
                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="design" className="mt-6 space-y-6">
                <Card className="border-none shadow-sm animate-fade-in">
                  <CardHeader>
                    <CardTitle>HERO 영역 디자인</CardTitle>
                    <CardDescription>강의 상세 페이지 최상단 HERO 섹션의 스타일을 수정합니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <Label>HERO 배경 이미지 URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={courseInfo.hero_image || ''}
                          onChange={(e) =>
                            setCourseInfo({
                              ...courseInfo,
                              hero_image: e.target.value,
                            })
                          }
                          placeholder="https://..."
                          className="flex-1"
                        />
                        <Label htmlFor="hero-image-upload" className="cursor-pointer shrink-0">
                          <div className="border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-md inline-flex items-center justify-center text-sm font-medium">
                            이미지 업로드
                          </div>
                        </Label>
                        <input
                          type="file"
                          id="hero-image-upload"
                          className="hidden"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const url = await storageService.uploadImage(file);
                                setCourseInfo({...courseInfo, hero_image: url});
                                toast.success("이미지가 업로드되었습니다.");
                              } catch (err) {
                                toast.error("업로드 실패");
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>배경색 (HEX)</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            className="w-12 p-1" 
                            value={courseInfo.hero_bg_color || '#000000'} 
                            onChange={(e) => setCourseInfo({...courseInfo, hero_bg_color: e.target.value})}
                          />
                          <Input 
                            value={courseInfo.hero_bg_color} 
                            onChange={(e) => setCourseInfo({...courseInfo, hero_bg_color: e.target.value})}
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>텍스트 색상 (HEX)</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            className="w-12 p-1" 
                            value={courseInfo.hero_text_color || '#ffffff'} 
                            onChange={(e) => setCourseInfo({...courseInfo, hero_text_color: e.target.value})}
                          />
                          <Input 
                            value={courseInfo.hero_text_color} 
                            onChange={(e) => setCourseInfo({...courseInfo, hero_text_color: e.target.value})}
                            placeholder="#FFFFFF"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-10 rounded-3xl border border-dashed text-center relative overflow-hidden" style={{ backgroundColor: courseInfo.hero_bg_color, color: courseInfo.hero_text_color }}>
                      {courseInfo.hero_image && (
                        <img src={courseInfo.hero_image} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="" />
                      )}
                      <div className="relative z-10">
                        <p className="text-sm opacity-60 mb-2">프리뷰 영역</p>
                        <h3 className="text-3xl font-black">{courseInfo.title || "강의 제목"}</h3>
                        <p className="mt-4 opacity-80">강사: {courseInfo.instructor}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between items-center pt-6 border-t">
                  <div>
                    <h3 className="text-lg font-bold">
                      강의 상세페이지 디자인 (블록 구성)
                    </h3>
                    <p className="text-sm text-gray-500">
                      랜딩페이지 역할을 할 상세 화면을 블록 조합으로 구성합니다.
                    </p>
                  </div>
                  <Popover>
                    <PopoverTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3">
                      <Plus className="w-4 h-4 mr-2" /> 구성요소 추가
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-48 p-2">
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          className="justify-start font-normal"
                          onClick={() => addLayoutBlock("heading")}
                        >
                          <FileText className="w-4 h-4 mr-2 text-gray-500" />{" "}
                          제목 (Heading)
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start font-normal"
                          onClick={() => addLayoutBlock("image")}
                        >
                          <Upload className="w-4 h-4 mr-2 text-blue-500" />{" "}
                          이미지 (Image)
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start font-normal"
                          onClick={() => addLayoutBlock("video")}
                        >
                          <Video className="w-4 h-4 mr-2 text-red-500" /> 비디오
                          (Vimeo)
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start font-normal"
                          onClick={() => addLayoutBlock("text")}
                        >
                          <FileText className="w-4 h-4 mr-2 text-gray-500" />{" "}
                          텍스트 (Text)
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-4">
                  {layout?.blocks?.map((block, index) => (
                    <Card key={block.id} className="relative border shadow-sm">
                      <div className="absolute left-[-16px] top-1/2 -translate-y-1/2 text-gray-300 cursor-move">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div className="bg-gray-50/50 p-2 px-4 border-b flex justify-between items-center text-sm font-medium text-gray-600">
                        <div className="flex items-center gap-2">
                          {block.type === "heading" && (
                            <FileText className="w-4 h-4" />
                          )}
                          {block.type === "image" && (
                            <Upload className="w-4 h-4" />
                          )}
                          {block.type === "video" && (
                            <Video className="w-4 h-4" />
                          )}
                          {block.type === "text" && (
                            <FileText className="w-4 h-4" />
                          )}
                          <span className="capitalize">{block.type} 블록</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-gray-900"
                            onClick={() => moveLayoutBlock(index, "up")}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-gray-900"
                            onClick={() => moveLayoutBlock(index, "down")}
                            disabled={index === layout.blocks.length - 1}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removeLayoutBlock(block.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        {block.type === "heading" && (
                          <Input
                            placeholder="제목을 입력하세요"
                            className="font-bold text-lg"
                            value={block.content}
                            onChange={(e) =>
                              updateLayoutBlock(block.id, {
                                content: e.target.value,
                              })
                            }
                          />
                        )}
                        {block.type === "text" && (
                          <Textarea
                            placeholder="상세 내용을 작성하세요"
                            className="min-h-[120px]"
                            value={block.content}
                            onChange={(e) =>
                              updateLayoutBlock(block.id, {
                                content: e.target.value,
                              })
                            }
                          />
                        )}
                        {block.type === "image" && (
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <Input
                                placeholder="이미지 URL을 입력하세요"
                                value={block.content}
                                onChange={(e) =>
                                  updateLayoutBlock(block.id, {
                                    content: e.target.value,
                                  })
                                }
                                className="flex-1"
                              />
                              <Label htmlFor={`block-img-${block.id}`} className="cursor-pointer shrink-0">
                                <div className="border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-md inline-flex items-center justify-center text-sm font-medium">
                                  이미지 업로드
                                </div>
                              </Label>
                              <input
                                type="file"
                                id={`block-img-${block.id}`}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleBlockImageUpload(block.id, e)}
                              />
                            </div>
                            {block.content && (
                              <div className="rounded-lg overflow-hidden border max-w-sm">
                                <img
                                  src={block.content}
                                  alt=""
                                  className="w-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        )}
                        {block.type === "video" && (
                          <div className="space-y-3">
                            <Input
                              placeholder="Vimeo 동영상 주소 또는 ID를 입력하세요"
                              value={block.content}
                              onChange={(e) =>
                                updateLayoutBlock(block.id, {
                                  content: extractVimeoId(e.target.value),
                                })
                              }
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {(!layout?.blocks || layout.blocks.length === 0) && (
                    <div className="text-center py-12 px-4 border-2 border-dashed rounded-xl border-gray-200">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h4 className="text-sm font-medium text-gray-900 mb-1">
                        상세페이지가 비어있습니다
                      </h4>
                      <p className="text-sm text-gray-500">
                        구성요소 추가 버튼을 눌러 멋진 홈페이지를
                        디자인해보세요.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="materials" className="mt-6 space-y-6">
                <Card className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>강의 자료 관리</CardTitle>
                      <CardDescription>수강생들이 다운로드할 수 있는 강의 자료를 업로드합니다.</CardDescription>
                    </div>
                    <div>
                      <Label htmlFor="material-upload" className="cursor-pointer">
                        <div className="bg-purple-600 hover:bg-purple-700 text-white h-9 px-4 rounded-md inline-flex items-center justify-center text-sm font-medium gap-2">
                          <Plus className="w-4 h-4" /> 파일 추가
                        </div>
                      </Label>
                      <input
                        type="file"
                        id="material-upload"
                        className="hidden"
                        onChange={handleMaterialUpload}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {courseInfo.materials && courseInfo.materials.length > 0 ? (
                        courseInfo.materials.map((file) => (
                          <div 
                            key={file.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border shadow-sm">
                                <FileText className="w-5 h-5 text-gray-400" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">{file.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 font-medium">
                                    {(file.size ? (file.size / (1024 * 1024)).toFixed(2) : 0)} MB
                                  </span>
                                  <span className="text-[10px] text-gray-300">•</span>
                                  <span className="text-[10px] text-gray-500 font-medium">
                                    {file.created_at ? format(new Date(file.created_at), 'yyyy.MM.dd') : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => window.open(file.url, '_blank')}
                                className="h-8 w-8 text-gray-400 hover:text-blue-500"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => removeMaterial(file.id)}
                                className="h-8 w-8 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed rounded-3xl border-gray-100">
                          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                          <p className="text-sm text-gray-400 font-medium">업로드된 교안이 없습니다.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="access" className="mt-6 space-y-6">
                <Card className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>접수 및 수강 기간 설정</CardTitle>
                      <CardDescription>강의의 접수 마감 및 수강 기간을 관리합니다.</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-bold text-gray-500">강의 강제 마감</Label>
                      <Switch 
                        checked={courseInfo.is_force_closed}
                        onCheckedChange={(checked) => setCourseInfo({...courseInfo, is_force_closed: checked})}
                        className="data-[state=checked]:bg-red-500"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-purple-600" /> 접수 기간 (수강신청 가능 기간)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-400 px-1">접수 시작일</p>
                          <Input
                            type="date"
                            value={courseInfo.reg_start_date.split("T")[0]}
                            onChange={(e) =>
                              setCourseInfo({
                                ...courseInfo,
                                reg_start_date: new Date(e.target.value).toISOString(),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-400 px-1">접수 마감일</p>
                          <Input
                            type="date"
                            value={courseInfo.reg_end_date.split("T")[0]}
                            onChange={(e) =>
                              setCourseInfo({
                                ...courseInfo,
                                reg_end_date: new Date(e.target.value).toISOString(),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> 수강 기간 (강의 시청 가능 기간)</Label>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm cursor-pointer" htmlFor="is_duration_based">기간제 강의 (결제일 기준)</Label>
                          <Switch 
                            id="is_duration_based"
                            checked={courseInfo.is_duration_based}
                            onCheckedChange={(checked) => setCourseInfo({...courseInfo, is_duration_based: checked})}
                          />
                        </div>
                      </div>

                      {courseInfo.is_duration_based ? (
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between gap-6">
                          <div className="space-y-1">
                            <p className="font-bold text-blue-900">기간제 수강 설정</p>
                            <p className="text-sm text-blue-700">결제(승인)일로부터 설정된 일수만큼 수강이 가능합니다.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Label className="shrink-0 font-bold">수강 가능 일수:</Label>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number"
                                className="w-24 bg-white font-bold"
                                value={courseInfo.duration_days || ""}
                                onChange={(e) => setCourseInfo({...courseInfo, duration_days: Number(e.target.value)})}
                              />
                              <span className="font-bold">일</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-400 px-1">수강 시작일</p>
                            <Input
                              type="date"
                              value={courseInfo.start_date.split("T")[0]}
                              onChange={(e) =>
                                setCourseInfo({
                                  ...courseInfo,
                                  start_date: new Date(e.target.value).toISOString(),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-400 px-1">수강 종료일</p>
                            <Input
                              type="date"
                              value={courseInfo.end_date.split("T")[0]}
                              onChange={(e) =>
                                setCourseInfo({
                                  ...courseInfo,
                                  end_date: new Date(e.target.value).toISOString(),
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="students" className="mt-6 space-y-6">
                {!isEdit ? (
                  <Card className="border-none shadow-sm">
                    <CardContent className="py-20 text-center text-gray-500">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-pulse" />
                      <p className="font-bold text-gray-700 text-lg">새 강의 등록 후 수강생 관리 가능</p>
                      <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                        수강생 지정 및 대량 추가 기능은 강의를 먼저 저장하여 생성 완료한 후 편집 화면에서 사용하실 수 있습니다.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card className="border-none shadow-sm">
                      <CardHeader className="flex flex-row items-center justify-between col-span-2">
                        <div>
                          <CardTitle className="text-lg">수강생 목록 ({enrolledStudents.length}명)</CardTitle>
                          <CardDescription>현재 이 강의를 시청할 권한을 가진 수강생 목록입니다.</CardDescription>
                        </div>
                        <Button 
                          onClick={() => {
                            setMemberSearchQuery("");
                            setSelectedMemberIds([]);
                            loadAllProfiles();
                            setIsEnrollModalOpen(true);
                          }} 
                          className="bg-purple-600 hover:bg-purple-700 gap-2 h-10 px-4 rounded-xl font-bold"
                          type="button"
                        >
                          <UserPlus className="w-4 h-4" /> 수강생 추가하기
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0 border-t border-gray-100">
                        {isLoadingStudents ? (
                          <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                            <p className="text-gray-500 font-medium text-sm">수강생 정보를 불러오는 중입니다...</p>
                          </div>
                        ) : enrolledStudents.length === 0 ? (
                          <div className="py-24 text-center flex flex-col items-center justify-center text-gray-500 select-none">
                            <Users className="w-12 h-12 text-gray-200 mb-3" />
                            <p className="font-bold text-gray-600">수강 중인 학생이 없습니다.</p>
                            <p className="text-sm text-gray-400 mt-1">우측 상단의 '수강생 추가하기' 버튼을 눌러 회원을 등록해 보세요.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                  <th className="px-6 py-4 text-left font-bold text-gray-600">이름 (닉네임)</th>
                                  <th className="px-6 py-4 text-left font-bold text-gray-600">이메일</th>
                                  <th className="px-6 py-4 text-left font-bold text-gray-600">휴대폰 번호</th>
                                  <th className="px-6 py-4 text-left font-bold text-gray-600">수강 등록일</th>
                                  <th className="px-6 py-4 text-left font-bold text-gray-600">수강 만료일</th>
                                  <th className="px-6 py-4 text-right font-bold text-gray-600">관리</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {enrolledStudents.map((student) => {
                                  const profile = student.profiles || {};
                                  const isExpired = student.expires_at ? new Date(student.expires_at) < new Date() : false;
                                  return (
                                    <tr key={student.id} className="hover:bg-gray-50/30 transition-colors">
                                      <td className="px-6 py-4">
                                        <div className="font-black text-gray-900 text-sm">
                                          {profile.name || '알 수 없는 사용자'} {profile.nickname ? `(${profile.nickname})` : ''}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-gray-500 font-medium whitespace-nowrap">
                                        {profile.email || '-'}
                                      </td>
                                      <td className="px-6 py-4 text-gray-500 font-medium whitespace-nowrap">
                                        {profile.mobile_phone || profile.phone || '-'}
                                      </td>
                                      <td className="px-6 py-4 text-gray-500 font-medium text-xs whitespace-nowrap">
                                        {student.created_at ? new Date(student.created_at).toLocaleDateString() : '-'}
                                      </td>
                                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                                        {student.expires_at ? (
                                          <div className="flex flex-col gap-1">
                                            <span className="font-semibold text-gray-700">
                                              {new Date(student.expires_at).toLocaleDateString()}
                                            </span>
                                            {isExpired ? (
                                              <Badge className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-50 text-[10px] w-fit font-bold rounded-lg px-2 py-0.5">
                                                수강 만료됨
                                              </Badge>
                                            ) : (
                                              <Badge className="bg-green-50 text-green-600 border border-green-100 hover:bg-green-50 text-[10px] w-fit font-bold rounded-lg px-2 py-0.5">
                                                수강중
                                              </Badge>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 font-medium">제한 없음 (상시)</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="text-purple-600 border-purple-100 hover:bg-purple-50 font-bold h-8 rounded-lg text-xs"
                                            onClick={() => handleOpenEditExpiryModal(student)}
                                            type="button"
                                          >
                                            <Clock className="w-3.5 h-3.5 mr-1" /> 기간 수정
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold h-8 rounded-lg text-xs"
                                            onClick={() => handleOpenUnenrollConfirm(student.user_id, profile.name || '수강생')}
                                            type="button"
                                          >
                                            수강 해제
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* 수강 해제(취소) 확인 대화상자 */}
                    <Dialog open={isUnenrollConfirmOpen} onOpenChange={setIsUnenrollConfirmOpen}>
                      <DialogContent className="max-w-md rounded-3xl p-6 bg-white gap-6">
                        <DialogHeader className="gap-2">
                          <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <span className="text-red-600">⚠️ 수강 권한 회수</span>
                          </DialogTitle>
                          <DialogDescription className="text-sm font-medium text-gray-400">
                            '{studentToUnenroll?.studentName}' 회원의 수강권한을 정말로 해제하시겠습니까?
                          </DialogDescription>
                        </DialogHeader>

                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-xs text-red-600 font-medium font-sans">
                          <p className="font-bold mb-1">💡 중요 안내</p>
                          수강 권한이 회수되면 해당 회원은 더 이상 이 강의의 동영상을 시청하거나 커리큘럼에 접근할 수 없게 됩니다.
                        </div>

                        <DialogFooter className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setIsUnenrollConfirmOpen(false);
                              setStudentToUnenroll(null);
                            }}
                            className="font-bold h-11 px-5 rounded-xl text-gray-500 hover:bg-gray-50 bg-transparent"
                            type="button"
                          >
                            취소
                          </Button>
                          <Button
                            onClick={handleUnenrollStudentConfirmed}
                            disabled={isUnenrollingProgress}
                            className="font-bold h-11 px-6 rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/10"
                            type="button"
                          >
                            {isUnenrollingProgress ? "해제 중..." : "수강권 회수"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* 개별 수강 기간 수정 대화상자 */}
                    <Dialog open={isEditExpiryModalOpen} onOpenChange={setIsEditExpiryModalOpen}>
                      <DialogContent className="max-w-md rounded-3xl p-6 bg-white gap-6">
                        <DialogHeader className="gap-2">
                          <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-purple-600" /> 수강 기간 수정
                          </DialogTitle>
                          <DialogDescription className="text-sm font-medium text-gray-400">
                            '{selectedStudentForExpiry?.profiles?.name || '수강생'}' 수강생의 수강 기간을 임의로 변경합니다.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                            <div className="space-y-0.5">
                              <span className="font-bold text-sm text-purple-950">제한 없음 (상시)</span>
                              <p className="text-xs text-purple-600 font-semibold">만료 기한 없이 무제한으로 시청 가능한 상태로 바꿉니다.</p>
                            </div>
                            <Switch
                              checked={editExpiryInfinite}
                              onCheckedChange={(checked) => setEditExpiryInfinite(checked)}
                              className="data-[state=checked]:bg-purple-600"
                            />
                          </div>

                          {!editExpiryInfinite && (
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-gray-700">새 수강 만료 일자</Label>
                              <Input
                                type="date"
                                className="h-11 bg-gray-50/50 border-gray-100 focus-visible:ring-purple-600 font-bold text-sm text-gray-900"
                                value={editExpiryDate}
                                onChange={(e) => setEditExpiryDate(e.target.value)}
                              />
                            </div>
                          )}
                        </div>

                        <DialogFooter className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                          <Button
                            variant="ghost"
                            onClick={() => setIsEditExpiryModalOpen(false)}
                            className="font-bold h-11 px-5 rounded-xl text-gray-500 hover:bg-gray-50 bg-transparent"
                            type="button"
                          >
                            취소
                          </Button>
                          <Button
                            onClick={handleUpdateStudentExpiry}
                            className="font-bold h-11 px-6 rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-600/10"
                            type="button"
                          >
                            만료일 저장
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isEnrollModalOpen} onOpenChange={(open) => { if(!open) { setIsEnrollModalOpen(false); setSelectedMemberIds([]); } }}>
                      <DialogContent className="max-w-3xl rounded-3xl p-6 bg-white gap-6">
                        <DialogHeader className="gap-2">
                          <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-purple-600" /> 수강생 추가하기
                          </DialogTitle>
                          <DialogDescription className="text-sm font-medium text-gray-400">
                            체크박스를 선택한 후 하단의 '선택 완료 및 추가' 버튼을 눌러 수강생을 등록합니다.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="이름, 닉네임, 이메일, 휴대폰 번호로 검색..."
                            className="pl-11 h-12 bg-gray-50/50 border-gray-100 rounded-2xl focus-visible:ring-purple-600 font-medium"
                            value={memberSearchQuery}
                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                            type="text"
                          />
                        </div>

                        <div className="border border-gray-100 rounded-3xl overflow-hidden bg-gray-50/20 max-h-[400px] overflow-y-auto">
                          {filteredAvailableMembers.length === 0 ? (
                            <div className="py-16 text-center text-gray-400 font-medium">
                              검색 결과와 일치하는 대상이 없거나 이미 모든 회원이 등록되었습니다.
                            </div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50/80 sticky top-0 border-b border-gray-100 z-10">
                                <tr className="backdrop-blur-sm">
                                  <th className="px-6 py-3 w-12 text-left">
                                    <Checkbox 
                                      checked={isAllFilteredSelected}
                                      onCheckedChange={handleSelectAllToggle}
                                      className="border-gray-300 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                    />
                                  </th>
                                  <th className="px-6 py-3 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">이름 (닉네임)</th>
                                  <th className="px-6 py-3 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">이메일</th>
                                  <th className="px-6 py-3 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">휴대폰 번호</th>
                                  <th className="px-6 py-3 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">역할</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredAvailableMembers.map((member) => (
                                  <tr 
                                    key={member.id} 
                                    className="hover:bg-purple-50/10 cursor-pointer transition-colors"
                                    onClick={() => handleToggleStudentSelection(member.id)}
                                  >
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                      <Checkbox 
                                        checked={selectedMemberIds.includes(member.id)}
                                        onCheckedChange={() => handleToggleStudentSelection(member.id)}
                                        className="border-gray-300 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                      />
                                    </td>
                                    <td className="px-6 py-4 font-black text-gray-800">
                                      {member.name || '이름 없음'} {member.nickname ? `(${member.nickname})` : ''}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 font-medium">
                                      {member.email || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 font-medium">
                                      {member.mobile_phone || member.phone || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-semibold">
                                      <Badge variant="outline" className={member.role === 'admin' || member.role === 'super_admin' ? 'text-red-600 bg-red-50 border-red-100' : 'text-gray-500 bg-gray-50'}>
                                        {member.role === 'admin' ? '관리자' : member.role === 'super_admin' ? '최고 관리자' : '일반 회원'}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {/* 회원별 수강 기간 설정 (대량 일괄 추가용) */}
                        <div className="bg-purple-50/40 p-5 rounded-2xl border border-purple-100 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <h4 className="font-bold text-sm text-purple-900 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-purple-600" /> 회원별 수강 기간 개설 설정 (개별/대량)
                              </h4>
                              <p className="text-xs text-purple-700 font-medium">
                                해당 회원들에게 수강 등록 시 적용할 수 있는 개별 기간제 만료 일자를 수동으로 지정합니다.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-purple-600">{isCustomStudentExpiry ? "개별 설정 적용함" : "강의 기본 수강기간 적용"}</span>
                              <Switch
                                checked={isCustomStudentExpiry}
                                onCheckedChange={(checked) => setIsCustomStudentExpiry(checked)}
                                className="data-[state=checked]:bg-purple-600"
                              />
                            </div>
                          </div>

                          {isCustomStudentExpiry && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-purple-100/50">
                              <div className="space-y-2">
                                <Label className="text-xs font-bold text-purple-950">설정 방식</Label>
                                <Select
                                  value={customStudentExpiryType}
                                  onValueChange={(val: 'days' | 'date') => setCustomStudentExpiryType(val)}
                                >
                                  <SelectTrigger className="bg-white border-purple-100 h-10 text-xs text-purple-950">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="days" className="text-xs">수강 승인일로부터 N일간 시청 제공</SelectItem>
                                    <SelectItem value="date" className="text-xs font-bold">특정 고정 만료일자로 한계 지정</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                {customStudentExpiryType === 'days' ? (
                                  <>
                                    <Label className="text-xs font-bold text-purple-950">제공 기간 (일수)</Label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        className="h-10 bg-white border-purple-100 font-bold"
                                        value={customStudentExpiryDays || ""}
                                        onChange={(e) => setCustomStudentExpiryDays(Number(e.target.value))}
                                      />
                                      <span className="text-xs font-bold text-gray-500 whitespace-nowrap">일간</span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Label className="text-xs font-bold text-purple-950">만료 일자 지정</Label>
                                    <Input
                                      type="date"
                                      className="h-10 bg-white border-purple-100 font-bold"
                                      value={customStudentExpiryDate}
                                      onChange={(e) => setCustomStudentExpiryDate(e.target.value)}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <DialogFooter className="flex items-center justify-between sm:justify-between w-full border-t border-gray-100 pt-4">
                          <div className="text-sm font-semibold text-gray-500">
                            선택된 회원: <span className="text-purple-600 font-black">{selectedMemberIds.length}명</span>
                          </div>
                          <div className="flex items-center gap-2 flex-row">
                            <Button
                              variant="outline"
                              className="rounded-xl font-bold border-gray-100 h-11 px-5"
                              type="button"
                              onClick={() => {
                                setIsEnrollModalOpen(false);
                                setSelectedMemberIds([]);
                              }}
                            >
                              취소
                            </Button>
                            <Button
                              className="bg-purple-600 hover:bg-purple-700 font-bold rounded-xl h-11 px-6 min-w-[120px]"
                              disabled={isAddingStudentsProgress || selectedMemberIds.length === 0}
                              onClick={handleEnrollSelectedMembers}
                              type="button"
                            >
                              {isAddingStudentsProgress ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  추가 중...
                                </>
                              ) : (
                                '선택 완료 및 추가'
                              )}
                            </Button>
                          </div>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </TabsContent>
            </div>
          </div>

          <div className="w-full lg:w-80 flex-shrink-0 lg:sticky lg:top-24 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">공개 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Select
                  value={courseInfo.status}
                  onValueChange={(val) =>
                    setCourseInfo({ ...courseInfo, status: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">초안(비공개)</SelectItem>
                    <SelectItem value="published">공개(판매중)</SelectItem>
                    <SelectItem value="private">비공개</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSave}
                  className="w-full bg-purple-600 hover:bg-purple-700 h-11 rounded-xl"
                >
                  저장하기
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  </div>
);
}
