# TODO

## Milestone 1: Scaffold
- [x] Create repo structure from `SPEC.md`
- [x] Scaffold React + Vite + TypeScript frontend in `app/`
- [x] Add static-hosting-friendly page flow for landing, config, review, deploy, summary, and contract view
- [x] Add placeholder TON Connect integration structure
- [x] Add shared Tolk contract skeleton, wrapper skeleton, test plan, and deploy script placeholder
- [x] Write root setup docs in `README.md`

## Milestone 2: TON-only contract core
- [x] Pick the wrapper direction: shared config builder plus Blueprint-style wrapper boundary
- [x] Add real TON cell serialization on top of the shared init package
- [x] Add executable round-trip tests for the shared init layout
- [ ] Implement contract init parsing and persistent storage
- [ ] Implement owner ping validation and timestamp update
- [ ] Implement expiry trigger checks and ordered payout flow
- [ ] Implement resumable payout cursor logic
- [ ] Add executable contract tests for the TON-only flow

## Milestone 3: TON-only frontend flow
- [x] Replace TON Connect placeholder with real wallet integration
- [x] Serialize deploy config into real contract init data
- [x] Submit deploy transaction request from the deploy page
- [x] Persist post-deploy summary from wallet-request deployment results

## Milestone 4: Reserve estimation UI
- [x] Replace placeholder reserve estimates with a documented estimation model
- [x] Add UI copy explaining estimate assumptions
- [ ] Validate mobile layout for estimate tables and warnings

## Milestone 5: Contract viewing helpers
- [x] Implement live contract reads through TON client APIs
- [x] Show expiry, completion, payout cursor, and next due date from contract data
- [ ] Handle invalid or unknown contract addresses gracefully

## Milestone 6: USDT integration
- [ ] Verify the supported transfer path for TON USDT on-chain
- [ ] Add wrapper and contract logic for USDT
- [ ] Activate USDT UI fields after tests exist

## Milestone 7: XAUT0 integration
- [ ] Validate the actual on-chain transfer model for XAUT0
- [ ] Add wrapper and contract logic for XAUT0 only after verification
- [ ] Activate XAUT0 UI fields after tests exist

## Non-goals to keep out of MVP
- [ ] No backend server
- [ ] No Telegram bot
- [ ] No automatic reminders or cron jobs
- [ ] No dynamic contract source generation per user
- [ ] No USDT or XAUT0 production logic during phase 1
