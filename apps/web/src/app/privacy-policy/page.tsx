import type { Metadata } from 'next';
import PublicContentPage from '@/components/PublicContentPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | Truly Imagined',
  description:
    'How Truly Imagined UK Limited collects, uses, stores, and protects personal data for identity and consent services.',
};

export default function PrivacyPolicyPage() {
  return (
    <PublicContentPage
      title="Privacy Policy"
      summary="This policy explains what personal data we process, why we process it, and what rights you have."
      lastUpdated="3 April 2026"
    >
      <h2>1. Who We Are</h2>
      <p>
        Truly Imagined UK Limited operates this service. Our service address is Clyde Offices, 2nd
        Floor, 48 West George Street, Glasgow, G2 1BP.
      </p>
      <p>
        Contact us at <a href="mailto:privacy@trulyimagined.com">privacy@trulyimagined.com</a> or{' '}
        <a href="mailto:legal@trulyimagined.com">legal@trulyimagined.com</a>.
      </p>

      <h2>2. Scope</h2>
      <p>
        This policy applies to public website visitors, account users, identity verification
        participants, and people who contact support.
      </p>

      <h2>3. Data We Process</h2>
      <ul>
        <li>Account and profile details such as email, name, and role information.</li>
        <li>Identity verification outcomes and related verification metadata.</li>
        <li>Consent and licensing activity records needed for accountability.</li>
        <li>Support ticket communications and support metadata.</li>
        <li>Security, authentication, and operational logs.</li>
      </ul>

      <h2>4. Why We Process Data</h2>
      <ul>
        <li>To provide and secure identity, consent, and licensing services.</li>
        <li>To prevent abuse, fraud, and unauthorized access.</li>
        <li>To maintain auditable records of key platform actions.</li>
        <li>To respond to support, legal, and privacy requests.</li>
        <li>To comply with legal obligations and manage legitimate business interests.</li>
      </ul>

      <h2>5. Third-Party Service Providers</h2>
      <p>
        We use specialist providers for authentication, identity verification, infrastructure,
        monitoring, and communications. We only share data needed for those services.
      </p>

      <h2>6. International Transfers</h2>
      <p>
        Some processing may occur outside the UK. Where this happens, we use contractual and
        technical safeguards designed to protect personal data.
      </p>

      <h2 id="retention">7. Retention Periods</h2>
      <p>Retention periods may be extended where legal hold obligations apply.</p>
      <ul>
        <li>Account and profile records: active lifetime plus 24 months after closure.</li>
        <li>
          Identity verification outcomes and metadata: verification lifetime plus 5 years after
          account closure.
        </li>
        <li>Consent ledger and immutable audit trail entries: 6 years from creation.</li>
        <li>Security and abuse-prevention logs: 12 months, or up to 24 months for incidents.</li>
        <li>API access logs and rate-limiting telemetry: 12 months.</li>
        <li>Support tickets and support history: 24 months after closure.</li>
        <li>Support items linked to legal or security disputes: up to 6 years where required.</li>
        <li>
          Credential issuance and revocation records: credential lifecycle plus 6 years after expiry
          or revocation.
        </li>
        <li>Product telemetry and analytics: 13 months.</li>
        <li>Marketing records if enabled: until opt-out plus 24 months suppression retention.</li>
        <li>Cookie preference records for non-essential cookies, if used: 6 months.</li>
        <li>Privacy request case files: 3 years after closure.</li>
        <li>Backup snapshots: rolling 35 days.</li>
      </ul>

      <h2 id="rights">8. Your Rights</h2>
      <p>
        Depending on applicable law, you may request access, correction, deletion where applicable,
        restriction, objection, and data portability.
      </p>
      <p>
        Send requests to <a href="mailto:privacy@trulyimagined.com">privacy@trulyimagined.com</a>.
      </p>

      <h2>9. Important Record Integrity Notice</h2>
      <p>
        Some accountability records are designed to preserve historical integrity for legal and
        audit purposes. Where this applies, records may not be editable in the same way as profile
        information.
      </p>

      <h2>10. Security</h2>
      <p>
        We apply layered technical and organizational controls, including encryption and access
        control measures. We continuously review security operations, but no online system can be
        guaranteed risk free.
      </p>

      <h2>11. Age Restriction</h2>
      <p>This service is for users aged 18 and over.</p>

      <h2>12. Complaint Rights (ICO)</h2>
      <p>
        If you are not satisfied with how we handle your personal data request, you can raise a
        complaint with the UK Information Commissioner&apos;s Office (ICO).
      </p>
      <p>
        ICO website: <a href="https://ico.org.uk">https://ico.org.uk</a>
      </p>

      <h2>13. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. The most current version will always show the
        latest update date.
      </p>
    </PublicContentPage>
  );
}
