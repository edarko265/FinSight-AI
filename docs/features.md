# Features — what a customer can do

Everything below works in English, Finnish and Swedish, on a phone-sized screen, in light or
dark mode. Screens are listed in the order a new customer meets them.

---

## 1. Signing in

|                     |                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Where**           | `/login`                                                                                                     |
| **How**             | Tap **Sign in**. A two-step sheet asks for the customer ID, then the password                                |
| **Help on the way** | Each step says what to enter. In demo mode, example customers and the demo password can be tapped to fill in |
| **Also**            | Eye button to show the password; **Forgot password?**; language switch with flags                            |

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

| Part                                                | What it does                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Banner**                                          | The most important unread insight, for example a possible shortfall                                      |
| **Balance card**                                    | Recorded balance, and the amount that is safe to spend over the next 7 days (or the estimated shortfall) |
| **Can I afford this?**                              | Enter a price and a time span; the coach answers with what would be left                                 |
| **Views**                                           | Named sets of widgets. Three to start with: _Overview_, _Three baskets_, _Everyday spending_             |
| **Period**                                          | Last month, this month, 3, 6 or 12 months. Every widget in the view follows it                           |
| **Widgets**                                         | Charts with a plain-language summary and a note on where the numbers come from                           |
| **Chart type**                                      | Each widget has a Bars / Line / Pie switch; the choice is saved with the view                            |
| **New widget**                                      | Opens the coach; describe what you want to see and pin the result                                        |
| **Save as new view / Rename / Move to recycle bin** | Manage views                                                                                             |

The customer decides what is on the dashboard and how it is drawn. Nothing is fixed by the
bank.

## 4. Coach

Ask in your own words, by typing, by holding the microphone, or in a voice call.

### What it can answer

| Ask something like                              | You get                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Where does my money go?"                       | Spending by category, as a pie                                                                 |
| "How much did I spend on taxis last month?"     | The amount, the count, and that category by month                                              |
| "Show how my income flows"                      | A money-flow diagram: bills, essentials, everyday, investing, what was left                    |
| "Explain my three baskets"                      | Regular bills, irregular essentials, everyday spending, and how much of that was a free choice |
| "What is safe to spend this week?"              | The estimate and what was set aside to reach it                                                |
| "Can I afford a 300 € bike?"                    | What would be left after the purchase, or how far short it falls                               |
| "What if I cut restaurants by 20%?"             | The saving, and what that is over a year                                                       |
| "How do I compare with people my age?"          | Your typical month against the middle half of your age group, with Statistics Finland context  |
| "What kind of spender am I?"                    | Basket shares and your largest free-choice categories                                          |
| "What bills are coming up?"                     | Regular payments and the usual income pattern                                                  |
| "What would you recommend?"                     | Ranked suggestions, each with an estimated monthly value                                       |
| "I want to save for a trip, maybe two thousand" | A saved goal and a plan for funding it                                                         |
| "…as a pie chart" / "viivakaaviona"             | The same answer, drawn the way you asked                                                       |

### With every answer

- **A chart** and the values behind it.
- **See transactions** — the actual transactions the figure was calculated from.
- **A short lesson**, for example what an irregular essential cost is.
- **Add to dashboard** — pins the chart to the view you have open.
- **Listen** — the answer read aloud.
- **Follow-up suggestions.**
- A label saying whether the wording came from the **AI coach** or **basic mode**.

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
summary with the price. The first conversation is free. The adviser then replies in the same
place, and the conversation continues there.

## 5. Goals and rewards

| Part                              | What it does                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Your goals**                    | Each goal shows the amount, the monthly amount needed, how that compares with what is usually left over, and whether it fits                                 |
| **Tell the coach about a goal**   | Describe it in a sentence                                                                                                                                    |
| **Add a goal**                    | A four-step form: name, amount, time, review — with suggestions on each step                                                                                 |
| **Edit / Move to recycle bin**    | On each goal                                                                                                                                                 |
| **Where you could free up money** | The coach's recommendations with their monthly value                                                                                                         |
| **Rewards**                       | Points and a level for progress the data shows: a lighter month, free-choice spending down, a buffer, months with money left over, investing, setting a goal |
| **Coupons**                       | Unlock at point thresholds. Examples only                                                                                                                    |

Rewards compare a customer with their own past months, never with other people.

## 6. Insights

In-app notifications, each calculated from the customer's own data and each opening the
coach on that topic:

- a possible shortfall this week
- a bill due soon
- a category well above or below its three-month average
- small purchases adding up
- a reserve for irregular costs
- a category above the typical range for the age group
- announcements from the bank

Unread insights show as a badge on the bell and on the navigation bar. **Mark all as read**
clears them.

## 7. Settings

| Setting           | Options                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| **Language**      | English, Suomi, Svenska                                                         |
| **Theme**         | System, Light, Dark                                                             |
| **Text size**     | Small, Medium, Large, Extra large                                               |
| **Voice replies** | Read answers aloud automatically                                                |
| **AI coach**      | On or off. Off withdraws consent: nothing more goes to an AI service            |
| **Your data**     | Privacy notice, terms of use, recycle bin, download my data, delete my app data |
| **Account**       | Sign out                                                                        |

## 8. Recycle bin

Deleting a goal, a view or a widget moves it here. Each item can be **restored** or
**deleted permanently**, and the bin can be emptied.

---

## Things that apply everywhere

- **Forms** are opened by a button and filled one question at a time, with progress shown
  from the first step, a hint on each step and suggestions to tap.
- **Confirmations** appear briefly at the bottom of the screen when something is saved,
  changed, deleted, restored or sent.
- **Add to Home Screen** installs the app with its own icon and opens it full-screen.
- **Motion** is switched off for people who have asked their device to reduce it.
- **Without AI** the coach still answers the questions in the table above by recognising
  keywords, with the same calculations and charts.
