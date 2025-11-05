"use client";

import { useState } from "react";
import { Smile, Frown, Meh, CheckCircle2 } from "lucide-react";
import { logMood } from "../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { cn } from "@/lib/utils";

interface MoodTrackerProps {
  userId?: string;
}

const MoodTracker = ({ userId }: MoodTrackerProps) => {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = async () => {
    if (!selectedMood || !userId) return;

    setIsSubmitting(true);

    try {
      await logMood({
        user_id: userId,
        mood_score: selectedMood,
        notes: notes.trim() || undefined,
      });

      setSubmitted(true);
      setTimeout(() => {
        setSelectedMood(null);
        setNotes("");
        setSubmitted(false);
      }, 2000);
    } catch (error) {
      console.error("감정 로그 저장 오류:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>오늘의 기분 기록</CardTitle>
        <CardDescription>지금 기분이 어떤가요?</CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-green-600 dark:text-green-400 font-medium">
              기록이 저장되었습니다!
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-3 mb-6">
              {moodOptions.map((mood) => {
                const Icon = mood.icon;
                const isSelected = selectedMood === mood.value;

                return (
                  <button
                    key={mood.value}
                    onClick={() => setSelectedMood(mood.value)}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                    tabIndex={0}
                    aria-label={mood.label}
                  >
                    <Icon
                      className={cn(
                        "w-8 h-8 mb-2",
                        isSelected ? mood.color : "text-muted-foreground"
                      )}
                    />
                    <span className="text-xs text-muted-foreground">
                      {mood.value}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mb-6">
              <Label htmlFor="mood-notes">메모 (선택사항)</Label>
              <Textarea
                id="mood-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="오늘의 기분에 대해 간단히 기록해보세요..."
                rows={3}
                className="mt-2"
                tabIndex={0}
              />
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
  );
};

export default MoodTracker;
