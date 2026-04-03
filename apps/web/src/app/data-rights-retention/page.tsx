import type { Metadata } from 'next';
import PublicContentPage from '@/components/PublicContentPage';

export const metadata: Metadata = {
  title: 'Data Rights and Retention | Truly Imagined',
  description:
    'How to exercise your data rights and how long different categories of data are retained.',
};

export default function DataRightsRetentionPage() {
  return (
    <PublicContentPage
      title="Data Rights and Retention"
      summary="This page explains how to submit rights requests and how long key data categories are retained."
      lastUpdated="3 April 2026"
    >
      <h2>1. Your Data Rights</h2>
      <p>
        Depending on applicable law, you may request access, correction, deletion where applicable,
        restriction, objection, and data portability.
      </p>
      <p>
        To make a request, email{' '}
        <a href="mailto:privacy@trulyimagined.com">privacy@trulyimagined.com</a>.
      </p>

      <h2>2. Request Handling Process</h2>
      <ul>
        <li>We confirm receipt and open a request case.</li>
        <li>We may ask for identity verification before account-level changes.</li>
        <li>We assess applicable legal and technical constraints.</li>
        <li>We respond with outcome and next steps.</li>
      </ul>

      <h2>3. Retention Periods</h2>
      <p>Retention periods can be extended where legal hold obligations apply.</p>
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

      <h2>4. Integrity and Historical Records</h2>
      <p>
        Some accountability records are maintained to preserve historical integrity for legal and
        audit purposes. In these cases, records may not be editable in the same way as profile
        fields.
      </p>

      <h2>5. Related Policies</h2>
      <p>
        See our <a href="/privacy-policy">Privacy Policy</a>,{' '}
        <a href="/terms-of-service">Terms of Service</a>, and{' '}
        <a href="/contact">Contact and Support</a> page for related information.
      </p>
    </PublicContentPage>
  );
}
