const ITEMS = [
  'GPG 45',
  'eIDAS 2.0',
  'W3C Verifiable Credentials',
  'GDPR Article 22',
  'SAG-AFTRA',
  'ISO 27001',
  '190+ Countries',
  'CCPA Compliant',
  'UK Digital Identity Framework',
  'EU AI Act Ready',
  'Immutable Consent Ledger',
  'Zero-Knowledge Proofs',
];

// Duplicate for seamless infinite loop
const DOUBLED = [...ITEMS, ...ITEMS];

export default function TrustMarquee() {
  return (
    <div
      aria-hidden
      className="overflow-hidden py-3.5 border-y border-blue-100/70 bg-gradient-to-r from-blue-50/40 via-white to-blue-50/40"
    >
      <div className="marquee-track items-center">
        {DOUBLED.map((item, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.22em] text-blue-400/55 px-7 flex items-center gap-7"
          >
            {item}
            <span className="inline-block w-1 h-1 rounded-full bg-yellow-400/50 shrink-0" />
          </span>
        ))}
      </div>
    </div>
  );
}
