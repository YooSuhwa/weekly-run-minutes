# WeeklyRun AI Native Development Methodology

## Overview

WeeklyRun은 **AI Native 오케스트레이션 프로젝트**로,
직접적인 코딩 없이 명세(spec)와 규칙(rules)만으로 개발을 진행한다.

목표: **4시간 이상의 무인 자율 개발** 구현

## Core Engine

- **oh-my-claude-sisyphus**: 장시간 자율 개발을 위한 Claude Code 확장
- **Ralph Loop**: 테스트 통과까지 반복하는 TDD 루프

## Parallel Orchestration

### 개발 순서 원칙

**Backend 우선 개발** 방식을 따른다.
```
Backend 개발 → API 테스트 통과 → OpenAPI 문서 → Frontend 개발
```

### Git Worktree 기반 병렬 개발

**같은 레이어 내** 독립적인 태스크만 병렬 진행한다.
```
Phase 1 - Backend 단계:
 ├── worktree/api-team      ← Agent 1: 팀 관리 API
 ├── worktree/api-meeting   ← Agent 2: 회의 API
 └── worktree/api-stt       ← Agent 3: STT 서비스

    ↓ (모든 Backend 완료 + 테스트 통과 + OpenAPI 생성)

Phase 1 - Frontend 단계:
 ├── worktree/ui-team       ← Agent 1: 팀 설정 UI
 ├── worktree/ui-meeting    ← Agent 2: 회의 진행 UI
 └── worktree/ui-report     ← Agent 3: 회의록 UI
```

### 병렬 가능 조건

| 조건 | 병렬 가능 |
|------|----------|
| 같은 레이어 (Backend끼리, Frontend끼리) | ✅ |
| 서로 의존성 없는 독립 태스크 | ✅ |
| Backend ↔ Frontend 동시 | ❌ |
| 의존성 있는 태스크 (A 완료 후 B 가능) | ❌ |

### Worktree 규칙

1. **브랜치 네이밍**: `feature/{phase}-{task-name}`
2. **커밋 메시지**: 간단하게 (`feat: add team member API`)
3. **머지 전 검증**: 각 worktree에서 테스트 통과 필수

### 병렬 개발 예시
```bash
# Backend 단계 - Worktree 생성
git worktree add worktree/api-team feature/p1-api-team
git worktree add worktree/api-meeting feature/p1-api-meeting

# 각 Agent가 병렬로 작업
# Agent 1 (api-team): 팀 API 개발 → 테스트 → 커밋
# Agent 2 (api-meeting): 회의 API 개발 → 테스트 → 커밋

# Backend 완료 후 머지
git merge feature/p1-api-team
git merge feature/p1-api-meeting

# OpenAPI 생성 후 Frontend 단계로 전환
```

### 커밋 컨벤션
```
feat: 간단한 설명     # 새 기능
fix: 간단한 설명      # 버그 수정
test: 간단한 설명     # 테스트 추가
refactor: 간단한 설명 # 리팩토링
```

**예시:**
- `feat: add team member CRUD API`
- `feat: create meeting page UI`
- `fix: handle empty transcript`

## Documents

| 문서 | 생성 방식 | 역할 |
|------|----------|------|
| PRD | 수동 작성 | 제품 명세 (What) |
| PRD_MAP.md | 수동 작성 | PRD 읽는 법, 우선순위 가이드 |
| AI_EXECUTION_PRINCIPLES.md | 수동 작성 | AI 자율 판단 범위, 실행 원칙 |
| DEVELOPMENT_METHODOLOGY.md | 수동 작성 | 개발 방법론 (How) |
| CLAUDE.md | Claude Code 생성 | 프로젝트 컨텍스트 |
| TASKS.md | Claude Code 생성 | 개발 태스크 목록 |

## Startup Sequence

### Phase 0: 프로젝트 이해
```
docs/ 폴더의 다음 문서들을 순서대로 읽어줘:

1. PRD_MAP.md - PRD 읽는 법과 우선순위
2. AI_EXECUTION_PRINCIPLES.md - AI 실행 원칙
3. PRD_WeeklyRun.md - 제품 명세 전체
4. DEVELOPMENT_METHODOLOGY.md - 개발 방법론

모든 문서를 읽은 후:
- 불명확하거나 추가 정보가 필요한 부분이 있으면 질문해줘.
- 특히 P1-lite의 범위와 완료 조건을 정확히 이해했는지 확인해줘.
- 모든 궁금증이 해소되면 다음 단계로 넘어가자.
```

### Phase 1: 커스터마이징
```
.claude/ 폴더의 agents, rules, skills를 WeeklyRun에 맞게 커스터마이징해줘.

반영할 내용:
- 기술 스택: FastAPI + Next.js 16 + PostgreSQL + Redis
- TDD 필수, 80% 커버리지
- Phase 구조: P1-lite → P1-full → P2 (순서 필수)
- P1-lite 핵심: 업로드 기반 회의록 생성 파이프라인
- Confluence API v2 연동 (fallback 포함)
- Weeky 캐릭터: P1-lite에서는 상태 표시만 (thinking/done/sorry)

⚠️ 외부 템플릿을 새로 clone하지 마. 이미 선별된 구성이 프로젝트에 포함되어 있어.
```

### Phase 2: 문서 생성
```
다음 문서들을 생성해줘:

1. CLAUDE.md - 프로젝트 컨텍스트 요약
   - PRD_MAP.md와 AI_EXECUTION_PRINCIPLES.md의 핵심 내용 포함
   - P1-lite → P1-full 순서 강조

2. TASKS.md - PRD 기반 태스크 목록
   - P1-lite / P1-full / P2로 구분
   - 각 Phase 내에서 Backend → Frontend 순서
   - 병렬 가능 여부 표시
   - P1-lite의 완료 조건(DoD) 체크리스트 포함
```

### Phase 3: 개발 시작
```
P1-lite부터 시작해.

1. TASKS.md에서 P1-lite 태스크 확인
2. Backend 먼저 진행 (DB → Confluence → Recording → Minutes)
3. 각 태스크를 TDD로 진행 (테스트 먼저 → 구현 → 리팩토링)
4. 테스트가 통과할 때까지 Ralph Loop 실행
5. 커밋은 Conventional Commits (feat:, fix:, test:)

⚠️ P1-lite 완료 전에 P1-full 태스크를 시작하지 마.
```

## Quality Gates

| Gate | 조건 | 통과 기준 |
|------|------|----------|
| Test | 테스트 실행 | 100% 통과 |
| Coverage | 커버리지 측정 | 80% 이상 |
| Lint | 린트 검사 | 오류 0건 |
| Build | 빌드 실행 | 성공 |
