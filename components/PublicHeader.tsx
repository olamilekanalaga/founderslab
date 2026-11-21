"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
import Link from "next/link";
import BrandMark from "./BrandMark";
import { ArrowUpRight } from "lucide-react";
export default function PublicHeader() {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return (
    <header className="public-header" data-ready={ready}>
      <Link className="brand" href="/">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span>
          Founders Lab<small>with Ola_Crrypt</small>
        </span>
      </Link>
      <nav aria-label="Programme navigation">
        <Link href="/book">Spaces</Link>
        <Link href="/terms">Programme terms</Link>
        <Link className="button" href="/demo">
          Explore demo <ArrowUpRight size={14} />
        </Link>
        <Link className="button primary" href="/apply">
          Apply as a founder
        </Link>
      </nav>
    </header>
  );
}
