import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Image as ImageIcon, 
  Video,
  Monitor, 
  Smartphone, 
  Plus, 
  Save, 
  Trash2, 
  Move,
  Settings2,
  Eye,
  Type,
  Palette,
  Layers,
  ExternalLink,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractVimeoId, getVimeoEmbedUrl } from '@/lib/vimeo';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { cmsService, Banner, CommunityCategory, SiteConfig } from '@/services/cmsService';
import { storageService } from '@/services/storageService';

export default function AdminCMS() {
  const [activeTab, setActiveTab] = useState('banners');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [communityCategories, setCommunityCategories] = useState<CommunityCategory[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [lifeCoachingHtml, setLifeCoachingHtml] = useState<string>('');
  const [lifeCoachingId, setLifeCoachingId] = useState<string>('new-life-coaching');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      const [bannerData, communityData, configData, lifeCoachingData] = await Promise.all([
        cmsService.getAllBanners(),
        cmsService.getCommunityCategories(),
        cmsService.getSiteConfig(),
        cmsService.getSupportContent('life_coaching')
      ]);
      setBanners(bannerData);
      setCommunityCategories(communityData);
      setSiteConfig(configData);
      if (lifeCoachingData && lifeCoachingData.length > 0) {
        setLifeCoachingHtml(lifeCoachingData[0].content || '');
        setLifeCoachingId(lifeCoachingData[0].id);
      }
      setLoading(false);
    };
    loadAllData();
  }, []);

  const handleAddBanner = () => {
    const newBanner: Banner = {
      id: `new-${Date.now()}`,
      title: '새로운 배너',
      image: '', // Clear image so user is prompted to upload
      active: true,
      link: '',
      order: banners.length + 1,
      type: 'main'
    };
    setBanners([...banners, newBanner]);
    toast.success('새 배너가 추가되었습니다. 이미지를 업로드하고 저장해 주세요.');
  };

  const handleSaveBanners = async () => {
    try {
      const loadingToast = toast.loading('배너 설정을 저장 중입니다...');
      await Promise.all([
        cmsService.saveBanners(banners),
        siteConfig ? cmsService.saveSiteConfig(siteConfig) : Promise.resolve()
      ]);
      
      // Re-fetch to get real IDs
      const [bannerData, configData] = await Promise.all([
        cmsService.getAllBanners(),
        cmsService.getSiteConfig()
      ]);
      setBanners(bannerData);
      setSiteConfig(configData);
      
      toast.dismiss(loadingToast);
      toast.success('배너 및 롤링 설정이 모두 저장되었습니다.');
    } catch (error: any) {
      console.error('Banner save error:', error);
      const errorMessage = error.message || '배너 저장 중 오류가 발생했습니다.';
      const isRlsError = errorMessage.includes('row-level security') || errorMessage.includes('policy') || errorMessage.includes('권한');
      const isSchemaError = errorMessage.includes('column') || errorMessage.includes('schema cache') || errorMessage.includes('컬럼');
      
      toast.error(
        <div className="space-y-2">
          <p className="font-bold whitespace-pre-wrap">{errorMessage}</p>
          {(isRlsError || isSchemaError) && (
            <p className="text-xs opacity-90 p-2 bg-red-50 text-red-700 rounded border border-red-200">
              {isSchemaError ? '데이터베이스 구조가 최신 상태가 아닙니다.' : '보안 정책(RLS) 설정이 필요합니다.'} <br/>
              1. 상단의 <strong>"supabase_cms_init.sql"</strong> 파일 내용을 전체 복사하세요. <br/>
              2. Supabase <strong>SQL Editor</strong>에 붙여넣고 <strong>Run</strong>을 눌러주세요.
            </p>
          )}
        </div>,
        { duration: 10000 }
      );
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!id.startsWith('new')) {
      await cmsService.deleteBanner(id);
    }
    setBanners(banners.filter(b => b.id !== id));
    toast.info('배너가 삭제되었습니다.');
  };

  const handleSavePages = async () => {
    try {
      await cmsService.saveSupportContent([{
        id: lifeCoachingId,
        type: 'life_coaching',
        title: '라이프코칭 커스텀 페이지',
        content: lifeCoachingHtml,
        active: true
      }]);
      toast.success('페이지 설정이 저장되었습니다.');
    } catch(err) {
      toast.error('페이지 설정 저장에 실패했습니다.');
    }
  };

  const handleUpdateBanner = (id: string, field: keyof Banner, value: any) => {
    setBanners(banners.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const handleBannerImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (e.g., 5MB for images)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 파일은 5MB 이하만 가능합니다.');
      return;
    }

    setUploadingId(id);
    try {
      const publicUrl = await storageService.uploadImage(file);
      handleUpdateBanner(id, 'image', publicUrl);
      toast.success('이미지가 업로드되었습니다.');
    } catch (error) {
      toast.error('이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingId(null);
    }
  };

  const handleCommunityBannerUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const publicUrl = await storageService.uploadImage(file);
      setCommunityCategories(communityCategories.map(c => c.id === id ? {...c, banner: publicUrl} : c));
      toast.success('이미지가 업로드되었습니다.');
    } catch (error) {
      toast.error('이미지 업로드에 실패했습니다.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !siteConfig) return;

    try {
      const publicUrl = await storageService.uploadImage(file);
      setSiteConfig({...siteConfig, logo_url: publicUrl});
      toast.success('로고가 업로드되었습니다.');
    } catch (error) {
      toast.error('로고 업로드에 실패했습니다.');
    }
  };

  const handleSaveAllCMS = async () => {
    try {
      await Promise.all([
        cmsService.saveBanners(banners),
        cmsService.saveCommunityCategories(communityCategories),
        siteConfig ? cmsService.saveSiteConfig(siteConfig) : Promise.resolve()
      ]);
      toast.success('모든 CMS 설정이 저장되었습니다.');
    } catch (error) {
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  if (loading || !siteConfig) return <div className="p-10 text-center">CMS 데이터를 불러오는 중...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">디자인 및 CMS 관리</h1>
          <p className="text-gray-500 mt-1">사이트 전체의 디자인 요소와 페이지 구성을 관리합니다.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Eye className="w-4 h-4" /> 미리보기
          </Button>
          <Button onClick={handleSaveAllCMS} className="bg-purple-600 hover:bg-purple-700 gap-2">
            <Save className="w-4 h-4" /> 전체 저장
          </Button>
        </div>
      </div>

      <Tabs defaultValue="banners" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap w-full justify-start bg-white border shadow-sm rounded-xl p-1 h-auto">
          <TabsTrigger value="banners" className="rounded-lg gap-2 flex-grow sm:flex-grow-0">
            <Layers className="w-4 h-4" /> 배너 관리
          </TabsTrigger>
          <TabsTrigger value="events" className="rounded-lg gap-2 flex-grow sm:flex-grow-0">
            <Palette className="w-4 h-4" /> 이벤트 배너
          </TabsTrigger>
          <TabsTrigger value="community" className="rounded-lg gap-2 flex-grow sm:flex-grow-0">
            <MessageSquare className="w-4 h-4" /> 커뮤니티
          </TabsTrigger>
          <TabsTrigger value="pages" className="rounded-lg gap-2 flex-grow sm:flex-grow-0">
            <Layout className="w-4 h-4" /> 페이지 관리
          </TabsTrigger>
          <TabsTrigger value="courses" className="rounded-lg gap-2 flex-grow sm:flex-grow-0">
            <BookOpen className="w-4 h-4" /> 디자인 테마
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg gap-2 flex-grow sm:flex-grow-0">
            <Settings2 className="w-4 h-4" /> 공통 설정
          </TabsTrigger>
        </TabsList>

        {/* 1. 배너 관리 */}
        <TabsContent value="banners" className="mt-6 space-y-6">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden shadow-xl shadow-purple-900/10">
            <div className="relative z-10 space-y-2">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md mb-2">Notice</Badge>
              <h2 className="text-3xl font-black tracking-tight">HERO 영역 디자인 설정</h2>
              <p className="text-purple-100 max-w-2xl font-medium leading-relaxed">
                메인 페이지와 카테고리별 상단 배너를 설정합니다. <br/>
                배너 타입에 따라 <strong>롤링 배너</strong>, <strong>상세 페이지 레이아웃</strong> 등 패스트캠퍼스 스타일의 세련된 디자인이 자동 적용됩니다. <br/>
                <span className="text-white/80 text-xs mt-2 inline-block bg-white/10 px-2 py-1 rounded">권장 배너 사이즈: 1920 x 450 px</span>
              </p>
            </div>
            <Palette className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/10" />
          </div>

          <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h3 className="text-lg font-bold">배너 목록</h3>
              <p className="text-xs text-gray-500 font-medium">현재 {banners.length}개의 배너가 등록되어 있습니다.</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 shadow-inner">
                <Label className="text-xs font-black text-gray-500 whitespace-nowrap">롤링 간격 (ms)</Label>
                <Input 
                  type="number" 
                  step="500" 
                  min="1000"
                  value={siteConfig.banner_interval || 5000} 
                  onChange={e => setSiteConfig({...siteConfig, banner_interval: parseInt(e.target.value)})}
                  className="w-20 h-8 bg-transparent border-none text-right font-black text-purple-600 focus-visible:ring-0" 
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleAddBanner} size="lg" variant="outline" className="gap-2 rounded-xl border-gray-200 hover:border-purple-200 hover:bg-purple-50 transition-all font-bold">
                  <Plus className="w-4 h-4" /> 배너 추가
                </Button>
                <Button onClick={handleSaveBanners} size="lg" className="bg-purple-600 hover:bg-purple-700 gap-2 rounded-xl px-8 shadow-lg shadow-purple-600/20 font-bold">
                  <Save className="w-4 h-4" /> 설정 저장하기
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-8">
            {banners.sort((a, b) => a.order - b.order).map((banner) => (
              <Card key={banner.id} className="group overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 rounded-3xl">
                <div className="flex flex-col">
                  {/* Media Preview Area - Always on TOP */}
                  <div className="w-full bg-gray-50 relative group/img">
                    {banner.video_url || banner.image ? (
                      <div className="aspect-[21/9] md:aspect-[5/1] w-full relative overflow-hidden bg-gray-100">
                        {banner.video_url ? (
                          banner.video_url.includes('vimeo.com') ? (
                            <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                              <iframe
                                src={getVimeoEmbedUrl(banner.video_url, {
                                  autoplay: 0,
                                  loop: 1,
                                  background: 1,
                                  autopause: 0
                                })}
                                 className="absolute top-1/2 left-1/2 w-[177.78vh] h-[56.25vw] min-w-full min-h-full -translate-x-1/2 -translate-y-1/2"
                                frameBorder="0"
                                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                                title={banner.title}
                              />
                            </div>
                          ) : (
                            <video 
                              src={banner.video_url} 
                              className="w-full h-full object-cover" 
                              loop 
                              autoPlay 
                            />
                          )
                        ) : (
                          <img src={banner.image} alt={banner.title} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105" />
                        )}
                        {/* Media Edit Actions */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                          <div className="flex flex-wrap items-center justify-center gap-2 px-4">
                            <Label htmlFor={`banner-img-${banner.id}`} className="cursor-pointer">
                              <div className="bg-white text-black h-9 px-4 rounded-full flex items-center justify-center gap-2 text-[11px] font-bold shadow-2xl hover:bg-gray-100 transition-colors">
                                <ImageIcon className="w-3.5 h-3.5" /> {banner.image ? '이미지 변경' : '이미지 추가'}
                              </div>
                            </Label>
                            {banner.image && (
                              <Button 
                                variant="destructive" 
                                size="sm"
                                className="h-9 rounded-full px-4 font-bold text-[11px] bg-red-500/80 hover:bg-red-600"
                                onClick={() => handleUpdateBanner(banner.id, 'image', '')}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> 이미지 삭제
                              </Button>
                            )}
                          </div>

                          <div className="w-64 space-y-2 px-4">
                            <div className="p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/20">
                              <Label className="text-[10px] text-white/60 mb-1 block">배경색 지정 (이미지 없을 때)</Label>
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="color"
                                  value={banner.bg_color || '#000000'} 
                                  onChange={(e) => handleUpdateBanner(banner.id, 'bg_color', e.target.value)}
                                  className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer rounded-full overflow-hidden shrink-0"
                                />
                                <Input 
                                  value={banner.bg_color || '#000000'} 
                                  onChange={(e) => handleUpdateBanner(banner.id, 'bg_color', e.target.value)}
                                  placeholder="#000000"
                                  className="h-6 bg-transparent border-none text-white text-[10px] placeholder:text-white/30 focus:ring-0 p-0 font-mono flex-1"
                                />
                              </div>
                            </div>

                            <div className="p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/20">
                              <Label className="text-[10px] text-white/60 mb-1 block">Vimeo URL (직접 입력 가능)</Label>
                              <Input 
                                value={banner.video_url || ''} 
                                onChange={(e) => handleUpdateBanner(banner.id, 'video_url', e.target.value)}
                                placeholder="https://vimeo.com/..."
                                className="h-6 bg-transparent border-none text-white text-[10px] placeholder:text-white/30 focus:ring-0 p-0"
                              />
                            </div>
                          </div>

                          {banner.video_url && (
                             <Button 
                               variant="destructive" 
                               size="sm"
                               className="h-7 rounded-full px-4 font-bold text-[9px] bg-red-500/50 hover:bg-red-600"
                               onClick={() => handleUpdateBanner(banner.id, 'video_url', '')}
                             >
                               영상 정보 초기화
                             </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-[21/9] md:aspect-[5/1] w-full flex flex-col items-center justify-center p-8 text-center bg-gray-50 border-b border-gray-100">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-4">
                          <ImageIcon className="w-10 h-10 text-gray-200" />
                        </div>
                        <p className="text-sm text-gray-400 font-bold mb-4">배너 미디어가 등록되지 않았습니다. <br/> <span className="text-[10px] text-gray-300">권장 사이즈: 1920 x 450 px</span></p>
                        <div className="flex flex-col items-center gap-6 w-full max-w-md px-6">
                          <div className="flex gap-3">
                            <Label htmlFor={`banner-img-${banner.id}`} className="cursor-pointer">
                              <div className="bg-white border border-gray-200 text-gray-700 h-10 px-8 rounded-full flex items-center gap-2 text-xs font-bold shadow-sm hover:bg-gray-50 transition-colors">
                                <ImageIcon className="w-4 h-4" /> 이미지 업로드
                              </div>
                            </Label>
                          </div>
                          
                          <div className="w-full space-y-3">
                            <div className="p-3 bg-white/50 rounded-2xl border border-gray-100">
                              <Label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-wider">동영상 링크 (Vimeo 지원)</Label>
                              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-200">
                                <Video className="w-3.5 h-3.5 text-purple-600" />
                                <Input 
                                  value={banner.video_url || ''} 
                                  onChange={(e) => handleUpdateBanner(banner.id, 'video_url', e.target.value)}
                                  placeholder="https://vimeo.com/..."
                                  className="h-6 bg-transparent border-none text-xs flex-1 focus-visible:ring-0 p-0"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 bg-white/50 px-4 py-2 rounded-2xl border border-gray-100">
                               <Label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">배경색</Label>
                               <Input 
                                 type="color"
                                 value={banner.bg_color || '#000000'} 
                                 onChange={(e) => handleUpdateBanner(banner.id, 'bg_color', e.target.value)}
                                 className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer rounded-full overflow-hidden shrink-0 shadow-sm"
                               />
                               <Input 
                                 value={banner.bg_color || '#000000'} 
                                 onChange={(e) => handleUpdateBanner(banner.id, 'bg_color', e.target.value)}
                                 className="w-24 h-6 bg-transparent border-none text-xs font-mono text-center focus-visible:ring-0"
                               />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {uploadingId === banner.id && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-2" />
                        <p className="text-xs font-bold text-purple-600">업로드 중...</p>
                      </div>
                    )}
                    
                    <input 
                      type="file" 
                      id={`banner-img-${banner.id}`} 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleBannerImageUpload(banner.id, e)} 
                    />

                    {/* Type Badge on Image */}
                    <div className="absolute top-6 left-6 z-10">
                      <div className={cn(
                        "font-black py-1.5 px-4 border-none shadow-xl rounded-full text-[10px] tracking-widest text-white",
                        banner.type === 'main' ? "bg-purple-600" : 
                        banner.type === 'special' ? "bg-red-600" : 
                        banner.type === 'beone_exclusive' ? "bg-indigo-600" : "bg-blue-600"
                      )}>
                        {banner.type === 'main' ? 'MAIN BANNER' : 
                         banner.type === 'special' ? 'SPECIAL BANNER' : 
                         banner.type === 'beone_exclusive' ? 'BEONE EXCLUSIVE BANNER' : 'COURSE LISTBANNER'}
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-8 space-y-8 bg-white">
                    {/* 1. 제목 및 서브타이틀 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">주요 제목 (TITLE)</Label>
                        <Input 
                          value={banner.title || ''} 
                          onChange={e => handleUpdateBanner(banner.id, 'title', e.target.value)} 
                          placeholder="배너 타이틀을 입력하세요" 
                          className="rounded-xl border-gray-100 bg-gray-50 focus:bg-white h-12 font-bold px-4"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">서브 타이틀 (SUBTITLE)</Label>
                        <Input 
                          value={banner.subtitle || ''} 
                          onChange={e => handleUpdateBanner(banner.id, 'subtitle', e.target.value)} 
                          placeholder="추가 설명 문구를 입력하세요" 
                          className="rounded-xl border-gray-100 bg-gray-50 focus:bg-white h-12 px-4 shadow-sm"
                        />
                      </div>
                    </div>

                    {/* 2. HTML 커스텀 영역 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          커스텀 디자인 HTML
                          <HelpCircle className="w-3.5 h-3.5 text-gray-300 cursor-help" />
                        </Label>
                        <span className="text-[10px] font-bold text-gray-300">HTML / CSS CODE (Optional)</span>
                      </div>
                      <textarea 
                        value={banner.html_content || ''} 
                        onChange={e => handleUpdateBanner(banner.id, 'html_content', e.target.value)} 
                        placeholder="배너 위에 겹쳐서 보여줄 HTML 코드를 입력하세요"
                        className="w-full min-h-[160px] p-5 text-sm font-mono bg-gray-950 text-emerald-400 rounded-3xl border-none focus:ring-4 focus:ring-purple-500/10 outline-none scrollbar-thin overflow-auto leading-relaxed shadow-inner"
                      />
                    </div>

                    {/* 3. 카테고리, 활성화, 링크 공유 영역 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-50">
                      <div className="space-y-3">
                        <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">배너 카테고리</Label>
                        <Select value={banner.type} onValueChange={val => handleUpdateBanner(banner.id, 'type', val)}>
                          <SelectTrigger className="rounded-xl h-12 border-gray-100 bg-gray-50 font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main">메인 롤링 (Home)</SelectItem>
                            <SelectItem value="special">특강 롤링 (Special)</SelectItem>
                            <SelectItem value="beone_exclusive">비원커뮤니티회원전용 롤링 (BeOne)</SelectItem>
                            <SelectItem value="course">정규강의 헤더</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2 space-y-3">
                        <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">클릭 시 이동할 링크</Label>
                        <div className="flex gap-3">
                          <Input 
                            value={banner.link || ''} 
                            onChange={e => handleUpdateBanner(banner.id, 'link', e.target.value)} 
                            placeholder="/courses/..." 
                            className="rounded-xl h-12 border-gray-100 bg-gray-50 flex-1 font-medium px-4"
                          />
                          <div className="flex items-center gap-3 px-5 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
                            <Label className="text-[10px] font-black text-gray-400">ACTIVE</Label>
                            <Switch 
                              checked={banner.active} 
                              onCheckedChange={val => handleUpdateBanner(banner.id, 'active', val)} 
                              className="data-[state=checked]:bg-purple-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. 삭제 및 순서 관리 하단 바 */}
                    <div className="flex items-center justify-between pt-6 mt-4 border-t border-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                          <Label className="text-[10px] font-black text-gray-400">ORDER</Label>
                          <Input 
                            type="number" 
                            value={banner.order || 0} 
                            onChange={e => handleUpdateBanner(banner.id, 'order', parseInt(e.target.value))} 
                            className="w-12 h-6 p-0 bg-transparent border-none text-center font-black text-purple-600 focus-visible:ring-0" 
                          />
                        </div>
                        <div className="h-4 w-[1px] bg-gray-100" />
                        <span className="text-[10px] font-bold text-gray-300">ID: {banner.id.slice(0, 8)}</span>
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl h-10 px-5 transition-all font-bold" 
                        onClick={() => handleDeleteBanner(banner.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> 배너 삭제
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-center pt-8">
            <Button onClick={handleAddBanner} variant="outline" className="h-16 px-12 rounded-3xl border-dashed border-2 border-gray-200 text-gray-400 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50 transition-all font-bold group">
              <Plus className="w-5 h-5 mr-3 group-hover:scale-125 transition-transform" /> 새로운 배너 추가
            </Button>
          </div>
        </TabsContent>

        {/* 2. 이벤트 배너 관리 */}
        <TabsContent value="events" className="mt-6 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>상단 이벤트 배너 설정</CardTitle>
              <CardDescription>사이트 최상단에 노출되는 한 줄 공지 배너를 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-purple-50 border border-purple-100">
                <div className="space-y-1">
                  <Label className="text-base font-bold text-purple-900">배너 활성화</Label>
                  <p className="text-xs text-purple-600">ON으로 설정하면 사이트 최상단에 배너가 노출됩니다.</p>
                </div>
                <Switch 
                  checked={siteConfig.event_banner_show || false} 
                  onCheckedChange={val => setSiteConfig({...siteConfig, event_banner_show: val})} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>배너 문구</Label>
                  <Input 
                    value={siteConfig.event_banner_text || ''} 
                    onChange={e => setSiteConfig({...siteConfig, event_banner_text: e.target.value})} 
                    placeholder="예: 2026년 상반기 멤버십 선착순 모집 중! 지금 바로 확인하세요."
                  />
                </div>
                <div className="space-y-2">
                  <Label>연결 링크 (Optional)</Label>
                  <Input 
                    value={siteConfig.event_banner_link || ''} 
                    onChange={e => setSiteConfig({...siteConfig, event_banner_link: e.target.value})} 
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>배너 배경색</Label>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="color" 
                      value={siteConfig.event_banner_bg_color || '#9333ea'} 
                      onChange={e => setSiteConfig({...siteConfig, event_banner_bg_color: e.target.value})} 
                      className="w-20 h-10 p-1"
                    />
                    <Input 
                      value={siteConfig.event_banner_bg_color || '#9333ea'} 
                      onChange={e => setSiteConfig({...siteConfig, event_banner_bg_color: e.target.value})} 
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>텍스트 색상</Label>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="color" 
                      value={siteConfig.event_banner_text_color || '#ffffff'} 
                      onChange={e => setSiteConfig({...siteConfig, event_banner_text_color: e.target.value})} 
                      className="w-20 h-10 p-1"
                    />
                    <Input 
                      value={siteConfig.event_banner_text_color || '#ffffff'} 
                      onChange={e => setSiteConfig({...siteConfig, event_banner_text_color: e.target.value})} 
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border rounded-3xl bg-gray-50 space-y-4">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">미리보기</Label>
                <div 
                  className="w-full py-3 px-4 rounded-xl text-center text-sm font-bold shadow-sm"
                  style={{ 
                    backgroundColor: siteConfig.event_banner_bg_color || '#9333ea',
                    color: siteConfig.event_banner_text_color || '#ffffff'
                  }}
                >
                  {siteConfig.event_banner_text || '배너 문구를 입력해주세요.'}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={async () => {
                    if (siteConfig) {
                      try {
                        const loadingToast = toast.loading('이벤트 배너 내용을 저장 중입니다...');
                        await cmsService.saveSiteConfig(siteConfig);
                        
                        // Refetch to ensure local state and components are in sync
                        const freshConfig = await cmsService.getSiteConfig();
                        setSiteConfig(freshConfig);
                        
                        toast.dismiss(loadingToast);
                        toast.success('이벤트 배너 설정이 저장되었습니다!');
                      } catch (error: any) {
                        console.error('Save error details:', error);
                        const errorMessage = error.message || '저장 중 오류가 발생했습니다.';
                        const isSchemaError = errorMessage.includes('column') || errorMessage.includes('컬럼') || errorMessage.includes('schema');
                        
                        toast.error(
                          <div className="space-y-2">
                            <p className="font-bold whitespace-pre-wrap">{errorMessage}</p>
                            {isSchemaError && (
                              <p className="text-xs opacity-90 p-2 bg-red-50 text-red-700 rounded border border-red-200">
                                데이터베이스 구조(컬럼)가 최신 상태가 아닙니다. <br/>
                                1. 프로젝트 상단의 <strong>"supabase_cms_init.sql"</strong> 파일 내용을 모두 복사하세요. <br/>
                                2. Supabase 관리 화면의 <strong>SQL Editor</strong>에서 실행(Run)해 주세요.
                              </p>
                            )}
                          </div>,
                          { duration: 8000 }
                        );
                      }
                    }
                  }} 
                  className="bg-purple-600 hover:bg-purple-700 gap-2 font-bold px-8"
                >
                  <Save className="w-4 h-4" /> 이벤트 배너 저장하기
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. 커뮤니티 관리 */}
        <TabsContent value="community" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">커뮤니티 관리</h3>
              <p className="text-sm text-gray-500">각 커뮤니티의 상세 설정 및 활성화 기능을 관리합니다.</p>
            </div>
            <Button onClick={() => {
              const newId = `c${Date.now()}`;
              setCommunityCategories([...communityCategories, {
                id: newId,
                name: '새 커뮤니티',
                description: '커뮤니티 설명을 입력하세요.',
                active: true,
                members: 0,
                activeUsers: 0,
                icon: '💬',
                color: 'bg-purple-600',
                banner: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200',
                features: { board: true, chat: true, gallery: false }
              }]);
            }} size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> 새 커뮤니티 추가
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {communityCategories.map((cat) => (
              <Card key={cat.id} className="overflow-hidden border-none shadow-sm">
                <div className="flex flex-col lg:flex-row">
                  <div className="lg:w-1/4 aspect-video lg:aspect-auto bg-gray-100 relative">
                    {cat.banner ? (
                      <img src={cat.banner} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity p-4 text-center">
                      <Label htmlFor={`community-img-${cat.id}`} className="cursor-pointer mb-2">
                        <div className="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 rounded-md inline-flex items-center justify-center gap-2 text-sm font-medium">
                          <ImageIcon className="w-3 h-3" /> 배너 변경
                        </div>
                      </Label>
                      <input 
                        type="file" 
                        id={`community-img-${cat.id}`} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleCommunityBannerUpload(cat.id, e)} 
                      />
                    </div>
                    <div className="absolute top-4 left-4">
                      <div className={`w-12 h-12 rounded-xl ${cat.color} flex items-center justify-center text-xl shadow-lg border-2 border-white/20`}>
                        {cat.icon}
                      </div>
                    </div>
                  </div>
                  <CardContent className="flex-1 p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-4 flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>커뮤니티명</Label>
                            <Input value={cat.name || ''} onChange={e => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, name: e.target.value} : c))} />
                          </div>
                          <div className="space-y-2">
                            <Label>아이콘 (이모지)</Label>
                            <Input value={cat.icon || ''} onChange={e => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, icon: e.target.value} : c))} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>설명</Label>
                          <Input value={cat.description || ''} onChange={e => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, description: e.target.value} : c))} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-4 ml-6">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">활성화</Label>
                          <Switch checked={cat.active} onCheckedChange={val => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, active: val} : c))} />
                        </div>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => {
                          if (!cat.id.toString().startsWith('c')) {
                            await cmsService.deleteCommunityCategory(cat.id);
                          }
                          setCommunityCategories(communityCategories.filter(c => c.id !== cat.id));
                          toast.info('커뮤니티가 삭제되었습니다.');
                        }}>
                          <Trash2 className="w-4 h-4 mr-2" /> 삭제
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t">
                      <div className="space-y-3">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">주요 기능 설정</Label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                            <span className="text-sm font-medium">게시판(Feed)</span>
                            <Switch checked={cat.features.board} onCheckedChange={val => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, features: {...c.features, board: val}} : c))} />
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                            <span className="text-sm font-medium">실시간 채팅</span>
                            <Switch checked={cat.features.chat} onCheckedChange={val => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, features: {...c.features, chat: val}} : c))} />
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                            <span className="text-sm font-medium">갤러리</span>
                            <Switch checked={cat.features.gallery} onCheckedChange={val => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, features: {...c.features, gallery: val}} : c))} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">디자인 설정</Label>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs">테마 컬러 (Tailwind Class)</Label>
                            <Input value={cat.color || ''} onChange={e => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, color: e.target.value} : c))} placeholder="bg-purple-600" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">배너 이미지 URL</Label>
                            <Input value={cat.banner || ''} onChange={e => setCommunityCategories(communityCategories.map(c => c.id === cat.id ? {...c, banner: e.target.value} : c))} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">통계 (관리용)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-400 uppercase">Members</p>
                            <p className="text-lg font-black text-blue-600">{(cat.members || 0).toLocaleString()}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                            <p className="text-[10px] font-bold text-green-400 uppercase">Active</p>
                            <p className="text-lg font-black text-green-600">{(cat.activeUsers || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 4. 페이지 관리 */}
        <TabsContent value="pages" className="mt-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <Layout className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>페이지 구성 관리</CardTitle>
                  <CardDescription>사이트의 주요 페이지 레이아웃과 구성을 설정합니다.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold">라이프코칭 페이지 (HTML 에디터)</h3>
                  <p className="text-sm text-gray-500 mb-2">프론트엔드 코드(HTML+Tailwind CSS)를 입력하여 라이프코칭 메뉴의 페이지를 자유롭게 디자인하세요.</p>
                  <Textarea 
                    value={lifeCoachingHtml}
                    onChange={(e) => setLifeCoachingHtml(e.target.value)}
                    className="w-full h-80 font-mono text-sm bg-gray-900 text-green-400 p-4 rounded-xl"
                    placeholder="<div className='flex items-center justify-center min-h-screen font-bold'>준비중입니다</div>"
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSavePages} className="bg-purple-600 hover:bg-purple-700">설정 저장하기</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. 디자인 테마 */}
        <TabsContent value="courses" className="mt-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>디자인 테마 설정</CardTitle>
                  <CardDescription>강의 목록 및 상세 페이지의 비주얼 스타일을 관리합니다.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 m-6">
              <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500 font-bold">디자인 테마 설정 기능은 현재 준비 중입니다.</p>
              <p className="text-xs text-gray-400 mt-2 text-center">브랜드 아이덴티티에 맞는<br/>글로벌 테마 시스템이 곧 업데이트될 예정입니다.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>브랜드 및 기본 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-base font-bold">사이트 이름</Label>
                  <Input value={siteConfig.site_name || ''} onChange={e => setSiteConfig({...siteConfig, site_name: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <Label className="text-base font-bold">포인트 컬러</Label>
                  <div className="flex items-center gap-4">
                    <Input type="color" value={siteConfig.primary_color || ''} onChange={e => setSiteConfig({...siteConfig, primary_color: e.target.value})} className="w-20 h-10 p-1" />
                    <span className="text-sm font-mono">{siteConfig.primary_color}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-base font-bold">로고 설정</Label>
                  <div className="flex items-center gap-6 p-6 border rounded-2xl bg-gray-50">
                    <div className="w-32 h-12 bg-white rounded border flex items-center justify-center font-bold text-purple-600 overflow-hidden">
                      {siteConfig.logo_url ? <img src={siteConfig.logo_url} alt="Logo" className="max-h-full" /> : siteConfig.site_name}
                    </div>
                    <div>
                      <Label htmlFor="logo-upload" className="cursor-pointer">
                        <div className="border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-md inline-flex items-center justify-center text-sm font-medium">
                          로고 업로드
                        </div>
                      </Label>
                      <input 
                        type="file" 
                        id="logo-upload" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleLogoUpload} 
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-base font-bold">푸터 정보</Label>
                  <textarea 
                    className="w-full h-32 p-4 border rounded-2xl text-sm" 
                    value={siteConfig.footer_info || ''} 
                    onChange={e => setSiteConfig({...siteConfig, footer_info: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { AdminCMS };
