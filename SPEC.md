# TON Dead Man's Switch — Product Spec

## 1. Goal

Build a **static web app** that lets a user configure and deploy a **user-specific TON dead man's switch contract instance** from one shared Tolk contract.

The app should be easy to host on **GitHub Pages** and easy for a user to open in a browser, connect a TON wallet, configure the contract, and deploy it.

This is **not** a backend-driven product. Once deployed, the contract should enforce its own rules on-chain as much as TON allows.

## 2. Core Product Decisions

### 2.1 Hosting model
- Frontend: **static app**
- Target hosting: **GitHub Pages**
- No backend server for MVP
- No cron jobs, no watcher service, no Telegram bot, no database

### 2.2 Contract model
- One shared audited Tolk contract in the repo
- The UI must **not** generate new contract source code
- The UI collects user inputs and builds the **initial config data**
- The app deploys a **new contract instance** for each user configuration
- Each deployed instance has its own address, balances, deadlines, beneficiaries, and payout plan

### 2.3 Reminder model
- No automatic reminders or alerts
- After deployment, the app shows a **post-deploy reminder page**
- That page explains how the user can manually create a **Telegram Saved Messages reminder**
- Reminder instructions are informational only and are not connected to the contract

### 2.4 Phased asset support
Implement in this order:
1. **TON only**
2. TON + **USDT**
3. **XAUT0** last

Do not attempt full multi-asset completion in the first pass.

---

## 3. User Story

A user opens the app, connects a TON wallet, configures beneficiaries and liveness settings, deploys a contract instance, funds it, and later keeps it alive by sending valid liveness-check messages.

If the liveness deadline passes, a beneficiary can send the trigger message to start payout.

If payout stops because the contract lacks enough TON for fees, someone can top up the contract and resume payout.

---

## 4. MVP Scope

### 4.1 User inputs
The app must let the user enter:

- number of beneficiaries
- liveness code / liveness message text
- liveness duration (for example: 6 months)
- beneficiary wallet addresses
- beneficiary payout amounts

The final UI should support separate fields for:
- TON amount
- USDT amount
- XAUT0 amount

However, **MVP implementation should only activate TON payout logic first**.

### 4.2 Generated UI rows
When the user chooses the number of beneficiaries, the UI generates that number of rows.

Each row contains:
- beneficiary TON wallet address
- TON payout amount
- USDT payout amount (disabled or marked upcoming in phase 1)
- XAUT0 payout amount (disabled or marked upcoming in phase 1)

---

## 5. Post-Deploy Page

After deployment, show a clear summary page containing:

- deployed contract address
- owner wallet address
- liveness interval
- next liveness due date
- exact liveness message/code required
- total configured payouts
- estimated TON reserve needed to keep the contract usable
- estimate table for reserve/longevity targets
- Telegram reminder instructions

### 5.1 Reserve estimate display
Show reserve estimates for approximately:
- 5 years
- 10 years
- 15 years
- 20 years
- 25 years

These are **estimates only**, not guarantees.

### 5.2 Reminder section
Include:
- a “copy reminder text” button
- short instructions for creating a Telegram Saved Messages reminder manually
- suggested reminder text that includes:
  - contract address
  - liveness code/message
  - next due date

---

## 6. Contract Functional Requirements

### 6.1 Contract responsibilities
The contract must:
- store owner address
- store liveness interval
- store liveness code hash or equivalent validation data
- store last successful liveness timestamp
- store beneficiary list
- store payout amounts
- store payout progress state
- store completion status
- enforce expiry rules on-chain
- support resumable payout

### 6.2 Liveness check behavior
The owner sends a valid liveness-check message before expiry.

A valid liveness check should:
- verify sender is the owner
- verify the liveness code/message matches the configured requirement
- update the last successful liveness timestamp
- reject invalid pings

### 6.3 Expiry trigger behavior
If the deadline passes:
- any configured beneficiary should be able to trigger payout
- trigger must be message-based
- the contract must check expiry on-chain before paying

The contract does **not** self-wake. It executes only when a message arrives.

### 6.4 Payout behavior
Payout begins with the first beneficiary in the configured list and proceeds in order.

Important:
- this ordering is intentional
- if the contract does not have enough TON to finish all sends, later beneficiaries may wait until someone tops up and resumes
- the UI must disclose this clearly

### 6.5 Resume behavior
If payout cannot finish due to low TON reserve:
- contract stores payout cursor/progress
- anyone may top up the contract
- an allowed caller can send a resume message
- payout continues from the stored cursor instead of restarting

---

## 7. Contract State Design

Suggested persistent fields:

- `owner`
- `liveness_interval_seconds`
- `last_liveness_at`
- `liveness_code_hash`
- `beneficiaries[]`
- `ton_amounts[]`
- `usdt_amounts[]`
- `xaut0_amounts[]`
- `payout_index`
- `expired`
- `completed`
- `minimum_reserve_floor`
- `version`

For MVP, token arrays beyond TON may remain stubbed or reserved for later phases.

---

## 8. Message / Opcode Plan

Define explicit opcodes or message handlers for at least:

- deploy/init
- owner liveness ping
- expiry trigger
- payout resume
- top-up handling
- getter/query methods

Keep opcode naming and comments very clear for Codex.

---

## 9. Frontend Requirements

### 9.1 App stack
- React
- Vite
- TypeScript
- static hosting friendly
- GitHub Pages compatible

### 9.2 Wallet integration
- use TON Connect
- support browser/mobile wallet-friendly flow
- display wallet connection state clearly

### 9.3 UI requirements
Pages/components should include:

1. **Landing page**
   - simple explanation
   - connect wallet button
   - start configuration button

2. **Configuration form**
   - number of beneficiaries
   - liveness code
   - liveness duration
   - beneficiary rows
   - payout summary

3. **Review page**
   - human-readable summary before deploy
   - warning about contract not self-waking
   - warning about reserve estimates not being guaranteed
   - warning about beneficiary order payout logic

4. **Deploy page**
   - build payload
   - request wallet transaction
   - show pending / success / failure states

5. **Post-deploy page**
   - contract summary
   - liveness instructions
   - Telegram reminder instructions
   - copy buttons

6. **Contract view page**
   - contract address input
   - view current state when possible
   - show whether expired/completed
   - show next due date estimate

---

## 10. GitHub Pages Compatibility

The app must be deployable as a static site.

Requirements:
- all frontend code must build into static assets
- no server-side rendering required
- configure Vite correctly for GitHub Pages base path
- keep secrets out of the frontend repo
- frontend must function without a custom backend

---

## 11. Repo Structure

Recommended structure:

```text
ton-deadmans-switch/
  app/
    src/
    public/
      tonconnect-manifest.json
  contracts/
    DeadMansSwitchVault.tolk
  wrappers/
  tests/
  scripts/
  docs/
  SPEC.md
  README.md
  package.json
```

---

## 12. Milestones

### Milestone 1 — Scaffold
- repo structure
- Vite app scaffold
- Blueprint/Tolk scaffold
- README
- TODO list

### Milestone 2 — TON-only contract core
- init config storage
- owner ping
- expiry trigger
- payout cursor
- resume path
- basic tests

### Milestone 3 — TON-only frontend flow
- connect wallet
- config form
- review page
- deploy page
- post-deploy page

### Milestone 4 — Reserve estimation UI
- reserve estimator
- year-range estimates
- warnings/disclaimers

### Milestone 5 — Contract viewing helpers
- load contract state
- show deadlines and payout status

### Milestone 6 — USDT integration
- add verified USDT path
- tests
- UI activation

### Milestone 7 — XAUT0 integration
- validate actual transfer model
- add only after verification
- tests
- UI activation

---

## 13. Non-Goals for MVP

Do **not** build these in MVP:
- backend server
- Telegram bot
- automatic beneficiary alerts
- cron-based reminders
- email reminders
- AI-generated contract logic per user
- automatic self-firing execution
- full production asset support before TON-only works

---

## 14. Warnings to Show the User

The app should clearly disclose:
- the contract does not wake itself up automatically
- someone must send a message after expiry to trigger payout
- reserve/gas estimates are approximations
- payout order matters
- low TON reserve can delay later payouts until top-up
- Telegram reminders are manual user convenience features only

---

## 15. Acceptance Criteria for MVP

MVP is complete when:

- a user can open the static app
- connect a TON wallet
- configure a TON-only dead man's switch
- deploy a new contract instance
- view the resulting contract address and liveness instructions
- manually use the reminder instructions
- send a valid owner ping
- let the deadline pass in test flow
- trigger payout as a beneficiary
- resume payout after a top-up if necessary

---

## 16. Instructions for Codex

When implementing from this spec:

- keep the architecture static-hosting-friendly
- do not introduce a backend
- do not generate custom contract source per user
- create one shared Tolk contract and deploy user-specific instances
- build TON-only first
- keep code heavily commented where contract storage and opcodes are defined
- stop after each milestone and summarize progress
