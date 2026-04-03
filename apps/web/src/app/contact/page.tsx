import type { Metadata } from 'next';
import PublicContentPage from '@/components/PublicContentPage';

export const metadata: Metadata = {
  title: 'Contact & Support | Truly Imagined',
  description: 'Contact routes for support, legal notices, privacy requests, and security reports.',
};

export default function ContactPage() {
  return (
    <PublicContentPage
      title="Contact & Support"
      summary="Use the right channel for product support, legal notices, privacy requests, and security reports."
      lastUpdated="3 April 2026"
    >
      <h2>1. Contact Channels</h2>
      <ul>
        <li>
          Product support: <a href="mailto:support@trulyimagined.com">support@trulyimagined.com</a>
        </li>
        <li>
          Privacy and data rights:{' '}
          <a href="mailto:privacy@trulyimagined.com">privacy@trulyimagined.com</a>
        </li>
        <li>
          Legal notices: <a href="mailto:legal@trulyimagined.com">legal@trulyimagined.com</a>
        </li>
        <li>
          Security incidents:{' '}
          <a href="mailto:security@trulyimagined.com">security@trulyimagined.com</a>
        </li>
      </ul>

      <h2>2. Response Targets</h2>
      <p>
        We aim to respond to most requests within two business days. Complex legal, privacy, or
        security matters may require more time.
      </p>

      <h2>3. What to Include</h2>
      <ul>
        <li>The email address linked to your account, if applicable.</li>
        <li>A concise issue summary and expected outcome.</li>
        <li>Relevant timestamps, links, or screenshots.</li>
      </ul>

      <h2>4. Privacy Requests</h2>
      <p>
        Data rights requests are handled through privacy@trulyimagined.com. We may request identity
        verification before making account-level changes.
      </p>

      <h2>5. Security Reporting</h2>
      <p>
        For suspected vulnerabilities, suspicious account activity, or potential incidents, contact
        security@trulyimagined.com as soon as possible and include steps to reproduce where safe.
      </p>
    </PublicContentPage>
  );
}
