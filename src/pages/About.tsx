import React from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Target, Zap, Heart, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Brand Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center pt-20 px-4 relative overflow-hidden bg-white">
        <div className="container mx-auto text-center space-y-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="flex justify-center"
          >
            <div className="w-20 h-20 bg-purple-600 rounded-[24px] flex items-center justify-center shadow-2xl shadow-purple-200">
               <span className="text-white text-4xl font-black">B</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-gray-900 leading-[1.05]">
              당신의 성장을 위한<br />
              <span className="text-purple-600 underline decoration-purple-100 decoration-8 underline-offset-8">완벽한 마침표.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 font-medium tracking-tight max-w-3xl mx-auto leading-relaxed">
              비원아카데미는 단순한 교육을 넘어 실전 전문가들의 암묵지를 명시지로 전환하여{'\n'}
              개인의 가치를 극대화하는 프리미엄 지식 플랫폼입니다.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="pt-12"
          >
            <ChevronDown className="w-8 h-8 text-gray-300 mx-auto animate-bounce" />
          </motion.div>
        </div>
        
        {/* Background Text Decor */}
        <div className="absolute top-[30%] -left-10 text-[20vw] font-black text-gray-50/50 pointer-events-none select-none tracking-tighter">
          BE ONE ACADEMY
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-40 bg-gray-50 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <div className="space-y-4">
                <Badge className="bg-purple-600 text-white font-black px-4 py-1.5 border-none">PHILOSOPHY</Badge>
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-gray-900 leading-tight">
                  우리가 교육을<br />바라보는 세 가지 시선
                </h2>
              </div>
              
              <div className="space-y-8">
                {[
                  { icon: <Target />, title: "본질에 집중합니다", desc: "이론적인 나열이 아닌, 현장에서 바로 쓰이는 핵심 논리만을 전달합니다." },
                  { icon: <Zap />, title: "압도적으로 효율적입니다", desc: "커리큘럼 설계에만 최소 3개월을 투자하여, 최소 시간 최대 효율을 지향합니다." },
                  { icon: <ShieldCheck />, title: "검증이 우선입니다", desc: "현업에서 실력을 인정받은 상위 1% 실전 전문가들만이 비원아카데미와 함께합니다." }
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    whileInView={{ x: [20, 0], opacity: [0, 1] }}
                    className="flex gap-6 items-start"
                  >
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-sm border border-gray-100 flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-bold text-gray-900">{item.title}</h4>
                      <p className="text-gray-500 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square bg-purple-600 rounded-[80px] rotate-3 overflow-hidden shadow-2xl">
                 <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover opacity-80" alt="" />
              </div>
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white p-8 rounded-[40px] shadow-2xl border border-gray-100 space-y-4 -rotate-6">
                 <div className="flex items-center gap-3">
                   <div className="flex -space-x-4">
                     {[1,2,3].map(i => <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden"><img src={`https://i.pravatar.cc/150?u=${i}`} alt="" /></div>)}
                   </div>
                   <span className="text-xs font-black text-gray-400">+50,000</span>
                 </div>
                 <p className="font-black text-purple-600 text-lg leading-tight">누적 수강생들이 입증하는 압도적인 만족도</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-40 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center space-y-4 mb-32">
            <Badge className="bg-gray-100 text-gray-400 font-black px-4 py-1.5 border-none uppercase tracking-widest">Growth Timeline</Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-gray-900">비원아카데미와 함께<br />그려갈 당신의 지도</h2>
          </div>

          <div className="relative border-l-2 border-gray-100 ml-6 md:ml-0 md:left-1/2 space-y-24">
            {[
              { year: "Phase 01", title: "암묵지의 발견", desc: "막연했던 고민들을 구체화하고 전문가의 실전 로직을 처음 마주하는 단계입니다." },
              { year: "Phase 02", title: "지식의 내재화", desc: "체계적인 커리큘럼과 과제를 통해 학습한 내용을 온전히 자신의 지식으로 다집니다." },
              { year: "Phase 03", title: "실전 네트워크", desc: "같은 목표를 가진 수강생들과 소통하며 혼자서는 불가능한 기회들을 발견합니다." },
              { year: "Phase 04", title: "가치의 완성", desc: "배운 것을 넘어 직접 실행하고 자신의 영역에서 상위 1%의 가치를 만들어냅니다." }
            ].map((step, i) => (
              <motion.div 
                key={i}
                whileInView={{ y: [40, 0], opacity: [0, 1] }}
                className="relative pl-12 md:pl-0"
              >
                <div className={`md:flex md:items-center ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                  <div className="absolute left-[-11px] md:left-1/2 md:translate-x-[-50%] top-0 w-5 h-5 rounded-full bg-white border-4 border-purple-600 shadow-xl" />
                  <div className={`md:w-1/2 ${i % 2 === 0 ? 'md:pr-20' : 'md:pl-20'}`}>
                    <span className="text-purple-600 font-black text-sm tracking-widest block mb-4">{step.year}</span>
                    <h3 className="text-3xl font-black text-gray-900 mb-6 tracking-tight line-clamp-1">{step.title}</h3>
                    <p className="text-lg text-gray-500 font-medium leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 bg-purple-600 relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10 space-y-12">
          <h2 className="text-4xl md:text-7xl font-black text-white tracking-tighter leading-tight">
            어제와 다른 오늘을 위해,{'\n'}비원아카데미가 함께합니다.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-50 h-20 px-12 text-2xl font-black rounded-3xl shadow-2xl">
               지금 바로 합류하기
             </Button>
             <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 h-20 px-12 text-2xl font-black rounded-3xl backdrop-blur-md">
               강의 무료 맛보기
             </Button>
          </div>
        </div>
        
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-900/40 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
      </section>
    </div>
  );
}
