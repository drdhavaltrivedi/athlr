'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/challenges', label: 'Clubs & Challenges', icon: '🏆' },
  { href: '/admin/activities', label: 'Activities', icon: '🏃' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // undefined = auth state unknown yet; null = signed out
  const [user, setUser] = useState<User | null | undefined>(undefined);
  // null = not checked yet
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(null);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', u.uid));
        setIsAdmin(adminDoc.exists());
      } catch {
        setIsAdmin(false);
      }
    });
    return unsub;
  }, []);

  if (user === undefined || (user && isAdmin === null)) {
    return (
      <div className="admin-center">
        <div className="admin-spinner" />
        <p className="label" style={{ marginTop: 16 }}>
          Checking access…
        </p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (!isAdmin) {
    return (
      <div className="admin-center">
        <h1 className="h2">Access denied</h1>
        <p className="lede" style={{ textAlign: 'center', marginTop: 12 }}>
          {user.email} is not an Athlr admin.
          <br />
          Ask an existing admin to add your UID to the <code>admins</code>{' '}
          collection.
        </p>
        <p className="label" style={{ marginTop: 16, userSelect: 'all' }}>
          UID: {user.uid}
        </p>
        <button className="btn btn--ghost" style={{ marginTop: 28 }} onClick={() => signOut(auth)}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="nav__logo" style={{ padding: '4px 8px' }}>
          Athlr <span className="label label--accent">Admin</span>
        </Link>
        <nav className="admin-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav__link${pathname === item.href ? ' is-active' : ''}`}
            >
              <span aria-hidden>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <p className="label" title={user.email ?? ''}>
            {user.email}
          </p>
          <button className="admin-btn admin-btn--ghost" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const withBusy = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-center">
      <div className="card" style={{ width: 'min(400px, 92vw)' }}>
        <h1 className="h2" style={{ fontSize: 26, marginBottom: 6 }}>
          Athlr Admin
        </h1>
        <p className="label" style={{ marginBottom: 24 }}>
          Restricted area — sign in to continue
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            withBusy(() => signInWithEmailAndPassword(auth, email.trim(), password));
          }}
        >
          <input
            className="admin-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="admin-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button className="btn btn--primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          className="btn btn--ghost"
          style={{ width: '100%', marginTop: 12 }}
          disabled={busy}
          onClick={() => withBusy(() => signInWithPopup(auth, new GoogleAuthProvider()))}
        >
          Continue with Google
        </button>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 14 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
