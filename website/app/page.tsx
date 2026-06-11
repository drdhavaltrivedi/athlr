import Link from 'next/link';
import Reveal from '@/components/Reveal';
import CountUp from '@/components/CountUp';
import PhoneMock from '@/components/PhoneMock';

const SPORTS = [
  '🏃 Run',
  '🚴 Ride',
  '🚶 Walk',
  '🥾 Hike',
  '🏊 Swim',
  '🧘 Yoga',
  '🏋️ Workout',
  '🔥 HIIT',
  '🚲 Cycling',
  '🎾 Tennis',
];

const FEATURES = [
  {
    icon: '🛰️',
    title: 'Precision GPS tracking',
    desc: 'Kalman-filtered GPS with per-sport tuning. Live distance, pace, elevation and splits — accurate even in cities and under trees.',
  },
  {
    icon: '🔒',
    title: 'Private by default',
    desc: 'Every activity stays on your device until you choose to share it. No silent uploads, no data mining. Ever.',
  },
  {
    icon: '⌚',
    title: 'Syncs with everything',
    desc: 'Apple Health, Google Health Connect, Apple Watch, Garmin, Fitbit, Wear OS — if it writes to Health, Athlr reads it.',
  },
  {
    icon: '📆',
    title: 'Training log & heatmap',
    desc: 'A calendar heatmap of your consistency, plus weekly, monthly and lifetime stats that actually motivate.',
  },
  {
    icon: '👏',
    title: 'Community kudos',
    desc: 'Share what you want, when you want. Give and receive kudos in a feed of athletes like you.',
  },
  {
    icon: '📦',
    title: 'GPX export, free forever',
    desc: 'Your data is yours. Export any activity as GPX in one tap — no paywall, no lock-in, no excuses.',
  },
];

export default function HomePage() {
  return (
    <main>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="orb orb--amber" />
        <div className="orb orb--blue" />
        <div className="track-lines" aria-hidden>
          <span className="track-line" style={{ top: '22%', animationDelay: '0s' }} />
          <span className="track-line" style={{ top: '48%', animationDelay: '1.6s' }} />
          <span className="track-line" style={{ top: '74%', animationDelay: '3.2s' }} />
        </div>

        <div className="container hero__grid">
          <div>
            <div className="fade-up" style={{ animationDelay: '0.05s' }}>
              <span className="live-pill">
                <span className="live-dot" />
                GPS LOCKED · READY TO RECORD
              </span>
            </div>

            <h1 className="h1" style={{ margin: '26px 0' }}>
              <span className="hero__title-line">
                <span className="hero__title-inner" style={{ animationDelay: '0.1s' }}>
                  Track every mile.
                </span>
              </span>
              <span className="hero__title-line">
                <span
                  className="hero__title-inner accent-text"
                  style={{ animationDelay: '0.22s' }}
                >
                  Own every stat.
                </span>
              </span>
            </h1>

            <p className="lede fade-up" style={{ animationDelay: '0.35s' }}>
              Athlr is the fitness tracker built for the night-training,
              dawn-racing, never-skip-a-day athlete. Record any sport with
              precision GPS — and keep your data exactly where it belongs:
              with you.
            </p>

            <div
              className="fade-up"
              style={{
                display: 'flex',
                gap: 16,
                marginTop: 36,
                flexWrap: 'wrap',
                animationDelay: '0.48s',
              }}
            >
              <Link href="/#download" className="btn btn--primary">
                Get the app — free
              </Link>
              <Link href="/pricing" className="btn btn--ghost">
                See pricing
              </Link>
            </div>
          </div>

          <div className="fade-up" style={{ animationDelay: '0.4s' }}>
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* ─── Sport marquee ────────────────────────────────────────────────── */}
      <div className="marquee" aria-hidden>
        <div className="marquee__track">
          {[...SPORTS, ...SPORTS].map((s, i) => (
            <span key={i} className="marquee__item">
              {s} <span style={{ color: 'var(--accent)' }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="section" id="features">
        <div className="container">
          <Reveal>
            <p className="label label--accent">Why Athlr</p>
            <h2 className="h2" style={{ marginTop: 12, maxWidth: 640 }}>
              Everything a serious athlete needs. Nothing they should pay
              their privacy for.
            </h2>
          </Reveal>

          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="card" style={{ height: '100%' }}>
                  <div className="feature__icon">{f.icon}</div>
                  <h3 className="feature__title">{f.title}</h3>
                  <p className="feature__desc">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats band ───────────────────────────────────────────────────── */}
      <section className="section" id="community" style={{ paddingTop: 20 }}>
        <div className="container">
          <Reveal>
            <div
              className="card"
              style={{ padding: '64px 32px', textAlign: 'center' }}
            >
              <p className="label label--accent" style={{ marginBottom: 40 }}>
                The numbers do the talking
              </p>
              <div className="stats-band">
                <div>
                  <div className="stat-big">
                    <CountUp end={11} />
                  </div>
                  <p className="label" style={{ marginTop: 12 }}>
                    Sports tracked
                  </p>
                </div>
                <div>
                  <div className="stat-big">
                    <CountUp end={90} />
                  </div>
                  <p className="label" style={{ marginTop: 12 }}>
                    Days of health import
                  </p>
                </div>
                <div>
                  <div className="stat-big">
                    <CountUp end={100} suffix="%" />
                  </div>
                  <p className="label" style={{ marginTop: 12 }}>
                    Private by default
                  </p>
                </div>
                <div>
                  <div className="stat-big">
                    <CountUp end={0} suffix="$" />
                  </div>
                  <p className="label" style={{ marginTop: 12 }}>
                    To start, forever
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Privacy promise ──────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          <Reveal>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 24,
                alignItems: 'start',
                maxWidth: 760,
                margin: '0 auto',
              }}
            >
              <div
                className="feature__icon"
                style={{
                  background: 'rgba(61, 220, 132, 0.13)',
                  marginBottom: 0,
                }}
              >
                🛡️
              </div>
              <div>
                <p className="label live-text">Our promise</p>
                <p
                  style={{
                    fontSize: 'clamp(20px, 3vw, 28px)',
                    fontWeight: 700,
                    lineHeight: 1.45,
                    marginTop: 10,
                  }}
                >
                  Activities are private by default. Your data stays on your
                  device until you choose to share it — and you can export
                  everything as GPX, any time.{' '}
                  <span className="accent-text">Free, forever.</span>
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────────── */}
      <section className="section" id="download" style={{ paddingTop: 20 }}>
        <div className="container">
          <Reveal>
            <div className="cta-band">
              <div className="orb orb--amber" style={{ opacity: 0.18 }} />
              <p className="label label--accent">Ready when you are</p>
              <h2 className="h2" style={{ margin: '16px auto 18px', maxWidth: 560 }}>
                Lace up. Hit record. The rest is history.
              </h2>
              <p className="lede" style={{ margin: '0 auto 36px' }}>
                Athlr is coming to the App Store and Google Play. Be first out
                of the blocks.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <a className="btn btn--primary" href="#download">
                   Download for iOS
                </a>
                <a className="btn btn--ghost" href="#download">
                  ▶ Download for Android
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
