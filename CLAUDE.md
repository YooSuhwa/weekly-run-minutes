# WeeklyRun - AI Native Development Project

## Project Identity

| 항목 | 값 |
|------|-----|
| 공식명 | **WeeklyRun** |
| 내부 애칭 | **Weeky** |
| 한 줄 요약 | 주간회의를 Weeky가 진행하고, 자동으로 회의록을 생성하는 서비스 |
| 개발 목표 | **4시간 이상 무인 자율 개발** |

---

## Phase Structure (CRITICAL - Must Follow Order)

```
P1-lite → P1-full → P2 → P3
```

| Phase | 목적 | 완료 조건 |
|-------|------|----------|
| **P1-lite** | 파이프라인 검증 | 업로드 → STT → 회의록 → Confluence |
| **P1-full** | 오케스트레이션 UX | 실시간 회의 진행 |
| **P2** | 확장 | 멀티 팀, 잡담 필터링 |
| **P3** | 고도화 | 스트리밍 STT, 서버 배포 |

> ⚠️ **CRITICAL:** P1-lite 완료 전에 P1-full 작업 시작 금지

---

## Tech Stack

### Backend (apps/api)
- FastAPI + SQLAlchemy (async) + PostgreSQL + Redis
- **STT:** ElevenLabs API
- **AI 회의록:** GPT (품질 우선)
- **비동기:** FastAPI Background Tasks + Polling

### Frontend (apps/web)
- Next.js 16 + React 19 + shadcn/ui + TailwindCSS v4
- **State:** Jotai (전체 시스템 고려 설계)
- **MD Editor:** TipTap
- **API Client:** Orval (OpenAPI 기반)

---

## Development Order

```
Backend 개발 → API 테스트 통과 → OpenAPI 생성 → Frontend 개발
```

---

## Autonomous Decision Scope

### Allowed (자율 결정 가능)
- Task 순서 및 세분화
- 임시 UI 간소화
- 내부 API 형태 (인터페이스 안정 유지 조건)
- 초기 단계 외부 서비스 모킹

### NOT Allowed (변경 금지)
- 주간업무록 파싱 로직
- STT → 주간업무록 매칭 규칙
- Meeting/Recording 상태 전이 규칙
- Phase 순서: P1-lite → P1-full → P2

---

## Quality Gates

| Gate | 기준 |
|------|------|
| Test | 100% 통과 |
| Coverage | **80% 이상** |
| Lint | 오류 0건 |
| Build | 성공 |

---

## P1-lite Scope

### Included
- 녹음 파일 업로드 (mp3, wav, webm, m4a, **최대 100MB**)
- ElevenLabs STT → GPT 회의록 생성
- 주간업무록 참조 용어 교정
- AI 교정 하이라이트 (**단순화** - 목록만)
- MD 다운로드 + Confluence 업로드
- Weeky 에셋 **3개**: thinking, done, sorry

### Excluded
- 실시간 회의, 질문 트리, 키보드 단축키
- 원본 듣기 (타임스탬프 미지원)
- AI 교정 위치 매핑 (P1-full로 연기)

---

## Team Data

| 항목 | 값 |
|------|-----|
| 팀명 | 제품기술팀 |
| 팀원 | 이상윤, 선설희, 최보연, 유수화, 김정연 |

---

## Key Documents

| 문서 | 위치 | 용도 |
|------|------|------|
| PRD | `docs/PRD_WeeklyRun.md` | 제품 명세 전체 |
| PRD Map | `docs/PRD_MAP.md` | PRD 읽기 가이드 |
| AI 원칙 | `docs/AI_EXECUTION_PRINCIPLES.md` | AI 실행 규칙 |
| 개발 방법론 | `docs/DEVELOPMENT_METHODOLOGY.md` | 개발 프로세스 |
| 인터뷰 결과 | `docs/PRD_INTERVIEW_RESULTS.md` | PRD 수정 사항 |
| 주간업무록 샘플 | `docs/samples/weekly-report-sample.md` | 파싱 참조 |

---

## Failure Handling

- 실패는 허용됨
- **Silent 실패는 금지**
- 모든 실패: 명확한 오류 코드 + 재시도 가능

---

## 참조

상세 규칙: `.claude/rules/weeklyrun-project.md`
