"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Info } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { getMoodHistory, getMoodAnalytics } from "../lib/api";
import { Smile, Frown, Meh } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoodData {
  date: string;
  score: number;
  sentiment: "positive" | "neutral" | "negative";
}

interface MoodChartProps {
  userId?: string;
}

// 샘플 데이터
const generateSampleData = (): MoodData[] => {
  return Array.from({ length: 30 }, (_, i) => ({
    date: format(subDays(new Date(), 29 - i), "MMM dd"),
    score: Math.floor(Math.random() * 5) + 5,
    sentiment: (["positive", "neutral", "negative"] as const)[Math.floor(Math.random() * 3)],
  }));
};

const sentimentColors = {
  positive: "#10b981", // 초록색
  neutral: "#f59e0b", // 노란색
  negative: "#ef4444", // 빨간색
};

const MoodChart = ({ userId }: MoodChartProps) => {
  const [chartData, setChartData] = useState<MoodData[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setChartData(generateSampleData());
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const [historyResponse, analyticsResponse] = await Promise.all([
          getMoodHistory(userId, 30),
          getMoodAnalytics(userId),
        ]);

        // 히스토리 데이터 변환
        if (historyResponse.history && historyResponse.history.length > 0) {
          const formattedData = historyResponse.history.map((item: any) => {
            try {
              const date = parseISO(item.date);
              return {
                date: format(date, "MMM dd"),
                score: item.score,
                sentiment: item.sentiment || "neutral",
              };
            } catch {
              return {
                date: format(new Date(), "MMM dd"),
                score: item.score || 5,
                sentiment: item.sentiment || "neutral",
              };
            }
          });
          setChartData(formattedData);

          // 최근 기록 리스트 (최신 10개)
          const sortedLogs = [...historyResponse.history].sort((a: any, b: any) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });
          setRecentLogs(sortedLogs.slice(0, 10));
        } else {
          setChartData(generateSampleData());
          setRecentLogs([]);
        }

        setAnalytics(analyticsResponse);
      } catch (error: unknown) {
        console.error("데이터 로드 오류:", error);

        // 네트워크 에러인 경우 사용자에게 알림
        if (error && typeof error === "object" && "code" in error && error.code === "ERR_NETWORK") {
          // API 인터셉터에서 추가한 userMessage 사용
          const userMessage = (error as { userMessage?: string }).userMessage;
          if (userMessage) {
            console.warn("[MoodChart] 서버 연결 실패:", userMessage);
          }
        }

        // 에러가 발생해도 샘플 데이터로 표시 (오프라인 모드)
        setChartData(generateSampleData());
        setRecentLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const getMoodIcon = (score: number) => {
    if (score >= 7) return Smile;
    if (score <= 4) return Frown;
    return Meh;
  };

  const getMoodColor = (score: number) => {
    if (score >= 7) return "text-green-500";
    if (score <= 4) return "text-red-500";
    return "text-yellow-500";
  };

  const displayData = chartData.length > 0 ? chartData : generateSampleData();
  const lastSevenDays = displayData.slice(-7);

  // analytics에서 추세 가져오기
  const hasInsufficientData = analytics?.trend === "insufficient_data";
  const trendingUp =
    !hasInsufficientData &&
    (analytics?.trend === "improving" ||
      (analytics?.trend_percentage && analytics.trend_percentage > 0) ||
      (lastSevenDays.at(-1)?.score ?? 0 > (lastSevenDays.at(0)?.score ?? 0)));

  // 감정 분포
  const sentimentDistribution = analytics?.sentiment_distribution
    ? [
        {
          name: "긍정적",
          value: analytics.sentiment_distribution.positive || 0,
          color: sentimentColors.positive,
        },
        {
          name: "중립",
          value: analytics.sentiment_distribution.neutral || 0,
          color: sentimentColors.neutral,
        },
        {
          name: "부정적",
          value: analytics.sentiment_distribution.negative || 0,
          color: sentimentColors.negative,
        },
      ]
    : [
        {
          name: "긍정적",
          value: displayData.filter((d) => d.sentiment === "positive").length,
          color: sentimentColors.positive,
        },
        {
          name: "중립",
          value: displayData.filter((d) => d.sentiment === "neutral").length,
          color: sentimentColors.neutral,
        },
        {
          name: "부정적",
          value: displayData.filter((d) => d.sentiment === "negative").length,
          color: sentimentColors.negative,
        },
      ];

  // 평균 점수
  const averageScore =
    analytics?.average_score ||
    Math.round((displayData.reduce((sum, d) => sum + d.score, 0) / displayData.length) * 10) / 10;

  // 최근 개선도
  const recentTrend =
    analytics?.trend_percentage ||
    (((lastSevenDays.at(-1)?.score ?? 0) - (lastSevenDays.at(0)?.score ?? 0)) / (lastSevenDays.at(0)?.score ?? 1)) *
      100;

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-blue-900">평균 기분</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInfoModal(true)}
                className="h-6 w-6 p-0"
                tabIndex={0}
                aria-label="통계 기준 설명 보기"
              >
                <Info className="h-4 w-4 text-blue-600" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{isLoading ? "..." : averageScore}</div>
            <p className="text-xs text-blue-700 mt-1">
              {analytics?.total_records ? `${analytics.total_records}개 기록의 평균` : "지난 30일 평균"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-900">최근 추세</CardTitle>
          </CardHeader>
          <CardContent>
            {hasInsufficientData ? (
              <>
                <div className="text-3xl font-bold text-gray-400">-</div>
                <p className="text-xs text-gray-500 mt-1">기록이 부족합니다 (최소 14개 필요)</p>
              </>
            ) : (
              <>
                <div className={`text-3xl font-bold ${trendingUp ? "text-green-600" : "text-orange-600"}`}>
                  {isLoading ? "..." : `${trendingUp ? "↑" : "↓"} ${Math.abs(recentTrend).toFixed(1)}%`}
                </div>
                <p className="text-xs text-green-700 mt-1">
                  {analytics?.trend === "improving"
                    ? "개선 중"
                    : analytics?.trend === "declining"
                    ? "주의 필요"
                    : "안정적"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-yellow-900">총 기록 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {isLoading ? "..." : analytics?.total_records || displayData.length}
            </div>
            <p className="text-xs text-yellow-700 mt-1">총 기록된 일수</p>
          </CardContent>
        </Card>
      </div>

      {/* 감정 추이 라인 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>기분 변화 추이</CardTitle>
          <CardDescription>지난 30일 동안의 기분 변화</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={displayData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "12px" }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} domain={[0, 10]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
                cursor={{ stroke: "#3b82f6", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorScore)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 감정 분포 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>감정 분포</CardTitle>
            <CardDescription>긍정적, 중립, 부정적 비율</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sentimentDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name} ${value}개 (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sentimentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>주간 기분 비교</CardTitle>
            <CardDescription>최근 7일 기분 점수</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={lastSevenDays}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "12px" }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} domain={[0, 10]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="score" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 최근 기록 리스트 */}
      <Card>
        <CardHeader>
          <CardTitle>최근 기록</CardTitle>
          <CardDescription>지금까지 기록한 기분 변화</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">기록을 불러오는 중...</div>
          ) : recentLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              아직 기록이 없습니다. 오늘의 기분을 기록해보세요!
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log, index) => {
                const logDate = parseISO(log.date);
                const Icon = getMoodIcon(log.score);

                // 일기장 내용에서 날짜 부분 제거 (yyyy년 MM월 dd일 형식의 첫 줄과 빈 줄 제거)
                const getDiaryContent = (notes: string | null | undefined): string => {
                  if (!notes) return "";
                  // 날짜 형식 패턴: "yyyy년 MM월 dd일"로 시작하는 줄과 그 다음 빈 줄들 제거
                  const lines = notes.split("\n");
                  // 첫 줄이 날짜 형식인지 확인 (yyyy년 MM월 dd일 패턴)
                  if (lines[0] && /^\d{4}년 \d{1,2}월 \d{1,2}일/.test(lines[0])) {
                    // 첫 줄(날짜)과 빈 줄들 제거
                    let startIndex = 1;
                    while (startIndex < lines.length && lines[startIndex].trim() === "") {
                      startIndex++;
                    }
                    return lines.slice(startIndex).join("\n").trim();
                  }
                  return notes.trim();
                };

                const diaryContent = getDiaryContent(log.notes);

                return (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border-2 border-gray-300 shrink-0">
                      <Icon className={cn("w-5 h-5 mb-1", getMoodColor(log.score))} />
                      <span className="text-lg font-bold text-gray-700">{log.score}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {format(logDate, "yyyy년 MM월 dd일 HH:mm", { locale: ko })}
                      </p>
                      {diaryContent ? (
                        <p className="text-sm text-gray-600 line-clamp-2">{diaryContent}</p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">메모 없음</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          log.sentiment === "positive"
                            ? "bg-green-100 text-green-700"
                            : log.sentiment === "negative"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        )}
                      >
                        {log.sentiment === "positive" ? "긍정적" : log.sentiment === "negative" ? "부정적" : "중립"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 통계 기준 설명 모달 */}
      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowInfoModal(false)}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="통계 기준 설명"
        >
          <Card className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                통계 계산 기준 설명
              </CardTitle>
              <CardDescription>대시보드의 각 통계 지표가 어떻게 계산되는지 설명합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <section>
                <h3 className="font-semibold text-lg mb-2 text-blue-600">평균 기분</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>모든 기록된 기분 점수(1-10점)의 산술 평균을 계산합니다.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>기분 점수: 1(매우 나쁨) ~ 10(최고)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>공식: (모든 기분 점수의 합) ÷ (기록된 총 일수)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>예: 7점, 8점, 6점을 기록했다면 평균은 7.0점입니다.</span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2 text-green-600">최근 추세</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-green-600">•</span>
                    <span>최근 7일의 평균 기분과 그 이전 7일의 평균 기분을 비교합니다.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">•</span>
                    <span>공식: ((최근 7일 평균 - 이전 7일 평균) ÷ 이전 7일 평균) × 100%</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">•</span>
                    <span>5% 이상 증가: 개선 중 (↑)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">•</span>
                    <span>5% 이상 감소: 주의 필요 (↓)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">•</span>
                    <span>5% 이내 변화: 안정적 (=)</span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2 text-yellow-600">감정 분포</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-yellow-600">•</span>
                    <span>긍정적: 기분 점수 7점 이상, 또는 메모의 감정 분석 결과가 긍정적</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-yellow-600">•</span>
                    <span>부정적: 기분 점수 4점 이하, 또는 메모의 감정 분석 결과가 부정적</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-yellow-600">•</span>
                    <span>중립: 기분 점수 5-6점, 또는 메모의 감정 분석 결과가 중립</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-yellow-600">•</span>
                    <span>메모가 있는 경우 AI 감정 분석을 우선 적용합니다.</span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2 text-purple-600">총 기록 수</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-purple-600">•</span>
                    <span>지금까지 기록된 모든 기분 데이터의 총 개수입니다.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-600">•</span>
                    <span>하루에 여러 번 기록해도 1개로 카운트됩니다.</span>
                  </li>
                </ul>
              </section>

              <div className="pt-4 border-t">
                <Button onClick={() => setShowInfoModal(false)} className="w-full" tabIndex={0}>
                  닫기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MoodChart;
