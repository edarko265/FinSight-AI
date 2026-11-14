# Demo script

A three-minute walkthrough for judges, and a longer one for showing colleagues. The figures and the typed questions have been run against the real dataset. The spoken
Finnish question in the voice call has not been tried with a real voice yet: rehearse it.

An 83-second narrated film of the same story is at [`media/finsight-demo.mp4`](media/finsight-demo.mp4),
useful as a backup if the network fails on stage.

## Before you start

- Sign-in page open at `/login` on a phone, or a browser window at phone width.
- A second tab on `/admin`, signed in.
- Language on English to begin with. Sound on.
- The AI coach and Voice switched **on** in Admin → Controls.

| Customer    | Story                                                           | Use for                      |
| ----------- | --------------------------------------------------------------- | ---------------------------- |
| `CUST03707` | Steady month. Balance €1,181.97, about €1,011 safe to spend     | The main flow                |
| `CUST02226` | Tight before payday. Balance €35.21, about €170 short this week | Shortfall and "can I afford" |
| `CUST04630` | Retired, comfortable                                            | Peer comparison              |

The figures above are for the demo date, 15 September 2026.

---

## Three minutes

| Time | Do                                                                                                 | Say                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Open the sign-in page. Tap **Sign in**, pick _Steady month_, use the demo password                 | "Synthetic customer, synthetic data. No Finnish bank lets you talk to your own money yet. This does."                                       |
| 0:20 | Dashboard appears. Point at the balance card                                                       | "Balance, and what is actually safe to spend this week after bills, essentials and a reserve. An estimate, and it says so."                 |
| 0:35 | Coach → tap **How much did I spend on taxis last month?**                                          | "The model does not do the sum. It picks a calculation; our server runs it to the cent."                                                    |
| 0:50 | Tap **See transactions**                                                                           | "Every answer opens the transactions behind it. That is the trust."                                                                         |
| 1:05 | Type: _where does my money go, as a pie chart_                                                     | "The three baskets from the brief: regular bills, irregular essentials, everyday spending. And the customer chose the chart, not the bank." |
| 1:25 | Tap **Add to dashboard**, go to Dashboard, switch the widget to **Bars**                           | "They build their own dashboard and save it as a view."                                                                                     |
| 1:40 | Coach → **Start a voice call**. Ask aloud: _"Paljonko voin käyttää tällä viikolla?"_               | "Finnish, by voice, same numbers. The voice agent has no access to data; it asks our coach."                                                |
| 2:10 | End call. Type: _I want to take the kids to Lapland next winter, maybe two thousand_               | "A goal from a sentence, with a plan built from what this customer usually has left."                                                       |
| 2:30 | Goals tab                                                                                          | "Recommendations with their monthly value, and rewards for progress against their own past, not against other people."                      |
| 2:45 | Admin tab → **Controls** → switch **AI coach** off. Back to the phone, ask the taxi question again | "AI off. Same answer, same chart, labelled basic mode. And staff see what customers ask about without ever seeing who asked."               |

### If something fails live

- **No AI answer** → it falls back to basic mode by itself; carry on.
- **Voice call does not connect** → use the microphone button instead (speak, then tap
  again), or type the Finnish question.
- **Slow network** → the dashboard and all charts work without the model.

---

## Showing colleagues (ten minutes)

Work through these after the three-minute flow.

1. **My month in 30 seconds.** From the dashboard. Tap through, or switch on the speaker and
   let it read itself.
1. **First sign-in.** Sign in as a customer nobody has used, for example `CUST00123`. Show
   the terms, the privacy step and the AI choice. Choose "Not now" and show that the coach
   still answers.
1. **Can I afford this?** As `CUST02226`, tap the button on the balance card, enter 300.
   The answer says it would leave them short, and by how much.
1. **Views.** Dashboard → _Three baskets_ → change the period to 6 months → **Save as new
   view**. Delete a widget, then restore it from Settings → Recycle bin.
1. **Peers.** Ask "How do my restaurant costs compare with people my age?" Point at the
   Statistics Finland note under the chart.
1. **Languages and accessibility.** Settings → Svenska, Dark, Extra large.
1. **Talk to a person.** Coach → **Talk to a person** → request investment advice. In the
   admin tab, open the request under **Advisers** and reply. The reply appears on
   the phone.
1. **Plans.** Goals → **Plans** → **Make a plan** from _Saver_ → **Share** → _Everyone_.
   Point at the last step: "this is all anyone will see". Then, as `CUST02226` in another
   window, open the link: the same percentages, worked out on a different income.
1. **Teach the coach.** Ask "Can I get a mortgage?" as a customer. In Admin → **Teach the
   coach**, the Loans theme has a count: **Teach an answer**, start from the example, save.
   Ask again: the coach gives the bank's answer, labelled as from the team.
1. **Admin.** Overview → tap a tile to land on its section. Hover the daily chart. Change
   the adviser fee under Controls, publish an announcement, add an adviser under **Team**,
   sign in as them in a private window and see the shorter menu, then read the audit log
   under System.
1. **The trust story.** Run `pnpm db:check`, then show a row of `customer_ledgers` in the
   database console: nothing readable.

## Questions you may get

| Question                                    | Answer                                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can the AI make up a number?                | Its wording is checked against the calculation. If it states an amount the calculation did not produce, its wording is thrown away and the calculation's own sentence is shown. The admin page counts how often that happens. |
| What does the AI see?                       | The question, recent turns of the conversation, and totals. Never the transaction list, the customer ID, age or postal code. And only if the customer said yes.                                                               |
| What if the customer says no to AI?         | The coach answers the same questions by recognising keywords in three languages.                                                                                                                                              |
| Can friends see my money if I share a plan? | No. A plan holds a name and five whole percentages; there is no amount in it to share, and the shared record is not linked to you.                                                                                            |
| How does it learn?                          | Not by training on customers. Staff see which themes it could not answer and write the answer; the coach then gives exactly that.                                                                                             |
| Where is the data?                          | PostgreSQL in the EU. Each customer's history is encrypted with their own key before it is stored.                                                                                                                            |
| Is this production-ready?                   | No. It is a prototype on synthetic data. `docs/privacy.md` and `docs/security.md` list what a real launch would need.                                                                                                         |
| How would it plug into S-mobiili?           | It is a web app that installs to the home screen and can be embedded in a WebView. All data access sits behind one module, which a bank API would replace.                                                                    |
