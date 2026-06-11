import Link from 'next/link';

export default function Nav() {
  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link href="/" className="nav__logo">
          <LogoMark />
          Athlr
        </Link>
        <nav className="nav__links">
          <Link href="/#features" className="nav__link">
            Features
          </Link>
          <Link href="/pricing" className="nav__link">
            Pricing
          </Link>
          <Link href="/#community" className="nav__link">
            Community
          </Link>
          <Link href="/#download" className="btn btn--primary nav__cta">
            Get the app
          </Link>
        </nav>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="13" stroke="#FFB020" strokeWidth="2" />
      <path
        d="M7 18 L12 9 L16 15 L21 8"
        stroke="#FFB020"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
