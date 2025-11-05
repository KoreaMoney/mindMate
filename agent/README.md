# MindMate AI Agent

MindMate의 AI 백엔드 서버입니다. OpenAI API를 활용하여 우울증 관리 기능을 제공합니다.

## 기능

- AI 챗봇 상담 시스템
- 감정 분석
- 위기 감지 및 개입
- 감정 로그 관리

## 설정

### 1. 의존성 설치

```bash
pip install -e .
```

또는

```bash
pip install fastapi uvicorn openai python-dotenv pydantic python-multipart
```

### 2. 환경 변수 설정

`agent` 폴더에 `.env` 파일을 생성하고 OpenAI API 키만 설정하면 됩니다:

```bash
# agent/.env
OPENAI_API_KEY=your_openai_api_key_here
```

**참고**: 다른 환경 변수(HOST, PORT 등)는 선택사항이며, 기본값이 사용됩니다.

### 3. 서버 실행

```bash
python main.py
```

또는

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버는 `http://localhost:8000`에서 실행됩니다.

## API 문서

서버가 실행되면 다음 URL에서 API 문서를 확인할 수 있습니다:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 주요 엔드포인트

- `POST /api/chatbot/send-message` - 챗봇 메시지 전송
- `POST /api/chatbot/sentiment-analysis` - 감정 분석
- `POST /api/mood/log` - 감정 로그 저장
- `GET /api/mood/history` - 감정 이력 조회
- `POST /api/crisis/alert` - 위기 알림

## 개발

코드 품질 및 타입 체크:

```bash
# Python 타입 체크
mypy main.py

# 코드 포맷팅
black main.py

# 린팅
flake8 main.py
```

## LangChain & LangGraph 구조

이 프로젝트는 LangChain과 LangGraph를 사용하여 구성되었습니다:

- **ChatbotAgent**: LangChain을 사용한 챗봇 체인 및 메모리 관리
- **CrisisDetector**: 위기 신호 감지 모듈
- **SentimentAnalyzer**: 감정 분석 모듈
- **MindMateGraph**: LangGraph를 사용한 워크플로우 그래프

### 워크플로우

1. **위기 감지 노드**: 사용자 메시지에서 위기 신호 감지
2. **감정 분석 노드**: 감정 점수 계산
3. **응답 생성 노드**: LangChain을 통한 AI 응답 생성
4. **위기 처리 노드**: 위기 상황일 경우 추가 메시지 및 권장사항 제공
