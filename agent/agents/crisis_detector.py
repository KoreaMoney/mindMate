"""
위기 신호 감지 모듈
"""

from typing import Tuple


# 위기 신호 키워드
CRISIS_KEYWORDS = [
    "죽고 싶어",
    "죽고 싶다",
    "죽고 싶습니다",
    "자살",
    "끝내고 싶어",
    "끝내고 싶다",
    "더 이상 버틸 수 없어",
    "살 이유가 없어",
    "살고 싶지 않아",
    "살고 싶지 않다",
    "살고 싶지 않습니다",
    "자해",
    "생각이 없어",
    "목숨을 끊고",
    "스스로를 해치고",
    "더 이상 살 이유가",
    "죽음",
    "자살 생각",
    "자해 생각",
    "극단적",
    "극단적 선택",
    "생을 마감",
    "생명을 끊",
    "살아갈 이유가 없어",
    "이 세상에서 사라지고",
    "없어지고 싶어",
    "없어지고 싶다",
    "죽는 게 낫겠어",
    "죽는 게 나을 것 같아",
    "죽음이 나을 것",
    "살아갈 수 없어",
    "더는 못 살겠어",
    "더는 못 산다",
]


class CrisisDetector:
    """위기 신호 감지기"""

    @staticmethod
    def detect_crisis(message: str) -> Tuple[bool, str]:
        """위기 신호 감지
        
        Args:
            message: 사용자 메시지
            
        Returns:
            (is_crisis, risk_level): 위기 여부와 위험 수준
        """
        message_lower = message.lower()
        # 공백 제거 버전도 생성 (공백 차이 무시)
        message_no_space = message_lower.replace(" ", "")

        # 긴급 키워드 확인
        for keyword in CRISIS_KEYWORDS:
            keyword_no_space = keyword.replace(" ", "")
            # 공백 있는 버전, 없는 버전 둘 다 확인
            if keyword in message_lower or keyword_no_space in message_no_space:
                return True, "critical"

        # 추가 감정 키워드 분석
        negative_words = [
            "힘들어",
            "괴로워",
            "괴로워요",
            "무력해",
            "무기력해",
            "절망적",
            "포기",
            "의미없어",
            "희망없어",
            "망가져",
            "버티기 힘들어",
            "너무 힘들어",
            "견디기 어려워",
            "이대로는 안 될 것 같아",
            "미치겠어",
            "화풀이",
            "자학",
            "자책",
            "죄책감",
            "후회",
            "나약해",
            "나약하다",
            "쓸모없어",
            "쓸모없다",
            "누가 될 자격이 없어",
            "혼자야",
            "혼자다",
            "고독해",
            "외로워",
            "절벽",
            "절망",
            "끝났어",
            "끝났다",
            "최악이야",
            "최악이다",
        ]
        
        # 부정 감정 키워드도 공백 무시해서 비교
        negative_count = 0
        for word in negative_words:
            word_no_space = word.replace(" ", "")
            if word in message_lower or word_no_space in message_no_space:
                negative_count += 1

        if negative_count >= 3:
            return True, "high"
        elif negative_count >= 1:
            return True, "medium"

        return False, "low"

    @staticmethod
    def get_crisis_recommendations(risk_level: str) -> list[str]:
        """위험 수준에 따른 권장사항"""
        base_recommendations = [
            "정신건강위기상담전화: 1393 (24시간)",
            "응급실: 119",
            "신뢰하는 사람에게 연락하기",
            "가까운 정신건강복지센터 방문",
        ]

        if risk_level == "critical":
            return [
                "즉시 응급실(119) 또는 정신건강위기상담전화(1393)에 연락하세요",
                "혼자 있지 마세요 - 신뢰하는 사람에게 연락하세요",
                "자살예방상담전화: 1588-9191",
            ] + base_recommendations
        elif risk_level == "high":
            return [
                "전문가 상담을 권장합니다",
            ] + base_recommendations
        else:
            return base_recommendations

