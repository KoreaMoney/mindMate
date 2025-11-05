# MindMate - AI 기반 우울증 관리 앱

AI를 활용한 개인 맞춤형 우울증 진단 및 관리 애플리케이션입니다.

## 프로젝트 구조

```
school/
├── agent/          # Python FastAPI 백엔드 (AI Agent)
└── front/          # Next.js 프론트엔드
```

## 빠른 시작

### 1. Agent (백엔드) 설정

```bash
cd agent

# 가상 환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -e .

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어서 OPENAI_API_KEY를 설정하세요

# 서버 실행
python main.py
# 또는
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버는 `http://localhost:8000`에서 실행됩니다.

### 2. Frontend (프론트엔드) 설정

```bash
cd front

# 의존성 설치
pnpm install

# 환경 변수 설정 (선택사항)
# .env.local 파일 생성:
# NEXT_PUBLIC_API_URL=http://localhost:8000

# 개발 서버 실행
pnpm dev
```

애플리케이션은 `http://localhost:3000`에서 실행됩니다.

## 주요 기능

### ✅ 구현 완료

- [x] AI 챗봇 상담 시스템 (OpenAI API)
- [x] 감정 분석 및 위기 신호 감지
- [x] 감정 추적 및 기록 기능
- [x] 위기 개입 시스템
- [x] 반응형 웹 UI
- [x] API 연동

### 🚧 향후 구현 예정

- [ ] 데이터베이스 연동 (PostgreSQL/MongoDB)
- [ ] 사용자 인증 시스템
- [ ] CBT 기반 자가 학습 모듈
- [ ] 전문가 연계 시스템
- [ ] 생체리듬 최적화
- [ ] 감정 트렌드 시각화
- [ ] 웨어러블 기기 연동

## 기술 스택

### Backend (Agent)
- Python 3.13+
- FastAPI
- OpenAI API
- Uvicorn
- Pydantic

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- TanStack Query
- Axios
- Lucide React Icons

## API 엔드포인트

### 챗봇
- `POST /api/chatbot/send-message` - 메시지 전송
- `POST /api/chatbot/sentiment-analysis` - 감정 분석

### 감정 추적
- `POST /api/mood/log` - 감정 로그 저장
- `GET /api/mood/history` - 감정 이력 조회
- `GET /api/mood/analytics` - 감정 분석 데이터

### 위기 개입
- `POST /api/crisis/alert` - 위기 알림

## 개발 가이드

### 환경 변수

#### Agent (.env)
```bash
OPENAI_API_KEY=your_openai_api_key_here
HOST=0.0.0.0
PORT=8000
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 보안 및 개인정보 보호

- 모든 데이터는 암호화되어 전송됩니다
- HIPAA 및 개인정보보호법 준수를 목표로 합니다
- 위기 상황 감지 시 즉시 전문가 상담을 권장합니다

## 긴급 도움

정신건강 위기 상황:
- **정신건강위기상담전화**: 1393 (24시간)
- **응급실**: 119
- **자살예방상담전화**: 1588-9191

## 라이선스

이 프로젝트는 교육 및 연구 목적으로 개발되었습니다.

## 면책 조항

MindMate는 AI 기반 상담 도구이며, 전문 의료 서비스를 대체하지 않습니다. 심각한 증상이 있으시면 반드시 정신건강의학과 전문의와 상담하시기 바랍니다.

