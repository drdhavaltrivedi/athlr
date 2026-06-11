import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Athlr',
  description: 'The terms that govern your use of the Athlr app and website.',
};

export default function TermsPage() {
  return (
    <main className="legal">
      <h1>Terms of Service</h1>
      <p className="updated">Last updated: June 11, 2026</p>

      <p>
        Welcome to Athlr. These Terms of Service (&ldquo;Terms&rdquo;) govern
        your use of the Athlr mobile application and website (together, the
        &ldquo;Service&rdquo;). By creating an account or using the Service,
        you agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        Athlr is a fitness tracking application that lets you record GPS-based
        activities, import workouts from connected health platforms, view
        training statistics, and optionally share activities with a community
        feed. Core tracking features are provided free of charge; optional
        paid subscriptions (&ldquo;Athlr Pro&rdquo;) unlock additional
        analytics features.
      </p>

      <h2>2. Your Account</h2>
      <p>
        You can use most of Athlr without an account. An account (email or
        Google Sign-In) is required for community features such as the shared
        feed and kudos. You are responsible for safeguarding your credentials
        and for all activity that occurs under your account. You must be at
        least 13 years old (or the minimum age in your jurisdiction) to create
        an account.
      </p>

      <h2>3. Your Content &amp; Data</h2>
      <p>
        You own your activities, GPS routes, and health data.
        <strong> Activities are private by default.</strong> When you choose
        to set an activity&apos;s visibility to &ldquo;Followers&rdquo; or
        &ldquo;Everyone&rdquo;, you grant Athlr a limited, revocable license
        to display that activity (excluding raw GPS point data) to the
        relevant audience within the Service. You can change visibility or
        delete an activity at any time, and you can export your data as GPX at
        any time, free of charge.
      </p>

      <h2>4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose;</li>
        <li>
          Upload content that is abusive, harassing, or infringes the rights
          of others;
        </li>
        <li>
          Attempt to reverse-engineer, scrape, or disrupt the Service or its
          infrastructure;
        </li>
        <li>Impersonate another person or misrepresent recorded activities.</li>
      </ul>

      <h2>5. Subscriptions &amp; Payments</h2>
      <p>
        Athlr Pro subscriptions are billed through the Apple App Store or
        Google Play and renew automatically until cancelled in your store
        account settings. Prices are shown before purchase and may vary by
        region. If you cancel, Pro features remain active until the end of the
        current billing period. Refunds are handled per the policies of the
        respective app store.
      </p>

      <h2>6. Health &amp; Safety Disclaimer</h2>
      <p>
        Athlr provides fitness statistics for informational purposes only and
        is not a medical device. Always consult a qualified professional
        before starting a new training program. Stay aware of your
        surroundings while recording activities — your safety comes before
        any segment time.
      </p>

      <h2>7. Service Availability</h2>
      <p>
        We aim to keep the Service available at all times but do not guarantee
        uninterrupted operation. Because Athlr is offline-first, your recorded
        activities are stored on your device and are not dependent on our
        servers.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We
        may suspend or terminate accounts that violate these Terms. Upon
        termination, your locally stored data remains on your device; cloud
        data associated with your account will be deleted.
      </p>

      <h2>9. Disclaimer &amp; Limitation of Liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any
        kind. To the maximum extent permitted by law, Athlr shall not be
        liable for indirect, incidental, or consequential damages arising from
        your use of the Service, including reliance on GPS or health data
        accuracy.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. If changes are material,
        we will notify you through the app or by email before they take
        effect. Continued use of the Service after changes take effect
        constitutes acceptance.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these Terms? Reach us at{' '}
        <a href="mailto:support@athlr.app" className="accent-text">
          support@athlr.app
        </a>
        .
      </p>
    </main>
  );
}
