# Features — what a customer can do

Everything below works in English, Finnish and Swedish, in light or dark mode, and on any
screen: a bottom bar on a phone, a side menu on a tablet or desktop. Screens are listed in the order a new customer meets them.

---

## 1. Signing in

|                     |                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Where**           | `/login`                                                                                                     |
| **How**             | Tap **Sign in**. A two-step sheet asks for the customer ID, then the password                                |
| **Help on the way** | Each step says what to enter. In demo mode, example customers and the demo password can be tapped to fill in |
| **Also**            | Eye button to show the password; **Forgot password?**; language selector with flags                          |

The accounts are the bank's 5,100 synthetic customers. There is no real bank login.

## 2. First sign-in: terms and privacy

The first time a customer signs in, a three-step sheet opens before anything of theirs is
shown:

1. **Terms of use** — what the service is and is not. Must be accepted.
2. **Your data and privacy** — how the data is used and protected. Must be acknowledged.
3. **Do you want the AI coach?** — optional. "Not now" still gives a working coach.

The full texts are at `/terms` and `/privacy`. Declining signs the customer out. If the
terms change, the sheet appears again.

## 3. Dashboard

| Part                                                | What it does                                                                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Banner**                                          | The most important unread insight, for example a possible shortfall                                                                                                                                               |
| **Balance card**                                    | Recorded balance, and the amount that is safe to spend over the next 7 days (or the estimated shortfall)                                                                                                          |
| **Can I afford this?**                              | Enter a price and a time span; the coach answers with what would be left                                                                                                                                          |
| **My month in 30 seconds**                          | A full-screen story of last month: where income went, the three baskets, spending by category, the trend, what could be freed up, and what is safe to spend. Tap through it, hold to pause, or have it read aloud |
| **Views**                                           | Named sets of widgets. Three to start with: _Overview_, _Three baskets_, _Everyday spending_                                                                                                                      |
| **Period**                                          | Last month, this month, 3, 6 or 12 months, or **your own dates** picked from a calendar. Every widget in the view follows it                                                                                      |
| **Widgets**                                         | Charts with a plain-language summary and a note on where the numbers come from, plus shortcuts and live panels (see below)                                                                                        |
| **Chart type**                                      | Each chart widget has a selector with 15 types: bars, rows, line, area, pie, filled pie, split bar, tree map, rings, radar, waterfall, lollipop, funnel, table and big numbers. The choice is saved with the view |
| **New widget**                                      | A step-by-step form: what it shows, which spending, the chart type (a gallery with a live preview), and the size. Or **Describe it instead** and the coach builds it                                              |
| **Save as new view / Rename / Move to recycle bin** | Manage views                                                                                                                                                                                                      |

### What can be done with a widget

Every widget has the same controls in its title bar:

| Control                  | What it does                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Drag** (grip)          | Drag a widget onto another to move it there, with a mouse or a finger; the page scrolls as you near its edge                 |
| **Move earlier / later** | The same with arrows, on a phone or from the keyboard                                                                        |
| **Change size**          | Small, medium or wide: by the button, or by pulling the widget's right edge. Small shortcuts sit two side by side on a phone |
| **Minimise**             | Folds the widget to its title bar; the plus opens it again                                                                   |
| **Remove** (×)           | Moves it to the recycle bin, from where it can be restored                                                                   |

The order, size and minimised state are saved with the view.

### Shortcut and live widgets

| Widget                     | What it does                                                                   |
| -------------------------- | ------------------------------------------------------------------------------ |
| **Ask the coach**          | Type a question, or tap the microphone and say it, straight from the dashboard |
| **Voice call**             | One tap to a live call with the coach                                          |
| **Can I afford this?**     | Checks a purchase against what is safe to spend                                |
| **My month in 30 seconds** | Plays the month story                                                          |
| **My goals**               | Each goal, what it needs a month, and whether the usual month covers it        |
| **Needs attention**        | The latest insights, unread first                                              |

The customer decides what is on the dashboard and how it is drawn. Nothing is fixed by the
bank.

## 4. Coach

Ask in your own words, by typing, by holding the microphone, or in a voice call.

### What it can answer

| Ask something like                                   | You get                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Where does my money go?"                            | Spending by category, as a pie                                                                 |
| "How much did I spend on taxis last month?"          | The amount, the count, and that category by month                                              |
| "Show how my income flows"                           | A money-flow diagram: bills, essentials, everyday, investing, what was left                    |
| "Explain my three baskets"                           | Regular bills, irregular essentials, everyday spending, and how much of that was a free choice |
| "What is safe to spend this week?"                   | The estimate and what was set aside to reach it                                                |
| "Can I afford a 300 € bike?"                         | What would be left after the purchase, or how far short it falls                               |
| "What if I cut restaurants by 20%?"                  | The saving, and what that is over a year                                                       |
| "How do I compare with people my age?"               | Your typical month against the middle half of your age group, with Statistics Finland context  |
| "What kind of spender am I?"                         | Basket shares and your largest free-choice categories                                          |
| "What bills are coming up?"                          | Regular payments and the usual income pattern                                                  |
| "What would you recommend?"                          | Ranked suggestions, each with an estimated monthly value                                       |
| "I want to save for a trip, maybe two thousand"      | A saved goal and a plan for funding it                                                         |
| "Make me a budget plan"                              | Your month as five slices, in percentages, ready to keep as a plan                             |
| "…as a tree map" / "viivakaaviona" / "som en tabell" | The same answer, drawn the way you asked: any of the 15 chart types                            |

### With every answer

- **A chart** and the values behind it.
- **How this was worked out** — the steps the calculation took, in order, with the same
  figures as the answer.
- **See transactions** — the actual transactions the figure was calculated from.
- **A short lesson**, for example what an irregular essential cost is.
- **Add to dashboard** — pins the chart to the view you have open.
- **Listen** — the answer read aloud.
- **Follow-up suggestions.**
- A label saying whether the wording came from the **AI coach**, **basic mode**, or the
  **bank's team** (an answer staff wrote for a question the coach cannot calculate, such as
  loans or insurance).

Suggested questions sit in a tidy grid under the conversation, so there is nothing to
scroll sideways.

The conversation is kept between visits, so the coach opens where you left off. **Clear
this conversation** sends it to the recycle bin.

### Voice

|                      |                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Speak a question** | Tap the microphone, speak, tap again. The question is transcribed and answered                                                                     |
| **Hear the answer**  | Tap _Listen_, or switch on _Voice replies_ in Settings                                                                                             |
| **Voice call**       | Tap _Start a voice call_. Talk naturally; the coach answers aloud, live captions appear, and the chart for each answer is shown on the call screen |

Voice needs the AI choice to be on, because speech is processed by a speech provider.

### Talk to a person

From the coach, **Talk to a person** opens a four-step request: what you need help with
(everyday finances or investment advice), when to be called, a note for the adviser, and a
summary with the price. The first conversation is free; later ones have a fee, paid on a
final step. **Payment is simulated: no card is asked for and no money is taken.** The adviser then replies in the same
place, and the conversation continues there.

## 5. Goals and rewards

| Part                              | What it does                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Your goals**                    | Each goal shows the amount, the monthly amount needed, how that compares with what is usually left over, and whether it fits                                                                                                                                       |
| **Tell the coach about a goal**   | Describe it in a sentence                                                                                                                                                                                                                                          |
| **Add a goal**                    | A four-step form: name, amount, time, review — with suggestions on each step                                                                                                                                                                                       |
| **Edit / Move to recycle bin**    | On each goal                                                                                                                                                                                                                                                       |
| **Set money aside**               | Shows how much is safe to set aside now, and marks an amount as set aside for a goal. Nothing is moved: it is a simulation, capped at what leaves the next month covered, and from then on that money is left out of safe to spend                                 |
| **Progress**                      | Each goal shows what has been set aside against the target, whether that is ahead of, on, or behind the plan, how many months are left, and a curve of planned against actual month by month. A goal can start in the past and set-asides can carry their own date |
| **Redeem a reward**               | An unlocked coupon gives a code. The bonus programme is simulated, so the code has no value                                                                                                                                                                        |
| **Where you could free up money** | The coach's recommendations with their monthly value                                                                                                                                                                                                               |
| **Rewards**                       | Points and a level for progress the data shows: a lighter month, free-choice spending down, a buffer, months with money left over, investing, setting a goal                                                                                                       |
| **Coupons**                       | Unlock at point thresholds. Examples only                                                                                                                                                                                                                          |

Rewards compare a customer with their own past months, never with other people.

## 6. Plans — and sharing them without sharing amounts

Reached from the Goals page. A plan splits a month's income into five slices: regular
bills, irregular essentials, everyday spending, saving and investing, in percentages that
add up to 100.

| Part                                          | What it does                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Your month today**                          | How the last three months were actually split, with your amounts (only you see them)                                  |
| **Make a plan**                               | Start from your month or an example (Balanced, Saver, Tight month), name it, set the percentages with sliders, review |
| **Your plans**                                | Each plan shows the percentages, what they come to on your income, and how far each is from your month today          |
| **Share**                                     | With friends you give a code or link to, or listed for everyone. A final step shows exactly what others will see      |
| **Add a friend's plan**                       | Enter the code, or open the link. You see their percentages worked out on **your** income before adding it            |
| **Plans others have shared**                  | Listed plans, most copied first                                                                                       |
| **Edit / Stop sharing / Move to recycle bin** | On each plan                                                                                                          |

More on the Plans page:

- **Follow this plan.** One plan can be followed; the app then says when a slice of your
  month has drifted five points or more from it.
- **Monthly limits.** Set a limit for a kind of spending. Nothing is blocked: a bar shows
  how the month is going and you are told at 80 % and when it is passed.
- **Friends.** Give your friend code to someone, or add theirs. You then see the plans
  they have chosen to share, as percentages. They are not told you added them.
- **Report.** Any shared plan can be reported to staff, anonymously.

**What others can see:** the plan's name and the percentages. Goal names are shown as #1,
#2 unless you choose to show them. **Never:** your income, any amount, your balance, your
transactions, your name, age or customer number. A plan name with an amount in it is
refused. You can stop sharing at any time, and moving a plan to the recycle bin stops it
too.

## 7. Insights

Notifications, each calculated from the customer's own data and each opening the coach on
that topic:

- a possible shortfall this week
- **a spending habit going the wrong way**: a free-choice category running well ahead of
  the same days in earlier months
- a bill due soon
- **a monthly reminder for each goal**
- a category well above or below its three-month average
- small purchases adding up
- a reserve for irregular costs
- a category above the typical range for the age group
- announcements from the bank

Unread insights show as a badge on the bell and on the navigation, and, with device
notifications on, as a **badge on the app icon**. **Mark all as read** clears them.

### Device notifications

The first time the app is used it asks whether to allow notifications. Saying yes means a
notification arrives when something needs attention (a shortfall, a habit going the wrong
way, a bill, a goal, an announcement), at most one a day, **with a title only and never an
amount**. It can be switched on or off at any time in Settings.

## 8. Accounts — everything in one place

Settings → **Accounts**. Besides the bank's own account, the customer can link accounts
from other banks, and from then on every figure, chart, answer and estimate covers all of
them together.

> **Other banks are simulated.** The three banks are made up and their transactions are
> generated. No real bank is contacted. Every screen and every chart that includes a linked
> account says so. In a real service the customer would approve read-only access at their
> other bank, for a limited time.

| Part                           | What it does                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Across your accounts**       | The combined balance of the accounts that are counted. A card balance is what is owed, so it is subtracted |
| **Link an account**            | Bank, kind (everyday, savings, credit card), an explanation of how linking would really work, a name       |
| **Count in calculations**      | A switch per account. Savings start switched off, so they are shown but not counted as spendable           |
| **Edit / Move to recycle bin** | Rename; unlinking removes its figures at once and can be undone from the bin                               |

### Income and expenses you record

**Add income** and **Add expense** on the balance card, or **My entries** in the menu. For
money the account history does not show yet, such as cash.

| Part                           | What it does                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Four steps**                 | Amount, what it was for (or where it came from), the day and an optional note, then a check that shows the balance afterwards                          |
| **Counts everywhere**          | The entry becomes a transaction on the customer's own account: balance, safe to spend, the three baskets, charts, monthly limits and the plan all move |
| **Says what it tipped over**   | If the entry takes a monthly limit to nearly or fully used, or moves the month away from the plan being followed, that is shown as soon as it is saved |
| **Edit / Move to recycle bin** | Every entry can be changed, removed, restored or deleted for good. In the transactions behind an answer it is marked _recorded by you_                 |

## 9. My corrections

Settings → **My corrections**, or **Change basket** on any transaction behind an answer.

- **Baskets.** Say which basket a purchase really belongs to and whether it was a need or a
  choice, for that one purchase or for every purchase of its kind. The correction is used
  everywhere at once: baskets, recommendations, what-ifs, safe to spend.
- **Expected bills.** Correct a bill's amount or day ("the rent went up"), or say it is not
  a regular bill.
- **Nothing is lost.** Each correction is listed beside what the app had worked out, with
  **Undo**; **Undo all corrections** puts everything back.

## 10. Mortgage guide

Settings → **Mortgage guide**, or ask the coach "how does a mortgage application work?".

What applying for a mortgage looks like, taught from the 200 applications in the dataset:
the steps in order with when each typically happens, how long the whole thing takes, what
it costs along the way, how much own money is typical, and why applications are turned
down, with what each reason means. A customer who has an application in the bank's records
also sees **their own**: the outcome, the figures and the full timeline.

It explains. It never predicts or decides whether anyone would get a loan.

## 11. Settings

| Setting                     | Options                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| **Language**                | A selector: English, Suomi, Svenska                                                         |
| **Notifications**           | Device notifications and the app-icon badge, on or off                                      |
| **What to notify me about** | A switch per kind: shortfall, habits, bills, goals, plan, limits, tips, announcements       |
| **Quiet hours**             | No notifications between two hours you choose; they wait in the app                         |
| **Two-step sign-in**        | A six-digit code from an authenticator app after the password. Set up by scanning a QR code |
| **Theme**                   | System, Light, Dark                                                                         |
| **Text size**               | Small, Medium, Large, Extra large                                                           |
| **Voice replies**           | Read answers aloud automatically                                                            |
| **AI coach**                | On or off. Off withdraws consent: nothing more goes to an AI service                        |
| **Your data**               | Privacy notice, terms of use, recycle bin, download my data, delete my app data             |
| **Account**                 | Sign out                                                                                    |

## 12. Recycle bin

Deleting a goal, a plan, a view, a widget, a linked account, a set-aside, a monthly limit,
a recorded income or expense, a friend or a cleared conversation moves it here. Each item can be **restored** or
**deleted permanently**, and the bin can be emptied.

---

## Things that apply everywhere

- **Forms** are opened by a button and filled one question at a time, with progress shown
  from the first step, a hint on each step and suggestions to tap.
- **Confirmations** appear briefly at the bottom of the screen when something is saved,
  changed, deleted, restored or sent.
- **If something fails to load**, the page says so and offers to try again; a broken page
  shows a plain message with a way back, never a blank screen.
- **Add to Home Screen** installs the app with its own icon and opens it full-screen.
- **Motion** is switched off for people who have asked their device to reduce it.
- **Without AI** the coach still answers the questions in the table above by recognising
  keywords, with the same calculations and charts.
