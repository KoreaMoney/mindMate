# MindMate Frontend

MindMate의 Next.js 기반 프론트엔드 애플리케이션입니다.

## 기능

- AI 챗봇 인터페이스
- 감정 추적 및 기록
- 위기 개입 시스템
- 반응형 디자인

## 설정

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 API URL을 설정하세요:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. 개발 서버 실행

```bash
pnpm dev
```

애플리케이션은 `http://localhost:3000`에서 실행됩니다.

## 빌드

```bash
pnpm build
pnpm start
```

## 기술 스택

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- TanStack Query
- Axios
- Lucide React Icons

## 프로젝트 구조

```
front/
├── app/              # Next.js App Router
│   ├── layout.tsx    # 루트 레이아웃
│   ├── page.tsx      # 메인 페이지
│   └── providers.tsx # React Query Provider
├── components/       # React 컴포넌트
│   ├── ChatBot.tsx   # 챗봇 인터페이스
│   └── MoodTracker.tsx # 감정 추적 컴포넌트
└── lib/
    └── api.ts        # API 클라이언트
```

## 주요 기능

### AI 챗봇
- OpenAI API를 통한 자연스러운 대화
- 감정 분석 및 위기 신호 감지
- 실시간 응답

### 감정 추적
- 1-10 점수로 감정 기록
- 메모 기능
- 일일 감정 패턴 추적

### 위기 개입
- 자해/자살 표현 자동 감지
- 즉각적인 전문가 상담 안내
- 긴급 연락처 제공
