import type { GoalPlan } from "@/lib/coach/advice";

/** Money the customer has marked as set aside. */
export interface SetAside {
  id: string;
  /** The goal it is for, or null for a general reserve. */
  goalId: string | null;
  cents: number;
  date: string;
}

/** A goal's plan together with how far the customer has got. */
export type GoalProgress = GoalPlan & {
  /** Money the customer has marked as set aside for this goal. */
  savedCents: number;
  /** Share of the target reached, 0 to 100. */
  percent: number;
  /** Months still needed at the planned monthly amount. */
  monthsLeft: number;
  /** Whether what is set aside keeps up with the plan since the goal was made. */
  pace: "ahead" | "on_track" | "behind";
  setAsides: SetAside[];
  /** Month by month since the goal started: what the plan expected and what was set aside. */
  curve: { month: string; plannedCents: number; savedCents: number }[];
};

/** Whole months between two dates, never negative. */
function monthsBetween(from: string, to: string): number {
  const [fy = 0, fm = 1] = from.split("-").map(Number);
  const [ty = 0, tm = 1] = to.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

function curveOf(plan: GoalPlan, own: SetAside[], asOf: string): GoalProgress["curve"] {
  const [year = 2026, month = 1] = plan.goal.createdOn.split("-").map(Number);
  const months = monthsBetween(plan.goal.createdOn, asOf);
  const curve: GoalProgress["curve"] = [];
  for (let step = 0; step <= Math.min(months, 60); step += 1) {
    const index = year * 12 + (month - 1) + step;
    const key = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    curve.push({
      month: key,
      plannedCents: Math.min(plan.goal.targetCents, step * plan.goal.monthlyCents),
      // Everything set aside up to the end of that month.
      savedCents: own
        .filter((item) => item.date.slice(0, 7) <= key)
        .reduce((sum, item) => sum + item.cents, 0),
    });
  }
  return curve;
}

export function goalProgress(plan: GoalPlan, setAsides: SetAside[], asOf: string): GoalProgress {
  const own = setAsides
    .filter((item) => item.goalId === plan.goal.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const savedCents = own.reduce((sum, item) => sum + item.cents, 0);
  // By now the plan expected one monthly amount for each month since the goal was made.
  const expected = Math.min(
    plan.goal.targetCents,
    monthsBetween(plan.goal.createdOn, asOf) * plan.goal.monthlyCents,
  );
  return {
    ...plan,
    savedCents,
    percent: Math.min(100, Math.round((savedCents / Math.max(1, plan.goal.targetCents)) * 100)),
    monthsLeft: Math.ceil(
      Math.max(0, plan.goal.targetCents - savedCents) / Math.max(1, plan.goal.monthlyCents),
    ),
    pace:
      savedCents >= expected + plan.goal.monthlyCents
        ? "ahead"
        : savedCents >= expected
          ? "on_track"
          : "behind",
    setAsides: own,
    curve: curveOf(plan, own, asOf),
  };
}
