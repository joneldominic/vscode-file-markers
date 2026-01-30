---
description: Audit documentation against codebase, identify discrepancies, generate update plan
---

# Audit Documentation

You are tasked with auditing documentation against the current state of the codebase to identify discrepancies and generate an implementation plan for updating stale or missing documentation.

## Command Usage

```bash
/audit_docs                                              # Prompts for scope
/audit_docs --file=docs/patterns/repository-pattern.md   # Specific doc file
/audit_docs --layer=domain                               # By layer (domain, application, infrastructure, interface, libs)
/audit_docs --module=user                                # By module (user, project, task, core)
/audit_docs --all                                        # Full documentation audit (phased)
```

## Scope Definitions

### By File (`--file=<path>`)
Audit a specific documentation file against the codebase.

### By Layer (`--layer=<layer>`)
Valid layers: `domain`, `application`, `infrastructure`, `interface`, `libs`

| Layer | Documentation Files |
|-------|---------------------|
| domain | `docs/architecture/core-domain-classes.md`, `src/core/domain/README.md` |
| application | `docs/architecture/core-application-layer.md`, `src/core/application/README.md`, `docs/patterns/cqrs-pattern.md`, `docs/patterns/cross-module-ports.md` |
| infrastructure | `docs/architecture/core-infrastructure-layer.md`, `src/core/infrastructure/README.md`, `docs/patterns/repository-pattern.md`, `docs/patterns/unit-of-work.md` |
| interface | `docs/architecture/core-interface-layer.md`, `src/core/interface/README.md`, `docs/patterns/controller-organization.md`, `docs/patterns/error-mapping.md` |
| libs | `docs/architecture/core-libraries.md`, `src/core/libs/README.md` |

### By Module (`--module=<module>`)
Valid modules: `user`, `project`, `task`, `core`

Audits module-specific implementations against documented patterns.

### Full Audit (`--all`)
Audits all documentation in phases:
1. **Phase 1**: `CLAUDE.md` (root project documentation)
2. **Phase 2**: `docs/architecture/*.md` (architecture docs)
3. **Phase 3**: `docs/patterns/*.md` (pattern docs)
4. **Phase 4**: `src/core/*/README.md` (in-code READMEs)
5. **Phase 5**: Module-specific validation

## Process Steps

### Step 1: Parse Arguments and Determine Scope

1. **If no arguments provided**, respond with:

   ```
   I'll help you audit documentation against the codebase. Please specify the scope:

   **Options:**
   - `--file=<path>` - Audit a specific doc file (e.g., `--file=docs/patterns/repository-pattern.md`)
   - `--layer=<layer>` - Audit by layer: domain, application, infrastructure, interface, libs
   - `--module=<module>` - Audit by module: user, project, task, core
   - `--all` - Full documentation audit (runs in phases)

   Which scope would you like to audit?
   ```

   Then wait for user input.

2. **If arguments provided**, proceed to Step 2.

### Step 2: Read Target Documentation

1. **Read all documentation files in scope FULLY**:
   - Use the Read tool WITHOUT limit/offset parameters
   - Read files yourself in the main context before spawning sub-tasks

2. **For each doc file, extract**:
   - Key concepts and patterns described
   - Code examples and their file references
   - File paths and naming conventions mentioned
   - Architecture decisions documented

### Step 3: Research Current Codebase State

Spawn parallel sub-agent tasks to gather current codebase state:

1. **Use codebase-locator agents** to find:
   - Files matching documented patterns
   - Actual directory structure vs documented structure
   - Real naming conventions in use

2. **Use codebase-analyzer agents** to understand:
   - How current implementations work
   - Patterns actually in use
   - Differences from documented approaches

3. **Use codebase-pattern-finder agents** to find:
   - Examples of patterns mentioned in docs
   - Usage patterns that may have evolved
   - New patterns not yet documented

**Important**: Instruct agents to focus on READ-ONLY operations. They are gathering facts, not making judgments.

### Step 4: Compare and Identify Discrepancies

Wait for all sub-agents to complete, then analyze:

1. **Missing Documentation**:
   - New patterns in code not documented
   - New files/directories not reflected in structure docs
   - New conventions not captured

2. **Stale Documentation**:
   - Documented patterns that have changed
   - File paths that no longer exist
   - Naming conventions that have evolved
   - Code examples that don't match current implementation

3. **Incorrect Documentation**:
   - Statements that contradict current code
   - Architecture descriptions that don't match reality
   - Guidelines that are no longer followed

4. **Risky Areas** (prioritize these):
   - Security-related documentation
   - Error handling patterns
   - Data validation approaches
   - Cross-module communication

### Step 5: Generate Implementation Plan

Create a plan document at:
`thoughts/shared/plans/YYYY-MM-DD-audit-docs-<scope-description>.md`

**Filename examples**:
- `2025-01-16-audit-docs-repository-pattern.md`
- `2025-01-16-audit-docs-domain-layer.md`
- `2025-01-16-audit-docs-user-module.md`
- `2025-01-16-audit-docs-full.md`

**Use this template**:

````markdown
# Documentation Update Plan: [Scope Description]

## Overview

This plan addresses documentation discrepancies identified by auditing [scope] against the current codebase state.

**Audit Date**: [YYYY-MM-DD]
**Scope**: [file/layer/module/all]
**Git Commit**: [current commit hash]
**Branch**: [current branch]

## Executive Summary

- **Total discrepancies found**: [N]
- **Critical (risky areas)**: [N]
- **Major (incorrect/stale)**: [N]
- **Minor (missing/outdated)**: [N]

## Discrepancies by Document

### [Document 1 Path]

| # | Type | Description | Current State | Expected State |
|---|------|-------------|---------------|----------------|
| 1 | Stale | [brief description] | [what code shows] | [what doc says] |
| 2 | Missing | [brief description] | [pattern in code] | [not documented] |

---

## Phase 1: Update [Document 1]

### Overview

[What this phase accomplishes]

### Changes Required

#### Discrepancy 1: [Title]

**File**: `[doc path]`
**Type**: [Stale/Missing/Incorrect]
**Priority**: [Critical/Major/Minor]

**Current documentation states**:
> [Quote from current doc]

**Actual codebase state**:
- [Finding with file:line reference]
- [Another finding]

**Proposed change**:
```markdown
[New/updated documentation content]
```

#### Discrepancy 2: [Title]

[Same structure...]

### Success Criteria

- [ ] Documentation accurately reflects `[file:line]` implementation
- [ ] Code examples compile and match current patterns
- [ ] File paths reference existing files
- [ ] No contradictions with other documentation

---

## Phase 2: Update [Document 2]

[Same structure as Phase 1...]

---

## Cross-Document Consistency Check

After all phases, verify:
- [ ] No contradictions between updated documents
- [ ] CLAUDE.md reflects any new patterns added to other docs
- [ ] Naming conventions consistent across all docs

## References

- Codebase files analyzed: [list key files]
- Related documentation: [list related docs]
````

### Step 6: Present Summary

After generating the plan:

```
I've completed the documentation audit for [scope].

**Summary**:
- Total discrepancies: [N]
- Critical: [N] | Major: [N] | Minor: [N]

**Plan created**: `thoughts/shared/plans/YYYY-MM-DD-audit-docs-[scope].md`

**Key findings**:
1. [Most important discrepancy]
2. [Second most important]
3. [Third most important]

To implement these updates, run:
`/implement_plan thoughts/shared/plans/YYYY-MM-DD-audit-docs-[scope].md`

Would you like me to elaborate on any specific discrepancy?
```

## Important Guidelines

### Focus Areas

1. **Key Concepts** - Document high-level patterns and architectural decisions
2. **Risky Areas** - Prioritize security, error handling, data validation
3. **Structural Accuracy** - File paths, directory structure, naming conventions
4. **Pattern Evolution** - How patterns have changed since documentation was written

### What NOT to Focus On

1. **Detailed code samples** - Keep examples minimal and conceptual
2. **Line-by-line accuracy** - Focus on patterns, not exact implementation
3. **Stylistic preferences** - Focus on factual accuracy, not writing style
4. **Cosmetic issues** - Typos and formatting unless they cause confusion

### Plan Compatibility

The generated plan must be compatible with `/implement_plan`:
- Clear phase structure
- Specific file paths for changes
- Concrete proposed changes (not vague suggestions)
- Measurable success criteria
- Each phase should be independently executable

### Parallel Research

When auditing multiple documents:
- Spawn separate sub-agents for each document's codebase research
- Run agents in parallel for efficiency
- Wait for ALL agents before synthesizing findings
- Cross-reference findings to identify patterns

### Handling Large Scopes

For `--all` or large layer/module scopes:
- Process in phases as defined in scope definitions
- Generate one comprehensive plan with multiple phases
- Each phase covers one document
- Order phases by documentation type priority:
  1. CLAUDE.md (most visible)
  2. Architecture docs (foundational)
  3. Pattern docs (implementation guidance)
  4. In-code READMEs (developer reference)

## Example Interaction

```
User: /audit_docs --layer=domain

Assistant: I will audit the domain layer documentation against the codebase.

[Reads docs/architecture/core-domain-classes.md and src/core/domain/README.md fully]

[Spawns parallel codebase-locator and codebase-analyzer agents to research:
- Entity patterns in src/core/domain/ and src/modules/*/domain/
- Value object patterns
- Domain error patterns]

[After agents complete, synthesizes findings and identifies discrepancies]

I have completed the documentation audit for the domain layer.

**Summary**:
- Total discrepancies: 3
- Critical: 0 | Major: 2 | Minor: 1

**Plan created**: `thoughts/shared/plans/2025-01-16-audit-docs-domain-layer.md`

**Key findings**:
1. Entity base class now supports soft-delete pattern (not documented)
2. Value object validation pattern has evolved
3. Minor: Domain error naming convention updated

To implement these updates, run:
`/implement_plan thoughts/shared/plans/2025-01-16-audit-docs-domain-layer.md`

Would you like me to elaborate on any specific discrepancy?
```
