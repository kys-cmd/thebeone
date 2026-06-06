import React from 'react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-12">이용약관</h1>
        <article className="prose prose-gray max-w-none space-y-10 text-gray-600 font-medium">
          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">제 1 조 (목적)</h2>
            <p className="leading-relaxed">
              본 약관은 비원아카데미(이하 "회사")가 운영하는 인터넷 사이트 및 모바일 앱(이하 "서비스")을 이용함에 있어 "회사"와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">제 2 조 (용어의 정의)</h2>
            <p className="leading-relaxed">
              1. "서비스"란 구현되는 단말기와 상관없이 이용자가 이용할 수 있는 비원아카데미 관련 제반 서비스를 의미합니다.<br />
              2. "이용자"란 "서비스"에 접속하여 본 약관에 따라 "회사"가 제공하는 "서비스"를 이용하는 회원 및 비회원을 의미합니다.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">제 3 조 (이용계약 체결)</h2>
            <p className="leading-relaxed">
              이용계약은 "이용자"가 약관의 내용에 대하여 동의를 하고 회원가입 신청을 한 후 "회사"가 이러한 신청에 대하여 승낙함으로써 체결됩니다.
            </p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">제 4 조 (회원의 의무)</h2>
            <p className="leading-relaxed">
              회원은 다음 행위를 하여서는 안 됩니다.<br />
              - 신청 또는 변경 시 허위 내용의 등록<br />
              - 타인의 정보 도용<br />
              - 회사가 게시한 정보의 변경<br />
              - 회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시
            </p>
          </section>
          
          <p className="text-sm text-gray-400 pt-10">공고일자: 2026년 04월 01일<br />시행일자: 2026년 04월 01일</p>
        </article>
      </div>
    </div>
  );
}
