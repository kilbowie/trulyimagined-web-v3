import type { Metadata } from 'next';
import PublicContentPage from '@/components/PublicContentPage';

export const metadata: Metadata = {
  title: 'About Truly Imagined',
  description:
    'How Truly Imagined helps performers manage identity, consent, and licensing controls in AI workflows.',
};

export default function AboutPage() {
  return (
    <PublicContentPage
      title="About Truly Imagined"
      summary="Truly Imagined is building infrastructure that helps performers register identity, manage consent, and track accountability."
      lastUpdated="3 April 2026"
    >
      <h2>1. Why This Exists</h2>
      <p>
        Performers increasingly need clear control over how their identity and likeness may be used
        in AI workflows.
      </p>

      <h2>2. What the Platform Supports</h2>
      <ul>
        <li>Identity registration and verification workflows.</li>
        <li>Consent controls and decision history.</li>
        <li>Licensing-related accountability records.</li>
      </ul>

      <h2>3. Typical User Journey</h2>
      <ol>
        <li>Create an account and set up your profile.</li>
        <li>Complete identity and consent setup steps.</li>
        <li>Review and manage consent boundaries over time.</li>
        <li>Use dashboard tools to monitor and update preferences.</li>
      </ol>

      <h2>4. Service Boundaries</h2>
      <p>
        The platform is designed to support control and accountability, but it does not guarantee
        prevention of all unauthorized third-party behavior.
      </p>

      <h2>5. Related Legal and Trust Pages</h2>
      <p>
        See our <a href="/privacy-policy">Privacy Policy</a>,{' '}
        <a href="/terms-of-service">Terms of Service</a>,{' '}
        <a href="/cookie-notice">Cookie Notice</a>,{' '}
        <a href="/data-rights-retention">Data Rights and Retention</a>,{' '}
        <a href="/security-trust">Security and Trust</a>, and{' '}
        <a href="/contact">Contact and Support</a> pages.
      </p>
    </PublicContentPage>
  );
}
