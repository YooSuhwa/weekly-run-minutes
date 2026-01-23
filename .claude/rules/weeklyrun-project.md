# WeeklyRun Project Rules

## Project Overview

WeeklyRun은 주간회의를 AI가 진행하고 자동으로 회의록을 생성하는 서비스입니다.

| 항목 | 값 |
|------|-----|
| 공식명 | WeeklyRun |
| 내부 애칭 | Weeky |
| 목표 | 4시간 이상 무인 자율 개발 |

---

## Phase Structure (Non-Negotiable Order)

```
P1-lite → P1-full → P2 → P3
```

| Phase | 목적 | 핵심 |
|-------|------|------|
| **P1-lite** | 파이프라인 검증 | 녹음 업로드 → STT → 회의록 생성 |
| **P1-full** | 회의 오케스트레이션 | 실시간 회의 진행 UX |
| **P2** | 확장 | 멀티 팀, 일반 회의, 잡담 필터링 |
| **P3** | 고도화 | 스트리밍 STT, 서버 배포 |

> ⚠️ **P1-lite 완료 전에 P1-full 작업을 시작하지 마세요.**

---

## Tech Stack (Confirmed)

### Backend (apps/api)
| 항목 | 기술 |
|------|------|
| Framework | FastAPI |
| ORM | SQLAlchemy (async) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Migration | Alembic |
| **STT** | **ElevenLabs API** |
| **AI 회의록** | **GPT (품질 우선)** |

### Frontend (apps/web)
| 항목 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + shadcn/ui |
| Styling | TailwindCSS v4 |
| State | **Jotai** (전체 시스템 고려 설계) |
| Data Fetching | TanStack Query |
| API Client | Orval |
| **MD Editor** | **TipTap** |

---

## P1-lite Scope

### Included
- 녹음 파일 업로드 (mp3, wav, webm, m4a, **최대 100MB**)
- ElevenLabs STT 처리
- 주간업무록 파싱 (Confluence MD → 구조화)
- GPT 회의록 생성 (주간업무록 참조)
- AI 교정 하이라이트 (**단순화 버전** - 목록만, 위치 매핑 없음)
- Markdown 다운로드
- Confluence 업로드
- Weeky 캐릭터 (**3개 에셋만**: thinking, done, sorry)

### Excluded from P1-lite
- 실시간 회의 진행 UI
- 질문 트리
- 키보드 단축키
- 상세 애니메이션
- 원본 듣기 기능 (타임스탬프 미지원)
- Action Items DB 저장 (마크다운 내 포함만)

---

## P1-full Additions (After P1-lite Complete)

- 실시간 회의 오케스트레이션
- 질문 트리 기반 진행
- 키보드 단축키 (Space, Enter, Esc, ←, →)
- **AI 교정 하이라이트 완전 버전** (position 포함, 인라인 하이라이트)
- Weeky 추가 에셋 (12개 전체)
- 브라우저 MediaRecorder 녹음

---

## Team Data (Seed)

```python
# DB Seed Data
TEAM = {
    "name": "제품기술팀",
    "members": [
        {"name": "이상윤", "order": 1},
        {"name": "선설희", "order": 2},
        {"name": "최보연", "order": 3},
        {"name": "유수화", "order": 4},
        {"name": "김정연", "order": 5},
    ]
}
```

---

## Weekly Report Parsing

### Structure
```
팀원명
├── 대분류 (AI, SDK, HWP, 기타)
│   ├── [상태] 소분류 - 단위업무 (목표일/완료일, 상태)
│   │   └── 상세내용 (일자, 상태)
```

### Status Tags
- `[완료]` - 완료된 업무
- `[진행]` - 진행 중인 업무
- `[예정]` - 예정된 업무

### Parsing Rules
- 팀원명: 줄 시작, 들여쓰기 없음
- 대분류: `- ` 시작, 상태 태그 없음
- 소분류: `- [상태]` 패턴
- 상세내용: 추가 들여쓰기

---

## Async Processing

| 작업 | 방식 |
|------|------|
| STT 처리 | FastAPI Background Tasks |
| 상태 확인 | Client Polling |
| 실패 처리 | 재시도 + 오프라인 저장 |

---

## Global State Design (Jotai)

전체 시스템(P1-lite ~ P2)을 고려한 atoms 구조:

```typescript
atoms/
├── team/           # 팀 정보 (P2 멀티팀 대비)
├── meeting/        # 회의 설정, 참석자, 진행 상태
├── recording/      # 녹음 상태, 파일, 진행률
├── stt/            # STT 처리 상태, 단계
├── minutes/        # 회의록 편집 상태, 저장 상태
├── confluence/     # Confluence 연동 상태
└── ui/             # 모달, 토스트, 로딩 상태
```

---

## File Size Limits

| 항목 | 제한 |
|------|------|
| 녹음 파일 | **100MB** (API 제한 고려) |
| 업로드 타임아웃 | 5분 |

---

## Error Handling

### Confluence Upload Failure
1. 자동 재시도 (최대 3회)
2. 최종 실패 시 로컬 저장
3. 나중에 재업로드 가능

### STT Processing Failure
1. 오류 코드 + Weeky sorry 표정
2. 재시도 버튼 제공

---

## Quality Gates

| Gate | 기준 |
|------|------|
| Test | 100% 통과 |
| Coverage | 80% 이상 |
| Lint | 오류 0건 |
| Build | 성공 |
