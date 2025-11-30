# EmailJS 설정 가이드

## 1. EmailJS 계정 생성 및 서비스 설정

1. <https://www.emailjs.com> 에서 계정 생성
2. **Email Services** 메뉴에서 이메일 서비스 추가 (Gmail, Outlook 등)
3. 서비스 연결 완료 후 서비스 ID 확인

## 2. Email Template 생성

1. **Email Templates** 메뉴에서 새 템플릿 생성
2. 템플릿 내용 작성:

```
제목: {{subject}}

안녕하세요 {{to_name}}님,

{{risk_message}}

상세 정보:
- 사용자: {{user_name}}
- 위험 수준: {{risk_level}}

{{message}}

감사합니다.
MindMate 팀
```

3. **중요: To Email 필드 설정**

   - Email Template 편집 화면에서 **"To Email"** 필드를 찾습니다
   - 이 필드에 **`{{to_email}}`** 을 입력합니다
   - 이렇게 하면 코드에서 전달한 `to_email` 값이 동적으로 수신자 이메일로 설정됩니다

4. **From Name** 및 **From Email** 설정 (선택사항)
5. 템플릿 저장 후 템플릿 ID 확인

## 3. Public Key 확인

1. **Account** 메뉴로 이동
2. **API Keys** 섹션에서 Public Key 확인

## 4. 환경 변수 설정

프로젝트 루트의 `.env.local` 파일에 다음을 추가:

```env
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
```

## 5. Email Service 설정에서 To Email 동적 설정

### 방법 1: Email Template에서 설정 (권장)

- Email Template 편집 화면의 **"To Email"** 필드에 `{{to_email}}` 입력

### 방법 2: Email Service 설정에서 변경

1. **Email Services** 메뉴로 이동
2. 사용 중인 서비스 클릭
3. **"To Email"** 필드를 비워두거나 `{{to_email}}` 입력
4. 저장

## 6. 테스트

1. 환경 변수 설정 후 개발 서버 재시작
2. 응급전화 다이얼로그에서 이메일 전송 테스트
3. 일기장에 위험 단어 입력하여 자동 전송 테스트

## 주의사항

- **To Email 필드에 `{{to_email}}`을 반드시 입력해야 합니다**
- 그렇지 않으면 EmailJS가 기본 설정된 이메일로만 전송됩니다
- 템플릿 변수는 대소문자를 구분합니다 (`{{to_email}}` ≠ `{{TO_EMAIL}}`)
