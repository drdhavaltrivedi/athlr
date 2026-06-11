import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Athlr',
  description:
    'How Athlr handles your data: private by default, on-device first, never sold.',
};

export default function PrivacyPage() {
  return (
    <main className="legal">
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: June 11, 2026</p>

      <p>
        Privacy isn&apos;t a feature of Athlr — it&apos;s the foundation. This
        policy explains what data the app handles, where it lives, and the
        choices you control. The short version:{' '}
        <strong>
          your activities are private by default, stored on your device, and
          never sold.
        </strong>
      </p>

      <h2>1. Data Stored On Your Device</h2>
      <p>
        When you record an activity, the following is stored locally in the
        app&apos;s database on your phone — not on our servers:
      </p>
      <ul>
        <li>GPS route points (location, altitude, speed, accuracy);</li>
        <li>Activity statistics (distance, time, pace, elevation, splits);</li>
        <li>
          Workouts imported from Apple Health or Google Health Connect,
          including heart rate and calories where available.
        </li>
      </ul>
      <p>
        This data never leaves your device unless you explicitly share an
        activity.
      </p>

      <h2>2. Data We Process In The Cloud</h2>
      <p>
        If you create an account and choose to share an activity to the
        community feed, we store the following with our cloud provider
        (Google Firebase):
      </p>
      <ul>
        <li>Your display name and email address (for authentication);</li>
        <li>
          Summary statistics of shared activities (distance, duration, pace,
          elevation, splits) and a static route thumbnail image;
        </li>
        <li>Kudos you give or receive.</li>
      </ul>
      <p>
        <strong>Raw GPS point data is never uploaded</strong> — shared
        activities include only summary stats and a low-resolution map
        preview.
      </p>

      <h2>3. Health Data</h2>
      <p>
        With your permission, Athlr reads workouts from Apple Health (iOS) or
        Google Health Connect (Android) so you can import sessions recorded by
        your watch or other apps. Health data is read into the on-device
        database only. We never upload health data to our servers, and we
        never write to your health store without your action.
      </p>

      <h2>4. What We Don&apos;t Do</h2>
      <ul>
        <li>We don&apos;t sell or rent your personal data. Ever.</li>
        <li>We don&apos;t show ads or use advertising trackers.</li>
        <li>We don&apos;t access your location when you&apos;re not recording.</li>
        <li>
          We don&apos;t share data with third parties except the
          infrastructure providers listed below.
        </li>
      </ul>

      <h2>5. Service Providers</h2>
      <p>
        We rely on a small set of infrastructure providers to run the
        community features:
      </p>
      <ul>
        <li>
          <strong>Google Firebase</strong> — authentication and the community
          feed database;
        </li>
        <li>
          <strong>Google Maps Static API</strong> — generating route thumbnail
          images for shared activities;
        </li>
        <li>
          <strong>Vercel</strong> — hosting this website.
        </li>
      </ul>

      <h2>6. Your Choices &amp; Rights</h2>
      <ul>
        <li>
          <strong>Visibility:</strong> every activity defaults to
          &ldquo;Only me&rdquo; and can be changed or reverted at any time;
        </li>
        <li>
          <strong>Export:</strong> download any activity as a GPX file, free;
        </li>
        <li>
          <strong>Deletion:</strong> delete activities locally at any time;
          deleting your account removes all cloud data associated with it;
        </li>
        <li>
          <strong>Permissions:</strong> location and health access can be
          revoked at any time in your phone&apos;s system settings.
        </li>
      </ul>

      <h2>7. Data Retention</h2>
      <p>
        On-device data persists until you delete it or uninstall the app.
        Cloud data for shared activities persists until you make the activity
        private, delete it, or delete your account.
      </p>

      <h2>8. Children</h2>
      <p>
        Athlr is not directed at children under 13, and we do not knowingly
        collect personal information from them.
      </p>

      <h2>9. Changes To This Policy</h2>
      <p>
        If we make material changes to this policy, we&apos;ll notify you in
        the app before they take effect.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions? Email{' '}
        <a href="mailto:privacy@athlr.app" className="accent-text">
          privacy@athlr.app
        </a>
        .
      </p>
    </main>
  );
}
