"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { saveOnboardingData, getLocationFromAddress, type OnboardingData } from "../lib/api";

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
  const [address, setAddress] = useState("");

  // 보호자 정보
  const [hasGuardian, setHasGuardian] = useState(true);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

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
    if (!address.trim()) {
      setError("주소를 입력해주세요.");
      return false;
    }
    setError("");
    return true;
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
      // 주소로부터 위치 정보 조회
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const locationData = await getLocationFromAddress(address);
        latitude = locationData.latitude;
        longitude = locationData.longitude;
      } catch (err) {
        console.warn("위치 정보 조회 실패:", err);
        // 위치 조회 실패해도 계속 진행
      }

      const onboardingData: OnboardingData = {
        name,
        phone,
        address,
        guardianName: hasGuardian ? guardianName : undefined,
        guardianPhone: hasGuardian ? guardianPhone : "112",
        latitude,
        longitude,
      };

      // API에 저장
      await saveOnboardingData(userId, onboardingData);

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
    } catch (err) {
      console.error("온보딩 저장 실패:", err);
      setError("정보 저장에 실패했습니다. 다시 시도해주세요.");
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
                <Label htmlFor="address" className="text-base font-semibold">
                  주소 <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="예: 서울시 강남구 테헤란로 123"
                  className="mt-2 h-10 text-base"
                />
              </div>
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
                    <p className="text-lg font-semibold">{address}</p>
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
