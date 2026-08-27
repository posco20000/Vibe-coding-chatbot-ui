# 서초 AI

Supabase Google 인증과 Gemini를 연결한 Next.js 챗봇입니다. 로그인한 사용자만 채팅 화면과 서버 API에 접근할 수 있습니다.

## 현재 구현된 것

- 데스크톱·모바일 반응형 챗봇 UI
- Supabase SSR 기반 Google 로그인·사용자 정보 표시·로그아웃
- 비로그인 사용자의 `/chat` 및 `/api/chat` 접근 차단
- 여러 채팅방 생성·불러오기·삭제
- Supabase Database에 사용자별 채팅방과 메시지를 자동 저장
- RLS(Row Level Security)로 본인의 채팅 내역만 조회·변경·삭제
- Gemini 대화 이력을 유지하는 `/api/chat` 서버 Route
- 무료 티어를 지원하는 `gemini-3.5-flash-lite` 연동
- API 키가 없을 때 고정된 설정 안내 표시
- API 키가 브라우저에 노출되지 않는 서버 Route 구조

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## Supabase와 Google 로그인 설정

`.env.local`에 Supabase Project Settings > API의 Project URL과 Publishable key를 입력합니다. `service_role` 또는 secret 키는 브라우저에 공개되는 `NEXT_PUBLIC_` 변수에 절대 넣지 않습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

Google Cloud Console에서 OAuth 2.0 웹 클라이언트를 만든 뒤, 승인된 리디렉션 URI에 다음 Supabase 콜백 주소를 등록합니다.

```text
https://your-project-ref.supabase.co/auth/v1/callback
```

Supabase Dashboard > Authentication > Sign In / Providers > Google에서 Google Client ID와 Client Secret을 입력하고 Google Provider를 활성화합니다. 이 두 값은 코드나 `.env.local`에 넣지 않습니다.

Supabase Dashboard > Authentication > URL Configuration에는 다음 주소를 등록합니다.

- Site URL: 로컬 개발 중에는 `http://localhost:3000`, 배포 후에는 Vercel 운영 URL
- Redirect URLs: `http://localhost:3000/auth/callback`
- 운영 Redirect URL: `https://your-domain.com/auth/callback`
- Vercel Preview가 필요하면 팀 이름을 포함한 Preview wildcard도 별도로 등록

채팅 저장용 테이블, 인덱스, RLS 정책은 `supabase/migrations`에 기록되어 있습니다. 새 Supabase 프로젝트에 연결할 때는 Supabase CLI로 마이그레이션을 적용합니다.

## Gemini API 키 설정

Google AI Studio에서 새 API 키를 발급한 뒤 `.env` 또는 `.env.local`에 입력합니다. 개인 키는 로컬 개발에서 우선순위가 높은 `.env.local` 사용을 권장합니다.

```env
GEMINI_API_KEY=새로_발급받은_키
```

환경변수를 변경했다면 개발 서버를 재시작합니다. `.env`와 `.env.local`은 Git에 올라가지 않습니다. 키에 `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 컴포넌트에서 직접 사용하지 마세요.

## 확인 명령

```bash
npm run lint
npm run typecheck
npm run build
```

## Vercel 배포

1. 본인 GitHub 저장소로 코드를 올립니다.
2. Vercel에서 해당 저장소를 Import합니다.
3. Vercel 프로젝트의 Environment Variables에 `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 등록합니다.
4. 배포 후 Supabase URL Configuration에 실제 Vercel 운영 URL과 `/auth/callback` 주소를 등록합니다.
5. 배포를 실행하고 Google 로그인 → `/chat` 이동 → 로그아웃 → `/` 이동을 확인합니다.

`.nvmrc`와 `package.json`은 Vercel에서 Node.js 22 이상을 사용하도록 설정되어 있습니다. Next.js 프로젝트이므로 별도의 `vercel.json`은 필요하지 않습니다.

## 주요 파일

```text
src/app/page.tsx                  # 공개 랜딩 및 로그인 진입점
src/app/chat/page.tsx             # 인증이 필요한 채팅 페이지
src/app/auth/callback/route.ts    # Supabase PKCE 로그인 콜백
src/components/chat-app.tsx       # 채팅 UI와 Supabase 저장·삭제
src/lib/supabase/                 # 브라우저·서버·Proxy Supabase 클라이언트
supabase/migrations/              # 채팅 스키마·인덱스·RLS 마이그레이션
src/proxy.ts                      # Supabase 세션 쿠키 갱신
src/app/api/chat/route.ts         # 인증 검사 후 Gemini API 호출
.env.example                      # 필요한 환경 변수 예시
```
