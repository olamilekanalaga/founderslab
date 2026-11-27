---
name: founderslab-motion
description: Apply IFAGRITHM-inspired frontend motion to FoundersLab. Use for homepage animation, staggered entrances, scroll reveals, booking card transitions, and button feedback. Use when asked to bring the IFAGRITHM feel to FoundersLab's public frontend.
---

# FoundersLab motion

Use motion to guide attention from the homepage headline to the live Sunday booking card. Preserve FoundersLab's own typography, purple palette, brand assets and content.

## Reference patterns

IFAGRITHM combines staggered entrances, soft ease-outs, scroll reveals and quiet background motion with React and CSS. The headline and feature visuals move in sequence. Its canvas pauses when off-screen or in a hidden tab and uses a static frame for reduced motion. [IFAGRITHM frontend source](https://github.com/olamilekanalaga/IFAGRITHM-Website/tree/d9acd0cedec6c47d47b8f2c070a430a6b33328a1/components) · [Motion styles](https://github.com/olamilekanalaga/IFAGRITHM-Website/blob/d9acd0cedec6c47d47b8f2c070a430a6b33328a1/app/globals.css)

Adapt the pacing and hierarchy. Start with CSS and the existing FoundersLab animation rules. Use JavaScript only for state or visibility that CSS cannot express.

## Apply to FoundersLab

1. Read `features/programme/components/HomePage.tsx`, `features/programme/components/HeroBookingPreview.tsx`, and `app/public-experience.css`. Reuse `fl-enter`, the current booking card and the existing public motion preferences.
2. Stage the hero from headline and copy to the primary action and booking preview. Keep the heading readable, date details stable, and controls active from the first render. As starting values, use a 350–550 ms ease-out, 8–12 px of vertical travel, and 60–90 ms of stagger. Start with `cubic-bezier(.16, 1, .3, 1)`. Keep the full sequence under a second.
3. Give **About** and **How It Works** a single, subtle entrance as they come into view if it adds hierarchy. Use one scoped `IntersectionObserver` and unobserve each revealed section. The static page should remain visible if JavaScript fails or observation is unavailable.
4. For button feedback, use a 150–220 ms colour or transform transition. Limit hover lift to fine pointers, keep the keyboard focus indicator, and preserve touch targets. Use a transform or opacity change without shifting neighbouring controls.
5. Keep /book navigation, the active Sunday and locked dates, form validation, inline errors and confirmation behaviour intact. Keep the initial treatment on the public homepage unless the user requests another surface. Leave full-screen intros and captured scrolling out of the booking journey.

If a decorative background is requested, keep it behind the content with no pointer events. Pause work off-screen, in hidden tabs and under reduced motion. Cap the frame rate and pixel ratio for any custom canvas. Avoid per-frame React state updates and release observers, listeners and timers when unmounting.

## Verify

- Inspect the motion at 393 px, 320 px and desktop widths. Check for layout shifts, clipped dates, or horizontal scrolling while the animation runs.
- Test the same route with `prefers-reduced-motion: reduce`. The headline, actions, availability and controls should be visible and usable immediately.
- Follow the booking link, verify the selected date carries into the form, and check keyboard focus. If the form changed, verify the first invalid field receives focus and the corrected form reaches confirmation.
- Run lint, type checks, the production build and the browser tests for the surfaces changed. Compare before and after in a local or preview browser before releasing the motion.
