# Admin guide

The admin area is for bank staff. It answers two questions: **what are customers using this
for**, and **what do we want it to do**. It is at `/admin`, behind its own password
(`ADMIN_PASSWORD`).

> Admin sessions can read **aggregates** and manage **what customers chose to share with an
> adviser**. No admin screen or route can open a customer's transactions.

---

## What you see, top to bottom

### Headline numbers

| Tile                     | Meaning                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **Questions, 30 days**   | How many questions customers asked the coach                                          |
| **Answered by AI**       | Share answered by the language model; the rest were basic mode                        |
| **Could not answer**     | Share where the coach had no calculation to offer                                     |
| **AI consent given**     | Times a customer switched the AI coach on                                             |
| **Goals set**            | Savings goals created                                                                 |
| **Adviser requests**     | Requests to talk to a person                                                          |
| **AI answers corrected** | Times the model stated an amount no calculation produced and its wording was replaced |
| **Active sessions**      | Customers signed in right now                                                         |

### Controls

Changes apply within a few seconds, with no deploy, and each is written to the audit log.

| Control            | What it does                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **AI coach**       | Off: every customer gets basic mode and nothing is sent to an AI service                                          |
| **Voice**          | Spoken questions, spoken answers and voice calls                                                                  |
| **Rewards**        | Points, levels and coupons on the Goals page                                                                      |
| **Human adviser**  | Lets customers request an adviser                                                                                 |
| **AI provider**    | Automatic, OpenAI or Google Gemini. A provider with no key configured cannot be chosen                            |
| **Adviser fee**    | Price of an adviser conversation after a customer's first, which is always free                                   |
| **Daily AI limit** | AI answers per day across all customers. Once reached, the coach uses basic mode until midnight. 0 means no limit |
| **Reward rules**   | Points for each achievement, and the points at which each coupon unlocks                                          |

The three with a **Change** button open a short step-by-step form with suggested values.

### AI usage

Answers and tokens, for today, the last 30 days, and per model. Tokens are what the provider
bills for; multiply by your provider's current prices for the cost. The page does not show
euros because prices change and differ per contract.

### Questions the coach could not calculate

Questions about things outside the coach's calculations — loans, investing, insurance,
cards, taxes, pension, benefits, account problems — counted by broad theme. This is the
clearest signal of what customers want next.

Each question is sorted into a theme the moment it arrives, and only the theme is counted.
**The question text is never stored.**

### Adviser workload

Open requests, how many are waiting for a reply, how many are closed, the average time to a
first reply, and the split by topic and by free versus paid.

### Human help requests

The adviser's queue.

- Customers appear under a pseudonym such as `#E73199`.
- You see what the customer chose to share: the topic, the booked call time, their note and
  the messages they write. Not their transactions.
- Open a request to read the conversation and **reply as adviser**. The customer sees the
  reply in their app within a few seconds.
- **Close conversation**, **Reopen**, **Move to recycle bin**, **Restore**, **Delete
  permanently**. Deleting permanently is only possible from the bin.

### Announcements to customers

Short notices shown to every customer at the top of their Insights.

- **New announcement** opens a four-step form: type, title, message, review. Suggested
  titles fill in a suggested message.
- **Edit**, **Move to recycle bin**, **Restore**, **Delete permanently**.
- Each announcement shows **how many customers have seen it**, counted once per customer.

Announcements are written once and shown as written, so write in the language your
customers read.

### What customers ask about

Questions by topic, with a short reading of what the numbers suggest, and the split by
language.

### How an answer is made

A five-step explanation of what happens between a question and an answer. Useful when
someone asks how the AI is kept honest.

### System

Customers and transactions loaded, the data's as-of date, the encryption in use, the
database, the model answering now, whether voice is on, and the checksum of the source file.

### Typical monthly spending by age group

The median of each age group, from the anonymous benchmarks customers are compared against.

### Audit log

The last 60 staff actions with their time: sign-ins (and failed sign-ins), settings changes
with what changed, announcement actions and adviser actions. No customer data is written to
it.

---

## What is and is not recorded

| Recorded                                                         | Not recorded                                  |
| ---------------------------------------------------------------- | --------------------------------------------- |
| The topic of a question, the language, AI or basic, the day      | The question text, who asked, the time of day |
| That a consent was given or withdrawn                            | Whose                                         |
| How many customers saw an announcement                           | Which customers                               |
| Requests customers sent to an adviser, sealed with their own key | Anything a customer did not choose to share   |

## Signing in

`/admin` → **Sign in as admin** → the admin password. Five attempts per minute are allowed
per address. In production the password must be at least 12 characters, or sign-in is
refused.
