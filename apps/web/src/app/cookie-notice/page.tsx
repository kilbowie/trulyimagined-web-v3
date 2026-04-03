import type { Metadata } from 'next';
import PublicContentPage from '@/components/PublicContentPage';

export const metadata: Metadata = {
  title: 'Cookie Notice | Truly Imagined',
  description: 'Cookie and similar technology notice for the Truly Imagined website and platform.',
};

export default function CookieNoticePage() {
  return (
    <PublicContentPage
      title="Cookie Notice"
      summary="This notice explains how cookies and similar technologies are used on this service."
      lastUpdated="3 April 2026"
    >
      <h2>1. What Cookies Are</h2>
      <p>
        Cookies are small text files stored in your browser that help websites operate and remember
        state.
      </p>

      <h2>2. Cookies We Currently Use</h2>
      <p>
        We currently use essential cookies required for authentication, session continuity, and
        security controls.
      </p>

      <h2>3. Non-Essential Cookies</h2>
      <p>
        If non-essential analytics or marketing cookies are introduced, this notice will be updated
        before those categories are activated.
      </p>

      <h2>4. Cookie Durations</h2>
      <ul>
        <li>Session cookies are removed when your browser session ends.</li>
        <li>Persistent security or preference cookies remain for limited configured durations.</li>
      </ul>

      <h2>5. Managing Cookies</h2>
      <p>
        You can manage or delete cookies in your browser settings. Disabling essential cookies may
        prevent login and core service functions.
      </p>

      <h2>6. Related Policies</h2>
      <p>
        For broader personal data and user-rights information, see our{' '}
        <a href="/privacy-policy">Privacy Policy</a>,{' '}
        <a href="/data-rights-retention">Data Rights and Retention</a>,{' '}
        <a href="/terms-of-service">Terms of Service</a>, and{' '}
        <a href="/contact">Contact and Support</a> pages.
      </p>
    </PublicContentPage>
  );
}
