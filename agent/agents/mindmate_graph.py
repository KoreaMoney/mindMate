"""
LangGraph를 사용한 MindMate 워크플로우 그래프
"""

from typing import TypedDict, Annotated, List
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
        sentiment_score = state.get("sentiment_score")
        is_crisis = state.get("is_crisis", False)
        risk_level = state.get("risk_level", "low")

        # 챗봇 응답 생성
        try:
            # 대화 이력을 LangChain 형식으로 변환
            langchain_messages = None
            if conversation_history:
                langchain_messages = convert_messages_to_langchain(conversation_history)
            
            # 위기 상황일 때는 특별한 프롬프트 추가
            if is_crisis and risk_level in ["critical", "high"]:
                ai_response = self._generate_crisis_response(user_message, langchain_messages)
            else:
                ai_response = self.chatbot.get_response(user_message, langchain_messages)
            
            # 감정이 부정적이거나 사용자가 노래 추천을 요청한 경우 자동으로 노래 추천 추가
            should_recommend_music = False
            music_recommendation = ""
            
            # 1. 명시적 노래 추천 요청 감지
            music_keywords = ["노래", "음악", "추천", "들려줘", "들어볼래", "추천해줘"]
            if any(keyword in user_message for keyword in music_keywords):
                should_recommend_music = True
            
            # 2. 부정적 감정 감지 시 자동 추천
            elif sentiment_score is not None and sentiment_score < -0.3:
                should_recommend_music = True
            
            # 3. 감정 키워드 감지
            negative_keywords = [
                "우울", "슬퍼", "힘들어", "지쳐", "피곤", "외로워", "외롭", "슬픔", "눈물",
                "울고싶", "울고 싶", "울고싶어", "울고 싶어", "울고싶다", "울고 싶다",
                "울어", "울었어", "울었", "울었어요", "울었습니다",
                "슬프", "슬프다", "슬퍼요", "슬퍼서", "슬프네", "슬프네요",
                "힘들", "힘들다", "힘들어요", "힘들어서", "힘들었어", "힘들었어요",
                "지쳤", "지쳤어", "지쳤어요", "지쳤습니다", "지치", "지친",
                "피곤해", "피곤해요", "피곤하다", "피곤해서", "피곤했어",
                "외로", "외롭다", "외로워요", "외로워서", "외로웠어", "외로웠어요",
                "눈물", "눈물나", "눈물나요", "눈물나네", "눈물났어", "눈물났어요",
                "아픈", "아프", "아파", "아파요", "아프다", "아파서",
                "괴로", "괴롭", "괴로워", "괴로워요", "괴로워서", "괴로웠어",
                "답답", "답답해", "답답해요", "답답하다", "답답해서",
                "불안", "불안해", "불안해요", "불안하다", "불안해서",
                "걱정", "걱정돼", "걱정돼요", "걱정돼서", "걱정이",
                "무기력", "무기력해", "무기력해요", "무기력하다",
                "의미없", "의미 없", "의미없어", "의미 없어", "의미없다",
                "소용없", "소용 없", "소용없어", "소용 없어",
                "미안", "미안해", "미안해요", "미안해서", "죄송",
                "후회", "후회돼", "후회돼요", "후회돼서", "후회해",
                "실망", "실망해", "실망해요", "실망해서", "실망했어",
                "절망", "절망적", "절망해", "절망해요",
                "상처", "상처받", "상처받았", "상처받았어", "상처받았어요",
                "서러", "서러워", "서러워요", "서러워서",
                "쓸쓸", "쓸쓸해", "쓸쓸해요", "쓸쓸해서",
                "허탈", "허탈해", "허탈해요", "허탈해서",
                "공허", "공허해", "공허해요", "공허해서",
            ]
            if any(keyword in user_message for keyword in negative_keywords):
                should_recommend_music = True
            
            if should_recommend_music:
                try:
                    # 간단한 노래 추천 생성
                    music_recommendation = self._generate_music_recommendation(user_message, sentiment_score)
                    if music_recommendation:
                        ai_response += f"\n\n{music_recommendation}"
                except Exception as e:
                    print(f"⚠️ 노래 추천 생성 오류: {str(e)}")
                    # 오류가 발생해도 기본 응답은 유지
            
        except Exception as e:
            ai_response = f"죄송합니다. 오류가 발생했습니다: {str(e)}"

        state["ai_response"] = ai_response

        return state
    
    def _generate_crisis_response(self, user_message: str, conversation_history: List[BaseMessage] = None) -> str:
        """위기 상황에서의 특별한 응답 생성"""
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import HumanMessage, SystemMessage
            
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.8)
            
            crisis_prompt = f"""The user said: "{user_message}". This user is in a very difficult situation right now and may be thinking about suicide.

Deliver a warm and hopeful message similar to the following lyrics:

"죽지 마 (Don't die)
동굴 속에 숨지 마 (Don't hide in a cave)
기죽지 마 (Don't lose heart)
완벽하게 안 살아도 돼 (You don't have to live perfectly)
거울 앞에서 그렇게 울지 마 (Don't cry like that in front of the mirror)
흔들리는 것들이 예뻐 (Things that sway are beautiful)
그러니까 흔들리면 흔들리게 둬 (So if they sway, let them sway)
아니, 춤을 춘다 생각해 (No, think of it as dancing)
외로운 발자국 하나 하나 (Each lonely footprint)
지구에 키스마크를 남긴다고 생각해 (Think of it as leaving kiss marks on Earth)
눈앞이 캄캄해져서 아무것도 안 보일 땐 (When everything goes dark and you can't see)
넌 그냥 멋진 선글라스를 낀 거야 (You're just wearing cool sunglasses)
무지개는 굽어야 무지개고 (Rainbows need to be curved to be rainbows)
늘 비가 온 뒤 떠 (They always appear after rain)
좀 지친 거야 (You're just tired)
알아 (I know)
행복이란 게 마치 숨바꼭질 같았겠지 (Happiness must have been like hide and seek)
골목 모퉁이 (Around the corner)
방구석 책장 뒤 (Behind the bookshelf in the corner)
침대 밑 (Under the bed)
아무리 뒤져도 보이지 않았겠지 (No matter how much you searched, you couldn't find it)
영원히 술래라고 느꼈겠지 (You must have felt like you were always 'it')
내일이 왔을 때 (When tomorrow comes)
네가 아직도 여기 있을 거란 걸 (That you'll still be here)
못 믿겠다면 (If you can't believe it)
네가 널 못 믿겠으면 (If you can't believe in yourself)
내가 너를 믿어줄게 (I'll believe in you)
아무리 사소하더라도 계속 살아야 될 이유를 (Reasons to keep living, no matter how small)
내가 한번 말해볼게 (Let me tell you)
죽지 마 (Don't die)
뻔한 말이라도 들어, 야 들어 (Even if it's a cliché, listen, hey listen)
아무것도 아냐 (It's nothing)
지나가면 진짜 아무것도 아냐 (When it passes, it's really nothing)
여기 있는 사람들 백 년 뒤면 다 사라져 (Everyone here will be gone in a hundred years)
그러니까 (So)
한 시간만 더 살아보자 (Let's live one more hour)
건조기 돌리면 한 시간 금방 가 (If you run the dryer, an hour goes by quickly)
한 시간이 지나면 건조기에서 갓 나온 빨래 냄새 (After an hour, the smell of freshly dried laundry)
그거 맡으면서 힘내자 (Let's stay strong while smelling that)
그렇게 하루 더 살자 (Let's live one more day like that)
하루 더 살면 (If we live one more day)
쿠팡에서 제일 비싼 샴푸 린스 산 다음에 (After buying the most expensive shampoo and rinse from Coupang)
그 두 개를 동시에 다 써버릴 때까지 (Until we use up both of them at the same time)
집에 오는 길 현관 바로 앞에서 (Right in front of the entrance on the way home)
듣고 있던 노래가 영화처럼 딱 끝날 때까지 (Until the song we were listening to ends perfectly like in a movie)
그런 하찮은 행운이 너한테도 한 번쯤 올 때까지 (Until such trivial luck comes to you at least once)
한 달만 더 살아보자 (Let's live one more month)
그렇게 하루를 더 살고 한 달 더 살면 (If we live one more day and one more month like that)
올해도 금방이야 (This year will pass quickly too)
그렇게 우리 (Like that, us)
오늘 보고 내일 보고 (See each other today and tomorrow)
모레 또 봐 (And the day after)
매일 매일 오래 봐 (See each other every day for a long time)
오늘은 죽지 마 (Don't die today)"

Referencing the tone and message of these lyrics, deliver a warm and sincere message of comfort to the user.

Requirements:
- Include direct and warm messages like "죽지 마" (don't die), "오늘은 죽지 마" (don't die today)
- Let them know it's okay not to live perfectly
- Tell them that things that sway are beautiful, and if they sway, let them sway
- Help them find meaning in small things (the smell of freshly dried laundry, favorite songs, shampoo scent - small everyday things)
- Present concrete and achievable goals like "한 시간만 더 살아보자" (let's live one more hour), "하루만 더 살아보자" (let's live one more day)
- Deliver the message that "지나가면 진짜 아무것도 아냐" (when it passes, it's really nothing), but warmly, not preachy
- Deliver the message "내가 너를 믿어줄게" (I'll believe in you)
- Comfort them that even when everything seems dark, it's just like wearing cool sunglasses
- Naturally mention that rainbows need to be curved to be rainbows, and they always appear after rain
- Tell them to wait for small fortunes to come
- Deliver even clichéd words warmly and sincerely, as if asking them to listen
- Absolutely avoid mechanical or stiff speech
- Absolutely avoid exclamations like "와", "와!"
- Use polite but warm and natural language, like a close friend you've known for a long time
- Keep it concise and to the point (about 3-5 paragraphs)
- Make sure genuine warmth is felt

IMPORTANT: Always respond in Korean. Use natural, warm Korean language throughout your response."""

            messages = [SystemMessage(content="You are a warm and empathetic counseling friend who genuinely understands and empathizes with users. Your most important mission is to deliver hope and comfort to users in crisis situations. Always respond in Korean with natural, warm language.")]
            
            if conversation_history:
                # 최근 대화 이력 일부만 포함 (너무 길어지지 않도록)
                recent_history = conversation_history[-4:] if len(conversation_history) > 4 else conversation_history
                messages.extend(recent_history)
            
            messages.append(HumanMessage(content=crisis_prompt))
            
            response = llm.invoke(messages)
            return response.content
        except Exception as e:
            print(f"❌ 위기 상황 응답 생성 오류: {str(e)}")
            # 폴백: 기본 챗봇 응답 사용
            return self.chatbot.get_response(user_message, conversation_history)
    
    def _generate_music_recommendation(self, user_message: str, sentiment_score: float = None) -> str:
        """간단한 노래 추천 생성"""
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import HumanMessage, SystemMessage
            
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
            
            # 감정 상태 판단
            if sentiment_score is not None:
                if sentiment_score < -0.5:
                    mood_desc = "very depressed and sad"
                elif sentiment_score < -0.2:
                    mood_desc = "depressed and struggling"
                elif sentiment_score < 0.2:
                    mood_desc = "calm"
                else:
                    mood_desc = "positive and happy"
            else:
                mood_desc = "current emotional state"
            
            prompt = f"""The user said: "{user_message}". Their current emotional state is {mood_desc}.

Recommend 1-2 songs available on YouTube that match this emotion.

Requirements:
- Clearly provide the artist name and song title
- Explain the recommendation reason in one sentence
- Include a YouTube search link (format: https://www.youtube.com/results?search_query=artistname+songtitle)
- Use natural and warm tone, like a friend recommending

Response format:
🎵 이런 기분일 때 들으면 좋을 노래를 추천해줄게. (I'll recommend a song that's good to listen to when you feel like this.)

[Artist Name - Song Title]
추천 이유: ... (Recommendation reason: ...)
유튜브: https://www.youtube.com/results?search_query=...

IMPORTANT: Always respond in Korean. Use natural, warm Korean language."""

            response = llm.invoke([
                SystemMessage(content="You are a music recommendation expert. Recommend songs that match the user's emotions warmly. Always respond in Korean."),
                HumanMessage(content=prompt),
            ])
            
            return response.content
        except Exception as e:
            print(f"❌ 노래 추천 생성 오류: {str(e)}")
            return ""

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

