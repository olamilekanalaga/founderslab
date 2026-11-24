"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";
const links = [
  { href: "/", label: "Home" },
  { href: "/#about", label: "About" },
  { href: "/#how-it-works", label: "How It Works" },
];
export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="public-header programme-header fl-header">
      <Link
        className="brand"
        href="/"
        aria-label="Founders Lab with ⭕️La_Crrypt💰₿, Home"
        onClick={() => setOpen(false)}
      >
        <span className="brand-mark" aria-hidden="true">
          <BrandMark />
        </span>
        <span>
          Founders Lab<small>with ⭕️La_Crrypt💰₿</small>
        </span>
      </Link>
      <button
        ref={toggle}
        type="button"
        className="programme-menu-toggle"
        aria-label={
          open ? "Close programme navigation" : "Open programme navigation"
        }
        aria-expanded={open}
        aria-controls="programme-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <X size={21} aria-hidden="true" />
        ) : (
          <Menu size={21} aria-hidden="true" />
        )}
      </button>
      <nav
        id="programme-navigation"
        aria-label="Programme navigation"
        className={open ? "is-expanded" : ""}
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={
              link.href === "/" && pathname === "/" ? "page" : undefined
            }
            onClick={() => setOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <Link
          className="fl-action fl-action-primary"
          href="/#choose-a-sunday"
          onClick={() => setOpen(false)}
        >
          Choose a Sunday <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}
