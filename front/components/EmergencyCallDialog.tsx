"use client";

import { useState, useEffect } from "react";
import { Phone, AlertTriangle, X, Plus, Star, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

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
}

interface SavedContact {
  name: string;
  number: string;
  isPrimary?: boolean;
}

const EmergencyCallDialog = ({ isOpen, onOpenChange, riskLevel }: EmergencyCallDialogProps) => {
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
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

  const primaryContacts = savedContacts.filter((c) => c.isPrimary);

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
