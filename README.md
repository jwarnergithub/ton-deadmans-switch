# TON Dead Man's Switch

Static-hosted TON dead man's switch scaffold based on `SPEC.md`.

This project is currently experimental. It is not production-ready, has only limited testing so far, and should be treated as a testnet-first prototype until it has gone through more real-world validation.

The app currently includes a temporary `5 minutes` liveness option to make manual expiry/payout testing practical. That short timeline is for testing only and is not intended as a production recommendation.

This repo currently includes:

- a React + Vite + TypeScript frontend in `app/`
- a shared Tolk contract skeleton in `contracts/`
- wrapper, test-plan, and deployment placeholders in `wrappers/`, `tests/`, and `scripts/`
- a milestone checklist in `docs/TODO.md`

The current scaffold intentionally does **not** include backend services, cron jobs, bots, or non-TON asset flows. It also should not be treated as hardened production contract software yet.

The current contract-facing direction is:

- one shared Tolk contract
- Blueprint-style wrapper boundary in `wrappers/`
- shared TON cell serialization in `shared/deadMansSwitchInit.ts`
- Blueprint/Tolk compilation wired through `compilables/` and `blueprint.config.ts`
- compiled code loading and `StateInit` assembly in the wrapper
- executable round-trip tests for the init data layout

## Repo layout

```text
ton-deadmans-switch/
  app/
  contracts/
  wrappers/
  tests/
  scripts/
  docs/
  SPEC.md
  README.md
```

## Local setup

Requirements:

- Node.js 20+
- npm 10+

Install frontend dependencies:

```bash
npm install
```

Start the frontend locally:

```bash
npm run dev
```

Testing note:

- the UI includes a temporary `5 minutes` liveness duration option so you can manually test owner ping, beneficiary trigger, and payout behavior without waiting months
- that option exists only for testing and should be considered experimental

Build the static app:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## GitHub Pages notes

The Vite config uses a GitHub Pages-friendly base path by default in production:

- `/ton-deadmans-switch/`

If the repository name changes, set `VITE_BASE_PATH` during build.

## Current frontend flow

- Landing page
- Configuration form
- Finalize contract terms page with real TON Connect transaction request wiring
- Summary page with live contract status, contract actions, and manual Telegram Saved Messages reminder instructions

## Experimental status

- This repo is still experimental and not well tested.
- Sandbox tests exist, but real wallet and real network validation is still limited.
- Expect rough edges in TON Connect behavior, wallet return flow, and live RPC/provider behavior.
- Use small amounts and prefer testnet while evaluating the current MVP.

## Current contract scaffold

The shared Tolk contract now includes early working logic for:

- persistent state fields
- owner ping handling
- expiry trigger handling
- payout continuation
- basic getters
- owner cancel before expiry

Even with those pieces in place, this contract should still be treated as experimental rather than well-tested production infrastructure.

## Current init-config path

The frontend and wrapper now share one deterministic init-package builder in `shared/deadMansSwitchInit.ts`.

Right now it:

- validates the owner, liveness code, and beneficiary rows
- validates beneficiary percentage splits
- derives the liveness hash from the encoded string cell
- emits a real TON data cell plus a canonical JSON mirror for inspection in the deploy UI

The repo also now includes executable round-trip tests in `tests/DeadMansSwitchVault.spec.ts` that decode the generated data cell and verify the expected state shape, but overall coverage is still limited.

The repo can now compile the Tolk contract with:

```bash
npm run build:contract
```

The deploy preview now also assembles real `StateInit` from compiled code plus the serialized data cell.

The deploy page can now request a real TON Connect wallet transaction for deployment.
The post-deploy summary now hydrates from the actual wallet request metadata and signed BOC when available.
The app can now also fetch live account state from TON Center for the derived contract address and compare reported code/data to the prepared deployment.
The app can now also call contract getters for liveness status and payout progress when the contract is active on-chain.
The app now also decodes the on-chain beneficiary schedule from the live data cell and shows payout order/status in the summary and contract view.
The reserve table now uses a documented MVP estimation model based on reserve floor, expected owner liveness-call budget, and a small payout recovery buffer.

## Next implementation boundary

The safest next step is to keep moving through Milestone 2 with:

1. owner liveness ping validation
2. expiry trigger checks and payout cursor handling
3. contract-level sandbox tests against the compiled artifact
4. beneficiary and contract-detail getter coverage
5. post-deploy flow using confirmed on-chain deployment semantics instead of raw account state only
