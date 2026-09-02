# Merge stability remediation

## Scope

Correct the merge blockers found in the August 25, 2026 review without expanding product scope:

- make PostgreSQL integration and concurrency tests fail honestly when enabled;
- enforce consistency between `stock_movements.balance_after` and the derived ledger balance;
- make Playwright installation and E2E execution deterministic;
- prevent authentication rate-limit bypass through spoofed forwarding headers;
- preserve TLS certificate validation for `rediss://` health probes;
- restore clean whitespace and CI gates.

## Contracts

### PostgreSQL integration tests

- `DATABASE_URL` absent: database-only suites are reported as skipped.
- `DATABASE_URL` present: connection, migrations, fixtures, and assertions are mandatory; setup failures fail the suite.
- CI provides PostgreSQL, applies migrations, and runs the database suites.

### Stock ledger

- `balance_after` for a new movement must equal the previous derived balance plus the signed effect of that movement.
- `ENTRY` adds quantity; `WITHDRAWAL` and `DISCARD` subtract positive quantity; `ADJUSTMENT` applies its signed quantity.
- the resulting balance cannot be negative.
- validation is performed by PostgreSQL, inside the same transaction as movement insertion.

### Authentication rate limiting

- the API derives the limiter key from Express's proxy-aware `request.ip` only.
- the API trusts exactly one loopback proxy in production/native deployment.
- the Next.js BFF does not propagate caller-controlled forwarding headers.

### Redis TLS

- `rediss://` validates the server certificate by default.
- deployments using a private CA provide it through an explicit configuration path; verification is never silently disabled.

### E2E

- the lockfile contains the declared Playwright dependency.
- required fixtures are deterministic; absence of equipment/projects is a test failure, not a conditional pass.
- the scheduling conflict scenario issues two overlapping requests and asserts one success and one conflict.

## Acceptance criteria

- `npm ci` resolves Playwright from `package-lock.json`.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- `npm run test:e2e` executes when the configured web/API/database environment is running.
- CI runs migrations before real PostgreSQL concurrency tests.
- `git diff --check` passes.
- no generated agent scratch data or local reports are included in the PR.

## Verification — August 25, 2026

- `npm ci --ignore-scripts --dry-run`: lockfile resolution passed; CI remains pinned to Node 20.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test` with `DATABASE_URL` and Redis available: 81 files and 554 tests passed.
- `npm run test:e2e`: 8 tests passed across desktop Chromium and Mobile Chrome.
- `npm run build`: API, web, worker, and shared packages passed in production mode.
- `git diff --check`: passed.
- Docker development API restart: prebuild/watch startup recovered healthy without a missing-module race.
