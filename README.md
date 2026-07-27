# 수업 Q&A 앱

학생이 질문하면 **AI가 아니라 선생님이 등록한 답변 리스트**에서 키워드로 매칭해 대답합니다.
매칭되는 답이 없으면 선생님께 이메일로 알림이 가고, 관리자 페이지에서 답변을 입력하면
다음부터 같은 질문에 자동으로 답합니다.

## 동작 방식
1. 학생: 구글 로그인(아무 계정 가능) → 질문 입력 → 키워드 매칭
   - 매칭 성공 → 즉시 답변 표시
   - 매칭 실패 → "선생님께 전달했어요" 안내 + 미답변 큐 저장 + 이메일 발송
2. 선생님(고정 1계정, `VITE_TEACHER_EMAIL`로 지정): 같은 구글 로그인으로 접속하면
   자동으로 관리자 화면이 뜸 → 미답변 질문 확인 → 답변 입력 → 저장 시 Q&A 목록에 자동 추가

## 설치 순서

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 새 프로젝트 생성
2. **Authentication → Providers → Google** 활성화 (Google Cloud Console에서 OAuth 클라이언트 ID/Secret 발급 후 등록)
   - 도메인 제한 없음 → 아무 구글 계정으로 로그인 가능
3. **SQL Editor**에서 `supabase/schema.sql` 내용 실행
   - 실행 전 파일 안의 `TEACHER_EMAIL_PLACEHOLDER`를 선생님 구글 이메일로 전부 바꿔주세요.
4. **Project Settings → API**에서 URL과 anon key 확인

### 2. Resend (이메일 발송) 계정 만들기
1. https://resend.com 가입 → API Key 발급
2. 무료 티어는 발신 도메인 인증 전엔 `onboarding@resend.dev`로만 발송 가능 (테스트용으로 충분)
3. 실제 학교 도메인으로 보내려면 Resend에서 도메인 인증 필요

### 3. 환경변수 설정
`.env.example`을 참고해 `.env` 파일 생성 (로컬 개발용) 또는 Vercel 프로젝트의
**Settings → Environment Variables**에 동일하게 등록:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_TEACHER_EMAIL=선생님 구글 이메일
RESEND_API_KEY=...
TEACHER_EMAIL=선생님 구글 이메일
NOTIFY_FROM_EMAIL=onboarding@resend.dev
APP_URL=배포된 앱 주소
```

### 4. 로컬 실행
```bash
npm install
npm run dev
```

### 5. 배포 (Vercel)
```bash
vercel
```
`api/notify-teacher.js`는 Vercel이 자동으로 서버리스 함수로 인식합니다.
GitHub 연결 후 Vercel 대시보드로 배포해도 동일합니다.

## 폴더 구조
```
src/
  lib/matching.js       ← 키워드 매칭 핵심 로직 (테스트 완료)
  pages/Login.jsx       ← 구글 로그인 화면
  pages/StudentView.jsx ← 학생 질문 화면
  pages/AdminView.jsx   ← 선생님 관리자 화면 (미답변 큐 + 전체 목록)
  App.jsx               ← 로그인 세션에 따라 학생/관리자 화면 분기
supabase/schema.sql     ← DB 테이블 + RLS 정책
api/notify-teacher.js   ← 매칭 실패 시 이메일 발송 (Resend)
```

## 매칭 로직 커스터마이징
`src/lib/matching.js`의 `threshold` 값(기본 0.34)을 조정하면 매칭 민감도를 바꿀 수 있어요.
값을 낮추면 느슨하게, 높이면 엄격하게 매칭됩니다.
키워드는 Q&A 등록 시 쉼표로 구분해 여러 개 넣을 수 있고, 비워두면 질문에서 자동 추출됩니다.

## 과목(카테고리) 기능
- 관리자 페이지 **설정** 탭에서 과목을 추가/삭제할 수 있어요.
- 학생은 질문 전에 과목을 반드시 선택해야 하고, 매칭도 같은 과목 안에서만 이뤄져요.
- 기존 Q&A는 전부 "기타" 과목으로 되어 있으니, "전체 Q&A 목록" 탭에서 **수정** 버튼으로 하나씩 과목을 재분류해 주세요.
- 새로 이 기능을 추가하는 경우, Supabase SQL Editor에서 `supabase/migration_subjects.sql`을 한 번 실행해야 해요
  (이미 `schema.sql`, `migration_mypage.sql`을 실행한 기존 프로젝트 기준).

