# Agent Orchestration

## Available Agents

Located in `~/.claude/agents/`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code review | After writing code |
| security-reviewer | Security analysis | Before commits |
| build-error-resolver | Fix build errors | When build fails |
| e2e-runner | E2E testing | Critical user flows |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation | Updating docs |

## Immediate Agent Usage

No user prompt needed:
1. Complex feature requests - Use **planner** agent
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix or new feature - Use **tdd-guide** agent
4. Architectural decision - Use **architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Launch 3 agents in parallel:
1. Agent 1: Security analysis of auth.ts
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utils.ts

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker

---

## WeeklyRun Project Specific

### Phase-Based Agent Usage

| Phase | Primary Agents | Focus |
|-------|---------------|-------|
| P1-lite | tdd-guide, code-reviewer | 파이프라인 검증 |
| P1-full | planner, architect | 오케스트레이션 UX |
| P2 | security-reviewer | 멀티팀 보안 |

### Critical Paths (Must Use Agents)

1. **STT 파이프라인**
   - planner: ElevenLabs 연동 설계
   - tdd-guide: STT 서비스 TDD
   - code-reviewer: 에러 핸들링 검증

2. **주간업무록 파싱**
   - tdd-guide: 파싱 로직 TDD
   - code-reviewer: 엣지 케이스 검증

3. **회의록 생성**
   - planner: GPT 프롬프트 설계
   - security-reviewer: API 키 관리 확인

4. **Confluence 연동**
   - tdd-guide: API v2 연동 TDD
   - code-reviewer: 재시도 로직 검증

### Backend vs Frontend Order

```
Backend 완료 → OpenAPI 생성 → Frontend 시작
```

Backend 에이전트 작업 완료 후에만 Frontend 에이전트 작업 시작
