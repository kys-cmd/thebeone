import React, { useState } from 'react';
import { 
  Type, 
  Sparkles, 
  Check, 
  ArrowRight, 
  RotateCcw,
  Sliders,
  Maximize2,
  ListFilter,
  Layers,
  LayoutGrid,
  Heading,
  FileText,
  BadgeAlert
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function FontDemo() {
  const [playcodeInput, setPlaycodeInput] = useState('BE ONE에서 최고의 기술 스택과 함께 꿈을 현실로 실현해보세요. Success begins here with React, Vite & Pretendard. 1234567890!');
  const [fontWeightVal, setFontWeightVal] = useState<number>(500);
  const [fontSizeVal, setFontSizeVal] = useState<number>(18);
  const [letterSpacing, setLetterSpacing] = useState<string>('tracking-normal');
  const [lineHeight, setLineHeight] = useState<string>('leading-relaxed');

  const customWeightStyle = {
    fontWeight: fontWeightVal,
    fontSize: `${fontSizeVal}px`,
  };

  const fontsToTest = [
    {
      name: '대시보드 메인 타이틀 (Bold)',
      desc: '메인 헤드라인, 핵심 지표 숫자, 요약 카드에 주로 배치하기에 가장 적당하며 강력한 주목도를 가집니다. Geist 영문 폰트의 정교한 숫자/알파벳 비례와 Pretendard 가변 굵기(font-extrabold/bold)가 완벽하게 결합되어 가독성을 유지하며 깊은 세련됨을 뽐냅니다.',
      classes: 'text-2xl md:text-4xl font-extrabold tracking-tight leading-tight text-slate-900',
      sampleText: '비원(Be One)의 교육 가치 창출을 위한 대시보드 메트릭스 : ￦128,450,000 Sales'
    },
    {
      name: '사용자 가이드 & 정보 본문 (Regular)',
      desc: '일반 설명, 수강 세션 텍스트, 아키텍처 문서의 구조적 장문에 적합합니다. 자간 및 고정 피치가 매우 눈에 유연하게 흐르고, 윈도우/맥 가림 없이 수려하고 풍부한 렌더 가독성을 선사합니다.',
      classes: 'text-base font-normal tracking-wide leading-relaxed text-slate-700',
      sampleText: '본 플랫폼은 전 세계에서 활동하는 예비 개발자 및 교육 설계자를 위해 완전히 통합된 풀스택 학습 경험(LMS)을 지향하며, 모든 프론트엔드 모듈은 실시간 통신 파이프라인의 이벤트를 청취하고 렌더링을 최적화하도록 엄격하게 구현되었습니다.'
    },
    {
      name: '기타 피드백 & 부가 주석 캡션 (Light)',
      desc: '피드백 코멘트, 타임스탬프, 부설 데이터, 가이드 문장 하위 캡션에 고상하게 어우러지는 얇은 스타일로, 불필요한 무게감을 덜고 우아한 느낌을 불어넣습니다.',
      classes: 'text-xs md:text-sm font-light tracking-wider leading-normal text-slate-400',
      sampleText: '※ 본 가독성 디포짓은 Geist 및 Pretendard Variable CDN을 통해 전역 실시간 수집되며, 다차원 모바일 반응형 프레임워크에서도 균형 잡힌 가변 축을 유지합니다.'
    }
  ];

  return (
    <div className="space-y-8 select-none">
      {/* ─────────────────── [HEADER SECTION] ─────────────────── */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-purple-600">
          <Type className="w-5 h-5 text-purple-600 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest">Aesthetic typography validator</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">전역 가변 폰트(Pretendard Variable & Geist) 통합 검증</h1>
        <p className="text-sm text-slate-500 font-bold leading-relaxed">
          한글 완성도 최정상의 <span className="text-purple-600">Pretendard Variable</span> 가변 폰트와 최고급 모던 영문 폰트인 <span className="text-purple-600">Geist</span> 간의 완벽한 결합을 테스트합니다.<br />
          서로 다른 언어 환경에서도 이질감 없는 하이브리드 한-영 폰트 스택의 극상 퀄리티 렌더링을 이곳에서 실시간으로 진단하세요.
        </p>
      </div>

      {/* ─────────────────── [FONT PLAYGROUND - INTERACTIVE] ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Testing Controls Panel */}
        <Card className="lg:col-span-1 p-6 bg-white border border-gray-150 rounded-3xl shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-50">
            <Sliders className="w-4 h-4 text-purple-600" />
            <h3 className="font-black text-slate-900 text-sm">타이포 최적화 컨트롤 조절기</h3>
          </div>

          {/* Weight Range (100 to 900) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-black">
              <span className="text-slate-500">실시간 가변 두께 (Weight)</span>
              <span className="text-purple-600 font-mono text-sm">{fontWeightVal}</span>
            </div>
            <input 
              type="range" 
              min="100" 
              max="900" 
              step="50"
              value={fontWeightVal}
              onChange={(e) => setFontWeightVal(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>Thin (100)</span>
              <span>Medium (500)</span>
              <span>Black (900)</span>
            </div>
          </div>

          {/* Font Size Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-black">
              <span className="text-slate-500">실시간 가변 크기 (Size)</span>
              <span className="text-purple-600 font-mono text-sm">{fontSizeVal}px</span>
            </div>
            <input 
              type="range" 
              min="12" 
              max="48" 
              step="1"
              value={fontSizeVal}
              onChange={(e) => setFontSizeVal(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>Caption (12px)</span>
              <span>Base (16px)</span>
              <span>Headline (48px)</span>
            </div>
          </div>

          {/* Letter Spacing Selector */}
          <div className="space-y-2">
            <span className="text-xs font-black text-slate-500 block">자간 (Letter Spacing)</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'tracking-tighter', l: 'Tighter' },
                { k: 'tracking-normal', l: 'Normal' },
                { k: 'tracking-wider', l: 'Wider' }
              ].map((x) => (
                <button
                  key={x.k}
                  onClick={() => setLetterSpacing(x.k)}
                  className={`py-1.5 rounded-xl border text-[11px] font-black transition-all ${
                    letterSpacing === x.k 
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-150 hover:bg-slate-50'
                  }`}
                >
                  {x.l}
                </button>
              ))}
            </div>
          </div>

          {/* Line Height Selector */}
          <div className="space-y-2">
            <span className="text-xs font-black text-slate-500 block">줄 간격 (Line Height)</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'leading-none', l: 'None' },
                { k: 'leading-normal', l: 'Normal' },
                { k: 'leading-relaxed', l: 'Relaxed' }
              ].map((x) => (
                <button
                  key={x.k}
                  onClick={() => setLineHeight(x.k)}
                  className={`py-1.5 rounded-xl border text-[11px] font-black transition-all ${
                    lineHeight === x.k 
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-150 hover:bg-slate-50'
                  }`}
                >
                  {x.l}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">설정 리셋</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFontWeightVal(500);
                setFontSizeVal(18);
                setLetterSpacing('tracking-normal');
                setLineHeight('leading-relaxed');
              }}
              className="rounded-xl border-slate-200 text-slate-500 text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </Card>

        {/* Real-time Rendering Playground Card */}
        <Card className="lg:col-span-2 p-6 bg-white border border-gray-150 rounded-3xl shadow-sm flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="font-black text-slate-900 text-sm">실시간 렌더링 플레이그라운드</h3>
            </div>
            <div className="px-2.5 py-0.5 bg-emerald-50 rounded-full border border-emerald-100 text-[10px] font-black text-emerald-700">
              ● Active Web Font Smoothing
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-black text-slate-600 block">원하는 텍스트 내용을 입력하고 가변성을 관찰하세요 :</span>
            <textarea
              value={playcodeInput}
              onChange={(e) => setPlaycodeInput(e.target.value)}
              className="w-full p-4 rounded-2xl border border-slate-200 text-xs font-bold font-sans h-20 focus:border-purple-600 focus:outline-none transition-colors"
              placeholder="테스트하고 싶은 구문을 타이핑하세요..."
            />
          </div>

          {/* Main Visualizer Area */}
          <div className="flex-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex items-center justify-center min-h-[160px] overflow-hidden">
            <div 
              style={customWeightStyle}
              className={`text-slate-900 w-full font-sans transition-all select-text whitespace-pre-wrap break-all ${letterSpacing} ${lineHeight}`}
            >
              {playcodeInput || '텍스트를 입력해 주세요.'}
            </div>
          </div>
        </Card>
      </div>

      {/* ─────────────────── [RECOMMENDED TYPOGRAPHY COMBINATIONS] ─────────────────── */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-gray-50">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600" />
            UI/UX 세 가지 핵심 가변 타이포 스택 가이드라인
          </h2>
          <span className="text-xs font-bold text-slate-400">
            Platform Recommended
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {fontsToTest.map((item, idx) => (
            <Card key={idx} className="p-5 bg-slate-50/20 border border-slate-100 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center font-bold text-xs">
                    {idx + 1}
                  </div>
                  <h4 className="font-black text-slate-800 text-xs">{item.name}</h4>
                </div>
                <p className="text-xs text-slate-400 font-bold leading-normal">
                  {item.desc}
                </p>
                <div className="p-3 bg-white/70 rounded-xl border border-dotted border-purple-200">
                  <span className="font-mono text-[10px] text-purple-700 block font-black select-all mb-1.5">
                    Tailwind: {item.classes}
                  </span>
                </div>
              </div>

              {/* actual render preview */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mb-1">실시간 렌더링 프리뷰</p>
                <p className={`${item.classes} p-1 text-slate-900 select-text`}>
                  {item.sampleText}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ─────────────────── [DIAGNOSTICS & COMPARISON DATA] ─────────────────── */}
      <div className="bg-slate-900 text-slate-100 rounded-3xl p-8 space-y-6">
        <div className="space-y-1.5">
          <h3 className="font-black text-lg flex items-center gap-2 text-purple-400">
            <LayoutGrid className="w-5 h-5 text-purple-400" />
            가변 수치 가독성 가이드라인 및 맥/윈도우 렌더 원리
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            Pretendard Variable 가변 폰트은 단순히 정해진 굵기(Static Light/Bold)에 한정되지 않고, 소수점 단위의 다차원 축 조절을 지원합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 font-bold leading-relaxed">
          <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="font-black text-purple-300 flex items-center gap-1.5 pb-2 border-b border-slate-800">
              <Check className="w-4 h-4 text-emerald-400" />
              Windows 기기 튜닝 (DirectWrite & ClearType)
            </h4>
            <p>
              Windows 브라우저는 렌더링 시 간헐적으로 폰트 엣지의 가독성이 뭉개지는 성향이 존재합니다. 우리는 <code className="bg-slate-700 text-purple-200 px-1 py-0.5 rounded font-mono font-black">text-rendering: optimizeLegibility</code>와 <code className="bg-slate-700 text-purple-200 px-1 py-0.5 rounded font-mono font-black">-webkit-font-smoothing</code> 프리셋을 전역으로 주입하여, Windows 화면에서도 굴절이 깨지지 않는 또렷한 계단식 계조 정돈 렌더를 보완하였습니다.
            </p>
          </div>
          
          <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="font-black text-purple-300 flex items-center gap-1.5 pb-2 border-b border-slate-800">
              <Check className="w-4 h-4 text-emerald-400" />
              macOS 기기 튜닝 (Quartz & CoreText)
            </h4>
            <p>
              Mac은 기본적으로 서브픽셀 픽셀 레이아웃상 자모가 진하게 표현되는 성향을 갖습니다. 이에 <code className="bg-slate-700 text-purple-200 px-1 py-0.5 rounded font-mono font-black">-moz-osx-font-smoothing: grayscale</code> 필터를 바인딩해, 모니터 명암비 상황에서도 지나친 번짐을 방지하고 매우 럭셔리하면서 가볍게 읽히는 인쇄물 같은 가독성을 완성합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
