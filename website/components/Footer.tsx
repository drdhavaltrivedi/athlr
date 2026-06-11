import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="nav__logo" style={{ marginBottom: 10 }}>
              Athlr
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, maxWidth: 300 }}>
              The privacy-first fitness tracker. Your miles, your data, your
              rules.
            </p>
          </div>
          <nav className="footer__links">
            <Link href="/#features" className="footer__link">
              Features
            </Link>
            <Link href="/pricing" className="footer__link">
              Pricing
            </Link>
            <Link href="/terms" className="footer__link">
              Terms of Service
            </Link>
            <Link href="/privacy" className="footer__link">
              Privacy Policy
            </Link>
          </nav>
        </div>
        <p className="footer__note">
          © {new Date().getFullYear()} Athlr · Activities are private by
          default. Built with ❤️ for athletes everywhere.
        </p>
      </div>
    </footer>
  );
}
