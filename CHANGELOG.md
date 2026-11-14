# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Voucher ladder.** The three point-based example coupons are replaced by three voucher
  tiers (bronze, silver, gold). Each offers the bank group's own grocery (5/10/15 % off one
  product) or fuel (5/10/15 c/l off one top-up) voucher. Each tier's target is regular monthly income × the Finnish household saving rate
  (Statistics Finland 15ac, 3 % floor) × the tier multiplier, measured on the last completed
  month's saving. One pick per month, sealed per customer, changeable until the month ends
  (`POST`/`DELETE /api/goals/voucher`). The admin coupon thresholds are gone; stored settings
  that still contain them keep working.

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
- **Month story.** "My month in 30 seconds": a tap-through, narrated recap of last month.
- **Goals and rewards.** Funding plans, recommendations with a monthly value, points, levels
  and example coupons.
- **Benchmarks.** Age-group percentiles from the dataset and Statistics Finland 2022.
- **Insights.** In-app notifications with badges and a banner; staff announcements.
- **Adviser hand-over.** Request a human, book a call, continue the conversation.
- **Admin.** Anonymous usage, AI usage, feature switches, provider, adviser fee, daily AI
  limit, reward rules, announcements, adviser queue and workload, audit log.
- **Plans.** A month's income split into five slices; plans made from the customer's own
  month or an example; shared by code or listed publicly as percentages only, never
  amounts; copied and worked out on the copier's own income.
- **Teach the coach.** Staff write the answer for themes the coach could not answer; the
  coach then gives it word for word, labelled as from the bank's team.
- **Staff accounts.** Administrators, advisers and personal bankers with their own
  sign-in; roles enforced on every admin route; audit entries record who acted.
- **Admin sections.** Navigation with eleven sections, charts that show numbers on hover,
  tap and keyboard, CSV download, moderation of shared plans, one recycle bin, light and
  dark switch.
- **Device notifications.** Asked on first use, switchable in Settings; app-icon badge;
  daily reminders for goals, bills, shortfalls and habits going the wrong way.
- **Layout.** Responsive from 320 px phones to desktops; custom date ranges with a date
  picker; language as a selector; error and not-found pages.
- **Accounts.** Link accounts from other banks as a clearly labelled simulation; every
  calculation, chart and answer then covers all counted accounts together.
- **Corrections.** Change a purchase's basket for one purchase or its whole kind; adjust
  an expected bill; every correction keeps the original and can be undone.
- **Safe to save and goal progress.** What could be set aside with the next month covered;
  mark money as set aside for a goal (nothing is moved); progress and pace per goal.
- **Subscriptions.** Payments that repeat monthly at one merchant, with the yearly cost.
- **Mortgage guide.** The application process taught from the dataset, and the customer's
  own application where one exists. No prediction of outcomes.
- **Charts and widgets.** Fifteen chart types any widget can switch between, by selector
  or by asking; a step-by-step add-widget form with a chart gallery and live preview;
  widgets can be dragged, moved, made wide or small, minimised and removed; shortcut and
  live widgets for asking by voice, calling the coach, checking a purchase, goals and
  insights.
- **Demo video.** A 55-second narrated product film made with HyperFrames, voiced with ElevenLabs; source in `video/`.
- **Documentation.** `docs/how-it-works.md`: the logic step by step with flowcharts, and
  how the statistical data is used.
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
