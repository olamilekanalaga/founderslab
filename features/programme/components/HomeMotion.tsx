"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function HomeMotion({ children }: { children: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = main.current;
    const hero = container?.querySelector<HTMLElement>(".fl-hero");
    const bar = progress.current;
    if (!container || !hero || !bar) return;
    const home = container.parentElement;

    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const sections =
      container.querySelectorAll<HTMLElement>("[data-home-reveal]");
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                (entry.target as HTMLElement).dataset.homeVisible = "";
                observer?.unobserve(entry.target);
              }
            },
            { threshold: 0.08 },
          )
        : undefined;
    let frame = 0;

    const markInteracted = () => {
      if (!container.hasAttribute("data-home-interacted"))
        container.dataset.homeInteracted = "";
    };

    const update = () => {
      frame = 0;
      if (!motion.matches) return;
      const y = Math.max(0, window.scrollY);
      const height = document.documentElement.clientHeight;
      const distance = document.documentElement.scrollHeight - height;
      const heroScroll = Math.min(1, y / Math.max(1, height * 0.65));
      const pageScroll = Math.min(1, y / Math.max(1, distance));
      if (y > 20) markInteracted();
      hero.style.setProperty("--fl-hero-scroll", String(heroScroll));
      bar.style.transform = `scaleX(${pageScroll})`;
    };

    function schedule() {
      if (motion.matches && !frame)
        frame = window.requestAnimationFrame(update);
    }

    function applyPreference() {
      observer?.disconnect();
      if (motion.matches) {
        sections.forEach((section) => {
          if (!section.hasAttribute("data-home-visible"))
            observer?.observe(section);
        });
        schedule();
      } else {
        markInteracted();
      }
    }

    const size =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(schedule)
        : undefined;
    size?.observe(container);
    home?.addEventListener("pointerdown", markInteracted, {
      once: true,
      passive: true,
    });
    home?.addEventListener("focusin", markInteracted, { once: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", applyPreference);
    applyPreference();

    return () => {
      observer?.disconnect();
      size?.disconnect();
      window.cancelAnimationFrame(frame);
      home?.removeEventListener("pointerdown", markInteracted);
      home?.removeEventListener("focusin", markInteracted);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", applyPreference);
    };
  }, []);

  return (
    <main id="main-content" ref={main}>
      <div className="fl-home-progress" ref={progress} aria-hidden="true" />
      {children}
    </main>
  );
}
