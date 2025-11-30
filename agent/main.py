"""
MindMate AI Agent - FastAPI 서버
LangGraph를 활용한 우울증 관리 AI 백엔드
"""

import os
import json
import requests
from typing import List, Optional, Dict
from datetime import datetime
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Query
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
dangerous_words_storage: Dict[str, Dict[str, int]] = defaultdict(dict)  # user_id -> {word: count}

# 위험 단어 목록
DANGEROUS_WORDS = [
    "자살", "죽고싶", "죽고 싶", "죽고싶어", "죽고 싶어", "죽고싶다", "죽고 싶다",
    "끝내고싶", "끝내고 싶", "끝내고싶어", "끝내고 싶어",
    "살기 싫", "살기싫", "살기 싫어", "살기싫어", "살기 싫다", "살기싫다",
    "살고 싶지 않", "살고싶지 않", "살고 싶지 않아", "살고싶지 않아", "살고 싶지 않다", "살고싶지 않다",
    "자해", "손목", "칼", "약물", "과다복용",
    "더 이상", "이제 끝", "안녕히", "잘 가",
    "힘들어", "버티기 힘들", "견디기 힘들", "견딜 수 없",
    "의미없", "의미 없", "소용없", "소용 없",
    "아무도", "아무도 없", "혼자", "외로워",
    "미안해", "미안", "죄송", "용서",
    "고마워", "고마웠어", "고마웠다",
    "안녕", "잘 지내", "잘 지내줘",
]

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
    guardianEmail: Optional[str] = Field(default=None, description="보호자 이메일")
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


@app.get("/api/music/test")
async def test_music_endpoint():
    """노래 추천 엔드포인트 테스트"""
    return {
        "message": "노래 추천 엔드포인트가 정상적으로 등록되었습니다.",
        "endpoints": {
            "test": "/api/music/test (GET)",
            "recommend": "/api/music/recommend (POST)"
        }
    }


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


def detect_dangerous_words(text: str) -> Dict[str, int]:
    """일기장에서 위험 단어 감지"""
    if not text:
        return {}
    
    detected = {}
    text_lower = text.lower()
    
    for word in DANGEROUS_WORDS:
        count = text_lower.count(word.lower())
        if count > 0:
            detected[word] = count
    
    return detected


def count_total_dangerous_words(user_id: str) -> int:
    """사용자의 총 위험 단어 개수 계산"""
    total = 0
    for count in dangerous_words_storage[user_id].values():
        total += count
    return total


async def send_email_to_guardian(user_id: str, subject: str, message: str, recipient_email: Optional[str] = None) -> bool:
    """보호자에게 이메일 전송"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # 온보딩 정보에서 보호자 이메일 가져오기
        onboarding = onboarding_storage.get(user_id)
        if not onboarding:
            print(f"⚠️ 사용자 {user_id}의 온보딩 정보가 없습니다.")
            return False
        
        guardian_email = recipient_email or onboarding.get("guardianEmail", "")
        guardian_name = onboarding.get("guardianName", "보호자")
        user_name = onboarding.get("name", "사용자")
        
        if not guardian_email:
            print(f"⚠️ 보호자 이메일이 등록되지 않았습니다.")
            return False
        
        # SMTP 설정 (환경 변수에서 가져오기)
        SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
        SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
        SMTP_USER = os.getenv("SMTP_USER", "")
        SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
        FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)
        
        if not SMTP_USER or not SMTP_PASSWORD:
            # SMTP 설정이 없으면 시뮬레이션 모드
            print(f"📧 [이메일 전송 시뮬레이션] {guardian_name}({guardian_email})에게 전송:")
            print(f"   제목: {subject}")
            print(f"   내용: {message}")
            print(f"   (실제 이메일 전송을 위해서는 SMTP 설정이 필요합니다)")
            return True
        
        # 이메일 생성
        msg = MIMEMultipart()
        msg["From"] = FROM_EMAIL
        msg["To"] = guardian_email
        msg["Subject"] = subject
        
        # HTML 형식의 이메일 본문
        html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #e74c3c;">🚨 MindMate 위험 신호 알림</h2>
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold;">{message}</p>
              </div>
              <p style="margin-top: 20px;">{user_name}님의 상태를 확인해주시기 바랍니다.</p>
              <p style="margin-top: 10px;">필요시 전문가 상담을 권장합니다.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">이 이메일은 MindMate 시스템에서 자동으로 전송되었습니다.</p>
            </div>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(html_body, "html"))
        
        # 이메일 전송
        try:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            
            print(f"✅ [이메일 전송 성공] {guardian_name}({guardian_email})에게 전송 완료")
            return True
        except Exception as e:
            print(f"❌ 이메일 전송 오류: {str(e)}")
            # 실패해도 로그는 출력
            print(f"📧 [이메일 전송 시뮬레이션] {guardian_name}({guardian_email})에게 전송:")
            print(f"   제목: {subject}")
            print(f"   내용: {message}")
            return False
        
    except Exception as e:
        print(f"❌ 이메일 전송 오류: {str(e)}")
        return False


@app.post("/api/mood/log")
async def log_mood(mood: MoodLog):
    """감정 로그 저장 및 위험 단어 감지"""
    mood_data = mood.model_dump()
    mood_data["timestamp"] = datetime.now().isoformat()
    mood_logs_storage[mood.user_id].append(mood_data)
    
    # 최신 순으로 정렬 및 최대 100개까지만 유지
    mood_logs_storage[mood.user_id].sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    mood_logs_storage[mood.user_id] = mood_logs_storage[mood.user_id][:100]
    
    # 위험 단어 감지
    notes = mood_data.get("notes", "")
    if notes:
        detected_words = detect_dangerous_words(notes)
        
        # 위험 단어 카운팅 업데이트
        for word, count in detected_words.items():
            dangerous_words_storage[mood.user_id][word] = dangerous_words_storage[mood.user_id].get(word, 0) + count
        
        # 총 위험 단어 개수 확인 (임계값: 5개 이상)
        # 단, 같은 단어가 3회 이상 반복되거나, 총 5개 이상이면 알림
        total_dangerous_count = count_total_dangerous_words(mood.user_id)
        max_repeat_count = max(dangerous_words_storage[mood.user_id].values()) if dangerous_words_storage[mood.user_id] else 0
        
        # 같은 단어가 3회 이상 반복되거나, 총 위험 단어가 5개 이상이면 알림
        if max_repeat_count >= 3 or total_dangerous_count >= 5:
            # 보호자에게 알림 전송
            user_name = onboarding_storage.get(mood.user_id, {}).get("name", "사용자")
            guardian_name = onboarding_storage.get(mood.user_id, {}).get("guardianName", "보호자")
            
            if max_repeat_count >= 3:
                reason = f"같은 위험 단어가 {max_repeat_count}회 이상 반복 감지되었습니다."
            else:
                reason = f"총 {total_dangerous_count}개의 위험 단어가 감지되었습니다."
            
            message = (
                f"[MindMate 위험 감지 알림]\n\n"
                f"{user_name}님의 일기장에서 위험 신호가 감지되었습니다.\n"
                f"사유: {reason}\n\n"
                f"감지된 위험 단어:\n"
            )
            
            # 가장 많이 감지된 단어 상위 5개
            sorted_words = sorted(
                dangerous_words_storage[mood.user_id].items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]
            
            for word, count in sorted_words:
                message += f"- {word}: {count}회\n"
            
            message += (
                f"\n{user_name}님의 상태를 확인해주시기 바랍니다.\n"
                f"필요시 전문가 상담을 권장합니다."
            )
            
            # 이메일은 프론트엔드에서 EmailJS로 전송하므로 백엔드에서는 로그만 출력
            print(f"📧 [위험 신호 감지] {user_name}님의 일기장에서 위험 신호가 감지되었습니다.")
            print(f"   이메일 전송은 프론트엔드에서 EmailJS를 통해 처리됩니다.")
            print(f"   보호자: {guardian_name} ({onboarding_storage.get(mood.user_id, {}).get('guardianEmail', '등록되지 않음')})")
    
    return {
        "message": "감정 로그가 저장되었습니다",
        "mood_log": mood_data,
        "dangerous_words_detected": detected_words if notes else {},
        "total_dangerous_count": count_total_dangerous_words(mood.user_id) if notes else 0,
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
    previous_7 = sorted_logs[7:14] if len(sorted_logs) > 7 else []
    
    # 최소 14개 이상의 기록이 있어야 추세 계산 가능
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
        # 기록이 부족하면 추세 계산 불가
        trend = "insufficient_data"
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


@app.get("/api/mood/dangerous-words")
async def get_dangerous_words_count(user_id: str = Query(..., description="사용자 ID")):
    """사용자의 위험 단어 카운트 조회"""
    try:
        user_words = dangerous_words_storage.get(user_id, {})
        total_count = count_total_dangerous_words(user_id)
        max_repeat = max(user_words.values()) if user_words else 0
        
        return {
            "user_id": user_id,
            "dangerous_words": user_words,
            "total_count": total_count,
            "max_repeat_count": max_repeat,
            "should_alert": max_repeat >= 3 or total_count >= 5
        }
    except Exception as e:
        print(f"❌ 위험 단어 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"조회 오류: {str(e)}")


@app.post("/api/mood/dangerous-words/reset")
async def reset_dangerous_words(user_id: str = Query(..., description="사용자 ID")):
    """사용자의 위험 단어 카운트 리셋 (테스트용)"""
    try:
        dangerous_words_storage[user_id] = {}
        return {
            "message": "위험 단어 카운트가 리셋되었습니다.",
            "user_id": user_id
        }
    except Exception as e:
        print(f"❌ 위험 단어 리셋 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"리셋 오류: {str(e)}")


class TestEmailRequest(BaseModel):
    email: str = Field(..., description="테스트용 이메일 주소")
    subject: Optional[str] = Field(default=None, description="이메일 제목 (선택사항)")
    message: Optional[str] = Field(default=None, description="테스트 메시지 (선택사항)")


@app.post("/api/test/email")
async def test_email_message(request: TestEmailRequest):
    """이메일 테스트용 엔드포인트"""
    try:
        email = request.email
        test_subject = request.subject or "[MindMate 테스트] 이메일 기능 테스트"
        test_message = request.message or (
            "이메일 기능 테스트입니다.\n\n"
            "이 메시지가 정상적으로 전송되었다면 이메일 연동이 성공한 것입니다."
        )
        
        # 테스트용 온보딩 데이터 생성
        test_onboarding = {
            "guardianEmail": email,
            "guardianName": "테스트 수신자",
            "name": "테스트 사용자"
        }
        
        # 임시로 테스트 데이터 저장
        original_onboarding = onboarding_storage.get("test_user")
        onboarding_storage["test_user"] = test_onboarding
        
        try:
            result = await send_email_to_guardian("test_user", test_subject, test_message, email)
            
            if result:
                return {
                    "success": True,
                    "message": "이메일이 성공적으로 전송되었습니다.",
                    "email": email
                }
            else:
                return {
                    "success": False,
                    "message": "이메일 전송에 실패했습니다. SMTP 설정을 확인해주세요.",
                    "email": email
                }
        finally:
            # 원래 데이터 복원
            if original_onboarding:
                onboarding_storage["test_user"] = original_onboarding
            else:
                onboarding_storage.pop("test_user", None)
        
    except Exception as e:
        print(f"❌ 이메일 테스트 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"테스트 오류: {str(e)}")


class MusicRecommendationRequest(BaseModel):
    user_id: str = Field(..., description="사용자 ID")
    conversation_history: Optional[List[ChatMessage]] = Field(
        default=None, description="최근 대화 이력 (감정 데이터가 없을 때 사용)"
    )


@app.post("/api/music/recommend")
async def recommend_music(request: MusicRecommendationRequest):
    """오늘의 감정을 분석하여 유튜브 노래 추천"""
    try:
        from datetime import datetime, timedelta
        
        user_id = request.user_id
        
        # 오늘의 감정 데이터 가져오기
        user_logs = mood_logs_storage.get(user_id, [])
        if not user_logs:
            raise HTTPException(
                status_code=404,
                detail="오늘 기록된 감정 데이터가 없습니다. 먼저 감정을 기록해주세요."
            )
        
        # 오늘 날짜의 기록 찾기
        today = datetime.now().date()
        today_logs = []
        
        for log in user_logs:
            try:
                log_date_str = log.get("timestamp", "")
                if log_date_str:
                    # ISO 형식 파싱 시도
                    if "T" in log_date_str:
                        log_date = datetime.fromisoformat(log_date_str.replace("Z", "+00:00")).date()
                    else:
                        log_date = datetime.strptime(log_date_str.split("T")[0], "%Y-%m-%d").date()
                    if log_date == today:
                        today_logs.append(log)
            except:
                continue
        
        # 감정 데이터가 없으면 대화 내용을 분석
        mood_score = 5  # 기본값
        notes = ""
        use_conversation = False
        
        if not today_logs:
            # 대화 이력이 있으면 그것을 분석
            if request.conversation_history and len(request.conversation_history) > 0:
                # 사용자 메시지만 추출
                user_messages = [
                    msg.content for msg in request.conversation_history 
                    if msg.role == "user" and msg.content and msg.content.strip()
                ]
                if user_messages:
                    # 최근 5개 메시지 사용 (빈 메시지 제외)
                    recent_messages = [msg for msg in user_messages[-5:] if msg.strip()]
                    if recent_messages:
                        notes = " ".join(recent_messages)
                        use_conversation = True
                    else:
                        raise HTTPException(
                            status_code=404,
                            detail="오늘 기록된 감정 데이터가 없습니다. 먼저 감정을 기록하거나 대화를 나눠주세요."
                        )
                else:
                    raise HTTPException(
                        status_code=404,
                        detail="오늘 기록된 감정 데이터가 없습니다. 먼저 감정을 기록하거나 대화를 나눠주세요."
                    )
            else:
                raise HTTPException(
                    status_code=404,
                    detail="오늘 기록된 감정 데이터가 없습니다. 먼저 감정을 기록하거나 대화를 나눠주세요."
                )
        else:
            # 가장 최근 기록 사용
            latest_log = sorted(today_logs, key=lambda x: x.get("timestamp", ""), reverse=True)[0]
            mood_score = latest_log.get("mood_score", 5)
            notes = latest_log.get("notes", "")
        
        # 감정 분석
        analyzer = SentimentAnalyzer()
        sentiment_score = None
        sentiment_label = "neutral"
        
        if notes:
            try:
                sentiment_score, sentiment_label = analyzer.analyze(notes)
            except:
                pass
        
        # 대화 내용 기반이면 감정 점수를 분석 결과로 업데이트
        if use_conversation and sentiment_score is not None:
            # sentiment_score를 1-10 스케일로 변환
            mood_score = int((sentiment_score + 1) * 5)  # -1~1을 0~10으로 변환
            mood_score = max(1, min(10, mood_score))  # 1-10 범위로 제한
        
        # mood_score 기반 감정 판단
        if mood_score >= 7:
            mood_state = "긍정적이고 기분이 좋은"
            mood_description = f"기분이 매우 좋은 상태 (점수: {mood_score}/10)"
        elif mood_score <= 4:
            mood_state = "우울하거나 슬픈"
            mood_description = f"기분이 좋지 않은 상태 (점수: {mood_score}/10)"
        else:
            mood_state = "평온하거나 중립적인"
            mood_description = f"보통 기분 상태 (점수: {mood_score}/10)"
        
        # 대화 내용 기반이면 설명 추가
        if use_conversation:
            mood_description += " (대화 내용 분석 기반)"
        
        # AI에게 노래 추천 요청
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage
        
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
        
        recommendation_prompt = f"""사용자의 오늘 감정 상태를 분석하여 유튜브에서 들을 수 있는 노래를 추천해줘.

사용자 감정 정보:
- 감정 점수: {mood_score}/10
- 감정 상태: {mood_state}
- 감정 설명: {mood_description}
- 일기 내용: {notes if notes else "일기 없음"}
- 감정 분석 결과: {sentiment_label} (점수: {sentiment_score if sentiment_score else "N/A"})

요구사항:
1. 감정 상태에 맞는 노래를 3곡 추천해줘
2. 각 노래마다 아티스트명과 곡명을 명확히 알려줘
3. 각 노래에 대한 간단한 추천 이유를 한 문장으로 설명해줘
4. 유튜브 검색 링크 형식으로 제공해줘 (예: https://www.youtube.com/results?search_query=아티스트명+곡명)

응답 형식:
1. [아티스트명 - 곡명]
   추천 이유: ...
   유튜브 링크: https://www.youtube.com/results?search_query=...

2. [아티스트명 - 곡명]
   추천 이유: ...
   유튜브 링크: https://www.youtube.com/results?search_query=...

3. [아티스트명 - 곡명]
   추천 이유: ...
   유튜브 링크: https://www.youtube.com/results?search_query=...

한국어로 응답해줘."""

        try:
            response = llm.invoke([
                SystemMessage(content="너는 음악 추천 전문가야. 사용자의 감정 상태에 맞는 노래를 추천해줘."),
                HumanMessage(content=recommendation_prompt),
            ])
            
            recommendation_text = response.content
            
            return {
                "success": True,
                "mood_score": mood_score,
                "mood_state": mood_state,
                "sentiment": sentiment_label,
                "recommendation": recommendation_text,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            print(f"❌ AI 노래 추천 오류: {str(e)}")
            raise HTTPException(status_code=500, detail=f"노래 추천 생성 오류: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 노래 추천 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"노래 추천 오류: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
