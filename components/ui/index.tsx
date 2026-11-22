"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { X, ArrowUpRight, Search, CheckCircle2 } from "lucide-react";
export function Status({ value }: { value: string }) {
  const group =
    /^(Approved|Attended|Complete|Completed|Won|Verified|Transferred|Eligible|Active|Evidence reviewed)$/.test(
      value,
    )
      ? "success"
      : /^(Pending|Waitlisted|Draft|Researching|Reviewing|Transfer pending|In progress|Self-reported|Scheduled|Open|Proposal|Meeting|Negotiation)$/.test(
            value,
          )
        ? "warning"
        : /^(Declined|Cancelled|Lost|No-show|Inactive|Not a fit)$/.test(value)
          ? "danger"
          : "neutral";
  return (
    <span className={`status ${group}`}>
      <i />
      {value}
    </span>
  );
}
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span className={`person-avatar tone-${index % 5}`} aria-hidden="true">
      {name
        .split(" ")
        .map((v) => v[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    titleId = useId(),
    callback = useRef(close);
  useEffect(() => {
    callback.current = close;
  }, [close]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement,
      el = ref.current;
    const items = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      );
    items()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") callback.current();
      if (e.key === "Tab") {
        const nodes = items();
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Search size={23} />
      <p>{children}</p>
    </div>
  );
}
export function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}
export function Evidence({
  source,
  verification,
  confidence,
}: {
  source: string;
  verification: string;
  confidence: string;
}) {
  return (
    <div className="evidence">
      <div>
        <CheckCircle2 size={16} />
        <b>Evidence & provenance</b>
      </div>
      <p>{source}</p>
      <div className="inline">
        <Status value={verification} />
        <span>{confidence} confidence</span>
      </div>
    </div>
  );
}
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link"
    >
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
