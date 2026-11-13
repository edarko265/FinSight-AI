const QUESTIONS = [
  { title: "Where does my money go?", body: "Spending explained through three baskets." },
  {
    title: "What should I protect first?",
    body: "A conservative estimate with every assumption visible.",
  },
  {
    title: "What could I change?",
    body: "What-if scenarios you can adjust, backed by your own transactions.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <p className="w-fit rounded-full border border-border bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
        Synthetic demo data · not a real bank account
      </p>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">FinSight-AI</h1>
        <p className="text-base text-muted">
          Understand your money, protect what matters, and explore what you can change. Every answer
          is backed by evidence you can inspect.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {QUESTIONS.map((question) => (
          <li key={question.title} className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-base font-medium">{question.title}</h2>
            <p className="mt-1 text-sm text-muted">{question.body}</p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted">
        Project scaffold. The coach, basket view and scenarios are being built.
      </p>
    </main>
  );
}
