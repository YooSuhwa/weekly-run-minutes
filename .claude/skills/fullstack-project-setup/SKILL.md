---
name: fullstack-project-setup
description: Production-ready fullstack monorepo 프로젝트를 한 번에 셋업하는 스킬. Next.js 16 + FastAPI + Worker + mise 기반 모노레포 템플릿 생성. "풀스택 프로젝트 만들어줘", "새 프로젝트 셋업", "Next.js + FastAPI 프로젝트", "fullstack starter", "monorepo 생성" 요청 시 사용.
---

# Fullstack Project Setup

Next.js 16 + FastAPI + Worker + mise 기반 production-ready 모노레포를 원클릭으로 생성.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TailwindCSS v4, TanStack Query, Jotai, Orval |
| Backend | FastAPI, SQLAlchemy (async), Alembic, PostgreSQL 16, Redis 7 |
| Worker | FastAPI + background tasks |
| Tool | mise (Node 24, Python 3.13, pnpm 10, uv) |

## 프로젝트 생성 워크플로우

### Step 1: 사용자 입력 수집

```
필수: PROJECT_NAME (프로젝트 디렉토리명)
선택: 커스텀 포트, 앱 이름 등 (기본값 사용 가능)
```

### Step 2: 셋업 스크립트 실행

```bash
python scripts/setup_project.py <project-name>
```

스크립트가 자동으로:
1. 디렉토리 구조 생성
2. 루트 설정 파일 생성 (mise.toml, biome.json, docker-compose.yml 등)
3. FastAPI backend (apps/api) 생성
4. Next.js frontend (apps/web) 생성
5. Worker service (apps/worker) 생성
6. 공유 패키지 (packages/i18n, packages/design-tokens) 생성
7. AI agent rules 생성

### Step 3: 의존성 설치 및 실행

```bash
cd <project-name>

# 1. mise 설치 (없는 경우)
curl https://mise.run | sh

# 2. 런타임 설치
mise install

# 3. 로컬 인프라 시작
mise infra:up

# 4. 의존성 설치
cd apps/web && pnpm install
cd ../api && uv sync
cd ../worker && uv sync

# 5. 개발 서버 시작
mise dev
```

## 생성되는 프로젝트 구조

```
project-name/
├── apps/
│   ├── api/                 # FastAPI backend
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── routers/
│   │   │   ├── lib/
│   │   │   └── common/
│   │   ├── tests/
│   │   ├── alembic/
│   │   ├── pyproject.toml
│   │   └── mise.toml
│   ├── web/                 # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   ├── hooks/
│   │   │   └── stores/
│   │   ├── package.json
│   │   └── mise.toml
│   └── worker/              # Background worker
│       ├── src/
│       ├── pyproject.toml
│       └── mise.toml
├── packages/
│   ├── i18n/                # i18n (Single Source of Truth)
│   └── design-tokens/       # Design tokens (Single Source of Truth)
├── .agent/rules/            # AI agent guidelines
├── mise.toml                # Root mise config
├── docker-compose.yml       # Local infrastructure
└── biome.json               # Linter/Formatter config
```

## mise 명령어

| Command | Description |
|---------|-------------|
| `mise dev` | 모든 서비스 시작 |
| `mise lint` | 모든 앱 린트 |
| `mise format` | 모든 앱 포맷 |
| `mise test` | 모든 테스트 실행 |
| `mise infra:up` | PostgreSQL, Redis, MinIO 시작 |
| `mise infra:down` | 인프라 중지 |

### 앱별 명령어

```bash
mise //apps/api:dev      # API 서버 (port 8000)
mise //apps/web:dev      # Web 서버 (port 3000)
mise //apps/worker:dev   # Worker (port 8001)
mise //apps/api:migrate  # DB 마이그레이션
mise //apps/web:gen:api  # API 클라이언트 생성
```

## Resources

- **scripts/setup_project.py**: 프로젝트 생성 스크립트
- **templates/**: 각 앱별 템플릿 파일
- **references/tech-stack.md**: 기술 스택 상세 설명

## 참고

- 원본: https://github.com/first-fluke/fullstack-starter
- mobile(Flutter)과 infra(Terraform)는 제외됨
- GCP 배포 필요시 원본 저장소 참조
