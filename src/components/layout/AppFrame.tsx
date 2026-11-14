"use client";

import { useEffect } from "react";

/**
 * The frame the signed-in app is drawn in. It follows the part of the screen
 * that is actually visible rather than the page: on a phone the browser's
 * bars, the on-screen keyboard and a home-screen app's status bar all change
 * that area, and a frame that ignores them ends up pushed under the top edge
 * with a gap below it. The page behind the frame is also stopped from
 * scrolling, so nothing can drag the frame out of place.
 */
export function AppFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    root.classList.add("fs-app");

    const fit = (): void => {
      // While the customer has zoomed in, the visible area is a detail of the page, not its size.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      const visible = viewport?.height ?? window.innerHeight;
      // From the home screen some iPhones report the page shorter than the screen it fills
      // (see SafeArea). Unless a keyboard is taking the space, the whole screen is ours.
      const screen = Number.parseFloat(root.style.getPropertyValue("--screen-height")) || 0;
      const height = screen > visible && screen - visible < 120 ? screen : visible;
      const top = viewport?.offsetTop ?? 0;
      root.style.setProperty("--app-height", `${Math.round(height)}px`);
      root.style.setProperty("--app-top", `${Math.round(top)}px`);
    };
    // After the keyboard closes, some phones leave the page scrolled a little: put it back.
    const settle = (): void => {
      window.setTimeout(() => {
        if (!(document.activeElement instanceof HTMLElement && isTyping(document.activeElement))) {
          window.scrollTo(0, 0);
        }
        fit();
      }, 120);
    };

    fit();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", settle);
    window.addEventListener("pageshow", settle);
    document.addEventListener("focusout", settle);
    return () => {
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", settle);
      window.removeEventListener("pageshow", settle);
      document.removeEventListener("focusout", settle);
      root.classList.remove("fs-app");
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--app-top");
    };
  }, []);

  return <div className="fs-app-frame flex overflow-hidden bg-background">{children}</div>;
}

function isTyping(element: HTMLElement): boolean {
  return element.matches("input, textarea, select, [contenteditable='true']");
}
