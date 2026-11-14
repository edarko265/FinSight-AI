"use client";

import { useEffect, useRef, useState } from "react";

import { TIER_COLOUR, VoucherArt } from "@/components/goals/VoucherArt";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { nextTierId, offerText, ringOffset } from "@/components/goals/voucher-view";
import { api, ApiError } from "@/lib/api-client";
import type { VoucherLadder as Ladder, VoucherOption, VoucherTier } from "@/lib/contracts/rewards";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Progress ring around the voucher art; the numbers are always written out beside it. */
function Ring({
  tier,
  kind,
  large = false,
}: {
  tier: VoucherTier;
  kind: VoucherOption["kind"];
  large?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`relative shrink-0 ${large ? "size-24" : "size-16"}`}
      style={{ color: TIER_COLOUR[tier.id] }}
    >
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
        className={`absolute inset-0 m-auto ${large ? "size-11" : "size-7"} ${tier.unlocked ? "" : "opacity-40"}`}
      />
    </div>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0 text-accent"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 5 5 9-10" />
    </svg>
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

/** Monthly voucher tiers: progress towards each and a pick among the unlocked ones. */
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
  /** The stage being looked at; null follows the current stage. */
  const [look, setLook] = useState<number | null>(null);
  const strip = useRef<HTMLOListElement>(null);
  const money = (cents: number): string => formatMoney(cents, locale);
  const offer = (option: VoucherOption): ReturnType<typeof offerText> =>
    offerText(option, (key) => t(key), locale);
  const offerTitle = (option: VoucherOption): string => {
    const text = offer(option);
    return t(text.titleKey, text.params);
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

  const { selected } = ladder;
  const chosenTier = ladder.selectedValid
    ? ladder.tiers.find((tier) => tier.id === selected?.tierId)
    : undefined;
  const chosen = chosenTier?.options.find((option) => option.id === selected?.optionId);
  const chosenHere = (tier: VoucherTier): VoucherOption | undefined =>
    tier.options.find((option) => option.id === picked);
  const nextId = nextTierId(ladder.tiers);
  const lastIndex = ladder.tiers.length - 1;
  // The current stage is the first locked one, or the last once everything is unlocked.
  const currentIndex = nextId ? ladder.tiers.findIndex((tier) => tier.id === nextId) : lastIndex;
  const focusIndex = Math.min(lastIndex, Math.max(0, look ?? currentIndex));
  const focusTier = ladder.tiers[focusIndex];

  /** Each stage is a third of the strip wide, so stage `index` is centred at index * that width. */
  const scrollToStage = (index: number, smooth: boolean): void => {
    const node = strip.current;
    if (!node) return;
    node.scrollTo({
      left: (index * node.clientWidth) / 3,
      behavior: smooth ? "smooth" : "instant",
    });
  };
  const hasStrip = ladder.available && focusTier !== undefined;
  // Start with the current stage in the middle.
  useEffect(() => {
    if (hasStrip) scrollToStage(currentIndex, false);
    // Only when the strip first appears; later scrolling is the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStrip]);
  const current = ladder.selectedValid ? (selected?.optionId ?? null) : null;
  const picked = draft ?? current;
  if (off) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
        {t("voucher.off")}
      </p>
    );
  }
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

          {focusTier ? (
            <>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  aria-label={t("voucher.stage.prev")}
                  disabled={focusIndex === 0}
                  onClick={() => scrollToStage(focusIndex - 1, true)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-accent disabled:opacity-30"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <ol
                  ref={strip}
                  onScroll={(event) => {
                    const node = event.currentTarget;
                    const index = Math.round(node.scrollLeft / (node.clientWidth / 3));
                    setLook(Math.min(lastIndex, Math.max(0, index)));
                  }}
                  className="flex min-w-0 flex-1 snap-x snap-mandatory items-end overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <li aria-hidden="true" className="w-1/3 shrink-0" />
                  {ladder.tiers.map((tier, index) => {
                    const art = tier.options[0];
                    const middle = index === focusIndex;
                    return (
                      <li
                        key={tier.id}
                        className="flex w-1/3 shrink-0 snap-center flex-col items-center gap-1"
                      >
                        <button
                          type="button"
                          aria-current={middle ? "step" : undefined}
                          onClick={() => scrollToStage(index, true)}
                          className={`flex min-h-11 flex-col items-center gap-1 rounded-2xl px-1 py-1 ${
                            middle ? "" : "opacity-70"
                          }`}
                        >
                          {art ? <Ring tier={tier} kind={art.kind} large={middle} /> : null}
                          <span className="flex items-center gap-1 text-sm font-semibold">
                            {tier.unlocked ? <CheckIcon /> : <LockIcon />}
                            {t(`voucher.tier.${tier.id}` as MessageKey)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  <li aria-hidden="true" className="w-1/3 shrink-0" />
                </ol>
                <button
                  type="button"
                  aria-label={t("voucher.stage.next")}
                  disabled={focusIndex === lastIndex}
                  onClick={() => scrollToStage(focusIndex + 1, true)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-accent disabled:opacity-30"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>

              {(() => {
                const tier = focusTier;
                const isNext = tier.id === nextId;
                return (
                  <div
                    className={`rounded-2xl border bg-surface p-4 ${
                      isNext ? "border-2" : "border-border"
                    }`}
                    style={isNext ? { borderColor: TIER_COLOUR[tier.id] } : undefined}
                  >
                    <div className="flex items-center gap-4">
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
                        <p className="mt-1 flex items-center gap-1.5 text-sm tabular-nums">
                          {tier.unlocked ? null : <LockIcon />}
                          {t("voucher.progress", {
                            saved: money(Math.max(0, ladder.savedCents)),
                            target: money(tier.targetCents),
                          })}
                        </p>
                      </div>
                    </div>

                    {tier.unlocked ? (
                      <fieldset className="mt-3 flex flex-col gap-2">
                        <legend className="sr-only">
                          {t("voucher.choose", {
                            tier: t(`voucher.tier.${tier.id}` as MessageKey),
                          })}
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
                              <span className="min-w-0">{offerTitle(option)}</span>
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
                  </div>
                );
              })()}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
