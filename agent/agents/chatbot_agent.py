"""
LangChain을 사용한 챗봇 에이전트
"""

from typing import List, Optional, TypedDict, Annotated
from datetime import datetime

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
import operator


# 시스템 프롬프트
SYSTEM_PROMPT = """너는 사용자를 진심으로 이해하고 공감하는 친구야. 상담사가 아니라 정말 친한 친구처럼 다가가서 대화해줘.

가장 중요한 것:
- 먼저 듣고, 그 감정을 진심으로 인정하고 공감해줘
- 쉽게 조언하지 말고, 상대방의 감정을 먼저 받아줘
- "그럴 수 있어", "정말 힘들었겠다", "완전 이해해" 같은 자연스러운 공감 표현 사용
- 기계적이거나 딱딱한 표현 지양, 사람과 사람이 대화하는 느낌 유지

자연스러운 공감 표현 예시:
- "그렇게 느끼는 거 완전 이해해"
- "정말 힘들었겠다, 안타깝다"
- "그럴 수 있어, 누구나 그런 때가 있지"
- "네 마음 정말 잘 알겠어"
- "너 지금 많이 힘든 게 느껴져"
- "그 감정 정당해, 틀린 거 아니야"

말투:
- 존댓말을 쓰되 친근하고 자연스럽게
- "너"를 쓰고, "~해줄래?", "~지?", "~네" 같은 편안한 어미 사용
- 판단하거나 평가하지 말고, 감정을 인정하고 이해하는 것에 집중
- 조언이 필요할 때도 친구가 조언해주는 것처럼 자연스럽게

응답 스타일:
- 진부한 공감 표현 피하기 (예: "그럴 수 있다는 걸 알고 있어요")
- 대신 진짜 친구가 공감하듯이 자연스럽게 말하기
- 너무 길지 않게, 핵심적으로
- 위기 상황이면 진지하게 대응하되, 말투는 여전히 따뜻하고 자연스럽게
"""

# 초기 질문 생성 프롬프트
INITIAL_QUESTION_PROMPT = """사용자의 기존 기록을 보고, 진심으로 공감하는 친구처럼 자연스럽게 초기 질문을 만들어줘.

사용자 정보:
- 평균 감정 점수: {avg_score}
- 최근 경향: {trend}
- 마지막 기록: {last_mood}
- 자주 언급된 주제: {topics}

생성 요구사항:
1. 기계적이지 않게, 진짜 친구가 물어보는 것처럼 자연스럽게
2. 사용자의 상태를 인정하고 공감하는 톤으로 시작하기
3. 쉽게 "괜찮아질 거야"라고 하지 말고, 먼저 듣고 이해하려는 자세로
4. 한 문장 또는 두 문장으로 간결하게
5. "요즘 어때?", "무슨 일 있어?", "편하게 이야기해줄래?" 같은 자연스러운 표현

초기 질문을 생성해줘:"""


class ChatbotAgent:
    """LangChain을 사용한 챗봇 에이전트"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0.7):
        self.llm = ChatOpenAI(model=model_name, temperature=temperature)
        self.memory = ChatMessageHistory()

        # 프롬프트 템플릿 설정
        self.prompt = ChatPromptTemplate.from_messages(
            [
                ("system", SYSTEM_PROMPT),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
            ]
        )

        # 체인 구성
        def get_chat_history(x):
            messages = self.memory.messages[-10:]
            return messages if messages else []
        
        self.chain = (
            RunnablePassthrough.assign(
                chat_history=get_chat_history
            )
            | self.prompt
            | self.llm
            | StrOutputParser()
        )

    def get_response(
        self, user_message: str, conversation_history: Optional[List[BaseMessage]] = None
    ) -> str:
        """사용자 메시지에 대한 응답 생성"""
        try:
            # 메모리 초기화 (새로운 대화를 위해)
            self.memory.clear()
            
            # 대화 이력이 있으면 메모리에 추가
            if conversation_history:
                for msg in conversation_history:
                    if isinstance(msg, dict):
                        if msg.get("role") == "user":
                            self.memory.add_user_message(
                                msg.get("content", "")
                            )
                        elif msg.get("role") == "assistant":
                            self.memory.add_ai_message(
                                msg.get("content", "")
                            )
                    elif hasattr(msg, 'content'):
                        # BaseMessage 객체인 경우
                        if hasattr(msg, '__class__') and 'Human' in msg.__class__.__name__:
                            self.memory.add_user_message(msg.content)
                        elif hasattr(msg, '__class__') and 'AI' in msg.__class__.__name__:
                            self.memory.add_ai_message(msg.content)
                    else:
                        self.memory.add_message(msg)

            # 응답 생성
            response = self.chain.invoke({"input": user_message})

            return response
        except Exception as e:
            raise Exception(f"챗봇 응답 생성 오류: {str(e)}")

    def generate_initial_question(self, user_stats: dict) -> str:
        """사용자 기록을 기반으로 초기 질문 생성
        
        Args:
            user_stats: 사용자 통계 정보
                - avg_score: 평균 감정 점수
                - trend: 최근 추세
                - last_mood: 마지막 기분 기록
                - topics: 자주 언급된 주제들
                
        Returns:
            생성된 초기 질문
        """
        try:
            prompt_text = INITIAL_QUESTION_PROMPT.format(
                avg_score=user_stats.get("avg_score", "5.0"),
                trend=user_stats.get("trend", "안정적"),
                last_mood=user_stats.get("last_mood", "기록 없음"),
                topics=user_stats.get("topics", "일반적인 상담"),
            )
            
            response = self.llm.invoke([
                SystemMessage(content="너는 사용자를 진심으로 이해하고 공감하는 친구야. 상담사가 아니라 정말 친한 친구처럼 다가가서 대화해줘. 먼저 듣고 감정을 인정하는 것에 집중하고, 자연스러운 공감 표현을 사용해줘."),
                HumanMessage(content=prompt_text),
            ])
            
            return response.content
        except Exception as e:
            # 기본 질문으로 폴백
            return "요즘 기분이 어때? 편하게 이야기해줄래?"

    def clear_memory(self):
        """대화 메모리 초기화"""
        self.memory.clear()


def convert_messages_to_langchain(
    messages: Optional[List[dict]],
) -> List[BaseMessage]:
    """대화 이력을 LangChain 메시지 형식으로 변환"""
    if not messages:
        return []

    langchain_messages = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")

        if role == "user":
            langchain_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            langchain_messages.append(AIMessage(content=content))
        elif role == "system":
            langchain_messages.append(SystemMessage(content=content))

    return langchain_messages

