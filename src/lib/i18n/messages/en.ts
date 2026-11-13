/** English messages. The Finnish and Swedish files must define exactly the same keys. */
export const en = {
  // Navigation and shell
  "app.name": "FinSight-AI",
  "app.synthetic": "Synthetic demo data",
  "app.asOf": "Demo as of {date}",
  "nav.dashboard": "Dashboard",
  "nav.chat": "Coach",
  "nav.insights": "Insights",
  "nav.settings": "Settings",

  // Login
  "login.title": "Welcome back",
  "login.subtitle": "Sign in to talk with your money.",
  "login.customerId": "Customer ID",
  "login.customerIdHint": "For example CUST03707",
  "login.password": "Password",
  "login.showPassword": "Show password",
  "login.hidePassword": "Hide password",
  "login.submit": "Sign in",
  "login.submitting": "Signing in…",
  "login.forgot": "Forgot password?",
  "login.error": "That customer ID or password is not right.",
  "login.tooMany": "Too many attempts. Please wait a minute and try again.",
  "login.demoTitle": "Demo customers",
  "login.demoHint": "This is a demo on synthetic data. Pick a customer to fill in the form.",
  "login.persona.steady": "Steady month",
  "login.persona.tight": "Tight before payday",
  "login.persona.young": "Young adult",
  "login.persona.senior": "Retired",
  "login.notBank": "Not a real bank login. No real accounts are connected.",
  "forgot.title": "Reset your password",
  "forgot.subtitle": "Enter your customer ID and we will send reset instructions.",
  "forgot.submit": "Send instructions",
  "forgot.sent":
    "If that customer exists, reset instructions have been sent. In this demo all customers share the demo password shown on the sign-in page.",
  "forgot.back": "Back to sign in",

  // Settings
  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.theme": "Theme",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.theme.system": "System",
  "settings.fontSize": "Text size",
  "settings.fontSize.small": "Small",
  "settings.fontSize.medium": "Medium",
  "settings.fontSize.large": "Large",
  "settings.fontSize.xlarge": "Extra large",
  "settings.voice": "Voice replies",
  "settings.voiceHint": "Read the coach's answers aloud.",
  "settings.account": "Account",
  "settings.signedInAs": "Signed in as {id}",
  "settings.signOut": "Sign out",
  "settings.privacy": "Your data",
  "settings.privacyBody":
    "Your transactions are stored encrypted with a key that belongs only to your account. The AI model receives totals and short summaries, never your transaction list.",

  // Chat
  "chat.intro":
    "Hi! Ask me about your spending, what is safe to spend, or what a change would be worth. I show the numbers behind every answer.",
  "chat.placeholder": "Ask about your money",
  "chat.send": "Send",
  "chat.thinking": "Thinking…",
  "chat.error": "Something went wrong on my side. Please try again.",
  "chat.addToDashboard": "Add to dashboard",
  "chat.added": "Added",
  "chat.seeTransactions": "See transactions",
  "chat.why": "Why this answer?",
  "chat.modeAi": "AI coach",
  "chat.modeBasic": "Basic mode (no AI)",
  "chat.listen": "Listen",
  "chat.stop": "Stop",
  "chat.speak": "Speak",
  "chat.listening": "Listening…",
  "chat.voiceCall": "Voice call",
  "chat.endCall": "End call",
  "chat.micDenied": "Microphone access is needed for voice.",
  "chat.suggest.where": "Where does my money go?",
  "chat.suggest.taxi": "How much did I spend on taxis last month?",
  "chat.suggest.safe": "What is safe to spend this week?",
  "chat.suggest.whatif": "What if I cut restaurants by 20%?",
  "chat.suggest.spender": "What kind of spender am I?",
  "chat.suggest.peers": "How do I compare with people my age?",
  "chat.suggest.bills": "What bills are coming up?",

  // Dashboard
  "dashboard.balance": "Recorded balance",
  "dashboard.title": "My dashboard",
  "dashboard.newWidget": "New widget",
  "dashboard.empty":
    "Your dashboard is empty. Add a widget and describe what you would like to see.",
  "dashboard.remove": "Remove",
  "dashboard.safeToSpend": "Safe to spend, next 7 days",
  "dashboard.shortfall": "Estimated shortfall, next 7 days",
  "dashboard.estimate": "Estimate",
  "dashboard.widgetPrompt": "Describe what you want to see",
  "dashboard.widgetExample": "For example: restaurant spending over six months",
  "dashboard.create": "Create widget",
  "dashboard.cancel": "Cancel",
  "dashboard.noChart": "I could not make a chart from that. Try naming a category or a time span.",

  // Evidence sheet
  "chart.showValues": "Show values",
  "evidence.title": "Transactions behind this answer",
  "evidence.count": "{count} transactions",
  "evidence.empty": "No matching transactions in this data and period.",
  "evidence.close": "Close",
  "evidence.more": "Show more",
  "evidence.basket": "Basket",

  // Insights and notifications
  "insights.title": "Insights",
  "insights.empty": "Nothing needs your attention right now.",
  "insights.markRead": "Mark all as read",
  "insights.ask": "Ask the coach",
  "insight.shortfall.title": "A shortfall is possible this week",
  "insight.shortfall.body":
    "After bills and essentials, the estimate is {shortfall} short over the next {days} days.",
  "insight.bill.title": "{category} is due soon",
  "insight.bill.body": "About {amount} is usually paid around {date}.",
  "insight.spike.title": "{category} was higher than usual",
  "insight.spike.body":
    "{amount} last month, {percent}% above your three-month average of {average}.",
  "insight.drop.title": "{category} came down",
  "insight.drop.body":
    "{amount} last month, {percent}% below your three-month average of {average}.",
  "insight.buffer.title": "Your buffer is under one month of bills",
  "insight.buffer.body":
    "Regular bills are about {bills} a month and the recorded balance is {balance}.",
  "insight.reserve.title": "Plan for irregular costs",
  "insight.reserve.body":
    "Irregular essentials such as health and repairs have averaged {amount} a month. Setting that aside smooths the surprise.",
  "insight.slips.title": "Small purchases add up",
  "insight.slips.body": "{count} purchases under {limit} came to {amount} last month.",
  "insight.peers.title": "{category}: above people your age",
  "insight.peers.body":
    "You average {amount} a month; the typical range for ages {band} is {low}–{high}.",

  // Categories
  "cat.Housing": "Housing",
  "cat.Utilities": "Utilities",
  "cat.Health": "Health",
  "cat.Home & Tech": "Home & tech",
  "cat.Groceries": "Groceries",
  "cat.Transportation": "Transport",
  "cat.Restaurants": "Restaurants",
  "cat.Entertainment": "Entertainment",
  "cat.Lifestyle": "Lifestyle",
  "cat.Travel": "Travel",
  "cat.taxi": "Taxis",
  "cat.cafes": "Cafés and fast food",
  "cat.other": "Other",

  // Baskets
  "basket.regular": "Regular bills",
  "basket.irregular": "Irregular essentials",
  "basket.everyday": "Everyday spending",
  "basket.unclassified": "Not yet sorted",
  "basket.regular.lesson":
    "Mandatory and regular: costs like rent that come every month. Plan around them first.",
  "basket.irregular.lesson":
    "Mandatory but irregular: a dentist, a broken washing machine. You cannot schedule them, but you can reserve for them.",
  "basket.everyday.lesson":
    "Everyday spending: the part that slips through your fingers, and the part you can actually steer.",
  "necessity.essential": "Essential",
  "necessity.discretionary": "Your choice",
  "necessity.unknown": "Depends on you",

  // Periods
  "period.month": "{month}",
  "period.range": "{from} – {to}",
  "period.monthToDate": "{month} so far",

  // Coach answers
  "coach.basis": "Based on recorded synthetic transactions, {period}. Demo as of {asOf}.",
  "coach.none": "No matching transactions in this data for {period}.",
  "coach.spending.title": "Where your money went",
  "coach.spending.summary":
    "You spent {total} across {count} purchases and payments in {period}. The largest part was {top}.",
  "coach.category.title": "{category}",
  "coach.category.summary":
    "You spent {total} on {category} in {period}, across {count} transactions.",
  "coach.trend.title": "Spending by month",
  "coach.trend.summary":
    "Your spending over the last {months} months. The latest full month was {latest}.",
  "coach.categoryTrend.title": "{category} by month",
  "coach.categoryTrend.summary":
    "{category} over the last {months} months. The latest full month was {latest}.",
  "coach.balance.title": "Balance over time",
  "coach.balance.summary": "Your recorded balance at the end of each month. It is {balance} now.",
  "coach.baskets.title": "Your three baskets",
  "coach.baskets.summary":
    "In {period}: {regular} went to regular bills, {irregular} to irregular essentials and {everyday} to everyday spending. Of the everyday part, {choice} was your own choice.",
  "coach.safe.title": "Safe to spend",
  "coach.safe.ok":
    "About {available} is free to spend over the next {days} days. That is your balance of {balance} after setting aside bills, everyday essentials and a reserve.",
  "coach.safe.shortfall":
    "The estimate is {shortfall} short over the next {days} days once bills and essentials are set aside. Nothing is certain, but it is worth holding back.",
  "coach.safe.insufficient": "There is not enough history yet to estimate this safely.",
  "coach.safe.basis":
    "An estimate, not a guarantee. Expected income is not counted until it arrives. Pending payments, cash and other accounts are not visible here.",
  "coach.safe.row.balance": "Recorded balance",
  "coach.safe.row.bills": "Bills due",
  "coach.safe.row.essentials": "Everyday essentials",
  "coach.safe.row.reserve": "Irregular reserve",
  "coach.safe.row.protected": "Protected buffer",
  "coach.safe.row.available": "Free to spend",
  "coach.whatif.title": "What if: {category} −{percent}%",
  "coach.whatif.summary":
    "Cutting {category} by {percent}% would have saved {saving} in {period}. Repeated for a year, that is about {annual}. This is a what-if, not a promise.",
  "coach.whatif.row.now": "As it was",
  "coach.whatif.row.after": "With the cut",
  "coach.whatif.row.saving": "Saved",
  "coach.peers.title": "You and people your age",
  "coach.peers.summary.lower":
    "Your {metric} averages {value} a month, below the typical range for ages {band} ({low}–{high}).",
  "coach.peers.summary.typical":
    "Your {metric} averages {value} a month, within the typical range for ages {band} ({low}–{high}).",
  "coach.peers.summary.higher":
    "Your {metric} averages {value} a month, above the typical range for ages {band} ({low}–{high}).",
  "coach.peers.basis":
    "Compared with {count} customers aged {band} in the same synthetic dataset, twelve-month monthly average. The range is the middle half of that group.",
  "coach.peers.row.you": "You",
  "coach.peers.row.low": "Lower quarter",
  "coach.peers.row.mid": "Middle",
  "coach.peers.row.high": "Upper quarter",
  "coach.peers.metric.consumption": "total spending",
  "coach.profile.title": "Your spending pattern",
  "coach.profile.summary":
    "Regular bills take {regularShare}% of your spending, irregular essentials {irregularShare}% and everyday spending {everydayShare}%. Your largest free-choice categories are {top}.",
  "coach.recurring.title": "Regular payments",
  "coach.recurring.summary":
    "From your history, these come every month: {list}. Together about {total} a month.",
  "coach.recurring.income":
    "Income usually arrives around day {days} of the month, about {amount} each time.",
  "coach.recurring.basis":
    "Suggestions from the last six full months. The data has no payee names, so these are grouped by kind of payment.",
  "coach.flow.title": "Where your income went",
  "coach.flow.income": "Money in",
  "coach.flow.invested": "Invested",
  "coach.flow.transferred": "Transferred out",
  "coach.flow.left": "Left over",
  "coach.flow.summary":
    "In {period}, {income} came in and {spent} was spent. {left} was left after spending, investing and transfers.",
  "coach.flow.summaryOver":
    "In {period}, {income} came in and {spent} was spent. Spending, investing and transfers were {left} more than what came in.",
  "chat.suggest.flow": "Show how my income flows",
  "views.preset.overview": "Overview",
  "views.preset.baskets": "Three baskets",
  "views.preset.everyday": "Everyday spending",
  "views.label": "Views",
  "views.period": "Period",
  "views.period.last_month": "Last month",
  "views.period.this_month": "This month",
  "views.period.last_3_months": "3 months",
  "views.period.last_6_months": "6 months",
  "views.period.last_12_months": "12 months",
  "views.saveAs": "Save as new view",
  "views.namePlaceholder": "Name this view",
  "views.save": "Save",
  "views.delete": "Delete this view",
  "views.unnamed": "My view",
  "consent.title": "Before you use the AI coach",
  "consent.intro":
    "The AI coach uses an outside AI service to understand your questions and word its answers. Please read how your data is used.",
  "consent.point.sent":
    "What is sent: your question, and totals and short summaries calculated from your transactions.",
  "consent.point.notSent":
    "What is never sent: your transaction list, customer ID, account number, age or postal code.",
  "consent.point.voice":
    "Voice: if you use it, your spoken question and the coach's answer are processed by a speech service.",
  "consent.point.advice":
    "The coach explains and estimates. It is not financial advice, and its estimates are not guarantees.",
  "consent.point.choice":
    "It is your choice. Without AI the coach still answers common questions using calculations done here, and you can change your mind in Settings at any time.",
  "consent.readMore": "Read the full privacy notice",
  "consent.accept": "I agree, use the AI coach",
  "consent.decline": "Continue without AI",
  "settings.ai": "AI coach",
  "settings.aiOn": "You have agreed to AI processing. Switch off to withdraw your consent.",
  "settings.aiOff":
    "AI is off. The coach answers in basic mode and nothing is sent to an AI service.",
  "settings.download": "Download my data",
  "settings.erase": "Delete my app data",
  "settings.eraseConfirm":
    "Delete your saved views, read insights and consent, and sign out? This cannot be undone.",
  "settings.eraseYes": "Yes, delete",
  "settings.privacyLink": "Privacy notice",
  "privacy.title": "Privacy notice",
  "privacy.demo":
    "FinSight-AI is a prototype that runs on synthetic data supplied for a hackathon. No real customer data is processed. This notice describes how the service is designed to handle personal data.",
  "privacy.what.title": "What we process",
  "privacy.what.body":
    "Your account transactions, a basic profile (age and postal code), the dashboard views you save, which insights you have read, and your consent choices.",
  "privacy.why.title": "Why, and on what basis",
  "privacy.why.body":
    "To show and explain your own finances to you. The calculations run in this service. Sending anything to an AI or speech provider happens only with your consent, which you can withdraw at any time.",
  "privacy.ai.title": "AI and speech providers",
  "privacy.ai.body":
    "With your consent, your question plus totals and short summaries go to a language-model provider (OpenAI or Google), and voice goes to ElevenLabs. Your transaction list and identifiers are never sent. No decision with legal effect is made automatically.",
  "privacy.security.title": "How it is protected",
  "privacy.security.body":
    "Your data is encrypted before it is stored, with a key that belongs only to your account, and the service is designed to be hosted in the EU. Connections are encrypted. Staff with database access cannot read it.",
  "privacy.rights.title": "Your rights",
  "privacy.rights.body":
    "You can see and download your data, withdraw consent, and delete what the app has stored about you, all from Settings. You may also complain to the data protection authority.",
  "privacy.retention.title": "How long",
  "privacy.retention.body":
    "Sign-in sessions end after eight hours. Conversations are not stored. Saved views and consent are kept until you delete them.",
  "privacy.back": "Back",
  "coach.fallback":
    "I can show where your money goes, what is safe to spend, what a cut would save, your regular payments, or how you compare with people your age.",
  "coach.statfin.title": "You and households in Finland",
  "coach.statfin.summary":
    "Across Finland, households in the {band} age group spent about {average} a month per adult on {category} ({year}). You average {value}.",
  "coach.statfin.basis":
    "Statistics Finland, household budget survey {year}, per consumption unit. One account is not a whole household and the categories differ slightly, so read this as context, not a ranking.",
} as const;

export type MessageKey = keyof typeof en;
