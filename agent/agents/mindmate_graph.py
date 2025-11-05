"""
LangGraph를 사용한 MindMate 워크플로우 그래프
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

from .crisis_detector import CrisisDetector
from .sentiment_analyzer import SentimentAnalyzer
from .chatbot_agent import ChatbotAgent, convert_messages_to_langchain


class MindMateState(TypedDict):
    """MindMate 상태 정의"""
    messages: Annotated[list[BaseMessage], add_messages]
    user_message: str
    user_id: str | None
    conversation_history: list[dict] | None
    ai_response: str | None
    sentiment_score: float | None
    risk_level: str | None
    is_crisis: bool
    crisis_detected: bool


class MindMateGraph:
    """MindMate 워크플로우 그래프"""

    def __init__(self):
        self.crisis_detector = CrisisDetector()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.chatbot = ChatbotAgent()

        # 그래프 구성
        self.graph = self._build_graph()

    @property
    def compiled_graph(self):
        """LangGraph CLI를 위한 컴파일된 그래프"""
        return self.graph

    def _build_graph(self) -> StateGraph:
        """워크플로우 그래프 구성"""
        workflow = StateGraph(MindMateState)

        # 노드 추가#
        workflow.add_node("detect_crisis", self._detect_crisis_node)
        workflow.add_node("analyze_sentiment", self._analyze_sentiment_node)
        workflow.add_node("generate_response", self._generate_response_node)
        workflow.add_node("handle_crisis", self._handle_crisis_node)

        # 엣지 설정
        workflow.set_entry_point("detect_crisis")
        workflow.add_edge("detect_crisis", "analyze_sentiment")
        workflow.add_edge("analyze_sentiment", "generate_response")
        workflow.add_conditional_edges(
            "generate_response",
            self._should_handle_crisis,
            {
                "crisis": "handle_crisis",
                "continue": END,
            },
        )
        workflow.add_edge("handle_crisis", END)

        return workflow.compile()

    def _detect_crisis_node(self, state: MindMateState) -> MindMateState:
        """위기 감지 노드"""
        message = state["user_message"]
        is_crisis, risk_level = self.crisis_detector.detect_crisis(message)

        state["is_crisis"] = is_crisis
        state["risk_level"] = risk_level
        state["crisis_detected"] = is_crisis

        return state

    def _analyze_sentiment_node(self, state: MindMateState) -> MindMateState:
        """감정 분석 노드"""
        message = state["user_message"]
        sentiment_score, _ = self.sentiment_analyzer.analyze(message)

        state["sentiment_score"] = sentiment_score

        return state

    def _generate_response_node(self, state: MindMateState) -> MindMateState:
        """응답 생성 노드"""
        user_message = state["user_message"]
        conversation_history = state.get("conversation_history")

        # 챗봇 응답 생성
        try:
            # 대화 이력을 LangChain 형식으로 변환
            langchain_messages = None
            if conversation_history:
                langchain_messages = convert_messages_to_langchain(conversation_history)
            
            ai_response = self.chatbot.get_response(user_message, langchain_messages)
        except Exception as e:
            ai_response = f"죄송합니다. 오류가 발생했습니다: {str(e)}"

        state["ai_response"] = ai_response

        return state

    def _handle_crisis_node(self, state: MindMateState) -> MindMateState:
        """위기 처리 노드"""
        risk_level = state["risk_level"]
        ai_response = state.get("ai_response", "")

        # 위기 상황 메시지 추가
        crisis_message = self._get_crisis_message(risk_level)
        updated_response = f"{ai_response}\n\n{crisis_message}"

        state["ai_response"] = updated_response

        # 위기 알림 메시지도 추가
        if state["messages"]:
            state["messages"][-1] = AIMessage(content=updated_response)

        return state

    def _should_handle_crisis(self, state: MindMateState) -> str:
        """위기 처리 여부 결정"""
        risk_level = state.get("risk_level", "low")
        if risk_level in ["high", "critical"]:
            return "crisis"
        return "continue"

    def _get_crisis_message(self, risk_level: str) -> str:
        """위기 상황 메시지 생성"""
        recommendations = self.crisis_detector.get_crisis_recommendations(risk_level)

        if risk_level == "critical":
            return (
                "⚠️ **긴급 안내**\n\n"
                "현재 상태를 매우 우려하고 있습니다. 즉시 전문가의 도움이 필요합니다.\n\n"
                f"- 정신건강위기상담전화: 1393 (24시간)\n"
                f"- 응급실: 119\n"
                f"- 자살예방상담전화: 1588-9191\n\n"
                "혼자 있지 마시고 신뢰하는 사람에게 연락하세요."
            )
        elif risk_level == "high":
            return (
                "⚠️ **중요 안내**\n\n"
                "현재 상태를 우려하고 있습니다. 전문가의 도움이 필요할 수 있습니다.\n\n"
                f"- 정신건강위기상담전화: 1393 (24시간)\n"
                f"- 응급실: 119"
            )
        else:
            return ""

    def process(self, user_message: str, user_id: str | None = None, 
                conversation_history: list[dict] | None = None) -> dict:
        """워크플로우 실행"""
        initial_state: MindMateState = {
            "messages": [],
            "user_message": user_message,
            "user_id": user_id,
            "conversation_history": conversation_history,
            "ai_response": None,
            "sentiment_score": None,
            "risk_level": None,
            "is_crisis": False,
            "crisis_detected": False,
        }

        # 그래프 실행
        final_state = self.graph.invoke(initial_state)

        return {
            "message": final_state["ai_response"] or "",
            "sentiment_score": final_state["sentiment_score"],
            "risk_level": final_state["risk_level"],
            "is_crisis": final_state["crisis_detected"],
        }


# LangGraph CLI를 위한 그래프 export
def create_graph():
    """LangGraph CLI를 위한 그래프 생성 함수"""
    graph_instance = MindMateGraph()
    return graph_instance.graph


# 기본 그래프 export (LangGraph CLI 사용)
graph = create_graph()

