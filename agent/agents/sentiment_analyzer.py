"""
감정 분석 모듈
"""

from typing import Tuple


class SentimentAnalyzer:
    """감정 분석기"""

    @staticmethod
    def calculate_sentiment(message: str) -> float:
        """감정 점수 계산 (-1 ~ 1)
        
        Args:
            message: 분석할 메시지
            
        Returns:
            sentiment_score: 감정 점수 (-1: 매우 부정적, 1: 매우 긍정적)
        """
        message_lower = message.lower()

        positive_words = [
            "좋아",
            "기쁘",
            "행복",
            "만족",
            "감사",
            "희망",
            "기대",
            "즐거",
            "편안",
            "안정",
        ]
        negative_words = [
            "슬프",
            "힘들",
            "괴로",
            "무력",
            "절망",
            "두려",
            "불안",
            "짜증",
            "우울",
            "좌절",
        ]

        positive_count = sum(1 for word in positive_words if word in message_lower)
        negative_count = sum(1 for word in negative_words if word in message_lower)

        if positive_count == 0 and negative_count == 0:
            return 0.0

        total = positive_count + negative_count
        sentiment = (positive_count - negative_count) / total

        return max(-1.0, min(1.0, sentiment))

    @staticmethod
    def get_sentiment_label(score: float) -> str:
        """감정 점수로부터 레이블 결정"""
        if score > 0.3:
            return "positive"
        elif score < -0.3:
            return "negative"
        else:
            return "neutral"

    @staticmethod
    def analyze(message: str) -> Tuple[float, str]:
        """감정 분석
        
        Args:
            message: 분석할 메시지
            
        Returns:
            (sentiment_score, label): 감정 점수와 레이블
        """
        score = SentimentAnalyzer.calculate_sentiment(message)
        label = SentimentAnalyzer.get_sentiment_label(score)
        return score, label

