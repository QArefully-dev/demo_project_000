# Demo Project — Agent Instructions

## Project overview

**Shop Qarefully v000** — small, polished e-commerce learning-demo application for **Cursor for Test Automation Engineers — How It Actually Works** course. Audience are QAs, so for now don't write ANY tests (unit, integration, E2E). Tests will be written as a part of the actual course. 
Runs locally with minimal setup. 

**Current state:** Phase 1 foundation ready for implementation.
Reference solutions isolated in `reference/` folder.

## Stack

- **Repo:** npm workspaces monorepo
- **Frontend:** React + Vite + TypeScript
- **Backend:** Fastify + TypeScript
- **Database:** SQLite via `better-sqlite3`
- **Shared:** TypeScript contracts package (API types, no business logic)
- **Monetary values:** integer minor units (cents), backend-authoritative
- **Dev:** `npm install` → `npm run dev` (starts API + web, seeds DB, cross-platform)

## Primary source
Detailed plan, architecture, stack decisions, phasing, constraints -> `projekt_demo_companion_repo.md`.
Read before implementing course scenarios/exercise artifacts.
Conflict with course outline -> outline wins. Plan is draft; open decisions not approved.

## Learning-design rules
- Gradual progression. No front-loaded theory. No early advanced work.
- Simple setup, safe early exercises. M1 -> small success then intentional failure demo.
- Every feature + deliberate defect -> named lesson.
- Single through-line: M1 failure -> M8 working agentic workflow.
- Don't expose later revelations in earlier UI, comments, docs, filenames, starter artifacts.

## Clean baseline
- M1 starts with no Rules, MCP config, AGENTS.md, Skills, real test suite.
- Reference solutions -> `reference/` folder, isolated from clean clone.
- Only prebuilt artifact: M1 Cursor agent definition (Vision Run).
- Preserve deliberate messiness: `uat_03.spec.ts`, one partial page object.
- No completed tests prematurely -> per course phase.

## Quality bar
- First-run reliability paramount. Clean setup verified on Windows + macOS before release.
- UI modern, predictable teaching behavior > decorative complexity.
- Realistic, traceable business rules frontend/backend -> agent exploration meaningful.
- When changing intentional behavior -> check affected course module in outline.
- Never invent prices, limits, counts, rates. Verify or state unverified.

## Self document, AI native
- The project is meant to be used with support of AI agents, so method names, TSDoc need to self-document as the project grows
- Keep the project AI-native, so that agents can easily pick it up and move around. Leave comments only if absolutely necessary - method names and TSDoc should be enough in most cases. 

