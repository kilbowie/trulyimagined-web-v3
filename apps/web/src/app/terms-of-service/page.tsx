import type { Metadata } from 'next';
import PublicContentPage from '@/components/PublicContentPage';

export const metadata: Metadata = {
  title: 'Terms of Service | Truly Imagined',
  description: 'Terms governing access to the Truly Imagined identity and consent platform.',
};

export default function TermsOfServicePage() {
  return (
    <PublicContentPage
      title="Terms of Service"
      summary="These terms govern access to and use of the Truly Imagined platform."
      lastUpdated="3 April 2026"
    >
      <h2>1. Agreement</h2>
      <p>
        These Terms form a binding agreement between you and Truly Imagined UK Limited when you use
        this service.
      </p>

      <h2>2. Eligibility</h2>
      <p>You must be at least 18 years old to use this platform.</p>

      <h2>3. Account Responsibilities</h2>
      <ul>
        <li>You must provide accurate and current information.</li>
        <li>You are responsible for protecting your account credentials.</li>
        <li>You are responsible for actions taken through your account.</li>
      </ul>

      <h2>4. Service Scope</h2>
      <p>
        The platform provides identity, consent, and licensing workflow support for performers. The
        service is designed to support control and accountability but cannot guarantee prevention of
        all external misuse.
      </p>

      <h2>5. Consent and Records</h2>
      <p>
        Revoking consent can affect future permissions. Historical accountability records may remain
        where retention is required for legal, security, or audit reasons.
      </p>

      <h2>6. Prohibited Use</h2>
      <ul>
        <li>Fraudulent behavior or impersonation.</li>
        <li>Unauthorized access attempts or system abuse.</li>
        <li>Any unlawful use of the platform.</li>
      </ul>

      <h2>7. Third-Party Dependencies</h2>
      <p>
        Some functions rely on third-party providers. Availability and outcomes may be affected by
        those services.
      </p>

      <h2>8. Suspension and Termination</h2>
      <p>
        We may suspend or terminate accounts for breach of these Terms, security risk, or legal
        necessity.
      </p>

      <h2>9. Disclaimers and Liability</h2>
      <p>
        The service is provided on an "as available" basis. Nothing in these Terms limits liability
        where limitation is not allowed by applicable law.
      </p>

      <h2>10. Governing Law</h2>
      <p>These Terms are governed by the laws of Scotland.</p>

      <h2>11. Contact</h2>
      <p>
        Legal notices and terms questions can be sent to{' '}
        <a href="mailto:legal@trulyimagined.com">legal@trulyimagined.com</a>.
      </p>

      <h2>12. Related Pages</h2>
      <p>
        For supporting information, see our <a href="/privacy-policy">Privacy Policy</a>,{' '}
        <a href="/cookie-notice">Cookie Notice</a>,{' '}
        <a href="/data-rights-retention">Data Rights and Retention</a>,{' '}
        <a href="/security-trust">Security and Trust</a>, and{' '}
        <a href="/contact">Contact and Support</a> pages.
      </p>
    </PublicContentPage>
  );
}
