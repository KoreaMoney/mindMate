"use client";

import { useState, useEffect } from "react";
import { Smile, Frown, Meh, CheckCircle2 } from "lucide-react";
import { logMood, getMoodHistory, getDangerousWordsCount, resetDangerousWords, DangerousWordsInfo } from "../lib/api";
import emailjs from "@emailjs/browser";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";
import { format, parseISO, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { BookOpen, AlertTriangle, RotateCcw } from "lucide-react";

interface MoodTrackerProps {
  userId?: string;
  onboardingData?: {
    name?: string;
    guardianName?: string;
    guardianEmail?: string;
  } | null;
}

interface TodayMoodLog {
  date: string;
  score: number;
  sentiment: "positive" | "neutral" | "negative";
  notes?: string;
}

const MoodTracker = ({ userId, onboardingData }: MoodTrackerProps) => {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [diaryTitle, setDiaryTitle] = useState("");
  const [diary, setDiary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [todayLog, setTodayLog] = useState<TodayMoodLog | null>(null);
  const [dangerousWordsInfo, setDangerousWordsInfo] = useState<DangerousWordsInfo | null>(null);

  // 오늘 날짜 자동 입력
  const todayDate = format(new Date(), "yyyy년 MM월 dd일", { locale: ko });

  const moodOptions = [
    { value: 1, label: "매우 나쁨", icon: Frown, color: "text-red-500" },
    { value: 2, label: "나쁨", icon: Frown, color: "text-red-400" },
    { value: 3, label: "좀 나쁨", icon: Frown, color: "text-orange-500" },
    { value: 4, label: "보통보다 나쁨", icon: Meh, color: "text-orange-400" },
    { value: 5, label: "보통", icon: Meh, color: "text-yellow-500" },
    { value: 6, label: "보통보다 좋음", icon: Meh, color: "text-yellow-400" },
    { value: 7, label: "좋음", icon: Smile, color: "text-green-400" },
    { value: 8, label: "매우 좋음", icon: Smile, color: "text-green-500" },
    { value: 9, label: "완벽함", icon: Smile, color: "text-blue-400" },
    { value: 10, label: "최고", icon: Smile, color: "text-blue-500" },
  ];

  // 오늘 기록 불러오기
  useEffect(() => {
    const fetchTodayLog = async () => {
      if (!userId) return;

      try {
        const response = await getMoodHistory(userId, 1);
        if (response.history && response.history.length > 0) {
          const latest = response.history[response.history.length - 1];
          const logDate = parseISO(latest.date);
          if (isToday(logDate)) {
            setTodayLog(latest);
          }
        }
      } catch (error) {
        console.error("오늘 기록 불러오기 오류:", error);
      }
    };

    fetchTodayLog();
  }, [userId, submitted]);

  // 위험 단어 카운트 조회
  useEffect(() => {
    const fetchDangerousWords = async () => {
      if (!userId) return;

      try {
        const info = await getDangerousWordsCount(userId);
        setDangerousWordsInfo(info);
      } catch (error: unknown) {
        // 404 에러는 엔드포인트가 없을 때 발생 (서버 재시작 필요)
        if (
          error &&
          typeof error === "object" &&
          "response" in error &&
          error.response &&
          typeof error.response === "object" &&
          "status" in error.response &&
          error.response.status === 404
        ) {
          console.log("⚠️ 위험 단어 조회 API가 아직 활성화되지 않았습니다. 서버를 재시작해주세요.");
        } else {
          console.error("위험 단어 조회 오류:", error);
        }
        // 에러가 발생해도 계속 진행 (선택적 기능)
      }
    };

    fetchDangerousWords();
  }, [userId, submitted]);

  const handleResetDangerousWords = async () => {
    if (!userId) return;
    if (!confirm("위험 단어 카운트를 리셋하시겠습니까?")) return;

    try {
      await resetDangerousWords(userId);
      const info = await getDangerousWordsCount(userId);
      setDangerousWordsInfo(info);
      alert("위험 단어 카운트가 리셋되었습니다.");
    } catch (error) {
      console.error("위험 단어 리셋 오류:", error);
      alert("리셋 중 오류가 발생했습니다.");
    }
  };

  const handleSubmit = async () => {
    if (!selectedMood || !userId) return;

    setIsSubmitting(true);

    try {
      // 일기장에 날짜와 제목 자동 추가
      let diaryContent = "";
      if (diaryTitle.trim() || diary.trim()) {
        diaryContent = `${todayDate}\n`;
        if (diaryTitle.trim()) {
          diaryContent += `${diaryTitle.trim()}\n\n`;
        } else {
          diaryContent += `\n`;
        }
        diaryContent += diary.trim();
      }
      const diaryWithDate = diaryContent.trim() ? diaryContent : undefined;

      const response = await logMood({
        user_id: userId,
        mood_score: selectedMood,
        notes: diaryWithDate,
      });

      // 위험 단어가 감지되면 응급전화에서 설정한 이메일로 자동 전송
      const dangerousWordsDetected = response.dangerous_words_detected || {};
      const dangerousWordsValues = Object.values(dangerousWordsDetected).map((count) => Number(count));
      const maxRepeatCount = dangerousWordsValues.length > 0 ? Math.max(...dangerousWordsValues) : 0;
      const totalDangerousCount = response.total_dangerous_count ?? 0;

      if (Object.keys(dangerousWordsDetected).length > 0 && (totalDangerousCount >= 5 || maxRepeatCount >= 3)) {
        try {
          // 응급전화에서 설정한 이메일 가져오기
          let emailToSend: { name: string; email: string } | null = null;

          if (typeof window !== "undefined") {
            // localStorage에서 응급 이메일 목록 가져오기
            const savedEmailsStr = localStorage.getItem("emergency_emails");
            let savedEmails: Array<{ name: string; email: string; isPrimary?: boolean }> = [];

            if (savedEmailsStr) {
              try {
                savedEmails = JSON.parse(savedEmailsStr);
              } catch {
                savedEmails = [];
              }
            }

            // 사용 가능한 이메일 목록 (온보딩 이메일 + 등록된 이메일)
            const availableEmails: Array<{ name: string; email: string; isPrimary?: boolean }> = [];

            // 온보딩에서 등록한 이메일 추가
            if (onboardingData?.guardianEmail) {
              availableEmails.push({
                name: onboardingData.guardianName || "보호자",
                email: onboardingData.guardianEmail,
                isPrimary: true,
              });
            }

            // 등록된 이메일 추가 (중복 제거)
            savedEmails.forEach((email) => {
              if (!availableEmails.some((e) => e.email === email.email)) {
                availableEmails.push(email);
              }
            });

            // 우선 이메일 또는 첫 번째 이메일 선택
            if (availableEmails.length > 0) {
              emailToSend = availableEmails.find((e) => e.isPrimary) || availableEmails[0];
            }
          }

          if (emailToSend) {
            const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
            const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "";
            const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

            if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
              const userName = onboardingData?.name || "사용자";
              const reason =
                maxRepeatCount >= 3
                  ? `같은 위험 단어가 ${maxRepeatCount}회 이상 반복 감지되었습니다.`
                  : `총 ${totalDangerousCount}개의 위험 단어가 감지되었습니다.`;

              const dangerousWordsList = Object.entries(dangerousWordsDetected)
                .map(([word, count]) => `${word}: ${count}회`)
                .join("\n");

              // EmailJS 템플릿에서 {{to_email}} 변수를 사용하려면 Email Service 설정의 "To Email" 필드에 {{to_email}}을 입력해야 합니다
              await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                {
                  to_name: emailToSend.name,
                  to_email: emailToSend.email, // Email Service 설정의 "To Email" 필드에 {{to_email}} 입력 필요
                  user_name: userName,
                  risk_message: `[MindMate 위험 감지 알림]\n\n${userName}님의 일기장에서 위험 신호가 감지되었습니다.\n사유: ${reason}\n\n감지된 위험 단어:\n${dangerousWordsList}\n\n${userName}님의 상태를 확인해주시기 바랍니다.\n필요시 전문가 상담을 권장합니다.`,
                  risk_level: maxRepeatCount >= 3 ? "긴급" : "주의",
                  subject: `[MindMate 위험 신호] ${userName}님의 일기장에서 위험 신호 감지`,
                },
                EMAILJS_PUBLIC_KEY
              );
              console.log(`✅ 위험 신호 이메일 전송 완료: ${emailToSend.name}(${emailToSend.email})`);
            } else {
              console.warn("⚠️ EmailJS 설정이 완료되지 않았습니다.");
            }
          } else {
            console.warn("⚠️ 응급전화에서 설정한 이메일이 없습니다. 이메일을 등록해주세요.");
          }
        } catch (error) {
          console.error("이메일 전송 오류:", error);
        }
      }

      setSubmitted(true);

      // 저장된 기록을 즉시 표시하기 위해 다시 불러오기
      const historyResponse = await getMoodHistory(userId, 1);
      if (historyResponse.history && historyResponse.history.length > 0) {
        const latest = historyResponse.history[historyResponse.history.length - 1];
        const logDate = parseISO(latest.date);
        if (isToday(logDate)) {
          setTodayLog(latest);
        }
      }

      setTimeout(() => {
        setSelectedMood(null);
        setDiaryTitle("");
        setDiary("");
        setSubmitted(false);
      }, 2000);
    } catch (error) {
      console.error("감정 로그 저장 오류:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMoodLabel = (score: number) => {
    return moodOptions.find((m) => m.value === score)?.label || `${score}점`;
  };

  const getMoodIcon = (score: number) => {
    const option = moodOptions.find((m) => m.value === score);
    return option ? option.icon : Meh;
  };

  const getMoodColor = (score: number) => {
    const option = moodOptions.find((m) => m.value === score);
    return option ? option.color : "text-gray-500";
  };

  const getDiaryTitle = (notes: string | null | undefined): string => {
    if (!notes) return "";
    const lines = notes.split("\n");
    // 첫 줄이 날짜 형식인지 확인 (yyyy년 MM월 dd일 패턴)
    if (lines[0] && /^\d{4}년 \d{1,2}월 \d{1,2}일/.test(lines[0])) {
      // 두 번째 줄이 비어있지 않으면 제목으로 간주
      // 저장 형식: 날짜\n제목\n\n내용 또는 날짜\n\n내용
      if (lines.length > 1 && lines[1] && lines[1].trim() !== "") {
        // 세 번째 줄이 빈 줄이면 제목으로 확정
        if (lines.length > 2 && lines[2].trim() === "") {
          return lines[1].trim();
        }
      }
    }
    return "";
  };

  const getDiaryContent = (notes: string | null | undefined): string => {
    if (!notes) return "";
    // 일기 내용에서 날짜와 제목 부분 제거
    const lines = notes.split("\n");
    // 첫 줄이 날짜 형식인지 확인 (yyyy년 MM월 dd일 패턴)
    if (lines[0] && /^\d{4}년 \d{1,2}월 \d{1,2}일/.test(lines[0])) {
      // 첫 줄(날짜) 건너뛰기
      let startIndex = 1;

      // 두 번째 줄이 비어있지 않으면 제목으로 간주
      if (startIndex < lines.length && lines[startIndex].trim() !== "") {
        // 제목이 있는 경우: 날짜 -> 제목 -> 빈 줄 -> 내용
        // 제목 줄 건너뛰기
        startIndex++;
        // 빈 줄 건너뛰기
        if (startIndex < lines.length && lines[startIndex].trim() === "") {
          startIndex++;
        }
      } else {
        // 제목이 없는 경우: 날짜 -> 빈 줄 -> 내용
        // 빈 줄 건너뛰기
        while (startIndex < lines.length && lines[startIndex].trim() === "") {
          startIndex++;
        }
      }

      return lines.slice(startIndex).join("\n").trim();
    }
    return notes.trim();
  };

  return (
    <div className="w-full space-y-3">
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">오늘의 일기</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {submitted ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">기록이 저장되었습니다!</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <Label className="text-sm font-medium mb-2 block">오늘의 기분</Label>
                <div className="grid grid-cols-5 gap-2">
                  {moodOptions.map((mood) => {
                    const Icon = mood.icon;
                    const isSelected = selectedMood === mood.value;

                    return (
                      <button
                        key={mood.value}
                        onClick={() => setSelectedMood(mood.value)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all",
                          isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}
                        tabIndex={0}
                        aria-label={mood.label}
                      >
                        <Icon className={cn("w-5 h-5 mb-1", isSelected ? mood.color : "text-muted-foreground")} />
                        <span className="text-xs text-muted-foreground">{mood.value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <Label htmlFor="diaryTitle" className="text-sm font-medium mb-2 block">
                  일기 제목
                </Label>
                <Input
                  id="diaryTitle"
                  value={diaryTitle}
                  onChange={(e) => setDiaryTitle(e.target.value)}
                  placeholder="일기 제목을 입력하세요 (선택사항)"
                  className="text-sm"
                  tabIndex={0}
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="diary" className="text-sm font-medium mb-2 flex items-center gap-2">
                  <BookOpen className="w-3 h-3" />
                  일기
                </Label>
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground bg-blue-50 p-1.5 rounded border border-blue-200">
                    📅 {todayDate}
                  </div>
                  <Textarea
                    id="diary"
                    value={diary}
                    onChange={(e) => setDiary(e.target.value)}
                    placeholder="오늘 하루는 어땠나요? 자유롭게 일기를 작성해보세요..."
                    rows={5}
                    className="resize-none text-sm"
                    tabIndex={0}
                  />
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!selectedMood || isSubmitting || !userId}
                className="w-full"
                tabIndex={0}
              >
                {isSubmitting ? "저장 중..." : "기록 저장"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 위험 단어 카운터 표시 */}
      {dangerousWordsInfo && dangerousWordsInfo.total_count > 0 && (
        <Card className="w-full bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-yellow-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                위험 단어 감지 현황
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetDangerousWords}
                className="h-7 text-xs"
                tabIndex={0}
                aria-label="위험 단어 카운트 리셋"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                리셋
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-800">총 위험 단어:</span>
                <span className="text-lg font-bold text-yellow-600">{dangerousWordsInfo.total_count}개</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-800">최대 반복 횟수:</span>
                <span className="text-lg font-bold text-yellow-600">{dangerousWordsInfo.max_repeat_count}회</span>
              </div>
              {dangerousWordsInfo.should_alert && (
                <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700">
                  ⚠️ 알림 조건 충족! 보호자에게 알림이 전송되었습니다.
                </div>
              )}
              {dangerousWordsInfo.dangerous_words && Object.keys(dangerousWordsInfo.dangerous_words).length > 0 && (
                <div className="mt-2 pt-2 border-t border-yellow-300">
                  <p className="text-xs text-yellow-700 mb-1">감지된 단어:</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(dangerousWordsInfo.dangerous_words).map(([word, count]) => (
                      <span key={word} className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">
                        {word}: {count}회
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 오늘 기록한 내용 표시 */}
      {todayLog && !submitted && (
        <Card className="w-full bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-900">오늘의 일기</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">오늘의 기분</Label>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border-2 border-blue-300">
                  {(() => {
                    const Icon = getMoodIcon(todayLog.score);
                    return <Icon className={cn("w-5 h-5 mb-1", getMoodColor(todayLog.score))} />;
                  })()}
                  <span className="text-base font-bold text-blue-600">{todayLog.score}</span>
                  <span className="text-xs text-muted-foreground">{getMoodLabel(todayLog.score)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(todayLog.date), "yyyy년 MM월 dd일 HH:mm", { locale: ko })}
                </p>
              </div>
            </div>

            {getDiaryTitle(todayLog.notes) && (
              <div>
                <Label className="text-sm font-medium mb-2 block">일기 제목</Label>
                <div className="text-sm font-semibold text-gray-800 bg-white p-2 rounded border border-blue-200">
                  {getDiaryTitle(todayLog.notes)}
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                <BookOpen className="w-3 h-3" />
                일기
              </Label>
              {todayLog.notes ? (
                <div className="text-sm text-gray-700 bg-white p-3 rounded border border-blue-200 whitespace-pre-wrap">
                  {getDiaryContent(todayLog.notes)}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">일기 없음</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MoodTracker;
