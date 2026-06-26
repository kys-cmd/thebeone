import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Download, 
  Printer, 
  Filter, 
  Loader2, 
  BookOpen, 
  UserCheck, 
  Calendar,
  Sparkles,
  ChevronRight,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Course } from '@/types';

interface StudentEnrollment {
  id: string;
  created_at: string;
  course_id: string;
  user_id: string;
  profile: {
    id: string;
    name: string;
    nickname: string;
    email: string;
    mobile_phone: string;
    phone: string;
  } | null;
  course: {
    id: string;
    title: string;
    instructor: string;
    start_date: string | null;
    end_date: string | null;
  } | null;
}

export default function AdminStudentManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeEnrollments: 0,
    courseCount: 0
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      
      // 1. Fetch courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
        
      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // 2. Fetch enrollments with nested profiles and courses
      const { data: enrollmentsData, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          id,
          created_at,
          course_id,
          user_id,
          profiles (
            id,
            name,
            nickname,
            email,
            mobile_phone,
            phone
          ),
          courses (
            id,
            title,
            instructor,
            start_date,
            end_date
          )
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (enrollError) throw enrollError;

      // Map nested properties into flat safe types
      const mappedEnrollments: StudentEnrollment[] = (enrollmentsData || []).map((e: any) => ({
        id: e.id,
        created_at: e.created_at,
        course_id: e.course_id,
        user_id: e.user_id,
        profile: e.profiles ? {
          id: e.profiles.id,
          name: e.profiles.name || '이름 없음',
          nickname: e.profiles.nickname || '닉네임 없음',
          email: e.profiles.email || '',
          mobile_phone: e.profiles.mobile_phone || '',
          phone: e.profiles.phone || ''
        } : null,
        course: e.courses ? {
          id: e.courses.id,
          title: e.courses.title || '알 수 없는 강의',
          instructor: e.courses.instructor || '미지정',
          start_date: e.courses.start_date || null,
          end_date: e.courses.end_date || null
        } : null
      }));

      setEnrollments(mappedEnrollments);

      // Unique students count
      const uniqueUserIds = new Set(mappedEnrollments.map(e => e.user_id));
      
      setStats({
        totalStudents: uniqueUserIds.size,
        activeEnrollments: mappedEnrollments.length,
        courseCount: (coursesData || []).length
      });

    } catch (error: any) {
      console.error('Error fetching student data:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter enrollments based on selected course and search query
  const filteredEnrollments = enrollments.filter(item => {
    // Course filter
    if (selectedCourseId !== 'all' && item.course_id !== selectedCourseId) {
      return false;
    }
    
    // Search query filter (matches name, nickname, email, phone)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const nameMatch = item.profile?.name?.toLowerCase().includes(q) || false;
      const nickMatch = item.profile?.nickname?.toLowerCase().includes(q) || false;
      const emailMatch = item.profile?.email?.toLowerCase().includes(q) || false;
      const phoneMatch = item.profile?.mobile_phone?.includes(q) || item.profile?.phone?.includes(q) || false;
      return nameMatch || nickMatch || emailMatch || phoneMatch;
    }
    
    return true;
  });

  const getPhoneNumber = (profile: StudentEnrollment['profile']) => {
    if (!profile) return '-';
    return profile.mobile_phone || profile.phone || '-';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  const formatCourseDates = (start: string | null, end: string | null) => {
    if (!start && !end) return '상시 수강';
    const s = start ? formatDate(start) : '시작일 없음';
    const e = end ? formatDate(end) : '종료일 없음';
    return `${s} ~ ${e}`;
  };

  // Download filtered students list to Excel
  const handleDownloadExcel = () => {
    if (filteredEnrollments.length === 0) {
      toast.error('다운로드할 데이터가 없습니다.');
      return;
    }

    try {
      // Format data for Excel
      const excelData = filteredEnrollments.map((item, index) => ({
        'No': index + 1,
        '이름': item.profile?.name || '이름 없음',
        '닉네임': item.profile?.nickname || '닉네임 없음',
        '이메일주소': item.profile?.email || '-',
        '휴대폰번호': getPhoneNumber(item.profile),
        '수강 등록일': formatDate(item.created_at),
        '강의명': item.course?.title || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Column widths helper
      const max_widths = [
        { wch: 6 },  // No
        { wch: 15 }, // 이름
        { wch: 15 }, // 닉네임
        { wch: 25 }, // 이메일주소
        { wch: 18 }, // 휴대폰번호
        { wch: 15 }, // 수강 등록일
        { wch: 35 }  // 강의명
      ];
      worksheet['!cols'] = max_widths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "수강생 목록");
      
      const courseTitle = selectedCourseId === 'all' 
        ? '전체강의' 
        : (courses.find(c => c.id === selectedCourseId)?.title || '강의별');
        
      XLSX.writeFile(workbook, `수강생목록_${courseTitle}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('엑셀 파일이 성공적으로 생성되었습니다.');
    } catch (err: any) {
      console.error('Excel export error:', err);
      toast.error('엑셀 생성 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // Open the printable Attendance Book in a new window/tab
  const handlePrintAttendance = () => {
    if (selectedCourseId === 'all') {
      toast.error('출석부를 출력하려면 먼저 강의를 선택해주세요.');
      return;
    }

    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    if (!selectedCourse) {
      toast.error('선택한 강의 정보를 찾을 수 없습니다.');
      return;
    }

    if (filteredEnrollments.length === 0) {
      toast.error('해당 강의에 등록된 수강생이 없습니다.');
      return;
    }

    // Sort students alphabetically by name as requested: "이름별로 정렬될 수 있도록 해줘."
    const sortedEnrollments = [...filteredEnrollments].sort((a, b) => {
      const nameA = a.profile?.name || '';
      const nameB = b.profile?.name || '';
      return nameA.localeCompare(nameB, 'ko');
    });

    const courseTitle = selectedCourse.title;
    const instructorName = selectedCourse.instructor || '미지정';
    const courseDates = formatCourseDates(selectedCourse.start_date, selectedCourse.end_date);

    // Build the HTML template for students list
    // Column format: No | 이름 | 닉네임 | 휴대폰 번호 | 수강 등록일 | 출석 체크(반복되는 행은 빈칸) | 비고
    const studentsHTML = sortedEnrollments.map((item, index) => {
      return `
        <tr>
          <td style="font-weight: bold; color: #475569;">${index + 1}</td>
          <td style="font-weight: 800; font-size: 14px; text-align: left; padding-left: 15px;">${item.profile?.name || '이름 없음'}</td>
          <td>${item.profile?.nickname || '닉네임 없음'}</td>
          <td>${getPhoneNumber(item.profile)}</td>
          <td>${formatDate(item.created_at)}</td>
          <td class="attendance-cell"></td>
          <td class="remarks-cell"></td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>출석부 - ${courseTitle}</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: A4 portrait;
                margin: 20mm 15mm 20mm 15mm;
              }
              @media print {
                body { margin: 0; padding: 0; }
                .no-print { display: none !important; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
              }
              body { 
                font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; 
                padding: 10px; 
                color: #1e293b; 
                background: #fff;
                line-height: 1.5;
              }
              .no-print-container {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: #f1f5f9;
                padding: 15px 30px;
                border-radius: 12px;
                margin-bottom: 30px;
                border: 1px solid #e2e8f0;
              }
              .no-print-text {
                font-size: 14px;
                font-weight: bold;
                color: #475569;
              }
              .print-btn { 
                background: #7c3aed; 
                color: #fff; 
                border: none; 
                padding: 12px 24px; 
                font-size: 14px; 
                font-weight: 800; 
                border-radius: 8px; 
                cursor: pointer; 
                box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3);
                transition: background 0.2s;
              }
              .print-btn:hover {
                background: #6d28d9;
              }
              .header { 
                text-align: center; 
                margin-bottom: 35px; 
                border-bottom: 3px double #cbd5e1;
                padding-bottom: 25px;
              }
              .title { 
                font-size: 28px; 
                font-weight: 900; 
                margin-bottom: 15px; 
                color: #0f172a; 
                letter-spacing: -0.5px;
              }
              .meta-info { 
                display: flex; 
                justify-content: center; 
                gap: 50px; 
                font-size: 15px; 
                color: #334155; 
                font-weight: 700;
              }
              .meta-label {
                color: #64748b;
                font-weight: 500;
                margin-right: 6px;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 15px; 
              }
              th, td { 
                border: 1px solid #94a3b8; 
                padding: 4px 6px; 
                text-align: center; 
                font-size: 13px; 
              }
              th { 
                background-color: #f1f5f9; 
                font-weight: 800; 
                color: #1e293b; 
              }
              .attendance-cell { 
                width: 180px; 
                background-color: #fff;
              }
              .remarks-cell { 
                width: 130px; 
                background-color: #fff;
              }
              tr {
                height: 24px;
              }
              .footer {
                margin-top: 40px;
                text-align: right;
                font-size: 12px;
                color: #94a3b8;
              }
            </style>
          </head>
          <body>
            <div class="no-print-container no-print">
              <span class="no-print-text">💡 출석부 서식이 구성되었습니다. [인쇄하기] 버튼을 눌러 출력하여 수강생 출석을 관리하세요.</span>
              <button class="print-btn" onclick="window.print()">🖨️ 출석부 인쇄하기</button>
            </div>
            
            <div class="header">
              <div class="title">강의 출석부</div>
              <div class="meta-info">
                <span><span class="meta-label">강의명:</span> ${courseTitle}</span>
                <span><span class="meta-label">강의 기간:</span> ${courseDates}</span>
                <span><span class="meta-label">강사 명:</span> ${instructorName}</span>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style="width: 45px;">No</th>
                  <th style="width: 110px;">이름</th>
                  <th style="width: 100px;">닉네임</th>
                  <th style="width: 130px;">휴대폰 번호</th>
                  <th style="width: 115px;">수강 등록일</th>
                  <th class="attendance-cell">출석여부</th>
                  <th class="remarks-cell">비고</th>
                </tr>
              </thead>
              <tbody>
                ${studentsHTML}
              </tbody>
            </table>
            
            <div class="footer">
              출력 일시: ${new Date().toLocaleString('ko-KR')}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      toast.error('팝업 차단으로 인해 출석부 새 창을 열 수 없습니다. 브라우저 팝업 허용 설정을 확인해주세요.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Upper header with abstract background card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-[40px] p-8 md:p-12 shadow-2xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-300 via-pink-400 to-indigo-800" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <Badge className="bg-purple-500/20 text-purple-300 border-none font-bold font-sans tracking-wide px-3.5 py-1.5 rounded-full backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 mr-1 inline-block" /> 학사 행정 지원
            </Badge>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">수강생 관리</h1>
            <p className="text-gray-300 text-sm md:text-base font-medium max-w-xl">
              강의별 수강 신청 승인 인원 및 수강생 명단을 통합 조회하고 출석부 제작 및 엑셀 마이그레이션 도구를 제공합니다.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              onClick={handleDownloadExcel} 
              className="bg-white text-slate-900 hover:bg-slate-100 font-extrabold px-6 h-12 rounded-2xl shadow-lg shadow-white/5 transition-all gap-2 border-none"
            >
              <Download className="w-4 h-4 text-purple-600" />
              <span>엑셀 다운로드</span>
            </Button>
            
            <Button 
              disabled={selectedCourseId === 'all'}
              onClick={handlePrintAttendance} 
              className={`font-extrabold px-6 h-12 rounded-2xl shadow-lg transition-all gap-2 ${
                selectedCourseId === 'all' 
                  ? 'bg-purple-600/40 text-purple-200/50 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>출석부 출력</span>
            </Button>
          </div>
        </div>
      </div>



      {/* Filter and Search Panel */}
      <Card className="border-none shadow-xl rounded-[32px] bg-slate-900 text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-300 via-pink-400 to-indigo-800" />
        <div className="relative z-10 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-black mr-2">
              <Filter className="w-4 h-4 text-purple-400" />
              <span>강의 필터링:</span>
            </div>
            <div className="w-full sm:w-72">
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="w-full h-11 rounded-xl bg-slate-800 border border-slate-700 font-extrabold text-sm text-white focus:ring-2 focus:ring-purple-500">
                  <SelectValue placeholder="강의를 선택하세요">
                    {selectedCourseId === 'all' 
                      ? '전체 강의 목록' 
                      : (courses.find(c => c.id === selectedCourseId)?.title || '강의를 선택하세요')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-80 text-slate-200">
                  <SelectItem value="all" className="font-bold focus:bg-purple-600 focus:text-white data-[highlighted]:bg-purple-600 data-[highlighted]:text-white focus:**:!text-white data-[highlighted]:**:!text-white cursor-pointer">전체 강의 목록</SelectItem>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id} className="font-semibold focus:bg-purple-600 focus:text-white data-[highlighted]:bg-purple-600 data-[highlighted]:text-white focus:**:!text-white data-[highlighted]:**:!text-white cursor-pointer">
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative w-full lg:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름, 닉네임, 이메일, 전화번호 검색..."
              className="pl-12 h-11 bg-slate-800 border border-slate-700 rounded-xl font-bold text-sm text-white placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-purple-500 transition-all w-full"
            />
          </div>
        </div>
      </Card>

      {/* Main Student Table */}
      <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden">
        <CardHeader className="px-8 pt-8 pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span>수강생 명단 ({filteredEnrollments.length}명)</span>
            </CardTitle>
            <CardDescription className="font-bold text-slate-400 mt-1">
              {selectedCourseId === 'all' 
                ? '학원의 모든 강좌 수강생 정보입니다.' 
                : `'${courses.find(c => c.id === selectedCourseId)?.title}' 과목의 실시간 수강 정보입니다.`
              }
            </CardDescription>
          </div>
          
          {selectedCourseId !== 'all' && (
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 font-bold block">강의 상세정보</span>
              <span className="text-xs font-black text-purple-600">
                강사: {courses.find(c => c.id === selectedCourseId)?.instructor || '미지정'}
              </span>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 text-slate-500 font-bold">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              <span>수강생 데이터를 동기화하는 중...</span>
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="p-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
                <User className="w-8 h-8" />
              </div>
              <p className="text-slate-500 font-black text-lg">해당 조건의 수강생이 존재하지 않습니다.</p>
              <p className="text-slate-400 text-xs font-bold mt-1">새로운 수강 결제나 수강 등록 내역이 수집될 때까지 대기하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4.5 px-8 text-center text-xs font-black text-slate-500 uppercase tracking-wider w-20">No</th>
                    <th className="py-4.5 px-6 text-left text-xs font-black text-slate-500 uppercase tracking-wider">이름</th>
                    <th className="py-4.5 px-6 text-left text-xs font-black text-slate-500 uppercase tracking-wider">닉네임</th>
                    <th className="py-4.5 px-6 text-left text-xs font-black text-slate-500 uppercase tracking-wider">이메일주소</th>
                    <th className="py-4.5 px-6 text-left text-xs font-black text-slate-500 uppercase tracking-wider">휴대폰번호</th>
                    <th className="py-4.5 px-6 text-left text-xs font-black text-slate-500 uppercase tracking-wider">수강 등록일</th>
                    {selectedCourseId === 'all' && (
                      <th className="py-4.5 px-6 text-left text-xs font-black text-slate-500 uppercase tracking-wider">등록된 강의명</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEnrollments.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4.5 px-8 text-center text-sm font-bold text-slate-400">
                        {filteredEnrollments.length - index}
                      </td>
                      <td className="py-4.5 px-6 text-sm font-extrabold text-slate-900">
                        {item.profile?.name || '이름 없음'}
                      </td>
                      <td className="py-4.5 px-6 text-sm font-semibold text-slate-600">
                        {item.profile?.nickname || '닉네임 없음'}
                      </td>
                      <td className="py-4.5 px-6 text-sm font-medium text-slate-500">
                        {item.profile?.email || '-'}
                      </td>
                      <td className="py-4.5 px-6 text-sm font-mono font-bold text-slate-600">
                        {getPhoneNumber(item.profile)}
                      </td>
                      <td className="py-4.5 px-6 text-sm font-semibold text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(item.created_at)}
                        </span>
                      </td>
                      {selectedCourseId === 'all' && (
                        <td className="py-4.5 px-6 text-sm font-bold text-slate-800">
                          <Badge variant="outline" className="font-semibold text-xs border-purple-100 bg-purple-50/30 text-purple-700 px-2.5 py-1 rounded-md">
                            {item.course?.title || '알 수 없음'}
                          </Badge>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Attendance Sheet helper guide */}
      {selectedCourseId === 'all' && !isLoading && enrollments.length > 0 && (
        <div className="bg-purple-50 rounded-[32px] p-6 border border-purple-100/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-slate-900">💡 강의별 수강생 출석부 출력 가이드</p>
              <p className="text-xs text-slate-500 font-bold mt-1">
                출석부 출력 기능을 사용하시려면 상단 필터에서 '전체 강의 목록' 대신 특정 강의를 선택해주세요. <br />
                강의를 선택하시면 해당 강의 수강생들이 이름 가나다 순으로 자동 정렬된 출석 체크 시트가 새창에 구성됩니다.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-48 h-10 rounded-xl bg-white border border-purple-200 font-bold text-xs text-purple-700">
                <SelectValue placeholder="강의 선택하기">
                  {selectedCourseId === 'all' 
                    ? '강의 선택하기' 
                    : (courses.find(c => c.id === selectedCourseId)?.title || '강의 선택하기')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-100 rounded-xl shadow-lg max-h-60">
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id} className="font-semibold text-xs">
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
