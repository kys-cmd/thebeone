import React from 'react';
import { motion } from 'motion/react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function MembershipPage() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#f8fafc] flex flex-col py-12 sm:py-20">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-xl w-full text-center space-y-8 sm:space-y-10">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45 }}
            className="relative mx-auto w-28 h-28 sm:w-36 sm:h-36"
          >
            <div className="absolute inset-0 bg-purple-600/10 rounded-xl sm:rounded-2xl animate-pulse" />
            <div className="absolute inset-3 sm:inset-4 bg-purple-600/20 rounded-xl sm:rounded-xl animate-pulse [animation-delay:0.2s]" />
            <div className="absolute inset-6 sm:inset-8 bg-purple-600 rounded-lg sm:rounded-xl shadow-2xl shadow-purple-200 flex items-center justify-center text-white">
              <Award className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-9 h-9 sm:w-11 sm:h-11 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center text-purple-600"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.div>
          </motion.div>

          <div className="space-y-3 sm:space-y-4">
            <Badge className="bg-purple-100 text-purple-600 border-none px-4 py-1 rounded-full font-black text-xs uppercase tracking-widest">
              BeOne Membership
            </Badge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight">
              비원 멤버십
            </h1>
            <p className="text-gray-600 font-extrabold text-lg sm:text-xl md:text-2xl pt-1 sm:pt-2">
              메뉴 준비 중입니다.
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Link
              to="/"
              className={cn(
                buttonVariants({ variant: 'default' }),
                'h-14 px-8 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-black text-base gap-2.5 transition-all hover:scale-105 active:scale-95 flex items-center justify-center border-none'
              )}
            >
              홈으로 돌아가기
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
