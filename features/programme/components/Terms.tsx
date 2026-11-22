"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

import { ArrowRight } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";

import { defaultSettings } from "@/lib/catalog";

import PublicFooter from "@/components/layout/PublicFooter";
import { api } from "@/features/bookings/lib/public-api";
export function Terms() {
  const [terms, setTerms] = useState(defaultSettings.terms);
  useEffect(() => {
    void api("programme")
      .then((r) => setTerms(r.settings.terms))
      .catch(() => {});
  }, []);
  return (
    <div className="public-app">
      <PublicHeader />
      <main className="public-form-page prose" id="main-content">
        <div className="eyebrow">PROGRAMME TERMS & PRIVACY</div>
        <h1>Clear expectations. Informed participation.</h1>
        <h2>Founder participation & the monthly award</h2>
        <p>{terms}</p>
        <h2>Privacy and research</h2>
        <p>
          Applications are used to review participation, arrange sessions and
          support private founder research. Confidential contact information,
          research notes and commercial opportunities are accessible only to
          authorised team members. We do not publish your application
          automatically. Promotional consent is separate and optional;
          publication of research also requires administrator approval.
        </p>
        <h2>Recording links</h2>
        <p>
          Sessions may link to publicly hosted X Spaces recordings. The
          programme stores links, not audio uploads. Participants should
          understand the host platform’s recording practices before attending.
        </p>
        <h2>Corrections, withdrawal & retention</h2>
        <p>
          Contact ⭕️La_Crrypt💰₿ through the programme’s published X identity to
          request a correction or withdraw from future promotional use. The
          administrator reviews retained information against the programme
          retention policy. Existing public recordings may remain subject to the
          recording host’s own policies. Access tokens and invitation links are
          private and should not be shared publicly.
        </p>
        <h2>Research limitations</h2>
        <p>
          Programme participants form a convenience sample, not a representative
          census of Web3 founders. Self-reported information, missing answers
          and unverified opportunity hypotheses must be identified as such.
        </p>
        <Link className="button primary" href="/apply">
          Apply with informed consent <ArrowRight size={16} />
        </Link>
      </main>
      <PublicFooter />
    </div>
  );
}
