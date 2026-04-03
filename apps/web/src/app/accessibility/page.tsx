import type { Metadata } from 'next';
import PublicContentPage from '@/components/PublicContentPage';

export const metadata: Metadata = {
  title: 'Accessibility Statement | Truly Imagined',
  description: 'Accessibility approach, known limitations, and support routes for Truly Imagined.',
};

export default function AccessibilityPage() {
  return (
    <PublicContentPage
      title="Accessibility Statement"
      summary="We aim to make this service usable for as many people as possible and continue to improve accessibility over time."
      lastUpdated="3 April 2026"
    >
      <h2>1. Our Approach</h2>
      <p>
        We aim to design and maintain pages with clear structure, meaningful labels, keyboard
        support, and readable contrast where possible.
      </p>

      <h2>2. Current Status</h2>
      <p>
        Accessibility is an active workstream. We do not currently claim full conformance to a
        formal accessibility standard across all pages.
      </p>

      <h2>3. Known Limitations</h2>
      <p>
        Some workflows may need improvement for screen readers, keyboard navigation depth, or
        content clarity. We prioritize fixes based on severity and user impact.
      </p>

      <h2>4. Feedback and Assistance</h2>
      <p>
        If you experience an accessibility issue, contact{' '}
        <a href="mailto:support@trulyimagined.com">support@trulyimagined.com</a> with details of
        the page and issue.
      </p>

      <h2>5. Related Policies</h2>
      <p>
        You can also review our <a href="/contact">Contact and Support</a> and{' '}
        <a href="/privacy-policy">Privacy Policy</a> pages.
      </p>
    </PublicContentPage>
  );
}
