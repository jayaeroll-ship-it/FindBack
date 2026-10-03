import { Link } from "react-router-dom";
import { useApp } from "./context";
export default function Legal({ kind }: { kind: "privacy" | "terms" }) {
  const { config } = useApp();
  const privacy = kind === "privacy";
  const sections = privacy
    ? [
        [
          "Who operates FindBack",
          `Operator: ${config?.operator_name || "[CONFIGURE OPERATOR NAME]"}. Privacy contact: ${config?.contact_email || "[CONFIGURE CONTACT EMAIL]"}. This policy is a configuration template; the operator must review it for the jurisdictions and services actually used before launch.`,
        ],
        [
          "Accounts and essential cookies",
          "We collect your email address, display name and a securely hashed password. Expiring HttpOnly session cookies maintain sign-in; a security token protects changes to your account. Local storage remembers your cookie choices. These essential functions operate without optional analytics consent.",
        ],
        [
          "Reports, descriptions and uploaded photos",
          "Lost and found reports include item descriptions, categories, colors, brands, relevant dates and approximate areas. Approved reports and photos are public. Photos are decoded, resized and re-encoded as WebP; embedded metadata is removed. Avoid uploading identity documents, private addresses, passwords or full serial numbers.",
        ],
        [
          "Location information",
          "Coordinates are optional. We round them to a grid of approximately 2 km before saving them and do not retain the original coordinates. Text descriptions can still disclose a location, so do not include precise private addresses. If you load a map, OpenStreetMap tile servers receive normal network information, including your IP address.",
        ],
        [
          "Messages and ownership evidence",
          "Messages are accessible only to conversation participants. Ownership evidence and decision notes are accessible only to the claimant and report owner through the application. Authorized infrastructure operators may have database access for service operation; application permissions do not provide end-to-end encryption. Do not submit more evidence than needed.",
        ],
        [
          "AI processing",
          "Item photos and public descriptions are processed locally by the configured CLIP embedding model to create numerical similarity vectors. The default integration does not send this content to a hosted AI API. Visual-search photos are processed in memory and not stored. Model weights may be downloaded from the configured model registry during setup. Similarity never establishes ownership.",
        ],
        [
          "Optional analytics",
          "Optional analytics stay off until you accept them. If enabled by the operator and by your consent, FindBack records daily totals for report submissions, searches, match viewing and claim initiation. Event payloads contain only an allowed event name. They exclude personal details, precise locations, message content and claim evidence. No third-party analytics script is included by default. You can withdraw consent from the footer; previous aggregate counts cannot identify your activity.",
        ],
        [
          "Third-party services",
          "Configured services may include hosting, PostgreSQL backups, SMTP email delivery, Redis rate limits, Cloudflare Turnstile bot protection and OpenStreetMap tiles. Turnstile sends challenge-related browser data to Cloudflare. SMTP delivers password-reset emails. [CONFIGURE HOSTING, PROCESSORS, REGIONS AND THEIR PRIVACY LINKS]. Provider identifiers are controlled by backend configuration.",
        ],
        [
          "Retention and deletion",
          `Configured content retention: ${config?.retention_days ? config.retention_days + " days" : "[CONFIGURE RETENTION PERIOD]"} from creation. The operator runs the maintenance command to purge expired reports, photos, messages, evidence and notifications. Session and reset credentials expire sooner. Account settings let you remove or anonymize your profile and authored content. Other participants’ content is handled through a request to the privacy contact. [CONFIGURE BACKUP RETENTION AND DELETION TIMELINE]. No deletion timeline is guaranteed by this template.`,
        ],
        [
          "Security and requests",
          "We use authorization checks, upload validation, password hashing, expiring credentials and production HTTPS settings. You may contact the configured operator to request access, correction or deletion of your personal data. [CONFIGURE APPLICABLE RIGHTS, COMPLAINT PROCESS AND POLICY EFFECTIVE DATE]. Do not send passwords or complete reset tokens with a request.",
        ],
      ]
    : [
        [
          "About these terms",
          `Operator: ${config?.operator_name || "[CONFIGURE OPERATOR NAME]"}. Contact: ${config?.contact_email || "[CONFIGURE CONTACT EMAIL]"}. [CONFIGURE EFFECTIVE DATE, GOVERNING LAW, ELIGIBILITY AND DISPUTE PROCEDURE]. This template requires operator review before public launch.`,
        ],
        [
          "Truthful reporting",
          "Submit accurate lost and found reports for items you own, have found, or are authorized to report. Do not make false claims, impersonate others, publish private identifying information or interfere with someone else’s recovery. Keep account credentials private.",
        ],
        [
          "Prohibited content and conduct",
          "Do not upload illegal content, threats, harassment, discriminatory abuse, sexual exploitation, stolen credentials, malware, spam or fraudulent listings. Do not use the platform to sell controlled or dangerous goods, extort rewards or collect other users’ personal information.",
        ],
        [
          "Ownership verification",
          "A claim must provide truthful private evidence. The finder reviews evidence and makes a human decision. A matching score, report, message or accepted claim is not legal proof of title. FindBack does not automatically transfer ownership or approve a claim. Disputes requiring legal determination should be directed to the relevant authorities.",
        ],
        [
          "Limitations of AI matching",
          "AI compares image and text similarities alongside category, approximate location and date. Suggestions may be inaccurate, incomplete or absent. Scores are similarity measures, not probabilities of ownership. Do not rely on a score alone when returning an item.",
        ],
        [
          "Moderation",
          "Moderators can review, publish or hide reports and handle abuse reports. Administrators can manage user roles and suspend accounts. Content may be restricted for violations or safety concerns. Contact the operator to ask about a moderation decision. [CONFIGURE REVIEW AND APPEAL PROCESS].",
        ],
        [
          "Safe exchanges",
          "Keep initial conversations on the platform. Verify identifying details privately. Arrange handoffs in well-lit public places, consider bringing another person, and follow local lost-property rules. Do not send payments, passwords or full identity documents to strangers. Contact local services when an item or exchange needs specialist handling.",
        ],
        [
          "Availability, responsibility and account deletion",
          "FindBack helps people connect but cannot guarantee that an item will be recovered or that another user is trustworthy. Users remain responsible for their conduct and exchanges. [CONFIGURE LIABILITY TERMS SUBJECT TO APPLICABLE LAW; DO NOT RELY ON THIS PLACEHOLDER AS A LEGAL LIMITATION]. You may delete your account through settings or contact the operator.",
        ],
        [
          "Changes and privacy",
          "The operator must communicate material changes to these terms and maintain an accurate privacy policy. [CONFIGURE NOTICE PROCESS]. See the privacy policy for account data, photos, messages, ownership evidence, AI processing, cookies and retention.",
        ],
      ];
  return (
    <article className="container legal page">
      <p className="eyebrow">TRUST & TRANSPARENCY</p>
      <h1>{privacy ? "Privacy policy" : "Terms & conditions"}</h1>
      <div className="info-strip">
        Operator review required: bracketed values are configuration
        placeholders, not legal guarantees.
      </div>
      {sections.map(([title, body]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ))}
      <Link to={privacy ? "/terms-and-conditions" : "/privacy-policy"}>
        {privacy ? "Read the terms & conditions" : "Read the privacy policy"}
      </Link>
    </article>
  );
}
