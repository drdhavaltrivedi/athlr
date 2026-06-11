import type { Metadata } from 'next';
import Link from 'next/link';
import Reveal from '@/components/Reveal';

export const metadata: Metadata = {
  title: 'Pricing — Athlr',
  description:
    'Athlr is free forever for tracking. Go Pro for advanced training insights. No ads, no data selling — ever.',
};

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Everything you need to train.',
    cta: 'Get started',
    featured: false,
    features: [
      'Unlimited GPS activity recording',
      'All 11 sport types',
      'Live pace, splits & elevation',
      'Calendar heatmap & training log',
      'Apple Health / Health Connect sync',
      'GPX export — always free',
      'Community feed & kudos',
    ],
    muted: ['Advanced training analytics', 'Custom route planning'],
  },
  {
    name: 'Pro',
    price: '$5.99',
    period: 'per month',
    tagline: 'For athletes chasing a number.',
    cta: 'Start 14-day free trial',
    featured: true,
    features: [
      'Everything in Free',
      'Advanced training analytics & trends',
      'Heart-rate zones & effort scoring',
      'Custom route planning',
      'Personal-best tracking across sports',
      'Priority support',
      'Early access to new features',
    ],
    muted: [],
  },
  {
    name: 'Pro Annual',
    price: '$49.99',
    period: 'per year — save 30%',
    tagline: 'Commit to the season.',
    cta: 'Go annual',
    featured: false,
    features: [
      'Everything in Pro',
      'Two months free vs. monthly',
      'Locked-in price for life',
      'Support an independent, privacy-first app',
    ],
    muted: [],
  },
];

const FAQS = [
  {
    q: 'Is the free plan really free forever?',
    a: 'Yes. Recording, syncing, the training log and GPX export are free with no time limit, no activity cap and no ads. Pro adds deeper analytics on top — it never takes core features away.',
  },
  {
    q: 'Do you sell my data?',
    a: 'Never. Athlr makes money from Pro subscriptions, not from you. Activities are private by default and your GPS data stays on your device unless you explicitly share an activity.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Of course. Subscriptions are managed through the App Store / Google Play and can be cancelled in one tap. Your recorded data always remains yours — exportable as GPX.',
  },
  {
    q: 'What happens to my data if I downgrade?',
    a: 'Nothing. All your activities, stats and history remain fully accessible on the free plan. Only the Pro analytics views are paused.',
  },
];

export default function PricingPage() {
  return (
    <main>
      <section className="section" style={{ paddingTop: 160 }}>
        <div className="orb orb--amber" style={{ opacity: 0.2 }} />
        <div className="container">
          <Reveal>
            <div style={{ textAlign: 'center' }}>
              <p className="label label--accent">Pricing</p>
              <h1 className="h2" style={{ margin: '16px auto 18px', maxWidth: 640 }}>
                Free to track. <span className="accent-text">Pro</span> to
                train harder.
              </h1>
              <p className="lede" style={{ margin: '0 auto' }}>
                No ads. No data selling. No locking your own miles behind a
                paywall. Just honest pricing.
              </p>
            </div>
          </Reveal>

          <div className="pricing-grid">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 100}>
                <div
                  className={`card plan${plan.featured ? ' plan--featured' : ''}`}
                  style={{ height: '100%' }}
                >
                  {plan.featured && (
                    <span className="plan__badge">Most popular</span>
                  )}
                  <p className="label">{plan.name}</p>
                  <div className="plan__price num">{plan.price}</div>
                  <p className="plan__period">{plan.period}</p>
                  <p
                    style={{
                      marginTop: 14,
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {plan.tagline}
                  </p>
                  <ul className="plan__features">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                    {plan.muted.map((f) => (
                      <li key={f} className="muted">
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/#download"
                    className={`btn ${plan.featured ? 'btn--primary' : 'btn--ghost'}`}
                    style={{ width: '100%' }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <Reveal>
            <h2 className="h2" style={{ textAlign: 'center', marginBottom: 48 }}>
              Questions, answered.
            </h2>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 60}>
                <div className="card">
                  <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
                    {faq.q}
                  </h3>
                  <p
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.7,
                      color: 'var(--text-dim)',
                    }}
                  >
                    {faq.a}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
