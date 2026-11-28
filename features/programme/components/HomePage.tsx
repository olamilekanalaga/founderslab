import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Mic2,
  Users,
  Check,
  MessageCircle,
  Lightbulb,
  Network,
  FileText,
  Plus,
} from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import BrandMark from "@/components/shared/BrandMark";
import {
  freeSpaceDescription,
  spaceInvitationDay,
  spaceInvitationLead,
} from "@/lib/space-registration";
import HeroBookingPreview from "./HeroBookingPreview";
import { ProgrammeAvailability } from "./ProgrammeAvailability";
const questions = [
  [
    "Who is FoundersLab for?",
    "Founders Lab is for Web3 founders with a live product who want to talk about what they’re building and what they’re learning.",
  ],
  [
    "What will we talk about?",
    "We’ll discuss your product, the problem it solves, how people use it, what you’re seeing in the market, and opportunities ahead. You choose which challenges you’re comfortable sharing.",
  ],
  [
    "What should I share before the session?",
    "Share your project name, website and a short description of what you’re building. You can leave sensitive details out of the registration form.",
  ],
  [
    "What stays private?",
    "Your registration answers stay with the team. The Space is public and recorded, and you decide what you’re comfortable sharing live. Promotional consent is a separate choice.",
  ],
  [
    "Does participation cost anything?",
    "Participation is free. No fee, investment or token purchase is required. Applications are reviewed before a place is confirmed.",
  ],
  [
    "Where and when do we meet?",
    "Join me on my X page every Sunday at 7 PM London time. The calendar also shows the time in your timezone.",
  ],
  [
    "What happens after I apply?",
    "You’ll get a private receipt immediately. A place is confirmed after the team approves your booking. We use your answers to prepare for the live Space. Save the receipt link to check your booking status.",
  ],
  [
    "I already booked. Do I need to register again?",
    "Your existing booking still applies. Use your private confirmation link to check its status.",
  ],
  [
    "Do I need an account?",
    "No founder account is required. Choose an available Sunday and send your application. Your private confirmation link is your way to check the request.",
  ],
];
export default function HomePage() {
  return (
    <ProgrammeAvailability>
      <div className="public-app programme-home fl-home">
        <PublicHeader />
        <main id="main-content">
          <section
            className="fl-hero fl-container"
            aria-labelledby="programme-title"
          >
            <div className="fl-hero-opening" aria-hidden="true">
              <div className="fl-opening-mark">
                <BrandMark size={88} />
              </div>
            </div>
            <div className="fl-hero-copy">
              <span className="fl-eyebrow">
                <Mic2 size={15} aria-hidden="true" /> FoundersLab · Free X Space
              </span>
              <h1 id="programme-title">
                {spaceInvitationLead} <span>{spaceInvitationDay}</span>
              </h1>
              <p>{freeSpaceDescription}</p>
              <div className="fl-hero-actions">
                <Link className="fl-action fl-action-primary" href="/apply">
                  Start registration <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link className="fl-action fl-action-text" href="#how-it-works">
                  How it works <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <HeroBookingPreview />
          </section>
          <div
            className="fl-facts fl-container"
            aria-label="Programme at a glance"
          >
            <div>
              <Mic2 size={19} aria-hidden="true" />
              <span>
                Hosted by <strong>⭕️La_Crrypt💰₿</strong>
              </span>
            </div>
            <div>
              <Clock3 size={19} aria-hidden="true" />
              <span>
                Sundays, <strong>7 PM London</strong>
              </span>
            </div>
            <div>
              <Users size={19} aria-hidden="true" />
              <span>
                <strong>Four founder projects</strong> per Space
              </span>
            </div>
            <div>
              <Check size={19} aria-hidden="true" />
              <span>
                <strong>Free</strong> participation
              </span>
            </div>
          </div>
          <section
            id="about"
            className="fl-about fl-container"
            aria-labelledby="about-title"
          >
            <div className="fl-about-intro" data-home-reveal>
              <span className="fl-eyebrow">Sunday X Spaces</span>
              <h2 id="about-title">Tell us what you’re building.</h2>
              <p>
                Come on my X page to introduce your product, the problem it
                solves and the people it helps.
              </p>
              <p>
                We’ll talk about what you’re learning from users, where there’s
                demand and what opportunities you see ahead.
              </p>
              <Link className="fl-inline-action" href="/apply">
                See the registration format{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="fl-benefit-composition">
              <article className="fl-benefit-lead" data-home-reveal>
                <span className="fl-benefit-symbol">
                  <Lightbulb size={30} aria-hidden="true" />
                </span>
                <h3>Introduce your product.</h3>
                <p>
                  Share what it does, who it’s for and why you started building
                  it.
                </p>
                <span className="fl-benefit-phrase">
                  Your product.
                  <br />
                  Your story.
                </span>
              </article>
              <article className="fl-benefit-small" data-home-reveal>
                <MessageCircle size={23} aria-hidden="true" />
                <h3>Talk about your users.</h3>
                <p>
                  Tell us how people use your product and what you’re learning
                  about demand.
                </p>
              </article>
              <article className="fl-benefit-small" data-home-reveal>
                <Network size={23} aria-hidden="true" />
                <h3>Explore what’s ahead.</h3>
                <p>
                  Share opportunities you see and any challenges you’re
                  comfortable discussing.
                </p>
              </article>
            </div>
          </section>
          <section
            id="how-it-works"
            className="fl-process fl-container"
            aria-labelledby="process-title"
          >
            <div className="fl-process-intro" data-home-reveal>
              <h2 id="process-title">How It Works</h2>
              <p>
                Choose a Sunday, tell us about your product, and join me live.
              </p>
            </div>
            <ol className="fl-process-steps">
              <li data-home-reveal>
                <span>
                  <CalendarDays size={23} aria-hidden="true" />
                </span>
                <h3>Choose your Sunday</h3>
                <p>Read what to expect, then choose an available Sunday.</p>
              </li>
              <li data-home-reveal>
                <span>
                  <FileText size={23} aria-hidden="true" />
                </span>
                <h3>Tell us about your product</h3>
                <p>
                  Send a short description and choose what you’re comfortable
                  discussing on air.
                </p>
              </li>
              <li data-home-reveal>
                <span>
                  <Mic2 size={23} aria-hidden="true" />
                </span>
                <h3>Join me live on X</h3>
                <p>
                  Once your booking is approved, come on my X page for the
                  Sunday Space.
                </p>
              </li>
            </ol>
          </section>
          <section
            className="fl-questions fl-container"
            aria-labelledby="questions-title"
          >
            <div data-home-reveal>
              <span className="fl-eyebrow">Before you join</span>
              <h2 id="questions-title">
                A few things
                <br />
                worth knowing.
              </h2>
              <p>What to share, what stays private and how booking works.</p>
              <Link className="fl-inline-action" href="/terms">
                Programme terms & privacy{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="fl-faq-list">
              {questions.map(([question, answer]) => (
                <details key={question} data-home-reveal>
                  <summary>
                    {question}
                    <Plus size={19} aria-hidden="true" />
                  </summary>
                  {answer.split("\n\n").map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </details>
              ))}
            </div>
          </section>
          <section className="fl-partner-note fl-container" data-home-reveal>
            <Network size={23} aria-hidden="true" />
            <div>
              <h3>Know a founder who should be here?</h3>
              <p>
                Share the programme with them. Selected BD and ecosystem
                introductions are invitation-only.
              </p>
            </div>
            <Link className="fl-inline-action" href="/#choose-a-sunday">
              Choose a Sunday <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
          <section
            className="fl-final fl-container"
            aria-labelledby="cta-title"
            data-home-reveal
          >
            <div>
              <h2 id="cta-title">See you on Sunday.</h2>
              <p>Share what you’re building in a free X Space.</p>
            </div>
            <Link className="fl-action fl-action-primary" href="/apply">
              Start registration <ArrowRight size={19} aria-hidden="true" />
            </Link>
            <p className="fl-final-note">
              Free participation. Application review required. No founder
              account needed.
            </p>
          </section>
        </main>
        <PublicFooter />
      </div>
    </ProgrammeAvailability>
  );
}
