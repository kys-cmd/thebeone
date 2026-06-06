import React from 'react';
import { motion } from 'motion/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap,
  Sparkles,
  ArrowRight,
  Monitor
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function TechTreePage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col pt-[70px]">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-xl w-full text-center space-y-12">
          {/* Visual Element */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative mx-auto w-40 h-40"
          >
            <div className="absolute inset-0 bg-purple-600/10 rounded-[48px] animate-pulse" />
            <div className="absolute inset-4 bg-purple-600/20 rounded-[40px] animate-pulse [animation-delay:0.2s]" />
            <div className="absolute inset-8 bg-purple-600 rounded-[32px] shadow-2xl shadow-purple-200 flex items-center justify-center text-white">
              <Zap className="w-12 h-12 fill-current" />
            </div>
            
            {/* Floating items */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center text-red-500"
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>
          </motion.div>

          {/* Text Content */}
          <div className="space-y-6">
            <Badge className="bg-purple-100 text-purple-600 border-none px-4 py-1 rounded-full font-black text-xs uppercase tracking-widest">
              Coming Soon
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter leading-tight">
              자본주의 테크트리 <br />
              <span className="text-purple-600">서비스 준비 중</span>
            </h1>
            <p className="text-gray-500 font-bold text-lg leading-relaxed max-w-md mx-auto">
              당신만의 압도적인 재테크 로드맵을 그려줄 AI 기반 <br className="hidden md:block" /> 
              자본주의 테크트리 서비스가 곧 공개됩니다.
            </p>
          </div>

          {/* Action */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link 
              to="/"
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-16 px-10 rounded-[24px] bg-gray-900 hover:bg-gray-800 text-white font-black text-lg gap-3 transition-all hover:scale-105 active:scale-95 flex items-center justify-center border-none"
              )}
            >
              홈으로 돌아가기
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Bottom Info */}
          <div className="pt-20 border-t border-gray-100">
            <div className="flex items-center justify-center gap-6 text-gray-400 font-bold text-sm">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" /> PC 버전 제작 중
              </div>
              <div className="w-1 h-1 bg-gray-300 rounded-full" />
              <div>2026. 06. OPEN 예정</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
