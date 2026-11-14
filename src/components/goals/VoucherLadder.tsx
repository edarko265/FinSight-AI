"use client";

import { useRef, useState } from "react";

import { TIER_COLOUR, VoucherArt } from "@/components/goals/VoucherArt";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { nextTierId, offerText, ringOffset, statusKey } from "@/components/goals/voucher-view";
import { api, ApiError } from "@/lib/api-client";
import type { VoucherLadder as Ladder, VoucherOption, VoucherTier } from "@/lib/contracts/rewards";
import { formatMoney, formatMonth } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Progress ring around the voucher art; the numbers are always written out beside it. */
function Ring({
  tier,
  kind,
}: {
  tier: VoucherTier;
  kind: VoucherOption["kind"];
}): React.JSX.Element {
  return (
    <div className="relative size-24 shrink-0" style={{ color: TIER_COLOUR[tier.id] }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={ringOffset(RING_LENGTH, tier.progress)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
        />
      </svg>
      <VoucherArt
        kind={kind}
        className={`absolute inset-0 m-auto size-11 ${tier.unlocked ? "" : "opacity-40"}`}
      />
    </div>
  );
}

function LockIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Monthly voucher tiers: progress towards each, a pick among the unlocked ones, and the source. */
export function VoucherLadder({
  ladder,
  onChange,
  onStale,
}: {
  ladder: Ladder;
  onChange: (next: Ladder) => void;
  /** The server says the picture changed (a tier is no longer unlocked): reload the ladder. */
  onStale: () => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(false);
  /** The option highlighted but not yet confirmed. */
  const [draft, setDraft] = useState<string | null>(null);
  const inFlight = useRef(false);
  const money = (cents: number): string => formatMoney(cents, locale);
  const offer = (option: VoucherOption): ReturnType<typeof offerText> =>
    offerText(option, (key) => t(key), locale);
  const offerTitle = (option: VoucherOption): string => {
    const text = offer(option);
    return t(text.titleKey, text.params);
  };
  const offerWhat = (option: VoucherOption): string => {
    const text = offer(option);
    return t(text.whatKey, text.params);
  };

  async function run(request: () => Promise<Ladder>, done: MessageKey): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      onChange(await request());
      setDraft(null);
      toast.notify(done);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) {
        setOff(true);
      } else if (
        failure instanceof ApiError &&
        failure.status === 409 &&
        failure.code === "locked"
      ) {
        setDraft(null);
        toast.fail("voucher.lockedNow");
        onStale();
      } else {
        toast.fail();
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const confirm = (tier: VoucherTier, option: VoucherOption): Promise<void> =>
    run(
      () =>
        api<Ladder>("/api/goals/voucher", {
          method: "POST",
          json: { tierId: tier.id, optionId: option.id },
        }),
      "voucher.toast.picked",
    );
  const clear = (): Promise<void> =>
    run(() => api<Ladder>("/api/goals/voucher", { method: "DELETE" }), "voucher.toast.removed");

  const { source, selected } = ladder;
  const chosenTier = ladder.selectedValid
    ? ladder.tiers.find((tier) => tier.id === selected?.tierId)
    : undefined;
  const chosen = chosenTier?.options.find((option) => option.id === selected?.optionId);
  const chosenHere = (tier: VoucherTier): VoucherOption | undefined =>
    tier.options.find((option) => option.id === picked);
  const nextId = nextTierId(ladder.tiers);
  const current = ladder.selectedValid ? (selected?.optionId ?? null) : null;
  const picked = draft ?? current;
  if (off) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
        {t("voucher.off")}
      </p>
    );
  }
  const provisionalKey = statusKey(source.provisional);
  const sourceName = t(
    (source.id === "statfin-15ac"
      ? "voucher.source.statfin"
      : "voucher.source.other") as MessageKey,
    { name: source.name },
  );

  return (
    <div className="flex flex-col gap-3">
      {!ladder.available ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          {t("voucher.unavailable")}
        </p>
      ) : (
        <>
          {chosen && chosenTier ? (
            <div
              className="flex items-center gap-3 rounded-2xl border-2 bg-accent-soft p-4"
              style={{ borderColor: TIER_COLOUR[chosenTier.id] }}
            >
              <VoucherArt kind={chosen.kind} className="size-14 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted">
                  {t("voucher.yours", { month: formatMonth(ladder.month, locale, "long") })}
                </p>
                <p className="text-base font-semibold">
                  {t(offer(chosen).chosenKey, offer(chosen).params)}
                </p>
                <p className="text-sm text-muted">
                  {t(`voucher.tier.${chosenTier.id}` as MessageKey)}
                </p>
              </div>
              <button
                type="button"
                aria-disabled={busy}
                onClick={() => void clear()}
                className="min-h-11 shrink-0 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-50"
              >
                {t("voucher.remove")}
              </button>
            </div>
          ) : null}
          {selected && !ladder.selectedValid ? (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
              {t("voucher.invalid")}
            </p>
          ) : null}

          <p className="text-sm text-muted">
            {t("voucher.intro", { month: formatMonth(ladder.month, locale, "long") })}
          </p>

          <ul className="flex flex-col gap-3">
            {ladder.tiers.map((tier) => {
              const isNext = tier.id === nextId;
              const first = tier.options[0];
              return (
                <li
                  key={tier.id}
                  className={`rounded-2xl border bg-surface p-4 ${
                    isNext ? "border-2" : "border-border"
                  }`}
                  style={isNext ? { borderColor: TIER_COLOUR[tier.id] } : undefined}
                >
                  <div className="flex items-center gap-4">
                    {first ? <Ring tier={tier} kind={first.kind} /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="flex items-center gap-1.5 text-base font-semibold">
                          <span
                            className="inline-block size-3 rounded-full"
                            style={{ backgroundColor: TIER_COLOUR[tier.id] }}
                            aria-hidden="true"
                          />
                          {t(`voucher.tier.${tier.id}` as MessageKey)}
                        </h4>
                        {isNext ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                            {t("voucher.next")}
                          </span>
                        ) : null}
                        {tier.unlocked ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                            {t("rewards.unlocked")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm tabular-nums">
                        {t("voucher.progress", {
                          saved: money(Math.max(0, ladder.savedCents)),
                          target: money(tier.targetCents),
                        })}
                      </p>
                      {!tier.unlocked ? (
                        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                          <LockIcon />
                          <span>{t("voucher.locked", { amount: money(tier.remainingCents) })}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {tier.unlocked ? (
                    <fieldset className="mt-3 flex flex-col gap-2">
                      <legend className="sr-only">
                        {t("voucher.choose", { tier: t(`voucher.tier.${tier.id}` as MessageKey) })}
                      </legend>
                      {tier.options.map((option) => {
                        const checked = picked === option.id;
                        return (
                          <label
                            key={option.id}
                            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                              checked
                                ? "border-accent bg-accent-soft font-semibold"
                                : "border-border"
                            }`}
                          >
                            <input
                              type="radio"
                              name="voucher-option"
                              value={option.id}
                              checked={checked}
                              onChange={() => {
                                if (!inFlight.current) setDraft(option.id);
                              }}
                              className="size-5 shrink-0 accent-[var(--accent)]"
                            />
                            <VoucherArt
                              kind={option.kind}
                              className="size-8 shrink-0 text-accent"
                            />
                            <span className="min-w-0">
                              <span className="block">{offerTitle(option)}</span>
                              <span className="block text-xs font-normal text-muted">
                                {offerWhat(option)}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ) : null}
                  {tier.unlocked ? (
                    <button
                      type="button"
                      aria-disabled={busy || !chosenHere(tier) || picked === current}
                      onClick={() => {
                        const option = chosenHere(tier);
                        if (option && picked !== current) void confirm(tier, option);
                      }}
                      className="mt-3 min-h-11 w-full rounded-full bg-primary px-5 text-sm font-semibold text-on-primary aria-disabled:opacity-50"
                    >
                      {busy ? t("voucher.choosing") : t("voucher.confirm")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="text-xs text-muted">
        {ladder.available
          ? `${t("voucher.basis", {
              base: source.baseRatePercent,
              year: source.year,
              status: provisionalKey ? t(provisionalKey) : "",
            })} `
          : `${t("voucher.sourceLead")} `}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent underline"
        >
          {sourceName}
        </a>
        . {t("voucher.licence", { licence: source.licence })}
        {ladder.available && source.floorApplied
          ? ` ${t("voucher.floor", { floor: source.baseRatePercent })}`
          : ""}
      </p>
    </div>
  );
}
