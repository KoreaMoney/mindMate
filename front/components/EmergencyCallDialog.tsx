"use client";

import { useState, useEffect } from "react";
import { Phone, AlertTriangle, X, Plus, Star, Trash2, Mail, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { type OnboardingData } from "../lib/api";
import emailjs from "@emailjs/browser";

interface EmergencyNumber {
  name: string;
  number: string;
  description: string;
  color: "red" | "green" | "blue";
}

const emergencyNumbers: EmergencyNumber[] = [
  {
    name: "응급실",
    number: "119",
    description: "즉시 의료 지원이 필요한 경우",
    color: "red",
  },
  {
    name: "정신 건강 위기 상담전화",
    number: "1393",
    description: "24시간 상담 (무료)",
    color: "blue",
  },
  {
    name: "자살 예방 상담전화",
    number: "1588-9191",
    description: "전문 상담사와 대화",
    color: "green",
  },
];

const colorClasses = {
  red: "bg-gradient-to-br from-red-100 to-rose-100 border-red-400 hover:border-red-500",
  green: "bg-gradient-to-br from-green-100 to-emerald-100 border-green-400 hover:border-green-500",
  blue: "bg-[#e6f2ff] border-[#0066ff] hover:border-[#0052cc]",
};

const textColors = {
  red: "text-red-950",
  green: "text-green-950",
  blue: "text-[#001a4d]",
};

const buttonColors = {
  red: "bg-red-600 hover:bg-red-700 text-white",
  green: "bg-green-600 hover:bg-green-700 text-white",
  blue: "hover:shadow-lg text-white font-bold",
};

// 파란색 스타일 상수
const blueStyle = "bg-[#0066ff] hover:bg-[#0052cc] text-white";

interface EmergencyCallDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  riskLevel?: "medium" | "high" | "critical" | null;
  userId?: string;
  onboardingData?: OnboardingData | null;
}

interface SavedContact {
  name: string;
  number: string;
  isPrimary?: boolean;
}

interface SavedEmail {
  name: string;
  email: string;
  isPrimary?: boolean;
}

const EmergencyCallDialog = ({ isOpen, onOpenChange, riskLevel, userId, onboardingData }: EmergencyCallDialogProps) => {
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [savedEmails, setSavedEmails] = useState<SavedEmail[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("emergency_emails");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [newEmailName, setNewEmailName] = useState("");
  const [newEmailAddress, setNewEmailAddress] = useState("");
  const [selectedEmailForSend, setSelectedEmailForSend] = useState<SavedEmail | null>(null);
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("emergency_contacts");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactNumber, setNewContactNumber] = useState("");

  // localStorage에서 연락처를 읽어오는 함수
  const loadContacts = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("emergency_contacts");
      if (saved) {
        try {
          const contacts = JSON.parse(saved);
          setSavedContacts(contacts);
        } catch {
          setSavedContacts([]);
        }
      } else {
        setSavedContacts([]);
      }
    }
  };

  // localStorage 변경 감지를 위한 이벤트 리스너 (외부 시스템 구독)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleContactsUpdate = () => {
        loadContacts();
      };

      window.addEventListener("contactsUpdated", handleContactsUpdate);
      return () => {
        window.removeEventListener("contactsUpdated", handleContactsUpdate);
      };
    }
  }, []);

  // 다이얼로그가 열릴 때 최신 데이터 로드 (이벤트 핸들러로 처리)
  useEffect(() => {
    if (isOpen) {
      // 다음 이벤트 루프에서 실행하여 동기적 setState 호출 방지
      const timer = setTimeout(() => {
        loadContacts();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // localStorage에 연락처 저장
  const saveContacts = (contacts: SavedContact[]) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("emergency_contacts", JSON.stringify(contacts));
      setSavedContacts(contacts);
      // 같은 탭에서도 변경사항을 감지할 수 있도록 커스텀 이벤트 발생
      window.dispatchEvent(new Event("contactsUpdated"));
    }
  };

  const handleCall = (number: string) => {
    // 하이픈 제거
    const cleanNumber = number.replace(/-/g, "");
    window.location.assign(`tel:${cleanNumber}`);
    setSelectedNumber(null);
    onOpenChange(false);
  };

  const primaryContacts = savedContacts.filter((c) => c.isPrimary);

  // localStorage에서 이메일 목록 읽어오기
  const loadEmails = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("emergency_emails");
      if (saved) {
        try {
          const emails = JSON.parse(saved);
          setSavedEmails(emails);
        } catch {
          setSavedEmails([]);
        }
      } else {
        setSavedEmails([]);
      }
    }
  };

  // localStorage에 이메일 저장
  const saveEmails = (emails: SavedEmail[]) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("emergency_emails", JSON.stringify(emails));
      setSavedEmails(emails);
      window.dispatchEvent(new Event("emailsUpdated"));
    }
  };

  // 다이얼로그가 열릴 때 최신 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadEmails();
      // 알림 상태 초기화
      setShowSuccessAlert(false);
      // 온보딩 이메일도 포함하여 기본 선택
      const currentEmails = savedEmails;
      if (onboardingData?.guardianEmail && currentEmails.length === 0) {
        const defaultEmail: SavedEmail = {
          name: onboardingData.guardianName || "보호자",
          email: onboardingData.guardianEmail,
          isPrimary: true,
        };
        setSavedEmails([defaultEmail]);
        setSelectedEmailForSend(defaultEmail);
      } else if (currentEmails.length > 0 && !selectedEmailForSend) {
        const primaryEmail = currentEmails.find((e) => e.isPrimary) || currentEmails[0];
        setSelectedEmailForSend(primaryEmail);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 사용 가능한 이메일 목록 (온보딩 이메일 + 등록된 이메일)
  const availableEmails = (() => {
    const emails: SavedEmail[] = [];

    // 온보딩에서 등록한 이메일 추가
    if (onboardingData?.guardianEmail) {
      emails.push({
        name: onboardingData.guardianName || "보호자",
        email: onboardingData.guardianEmail,
        isPrimary: true,
      });
    }

    // 등록된 이메일 추가 (중복 제거)
    savedEmails.forEach((email) => {
      if (!emails.some((e) => e.email === email.email)) {
        emails.push(email);
      }
    });

    return emails;
  })();

  const handleAddEmail = () => {
    if (!newEmailName.trim() || !newEmailAddress.trim()) {
      alert("이름과 이메일을 모두 입력해주세요.");
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmailAddress.trim())) {
      alert("올바른 이메일 주소를 입력해주세요.");
      return;
    }

    const newEmail: SavedEmail = {
      name: newEmailName.trim(),
      email: newEmailAddress.trim(),
      isPrimary: savedEmails.length === 0, // 첫 번째 이메일은 기본으로 설정
    };

    const updatedEmails = [...savedEmails, newEmail];
    saveEmails(updatedEmails);

    setNewEmailName("");
    setNewEmailAddress("");
    setIsAddingEmail(false);

    // 새로 추가한 이메일 선택
    setSelectedEmailForSend(newEmail);
  };

  const handleSetPrimaryEmail = (index: number) => {
    const updatedEmails = savedEmails.map((email, i) => ({
      ...email,
      isPrimary: i === index,
    }));
    saveEmails(updatedEmails);
    setSelectedEmailForSend(updatedEmails[index]);
  };

  const handleDeleteEmail = (index: number) => {
    if (confirm("이 이메일을 삭제하시겠습니까?")) {
      const updatedEmails = savedEmails.filter((_, i) => i !== index);
      if (updatedEmails.length > 0 && !updatedEmails.some((e) => e.isPrimary)) {
        updatedEmails[0].isPrimary = true;
      }
      saveEmails(updatedEmails);
      if (selectedEmailForSend === savedEmails[index]) {
        setSelectedEmailForSend(updatedEmails[0] || null);
      }
    }
  };

  const handleSendEmailToGuardian = async () => {
    const emailToSend =
      selectedEmailForSend ||
      (onboardingData?.guardianEmail
        ? {
            name: onboardingData.guardianName || "보호자",
            email: onboardingData.guardianEmail,
          }
        : null);

    if (!emailToSend) {
      alert("이메일을 선택하거나 등록해주세요.");
      return;
    }

    setIsSendingEmail(true);

    try {
      const riskMessage =
        riskLevel === "critical"
          ? "🚨 긴급 상황이 감지되었습니다!"
          : riskLevel === "high"
          ? "⚠️ 주의가 필요한 상황이 감지되었습니다"
          : "위험 신호가 감지되었습니다";

      const userName = onboardingData?.name || "사용자";
      const status = riskLevel === "critical" ? "긴급" : riskLevel === "high" ? "주의" : "일반";

      // EmailJS 환경 변수
      const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
      const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "";
      const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

      if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
        alert("⚠️ EmailJS 설정이 완료되지 않았습니다. 환경 변수를 확인해주세요.");
        setIsSendingEmail(false);
        return;
      }

      // EmailJS로 이메일 전송
      // EmailJS 템플릿에서 {{to_email}} 변수를 사용하려면 Email Service 설정의 "To Email" 필드에 {{to_email}}을 입력해야 합니다
      const templateParams = {
        to_name: emailToSend.name,
        to_email: emailToSend.email, // Email Service 설정의 "To Email" 필드에 {{to_email}} 입력 필요
        user_name: userName,
        risk_message: riskMessage,
        risk_level: status,
        subject: `[MindMate 응급 알림] ${userName}님에게 위험 신호 감지`,
        message: `${userName}님에게 ${riskMessage}\n\n즉시 확인이 필요합니다.\n\n상태: ${status}\n\n${userName}님의 상태를 확인해주시기 바랍니다.`,
      };

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);

      // 전송 성공 알림 표시
      setShowSuccessAlert(true);
    } catch (error: unknown) {
      console.error("이메일 전송 오류:", error);
      const errorMessage =
        error && typeof error === "object" && "text" in error && typeof error.text === "string"
          ? error.text
          : error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "알 수 없는 오류";
      alert(`⚠️ 이메일 전송에 실패했습니다: ${errorMessage}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactNumber.trim()) {
      alert("이름과 전화번호를 모두 입력해주세요.");
      return;
    }

    // 전화번호 형식 검증 (숫자와 하이픈만 허용)
    const cleanNumber = newContactNumber.replace(/[^\d-]/g, "");
    if (cleanNumber.length < 3) {
      alert("올바른 전화번호를 입력해주세요.");
      return;
    }

    const newContact: SavedContact = {
      name: newContactName.trim(),
      number: cleanNumber,
      isPrimary: savedContacts.length === 0, // 첫 번째 연락처는 기본으로 설정
    };

    const updatedContacts = [...savedContacts, newContact];
    saveContacts(updatedContacts);

    setNewContactName("");
    setNewContactNumber("");
    setIsAddingContact(false);
  };

  const handleSetPrimary = (index: number) => {
    const updatedContacts = savedContacts.map((contact, i) => ({
      ...contact,
      isPrimary: i === index,
    }));
    saveContacts(updatedContacts);
  };

  const handleDeleteContact = (index: number) => {
    if (confirm("이 연락처를 삭제하시겠습니까?")) {
      const updatedContacts = savedContacts.filter((_, i) => i !== index);
      // 삭제 후 첫 번째 연락처를 기본으로 설정
      if (updatedContacts.length > 0 && !updatedContacts.some((c) => c.isPrimary)) {
        updatedContacts[0].isPrimary = true;
      }
      saveContacts(updatedContacts);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] border-2 border-red-300 shadow-2xl flex flex-col mx-auto my-4">
        <DialogHeader className="shrink-0 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-2xl sm:text-3xl font-black text-red-950">지금 바로 도움받으세요</DialogTitle>
          </div>
          <DialogDescription className="text-sm sm:text-base text-gray-700">
            {riskLevel === "critical" ? (
              <span className="font-bold text-red-700">
                🚨 긴급 상황이 감지되었습니다. 즉시 전문가의 도움을 받으세요!
              </span>
            ) : riskLevel === "high" ? (
              <span className="font-semibold text-orange-700">
                ⚠️ 주의가 필요한 상황입니다. 전문가와 상담하는 것을 권장합니다.
              </span>
            ) : (
              "당신은 혼자가 아닙니다. 전문가의 도움을 받을 수 있습니다."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-1">
          {/* 전송 성공 알림 */}
          {showSuccessAlert && (
            <Alert className="mb-4 border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900 font-bold">
                ⚠️ 알림 조건 충족! 보호자에게 알림이 전송되었습니다.
              </AlertTitle>
              <AlertDescription className="text-green-800">
                보호자에게 위험 상황이 성공적으로 전달되었습니다.
              </AlertDescription>
            </Alert>
          )}

          {/* 응급 이메일 등록 및 전송 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                응급 이메일 알림
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingEmail(true)}
                tabIndex={0}
                aria-label="이메일 추가"
                className="text-xs sm:text-sm"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                추가
              </Button>
            </div>

            {/* 이메일 추가 폼 */}
            {isAddingEmail && (
              <div className="mb-3 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <div className="space-y-2">
                  <Input
                    placeholder="이름"
                    value={newEmailName}
                    onChange={(e) => setNewEmailName(e.target.value)}
                    className="text-sm"
                    tabIndex={0}
                  />
                  <Input
                    type="email"
                    placeholder="이메일 주소"
                    value={newEmailAddress}
                    onChange={(e) => setNewEmailAddress(e.target.value)}
                    className="text-sm"
                    tabIndex={0}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleAddEmail} size="sm" className="flex-1" tabIndex={0}>
                      추가
                    </Button>
                    <Button
                      onClick={() => {
                        setIsAddingEmail(false);
                        setNewEmailName("");
                        setNewEmailAddress("");
                      }}
                      variant="outline"
                      size="sm"
                      tabIndex={0}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 등록된 이메일 목록 */}
            {availableEmails.length > 0 && (
              <div className="mb-3 space-y-2">
                {availableEmails.map((email, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border-2 ${
                      email.isPrimary ? "bg-yellow-50 border-yellow-400" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      {email.isPrimary && (
                        <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 fill-yellow-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm sm:text-lg truncate">{email.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{email.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      {!email.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const emailIndex = savedEmails.findIndex((e) => e.email === email.email);
                            if (emailIndex !== -1) {
                              handleSetPrimaryEmail(emailIndex);
                            }
                          }}
                          className="text-xs"
                          tabIndex={0}
                          aria-label="우선 이메일로 설정"
                        >
                          <Star className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      )}
                      {savedEmails.some((e) => e.email === email.email) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const emailIndex = savedEmails.findIndex((e) => e.email === email.email);
                            if (emailIndex !== -1) {
                              handleDeleteEmail(emailIndex);
                            }
                          }}
                          className="text-red-600 hover:text-red-700 text-xs"
                          tabIndex={0}
                          aria-label="이메일 삭제"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 이메일 선택 및 전송 */}
            {availableEmails.length > 0 && (
              <>
                {availableEmails.length > 1 && (
                  <div className="mb-3">
                    <Label className="text-sm font-medium mb-2 block">이메일 선택</Label>
                    <select
                      value={selectedEmailForSend?.email || ""}
                      onChange={(e) => {
                        const selected = availableEmails.find((email) => email.email === e.target.value);
                        setSelectedEmailForSend(selected || null);
                      }}
                      className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm sm:text-base"
                      tabIndex={0}
                    >
                      {availableEmails.map((email, index) => (
                        <option key={index} value={email.email}>
                          {email.name} ({email.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Button
                  onClick={handleSendEmailToGuardian}
                  disabled={isSendingEmail || !selectedEmailForSend}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-base sm:text-lg py-4 sm:py-6 h-auto shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  tabIndex={0}
                  aria-label="이메일 전송"
                >
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                  <span className="truncate">
                    {isSendingEmail
                      ? "전송 중..."
                      : selectedEmailForSend
                      ? `${selectedEmailForSend.name}님에게 이메일 전송`
                      : "이메일을 선택해주세요"}
                  </span>
                </Button>
                {selectedEmailForSend && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedEmailForSend.name}({selectedEmailForSend.email})에게 위험 상황을 알립니다.
                  </p>
                )}
              </>
            )}

            {availableEmails.length === 0 && (
              <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">등록된 이메일이 없습니다.</p>
                <p className="text-xs text-muted-foreground">위 버튼을 눌러 이메일을 추가하세요.</p>
              </div>
            )}
          </div>

          {/* 우선 연락처 목록 */}
          {primaryContacts.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 fill-yellow-600" />
                  {riskLevel === "critical" ? (
                    <span className="text-red-700">🚨 우선 연락하기 ({primaryContacts.length}개) - 긴급!</span>
                  ) : (
                    `우선 연락처 (${primaryContacts.length}개)`
                  )}
                </Label>
              </div>
              {riskLevel === "critical" && (
                <div className="mb-3 p-3 bg-red-100 border-2 border-red-400 rounded-lg">
                  <p className="text-sm font-bold text-red-900">
                    ⚠️ 아래 버튼을 눌러 우선 연락처로 즉시 전화를 걸어주세요!
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {primaryContacts.map((contact, index) => (
                  <Button
                    key={index}
                    onClick={() => handleCall(contact.number)}
                    className={`w-full ${
                      riskLevel === "critical"
                        ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 animate-pulse"
                        : "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                    } text-white font-bold text-base sm:text-lg py-4 sm:py-6 h-auto shadow-lg`}
                    tabIndex={0}
                    aria-label={`${contact.name}에게 전화 걸기`}
                  >
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 fill-white" />
                    <span className="truncate">
                      {contact.name} ({contact.number})
                    </span>
                    <Phone className="h-4 w-4 sm:h-5 sm:w-5 ml-2 sm:ml-3 shrink-0" />
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 등록된 연락처 목록 */}
          {savedContacts.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base sm:text-lg font-bold">등록된 연락처</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingContact(true)}
                  tabIndex={0}
                  aria-label="연락처 추가"
                  className="text-xs sm:text-sm"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  추가
                </Button>
              </div>
              <div className="space-y-2">
                {savedContacts.map((contact, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border-2 ${
                      contact.isPrimary ? "bg-yellow-50 border-yellow-400" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      {contact.isPrimary && (
                        <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 fill-yellow-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm sm:text-lg truncate">{contact.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{contact.number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      {!contact.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetPrimary(index)}
                          tabIndex={0}
                          aria-label="우선 연락처로 설정"
                          title="우선 연락처로 설정"
                          className="h-8 w-8 sm:h-10 sm:w-10 p-0"
                        >
                          <Star className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCall(contact.number)}
                        tabIndex={0}
                        aria-label={`${contact.name}에게 전화 걸기`}
                        className="h-8 w-8 sm:h-10 sm:w-10 p-0"
                      >
                        <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(index)}
                        tabIndex={0}
                        aria-label="연락처 삭제"
                        className="text-red-600 hover:text-red-700 h-8 w-8 sm:h-10 sm:w-10 p-0"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 연락처 추가 폼 */}
          {isAddingContact && (
            <div className="mb-4 p-3 sm:p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="contact-name" className="text-sm sm:text-base">
                    이름
                  </Label>
                  <Input
                    id="contact-name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="예: 가족, 친구, 상담사"
                    className="mt-1 text-sm sm:text-base"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const input = e.target as HTMLInputElement;
                        input.nextElementSibling?.querySelector("input")?.focus();
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="contact-number" className="text-sm sm:text-base">
                    전화번호
                  </Label>
                  <Input
                    id="contact-number"
                    value={newContactNumber}
                    onChange={(e) => setNewContactNumber(e.target.value)}
                    placeholder="예: 010-1234-5678"
                    className="mt-1 text-sm sm:text-base"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddContact();
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddContact} className="flex-1 text-sm sm:text-base" tabIndex={0}>
                    저장
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingContact(false);
                      setNewContactName("");
                      setNewContactNumber("");
                    }}
                    className="flex-1 text-sm sm:text-base"
                    tabIndex={0}
                  >
                    취소
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 연락처 추가 버튼 (연락처가 없을 때) */}
          {savedContacts.length === 0 && !isAddingContact && (
            <div className="mb-4">
              {riskLevel === "critical" && (
                <div className="mb-3 p-4 bg-red-100 border-2 border-red-400 rounded-lg">
                  <p className="text-sm font-bold text-red-900 mb-2">
                    🚨 긴급 상황입니다! 우선 연락처를 등록하고 즉시 연락하세요!
                  </p>
                  <p className="text-xs text-red-800">
                    아래 버튼을 눌러 신뢰하는 사람(가족, 친구, 상담사)의 연락처를 등록하세요.
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => setIsAddingContact(true)}
                className={`w-full border-2 ${
                  riskLevel === "critical"
                    ? "border-red-500 bg-red-50 hover:bg-red-100 text-red-700 font-bold"
                    : "border-dashed"
                } py-4 sm:py-6 h-auto text-sm sm:text-base`}
                tabIndex={0}
                aria-label="첫 번째 연락처 추가"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                {riskLevel === "critical" ? "🚨 우선 연락처 등록하기 (긴급)" : "연락처 등록하기"}
              </Button>
            </div>
          )}

          <div className="space-y-3 my-4">
            <Label className="text-base sm:text-lg font-bold">긴급 상담 전화</Label>
            {emergencyNumbers.map((item) => (
              <button
                key={item.number}
                onClick={() => setSelectedNumber(item.number)}
                className={`w-full p-3 sm:p-4 rounded-lg border-2 transition-all ${
                  colorClasses[item.color]
                } cursor-pointer active:scale-95 sm:hover:shadow-xl`}
                tabIndex={0}
                aria-label={`${item.name} ${item.number}`}
              >
                <div className={`flex items-center justify-between ${textColors[item.color]}`}>
                  <div className="text-left">
                    <p className="font-black text-base sm:text-xl">{item.name}</p>
                    <p className="text-xs sm:text-sm font-bold">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-black">{item.number}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedNumber && (
            <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg mb-4" role="alert">
              <p className="text-yellow-900 font-medium">
                ⚠️ 선택된 번호: <span className="text-lg sm:text-xl">{selectedNumber}</span>
              </p>
              <p className="text-xs sm:text-sm text-yellow-800 mt-1">아래 버튼을 클릭하면 자동으로 전화가 걸립니다.</p>
            </div>
          )}

          <div className="mt-4 p-3 bg-[#e6f2ff] rounded-lg border-2 border-[#0066ff]">
            <p className="text-xs font-bold text-[#001a4d]">
              💡 <strong>팁:</strong> 위 번호 중 하나를 클릭한 후 &quot;전화 걸기&quot;를 누르세요. 모바일 기기에서는
              자동으로 전화 앱이 열립니다.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex gap-2 sm:gap-3 flex-row pt-4 border-t mt-2 sm:mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedNumber(null);
              onOpenChange(false);
            }}
            className="flex-1 border-2 text-base sm:text-lg py-4 sm:py-6 h-auto font-bold"
            tabIndex={0}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            닫기
          </Button>
          {selectedNumber && (
            <Button
              onClick={() => handleCall(selectedNumber)}
              className={`flex-1 ${
                emergencyNumbers.find((n) => n.number === selectedNumber)?.color === "blue"
                  ? blueStyle
                  : buttonColors[emergencyNumbers.find((n) => n.number === selectedNumber)?.color || "red"]
              } text-white font-bold text-base sm:text-lg py-4 sm:py-6 h-auto`}
              tabIndex={0}
            >
              <Phone className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              전화 걸기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmergencyCallDialog;
