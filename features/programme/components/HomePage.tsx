import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Mic2,
  Users,
  Check,
  Network,
  MessageCircle,
  Lightbulb,
  Compass,
} from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import UpcomingSpaces from "./UpcomingSpaces";

const steps = [
  ["Choose your Saturday", "Choose an available Saturday."],
  [
    "Tell us what you’re building",
    "Submit your founder and company information.",
  ],
  ["We review your application", "Wait for application review and approval."],
  ["Join the conversation", "Join the scheduled X Space."],
  ["Keep the connection", "Stay connected with the founder network."],
];
const benefits = [
  {
    title: "Introduce your product",
    text: "Put what you’re building into words, with other founders listening.",
    Icon: Lightbulb,
  },
  {
    title: "Share your founder journey",
    text: "Talk about the decisions, lessons and experiences behind your work.",
    Icon: Compass,
  },
  {
    title: "Discuss challenges",
    text: "Bring the questions you’re working through to a thoughtful conversation.",
    Icon: MessageCircle,
  },
  {
    title: "Meet other builders",
    text: "Get to know people building across the Web3 ecosystem.",
    Icon: Users,
  },
  {
    title: "Explore potential collaborations",
    text: "Discover shared interests and possibilities worth following up.",
    Icon: Network,
  },
];
export default function HomePage() {
  return (
    <div className="public-app programme-home">
      <PublicHeader />
      <main id="main-content">
        <section
          className="programme-hero programme-container"
          aria-labelledby="programme-title"
        >
          <div className="programme-hero-copy">
            <span className="programme-kicker">
              <span /> A PLACE FOR WEB3 BUILDERS
            </span>
            <h1 id="programme-title">
              Building connections between{" "}
              <span>founders, products and opportunities.</span>
            </h1>
            <p>
              Founders Lab brings Web3 founders together through weekly
              conversations to share what they’re building, explore challenges
              and connect with other builders.
            </p>
            <div className="programme-actions">
              <Link className="button primary" href="/book">
                Book a Founder Space <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="programme-secondary" href="#how-it-works">
                How It Works <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <p className="programme-approval">
              <Check size={15} aria-hidden="true" /> Participation subject to
              approval. No founder account required.
            </p>
          </div>
          <aside
            className="programme-invitation"
            aria-label="Weekly programme information"
          >
            <div className="programme-invitation-top">
              <span>THE WEEKLY FOUNDER CONVERSATION</span>
              <Mic2 size={23} aria-hidden="true" />
            </div>
            <h2>
              Good conversations.
              <br />
              New connections.
            </h2>
            <p>
              A small group of founders.
              <br />A shared space to be heard.
            </p>
            <dl>
              <div>
                <dt>
                  <CalendarDays size={19} aria-hidden="true" /> When
                </dt>
                <dd>Every Saturday</dd>
              </div>
              <div>
                <dt>
                  <Clock3 size={19} aria-hidden="true" /> Time
                </dt>
                <dd>
                  7:00 PM London time
                  <small>GMT / BST adjusts automatically</small>
                </dd>
              </div>
              <div>
                <dt>
                  <Users size={19} aria-hidden="true" /> Format
                </dt>
                <dd>
                  Five founder-project seats<small>Live on X Spaces</small>
                </dd>
              </div>
            </dl>
            <span className="programme-invitation-note">
              Come ready to share. Leave with a new perspective.
            </span>
          </aside>
        </section>
        <section
          id="about"
          className="programme-about programme-container"
          aria-labelledby="about-title"
        >
          <span className="programme-kicker">
            BUILT AROUND THE CONVERSATION
          </span>
          <div>
            <h2 id="about-title">
              Behind every product,
              <br />
              there’s a founder.
            </h2>
            <p>
              Founders Lab is a Web3 founder conversation and
              relationship-building programme. We make room to meet the people
              behind the products, hear what they’re learning and find common
              ground.
            </p>
            <p>
              Hosted by Ola_Crrypt, each weekly X Space brings a small group of
              builders into one conversation. The connection can continue long
              after the Space ends.
            </p>
          </div>
        </section>
        <section
          id="how-it-works"
          className="programme-process"
          aria-labelledby="process-title"
        >
          <div className="programme-container">
            <div className="programme-section-heading">
              <div>
                <span className="programme-kicker">
                  FROM A DATE TO A CONVERSATION
                </span>
                <h2 id="process-title">How It Works</h2>
              </div>
              <p>A few simple steps. A real conversation.</p>
            </div>
            <ol className="programme-steps">
              {steps.map(([title, text], i) => (
                <li key={title}>
                  <span className="programme-step-number">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
            <p className="programme-process-note">
              Applications are reviewed by the programme team. Applying does not
              guarantee a place.
            </p>
          </div>
        </section>
        <section
          className="programme-benefits programme-container"
          aria-labelledby="benefits-title"
        >
          <div className="programme-section-heading">
            <div>
              <span className="programme-kicker">
                BRING YOUR PRODUCT. BRING YOUR PERSPECTIVE.
              </span>
              <h2 id="benefits-title">Why Participate?</h2>
            </div>
            <p>A chance to share, learn and connect.</p>
          </div>
          <div className="programme-benefit-grid">
            {benefits.map(({ title, text, Icon }) => (
              <article key={title}>
                <span className="programme-benefit-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <p className="programme-expectations">
            Every conversation is different. Participation does not guarantee
            investment, customers, partnerships or exposure.
          </p>
        </section>
        <section
          className="programme-upcoming programme-container"
          aria-labelledby="upcoming-title"
        >
          <div className="programme-section-heading">
            <div>
              <span className="programme-kicker">
                MAKE ROOM FOR YOUR NEXT CONVERSATION
              </span>
              <h2 id="upcoming-title">Upcoming Spaces</h2>
            </div>
            <p>Every Saturday at 7:00 PM London time.</p>
          </div>
          <UpcomingSpaces />
          <div className="programme-upcoming-footer">
            <p>
              Places are confirmed after review. Pending requests do not reserve
              a seat.
            </p>
            <Link className="button" href="/book">
              View All Available Dates{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section
          className="programme-partners programme-container"
          aria-labelledby="partners-title"
        >
          <div>
            <span className="programme-kicker">BD & ECOSYSTEM PARTNERS</span>
            <h2 id="partners-title">
              Know founders building
              <br />
              interesting Web3 products?
            </h2>
            <p>
              Founders Lab collaborates with selected ecosystem and business
              development partners who introduce relevant founders. These
              relationships are invitation-only.
            </p>
            <p>
              If you know a founder who would value the conversation, share the
              programme with them.
            </p>
          </div>
          <Link className="programme-secondary" href="/book">
            Explore the programme dates{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
        <section
          className="programme-final-cta programme-container"
          aria-labelledby="cta-title"
        >
          <span className="programme-kicker">
            LET’S START WITH A CONVERSATION
          </span>
          <h2 id="cta-title">What are you building?</h2>
          <p>Choose a Saturday and tell us about your product.</p>
          <Link className="button primary" href="/book">
            Book a Founder Space <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
