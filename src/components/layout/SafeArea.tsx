"use client";

import { useEffect } from "react";

/** Status-bar heights to fall back on, in CSS pixels: phones with a notch or island, and without. */
const NOTCHED = 47;
const PLAIN = 20;

/**
 * Keeps the top of every screen clear of the iPhone status bar when the app
 * runs from the home screen. There the page is drawn underneath the clock and
 * the camera cut-out, and the browser is supposed to say how much room to
 * leave. Some iPhone versions report none at launch, which leaves the logo and
 * the first controls under the status bar, so when that happens the room is
 * worked out here instead. In a browser tab nothing is changed.
 */
export function SafeArea(): null {
  useEffect(() => {
    const standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const apple =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!standalone || !apple) return;

    const root = document.documentElement;
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top)";
    document.body.appendChild(probe);

    const fit = (): void => {
      const reported = Number.parseFloat(getComputedStyle(probe).paddingTop) || 0;
      const portrait = window.innerHeight >= window.innerWidth;
      if (reported >= 1 || !portrait) {
        root.style.removeProperty("--safe-top");
        root.style.removeProperty("--screen-height");
        return;
      }
      // When the page is reported shorter than the screen, the difference is the status bar.
      const missing = window.screen.height - window.innerHeight;
      const top =
        missing >= PLAIN && missing <= 70 ? missing : window.screen.height >= 812 ? NOTCHED : PLAIN;
      root.style.setProperty("--safe-top", `${Math.round(top)}px`);
      // The app really has the whole screen; AppFrame uses this while no keyboard is open.
      root.style.setProperty("--screen-height", `${window.screen.height}px`);
    };

    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    window.addEventListener("pageshow", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      window.removeEventListener("pageshow", fit);
      probe.remove();
      root.style.removeProperty("--safe-top");
      root.style.removeProperty("--screen-height");
    };
  }, []);
  return null;
}
