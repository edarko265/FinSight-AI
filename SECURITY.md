# Security Policy

FinSight-AI is a hackathon prototype that works with synthetic banking data. It is built
to bank-style security rules, described in [docs/security.md](docs/security.md).

## Reporting a vulnerability

**Do not open a public issue.**

1. Report it privately through
   [GitHub security advisories](https://github.com/edarko265/FinSight-AI/security/advisories/new).
2. Include a description, steps to reproduce, the potential impact and any suggested fix.
3. Please give us time to fix it before disclosing it publicly.

## How we handle reports

- Reports are triaged privately.
- Affected secrets are rotated immediately.
- The fix is merged and released before details are published.

## If a secret is exposed

In the repository, CI logs or anywhere else:

1. **Rotate the secret immediately.**
2. Notify the maintainer ([@edarko265](https://github.com/edarko265)).
3. Remove it from history if necessary.

## Supported versions

Only the latest state of `main` is supported.
