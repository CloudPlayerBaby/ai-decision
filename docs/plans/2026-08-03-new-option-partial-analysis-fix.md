# New Option Partial Analysis Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Ensure a newly added option is enriched, compared, persisted, and returned with the existing options after partial analysis.

**Architecture:** Keep the existing canvas-save and `POST /decisions/{decisionId}/partial-analysis` contracts. Detect newly added option IDs by comparing the latest canvas with the current analysis result, route those changes through a dedicated `ENRICH_OPTIONS` workflow node, merge enriched options into `DecisionState.options`, and then run the existing comparison and validation flow.

**Tech Stack:** Java 21, Spring Boot, LangGraph4j, Spring AI, MyBatis-Plus, JUnit 5.

---

### Task 1: Make the planner distinguish added options from edited options

**Files:**
- Modify: `backend/src/main/java/qg/po/midterm/service/impl/PartialAnalysisPlanner.java`
- Test: `backend/src/test/java/qg/po/midterm/service/impl/PartialAnalysisPlannerTest.java`

**Step 1: Write failing planner tests**

Add tests proving:

- An option present in the latest canvas but absent from `currentResult.options` starts at `ENRICH_OPTIONS`.
- An option present in both sources still starts at `COMPARE_OPTIONS`.
- A deleted option still starts at `COMPARE_OPTIONS`.
- Factor changes still take priority and start at `GENERATE_OPTIONS`.

Extend `Plan` so it carries the IDs that need enrichment, for example `optionIdsToEnrich`.

**Step 2: Run the focused test**

Run:

```powershell
./mvnw.cmd -Dtest=PartialAnalysisPlannerTest test
```

Expected: the new-option test fails because `ENRICH_OPTIONS` is not yet a supported start node.

**Step 3: Implement minimal detection**

Build a set of old option IDs from `currentResult.options`. For every changed canvas node of type `option`:

- ID absent from the old set: mark it for enrichment.
- ID present in the old set: treat it as an existing option change.

Route in this priority order:

```text
unknown/root change -> UNDERSTAND
factor change       -> GENERATE_OPTIONS
new option          -> ENRICH_OPTIONS
existing/deleted option -> COMPARE_OPTIONS
```

Do not infer behavior from ID prefixes.

**Step 4: Run the focused test again**

Expected: all `PartialAnalysisPlannerTest` cases pass.

### Task 2: Put enrichment targets into the partial-analysis state

**Files:**
- Modify: `backend/src/main/java/qg/po/midterm/service/impl/AnalysisTaskServiceImpl.java`
- Test: `backend/src/test/java/qg/po/midterm/service/impl/AnalysisTaskServiceImplTest.java` if present; otherwise create a focused state/planner integration test under the same package.

**Step 1: Write a failing integration-style unit test**

Build an old result containing options A and B and a latest canvas containing A, B, and new option C. Assert that the partial state contains:

- `options`: A, B, C
- `optionIdsToEnrich`: C only
- `startNode`: `ENRICH_OPTIONS`

**Step 2: Run the focused test and verify failure**

Expected: the target IDs are missing from `DecisionState`.

**Step 3: Implement state propagation**

After `buildCurrentState(...)`, add `partialPlan.optionIdsToEnrich()` to the state. Preserve the current canvas-first `buildOptions(...)` behavior so option C is already present before enrichment.

Update `markReusedPartialSteps(...)` so `ENRICH_OPTIONS` reuses `UNDERSTAND`, `EXTRACT_FACTORS`, and `GENERATE_OPTIONS`, but does not mark comparison as complete.

**Step 4: Run the focused test again**

Expected: PASS.

### Task 3: Add a node that enriches only new options

**Files:**
- Create: `backend/src/main/java/qg/po/midterm/workflow/node/OptionEnrichmentNode.java`
- Create: `backend/src/main/resources/prompts/option_enrichment.st`
- Test: `backend/src/test/java/qg/po/midterm/workflow/node/OptionEnrichmentNodeTest.java`

**Step 1: Write failing node tests**

Cover these behaviors:

- Only IDs in `optionIdsToEnrich` are sent for enrichment.
- Existing options A and B remain unchanged.
- Enriched C preserves its original ID and user-entered name/description.
- AI output containing an unknown ID is rejected.
- Missing required option fields triggers the existing structured-output repair/validation path.

**Step 2: Run the focused node test**

Expected: FAIL because the node does not exist.

**Step 3: Implement the enrichment node**

The prompt should receive decision context, factors, and only the target options. Require the model to return complete options with the exact supplied IDs and fields:

```text
id, name, description, pros, cons, risks, scores
```

Use `LlmRetryUtils.executeWithRepairResult(...)` and `AnalysisResultValidator.validateOptions(...)`. Merge returned options into the full state list by ID; never replace unrelated options.

Publish normal `RUNNING`, `SUCCEEDED`, and failure lifecycle events using a display name such as `完善新增方案`.

**Step 4: Run the focused node test again**

Expected: PASS.

### Task 4: Add the enrichment route to the workflow

**Files:**
- Modify: `backend/src/main/java/qg/po/midterm/workflow/DecisionWorkflow.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/utils/StepDisplayUtils.java`
- Modify: `backend/src/main/java/qg/po/midterm/workflow/listener/NodeExecutionEventListener.java` if node-to-business-step mapping is required
- Test: create or extend the workflow routing test under `backend/src/test/java/qg/po/midterm/workflow/`

**Step 1: Write failing routing tests**

Assert:

```text
START(ENRICH_OPTIONS) -> ENRICH_OPTIONS -> COMPARE_OPTIONS -> VALIDATE
```

Also assert existing full-analysis and factor-change routes remain unchanged.

**Step 2: Run the focused routing test**

Expected: FAIL because `ENRICH_OPTIONS` is absent from the graph.

**Step 3: Register the node and edges**

Add `ENRICH_OPTIONS` to the conditional START mapping and connect it to `COMPARE_OPTIONS`. Map its progress/events to the existing `GENERATE_OPTIONS` business step unless the API contract is intentionally expanded with a fifth visible step. Prefer reusing the existing step to avoid changing the public task-step contract.

**Step 4: Run routing tests again**

Expected: PASS.

### Task 5: Verify final result persistence and canvas merge

**Files:**
- Test: `backend/src/test/java/qg/po/midterm/workflow/listener/NodeExecutionEventListenerTest.java`
- Test: `backend/src/test/java/qg/po/midterm/service/impl/CanvasMergeServiceTest.java`

**Step 1: Add a regression test for the complete outcome**

Simulate a partial run starting from new option C and assert the persisted `AnalysisResultDto` contains A, B, and fully enriched C, while the recommendation may point to any valid option ID among A/B/C.

**Step 2: Add a canvas regression test**

Assert the result-to-canvas merge retains C and its enriched data rather than restoring the old A/B-only canvas.

**Step 3: Run the focused regression tests**

Expected: PASS after Tasks 1–4; if not, fix only the persistence/merge boundary without changing the API.

### Task 6: Run backend verification

**Files:**
- No production-file changes expected.

**Step 1: Run the partial-analysis and workflow test group**

```powershell
./mvnw.cmd -Dtest=PartialAnalysisPlannerTest,OptionEnrichmentNodeTest,CanvasMergeServiceTest test
```

Expected: PASS.

**Step 2: Run the full backend suite**

```powershell
./mvnw.cmd test
```

Expected: BUILD SUCCESS with no regressions in full analysis, factor edits, option edits, deletion, retry, or result persistence.

**Step 3: Manual acceptance check**

Starting from options A and B:

1. Add option C in the canvas and save.
2. Verify partial analysis starts without regenerating A/B.
3. Verify the completed result contains A/B/C.
4. Verify C has pros, cons, risks, and five scores.
5. Refresh the page and verify C remains.
6. Retry a deliberately failed enrichment step and verify the same task can complete.

No database migration or new public HTTP endpoint is required.
