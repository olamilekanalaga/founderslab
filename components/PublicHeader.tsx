"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
import Link from "next/link";
import BrandMark from "./BrandMark";
export default function PublicHeader() {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return (
    <header className="public-header" data-ready={ready}>
      <Link className="brand" href="/">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span>
          Founders Lab<small>with ⭕️La_Crrypt💰₿</small>
        </span>
      </Link>
      <nav aria-label="Programme navigation">
        <Link href="/book">Booking</Link>
        <Link className="button" href="/signin">
          Admin
        </Link>
        <Link className="button primary" href="/book">
          Apply as a founder
        </Link>
      </nav>
    </header>
  );
}
