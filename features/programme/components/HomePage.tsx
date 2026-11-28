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
import HeroBookingPreview from "./HeroBookingPreview";
import { ProgrammeAvailability } from "./ProgrammeAvailability";
const questions = [
  [
    "Who is FoundersLab for?",
    "Founders Lab is for Web3 founders with a live product and a business challenge they want to investigate, such as attracting customers, finding a revenue model or improving operations.",
  ],
  [
    "What do I get from the Space?",
    "We independently research your challenge and use the live Space to discuss findings, possible solutions and ways to test them. The findings are exploratory.",
  ],
  [
    "What should I share before the session?",
    "Tell us what you build, who it serves, how it earns money or plans to, what you’ve tried and what a good outcome looks like. Leave out confidential financial figures, customer data and credentials.",
  ],
  [
    "What stays private?",
    "Your registration answers and the team’s working notes are private. The Space is public and recorded. We’ll discuss only the business information you approve for the live conversation. Promotional consent is a separate choice.",
  ],
  [
    "Does participation cost anything?",
    "Participation is free. No fee, investment or token purchase is required. Applications are reviewed before a place is confirmed.",
  ],
  [
    "Where and when do we meet?",
    "On X Spaces, every Sunday at 7 PM London time. The calendar also shows the time in your timezone, with GMT and BST handled automatically.",
  ],
  [
    "What happens after I apply?",
    "You’ll get a private receipt immediately. A place is confirmed after the team approves your booking. We use your answers to prepare for the live Space. Save the receipt link to check your booking status.",
  ],
  [
    "I already booked. Do I need to register again?",
    "Use the private business discovery link from the Founders Lab team to add your answers to your existing booking.",
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
                <Mic2 size={15} aria-hidden="true" /> FoundersLab · WEEKLY WEB3
                SPACES
              </span>
              <h1 id="programme-title">
                Bring a business challenge.{" "}
                <span>Explore practical solutions.</span>
              </h1>
              <p>
                Founders Lab researches real challenges facing Web3 businesses.
                Every Sunday on X Spaces, we discuss our findings, practical
                options and what you could test next.
              </p>
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
              <span className="fl-eyebrow">Independent business research</span>
              <h2 id="about-title">More than a conversation.</h2>
              <p>
                Bring a business problem you want to solve. We’ll look into your
                product, customers and business model before the Space.
              </p>
              <p>
                We’ll use the live conversation to discuss possible solutions
                and how you could test or implement them.
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
                <h3>Get a fresh look at your business.</h3>
                <p>
                  We look at your challenge, what you’ve tried and where there
                  may be room to grow.
                </p>
                <span className="fl-benefit-phrase">
                  Your challenge.
                  <br />
                  Your next steps.
                </span>
              </article>
              <article className="fl-benefit-small" data-home-reveal>
                <MessageCircle size={23} aria-hidden="true" />
                <h3>Explore opportunities.</h3>
                <p>
                  Discuss ways to reach customers, develop new revenue streams
                  or improve how your business operates.
                </p>
              </article>
              <article className="fl-benefit-small" data-home-reveal>
                <Network size={23} aria-hidden="true" />
                <h3>Discuss practical solutions live.</h3>
                <p>
                  Talk through our findings on X Spaces and identify a next step
                  worth trying.
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
                Read the format, choose a Sunday and tell us what to research.
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
                <h3>Tell us about your challenge</h3>
                <p>
                  Share your business information, what you’ve tried and what
                  you’d like to change. We review the request and prepare
                  research.
                </p>
              </li>
              <li data-home-reveal>
                <span>
                  <Mic2 size={23} aria-hidden="true" />
                </span>
                <h3>Discuss the findings live</h3>
                <p>
                  Once your booking is approved, join the X Space to discuss
                  proposed solutions and agree on possible next steps.
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
              <h2 id="cta-title">What would you like to solve?</h2>
              <p>
                Bring a challenge for independent research and live discussion.
              </p>
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
