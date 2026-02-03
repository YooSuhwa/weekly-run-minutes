# WeeklyRun

**주간회의를 Weeky가 진행하고, 자동으로 회의록을 생성하는 서비스**

[![Backend Tests](https://img.shields.io/badge/tests-397%20passed-brightgreen)]()
[![Frontend Tests](https://img.shields.io/badge/tests-956%20passed-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-80%25%2B-brightgreen)]()

## 주요 기능

### P1-lite: 파이프라인 검증
- 녹음 파일 업로드 (MP3, WAV, WebM, M4A, 최대 100MB)
- ElevenLabs STT 처리
- GPT 기반 회의록 자동 생성
- 주간업무록 참조 용어 교정
- AI 교정 하이라이트
- Markdown 다운로드 / Confluence 업로드

### P1-full: 오케스트레이션 UX
- 실시간 회의 진행 UI
- 질문 트리 기반 회의 진행
- 키보드 단축키 (Space, Enter, Esc, ←, →)
- 브라우저 MediaRecorder 녹음
- Weeky 캐릭터 12개 표정

### P2: 멀티팀 & 확장
- 멀티 팀 지원 (팀별 비밀번호 인증)
- 팀별 단어집 관리
- AI 기반 잡담 필터링
- 일반 회의 모드 (아젠다 기반)

---

## 기술 스택

### Backend (apps/api)
| 항목 | 기술 |
|------|------|
| Framework | FastAPI |
| ORM | SQLAlchemy (async) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| STT | ElevenLabs API |
| AI | OpenAI GPT-4o |

### Frontend (apps/web)
| 항목 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + shadcn/ui |
| Styling | TailwindCSS v4 |
| State | Jotai |
| API Client | Orval (OpenAPI 기반) |
| Editor | TipTap |

---

## 시작하기

### 필수 요구사항

- [mise](https://mise.jdx.dev/) (런타임 관리)
- [Docker](https://www.docker.com/) (인프라)

### 1. 런타임 설치

```bash
# mise 설치 (Windows)
winget install jdx.mise

# 또는 macOS
brew install mise

# 런타임 설치
mise install
```

### 2. 인프라 시작

```bash
# PostgreSQL, Redis 시작
docker compose -f apps/api/docker-compose.infra.yml up -d
```

### 3. 환경변수 설정

```bash
# Backend 환경변수
cp apps/api/.env.example apps/api/.env

# .env 파일 수정
# - ELEVENLABS_API_KEY: ElevenLabs API 키
# - OPENAI_API_KEY: OpenAI API 키
# - CONFLUENCE_*: Confluence 연동 설정 (선택)
```

### 4. 의존성 설치

```bash
# Backend
cd apps/api
uv sync

# Frontend
cd apps/web
pnpm install
```

### 5. 데이터베이스 마이그레이션

```bash
cd apps/api
uv run alembic upgrade head
```

### 6. 개발 서버 시작

```bash
# 터미널 1: Backend (http://localhost:8000)
cd apps/api
uv run uvicorn src.main:app --reload

# 터미널 2: Frontend (http://localhost:3000)
cd apps/web
pnpm dev
```

또는 mise 사용:

```bash
mise run dev
```

---

## 주요 명령어

### 개발

```bash
# 모든 서비스 시작
mise run dev

# Lint
mise run lint

# Format
mise run format

# 테스트
mise run test

# 타입 체크
mise run typecheck
```

### Backend (apps/api)

```bash
cd apps/api

# 개발 서버
uv run uvicorn src.main:app --reload

# 테스트
uv run pytest

# 테스트 (커버리지)
uv run pytest --cov=src --cov-report=term-missing

# Lint
uv run ruff check

# Format
uv run ruff format

# 마이그레이션 생성
uv run alembic revision --autogenerate -m "description"

# 마이그레이션 적용
uv run alembic upgrade head
```

### Frontend (apps/web)

```bash
cd apps/web

# 개발 서버
pnpm dev

# 빌드
pnpm build

# 테스트
pnpm test

# 테스트 (커버리지)
pnpm test --coverage

# Lint
pnpm lint

# API 클라이언트 생성
pnpm exec orval
```

---

## API 문서

개발 서버 실행 후:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 프로젝트 구조

```
weekly-run-minutes/
├── apps/
│   ├── api/                 # FastAPI 백엔드
│   │   ├── src/
│   │   │   ├── models/      # SQLAlchemy 모델
│   │   │   ├── routers/     # API 라우터
│   │   │   ├── schemas/     # Pydantic 스키마
│   │   │   ├── services/    # 비즈니스 로직
│   │   │   └── lib/         # 유틸리티
│   │   └── tests/           # 테스트
│   │
│   └── web/                 # Next.js 프론트엔드
│       └── src/
│           ├── app/         # App Router 페이지
│           ├── atoms/       # Jotai 상태
│           ├── components/  # UI 컴포넌트
│           ├── hooks/       # 커스텀 훅
│           └── lib/         # 유틸리티
│
├── docs/                    # 문서
├── packages/                # 공유 패키지
└── TASKS.md                 # 개발 태스크 트래킹
```

---

## 환경 변수

### Backend (.env)

| 변수 | 설명 | 필수 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 URL | ✅ |
| `REDIS_URL` | Redis 연결 URL | ✅ |
| `ELEVENLABS_API_KEY` | ElevenLabs STT API 키 | ✅ |
| `OPENAI_API_KEY` | OpenAI API 키 | ✅ |
| `CONFLUENCE_BASE_URL` | Confluence 기본 URL | ❌ |
| `CONFLUENCE_USERNAME` | Confluence 사용자 이메일 | ❌ |
| `CONFLUENCE_TOKEN` | Confluence API 토큰 | ❌ |

### Frontend (.env.local)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000` |

---

## 테스트

### Backend
```bash
cd apps/api

# 전체 테스트
uv run pytest

# 특정 파일
uv run pytest tests/test_meetings_router.py

# 커버리지 리포트
uv run pytest --cov=src --cov-report=html
```

### Frontend
```bash
cd apps/web

# 전체 테스트
pnpm test

# Watch 모드
pnpm test --watch

# 커버리지 리포트
pnpm test --coverage
```

---

## 기여하기

1. Feature 브랜치 생성: `git checkout -b feature/my-feature`
2. 변경사항 커밋: `git commit -m "feat: add my feature"`
3. 브랜치 푸시: `git push origin feature/my-feature`
4. Pull Request 생성

### 커밋 컨벤션

```
<type>: <description>

Types: feat, fix, refactor, docs, test, chore, perf, ci
```

---

## 라이선스

MIT License

---

## 팀

- **제품기술팀**: 이상윤, 선설희, 최보연, 유수화, 김정연
