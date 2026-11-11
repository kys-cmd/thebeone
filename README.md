# BE ONE (비원아카데미)

온라인·오프라인 정규강의, 특강, 라이브 클래스 및 수강생 전용 커뮤니티가 결합된 통합 교육 플랫폼입니다.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router
- **Backend**: Node.js, Express (`server.ts`), Netlify Functions (`netlify/functions/*`)
- **Database & Auth**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Payment**: KG 이니시스 (PC 표준결제 / 모바일 스마트결제 연동)

## Getting Started

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 참고하여 `.env` 파일을 생성하고 Supabase, KG 이니시스, SMTP 설정값을 입력합니다.

### 3. 로컬 개발 서버 실행

```bash
npm run dev
```

### 4. 프로덕션 빌드 및 실행

```bash
npm run build
npm run start
```
