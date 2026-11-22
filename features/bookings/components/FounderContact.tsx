import { MessageCircle, Send } from "lucide-react";

// Public account-ID mapping for @ola_crrypt; keep this as a string to avoid
// rounding the 64-bit ID. Source: https://gist.github.com/travisbrown/bbbaf9cbc615062433e9b2eb82e24d0a
const xDirectMessageUrl =
  "https://x.com/messages/compose?recipient_id=1506909333740826628";

export function FounderContact() {
  return (
    <section
      className="founder-contact"
      aria-labelledby="founder-contact-heading"
    >
      <h2 id="founder-contact-heading">
        <MessageCircle size={23} aria-hidden="true" />
        Let’s connect before your Space
      </h2>
      <p>
        Have a question about your application or want to share more about what
        you’re building? Message me directly.
      </p>
      <div className="founder-contact-actions">
        <a
          className="button primary"
          href={xDirectMessageUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          <MessageCircle size={19} aria-hidden="true" />X DM
        </a>
        <a
          className="button"
          href="https://t.me/ola_crrypt"
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          <Send size={19} aria-hidden="true" />
          Telegram
        </a>
      </div>
    </section>
  );
}
