import React from 'react';
import { motion } from 'motion/react';
import { 
  Compass, 
  TrendingUp, 
  Brain, 
  Calendar, 
  ArrowRight, 
  BookOpen, 
  Award, 
  CheckCircle2, 
  Activity, 
  Sparkles, 
  ChevronRight,
  Zap,
  Globe
} from 'lucide-react';

export default function LifeCoaching() {
  // capitalism tech tree diagnostic visualization steps
  const techTreeSteps = [
    {
      level: "Step 01",
      title: "시스템 점검",
      desc: "시스템 점검을 통해 현재 당신의 자본주의 좌표를 정확히 판단합니다.",
      tag: "자료분석"
    },
    {
      level: "Step 02",
      title: "테크트리 6단계 점검",
      desc: "자본주의테크트리 6단계를 점검함으로써 어떤 단계에서 혈이 막혀 있는지를 파악합니다.",
      tag: "혈자리 파악"
    },
    {
      level: "Step 03",
      title: "뚫는 솔루션 제공",
      desc: "몸이 아프면 아픈 곳을 진단해서 그곳을 고쳐야 병이 낫는 것처럼, 그 혈을 찾아서 그곳을 고치는 방법을 알려드립니다.",
      tag: "해결책 수립"
    }
  ];

  const targetAudiences = [
    {
      icon: <Compass className="w-6 h-6 text-indigo-600" />,
      title: "진로",
      subtitle: "시스템의 부품이 아닌 내 인생의 주인이 되고 싶은 분",
      desc: "남들의 규칙 속에 매몰되지 않고 내 주도권을 온전히 가집니다.",
      badge: "진로 독립"
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-emerald-600" />,
      title: "재무",
      subtitle: "내 시간을 벌어다 주는 자산 구조가 절실한 분",
      desc: "시간을 벌어 성장 복리를 극대화하는 자산의 테크트리를 만듭니다.",
      badge: "자산 형성"
    },
    {
      icon: <Brain className="w-6 h-6 text-purple-600" />,
      title: "심리",
      subtitle: "대중에 휩쓸리지 않는 나만의 기준 (Beone Mindset)이 필요한 분",
      desc: "불안해하지 않고 나만의 가치와 단독적인 중심을 세웁니다.",
      badge: "Beone 심리"
    },
    {
      icon: <Calendar className="w-6 h-6 text-amber-600" />,
      title: "계획",
      subtitle: "매일 계획만 하지만 전혀 인생이 나아지지 않는 분",
      desc: "제자리걸음을 극복하고 성장이 누적되는 실질적 룰을 실행합니다.",
      badge: "실행 계획"
    }
  ];

  return (
    <div className="min-h-screen bg-[#FBFBFA] font-sans antialiased selection:bg-purple-100 selection:text-purple-900 text-slate-900">
      
      {/* SECTION 1: ELEGANT HERO */}
      <section className="relative overflow-hidden pt-20 pb-16 sm:pb-24 border-b border-slate-100">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-purple-50/50 via-indigo-50/20 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 text-white font-extrabold text-[11px] tracking-widest uppercase mb-8 shadow-sm"
          >
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            The First Life Coaching
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.25] mb-8"
          >
            '열심히 사는데 왜 나아지지 않을까?'
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-700 font-medium leading-relaxed max-w-2xl mx-auto mb-10 text-left sm:text-center space-y-6"
          >
            <p className="text-slate-700 font-medium">
              학교, 학원, 대학, 직장, 노후, 경쟁. 우리는 알게 모르게 남들이 만들어 놓은 규칙 속에서 나를 소모하고 있습니다. 지금 필요한 건 더 많은 노력이 아니라, 판을 바꾸는 전략입니다. 열심히 살아야 하지만, 열심히만 살아서는 안되는 이유입니다.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 p-6 sm:p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-100/50 text-left max-w-3xl mx-auto relative overflow-hidden"
          >
            <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/5 blur-2xl rounded-full" />
            <h3 className="text-xs font-black text-purple-600 uppercase tracking-widest mb-3 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Core Value Statement
            </h3>
            <p className="text-lg sm:text-xl font-bold text-slate-900 leading-snug tracking-tight">
              더퍼스트라이프코칭은 타인에게 레버리지 당하던 당신의 돈, 시간, 마음의 주도권을 되찾아 <span className="text-purple-600 font-extrabold">'단독자'</span> 로 설 수 있도록 돕습니다.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2: LIFE RULES */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
            
            {/* Left Narrative */}
            <div className="md:col-span-12 space-y-6">
              <div className="inline-block text-xs font-extrabold text-[#9F8A4E] bg-amber-50 border border-amber-100 px-3 py-1 rounded-md">
                인생의 규칙
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight">
                소모되는 시간이 아닌 쌓이고 성장하는 삶의 "룰"
              </h2>
              
              <div className="text-slate-700 space-y-5 font-medium text-base sm:text-lg leading-relaxed">
                <p>
                  우리는 누구나 한 번 뿐인 인생을 살아갑니다. 지금 이 순간도 한 번 사는 시간이 흘러갑니다. 
                  누구나 초보 인생을 살아가지만, 소모되는 시간이 아닌 쌓이고 성장하는 삶에는 룰이 존재합니다. 
                </p>
                <div className="bg-amber-50/50 border-l-4 border-amber-500 p-5 text-slate-800 font-bold text-base sm:text-lg italic rounded-r-xl leading-relaxed">
                  "우리는 그동안 그것을 누군가에게 배우지 못했기 때문에 열심히 하는데도 제자리 걸음이었습니다. 그것은 당신의 잘못이 절대 아닙니다."
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 3: THE BADUK BOARD */}
      <section className="py-16 sm:py-24 bg-slate-50 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-8 sm:p-12 rounded-3xl shadow-2xl relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Globe className="w-56 h-56" />
            </div>
            <div className="relative z-15 max-w-2xl">
              <span className="text-xs font-mono tracking-widest text-[#E6C687] font-extrabold uppercase block mb-3">GO (BADUK) STRATEGY</span>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-6 leading-tight">
                인생의 바둑판에서<br className="sm:hidden" /> 앞으로 가는 수를 두는 법
              </h3>
              <div className="w-12 h-1 bg-amber-500 mb-6" />
              <div className="text-slate-200 text-base sm:text-lg leading-relaxed space-y-4 font-medium">
                <p>
                  더퍼스트라이프코칭은 당신의 인생의 바둑판에서 앞으로 가는 수를 두는 것을 도와드립니다. 
                </p>
                <p>
                  바둑판 한 귀퉁이에서 오목을 두는 게임에서 벗어나 바둑판 전체를 넓게 사용하며 현재 상태를 정밀 진단해서 핵심이 되는 수를 두는 것을 1:1로 도와드립니다. 
                </p>
                <p className="text-white font-extrabold bg-white/10 p-4 rounded-xl border border-white/10 text-base sm:text-lg">
                  "그 수를 두어야 당신은 어제와 다른 오늘을 기대할 수 있습니다."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: WHO NEEDS THIS */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-extrabold text-purple-600 bg-purple-50 px-3 py-1 rounded inline-block uppercase tracking-wider mb-3">
              Target Profile
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              더퍼스트라이프코칭이 필요하신 분
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {targetAudiences.map((aud, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-slate-150 p-6 sm:p-8 rounded-2xl hover:shadow-xl hover:border-purple-200 transition-all duration-300 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {aud.icon}
                    </div>
                    <span className="text-[11px] font-extrabold text-slate-400 border border-slate-200 px-2.5 py-0.5 rounded-full">
                      {aud.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-600 transition-colors">
                    {aud.title}
                  </h3>
                  <p className="text-sm font-black text-purple-600 mt-1.5 mb-3.5 italic">
                    "{aud.subtitle}"
                  </p>
                  <p className="text-sm sm:text-base text-slate-700 font-medium leading-relaxed">
                    {aud.desc}
                  </p>
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-1 text-[11px] font-black text-slate-400 group-hover:text-purple-600 transition-colors">
                  Diagnostic Target Check <ArrowRight className="w-3 h-3 ml-auto animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: CAPITALISM TECH TREE PROCESS */}
      {/* SECTION 5: HOW THE SERVICE WORKS */}
      <section className="py-16 sm:py-24 bg-slate-50 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold text-[#9F8A4E] bg-amber-50 border border-amber-100 px-3 py-1 rounded-md inline-block uppercase tracking-wider mb-3">
              Solution Approach
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-4">
              더퍼스트라이프코칭은,
            </h2>
            <p className="text-slate-700 font-medium text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              시스템 점검을 통해 현재 당신의 자본주의 좌표를 정확히 판단합니다.
              자본주의테크트리 6단계를 점검함으로써 어떤 단계에서 혈이 막혀 있는지를 파악해서 그 혈을 뚫는 솔류션을 제공합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {techTreeSteps.map((step, idx) => (
              <div key={idx} className="bg-white border border-slate-150 p-6 sm:p-8 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-lg font-mono font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg">
                      {step.level}
                    </span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
                      {step.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mb-3 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm sm:text-base text-slate-750 font-medium leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200/80 text-left max-w-3xl mx-auto text-slate-800 text-base sm:text-lg font-medium leading-relaxed flex gap-3.5">
            <div className="w-10 h-10 rounded-full bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              몸이 아프면 아픈 곳을 진단해서 그곳을 고쳐야 병이 낫는 것처럼, 더퍼스트라이프코칭은 그 혈을 찾아서 그곳을 고치는 방법을 알려드립니다.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: COACH PROFILE (유나바머) */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-[#FAF9F5] to-white border-b border-slate-100 relative">
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-amber-500/5 blur-3xl rounded-full" />
        
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center md:text-left mb-12 sm:mb-16">
            <span className="text-xs font-mono tracking-widest text-amber-700 font-extrabold uppercase bg-amber-50 px-2.5 py-1 rounded inline-block">
              HEAD LIFE COACH
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 mt-4 tracking-tight leading-none">
              수석라이프코치 유나바머는,
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Image & Key Books */}
            <div className="md:col-span-4 flex flex-col items-center">
              <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-100 mb-6 relative">
                {/* Fallback image style structure with extremely polished fallback graphic representation */}
                <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-center p-4 text-white relative">
                  <Award className="w-12 h-12 text-yellow-500/80 mb-2" />
                  <span className="font-extrabold text-[15px] block">유나바머 코치님</span>
                  <span className="text-[10px] text-amber-400 font-mono tracking-widest uppercase block mt-1">YUNABOMER</span>
                  
                  <div className="absolute bottom-2 left-0 right-0 text-[9px] bg-black/40 py-1 text-slate-300 font-semibold session-tag">
                    위즈덤하우스 저자
                  </div>
                </div>
              </div>
              
              <div className="w-full text-center p-4 bg-white/70 border border-slate-150 rounded-2xl shadow-xs">
                <p className="text-xs font-extrabold text-slate-800">화제의 신간 저서</p>
                <div className="flex items-center justify-center gap-1.5 mt-2 bg-slate-50 py-1.5 rounded-lg border border-slate-100">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-black text-slate-900">독립 입문서 《더 퍼스트》</span>
                </div>
              </div>
            </div>

            {/* Coach Details Bio */}
            <div className="md:col-span-8 space-y-6 text-slate-800 text-base sm:text-lg leading-relaxed">
              <div className="p-4 bg-white border border-slate-200/60 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5.5 h-5.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-base sm:text-lg font-bold text-slate-800">
                  위즈덤하우스 화제의 신간 <span className="text-slate-950 border-b-2 border-amber-300 font-black">&lt;더 퍼스트&gt;의 저자</span>이자, 8만 명이 구독하는 블로그 <span className="font-black text-slate-950">《시간으로부터의 자유》의 운영자</span>입니다.
                </p>
              </div>

              <div className="space-y-4 font-medium text-slate-700">
                <p>
                  고려대 사회학과 졸업 후 실전 투자와 사업을 통해 자본주의 원리를 깨달았고, 단순한 부의 증식을 넘어 삶의 주도권을 되찾는 [자본주의 테크트리] 이론을 집대성했습니다.
                </p>
                <p className="font-bold text-slate-950">
                  당신의 현재 문제를 정밀 진단하고, 1:1 심층 코칭을 통해 가장 현실적이고 강력한 가이드를 제공하겠습니다.
                </p>
              </div>

              {/* Bio facts list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-200/60">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-slate-900" />
                  고려대 사회학과 졸업
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-slate-900" />
                  8만 구독 블로그 《시간으로부터의 자유》
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-slate-900" />
                  위즈덤하우스 &lt;더 퍼스트&gt; 저자
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-slate-900" />
                  자본주의 테크트리 창시 및 1:1 라이프코칭
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 6: CONSULTING APPLICATION CTA */}
      <section id="apply-form" className="py-16 sm:py-24 bg-[#FAF9F6]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-xl shadow-slate-100/80 text-center relative overflow-hidden">
            
            {/* Top design strip */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500" />

            <div className="max-w-xl mx-auto">
              <span className="text-[10px] font-black tracking-widest text-[#9F8A4E] uppercase bg-amber-50 px-3 py-1 rounded inline-block mb-4">
                The First Core Choice
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                첫 번째(The First) 주도권,<br />이제 당신의 것입니다.
              </h2>
              <p className="text-base sm:text-lg text-slate-700 font-bold mt-4 mb-8 leading-relaxed">
                당신의 현재 문제를 정밀 진단하고, 1:1 심층 코칭을 통해 가장 현실적이고 강력한 가이드를 제공하겠습니다.
              </p>

              <a
                href="https://naver.me/xafHVQdE"
                target="_blank"
                referrerPolicy="no-referrer"
                rel="noreferrer"
                id="coaching-cta-btn"
                className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm tracking-wide shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 transition-all duration-200 gap-2.5 active:scale-[0.99]"
              >
                1:1 더퍼스트라이프코칭 신청하기
                <ArrowRight className="w-5 h-5 text-amber-400" />
              </a>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}

