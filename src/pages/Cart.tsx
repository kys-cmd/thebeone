import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Trash2, ChevronRight, CreditCard, ShieldCheck, ArrowLeft, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';

const MOCK_ITEMS: any[] = [];

export default function Cart() {
  const [items, setItems] = useState(MOCK_ITEMS);
  const subtotal = items.reduce((acc, item) => acc + item.price, 0);

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-12">
            <h1 className="text-4xl font-black tracking-tighter text-gray-900">수강 바구니</h1>
            <Badge className="bg-purple-600 text-white font-black px-4 py-1 border-none text-sm">{items.length}개의 강의</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Left: Items List */}
          <div className="lg:col-span-2 space-y-6">
            {items.length > 0 ? (
              items.map((item) => (
                <motion.div 
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center"
                >
                  <div className="w-full md:w-48 aspect-[16/10] bg-gray-100 rounded-3xl overflow-hidden shrink-0 border border-gray-50">
                    <img src={item.thumbnail} className="w-full h-full object-cover" alt="" />
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-black text-purple-600">{item.instructor}</p>
                      <h3 className="text-xl font-black text-gray-900 leading-tight">{item.title}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                      <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> 평생 소장</span>
                      <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> 즉시 수강 가능</span>
                    </div>
                  </div>

                  <div className="text-right space-y-4 w-full md:w-auto">
                    <p className="text-2xl font-black text-gray-900">{item.price.toLocaleString()}원</p>
                    <button 
                      onClick={() => setItems(items.filter(i => i.id !== item.id))}
                      className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-40 bg-white rounded-[48px] border border-dashed text-center space-y-6">
                 <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                   <ShoppingCart className="w-10 h-10" />
                 </div>
                 <p className="text-gray-400 font-bold">바구니가 비어있습니다.</p>
                 <Link to="/courses">
                   <Button variant="outline" className="h-12 px-8 rounded-2xl font-black">강의 보러가기</Button>
                 </Link>
              </div>
            )}
          </div>

          {/* Right: Summary & Order */}
          <aside className="space-y-6 sticky top-32">
             <Card className="rounded-[48px] shadow-xl border-none overflow-hidden">
                <div className="p-10 space-y-8">
                   <h3 className="text-2xl font-black tracking-tighter text-gray-900">결제 정보</h3>
                   
                   <div className="space-y-4">
                      <div className="flex justify-between font-bold text-gray-500">
                         <span>상품 금액</span>
                         <span>{subtotal.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between font-bold text-red-500">
                         <span>할인 금액</span>
                         <span>-0원</span>
                      </div>
                      <div className="pt-4 border-t flex justify-between items-end">
                         <span className="font-black text-gray-900">최종 결제 금액</span>
                         <span className="text-3xl font-black text-purple-600 tracking-tighter">{subtotal.toLocaleString()}원</span>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="relative">
                         <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                         <Input 
                           placeholder="쿠폰 번호를 입력하세요" 
                           className="h-12 pl-12 bg-gray-50 border-gray-100 rounded-2xl font-bold"
                         />
                      </div>
                      <Button className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-purple-200">
                        결제하기
                      </Button>
                   </div>
                </div>
                
                <div className="bg-gray-900 p-8 text-white space-y-4">
                   <div className="flex items-center gap-3 text-sm font-black">
                      <CreditCard className="w-5 h-5 text-purple-400" /> 간편 결제 지원
                   </div>
                   <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                     카카오페이, 네이버페이, 토스페이 등으로 3초 만에 결제하실 수 있습니다. 무통장 입금 시 포인트 혜택을 드립니다.
                   </p>
                </div>
             </Card>

             <Link to="/courses" className="flex items-center justify-center gap-2 text-gray-400 font-bold hover:text-purple-600 transition-colors">
                <ArrowLeft className="w-4 h-4" /> 쇼핑 계속하기
             </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
