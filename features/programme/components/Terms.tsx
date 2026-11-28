"use client";
import Link from "next/link";

import { ArrowRight } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";

import { PARTICIPATION_TERMS } from "@/lib/programme-policy";

import PublicFooter from "@/components/layout/PublicFooter";
export function Terms() {
  return (
    <div className="public-app">
      <PublicHeader />
      <main className="public-form-page prose" id="main-content">
        <div className="eyebrow">PROGRAMME TERMS & PRIVACY</div>
        <h1>Clear expectations. Informed participation.</h1>
        <h2>Founder participation</h2>
        <p>{PARTICIPATION_TERMS}</p>
        <p>
          Previous programme terms, recorded decisions and any obligations
          already incurred remain applicable to their historical records. These
          terms describe new participation.
        </p>
        <h2>Privacy and research</h2>
        <p>
          We use your registration and business discovery answers to review
          participation, arrange your Space and prepare independent research.
          Research findings are exploratory. Your discovery answers and private
          working notes are available to authorised research staff. Only
          information you approve will be discussed publicly. Leave out
          confidential financial figures, credentials and customer data.
          Promotional consent is separate and optional. Publishing research also
          requires administrator approval.
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
