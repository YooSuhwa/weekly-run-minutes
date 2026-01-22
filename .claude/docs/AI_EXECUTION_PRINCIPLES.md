# AI Execution Principles for WeeklyRun

본 문서는 WeeklyRun 프로젝트를 수행하는 AI 에이전트(Claude Code)를 위한
실행 원칙 선언문이다.

본 프로젝트의 목표는 단순한 기능 구현이 아니라,
**장시간 인간 개입 없이 AI가 자율적으로 계획·구현·검증을 완주할 수 있는지**
를 검증하는 데 있다.

---

## 1. Global Goal

- Read and understand:
  - WeeklyRun PRD (all sections)
  - DEVELOPMENT_METHODOLOGY.md
  - PRD Map
  - AI Execution Principles (this document)
- Create implementation tasks by yourself.
- Implement P1 and P2 in one session.
- **You MUST complete P1-lite before starting P1-full.**

---

## 2. Phase Definitions (Non-Negotiable)

### P1-lite
- Purpose:
  - Validate the end-to-end minutes generation pipeline using upload mode.
- Required outcome:
  - Upload audio → STT → weekly report reference → minutes generation → save/download.
- UI requirement:
  - Minimal UI is acceptable.
  - Visual polish is NOT required.

### P1-full
- Purpose:
  - Implement real-time meeting orchestration UX.
- Required outcome:
  - Question tree based on weekly reports.
  - Controlled meeting flow (speaker, item, progression).
- Constraint:
  - Must reuse the exact same minutes generation pipeline from P1-lite.

---

## 3. Autonomous Decision Allowed

You MAY autonomously decide on:
- Task granularity and ordering.
- Temporary UI simplifications or placeholders.
- Internal API shapes, as long as interfaces remain stable.
- Mocking or abstracting external services in early stages.

---

## 4. Autonomous Decision NOT Allowed

You MUST NOT autonomously skip or alter:
- Weekly report parsing logic.
- STT → weekly report matching rules.
- Meeting and Recording state transition rules.
- The order: P1-lite → P1-full → P2.

---

## 5. Quality and Completion Rules

- Follow TDD as defined in DEVELOPMENT_METHODOLOGY.md.
- All completed features MUST satisfy:
  - Tests written
  - Tests passing
  - Coverage ≥ 80%
  - Lint and build errors = 0
- Prefer:
  - Correctness over UI polish
  - Stability over feature breadth

---

## 6. Failure Handling Principle

- Failures are acceptable.
- Silent failures are NOT acceptable.
- Every failure must:
  - Produce a clear error code
  - Allow retry or recovery
