# Dependency Audit

Analysis date: 2026-07-28

## Production summary

- `npm audit --omit=dev`: `0` vulnerabilities
- No production dependency required remediation for the current runtime

## Development summary

- `npm audit`: `19` high vulnerabilities after remediation
- Remaining findings are limited to the Jest toolchain used in development and test execution
- The affected chain is centered on `jest` transitive packages such as `test-exclude`, `glob`, and related internal modules

## Updated dependencies

- `eslint` was updated from the Phase 1 initial range to `^10.8.0`

Why this update was applied:

- it is a direct development dependency;
- it removed the `eslint/minimatch/brace-expansion` vulnerability chain;
- the project already uses flat config via `eslint.config.js`;
- Node.js `v22.16.0` satisfies the official runtime requirement for ESLint 10.

## Remaining vulnerabilities

- Scope: development only
- Direct dependency involved: `jest`
- Current installed major: `30.4.2`
- Production impact: none in the current backend runtime
- Development impact: local and CI test toolchain only
- Current decision: accepted temporarily and documented

Justification:

- `npm audit --omit=dev` is clean
- `npm outdated` does not provide a newer stable Jest line beyond the installed major
- the remaining findings come from transitive development tooling, not runtime code paths
- no safe non-breaking remediation was available from the current dependency graph during this validation

## Verification commands

```bash
npm install
npm run lint
npm run format:check
npm run test:discovery
npm test
npm run check
npm audit
npm audit --omit=dev
```
