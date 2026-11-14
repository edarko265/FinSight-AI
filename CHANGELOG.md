# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Coach.** Text and voice conversation in English, Finnish and Swedish; eleven
  calculations (spending, trends, three baskets, money flow, balance, safe to spend,
  what-if, peer comparison, spending pattern, regular payments, recommendations); goals set
  by describing them; "Can I afford this?".
- **Two ways to answer.** A language model (OpenAI or Gemini, switchable) that chooses
  calculations, and a keyword-based basic mode used when AI is off, declined or failing.
- **Grounding check.** The model's wording is checked against the calculated figures.
- **Voice.** Spoken questions, spoken answers, and a realtime voice call with an animated
  call screen and live captions.
- **Dashboard.** Widgets pinned from conversation, saved as named views with a period
  filter, drawn as bars, line or pie at the customer's choice.
- **Goals and rewards.** Funding plans, recommendations with a monthly value, points, levels
  and example coupons.
- **Benchmarks.** Age-group percentiles from the dataset and Statistics Finland 2022.
- **Insights.** In-app notifications with badges and a banner; staff announcements.
- **Adviser hand-over.** Request a human, book a call, continue the conversation.
- **Admin.** Anonymous usage, AI usage, feature switches, provider, adviser fee, daily AI
  limit, reward rules, announcements, adviser queue and workload, audit log.
- **Privacy.** Terms of use and privacy notice accepted at first sign-in; optional AI
  consent; data export; erasure; recycle bin.
- **Data.** Streaming ingestion of the full dataset into per-customer sealed ledgers.
- **Security.** Field-level encryption, blind indexes, database rate limits, cross-site
  request protection, security headers.
- **Experience.** Step-by-step forms with hints and suggestions, confirmations, light and
  dark themes, four text sizes, motion that respects reduced-motion, app icon and
  home-screen install.
- **Project.** CI (validation, branch policy, CodeQL, dependency review), Dependabot,
  templates, MIT licence, documentation.

### Fixed

- Safe-to-spend returned no usable estimate when the model called it with empty optional
  inputs.
- Basic mode did not recognise "What is safe for me to spend this week?" or "my goals".
- A server fault during sign-in was reported as a wrong password.
- The model could save a goal in answer to a purchase question.

### Security

- `minimatch` overridden to a patched version.
