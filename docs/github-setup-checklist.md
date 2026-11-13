# GitHub setup checklist — FinSight-AI

Repository settings for <https://github.com/edarko265/FinSight-AI>. Items marked ✅ were
applied when the repository was initialised; the rest are for the maintainer.

## 1. Branches

- [x] `main`, `dev`, `eric`, `tom` exist
- [ ] Optional: set the default branch to `dev` so new pull requests target it
      (Settings → General → Default branch)

## 2. Branch protection — `main` and `dev`

- [x] Require a pull request before merging
- [x] Require the status check `Lint / Typecheck / Test / Build`
- [x] Block force pushes and deletions
- [ ] After the event: require 1 approval and Code Owner review (left off so a small team
      is not blocked during the hackathon)

## 3. Security features

- [x] Secret scanning and push protection
- [x] Dependabot alerts and security updates
- [x] CodeQL via [`security.yml`](../.github/workflows/security.yml)
- [x] Private vulnerability reporting

## 4. Deployment (off until switched on)

- [ ] Create a hosted PostgreSQL database in an EU region; one for `dev`, one for `main`
- [ ] Create the Vercel project
- [ ] Create GitHub Environments `development` and `production`, each with
      `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- [ ] Add required reviewers to the `production` environment
- [ ] In Vercel, set `DATABASE_URL`, `DATA_ENCRYPTION_KEY`, `DATA_ENCRYPTION_KEY_ID`,
      `BLIND_INDEX_KEY`, `SESSION_SECRET` (different values per environment)
- [ ] Set the repository variable `DEPLOY_ENABLED=true`

## 5. Merge settings

- [ ] Allow merge commits (used for personal branch → `dev` and `dev` → `main`)
- [ ] Do **not** enable "Automatically delete head branches" — personal branches are
      long-lived
