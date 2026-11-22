"use client";

import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <span>
        Founders Lab <small>with ⭕️La_Crrypt💰₿</small>
      </span>
      <div>
        <Link href="/terms">Privacy & programme terms</Link>
        <Link href="/signin">Admin sign in</Link>
      </div>
    </footer>
  );
}
