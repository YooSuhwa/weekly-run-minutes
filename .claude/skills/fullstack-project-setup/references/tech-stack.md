# Tech Stack Reference

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
│  ┌─────────────────────┐                                    │
│  │   Next.js 16        │                                    │
│  │   React 19          │                                    │
│  │   TailwindCSS v4    │                                    │
│  └──────────┬──────────┘                                    │
└─────────────┼───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                      GCP Cloud Run                          │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │   FastAPI           │    │   Worker            │        │
│  │   Python 3.13       │───▶│   CloudTasks        │        │
│  └──────────┬──────────┘    └──────────┬──────────┘        │
└─────────────┼───────────────────────────┼───────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                         Data                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PostgreSQL   │  │ Redis        │  │ Cloud        │      │
│  │ 16           │  │ 7            │  │ Storage      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Frontend (apps/web)

### 핵심 기술

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16 | React 프레임워크 |
| React | 19 | UI 라이브러리 |
| TailwindCSS | v4 | 스타일링 |
| TanStack Query | 5 | 서버 상태 관리 |
| Jotai | 2 | 클라이언트 상태 관리 |
| Orval | - | OpenAPI → TypeScript 클라이언트 생성 |
| next-intl | - | i18n |

### 디렉토리 구조

```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/          # i18n 라우팅
│   │   ├── api/               # API Routes
│   │   └── serwist/           # PWA Service Worker
│   ├── components/            # React 컴포넌트
│   ├── hooks/                 # Custom Hooks
│   ├── lib/                   # 유틸리티
│   │   ├── api/              # Orval 생성 API 클라이언트
│   │   ├── auth/             # 인증 관련
│   │   └── i18n/             # i18n 설정
│   ├── stores/               # Jotai atoms
│   └── config/               # 설정
│       ├── env.ts
│       └── messages/         # i18n 메시지
├── package.json
├── next.config.ts
├── orval.config.ts           # API 클라이언트 생성 설정
└── mise.toml
```

### 주요 명령어

```bash
mise //apps/web:dev       # 개발 서버
mise //apps/web:build     # 프로덕션 빌드
mise //apps/web:gen:api   # API 클라이언트 생성 (Orval)
mise //apps/web:lint      # Biome 린트
mise //apps/web:typecheck # TypeScript 검사
```

## Backend (apps/api)

### 핵심 기술

| 기술 | 버전 | 용도 |
|------|------|------|
| FastAPI | 0.115+ | Web 프레임워크 |
| SQLAlchemy | 2.0+ | ORM (async) |
| Alembic | 1.14+ | DB 마이그레이션 |
| Pydantic | 2.10+ | 데이터 검증 |
| asyncpg | - | PostgreSQL async 드라이버 |
| Redis | 5.2+ | 캐시, 세션 |

### 디렉토리 구조

```
apps/api/
├── src/
│   ├── main.py               # FastAPI 앱 엔트리포인트
│   ├── auth/                 # 인증 모듈
│   ├── users/                # 사용자 모듈
│   ├── common/               # 공통 모델
│   │   └── models/
│   │       ├── base.py       # 베이스 모델
│   │       └── pagination.py # 페이지네이션
│   └── lib/                  # 핵심 라이브러리
│       ├── config.py         # 설정
│       ├── database.py       # DB 연결
│       ├── auth.py           # 인증 헬퍼
│       ├── dependencies.py   # FastAPI 의존성
│       ├── rate_limit.py     # Rate limiting
│       ├── storage/          # 파일 스토리지
│       ├── ai/               # AI 통합
│       ├── logging.py        # 로깅
│       └── telemetry.py      # 텔레메트리
├── tests/
├── alembic/                  # DB 마이그레이션
├── scripts/
│   └── gen_openapi.py       # OpenAPI 스키마 생성
├── pyproject.toml
├── ruff.toml
└── mise.toml
```

### 주요 명령어

```bash
mise //apps/api:dev          # 개발 서버 (uvicorn --reload)
mise //apps/api:test         # pytest 실행
mise //apps/api:migrate      # Alembic 마이그레이션 실행
mise //apps/api:migrate:create  # 새 마이그레이션 생성
mise //apps/api:gen:openapi  # OpenAPI 스키마 생성
mise //apps/api:lint         # Ruff 린트
mise //apps/api:format       # Ruff 포맷
mise //apps/api:typecheck    # mypy 검사
```

## Worker (apps/worker)

### 핵심 기술

| 기술 | 용도 |
|------|------|
| FastAPI | HTTP 엔드포인트 (Cloud Tasks 수신) |
| Redis | 작업 큐 |
| asyncpg | DB 접근 |

### 디렉토리 구조

```
apps/worker/
├── src/
│   ├── main.py           # FastAPI 앱
│   ├── routers/
│   │   ├── health.py     # 헬스체크
│   │   └── tasks.py      # 태스크 엔드포인트
│   ├── jobs/             # 백그라운드 작업
│   └── lib/
│       ├── config.py
│       └── retry.py      # 재시도 로직
├── tests/
├── pyproject.toml
└── mise.toml
```

### 주요 명령어

```bash
mise //apps/worker:dev    # 워커 서버 (port 8001)
mise //apps/worker:test   # 테스트
mise //apps/worker:lint   # Ruff 린트
```

## 공유 패키지 (packages/)

### i18n (packages/i18n)

i18n 리소스의 Single Source of Truth.

```
packages/i18n/
├── src/
│   ├── en.arb           # 영어 (기본)
│   ├── ko.arb           # 한국어
│   └── ja.arb           # 일본어
├── scripts/
│   └── build.ts         # 빌드 스크립트
└── mise.toml
```

**빌드 결과:**
- `apps/web/src/config/messages/*.json` (Nested JSON)

### design-tokens (packages/design-tokens)

디자인 토큰의 Single Source of Truth.

```
packages/design-tokens/
├── src/
│   ├── tokens.ts        # 토큰 정의
│   └── __tests__/
├── scripts/
│   ├── build.ts
│   ├── build-css.ts
│   └── build-forui-theme.ts
└── mise.toml
```

**빌드 결과:**
- `apps/web/src/app/[locale]/tokens.css` (CSS Variables)

## 로컬 인프라 (docker-compose.yml)

| 서비스 | 포트 | 용도 |
|--------|------|------|
| PostgreSQL | 5432 | 메인 DB |
| Redis | 6379 | 캐시, 세션 |
| MinIO | 9000, 9001 | 로컬 오브젝트 스토리지 |

```bash
mise infra:up    # 시작
mise infra:down  # 중지
```

## 도구 버전 (mise.toml)

```toml
[tools]
node = "24"
python = "3.13"
"pipx:uv" = "latest"
"npm:pnpm" = "10"
```
