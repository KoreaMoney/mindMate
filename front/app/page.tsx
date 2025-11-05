"use client";

import { useState, useEffect } from "react";
import ChatBot from "../components/ChatBot";
import MoodTracker from "../components/MoodTracker";
import MoodChart from "../components/MoodChart";
import EmergencyCallDialog from "../components/EmergencyCallDialog";
import OnboardingModal from "../components/OnboardingModal";
import { MessageSquare, Heart, Shield, BarChart3, Info, Phone, Star, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { type OnboardingData } from "../lib/api";

interface SavedContact {
  name: string;
  number: string;
  isPrimary?: boolean;
}

export default function Home() {
  // 서버와 클라이언트에서 동일한 초기값 사용 (하이드레이션 에러 방지)
  const [userId, setUserId] = useState<string>("guest");
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // 클라이언트에서만 userId 초기화 (하이드레이션 후)
  useEffect(() => {
    // localStorage는 클라이언트에서만 사용 가능하므로 useEffect 내에서 처리
    const loadUserId = () => {
      let id = localStorage.getItem("mindmate_user_id");
      if (!id) {
        id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem("mindmate_user_id", id);
      }
      setUserId(id);

      // 온보딩 정보 확인
      const saved = localStorage.getItem(`onboarding_${id}`);
      if (saved) {
        try {
          setOnboardingData(JSON.parse(saved));
        } catch {
          setIsOnboardingOpen(true);
        }
      } else {
        setIsOnboardingOpen(true);
      }
    };
    loadUserId();
  }, []);

  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);
  const [showPrimaryContacts, setShowPrimaryContacts] = useState(false);
  const [emergencyRiskLevel, setEmergencyRiskLevel] = useState<"medium" | "high" | "critical" | null>(null);

  // 클라이언트에서만 localStorage 데이터 로드 (하이드레이션 후)
  useEffect(() => {
    const loadContacts = () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("emergency_contacts");
        if (saved) {
          try {
            const contacts: SavedContact[] = JSON.parse(saved);
            setSavedContacts(contacts);
          } catch {
            setSavedContacts([]);
          }
        } else {
          setSavedContacts([]);
        }
      }
    };

    // 초기 로드
    loadContacts();

    // localStorage 변경 감지
    const handleStorageChange = () => {
      loadContacts();
    };

    window.addEventListener("storage", handleStorageChange);
    // 커스텀 이벤트로 같은 탭에서의 변경도 감지
    window.addEventListener("contactsUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("contactsUpdated", handleStorageChange);
    };
  }, []);

  const handleDirectCall = (number: string) => {
    const cleanNumber = number.replace(/-/g, "");
    window.location.assign(`tel:${cleanNumber}`);
  };

  const handleOnboardingComplete = (data: OnboardingData) => {
    setOnboardingData(data);
  };

  const primaryContacts = savedContacts.filter((c) => c.isPrimary);
  const hasMultiplePrimary = primaryContacts.length > 1;
  const mainContact = savedContacts.find((c) => c.isPrimary) || savedContacts[0];

  // 위기 상황 감지 시 자동으로 긴급 도움 다이얼로그 열기
  const handleEmergencyDetected = (riskLevel: "medium" | "high" | "critical") => {
    setEmergencyRiskLevel(riskLevel);
    setIsEmergencyOpen(true);

    // 우선 연락처가 있으면 자동으로 전화 유도 (critical일 때만)
    if (riskLevel === "critical" && mainContact) {
      // 약간의 지연 후 사용자에게 선택할 기회를 주되, 다이얼로그를 먼저 표시
      setTimeout(() => {
        // 사용자가 직접 버튼을 클릭할 수 있도록 다이얼로그만 표시
        // 자동 전화는 하지 않고, 다이얼로그를 통해 유도
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-green-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-linear-to-br from-blue-500 via-green-500 to-yellow-500 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  MindMate
                </h1>
                <p className="text-xs text-muted-foreground">AI 기반 개인 맞춤형 우울증 관리</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-xs text-muted-foreground">안전하게 보호됩니다</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>AI 상담</span>
            </TabsTrigger>
            <TabsTrigger value="mood" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              <span>기록</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>대시보드</span>
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>정보</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ChatBot
                  userId={userId}
                  onEmergencyDetected={handleEmergencyDetected}
                  onboardingData={onboardingData}
                />
              </div>
              <div className="space-y-4">
                <Card className="bg-linear-to-br from-blue-50 to-cyan-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Info className="w-5 h-5 text-blue-600" />
                      사용 팁
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• 마이크를 클릭해 음성으로 대화</li>
                      <li>• 솔직하게 감정을 표현</li>
                      <li>• 구체적인 상황 설명하기</li>
                      <li>• AI가 자동으로 답변을 읽어줍니다</li>
                    </ul>
                  </CardContent>
                </Card>
                <Card className="bg-linear-to-br from-red-50 to-orange-50 border-red-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-5 h-5 text-red-600" />
                      긴급 도움
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* 우선 연락처가 있을 때 */}
                    {mainContact ? (
                      <>
                        {/* 단일 우선 연락처 */}
                        {!hasMultiplePrimary && (
                          <Button
                            onClick={() => handleDirectCall(mainContact.number)}
                            className="w-full bg-linear-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-6 h-auto text-base shadow-lg"
                            tabIndex={0}
                            aria-label={`${mainContact.name}에게 전화 걸기`}
                          >
                            <Star className="h-5 w-5 mr-2 fill-white" />
                            우선 연락하기: {mainContact.name}
                            <Phone className="h-5 w-5 ml-2" />
                          </Button>
                        )}

                        {/* 여러 우선 연락처가 있을 때 */}
                        {hasMultiplePrimary && (
                          <div className="space-y-2">
                            <Button
                              onClick={() => setShowPrimaryContacts(!showPrimaryContacts)}
                              className="w-full bg-linear-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-4 h-auto text-base shadow-lg"
                              tabIndex={0}
                            >
                              <Star className="h-5 w-5 mr-2 fill-white" />
                              우선 연락처 선택 ({primaryContacts.length}개)
                              {showPrimaryContacts ? (
                                <ChevronUp className="h-5 w-5 ml-2" />
                              ) : (
                                <ChevronDown className="h-5 w-5 ml-2" />
                              )}
                            </Button>

                            {showPrimaryContacts && (
                              <div className="space-y-2 p-3 bg-red-50 rounded-lg border-2 border-red-300">
                                {primaryContacts.map((contact, index) => (
                                  <Button
                                    key={index}
                                    onClick={() => handleDirectCall(contact.number)}
                                    className="w-full bg-white hover:bg-red-100 text-red-700 border-2 border-red-400 font-bold py-4 h-auto text-base"
                                    tabIndex={0}
                                    aria-label={`${contact.name}에게 전화 걸기`}
                                  >
                                    <Star className="h-4 w-4 mr-2 text-yellow-600 fill-yellow-600" />
                                    {contact.name} ({contact.number})
                                    <Phone className="h-4 w-4 ml-2" />
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      /* 우선 연락처가 없을 때 */
                      <Button
                        onClick={() => setIsEmergencyOpen(true)}
                        variant="outline"
                        className="w-full border-2 border-dashed font-bold py-6 h-auto text-base"
                        tabIndex={0}
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        우선 연락처 등록하기
                      </Button>
                    )}

                    <Button
                      onClick={() => setIsEmergencyOpen(true)}
                      variant="outline"
                      className="w-full border-2 font-bold py-4 h-auto text-base"
                      tabIndex={0}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      응급 전화하기
                    </Button>
                    <div className="text-sm font-bold text-red-600 bg-red-100 p-4 rounded-lg border-2 border-red-400">
                      ⚠️ 위 버튼을 눌러 전문가와 대화하세요
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mood" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MoodTracker userId={userId} />
              <Card className="bg-linear-to-br from-green-50 to-emerald-50 border-green-200">
                <CardHeader>
                  <CardTitle>감정 추적의 중요성</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="text-green-600">✓</span>
                      <span>정기적인 감정 기록은 우울증 증상을 조기에 발견합니다</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-600">✓</span>
                      <span>패턴을 파악하여 어떤 상황에서 기분이 나빠지는지 이해</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-600">✓</span>
                      <span>의료진과 상담할 때 객관적인 데이터로 설명 가능</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <Card className="border-blue-200 bg-linear-to-br from-blue-50/50 to-green-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  감정 관리 대시보드
                </CardTitle>
                <CardDescription>당신의 감정 변화를 시각화하여 개선 과정을 함께 봅시다</CardDescription>
              </CardHeader>
              <CardContent>
                <MoodChart userId={userId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>안전 및 개인정보 보호</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    데이터 보안
                  </h3>
                  <p className="mb-3 text-muted-foreground">
                    MindMate는 사용자의 개인정보와 건강 데이터를 최우선으로 보호합니다.
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <Badge variant="outline" className="shrink-0">
                        🔐
                      </Badge>
                      <span>모든 데이터는 암호화되어 전송 및 저장</span>
                    </li>
                    <li className="flex gap-2">
                      <Badge variant="outline" className="shrink-0">
                        ✓
                      </Badge>
                      <span>HIPAA 및 개인정보보호법 준수</span>
                    </li>
                    <li className="flex gap-2">
                      <Badge variant="outline" className="shrink-0">
                        🎯
                      </Badge>
                      <span>최소한의 필요한 정보만 수집</span>
                    </li>
                  </ul>
                </section>

                <Alert variant="destructive">
                  <Shield className="h-4 w-4" />
                  <AlertTitle>위기 상황 대응</AlertTitle>
                  <AlertDescription>
                    자해나 자살 생각이 드실 경우 즉시 전문가의 도움을 받으세요.
                    <div className="mt-3 space-y-2">
                      <div>
                        <strong>정신건강위기상담전화:</strong>{" "}
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a href="tel:1393">1393 (24시간 무료)</a>
                        </Button>
                      </div>
                      <div>
                        <strong>응급실:</strong>{" "}
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a href="tel:119">119</a>
                        </Button>
                      </div>
                      <div>
                        <strong>자살 예방 상담전화:</strong>{" "}
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a href="tel:15889191">1588-9191</a>
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                <section>
                  <h3 className="font-semibold text-lg mb-3">면책 조항</h3>
                  <p className="text-sm text-muted-foreground">
                    MindMate는 AI 기반 상담 도구이며, 전문 의료 서비스를 대체하지 않습니다. 심각한 증상이 있으시면
                    반드시 정신건강의학과 전문의와 상담하시기 바랍니다.
                  </p>
                </section>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-12 border-t border-blue-200 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mt-2 text-blue-600 font-medium text-xl">
            정신건강은 중요합니다. 필요한 도움을 주저하지 마세요.
          </p>
          <p>© 2025 MindMate. 모든 권리 보유.</p>
        </div>
      </footer>

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onOpenChange={setIsOnboardingOpen}
        userId={userId}
        onComplete={handleOnboardingComplete}
      />

      <EmergencyCallDialog
        isOpen={isEmergencyOpen}
        onOpenChange={(open) => {
          setIsEmergencyOpen(open);
          if (!open) {
            setEmergencyRiskLevel(null);
          }
        }}
        riskLevel={emergencyRiskLevel}
      />
    </div>
  );
}
