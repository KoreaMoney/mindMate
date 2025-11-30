/**
 * MindMate API 클라이언트
 */

import axios from "axios";

// LangGraph dev 서버는 http://127.0.0.1:2024에서 실행
// FastAPI 서버는 http://localhost:8000에서 실행 (또는 uv run python main.py)
// 프론트엔드는 FastAPI 서버를 사용 (LangGraph는 백엔드에서 내부적으로 사용)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10초 타임아웃
});

// 요청 인터셉터 - 디버깅용
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error("[API Request Error]", error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 네트워크 에러 처리 (서버에 도달하지 못한 경우)
    if (
      error.code === "ERR_NETWORK" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ETIMEDOUT" ||
      error.message?.includes("Network Error") ||
      error.message?.includes("timeout")
    ) {
      // 에러 객체에 더 친화적인 메시지 추가
      const userFriendlyMessage =
        `FastAPI 서버에 연결할 수 없습니다.\n` +
        `서버 URL: ${API_BASE_URL}\n\n` +
        `해결 방법:\n` +
        `1. 터미널을 열고 다음 명령어를 실행하세요:\n` +
        `   cd agent\n` +
        `   uv run python main.py\n\n` +
        `2. 서버가 실행 중인지 확인하세요:\n` +
        `   브라우저에서 ${API_BASE_URL}/health 접속 시도\n\n` +
        `3. 포트가 이미 사용 중인지 확인하세요:\n` +
        `   lsof -i :8000\n\n` +
        `4. 브라우저를 새로고침해보세요.`;

      error.userMessage = userFriendlyMessage;
      // 개발 환경에서만 상세한 에러 로그 출력
      if (process.env.NODE_ENV === "development") {
        console.error(`[API Network Error] 서버 연결 실패`);
        console.error(`  - 서버 URL: ${API_BASE_URL}`);
        console.error(`  - 에러 코드: ${error.code}`);
        console.error(`  - 에러 메시지: ${error.message}`);
        console.error(`  - 전체 에러:`, error);
      }
      // 에러 코드도 추가하여 쉽게 식별 가능하도록
      error.isNetworkError = true;
    } else if (error.response) {
      // 서버 응답이 있는 경우 (4xx, 5xx)
      const status = error.response.status;
      const statusText = error.response.statusText;
      const errorData = error.response.data;

      error.userMessage = `서버 오류가 발생했습니다: ${status} ${statusText}`;

      // 개발 환경에서만 상세한 에러 로그 출력
      if (process.env.NODE_ENV === "development") {
        console.error(`[API Error] ${status} ${statusText}:`, errorData);
        console.error(`[API Error] 요청 URL: ${error.config?.url}`);
        console.error(`[API Error] 요청 메서드: ${error.config?.method}`);
        console.error(`[API Error] 요청 데이터:`, error.config?.data);
      }
    } else if (error.code === "ECONNABORTED") {
      // 타임아웃 에러
      error.userMessage =
        `요청 시간이 초과되었습니다 (10초).\n` +
        `서버 응답이 느리거나 서버에 문제가 있을 수 있습니다.\n\n` +
        `서버가 정상적으로 실행 중인지 확인해주세요.`;
      error.isNetworkError = true;

      if (process.env.NODE_ENV === "development") {
        console.warn(`[API Timeout] 요청 시간 초과: ${error.config?.url}`);
      }
    } else {
      // 기타 에러
      error.userMessage = error.message || "알 수 없는 오류가 발생했습니다.";
      console.error("[API Error]", error);
    }
    return Promise.reject(error);
  }
);

// 타입 정의
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  message: string;
  conversation_history?: ChatMessage[];
  user_id?: string;
}

export interface ChatResponse {
  message: string;
  sentiment_score?: number;
  risk_level?: "low" | "medium" | "high" | "critical";
  timestamp: string;
}

export interface MoodLog {
  user_id: string;
  mood_score: number; // 1-10
  notes?: string;
  timestamp?: string;
}

export interface SentimentAnalysis {
  sentiment_score: number;
  label: "positive" | "negative" | "neutral";
  message: string;
}

export interface CrisisAlert {
  user_id: string;
  message: string;
  risk_level: string;
  timestamp: string;
}

export interface OnboardingData {
  name: string;
  phone: string;
  address: string;
  guardianName?: string;
  guardianPhone: string; // 보호자 없으면 "112"
  guardianEmail?: string; // 보호자 이메일
  latitude?: number;
  longitude?: number;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  address: string;
}

// API 함수들

/**
 * 챗봇 메시지 전송
 */
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>("/api/chatbot/send-message", request);
  return response.data;
};

/**
 * 감정 분석
 */
export const analyzeSentiment = async (message: string): Promise<SentimentAnalysis> => {
  const response = await apiClient.post<SentimentAnalysis>("/api/chatbot/sentiment-analysis", { message });
  return response.data;
};

/**
 * 감정 로그 저장 응답 타입
 */
export interface MoodLogResponse {
  message: string;
  mood_log?: {
    user_id: string;
    mood_score: number;
    notes?: string;
    timestamp?: string;
  };
  dangerous_words_detected?: Record<string, number>;
  total_dangerous_count?: number;
}

/**
 * 감정 로그 저장
 */
export const logMood = async (mood: MoodLog): Promise<MoodLogResponse> => {
  const response = await apiClient.post<MoodLogResponse>("/api/mood/log", mood);
  return response.data;
};

/**
 * 감정 이력 조회
 */
export const getMoodHistory = async (userId: string, limit = 30) => {
  const response = await apiClient.get("/api/mood/history", {
    params: { user_id: userId, limit },
  });
  return response.data;
};

/**
 * 감정 분석 데이터
 */
export const getMoodAnalytics = async (userId: string) => {
  const response = await apiClient.get("/api/mood/analytics", {
    params: { user_id: userId },
  });
  return response.data;
};

/**
 * 위기 알림
 */
export const sendCrisisAlert = async (
  alert: CrisisAlert
): Promise<{
  crisis_detected: boolean;
  risk_level: string;
  recommendations: string[];
}> => {
  const response = await apiClient.post("/api/crisis/alert", alert);
  return response.data;
};

/**
 * 위치 정보 조회 (주소 기반 지오코딩)
 */
export const getLocationFromAddress = async (address: string): Promise<LocationInfo> => {
  const response = await apiClient.post("/api/location/geocode", { address });
  return response.data;
};

/**
 * 온보딩 정보 저장
 */
export const saveOnboardingData = async (userId: string, data: OnboardingData): Promise<{ message: string }> => {
  const response = await apiClient.post("/api/user/onboarding", {
    user_id: userId,
    ...data,
  });
  return response.data;
};

/**
 * 온보딩 정보 조회
 */
export const getOnboardingData = async (userId: string): Promise<OnboardingData | null> => {
  try {
    const response = await apiClient.get("/api/user/onboarding", {
      params: { user_id: userId },
    });
    return response.data;
  } catch {
    return null;
  }
};

/**
 * 헬스 체크
 */
export const healthCheck = async () => {
  const response = await apiClient.get("/health");
  return response.data;
};

/**
 * 이메일 테스트
 */
export const testEmailMessage = async (email: string, subject?: string, message?: string) => {
  const response = await apiClient.post("/api/test/email", {
    email,
    subject,
    message,
  });
  return response.data;
};

/**
 * 위험 단어 카운트 조회 응답 타입
 */
export interface DangerousWordsInfo {
  user_id: string;
  dangerous_words: Record<string, number>;
  total_count: number;
  max_repeat_count: number;
  should_alert: boolean;
}

/**
 * 위험 단어 카운트 조회
 */
export const getDangerousWordsCount = async (userId: string): Promise<DangerousWordsInfo> => {
  const response = await apiClient.get<DangerousWordsInfo>("/api/mood/dangerous-words", {
    params: { user_id: userId },
  });
  return response.data;
};

/**
 * 위험 단어 카운트 리셋 (테스트용)
 */
export const resetDangerousWords = async (userId: string) => {
  const response = await apiClient.post("/api/mood/dangerous-words/reset", null, {
    params: { user_id: userId },
  });
  return response.data;
};

/**
 * 오늘 감정 기반 유튜브 노래 추천
 */
export interface MusicRecommendation {
  success: boolean;
  mood_score: number;
  mood_state: string;
  sentiment: string;
  recommendation: string;
  timestamp: string;
}

export const recommendMusic = async (
  userId: string,
  conversationHistory?: ChatMessage[]
): Promise<MusicRecommendation> => {
  const response = await apiClient.post<MusicRecommendation>("/api/music/recommend", {
    user_id: userId,
    conversation_history: conversationHistory,
  });
  return response.data;
};
