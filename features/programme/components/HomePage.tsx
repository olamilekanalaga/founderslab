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
import HomeMotion from "./HomeMotion";
import { ProgrammeAvailability } from "./ProgrammeAvailability";
const questions = [
  [
    "Who is FoundersLab for?",
    "FoundersLab is for Web3 founders who want to talk openly about what they’re building, who it’s for and what they’re learning from users and the wider industry.",
  ],
  [
    "Will my information and Space appearance be public?",
    "Your application details remain private.\n\nYour X Space appearance is public and recorded. After each session, we also publish a free weekly recap featuring the founders, their products and what they shared.",
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
    "The programme team reviews your application and booking request. Save your private confirmation link to check your status. A pending request does not reserve a seat.",
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
        <HomeMotion>
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
                What are you building, and <span>why does it matter?</span>
              </h1>
              <p>
                Every Sunday, FoundersLab brings Web3 founders together to
                discuss what’s happening across the industry, the problems
                they’re solving and the thinking behind what they’re building.
              </p>
              <div className="fl-hero-actions">
                <Link
                  className="fl-action fl-action-primary"
                  href="/#choose-a-sunday"
                >
                  Book a Founder Space{" "}
                  <ArrowRight size={18} aria-hidden="true" />
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
              <span className="fl-eyebrow">Built around the conversation</span>
              <h2 id="about-title">
                Beyond the product. Let’s talk about why it exists.
              </h2>
              <p>
                Markets change. New technologies emerge. User behaviour shifts.
                Yet founders continue building. What problems are worth solving?
                Who needs these products? Why are builders making these
                decisions now?
              </p>
              <p>
                Each week, we bring different founders into one conversation to
                explore these questions, share experiences and discuss the
                realities of building in Web3.
              </p>
              <Link className="fl-inline-action" href="/#choose-a-sunday">
                Find your conversation{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="fl-benefit-composition">
              <article className="fl-benefit-lead" data-home-reveal>
                <span className="fl-benefit-symbol">
                  <Lightbulb size={30} aria-hidden="true" />
                </span>
                <h3>Show people what you’re building.</h3>
                <p>
                  Explain the problem behind your product, who faces it and why
                  it matters now.
                </p>
                <span className="fl-benefit-phrase">
                  Your product.
                  <br />
                  Your perspective.
                </span>
              </article>
              <article className="fl-benefit-small" data-home-reveal>
                <MessageCircle size={23} aria-hidden="true" />
                <h3>Talk through the real questions.</h3>
                <p>
                  Talk through what you’re learning from users, how the market
                  is changing and what that means for your next decision.
                </p>
              </article>
              <article className="fl-benefit-small" data-home-reveal>
                <Network size={23} aria-hidden="true" />
                <h3>Find common ground.</h3>
                <p>
                  Exchange perspectives with other builders and explore shared
                  interests worth following up.
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
              <p>Your next conversation starts with a Sunday.</p>
            </div>
            <ol className="fl-process-steps">
              <li data-home-reveal>
                <span>
                  <CalendarDays size={23} aria-hidden="true" />
                </span>
                <h3>Choose your Sunday</h3>
                <p>
                  Pick an available date. See the live places left and the time
                  where you are.
                </p>
              </li>
              <li data-home-reveal>
                <span>
                  <FileText size={23} aria-hidden="true" />
                </span>
                <h3>Tell us your story</h3>
                <p>
                  Send your founder and project details. The programme team
                  reviews your request.
                </p>
              </li>
              <li data-home-reveal>
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
            <div data-home-reveal>
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
              <h2 id="cta-title">What are you building?</h2>
              <p>There’s a conversation waiting to happen.</p>
            </div>
            <Link
              className="fl-action fl-action-primary"
              href="/#choose-a-sunday"
            >
              Choose a Sunday <ArrowRight size={19} aria-hidden="true" />
            </Link>
            <p className="fl-final-note">
              Free participation. Application review required. No founder
              account needed.
            </p>
          </section>
        </HomeMotion>
        <PublicFooter />
      </div>
    </ProgrammeAvailability>
  );
}
