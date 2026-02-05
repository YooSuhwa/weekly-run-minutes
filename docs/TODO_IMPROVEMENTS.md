# WeeklyRun 개선 사항 TODO

## Phase 진행 상태

| Phase | 상태 | 완료율 |
|-------|------|--------|
| P1-lite | ✅ 완료 | 100% |
| P1-full | ✅ 완료 | ~95% |
| P2 | ✅ 완료 | 100% |

---

## P2: 멀티 팀 시스템 + 일반회의 + 잡담 필터링

### 멀티 팀 시스템

- [x] 팀 선택 페이지 (`/teams`)
- [x] 팀 관리 페이지 (`/teams/manage`) - CRUD
- [x] 팀 비밀번호 인증
- [x] **팀 선택 후 해당 팀 데이터만 표시**
  - 대시보드에서 선택된 팀의 회의만 필터링됨 (team_id 쿼리 파라미터)
  - 팀원 관리가 선택된 팀 기준으로 동작
- [x] **팀별 Confluence 설정 적용**
  - Team 모델에 `confluence_base_url`, `confluence_space_key`, `confluence_username`, `confluence_token` 필드 추가
  - ConfluenceService에서 팀별 설정 사용 (`from_team` 클래스 메서드)
  - 설정 페이지에 Confluence 탭 추가 (팀별 자격증명 관리)
- [x] **팀원 관리 - 팀별 분리**
  - selectedTeamId atom 사용하여 팀별 분리

### 일반회의 모듈

- [x] 회의 타입 선택 (주간업무회의 / 일반회의)
- [x] 일반회의 회의록 생성 서비스 (`general_meeting.py`)
- [x] 아젠다 입력 기능 (선택)
  - Setup 페이지에 일반회의용 아젠다 입력 UI 추가
  - Meeting 모델의 `agenda_items` JSON 필드 활용
  - PUT /api/v1/meetings/{id} 엔드포인트로 아젠다 저장
- [x] **아젠다 기반 회의록 구조화**
  - GeneralMeetingService에서 아젠다 항목별 논의 내용 정리
  - 아젠다 없을 때 AI가 주제별로 분류

### 잡담 필터링

- [x] 잡담 필터링 서비스 (`chat_filter.py`)
- [x] 휴지통 패널 UI (`trash-panel.tsx`)
- [x] **휴지통 패널 실제 동작**
  - 회의록 편집 페이지에 TrashPanel 연동 완료
  - FilteredContent 저장/표시 동작
  - 필터링된 내용 복구/확인 기능
- [x] **팀별 필터링 설정**
  - Team 모델에 `filtering_enabled`, `filtering_confidence_threshold` 필드 추가
  - 설정 페이지에서 필터링 설정 저장 가능
- [ ] **팀별 필터링 패턴 학습** (P3로 연기)
  - FilterPattern 테이블 활용
  - 팀별 잡담 키워드 학습
- [x] **단어집(Vocabulary) 관리 UI**
  - 설정 페이지 용어집 탭 완료
  - 팀별 전문 용어 등록/수정/삭제
  - 일괄 가져오기/내보내기 기능
  - 회의록 생성 시 용어 교정에 활용

---

## 회의록 생성 및 편집 관련

- [ ] **1. 기본 정보 입력 칸 추가** (P3로 연기)
  - 회의 날짜, 시간, 장소, 논의 주제 등
  - 필수 아님 (선택 입력)
  - 위치: 회의 생성 페이지

- [ ] **2. 제목 만드는 규칙 정의** (P3로 연기)
  - 현재: `{날짜} {회의 제목} 회의록`
  - 개선: 커스터마이징 가능하게 또는 규칙 문서화

- [ ] **3. 회의록 프롬프트 수정 기능** (P3로 연기)
  - 현재: 코드에 하드코딩 (`general_meeting.py`, `minutes_generator.py`)
  - 개선 방향:
    - 줄나눔(---) 삽입 옵션
    - 섹션 구조 커스터마이징
    - 설정 UI 또는 관리자 페이지에서 조정

- [x] **4. Confluence 게시 후 UI 상태 동기화**
  - ~~문제: 게시 성공해도 프론트엔드 버튼이 '게시 완료'로 안 바뀌는 경우~~
  - 해결: 게시 후 상태 refetch 및 UI 동기화

- [ ] **5. AI 교정 목록 편집 기능** (P3로 연기)
  - 현재: 보기만 가능
  - 개선: 클릭 시 해당 위치로 이동 및 수정/반영 기능

- [x] **6. 게시 완료 건 수정 불가**
  - 게시 완료(published) 상태면 에디터 읽기 전용으로 전환
  - 저장 버튼 비활성화

---

## UI/UX Blueprint 반영 항목

> Blueprint 문서(WeeklyRun_UI_UX_Blueprint.pdf v0.6) 기반 개선 사항

### 완료됨 (2026-02-03)

- [x] **Dashboard Weeky 인사 메시지**
  - Weeky greeting + "안녕하세요! 이번 주 잘 지내고 있나요?" 추가
- [x] **팀 멤버 D&D 순서 변경**
  - @dnd-kit 사용하여 드래그 앤 드롭으로 발표 순서 변경
- [x] **Confluence 게시 축하 화면**
  - canvas-confetti 사용한 컨페티 효과
  - Weeky "BYE!" + 축하 모달

### P1-full 반영 예정

- [ ] **Audio Visualizer (Wavesurfer.js)**
  - Live Meeting 모드에서 오디오 파형 시각화
  - Blueprint 페이지 9 참조
- [ ] **키보드 단축키 시각적 가이드**
  - [Space] 다음 항목, [Enter] 발표 완료, [Esc] 종료 표시
  - Blueprint 페이지 9 참조
- [ ] **Play Audio 버튼**
  - 회의록 에디터에서 원본 오디오 재생
  - Blueprint 페이지 12 참조 (타임스탬프 지원 시)

### P2 반영 예정

- [ ] **잡담 필터링 드래그 UX**
  - 현재: 버튼 클릭으로 복원/확인
  - Blueprint: 드래그하여 회의록 ↔ 휴지통 이동
  - Blueprint 페이지 14 참조
- [ ] **"팀 필터링 패턴 학습됨" 배지**
  - AI가 팀별 잡담 패턴 학습 후 표시
  - FilterPattern 테이블 활용
  - Blueprint 페이지 14 참조

### P3 반영 예정

- [ ] **Action Items 테이블 형태**
  - 현재: 마크다운 내 체크박스
  - Blueprint: 테이블 (Task, Assignee, Due Date)
  - Blueprint 페이지 12, 13 참조

- [ ] **신뢰도 히트맵 (STT Confidence Heatmap)**
  - STT 변환 결과의 신뢰도를 시각적으로 표시
  - 텍스트 배경색 그라데이션: 높음(투명) → 낮음(빨간색)
  - 호버 시 툴팁으로 정확한 신뢰도 표시
  - 낮은 신뢰도 영역 클릭 시 해당 부분으로 스크롤
  - 히트맵 표시/숨김 토글 버튼
  - 관련 파일: `minutes-editor.tsx`, `stt_service.py`

- [ ] **클릭 투 플레이 (Click-to-Play Audio)**
  - 회의록의 특정 텍스트 클릭 시 해당 부분 원본 오디오 재생
  - Word-level timestamps 매핑
  - 미니 오디오 플레이어 컴포넌트
  - 재생 속도 조절 (0.5x, 1x, 1.5x, 2x)
  - 재생 중인 구간 하이라이트
  - 키보드 단축키 지원 (Space: 재생/일시정지)
  - 관련 파일: `minutes-editor.tsx`, `audio-player.tsx` (신규)

---

## P1-full: 실시간 회의 오케스트레이션 (~95% 완료)

> P1-full 핵심 기능 구현 완료. 일부 개선 사항 남음.

- [x] 실시간 회의 진행 UI (2분할 화면) - `/meetings/[id]/live`
- [x] 질문 트리 기반 진행 - `question-tree-panel.tsx`
- [x] 키보드 단축키 (Space, Enter, Esc, ←, →)
- [x] 브라우저 MediaRecorder 녹음
- [x] 녹음 중단/재시작/복구 처리
- [x] Weeky 상태/표정 연동 (12개 전체 에셋)
- [ ] AI 교정 하이라이트 완전 버전 (position 포함, 인라인 하이라이트) - P3로 연기

---

## 기술 부채 및 품질 개선 (P3)

- [ ] **테스트 커버리지 80% 달성**
  - 현재 커버리지 확인 필요
  - 핵심 서비스 단위 테스트 보강

- [ ] **에러 핸들링 개선**
  - API 오류 시 사용자 친화적 메시지
  - 재시도 로직 일관성

- [ ] **로딩 상태 UI 개선**
  - Skeleton UI 적용
  - 진행 상태 더 명확하게

---

## 완료된 항목

### 2026-02-03 (P2 마무리 - 버그 수정 2)
- [x] 비밀번호 있는 팀 건너뛰기 불가 처리
  - TeamResponse에 has_password 필드 추가
  - 비밀번호 없는 팀은 바로 입장, 있는 팀만 비밀번호 다이얼로그 표시
  - 건너뛰기 버튼 제거, 취소 버튼으로 변경
- [x] 팀원 관리 페이지에서 선택된 팀의 팀원만 표시 (selectedTeamIdAtom 사용)
- [x] 팀 카드에 자물쇠 아이콘 조건부 표시 (비밀번호 유무에 따라)

### 2026-02-03 (P2 마무리 - UI 개선)
- [x] 헤더에 팀 선택 드롭다운 추가 (현재 팀 표시 + 팀 변경 링크)
- [x] 설정 페이지에 팀 관리 탭 추가
  - 현재 팀 정보 표시
  - 비밀번호 변경/설정 기능
  - 팀 삭제 기능 (확인 다이얼로그)
  - 새 팀 만들기 기능
  - 전체 팀 목록 표시
- [x] DropdownMenu UI 컴포넌트 추가 (@radix-ui/react-dropdown-menu)

### 2026-02-03 (P2 마무리 - 버그 수정)
- [x] 설정 페이지 팀 atom 버그 수정 (currentTeamAtom → selectedTeamIdAtom)
- [x] 대시보드 팀 필터링 적용 (selectedTeamId로 회의 목록 필터링)
- [x] DB 마이그레이션 실행 (filtering_enabled, filtering_confidence_threshold 필드)

### 2026-02-03 (P2 마무리)
- [x] 팀별 Confluence 설정 (Team 모델 + ConfluenceService 연동)
- [x] 설정 페이지 Confluence 탭 추가
- [x] 설정 페이지 필터링 설정 저장 연동
- [x] 일반회의 아젠다 입력 UI (Setup 페이지)
- [x] Meeting PUT 엔드포인트 추가 (아젠다 저장용)
- [x] OpenAPI 스키마 재생성 및 API 클라이언트 갱신

### 2026-02-03 (초기)
- [x] STT 파일 파라미터 수정 (`audio` → `file`)
- [x] OpenAI API `max_tokens` → `max_completion_tokens` 변경
- [x] 회의록 생성 후 자동 generate-minutes API 호출
- [x] TipTap 에디터 마크다운 렌더링 (marked + turndown)
- [x] 에디터 CSS 스타일 개선 (헤딩, 리스트, 불릿)
- [x] 불릿 포인트 중복 수정 (`list-none` 추가)
- [x] Confluence SPACE_ID 숫자 타입 수정
- [x] Confluence 마크다운 → HTML 변환 개선 (markdown 라이브러리 사용)
- [x] 회의록 제목 날짜 중복 제거
- [x] **4번**: Confluence 게시 후 UI 상태 동기화 (meeting 데이터 refetch)
- [x] **6번**: 게시 완료 건 수정 불가 (에디터 읽기 전용, 저장 버튼 비활성화)
- [x] 읽기 전용 모드에서 내용 표시 안되는 버그 수정

---

## P3: 신뢰도 히트맵 & 클릭 투 플레이 상세 가이드

> UI/UX 전략 문서(WeeklyRun_UX_Strategy.pdf) 기반 P3 단계 구현 가이드

### 1. 신뢰도 히트맵 (STT Confidence Heatmap)

#### 개요
STT 변환 결과의 신뢰도를 시각적으로 표시하여 사용자가 교정이 필요한 부분을 쉽게 식별할 수 있도록 합니다.

#### 시각적 표현 (OKLCH 컬러 시스템)
```css
/* 신뢰도별 배경색 */
--confidence-high: transparent;                    /* 90%+ */
--confidence-medium: oklch(0.95 0.1 90);          /* 70-90% - 연한 노란색 */
--confidence-low: oklch(0.9 0.15 60);             /* 50-70% - 연한 주황색 */
--confidence-very-low: oklch(0.9 0.15 30);        /* <50% - 연한 빨간색 */
```

#### 백엔드 요구사항
- ElevenLabs API 응답에서 word-level confidence score 추출
- STT 결과에 단어별 `confidence` 필드 포함
- Minutes 저장 시 confidence 메타데이터 함께 저장

#### 프론트엔드 구현
```typescript
// components/confidence-heatmap.tsx
interface ConfidenceWord {
  text: string;
  confidence: number;  // 0-1
  startOffset: number;
  endOffset: number;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'transparent';
  if (confidence >= 0.7) return 'oklch(0.95 0.1 90 / 0.5)';
  if (confidence >= 0.5) return 'oklch(0.9 0.15 60 / 0.5)';
  return 'oklch(0.9 0.15 30 / 0.5)';
}
```

### 2. 클릭 투 플레이 (Click-to-Play Audio)

#### 개요
회의록의 특정 텍스트를 클릭하면 해당 부분의 원본 오디오를 재생할 수 있는 기능입니다.

#### 타임스탬프 매핑
```typescript
interface TimestampedWord {
  text: string;
  startTime: number;  // 초 단위
  endTime: number;
}

// 클릭한 텍스트의 시작/종료 시간 찾기
function findTimestampForText(
  clickOffset: number,
  words: TimestampedWord[]
): { start: number; end: number } | null {
  // ...
}
```

#### 미니 오디오 플레이어 컴포넌트
```typescript
// components/ui/audio-player.tsx
interface AudioPlayerProps {
  src: string;
  startTime?: number;
  endTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
}

// 기능:
// - 구간 재생 (startTime ~ endTime)
// - 재생 속도 조절 (0.5x, 1x, 1.5x, 2x)
// - 키보드 단축키 (Space: 재생/일시정지)
```

#### 백엔드 요구사항
- 오디오 파일 스트리밍 API (HTTP Range 요청 지원)
- GET /api/v1/recordings/{id}/stream
- 타임스탬프 메타데이터 조회 API
- GET /api/v1/recordings/{id}/timestamps

### 3. 구현 우선순위

| 기능 | 복잡도 | 의존성 | 우선순위 |
|------|--------|--------|----------|
| 신뢰도 히트맵 | 중간 | STT API confidence 필드 | P3-1 |
| 클릭 투 플레이 | 높음 | 스트리밍 STT, 타임스탬프 | P3-2 |

### 4. 참고 리소스

- UI/UX 전략 문서: `docs/WeeklyRun_UX_Strategy.pdf`
- 디자인 토큰: `packages/design-tokens/src/tokens.ts`
- ElevenLabs API: word-level timestamps (`include_timestamps=true`)
