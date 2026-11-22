"use client";
import { useEffect, useRef, useId, useState, type ReactNode } from "react";
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
        .filter((word) => /^[\p{L}\p{N}]/u.test(word))
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
  guardUnsaved = false,
  className = "",
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
  guardUnsaved?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    titleId = useId(),
    callback = useRef(close),
    baseline = useRef<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const formSnapshot = () =>
    Array.from(
      ref.current?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea") || [],
    )
      .map((el) =>
        el instanceof HTMLInputElement &&
        ["checkbox", "radio"].includes(el.type)
          ? `${el.name}:${el.checked}`
          : `${el.name}:${el.value}${
              el instanceof HTMLSelectElement && el.multiple
                ? Array.from(el.selectedOptions)
                    .map((o) => o.value)
                    .join()
                : ""
            }`,
      )
      .join("\n");
  const requestClose = () => {
    if (
      guardUnsaved &&
      baseline.current !== null &&
      baseline.current !== formSnapshot()
    )
      setDiscard(true);
    else close();
  };
  useEffect(() => {
    callback.current = requestClose;
  });
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
    baseline.current = formSnapshot();
    const listener = (e: KeyboardEvent) => {
      if (
        el !==
        document
          .querySelectorAll('[role="dialog"]')
          .item(document.querySelectorAll('[role="dialog"]').length - 1)
      )
        return;
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
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={requestClose}
          >
            <X size={20} />
          </button>
        </div>
        {discard && (
          <div className="discard-note" role="alert">
            <div>
              <b>Discard unsaved changes?</b>
              <p>Your changes have not been saved.</p>
            </div>
            <button className="button" onClick={() => setDiscard(false)}>
              Keep editing
            </button>
            <button className="button danger" onClick={close}>
              Discard changes
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function Empty({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Search size={23} />
      {title && <h3>{title}</h3>}
      <p>{children}</p>
      {action}
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
