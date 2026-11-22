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
import UpcomingSpaces from "./UpcomingSpaces";
import HeroBookingPreview from "./HeroBookingPreview";
import { ProgrammeAvailability } from "./ProgrammeAvailability";
const questions = [
  [
    "Who is Founders Lab for?",
    "Founders Lab is for Web3 founders who want to introduce their products, share their journey and reach an audience interested in discovering what they’re building.",
  ],
  [
    "Will my information and Space appearance be public?",
    "Your application details remain private.\n\nYour X Space appearance is public and recorded. After each session, we also publish a free weekly recap featuring the founders, their products and what they shared.\n\nThis gives your project additional exposure beyond the live Space, at no cost to you.",
  ],
  [
    "Does participation cost anything?",
    "Participation is free. No fee, investment or token purchase is required. Applications are reviewed before a place is confirmed.",
  ],
  [
    "Where and when do we meet?",
    "On X Spaces, every Saturday at 7 PM London time. The calendar also shows the time in your timezone, with GMT and BST handled automatically.",
  ],
  [
    "What happens after I apply?",
    "The programme team reviews your application and booking request. Save your private confirmation link to check your status. A pending request does not reserve a seat.",
  ],
  [
    "Do I need an account?",
    "No founder account is required. Choose an available Saturday and send your application. Your private confirmation link is your way to check the request.",
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
            <div className="fl-hero-copy">
              <span className="fl-eyebrow">
                <Mic2 size={15} aria-hidden="true" /> A weekly space for Web3
                builders
              </span>
              <h1 id="programme-title">
                Meet the founders <span>building Web3.</span>
              </h1>
              <p>
                Join weekly X conversations with Web3 founders. Choose a
                Saturday, apply, and share what you’re building.
              </p>
              <div className="fl-hero-actions">
                <Link className="fl-action fl-action-primary" href="/book">
                  Choose a Saturday <ArrowRight size={18} aria-hidden="true" />
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
                Saturdays, <strong>7 PM London</strong>
              </span>
            </div>
            <div>
              <Users size={19} aria-hidden="true" />
              <span>
                <strong>Five founder projects</strong> per Space
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
            className="fl-upcoming fl-container"
            aria-labelledby="upcoming-title"
          >
            <div className="fl-section-heading">
              <div>
                <h2 id="upcoming-title">
                  Make room for your next conversation.
                </h2>
                <p>A Saturday, a few builders, and something worth sharing.</p>
              </div>
              <Link className="fl-inline-action" href="/book">
                Choose a Saturday <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <UpcomingSpaces />
            <p className="fl-section-note">
              Participation is subject to approval. Pending requests do not
              reserve a seat.
            </p>
          </section>
          <section
            id="about"
            className="fl-about fl-container"
            aria-labelledby="about-title"
          >
            <div className="fl-about-intro">
              <span className="fl-eyebrow">Built around the conversation</span>
              <h2 id="about-title">
                There’s a person
                <br />
                behind every product.
              </h2>
              <p>
                Founders Lab makes room to meet them. Share the decisions,
                challenges and ideas behind your work with other people building
                in Web3.
              </p>
              <p>
                Hosted by ⭕️La_Crrypt💰₿, each weekly X Space brings a small group
                of founders into one conversation.
              </p>
              <Link className="fl-inline-action" href="/book">
                Find your conversation{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="fl-benefit-composition">
              <article className="fl-benefit-lead">
                <span className="fl-benefit-symbol">
                  <Lightbulb size={30} aria-hidden="true" />
                </span>
                <h3>Bring what you’re building.</h3>
                <p>
                  Introduce your product, the problem you’re solving and the
                  thinking behind it.
                </p>
                <span className="fl-benefit-phrase">
                  Your product.
                  <br />
                  Your perspective.
                </span>
              </article>
              <article className="fl-benefit-small">
                <MessageCircle size={23} aria-hidden="true" />
                <h3>Talk through the real questions.</h3>
                <p>
                  Share lessons, trade perspectives and discuss the challenges
                  you’re working through.
                </p>
              </article>
              <article className="fl-benefit-small">
                <Network size={23} aria-hidden="true" />
                <h3>Find common ground.</h3>
                <p>
                  Meet other builders and explore shared interests that are
                  worth following up.
                </p>
              </article>
            </div>
          </section>
          <section
            id="how-it-works"
            className="fl-process fl-container"
            aria-labelledby="process-title"
          >
            <div className="fl-process-intro">
              <h2 id="process-title">How It Works</h2>
              <p>Your next conversation starts with a Saturday.</p>
            </div>
            <ol className="fl-process-steps">
              <li>
                <span>
                  <CalendarDays size={23} aria-hidden="true" />
                </span>
                <h3>Choose your Saturday</h3>
                <p>
                  Pick an available date. See the live places left and the time
                  where you are.
                </p>
              </li>
              <li>
                <span>
                  <FileText size={23} aria-hidden="true" />
                </span>
                <h3>Tell us your story</h3>
                <p>
                  Send your founder and project details. The programme team
                  reviews your request.
                </p>
              </li>
              <li>
                <span>
                  <Mic2 size={23} aria-hidden="true" />
                </span>
                <h3>Join the conversation</h3>
                <p>
                  Once approved, join the scheduled X Space and keep the
                  connection going.
                </p>
              </li>
            </ol>
          </section>
          <section
            className="fl-questions fl-container"
            aria-labelledby="questions-title"
          >
            <div>
              <span className="fl-eyebrow">Before you join</span>
              <h2 id="questions-title">
                A few things
                <br />
                worth knowing.
              </h2>
              <p>
                A small commitment.
                <br />A clear idea of what comes next.
              </p>
              <Link className="fl-inline-action" href="/terms">
                Programme terms & privacy{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="fl-faq-list">
              {questions.map(([question, answer]) => (
                <details key={question}>
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
          <section className="fl-partner-note fl-container">
            <Network size={23} aria-hidden="true" />
            <div>
              <h3>Know a founder who should be here?</h3>
              <p>
                Share the programme with them. Selected BD and ecosystem
                introductions are invitation-only.
              </p>
            </div>
            <Link className="fl-inline-action" href="/book">
              Choose a Saturday <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
          <section
            className="fl-final fl-container"
            aria-labelledby="cta-title"
          >
            <div>
              <h2 id="cta-title">What are you building?</h2>
              <p>There’s a conversation waiting to happen.</p>
            </div>
            <Link className="fl-action fl-action-primary" href="/book">
              Choose a Saturday <ArrowRight size={19} aria-hidden="true" />
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
