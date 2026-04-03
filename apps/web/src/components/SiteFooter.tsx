import Link from 'next/link';

const productLinks = [
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/register-actor', label: 'Register Actor' },
  { href: '/auth/login', label: 'Get Started' },
];

const legalLinks = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/cookie-notice', label: 'Cookie Notice' },
  { href: '/data-rights-retention', label: 'Data Rights & Retention' },
];

const trustLinks = [
  { href: '/security-trust', label: 'Security & Trust' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/privacy-policy#retention', label: 'Retention Summary' },
];

const companyLinks = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact & Support' },
  { href: 'mailto:support@trulyimagined.com', label: 'Support Email' },
  { href: 'mailto:security@trulyimagined.com', label: 'Security Reports' },
];

function FooterLink({ href, label }: { href: string; label: string }) {
  const isExternal = href.startsWith('mailto:');

  if (isExternal) {
    return (
      <a
        href={href}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
    </Link>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={`${title}-${link.href}`}>
            <FooterLink href={link.href} label={link.label} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
          <FooterColumn title="Trust" links={trustLinks} />
          <FooterColumn title="Company" links={companyLinks} />
        </div>

        <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>Truly Imagined UK Limited</p>
          <p className="mt-1">Clyde Offices, 2nd Floor, 48 West George Street, Glasgow, G2 1BP</p>
          <p className="mt-3">© {new Date().getFullYear()} Truly Imagined. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
