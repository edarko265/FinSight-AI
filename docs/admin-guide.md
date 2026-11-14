# Admin guide

The admin area is for bank staff. It answers three questions: **what are customers using
this for**, **what could the coach not help with**, and **what do we want it to do**. It is
at `/admin`.

> Staff sessions can read **aggregates** and manage **what customers chose to share**: a
> request to an adviser, or a plan they published. No admin screen or route can open a
> customer's transactions, balance or profile.

---

## Signing in, and who can do what

`/admin` → **Sign in as admin**. The first step asks who is signing in:

- **The owner** leaves the username empty and enters the installation password
  (`ADMIN_PASSWORD`). The owner can do everything and cannot be removed.
- **Staff** enter the username and password an administrator gave them.

| Role                | Can open                                                              |
| ------------------- | --------------------------------------------------------------------- |
| **Owner**           | Everything                                                            |
| **Administrator**   | Everything                                                            |
| **Adviser**         | Overview, Usage, Teach the coach, Advisers, Shared plans, Recycle bin |
| **Personal banker** | The same as an adviser                                                |

The menu shows only the sections a role may open, and the server refuses the rest (a
manager-only request from an adviser gets "forbidden", whatever the screen shows). Five
sign-in attempts per minute are allowed per address. In production the owner password must
be at least 12 characters.

The frame around every section has the **language selector**, a **light and dark switch**,
**Refresh** with the time the figures were loaded, who is signed in, and **Sign out**. If
the figures cannot be loaded it says so and offers **Try again**; it never shows an empty
page as if there were nothing to see.

---

## The sections

### Overview

What needs someone today, then the headline numbers. Every number and every row opens the
section where something can be done about it.

| Part                                                                      | Meaning                                                                                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Needs attention**                                                       | Adviser requests waiting for a reply; the theme the coach most often had no answer for; the daily AI limit when 80% used; AI answers corrected |
| **Questions, 30 days**                                                    | How many questions customers asked, and roughly how many a day                                                                                 |
| **Could not answer**                                                      | Share of questions with no calculation behind them, with the count                                                                             |
| **Waiting for a reply**                                                   | Adviser requests where the customer wrote last                                                                                                 |
| **Answered by AI**                                                        | Share answered by the language model; the rest were basic mode or taught answers                                                               |
| **Questions per day**                                                     | The last 30 days                                                                                                                               |
| **What customers ask about**, **Questions the coach could not calculate** | The top topics and gaps                                                                                                                        |

### Reading the charts

- **Daily charts** always cover 30 days, so a quiet day is a gap and not a shorter chart.
  Point at a day, tap it, or use the arrow keys to read its number. With nothing selected
  the line above gives the total, the daily average and the busiest day.
- **Rings** show the total in the middle; point at or tap a part or its legend row for its
  count and share.
- **Bars** state the count and share on every row.
- **Download CSV** on the usage charts saves the numbers behind them. Aggregates only.

### Usage

Questions, consents (given and withdrawn), goals set, voice uses, charts pinned, adviser
requests; questions per day; questions by topic; the split by language; and a short reading
of what the numbers suggest.

### Teach the coach

How the coach gets better at what it could not answer.

1. **What the coach could not answer** lists the gaps by theme over the last 30 days:
   loans, investing, insurance, cards, taxes, pension, benefits, account, budgeting, other.
2. **Teach an answer** opens a step-by-step form: the theme; optional words that make the
   answer specific (for example "student loan"); the answer in English, and optionally in
   Finnish and Swedish; a review. Each step has an example to start from.
3. From then on, a customer who asks about that theme gets **your answer, word for word**,
   labelled _Answer from the bank's team_. With several answers on a theme, the one whose
   word appears in the question wins.
4. The list shows **how many times each answer has been given**. Edit it, or move it to
   the recycle bin and the coach stops giving it.

A question is sorted into a theme the moment it arrives and only the theme is counted.
**The question text is never stored**, so you teach by theme, not by reading what a
customer typed. Write answers that are general: they are shown to everyone who asks.

### Advisers

Open requests, how many wait for a reply, how many are closed, the average time to a first
reply, the split by topic and by free versus paid, and the queue itself.

- Customers appear under a pseudonym such as `#E73199`.
- You see what the customer chose to share: the topic, the booked call time, their note and
  the messages they write. Not their transactions.
- Open a request to read the conversation and **reply as adviser**. The customer sees the
  reply in their app within a few seconds.
- **Close conversation**, **Reopen**, **Move to recycle bin**.

### Shared plans

Plans customers have shared with each other. You see exactly what other customers can see:
**a name and five percentages**. Not who shared it, and never an amount.

- How many plans are shared, listed publicly and copied; the average shared plan (what
  customers aim for); the most copied.
- **Stop sharing** removes a plan from sharing, for example because of its name. The
  customer keeps their own plan.

### AI _(administrators)_

Answers today against the daily limit, answers and tokens for 30 days and per model, how
many AI answers were corrected, answers per day, the split between AI, basic mode and
taught answers, and a five-step explanation of how an answer is made.

Tokens are what the provider bills for; multiply by your provider's current prices for the
cost. The page does not show euros because prices change and differ per contract.

### Announcements _(administrators)_

Short notices shown to every customer at the top of their Insights, and sent to devices
that have notifications on.

- **New announcement** opens a four-step form: type, title, message, review.
- **Edit**, **Move to recycle bin**.
- Each shows **how many customers have seen it**, counted once per customer.

### Notifications _(administrators)_

How many customers have device notifications on, and **Send reminders now**, which runs the
daily reminder job at once: for each of those customers, one notification about the most
important thing that needs their attention (a possible shortfall, a habit going the wrong
way, a bill due, a goal to put money towards). The notification carries a title only, never
an amount. The same job runs every morning by itself.

### Team _(administrators)_

People who can sign in besides the owner.

- **Add a team member**: name, username (suggested from the name), role, password (tap
  **Suggest a strong password**), review. Note the password when you save: it is stored
  only as a hash and cannot be shown again.
- **Edit** changes the name, role or password. The username stays.
- **Move to recycle bin** ends that person's access **at once**, including a session they
  have open. You cannot remove yourself.

### Controls _(administrators)_

Changes apply within a few seconds, with no deploy, and each is written to the audit log.

| Control            | What it does                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **AI coach**       | Off: every customer gets basic mode and nothing is sent to an AI service                                          |
| **Voice**          | Spoken questions, spoken answers and voice calls                                                                  |
| **Rewards**        | Points, levels and the voucher ladder on the Goals page                                                           |
| **Human adviser**  | Lets customers request an adviser                                                                                 |
| **Shared plans**   | Lets customers share plans as percentages and copy each other's                                                   |
| **AI provider**    | Automatic, OpenAI or Google Gemini. A provider with no key configured cannot be chosen                            |
| **Adviser fee**    | Price of an adviser conversation after a customer's first, which is always free                                   |
| **Daily AI limit** | AI answers per day across all customers. Once reached, the coach uses basic mode until midnight. 0 means no limit |
| **Reward rules**   | Points for each achievement                                                                                       |

### System _(administrators)_

Customers and transactions loaded, the data's as-of date, the encryption in use, the
database, the model answering now, whether voice is on, the checksum of the source file;
typical monthly spending by age group (the medians customers are compared against); and
the **audit log**: the last 100 staff actions with their time and who did them. No customer
data is written to it.

### Recycle bin

Everything staff delete waits here: announcements, adviser requests, team members and
taught answers (administrators see all four; advisers see requests and taught answers).
**Restore** puts it back; **Delete permanently** cannot be undone; **Empty the recycle
bin** asks first. Nothing is deleted for good anywhere else.

---

## What is and is not recorded

| Recorded                                                             | Not recorded                                  |
| -------------------------------------------------------------------- | --------------------------------------------- |
| The topic of a question, the language, AI / basic / taught, the day  | The question text, who asked, the time of day |
| That a consent was given or withdrawn                                | Whose                                         |
| How many customers saw an announcement                               | Which customers                               |
| Requests customers sent to an adviser, sealed with their own key     | Anything a customer did not choose to share   |
| Shared plans: a name and percentages, sealed, under a random code    | Who shared them; any amount                   |
| Staff names, usernames and roles, sealed; passwords as a salted hash | Passwords in readable form                    |
| Staff actions, with the member who did them                          | Customer data                                 |
