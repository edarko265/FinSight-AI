# Privacy and data protection — FinSight-AI

How the service is designed to meet the principles of the EU General Data Protection
Regulation (GDPR). The prototype runs on synthetic data, so no real personal data is
processed today; these are the controls a real deployment would build on.

> This is an engineering description, not legal advice or a compliance certification. A
> real launch needs the bank's data protection officer, a data protection impact
> assessment, and data processing agreements with each provider.

## Principles and how they are met

| GDPR principle                | In the product                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Lawfulness and transparency   | A plain-language privacy notice at `/privacy` in English, Finnish and Swedish; a consent sheet before the AI coach is used                      |
| Purpose limitation            | Data is used only to show and explain the customer's own finances                                                                               |
| Data minimisation             | The AI model receives the question plus totals and short summaries. Never the transaction list, customer ID, account number, age or postal code |
| Accuracy                      | Every figure is calculated from the source transactions and links to the transactions behind it                                                 |
| Storage limitation            | Sessions expire after 8 hours; conversations are not stored; saved views and consent live until the customer deletes them                       |
| Integrity and confidentiality | Field-level encryption with per-customer keys, blind-index lookup, TLS, hashed session tokens (see [security.md](security.md))                  |
| Accountability                | Consent is recorded with terms version and timestamps for both acceptance and withdrawal                                                        |

## Consent for AI processing

- AI is **opt-in**. Until the customer accepts the current terms, the coach answers in basic
  mode with calculations done on our own server, and nothing is sent to an AI or speech
  provider.
- Consent is versioned (`AI_TERMS_VERSION`). Changing the terms asks again.
- Withdrawing is one switch in Settings and takes effect on the next question.
- Voice uses a speech provider, so it requires the same consent.

## Data subject rights

| Right                         | Where                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Access and portability        | Settings → _Download my data_ (`GET /api/privacy/export`), one JSON file                                          |
| Erasure                       | Settings → _Delete my app data_ (`POST /api/privacy/erase`): saved views, read insights, consent and all sessions |
| Withdraw consent              | Settings → _AI coach_ switch                                                                                      |
| Information                   | `/privacy`, linked from the consent sheet and Settings                                                            |
| No solely automated decisions | The coach explains and estimates; it makes no decision with legal or similar effect                               |

The transaction ledger is the bank's record. In a real deployment its erasure follows the
bank's retention rules; because each customer's data is sealed with their own derived key,
retiring that key makes it unreadable everywhere, including in backups.

## Processors

| Provider                                 | Receives                                                        | Only when                                    |
| ---------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| Language model (OpenAI or Google Gemini) | The question, recent conversation turns, and aggregated results | AI is enabled and the customer has consented |
| ElevenLabs                               | Spoken question audio; the coach's answer text                  | Voice is used and the customer has consented |
| Database host (PostgreSQL, EU region)    | Ciphertext only                                                 | Always                                       |

Before real data: sign data processing agreements, choose EU data residency and
zero-retention options where the provider offers them, and document international transfers.

## Still required before real customers

- Data protection impact assessment (profiling of financial behaviour)
- The bank's lawful-basis decision and records of processing
- Processor agreements and transfer assessments
- Breach response and retention procedures
- Strong customer authentication in place of the demo sign-in
