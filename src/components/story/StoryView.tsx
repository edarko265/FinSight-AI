"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChartView } from "@/components/charts/ChartView";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon, SpeakerIcon, StopIcon } from "@/components/ui/icons";
import { useVoice } from "@/components/voice/useVoice";
import { api } from "@/lib/api-client";
import type { ChartCard } from "@/lib/contracts/chart";
import { InfoTip } from "@/components/ui/InfoTip";

interface Slide {
  id: string;
  title: string;
  text: string;
  card: ChartCard;
  lesson?: string;
}

const SLIDE_MS = 8000;

/**
 * The month as a story: full-screen slides that advance on their own, can be
 * tapped through, paused, and read aloud. Each slide is one of the coach's
 * calculations.
 */
export function StoryView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { me } = useOverview();
  const router = useRouter();
  const voice = useVoice(locale);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [narrate, setNarrate] = useState(false);
  const spoken = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ slides: Slide[] }>(`/api/story?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setSlides(data.slides);
      })
      .catch(() => {
        if (!cancelled) setSlides([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const total = slides?.length ?? 0;
  const ended = slides !== null && index >= total;
  const slide = slides?.[index];
  const canNarrate = Boolean(me?.voiceEnabled && me.aiConsent);

  const go = useCallback(
    (next: number) => {
      voice.stopSpeaking();
      spoken.current = null;
      setIndex(Math.max(0, Math.min(total, next)));
    },
    [total, voice],
  );

  // Advance on a timer, unless paused or being read aloud (then the reading sets the pace).
  useEffect(() => {
    if (!slide || paused || narrate) return;
    const timer = window.setTimeout(() => go(index + 1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [slide, paused, narrate, index, go]);

  // Read the slide aloud once, then move on when the reading stops.
  const { speak, speakingId } = voice;
  useEffect(() => {
    if (!narrate || !slide || paused) return;
    if (spoken.current !== slide.id) {
      spoken.current = slide.id;
      void speak(slide.id, slide.text);
      return;
    }
    if (speakingId === null) {
      const timer = window.setTimeout(() => go(index + 1), 900);
      return () => window.clearTimeout(timer);
    }
  }, [narrate, slide, paused, speak, speakingId, index, go]);

  const close = (): void => {
    voice.stopSpeaking();
    router.push("/dashboard");
  };

  return (
    <div
      role="dialog"
      aria-label={t("story.title")}
      className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] z-40 flex flex-col bg-brand px-[max(0px,calc((100vw-30rem)/2))] text-on-brand"
    >
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <ol className="flex gap-1.5" aria-hidden="true">
          {(slides ?? []).map((item, position) => (
            <li key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className={`block h-full rounded-full bg-primary ${
                  position === index && !paused && !narrate ? "fs-grow-x" : ""
                }`}
                style={{
                  width: position < index || position === index ? "100%" : "0%",
                  animationDuration: position === index ? `${SLIDE_MS}ms` : undefined,
                  animationTimingFunction: "linear",
                }}
              />
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">
            {t("story.title")}
            {slide ? (
              <span className="ml-2 font-normal opacity-70">
                {t("story.slide", { current: index + 1, total })}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-1">
            {canNarrate && slide ? (
              <button
                type="button"
                onClick={() => {
                  if (narrate) voice.stopSpeaking();
                  spoken.current = null;
                  setNarrate(!narrate);
                }}
                aria-pressed={narrate}
                aria-label={t(narrate ? "story.narrateOff" : "story.narrate")}
                className={`rounded-full p-2 ${narrate ? "bg-primary text-on-primary" : ""}`}
              >
                {narrate ? <StopIcon className="size-5" /> : <SpeakerIcon className="size-5" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label={t("story.close")}
              className="rounded-full p-2"
            >
              <CloseIcon />
            </button>
          </span>
        </div>
      </div>

      {slide ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Tap the left third to go back, the rest to go on; press and hold to pause. */}
          <button
            type="button"
            aria-label={t("story.previous")}
            onClick={() => go(index - 1)}
            className="absolute inset-y-0 left-0 z-10 w-1/3"
          />
          <button
            type="button"
            aria-label={t("story.next")}
            onClick={() => go(index + 1)}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
            className="absolute inset-y-0 right-0 z-10 w-2/3"
          />
          <div
            key={slide.id}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 fs-rise"
          >
            <h2 className="text-2xl font-semibold tracking-tight">{slide.title}</h2>
            <p className="text-base opacity-90">{slide.text}</p>
            <div className="rounded-2xl bg-surface p-4 text-foreground fs-pop">
              <ChartView card={slide.card} />
              <InfoTip className="mt-1">{slide.card.basis}</InfoTip>
            </div>
            {slide.lesson ? (
              <p className="rounded-2xl bg-white/10 px-4 py-3 text-sm">{slide.lesson}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center fs-rise">
          {slides === null ? null : total === 0 ? (
            <p className="text-base">{t("story.empty")}</p>
          ) : ended ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">{t("story.end.title")}</h2>
              <p className="text-base opacity-90">{t("story.end.text")}</p>
              <Link
                href="/chat"
                className="w-full rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-on-primary"
              >
                {t("story.end.ask")}
              </Link>
              <button
                type="button"
                onClick={() => go(0)}
                className="w-full rounded-full border border-white/40 px-5 py-3 text-sm font-semibold"
              >
                {t("story.end.again")}
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
