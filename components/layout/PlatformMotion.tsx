"use client";

import { useEffect, useRef } from "react";

const revealTargets = [
  "[data-home-reveal]",
  ".auth-card",
  ".founder-application-heading",
  ".public-form .form-section-title",
  ".public-form .record-form > label",
  ".public-form :is(.application-logo, .privacy-notice, button[type='submit'])",
  ".confirmation-page > .panel",
  ".prose > :is(h1, h2, p, .button)",
  ".manager-page :is(.panel, h1)",
  ".workspace-main :is(.page-heading, .panel, .metric-card, .founder-tile, .profile-banner, .filter-bar)",
].join(", ");

export default function PlatformMotion() {
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = progress.current;
    if (!bar) return;

    const root = document.documentElement;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    let main: HTMLElement | null = null;
    let hero: HTMLElement | null = null;
    let frame = 0;
    let scanNeeded = true;

    function dismissOpening() {
      document
        .querySelector(".fl-home main")
        ?.setAttribute("data-home-interacted", "");
    }

    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries, activeObserver) => {
              for (const entry of entries) {
                if (
                  !entry.isIntersecting ||
                  !(entry.target instanceof HTMLElement)
                )
                  continue;
                entry.target.dataset.motionVisible = "";
                entry.target.dataset.motionEntering = "";
                activeObserver.unobserve(entry.target);
              }
            },
            { threshold: 0.06 },
          )
        : undefined;

    const size =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(schedule)
        : undefined;

    function scan() {
      scanNeeded = false;
      const nextMain = document.getElementById("main-content");
      if (nextMain !== main) {
        main = nextMain;
        size?.disconnect();
        if (main) size?.observe(main);
      }
      hero = main?.querySelector(".fl-hero") ?? null;
      observer?.disconnect();
      if (motion.matches && !main?.closest('[data-visual-effects="reduced"]'))
        main?.querySelectorAll(revealTargets).forEach((target) => {
          if (!target.hasAttribute("data-motion-visible"))
            observer?.observe(target);
        });
    }

    const update = () => {
      frame = 0;
      if (scanNeeded) scan();
      if (
        !main ||
        !motion.matches ||
        main.closest('[data-visual-effects="reduced"]')
      ) {
        bar.style.removeProperty("transform");
        return;
      }

      const y = Math.max(0, window.scrollY);
      const height = root.clientHeight;
      const distance = root.scrollHeight - height;
      bar.style.transform = `scaleX(${Math.min(1, y / Math.max(1, distance))})`;
      if (hero) {
        if (y > 20 && !main.hasAttribute("data-home-interacted"))
          dismissOpening();
        hero.style.setProperty(
          "--fl-hero-scroll",
          String(Math.min(1, y / Math.max(1, height * 0.65))),
        );
      }
    };

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    function rescan() {
      scanNeeded = true;
      schedule();
    }

    function applyPreference() {
      if (!motion.matches) dismissOpening();
      rescan();
    }

    function finishEntrance(event: AnimationEvent) {
      if (
        event.animationName === "fl-scroll-reveal" &&
        event.target instanceof HTMLElement
      )
        event.target.removeAttribute("data-motion-entering");
    }

    // App Router navigation and client-loaded panels can replace the content after mount.
    const content = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.type === "attributes" ||
            [...record.addedNodes, ...record.removedNodes].some(
              (node) => node instanceof Element,
            ),
        )
      )
        rescan();
    });
    content.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-visual-effects"],
    });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("pointerdown", dismissOpening, { passive: true });
    document.addEventListener("focusin", dismissOpening);
    document.addEventListener("animationend", finishEntrance);
    document.addEventListener("animationcancel", finishEntrance);
    motion.addEventListener("change", applyPreference);
    applyPreference();

    return () => {
      content.disconnect();
      observer?.disconnect();
      size?.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("pointerdown", dismissOpening);
      document.removeEventListener("focusin", dismissOpening);
      document.removeEventListener("animationend", finishEntrance);
      document.removeEventListener("animationcancel", finishEntrance);
      motion.removeEventListener("change", applyPreference);
    };
  }, []);

  return <div className="fl-page-progress" ref={progress} aria-hidden="true" />;
}
