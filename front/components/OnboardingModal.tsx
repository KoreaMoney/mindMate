"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { AlertCircle, CheckCircle2, Search, Plus, Trash2 } from "lucide-react";
import { saveOnboardingData, getLocationFromAddress, type OnboardingData } from "../lib/api";
import DaumPostcode from "react-daum-postcode";

interface OnboardingModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: (data: OnboardingData) => void;
}

type FormStep = "info" | "guardian" | "confirm";

const OnboardingModal = ({ isOpen, onOpenChange, userId, onComplete }: OnboardingModalProps) => {
  const [step, setStep] = useState<FormStep>("info");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 기본 정보
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState<Array<{ baseAddress: string; detailAddress: string }>>([]);
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);
  const [currentBaseAddress, setCurrentBaseAddress] = useState("");
  const [currentDetailAddress, setCurrentDetailAddress] = useState("");

  // 보호자 정보
  const [hasGuardian, setHasGuardian] = useState(true);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

  const formatPhoneNumber = (value: string): string => {
    // 이미 포맷팅된 값인지 확인 (하이픈이 있는지)
    const cleaned = value.replace(/-/g, "").replace(/\D/g, "");

    // 숫자만 있는 경우에만 포맷팅
    if (cleaned.length === 0) return "";
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    if (cleaned.length <= 11) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;

    // 11자리 초과시 11자리까지만
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const value = e.target.value;
    const formatted = formatPhoneNumber(value);
    setter(formatted);
  };

  const validateInfoStep = (): boolean => {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return false;
    }
    if (!phone.trim()) {
      setError("전화번호를 입력해주세요.");
      return false;
    }
    if (addresses.length === 0) {
      setError("최소 하나의 주소를 등록해주세요.");
      return false;
    }
    setError("");
    return true;
  };

  const handleAddAddress = () => {
    if (!currentBaseAddress.trim()) {
      setError("기본 주소를 검색해주세요.");
      return;
    }
    const newAddress = {
      baseAddress: currentBaseAddress,
      detailAddress: currentDetailAddress.trim(),
    };
    setAddresses([...addresses, newAddress]);
    setCurrentBaseAddress("");
    setCurrentDetailAddress("");
    setIsPostcodeOpen(false);
    setError("");
  };

  const handleRemoveAddress = (index: number) => {
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const validateGuardianStep = (): boolean => {
    if (hasGuardian) {
      if (!guardianName.trim()) {
        setError("보호자 이름을 입력해주세요.");
        return false;
      }
      if (!guardianPhone.trim()) {
        setError("보호자 전화번호를 입력해주세요.");
        return false;
      }
      if (!guardianEmail.trim()) {
        setError("보호자 이메일을 입력해주세요.");
        return false;
      }
      // 이메일 형식 검증
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guardianEmail.trim())) {
        setError("올바른 이메일 주소를 입력해주세요.");
        return false;
      }
    }
    setError("");
    return true;
  };

  const handleNextStep = async () => {
    if (step === "info") {
      if (validateInfoStep()) {
        setStep("guardian");
      }
    } else if (step === "guardian") {
      if (validateGuardianStep()) {
        setStep("confirm");
      }
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");

    try {
      // 첫 번째 주소를 기본 주소로 사용
      const primaryAddress = addresses[0];
      const fullAddress = primaryAddress.detailAddress
        ? `${primaryAddress.baseAddress} ${primaryAddress.detailAddress}`
        : primaryAddress.baseAddress;

      // 주소로부터 위치 정보 조회 (서버 연결 실패 시 무시)
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const locationData = await getLocationFromAddress(fullAddress);
        latitude = locationData.latitude;
        longitude = locationData.longitude;
      } catch (err: unknown) {
        // 네트워크 에러는 조용히 처리 (서버가 없을 수 있음)
        const isNetworkError =
          (err &&
            typeof err === "object" &&
            "isNetworkError" in err &&
            (err as { isNetworkError?: boolean }).isNetworkError) ||
          (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "ERR_NETWORK") ||
          (err instanceof Error && err.message.includes("Network Error"));

        if (!isNetworkError) {
          console.warn("위치 정보 조회 실패:", err);
        }
        // 위치 조회 실패해도 계속 진행
      }

      const onboardingData: OnboardingData = {
        name,
        phone,
        address: fullAddress,
        guardianName: hasGuardian ? guardianName : undefined,
        guardianPhone: hasGuardian ? guardianPhone : "112",
        guardianEmail: hasGuardian ? guardianEmail : undefined,
        latitude,
        longitude,
      };

      // API에 저장 시도 (서버 연결 실패 시 로컬스토리지만 사용)
      try {
        await saveOnboardingData(userId, onboardingData);
      } catch (err: unknown) {
        // 네트워크 에러인 경우 로컬스토리지만 사용
        const isNetworkError =
          (err &&
            typeof err === "object" &&
            "isNetworkError" in err &&
            (err as { isNetworkError?: boolean }).isNetworkError) ||
          (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "ERR_NETWORK") ||
          (err instanceof Error && err.message.includes("Network Error"));

        if (!isNetworkError) {
          // 다른 에러는 사용자에게 알림
          throw err;
        }
        // 서버 연결 없음 - 로컬스토리지에만 저장하고 계속 진행
      }

      // 우선 연락처에 자동 등록
      const emergencyContacts = [
        {
          name: hasGuardian ? guardianName : "긴급 신고",
          number: hasGuardian ? guardianPhone : "112",
          isPrimary: true,
        },
      ];

      localStorage.setItem("emergency_contacts", JSON.stringify(emergencyContacts));
      window.dispatchEvent(new Event("contactsUpdated"));

      // 온보딩 데이터 저장
      localStorage.setItem(`onboarding_${userId}`, JSON.stringify(onboardingData));

      onComplete(onboardingData);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("온보딩 저장 실패:", err);
      // 에러 메시지가 있으면 사용, 없으면 기본 메시지
      let errorMessage = "정보 저장에 실패했습니다. 다시 시도해주세요.";
      if (err && typeof err === "object") {
        if ("userMessage" in err && typeof (err as { userMessage?: unknown }).userMessage === "string") {
          errorMessage = (err as { userMessage: string }).userMessage;
        } else if ("message" in err && typeof (err as { message?: unknown }).message === "string") {
          errorMessage = (err as { message: string }).message;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevStep = () => {
    if (step === "guardian") {
      setStep("info");
    } else if (step === "confirm") {
      setStep("guardian");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">MindMate 시작하기</DialogTitle>
          <DialogDescription>안전한 서비스를 위해 정보를 입력해주세요</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 스텝 인디케이터 */}
          <div className="flex gap-2">
            <div
              className={`flex-1 h-2 rounded-full ${
                step === "info" || step === "guardian" || step === "confirm" ? "bg-blue-500" : "bg-gray-300"
              }`}
            />
            <div
              className={`flex-1 h-2 rounded-full ${
                step === "guardian" || step === "confirm" ? "bg-blue-500" : "bg-gray-300"
              }`}
            />
            <div className={`flex-1 h-2 rounded-full ${step === "confirm" ? "bg-blue-500" : "bg-gray-300"}`} />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Step 1: 기본 정보 */}
          {step === "info" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-base font-semibold">
                  이름 <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 김민수"
                  className="mt-2 h-10 text-base"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-base font-semibold">
                  전화번호 <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e, setPhone)}
                  placeholder="010-0000-0000"
                  className="mt-2 h-10 text-base"
                  maxLength={13}
                />
              </div>
              <div>
                <Label className="text-base font-semibold">
                  주소 <span className="text-red-600">*</span>
                </Label>

                {/* 주소 리스트 */}
                {addresses.length > 0 && (
                  <div className="mt-2 space-y-2 mb-3">
                    {addresses.map((addr, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{addr.baseAddress}</p>
                          {addr.detailAddress && <p className="text-xs text-gray-600 mt-1">{addr.detailAddress}</p>}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAddress(index)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                          tabIndex={0}
                          aria-label="주소 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 주소 추가 폼 */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={currentBaseAddress}
                      placeholder="주소 검색 버튼을 클릭하세요"
                      className="flex-1 h-10 text-base"
                      readOnly
                      tabIndex={0}
                      aria-label="기본 주소"
                    />
                    <Button
                      type="button"
                      onClick={() => setIsPostcodeOpen(true)}
                      className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white"
                      tabIndex={0}
                      aria-label="주소 검색"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      주소 검색
                    </Button>
                  </div>
                  {currentBaseAddress && (
                    <>
                      <Input
                        value={currentDetailAddress}
                        onChange={(e) => setCurrentDetailAddress(e.target.value)}
                        placeholder="상세주소 입력 (예: 101동 301호)"
                        className="h-10 text-base"
                        tabIndex={0}
                        aria-label="상세주소"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddAddress();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleAddAddress}
                        className="w-full h-10 bg-green-600 hover:bg-green-700 text-white"
                        tabIndex={0}
                        aria-label="주소 추가"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        주소 추가
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {isPostcodeOpen && (
                <Dialog open={isPostcodeOpen} onOpenChange={setIsPostcodeOpen}>
                  <DialogContent
                    className="max-w-2xl w-full p-0 overflow-hidden"
                    onInteractOutside={(e) => e.preventDefault()}
                  >
                    <DialogHeader className="px-6 pt-6 pb-4 border-b">
                      <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Search className="h-5 w-5 text-blue-600" />
                        주소 검색
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-600 mt-2">
                        우편번호를 검색하여 주소를 선택해주세요
                      </DialogDescription>
                    </DialogHeader>
                    <div className="px-6 py-4">
                      <DaumPostcode
                        onComplete={(data) => {
                          const fullAddress = data.address;
                          const extraAddress =
                            data.addressType === "R"
                              ? ` (${data.bname}${data.buildingName ? `, ${data.buildingName}` : ""})`
                              : "";
                          setCurrentBaseAddress(fullAddress + extraAddress);
                          setIsPostcodeOpen(false);
                        }}
                        autoClose={false}
                        style={{ height: "500px", width: "100%" }}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}

          {/* Step 2: 보호자 정보 */}
          {step === "guardian" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="hasGuardian"
                    checked={hasGuardian}
                    onChange={(e) => setHasGuardian(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-gray-300 cursor-pointer"
                  />
                  <label htmlFor="hasGuardian" className="text-base font-semibold cursor-pointer flex-1">
                    보호자가 있습니다
                  </label>
                </div>
              </div>

              {hasGuardian && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="guardianName" className="text-base font-semibold">
                      보호자 이름 <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="guardianName"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="예: 엄마"
                      className="mt-2 h-10 text-base"
                    />
                  </div>
                  <div>
                    <Label htmlFor="guardianPhone" className="text-base font-semibold">
                      보호자 전화번호 <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="guardianPhone"
                      value={guardianPhone}
                      onChange={(e) => handlePhoneChange(e, setGuardianPhone)}
                      placeholder="010-0000-0000"
                      className="mt-2 h-10 text-base"
                      maxLength={13}
                    />
                  </div>

                  <div>
                    <Label htmlFor="guardianEmail" className="text-base font-semibold">
                      보호자 이메일 <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="guardianEmail"
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="guardian@example.com"
                      className="mt-2 h-10 text-base"
                      tabIndex={0}
                    />
                    <p className="text-xs text-muted-foreground mt-1">위험 신호 감지 시 이메일로 알림을 받습니다.</p>
                  </div>
                </div>
              )}

              {!hasGuardian && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700">
                    보호자가 없으므로 응급 신고(112)가 우선 연락처로 등록됩니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: 확인 */}
          {step === "confirm" && (
            <div className="space-y-4">
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="pt-6 space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">이름</p>
                    <p className="text-lg font-semibold">{name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">전화번호</p>
                    <p className="text-lg font-semibold">{phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">주소</p>
                    <div className="space-y-2 mt-1">
                      {addresses.map((addr, index) => (
                        <div key={index} className="p-2 bg-white rounded border border-blue-200">
                          <p className="text-base font-semibold text-gray-900">{addr.baseAddress}</p>
                          {addr.detailAddress && <p className="text-sm text-gray-600 mt-1">{addr.detailAddress}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t-2 border-blue-200 pt-3">
                    <p className="text-sm text-gray-600">우선 연락처</p>
                    <p className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      {hasGuardian ? guardianName : "긴급 신고"} ({hasGuardian ? guardianPhone : "112"})
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">✓ 정보가 안전하게 저장되고 필요시 119에 제공됩니다.</p>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            {step !== "info" && (
              <Button variant="outline" onClick={handlePrevStep} className="flex-1" disabled={isLoading}>
                이전
              </Button>
            )}
            <Button
              onClick={step === "confirm" ? handleSubmit : handleNextStep}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 text-base"
              disabled={isLoading}
            >
              {isLoading ? "처리 중..." : step === "confirm" ? "시작하기" : "다음"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
