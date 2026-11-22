"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/#about", label: "About" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/book", label: "Book a Space" },
];
export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-header programme-header">
      <Link
        className="brand"
        href="/"
        aria-label="Founders Lab with Ola_Crrypt — Home"
        onClick={() => setOpen(false)}
      >
        <span className="brand-mark" aria-hidden="true">
          <BrandMark />
        </span>
        <span>
          Founders Lab<small>with Ola_Crrypt</small>
        </span>
      </Link>
      <button
        type="button"
        className="programme-menu-toggle"
        aria-label={
          open ? "Close programme navigation" : "Open programme navigation"
        }
        aria-expanded={open}
        aria-controls="programme-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav
        id="programme-navigation"
        aria-label="Programme navigation"
        className={open ? "is-expanded" : ""}
      >
        {publicLinks.map(({ href, label }) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </Link>
        ))}
        <Link
          className="button primary"
          href="/book"
          onClick={() => setOpen(false)}
        >
          Book a Founder Space
        </Link>
      </nav>
    </header>
  );
}
