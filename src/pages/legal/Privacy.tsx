import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white pt-[50px] pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-12">개인정보처리방침</h1>
        <article className="prose prose-gray max-w-none space-y-10 text-gray-600 font-medium text-[15px]">
          <p className="font-bold text-gray-900">
            비원아카데미는 이용자의 개인정보를 중요시하며, "개인정보 보호법" 등 관련 법령을 준수하고 있습니다.
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">1. 수집하는 개인정보 항목</h2>
            <p className="leading-relaxed">
              회사는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.<br />
              - 필수항목: 이름, 이메일 주소, 접속 로그, 쿠키, 접속 IP 정보<br />
              - 선택항목: 프로필 사진, 관심 분야
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">2. 개인정보의 수집 및 이용목적</h2>
            <p className="leading-relaxed">
              회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.<br />
              - 서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산<br />
              - 회원 관리 및 본인 확인<br />
              - 마케팅 및 광고에 활용
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">3. 개인정보의 보유 및 이용기간</h2>
            <p className="leading-relaxed font-bold underline">
              원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 관계법령에서 정한 일정 기간 동안 회원정보를 보관합니다.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">4. 개인정보 보호책임자</h2>
            <p className="leading-relaxed">
              성명: 관리자<br />
              연락처: contact@beone.edu
            </p>
          </section>
          
          <p className="text-sm text-gray-400 pt-10">공고일자: 2026년 04월 01일<br />시행일자: 2026년 04월 01일</p>
        </article>
      </div>
    </div>
  );
}
