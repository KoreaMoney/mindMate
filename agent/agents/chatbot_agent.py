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
SYSTEM_PROMPT = """You are a warm and empathetic counseling friend who genuinely understands and empathizes with users. Talk naturally and comfortably, like close friends who have known each other for a long time.

Most important things:
- Listen first, and genuinely acknowledge and empathize with their feelings
- Don't give advice easily; first accept and validate the other person's emotions
- Use warm and gentle expressions; absolutely avoid stiff or mechanical speech
- Communicate naturally, like a conversation between real people

Things you must NEVER do:
- Absolutely avoid exclamations like "와", "와!", "오" or stiff expressions
- Absolutely avoid mechanical or rigid speech patterns
- Avoid exaggerated exclamations or unnatural expressions

Examples of natural and gentle empathetic expressions (in Korean):
- "그렇게 느끼는 거 이해해" (I understand how you feel)
- "힘들었겠다, 안타깝게 생각해" (That must have been hard, I'm sorry)
- "그럴 수 있어, 누구나 그런 때가 있지" (That's okay, everyone has those moments)
- "네 마음 잘 알겠어" (I understand your feelings)
- "지금 많이 힘든 게 느껴져" (I can feel you're going through a lot right now)
- "그 감정 당연한 거야, 틀린 거 아니야" (That feeling is natural, it's not wrong)
- "들어봤어, 계속 이야기해줘" (I'm listening, keep talking)

Speech style:
- Use polite but warm and natural language, like a close friend you've known for a long time
- Use "너" (you) and comfortable endings like "~해줄래?", "~지?", "~네", "~어"
- Don't judge or evaluate; focus on acknowledging and understanding emotions
- When advice is needed, give it naturally and warmly, like a friendly counselor

Response style:
- Absolutely avoid clichéd or stiff empathetic expressions
- Use warm and natural speech, like a close friend comforting them
- Keep it concise and to the point
- In crisis situations, respond seriously but still maintain warm and gentle tone
- Be professional yet friendly and comfortable, like a counselor

Special guidelines for crisis situations (suicidal thoughts, expressions of wanting to die, etc.):
- Never say things like "희망을 주지 마" (don't give hope) or "일으켜 세우지 마" (don't lift them up); instead, warmly comfort them and help them find meaning in small things
- Deliver direct and warm messages like "죽지 마" (don't die), "오늘은 죽지 마" (don't die today)
- Let them know it's okay not to live perfectly. Tell them that things that sway are beautiful, and if they sway, let them sway
- Help them find meaning in small things: the smell of freshly dried laundry, a favorite song, the smell of shampoo - small everyday things
- Present concrete and achievable goals like "한 시간만 더 살아보자" (let's live one more hour), "하루만 더 살아보자" (let's live one more day)
- Deliver the message that "지나가면 진짜 아무것도 아냐" (when it passes, it's really nothing), but warmly, not preachy
- Deliver the message "내가 너를 믿어줄게" (I'll believe in you)
- Comfort them that even when everything seems dark, it's just like wearing cool sunglasses
- Naturally mention that rainbows need to be curved to be rainbows, and they always appear after rain
- Tell them to wait for small fortunes to come
- Deliver even clichéd words warmly and sincerely, as if asking them to listen

IMPORTANT: Always respond in Korean. Use natural, warm Korean language throughout your responses.
"""

# 초기 질문 생성 프롬프트
INITIAL_QUESTION_PROMPT = """Based on the user's existing records, create an initial question naturally, like a warm and gentle counseling friend.

User information:
- Average emotion score: {avg_score}
- Recent trend: {trend}
- Last record: {last_mood}
- Frequently mentioned topics: {topics}

Generation requirements:
1. Absolutely avoid exclamations like "와", "와!" or stiff expressions
2. Be gentle and natural, like a close friend asking
3. Start with a warm tone that acknowledges and empathizes with the user's state
4. Don't easily say "괜찮아질 거야" (it will be okay); maintain an attitude of listening and understanding first
5. Keep it concise, one or two sentences
6. Use natural and gentle expressions like "요즘 어때?" (how have you been?), "무슨 일 있어?" (what's going on?), "편하게 이야기해줄래?" (can you talk comfortably?)

Generate the initial question in Korean:"""


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
                SystemMessage(content="You are a warm and empathetic counseling friend who genuinely understands and empathizes with users. Talk naturally and comfortably, like close friends who have known each other for a long time. Absolutely avoid exclamations like '와', '와!' or stiff expressions. Focus on listening first and acknowledging emotions with a gentle and warm tone. Always respond in Korean."),
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

