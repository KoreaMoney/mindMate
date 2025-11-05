"""
MindMate AI Agent - FastAPI 서버
LangGraph를 활용한 우울증 관리 AI 백엔드
"""

import os
from typing import List, Optional, Dict
from datetime import datetime
from collections import defaultdict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

# OpenAI API 키 확인
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")

# LangGraph 그래프 및 Agent 로드
try:
    from agents.mindmate_graph import MindMateGraph
    from agents.sentiment_analyzer import SentimentAnalyzer
    from agents.crisis_detector import CrisisDetector
    mindmate_graph = MindMateGraph()
except Exception as e:
    print(f"⚠️ LangGraph 로드 오류: {e}")
    print("LangGraph dev 서버가 실행 중인지 확인하세요: uv run langgraph dev")
    raise

# 인메모리 데이터 저장소
mood_logs_storage: Dict[str, List[Dict]] = defaultdict(list)
onboarding_storage: Dict[str, Dict] = {}  # user_id -> onboarding_data

# FastAPI 앱 생성
app = FastAPI(
    title="MindMate AI Agent",
    description="AI 기반 우울증 관리 시스템 백엔드 API (LangGraph 사용)",
    version="0.1.0",
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic 모델 정의
class ChatMessage(BaseModel):
    role: str = Field(..., description="메시지 역할: user, assistant, system")
    content: str = Field(..., description="메시지 내용")


class ChatRequest(BaseModel):
    message: str = Field(..., description="사용자 메시지")
    conversation_history: Optional[List[ChatMessage]] = Field(
        default=None, description="대화 이력"
    )
    user_id: Optional[str] = Field(default=None, description="사용자 ID")


class ChatResponse(BaseModel):
    message: str = Field(..., description="AI 응답 메시지")
    sentiment_score: Optional[float] = Field(
        default=None, description="감정 점수 (-1: 매우 부정적, 1: 매우 긍정적)"
    )
    risk_level: Optional[str] = Field(
        default=None, description="위험 수준: low, medium, high, critical"
    )
    is_crisis: Optional[bool] = Field(
        default=False, description="위기 감지 여부"
    )
    timestamp: datetime = Field(default_factory=datetime.now)


class MoodLog(BaseModel):
    user_id: str = Field(..., description="사용자 ID")
    mood_score: int = Field(..., ge=1, le=10, description="감정 점수 (1-10)")
    notes: Optional[str] = Field(default=None, description="메모")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)


class CrisisAlert(BaseModel):
    user_id: str = Field(..., description="사용자 ID")
    message: str = Field(..., description="위기 신호 메시지")
    risk_level: str = Field(..., description="위험 수준")
    timestamp: datetime = Field(default_factory=datetime.now)


class SentimentAnalysisRequest(BaseModel):
    message: str = Field(..., description="분석할 메시지")


class OnboardingData(BaseModel):
    user_id: str = Field(..., description="사용자 ID")
    name: str = Field(..., description="사용자 이름")
    phone: str = Field(..., description="사용자 전화번호")
    address: str = Field(..., description="사용자 주소")
    guardianName: Optional[str] = Field(default=None, description="보호자 이름")
    guardianPhone: str = Field(..., description="보호자 전화번호 (없으면 112)")
    latitude: Optional[float] = Field(default=None, description="위도")
    longitude: Optional[float] = Field(default=None, description="경도")


class LocationRequest(BaseModel):
    address: str = Field(..., description="주소")


class LocationResponse(BaseModel):
    latitude: float = Field(..., description="위도")
    longitude: float = Field(..., description="경도")
    address: str = Field(..., description="입력된 주소")


# API 엔드포인트


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "MindMate AI Agent API",
        "status": "running",
        "framework": "LangChain & LangGraph",
    }


@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy", "timestamp": datetime.now()}


@app.post("/api/chatbot/send-message", response_model=ChatResponse)
async def send_chat_message(request: ChatRequest):
    """챗봇 메시지 전송 및 응답"""
    try:
        # 대화 이력을 dict 형식으로 변환
        conversation_history = None
        if request.conversation_history:
            conversation_history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.conversation_history
            ]

        # LangGraph를 통한 워크플로우 실행
        result = mindmate_graph.process(
            user_message=request.message,
            user_id=request.user_id,
            conversation_history=conversation_history,
        )

        return ChatResponse(
            message=result["message"],
            sentiment_score=result["sentiment_score"],
            risk_level=result["risk_level"],
            is_crisis=result["is_crisis"],
        )
    except Exception as e:
        print(f"❌ 챗봇 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"챗봇 오류: {str(e)}")


@app.post("/api/chatbot/sentiment-analysis")
async def analyze_sentiment(request: SentimentAnalysisRequest):
    """감정 분석"""
    try:
        analyzer = SentimentAnalyzer()
        sentiment_score, label = analyzer.analyze(request.message)

        return {
            "sentiment_score": sentiment_score,
            "label": label,
            "message": request.message,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"감정 분석 오류: {str(e)}")


@app.post("/api/crisis/alert")
async def crisis_alert(alert: CrisisAlert):
    """위기 알림 처리"""
    try:
        detector = CrisisDetector()
        is_crisis, risk_level = detector.detect_crisis(alert.message)
        recommendations = detector.get_crisis_recommendations(risk_level)

        response = {
            "crisis_detected": is_crisis,
            "risk_level": risk_level if is_crisis else "low",
            "alert": alert.model_dump(),
            "recommendations": recommendations,
        }

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"위기 감지 오류: {str(e)}")


@app.post("/api/mood/log")
async def log_mood(mood: MoodLog):
    """감정 로그 저장"""
    mood_data = mood.model_dump()
    mood_data["timestamp"] = datetime.now().isoformat()
    mood_logs_storage[mood.user_id].append(mood_data)
    
    # 최신 순으로 정렬 및 최대 100개까지만 유지
    mood_logs_storage[mood.user_id].sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    mood_logs_storage[mood.user_id] = mood_logs_storage[mood.user_id][:100]
    
    return {
        "message": "감정 로그가 저장되었습니다",
        "mood_log": mood_data,
    }


@app.get("/api/mood/history")
async def get_mood_history(user_id: str, limit: int = 30):
    """감정 이력 조회"""
    user_logs = mood_logs_storage.get(user_id, [])
    
    # 최신 순으로 정렬 후 limit만큼 반환
    sorted_logs = sorted(user_logs, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]
    
    # 날짜 형식 변환 및 sentiment 계산
    history = []
    analyzer = SentimentAnalyzer()
    for log in sorted_logs:
        mood_score = log.get("mood_score", 5)
        notes = log.get("notes", "")
        
        # mood_score를 기반으로 sentiment 계산
        if mood_score >= 7:
            sentiment = "positive"
        elif mood_score <= 4:
            sentiment = "negative"
        else:
            sentiment = "neutral"
        
        # notes가 있으면 sentiment 분석 수행
        if notes:
            try:
                sentiment_score, sentiment_label = analyzer.analyze(notes)
                if sentiment_label in ["positive", "negative", "neutral"]:
                    sentiment = sentiment_label
            except:
                pass
        
        history.append({
            "date": log.get("timestamp", datetime.now().isoformat()),
            "score": mood_score,
            "sentiment": sentiment,
            "notes": notes,
        })
    
    # 날짜순 정렬 (오래된 것부터)
    history.sort(key=lambda x: x.get("date", ""))
    
    return {
        "user_id": user_id,
        "history": history,
        "total": len(user_logs),
    }


@app.get("/api/mood/analytics")
async def get_mood_analytics(user_id: str):
    """감정 분석 데이터"""
    user_logs = mood_logs_storage.get(user_id, [])
    
    if not user_logs:
        return {
            "user_id": user_id,
            "average_score": 0,
            "trend": "stable",
            "trend_percentage": 0,
            "total_records": 0,
            "sentiment_distribution": {
                "positive": 0,
                "neutral": 0,
                "negative": 0,
            },
            "message": "데이터가 없습니다",
        }
    
    # 평균 점수 계산
    scores = [log.get("mood_score", 5) for log in user_logs]
    average_score = sum(scores) / len(scores) if scores else 0
    
    # 최근 7일과 그 이전 7일 비교하여 추세 계산
    sorted_logs = sorted(user_logs, key=lambda x: x.get("timestamp", ""), reverse=True)
    recent_7 = sorted_logs[:7]
    previous_7 = sorted_logs[7:14]
    
    if len(recent_7) >= 2 and len(previous_7) >= 2:
        recent_avg = sum(log.get("mood_score", 5) for log in recent_7) / len(recent_7)
        previous_avg = sum(log.get("mood_score", 5) for log in previous_7) / len(previous_7)
        
        if previous_avg > 0:
            trend_percentage = ((recent_avg - previous_avg) / previous_avg) * 100
        else:
            trend_percentage = 0
        
        if trend_percentage > 5:
            trend = "improving"
        elif trend_percentage < -5:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"
        trend_percentage = 0
    
    # 감정 분포 계산
    analyzer = SentimentAnalyzer()
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    
    for log in user_logs:
        mood_score = log.get("mood_score", 5)
        notes = log.get("notes", "")
        
        if mood_score >= 7:
            sentiment_counts["positive"] += 1
        elif mood_score <= 4:
            sentiment_counts["negative"] += 1
        else:
            sentiment_counts["neutral"] += 1
        
        # notes가 있으면 더 정확한 분석
        if notes:
            try:
                _, sentiment_label = analyzer.analyze(notes)
                if sentiment_label in sentiment_counts:
                    sentiment_counts[sentiment_label] += 1
            except:
                pass
    
    return {
        "user_id": user_id,
        "average_score": round(average_score, 1),
        "trend": trend,
        "trend_percentage": round(trend_percentage, 1),
        "total_records": len(user_logs),
        "sentiment_distribution": sentiment_counts,
        "message": "분석 완료",
    }


@app.post("/api/chatbot/initial-question")
async def get_initial_question(user_id: str):
    """사용자 기록을 기반으로 초기 질문 생성"""
    try:
        # TODO: 실제 데이터베이스에서 사용자 통계 조회
        # 현재는 샘플 데이터 사용
        user_stats = {
            "avg_score": "6.5",
            "trend": "상승중",
            "last_mood": "오늘 조금 나아진 것 같아요",
            "topics": "일상 스트레스, 수면 패턴",
        }
        
        initial_question = mindmate_graph.chatbot.generate_initial_question(user_stats)
        
        return {
            "question": initial_question,
            "user_id": user_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"초기 질문 생성 오류: {str(e)}")


@app.post("/api/location/geocode", response_model=LocationResponse)
async def geocode_address(request: LocationRequest):
    """주소를 기반으로 위치 정보 조회 (지오코딩)"""
    try:
        import requests
        from urllib.parse import quote
        
        address = request.address
        
        # 네이버 맵 API를 사용한 지오코딩 (또는 OpenAI의 지오코딩 서비스)
        # 여기서는 간단한 좌표 생성 (실제 구현 시 지오코딩 API 사용)
        # 예를 위해 더미 데이터 반환
        
        # 실제 구현: OpenCage Geocoding API 또는 네이버 지오코딩 API 사용
        # 임시로 기본값 반환 (테스트용)
        
        # 서울시 강남구의 대략적인 좌표 (예시)
        latitude = 37.4979  # 기본값
        longitude = 127.0276  # 기본값
        
        # 주소에 따른 좌표 매핑 (확장 가능)
        address_map = {
            "서울": (37.5665, 126.9780),
            "강남": (37.4979, 127.0276),
            "종로": (37.5714, 126.9883),
            "마포": (37.5484, 126.9022),
            "부산": (35.1796, 129.0753),
            "대구": (35.8714, 128.5956),
            "인천": (37.4563, 126.7052),
            "대전": (36.3504, 127.3845),
            "광주": (35.1595, 126.8526),
            "울산": (35.5384, 129.3114),
        }
        
        # 주소에서 도시명 추출
        for city, (lat, lon) in address_map.items():
            if city in address:
                latitude = lat
                longitude = lon
                break
        
        return LocationResponse(
            latitude=latitude,
            longitude=longitude,
            address=address,
        )
    except Exception as e:
        print(f"❌ 지오코딩 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"지오코딩 오류: {str(e)}")


@app.post("/api/user/onboarding")
async def save_onboarding_data(data: OnboardingData):
    """사용자 온보딩 정보 저장"""
    try:
        onboarding_data = data.model_dump()
        onboarding_data["timestamp"] = datetime.now().isoformat()
        user_id = onboarding_data["user_id"]
        
        # 인메모리 저장소에 저장
        onboarding_storage[user_id] = onboarding_data
        
        # 보호자 정보 확인
        guardian_phone = onboarding_data.get("guardianPhone", "112")
        guardian_name = onboarding_data.get("guardianName", "긴급 신고")
        
        return {
            "message": f"온보딩 정보가 저장되었습니다. 우선 연락처: {guardian_name} ({guardian_phone})",
            "onboarding_data": onboarding_data,
        }
    except Exception as e:
        print(f"❌ 온보딩 저장 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"온보딩 저장 오류: {str(e)}")


@app.get("/api/user/onboarding")
async def get_onboarding_data(user_id: str):
    """사용자 온보딩 정보 조회"""
    try:
        if user_id not in onboarding_storage:
            raise HTTPException(status_code=404, detail="온보딩 정보가 없습니다")
        
        return onboarding_storage[user_id]
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 온보딩 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"온보딩 조회 오류: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
