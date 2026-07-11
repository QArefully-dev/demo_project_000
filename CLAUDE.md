# Demo Project — Agent Instructions

## Project

**Shop Qarefully v000**: small, polished, local e-commerce learning demo for **Cursor for Test Automation Engineers — How It Actually Works**.

- audience: QA engineers
- current state: storefront baseline implemented; approved expansion active
- tests: no unit, integration, or E2E tests until explicitly requested for named course phase
- setup goal: minimal, cross-platform, no external services

## Sources

- `CLAUDE.md`: repository-wide rules
- `plans/demo_project_expansion_plan.md`: approved expansion orchestration
- `plans/demo_project_expansion_spec.md`: approved expansion architecture, behavior, ownership, acceptance
- `plans/demo_project_high_level_plan.md`: course and product background; draft content cannot override approved expansion documents

Expansion work -> read plan, relevant specification section, this file. Course-scenario or exercise work -> also read high-level plan. Unresolved conflict -> stop and request decision.

## Stack

- repo: npm workspaces monorepo
- runtime: Node.js 22
- frontend: React + Vite + TypeScript
- backend: Fastify + TypeScript
- database: SQLite via `better-sqlite3`
- shared: TypeScript API contracts; no business logic
- money: integer minor units through `MoneyCents`; backend authoritative
- local flow: `npm ci` -> `npm run dev`; dev command seeds database and starts API + web

## Learning design

- gradual progression; no front-loaded theory or early advanced work
- M1: small success -> intentional failure demo
- each feature and deliberate defect -> named lesson
- single through-line: M1 failure -> M8 working agentic workflow
- no later revelations in earlier UI, comments, docs, filenames, or starter artifacts

## Course baseline

Scope: artifacts shipped to students. Does not prohibit implementation orchestration required by approved expansion plan.

- M1 baseline: no Rules, MCP config, `AGENTS.md`, Skills, or real test suite
- reference solutions, when present: isolated under `reference/`; never add to clean clone
- protected paths: no edits under `reference/` or `.cursor/`
- only prebuilt M1 artifact: Cursor agent definition for Vision Run
- `uat_03.spec.ts` and partial page object: preserve if present; do not create during expansion
- completed tests: add only during named course phase

## Quality

- first-run reliability paramount; verify clean setup on Windows and macOS before release
- UI: modern, polished, desktop-only; predictable teaching behavior over decoration
- target resolutions: `1920x1080`, `1920x1200`, `3840x2160`
- out of scope unless named course scenario requires: mobile, keyboard-only acceptance, exhaustive accessibility certification, production hardening, live-traffic scale
- business rules: realistic, traceable across frontend and backend
- intentional behavior change -> check affected course module

## AI-native code

- prefer clear names, types, contracts, and module boundaries
- use TSDoc for public or non-obvious contracts
- comments explain necessary rationale, not observable code behavior
- avoid redundant comments and narration
