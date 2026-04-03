import type { Metadata } from 'next';
import PublicContentPage from '@/components/PublicContentPage';

export const metadata: Metadata = {
  title: 'Security & Trust | Truly Imagined',
  description:
    'How Truly Imagined approaches security, incident response, and trust safeguards for users.',
};

export default function SecurityTrustPage() {
  return (
    <PublicContentPage
      title="Security & Trust"
      summary="We publish security information using factual language that matches current operational reality."
      lastUpdated="3 April 2026"
    >
      <h2>1. Security Principles</h2>
      <ul>
        <li>Least-privilege access to systems and data.</li>
        <li>Encryption and controlled data handling practices.</li>
        <li>Monitoring and logging for service integrity and incident response.</li>
        <li>Ongoing review of platform controls and operational risk.</li>
      </ul>

      <h2>2. Identity and Consent Integrity</h2>
      <p>
        The platform is designed to support auditable identity and consent workflows. Historical
        record integrity is maintained to support accountability requirements.
      </p>

      <h2>3. Incident Response</h2>
      <p>
        We follow a staged response model: detection, containment, investigation, mitigation, and
        communication.
      </p>

      <h2>4. Responsible Disclosure</h2>
      <p>
        Please report security concerns to{' '}
        <a href="mailto:security@trulyimagined.com">security@trulyimagined.com</a>.
      </p>

      <h2>5. Certification Transparency</h2>
      <p>
        Truly Imagined does not currently claim formal third-party certification on this page.
        Statements here describe our current practices and design goals.
      </p>

      <h2>6. Related Policies</h2>
      <p>
        For legal and rights context, see our <a href="/privacy-policy">Privacy Policy</a>,{' '}
        <a href="/terms-of-service">Terms of Service</a>,{' '}
        <a href="/data-rights-retention">Data Rights and Retention</a>, and{' '}
        <a href="/contact">Contact and Support</a> pages.
      </p>
    </PublicContentPage>
  );
}
