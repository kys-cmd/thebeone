import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  Save, 
  Globe, 
  ShieldCheck, 
  Mail, 
  Key,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Loader2,
  Building2,
  Zap,
  FileUp,
  CheckCircle2,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  cmsService, 
  SiteConfig, 
  PaymentSettings 
} from '@/services/cmsService';
import { supabase } from '@/lib/supabase';
import { storageService } from '@/services/storageService';

const PG_COMPANIES = [
  { id: 'html5_inicis', name: 'KG이니시스' },
  { id: 'kcp', name: 'NHNKCP' },
  { id: 'uplus', name: '토스페이먼츠(LG유플러스)' },
  { id: 'mobilians', name: '모빌리언스' }
];

const PAYMENT_METHODS_PG = [
  { id: 'card', name: '신용카드' },
  { id: 'bank', name: '실시간계좌이체' },
  { id: 'vbank', name: '가상계좌' },
  { id: 'phone', name: '휴대폰결제' }
];

const INSTALLMENT_MONTHS = [
  { id: '0', name: '일시불' },
  { id: '2', name: '2개월' },
  { id: '3', name: '3개월' },
  { id: '4', name: '4개월' },
  { id: '5', name: '5개월' },
  { id: '6', name: '6개월' },
  { id: '7', name: '7개월' },
  { id: '8', name: '8개월' },
  { id: '9', name: '9개월' },
  { id: '10', name: '10개월' },
  { id: '11', name: '11개월' },
  { id: '12', name: '12개월' }
];

const PAYMENT_METHODS_DIRECT = [
  { id: 'bank_transfer', name: '무통장 입금' },
  { id: 'coupon', name: '쿠폰 결제' }
];

export default function AdminSystemSettings() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Payment Settings State
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    pg_id: '',
    pg_company: 'html5_inicis',
    pg_mode: 'test',
    inicis_sign_key: '',
    payment_methods_pg: ['card'],
    installment_months: ['0'],
    payment_methods_direct: ['bank_transfer']
  });
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const [configData, paymentData] = await Promise.all([
          cmsService.getSiteConfig(),
          cmsService.getPaymentSettings()
        ]);
        
        setConfig(configData);
        setPaymentSettings(paymentData);
      } catch (error) {
        toast.error('설정을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      // Save Site Config
      await cmsService.saveSiteConfig(config);
      
      // Save Payment Settings
      await cmsService.savePaymentSettings(paymentSettings);

      toast.success('설정이 안전하게 저장되었습니다.');
    } catch (error: any) {
      toast.error(error.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaymentKeyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await storageService.uploadFile(file, 'system');
      setPaymentSettings(prev => ({ ...prev, inicis_key_url: result.url }));
      toast.success('KEY 파일이 업로드되었습니다.');
    } catch (error) {
      toast.error('파일 업로드에 실패했습니다.');
    }
  };

  const togglePaymentArrayItem = (field: 'payment_methods_pg' | 'installment_months' | 'payment_methods_direct', value: string) => {
    setPaymentSettings(prev => {
      const current = prev[field];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(item => item !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `site/${fileName}`;

      const { data, error } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath);

      setConfig(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      toast.success('로고가 업로드되었습니다.');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('로고 업로드 실패: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">시스템 설정</h1>
          <p className="text-muted-foreground mt-1">플랫폼의 전반적인 환경과 보안, 외부 연동 설정을 관리합니다.</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="gap-2 bg-purple-600 hover:bg-purple-700"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          변경사항 저장
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 mb-8">
          <TabsTrigger value="general" className="py-2.5">일반 설정</TabsTrigger>
          <TabsTrigger value="security" className="py-2.5">보안 및 인증</TabsTrigger>
          <TabsTrigger value="notification" className="py-2.5">알림 설정</TabsTrigger>
          <TabsTrigger value="integration" className="py-2.5">외부 연동</TabsTrigger>
          <TabsTrigger value="payment" className="py-2.5">결제 환경</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                <CardTitle>기본 정보 및 브랜딩</CardTitle>
              </div>
              <CardDescription>사이트 제목, 로고, 푸터 정보 등 기본 브랜딩 설정입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="site_name">사이트 이름</Label>
                    <Input 
                      id="site_name" 
                      value={config?.site_name || ''} 
                      onChange={(e) => setConfig(prev => prev ? { ...prev, site_name: e.target.value } : null)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="footer_info">푸터 정보</Label>
                    <Textarea 
                      id="footer_info" 
                      value={config?.footer_info || ''} 
                      onChange={(e) => setConfig(prev => prev ? { ...prev, footer_info: e.target.value } : null)}
                      className="min-h-[120px] text-sm leading-relaxed"
                      placeholder="상호명, 대표자, 사업자번호, 주소 등 푸터에 표시될 내용을 입력하세요."
                    />
                  </div>
                </div>

                <div className="grid gap-4">
                  <Label>사이트 로고</Label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-4 bg-gray-50/50">
                    {config?.logo_url ? (
                      <div className="relative group">
                        <img src={config.logo_url} alt="Logo Preview" className="h-[25px] object-contain" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => fileInputRef.current?.click()}
                          >
                            교체
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="w-10 h-10 opacity-20" />
                        <p className="text-xs">업로드된 로고가 없습니다.</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                    <Button 
                      variant="outline" 
                      className="gap-2" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      로고 업로드
                    </Button>
                    <p className="text-[10px] text-muted-foreground">투명 배경의 PNG 또는 SVG 포맷을 권장합니다. (최대 2MB)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>유지보수 모드</CardTitle>
              <CardDescription>사이트 점검 시 일반 사용자의 접속을 제한합니다.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>전체 점검 모드 활성화</Label>
                <p className="text-xs text-muted-foreground">관리자 계정 외에는 공지 페이지가 노출됩니다.</p>
              </div>
              <Switch />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-red-600" />
                <CardTitle>보안 정책 설정</CardTitle>
              </div>
              <CardDescription>사용자 인증 및 비밀번호 보안 정책을 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>비밀번호 복잡성 요구</Label>
                  <p className="text-xs text-muted-foreground">특수문자, 대문자 포함 강제</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label>2단계 인증 (2FA) 권장</Label>
                  <p className="text-xs text-muted-foreground">로그인 시 OTP 또는 SMS 인증 추가</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label>중복 로그인 제한</Label>
                  <p className="text-xs text-muted-foreground">동일 계정의 동시 접속 세션 수 제한</p>
                </div>
                <Input type="number" className="w-20" defaultValue="1" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integration" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                <CardTitle>API 및 외부 SDK 연동</CardTitle>
              </div>
              <CardDescription>Gemini, Supabase 등 핵심 서비스 인증 키를 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label>Gemini API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input 
                      type={showApiKey ? "text" : "password"} 
                      defaultValue="AIzaSyA_example_key_123456789" 
                      readOnly
                    />
                    <button 
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-900"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button variant="outline">재발급 요청</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notification" className="space-y-6">
          <Card>
            <CardHeader>
               <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <CardTitle>이메일/SMS 발송 서버</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label>발신자 이메일</Label>
                <Input defaultValue="noreply@beone.edu" />
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                 <div className="space-y-0.5">
                    <Label>신규 가입 환영 이메일 자동 발송</Label>
                 </div>
                 <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* KG 이니시스 연동 설정 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                    <CardTitle>KG 이니시스 결제 설정</CardTitle>
                  </div>
                  <CardDescription>KG 이니시스 가맹점 정보 및 연동 키를 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>상점아이디 (MID)</Label>
                      <Input 
                        value={paymentSettings.pg_id || ''} 
                        onChange={e => setPaymentSettings({...paymentSettings, pg_id: e.target.value})}
                        placeholder="INIpayTest"
                      />
                      <p className="text-[10px] text-muted-foreground font-black text-purple-600">KG 이니시스 발급 MID (예: MOIsample)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>표준 사인키 (SignKey)</Label>
                      <Input 
                        value={paymentSettings.inicis_sign_key || ''} 
                        onChange={e => setPaymentSettings({...paymentSettings, inicis_sign_key: e.target.value})}
                        placeholder="SignKey 입력"
                      />
                      <p className="text-[10px] text-muted-foreground">이니시스 가맹점 관리자 {'->'} 변경/추가 {'->'} API 요청정보</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>연동 환경</Label>
                      <div className="flex p-1 bg-gray-50 rounded-lg border">
                        <button 
                          onClick={() => setPaymentSettings({...paymentSettings, pg_mode: 'test'})}
                          className={`flex-1 py-2 rounded-md text-xs font-black transition-all ${paymentSettings.pg_mode === 'test' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400 hover:text-gray-900'}`}
                        >
                          테스트 (Test)
                        </button>
                        <button 
                          onClick={() => setPaymentSettings({...paymentSettings, pg_mode: 'live'})}
                          className={`flex-1 py-2 rounded-md text-xs font-black transition-all ${paymentSettings.pg_mode === 'live' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
                        >
                          실운영 (Live)
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>내부 요정 ID (IMP_ID)</Label>
                      <Input 
                        value={paymentSettings.portone_store_id || ''} 
                        onChange={e => setPaymentSettings({...paymentSettings, portone_store_id: e.target.value})}
                        placeholder="imp00000000"
                        className="bg-gray-50"
                      />
                      <p className="text-[10px] text-muted-foreground">이 단계는 관리자 전용 설정입니다.</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label className="text-gray-400 font-bold">이니시스 키 파일 (ZIP/KEY)</Label>
                    <div className="flex gap-2">
                      <Input 
                        readOnly 
                        value={paymentSettings.inicis_key_url ? paymentSettings.inicis_key_url.split('/').pop() : '상점 키 파일 없음'}
                        className="bg-gray-100 text-xs text-gray-400"
                      />
                      <Label htmlFor="key-file-upload" className="cursor-not-allowed opacity-50">
                        <div className="h-10 px-4 rounded-md border bg-background flex items-center justify-center text-sm font-medium">
                          <Upload className="w-4 h-4 mr-2" /> 파일 업로드
                        </div>
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 결제 수단 */}
              <Card>
                <CardHeader>
                  <CardTitle>결제 수단 및 할부</CardTitle>
                  <CardDescription>지원할 결제 방법과 할부 개월 수를 구성합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">PG 결제 수단</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {PAYMENT_METHODS_PG.map(method => (
                        <div 
                          key={method.id}
                          onClick={() => togglePaymentArrayItem('payment_methods_pg', method.id)}
                          className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                            paymentSettings.payment_methods_pg.includes(method.id)
                              ? 'border-purple-600 bg-purple-50 text-purple-600'
                              : 'border-gray-100 text-gray-400'
                          }`}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${paymentSettings.payment_methods_pg.includes(method.id) ? 'opacity-100' : 'opacity-20'}`} />
                          <span className="text-xs font-bold">{method.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">기타 결제 방식</Label>
                    <div className="flex flex-wrap gap-3">
                      {PAYMENT_METHODS_DIRECT.map(method => (
                        <div 
                          key={method.id}
                          onClick={() => togglePaymentArrayItem('payment_methods_direct', method.id)}
                          className={`p-3 min-w-[120px] rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                            paymentSettings.payment_methods_direct.includes(method.id)
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                              : 'border-gray-100 text-gray-400'
                          }`}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${paymentSettings.payment_methods_direct.includes(method.id) ? 'opacity-100' : 'opacity-20'}`} />
                          <span className="text-xs font-bold">{method.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">보안 및 지침</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-amber-50 rounded-xl space-y-2 border border-amber-100">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-bold">중요</span>
                    </div>
                    <p className="text-[11px] text-amber-900/70 leading-relaxed italic">
                      PG 연동 정보는 실제 결제와 직결되므로 운영 모드 변경 전 반드시 테스트를 진행하세요.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b text-xs">
                      <span className="text-gray-400">PG 상태</span>
                      <span className={`font-bold ${paymentSettings.pg_mode === 'live' ? 'text-green-600' : 'text-amber-600'}`}>
                        {paymentSettings.pg_mode === 'live' ? 'LIVE' : 'TEST'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b text-xs">
                       <span className="text-gray-400">선택된 PG사</span>
                       <span className="font-bold">{PG_COMPANIES.find(c => c.id === paymentSettings.pg_company)?.name}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
