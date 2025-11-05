"use client";

import { useState, useRef, useEffect } from "react";
import { Send, AlertTriangle, Mic, Volume2, Square, VolumeX } from "lucide-react";
import { sendChatMessage, type ChatMessage, type OnboardingData } from "../lib/api";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface ChatBotProps {
  userId?: string;
  onEmergencyDetected?: (riskLevel: "medium" | "high" | "critical") => void;
  onboardingData?: OnboardingData | null;
}

// SpeechRecognition 타입 정의
declare global {
  interface Window {
    SpeechRecognition: unknown;
    webkitSpeechRecognition: unknown;
  }
}

const ChatBot = ({ userId, onEmergencyDetected, onboardingData }: ChatBotProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high" | "critical" | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<unknown>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const shouldSpeakGreetingRef = useRef(false);
  const voicesLoadedRef = useRef(false);

  // TTS 음성 목록 로드
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesRef.current = voices;
          voicesLoadedRef.current = true;
          console.log("🔊 Available voices:", voices.length);
          console.log(
            "🇰🇷 Korean voices:",
            voices.filter((v) => v.lang.includes("ko") || v.lang.includes("KR"))
          );
        }
      }
    };

    // 즉시 로드 시도
    loadVoices();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // 음성 목록이 로드되면 다시 시도
      window.speechSynthesis.onvoiceschanged = loadVoices;

      // 일부 브라우저에서는 onvoiceschanged가 호출되지 않을 수 있으므로
      // 추가로 시도
      const checkInterval = setInterval(() => {
        if (!voicesLoadedRef.current) {
          loadVoices();
        } else {
          clearInterval(checkInterval);
        }
      }, 100);

      // 최대 3초 후에는 interval 정리
      setTimeout(() => clearInterval(checkInterval), 3000);
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // 음성 인식 초기화
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognitionRef.current = new SpeechRecognition() as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = recognitionRef.current as any;
        recognition.lang = "ko-KR";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              setInput((prev) => prev + transcript + " ");
            }
          }
        };
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 온보딩 완료 후 자동 인사
  useEffect(() => {
    if (onboardingData && !hasGreeted && messages.length === 0) {
      const greetingMessage: ChatMessage = {
        role: "assistant",
        content: `안녕하세요, ${onboardingData.name}님! 👋\n\n저는 MindMate입니다. 당신의 정신건강을 함께 케어해드릴게요.\n\n오늘 어떤하루를 보내셨어요? 항상 Mate에게 편하게 얘기해주세요. 제가 여기 있으니까요! 😊`,
      };
      setMessages([greetingMessage]);
      setHasGreeted(true);
      shouldSpeakGreetingRef.current = true;
    }
  }, [onboardingData, messages.length, hasGreeted]);

  // 인사 메시지가 추가되면 음성으로 읽어주기
  useEffect(() => {
    if (shouldSpeakGreetingRef.current && messages.length > 0 && messages[0]?.role === "assistant") {
      shouldSpeakGreetingRef.current = false;
      const timer = setTimeout(() => {
        handleSpeak(messages[0].content);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // 음성 입력 시작/중지
  const handleVoiceInput = () => {
    if (!recognitionRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = recognitionRef.current as any;

    if (isListening) {
      recognition.stop();
    } else {
      setInput("");
      recognition.start();
    }
  };

  // TTS 중지
  const stopSpeaking = async (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        console.log("🛑 Speech stopped");
        // cancel 후 완전히 정리될 때까지 대기
        setTimeout(() => resolve(), 100);
      } else {
        resolve();
      }
    });
  };

  // 이모지 및 특수 문자 제거
  const cleanTextForTTS = (text: string): string => {
    // 이모지 및 특수 문자 제거 (더 포괄적인 패턴)
    const cleaned = text
      // 이모지 범위 제거
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // 기본 이모지
      .replace(/[\u{2600}-\u{26FF}]/gu, "") // 기타 기호
      .replace(/[\u{2700}-\u{27BF}]/gu, "") // Dingbats
      .replace(/[\u{1F600}-\u{1F64F}]/gu, "") // 감정 이모지
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // 교통 및 지도
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "") // 국기
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, "") // 보조 이모지
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "") // 체스 기호
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "") // 확장 기호
      // 추가 이모지 범위
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // Variation Selectors
      .replace(/[\u{200D}]/gu, "") // Zero Width Joiner
      .replace(/[\u{200C}-\u{200D}]/gu, "") // Zero Width Non-Joiner
      // 연속된 공백 정리
      .replace(/\s+/g, " ")
      .trim();

    if (text !== cleaned) {
      console.log(`🧹 Cleaned text: "${text.substring(0, 30)}..." → "${cleaned.substring(0, 30)}..."`);
    }

    return cleaned;
  };

  // 음성이 로드될 때까지 기다리는 헬퍼 함수
  const waitForVoices = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      if (voicesLoadedRef.current && voicesRef.current.length > 0) {
        resolve(voicesRef.current);
        return;
      }

      // 음성이 이미 로드되어 있는지 확인
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesRef.current = voices;
          voicesLoadedRef.current = true;
          resolve(voices);
          return;
        }
      }

      // 음성이 로드될 때까지 대기
      let attempts = 0;
      const maxAttempts = 30; // 최대 3초 대기

      const checkVoices = setInterval(() => {
        attempts++;
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            voicesRef.current = voices;
            voicesLoadedRef.current = true;
            clearInterval(checkVoices);
            resolve(voices);
            return;
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(checkVoices);
          // 타임아웃이어도 현재 있는 음성 반환
          resolve(voicesRef.current);
        }
      }, 100);
    });
  };

  // TTS (텍스트 음성 변환) - 향상된 브라우저 Web Speech API
  const handleSpeak = async (text: string) => {
    try {
      if (!("speechSynthesis" in window)) {
        console.warn("❌ TTS not supported in this browser");
        return;
      }

      // 이모지 제거 및 텍스트 정리
      const cleanedText = cleanTextForTTS(text);
      if (!cleanedText || cleanedText.length === 0) {
        console.warn("⚠️ Text is empty after cleaning");
        return;
      }

      console.log("🔊 Starting TTS for text:", cleanedText.substring(0, 50) + "...");

      // 기존 음성이 재생 중이면 완전히 중단될 때까지 대기
      await stopSpeaking();

      // 음성 목록이 로드될 때까지 대기
      const voices = await waitForVoices();
      console.log("🎤 Total voices available:", voices.length);

      if (voices.length === 0) {
        console.warn("⚠️ No voices available, retrying...");
        // 음성이 없으면 기본 음성으로 시도
        const defaultVoices = window.speechSynthesis.getVoices();
        if (defaultVoices.length > 0) {
          voicesRef.current = defaultVoices;
          voicesLoadedRef.current = true;
        }
      }

      // utterance 생성 전에 speechSynthesis 상태 확인
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        console.warn("⚠️ Speech synthesis is still busy, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = "ko-KR";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0; // 최대 볼륨으로 설정

      // 볼륨 확인 및 로그
      console.log("🔊 Utterance settings:", {
        volume: utterance.volume,
        rate: utterance.rate,
        pitch: utterance.pitch,
        lang: utterance.lang,
      });

      if (utterance.volume === 0) {
        console.error("❌ ERROR: Utterance volume is 0!");
      }

      // 현재 utterance 저장
      currentUtteranceRef.current = utterance;

      // 한국어 음성 선택
      const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();

      const koreanVoice =
        availableVoices.find((v) => v.lang === "ko-KR") ||
        availableVoices.find((v) => v.lang.startsWith("ko")) ||
        availableVoices.find((v) => v.lang.includes("KR"));

      if (koreanVoice) {
        utterance.voice = koreanVoice;
        console.log(`✅ Using voice: ${koreanVoice.name} (${koreanVoice.lang})`);
      } else {
        console.log("⚠️ No Korean voice found, using default voice");
        // 한국어 음성이 없어도 기본 음성으로 재생
        if (availableVoices.length > 0) {
          utterance.voice = availableVoices[0];
        }
      }

      let startTimeout: NodeJS.Timeout | null = null;
      let statusCheckInterval: NodeJS.Timeout | null = null;

      utterance.onstart = () => {
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
        setIsSpeaking(true);
        console.log("✅ Speech started successfully (onstart event fired)");
        console.log("🔊 Current utterance:", {
          text: utterance.text.substring(0, 30),
          lang: utterance.lang,
          voice: utterance.voice?.name,
          volume: utterance.volume,
          rate: utterance.rate,
          pitch: utterance.pitch,
        });

        // 실제로 재생되고 있는지 확인
        const checkAfterStart = setInterval(() => {
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            console.warn("⚠️ Speech stopped unexpectedly after onstart");
            clearInterval(checkAfterStart);
          }
        }, 200);

        // 5초 후 interval 정리
        setTimeout(() => clearInterval(checkAfterStart), 5000);
      };

      utterance.onend = () => {
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          statusCheckInterval = null;
        }
        if (currentUtteranceRef.current === utterance) {
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
          console.log("✅ Speech ended (onend event fired) - This confirms speech actually played!");
          console.log("✅ If you heard the speech, TTS is working correctly!");
          console.log("✅ If you did NOT hear the speech, check system/browser volume settings");
        }
      };

      utterance.onerror = (event) => {
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          statusCheckInterval = null;
        }
        if (currentUtteranceRef.current === utterance) {
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
          // "canceled"는 정상적인 중단이므로 무시
          // "not-allowed"는 브라우저 정책상 자동 재생이 차단된 경우
          if (event.error !== "canceled" && event.error !== "not-allowed") {
            console.error("❌ Speech error:", event.error, event);
          } else if (event.error === "not-allowed") {
            console.log("🔇 Speech blocked by browser policy (auto-play not allowed)");
          }
        }
      };

      // 재생 시도 - utterance 설정 후 약간의 지연을 두고 호출
      try {
        // Chrome/Edge에서 속성 설정 후 바로 호출하면 작동하지 않을 수 있음
        await new Promise((resolve) => setTimeout(resolve, 50));

        console.log("🎯 Calling speechSynthesis.speak()");
        console.log("📊 SpeechSynthesis state:", {
          speaking: window.speechSynthesis.speaking,
          pending: window.speechSynthesis.pending,
          paused: window.speechSynthesis.paused,
        });

        // speak() 호출 전에 이전 utterance 정리
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        window.speechSynthesis.speak(utterance);

        // speak() 호출 직후 상태 확인 및 필요시 resume
        setTimeout(() => {
          if (window.speechSynthesis.paused) {
            console.log("🔄 Speech is paused, trying to resume...");
            try {
              window.speechSynthesis.resume();
            } catch (e) {
              console.warn("⚠️ Resume failed:", e);
            }
          }
        }, 50);

        // speak() 호출 후 즉시 상태 확인
        setTimeout(() => {
          const isActive = window.speechSynthesis.speaking || window.speechSynthesis.pending;
          console.log("📊 After speak() call:", {
            speaking: window.speechSynthesis.speaking,
            pending: window.speechSynthesis.pending,
            isActive,
          });

          if (!isActive && currentUtteranceRef.current === utterance) {
            console.warn("⚠️ Speech did not enter active state immediately");
          } else if (isActive) {
            // speaking이 true인데 onstart가 아직 발생하지 않았다면 경고
            console.log("⏳ Speaking state is true, waiting for onstart event...");

            // onstart가 500ms 내에 발생하지 않으면 상태 확인 로직이 대신 처리하도록 함
            // (statusCheckInterval이 consecutiveActiveChecks를 통해 처리)
            setTimeout(() => {
              if (currentUtteranceRef.current === utterance && !isSpeaking) {
                const actuallySpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;

                if (!actuallySpeaking) {
                  console.warn("⚠️ WARNING: speaking became false before onstart fired!");
                  console.warn("⚠️ Retrying immediately...");
                  // 즉시 재시도
                  window.speechSynthesis.cancel();
                  setTimeout(() => {
                    window.speechSynthesis.speak(utterance);
                    console.log("🔄 Immediate retry: speak() called again");
                  }, 100);
                } else {
                  // speaking은 true인데 onstart가 발생하지 않음 - 상태 확인 로직이 처리함
                  console.log("⏳ onstart event not fired, but speech appears active");
                  console.log("⏳ Status check interval will handle this case");
                  console.log("💡 This is a known browser bug where onstart doesn't fire");
                  console.log("💡 The speech might still be playing - check your volume!");
                }
              }
            }, 500);
          }
        }, 100);

        // 주기적으로 재생 상태 확인 및 onstart 대체 로직
        let consecutiveActiveChecks = 0;
        let hasDetectedStart = false;

        statusCheckInterval = setInterval(() => {
          const isActive = window.speechSynthesis.speaking || window.speechSynthesis.pending;
          const currentUtterance = currentUtteranceRef.current;

          if (isActive && currentUtterance === utterance) {
            consecutiveActiveChecks++;

            // 900ms 이상 active 상태이면 (3번 * 300ms) 재생 중으로 간주
            if (consecutiveActiveChecks >= 3 && !hasDetectedStart) {
              console.warn("⚠️ onstart event did not fire, but speech appears to be active");
              console.log("✅ Assuming speech started (workaround for browser bug)");
              console.log("🔊 If you cannot hear the speech, please check:");
              console.log("   1. System volume is not muted");
              console.log("   2. Browser tab is not muted (check tab icon)");
              console.log("   3. macOS System Settings > Sound > Output device");
              console.log(
                "   4. Try a shorter test: console.log('Test'); new SpeechSynthesisUtterance('테스트').onstart=()=>console.log('Playing'); window.speechSynthesis.speak(new SpeechSynthesisUtterance('테스트'));"
              );
              setIsSpeaking(true);
              hasDetectedStart = true;

              // onstart가 발생했다고 간주하고 처리
              if (startTimeout) {
                clearTimeout(startTimeout);
                startTimeout = null;
              }
            } else if (hasDetectedStart) {
              // 이미 재생 중으로 감지됨 - onend 이벤트가 발생하는지 추적
              if (consecutiveActiveChecks % 10 === 0) {
                // 3초마다 상태 로그 (너무 많이 출력하지 않기 위해)
                const duration = (consecutiveActiveChecks * 300) / 1000;
                console.log(`⏳ Still speaking... (${duration.toFixed(1)}s elapsed)`);

                // 30초 이상 재생 중이면 이상한 상황 (보통 그렇게 오래 걸리지 않음)
                if (duration > 30) {
                  console.warn("⚠️ Speech has been active for over 30 seconds - this is unusual");
                  console.warn("⚠️ The speech might not actually be playing");
                }
              }
            }
          } else if (currentUtterance === utterance) {
            // active가 아니거나 다른 utterance로 변경됨
            consecutiveActiveChecks = 0;

            if (hasDetectedStart && !isActive) {
              // 재생이 완료된 것으로 보임
              setIsSpeaking(false);
              if (currentUtterance === utterance) {
                currentUtteranceRef.current = null;
              }
              console.log("✅ Speech stopped (detected via status check)");
              hasDetectedStart = false;

              if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
              }
            }
          }
        }, 300); // 300ms마다 확인 (더 빠른 감지)

        // onstart가 1초 내에 발생하지 않으면 재시도
        startTimeout = setTimeout(() => {
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
          }
          if (currentUtteranceRef.current === utterance) {
            const isActuallySpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
            if (!isActuallySpeaking) {
              console.warn("⚠️ Speech did not start after 1 second, retrying...");
              window.speechSynthesis.cancel();
              setTimeout(() => {
                try {
                  const retryUtterance = new SpeechSynthesisUtterance(cleanedText);
                  retryUtterance.lang = utterance.lang;
                  retryUtterance.rate = utterance.rate;
                  retryUtterance.pitch = utterance.pitch;
                  retryUtterance.volume = utterance.volume;
                  retryUtterance.voice = utterance.voice;

                  retryUtterance.onstart = () => {
                    setIsSpeaking(true);
                    console.log("✅ Speech started on retry");
                  };
                  retryUtterance.onend = () => {
                    setIsSpeaking(false);
                    currentUtteranceRef.current = null;
                    console.log("✅ Speech ended on retry");
                  };
                  retryUtterance.onerror = (e) => {
                    setIsSpeaking(false);
                    currentUtteranceRef.current = null;
                    console.error("❌ Speech error on retry:", e.error);
                  };

                  currentUtteranceRef.current = retryUtterance;
                  // 재시도도 지연 후 호출
                  setTimeout(() => {
                    window.speechSynthesis.speak(retryUtterance);
                    console.log("🔄 Retry speak() called");
                  }, 100);
                } catch (retryError) {
                  console.error("❌ Retry failed:", retryError);
                }
              }, 200);
            }
          }
        }, 1000);
      } catch (error) {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        console.error("❌ Failed to speak:", error);
      }
    } catch (error) {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      console.error("❌ TTS error:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setRiskLevel(null);

    try {
      const response = await sendChatMessage({
        message: userMessage.content,
        conversation_history: messages,
        user_id: userId,
      });

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.message,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setRiskLevel(response.risk_level || null);

      // 위기 상황 감지 시 부모 컴포넌트에 알림
      if (response.risk_level && response.risk_level !== "low" && onEmergencyDetected) {
        onEmergencyDetected(response.risk_level);
      }

      // 자동 음성 출력
      handleSpeak(response.message);
    } catch (error) {
      console.error("채팅 오류:", error);

      let errorMessage: ChatMessage;

      // 네트워크 에러 확인
      if (error instanceof Error) {
        if (error.message.includes("Network Error") || error.message.includes("ERR_NETWORK")) {
          errorMessage = {
            role: "assistant",
            content:
              "⚠️ 서버에 연결할 수 없습니다.\n\n" +
              "해결 방법:\n" +
              "1. 새 터미널을 열고\n" +
              "2. cd /Users/dowonkim/Desktop/code/school/agent\n" +
              "3. uv run python main.py\n\n" +
              "FastAPI 서버가 실행 중이면 다시 시도해주세요.",
          };
        } else {
          errorMessage = {
            role: "assistant",
            content: `오류가 발생했습니다: ${error.message}\n다시 시도해주세요.`,
          };
        }
      } else {
        errorMessage = {
          role: "assistant",
          content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.",
        };
      }

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getRiskLevelBadge = () => {
    if (!riskLevel || riskLevel === "low") return null;

    const variants = {
      critical: "destructive" as const,
      high: "destructive" as const,
      medium: "default" as const,
    };

    const labels = {
      critical: "긴급",
      high: "주의",
      medium: "관찰",
    };

    return (
      <Badge variant={variants[riskLevel] || "default"} className="ml-2">
        {labels[riskLevel]}
      </Badge>
    );
  };

  return (
    <Card className="flex flex-col h-full max-h-[600px] w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>MindMate AI Mate</CardTitle>
            <CardDescription>언제든지 편하게 대화해주세요</CardDescription>
          </div>
          {riskLevel && riskLevel !== "low" && getRiskLevelBadge()}
        </div>
      </CardHeader>

      {riskLevel && riskLevel !== "low" && (
        <div className="px-6 pb-4">
          <Alert
            variant={riskLevel === "critical" ? "destructive" : "default"}
            className={cn(
              riskLevel === "critical" && "border-red-600 bg-red-50 shadow-lg",
              riskLevel === "high" && "border-orange-500 bg-orange-50",
              riskLevel === "medium" && "border-yellow-500 bg-yellow-50"
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {riskLevel === "critical" && "🚨 긴급 도움 필요"}
              {riskLevel === "high" && "⚠️ 주의 필요"}
              {riskLevel === "medium" && "⚠️ 관찰 필요"}
            </AlertTitle>
            <AlertDescription
              className={cn(
                riskLevel === "critical" && "text-red-900 font-semibold",
                riskLevel === "high" && "text-orange-900",
                riskLevel === "medium" && "text-yellow-900"
              )}
            >
              {riskLevel === "critical" && (
                <div className="space-y-2">
                  <p>당신의 안전이 우리의 최우선 관심사입니다.</p>
                  <p className="font-bold">즉시 전문가의 도움을 받으세요:</p>
                  <ul className="list-disc list-inside text-sm font-bold">
                    <li>
                      정신건강위기상담전화: <span className="text-red-700">1393</span> (24시간)
                    </li>
                    <li>
                      응급실: <span className="text-red-700">119</span>
                    </li>
                    <li>
                      자살예방상담: <span className="text-red-700">1588-9191</span>
                    </li>
                  </ul>
                </div>
              )}
              {riskLevel === "high" && (
                <p>
                  전문가의 도움이 필요할 수 있습니다. 정신건강위기상담전화(1393) 또는 응급실(119)에 연락하는 것을
                  권장합니다.
                </p>
              )}
              {riskLevel === "medium" && <p>상태를 자세히 모니터링하고 필요시 전문가의 도움을 받으세요.</p>}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <CardContent className="flex-1 flex flex-col overflow-hidden p-6 pt-0">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p className="mb-2">안녕하세요! MindMate AI Mate입니다.</p>
              <p>어떤 이야기든 편하게 나눠주세요.</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn("flex items-end gap-2", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === "assistant" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (isSpeaking ? stopSpeaking() : handleSpeak(message.content))}
                  className="h-8 w-8 p-0"
                  title={isSpeaking ? "음성 중지" : "음성 재생"}
                >
                  {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하거나 마이크를 클릭하세요..."
            rows={2}
            disabled={isLoading || isListening}
            tabIndex={0}
            aria-label="채팅 메시지 입력"
            className="resize-none"
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVoiceInput}
              disabled={isLoading || isSpeaking}
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              className="shrink-0"
              tabIndex={0}
              aria-label={isListening ? "음성 인식 중지" : "음성 입력"}
            >
              {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isListening}
              size="icon"
              className="shrink-0"
              tabIndex={0}
              aria-label="메시지 전송"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatBot;
