'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserRow {
  uid: string;
  displayName?: string;
  username?: string;
  email?: string;
  photoURL?: string | null;
  bio?: string;
  createdAt?: number;
  stats?: { activities?: number; distanceM?: number };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getDocs(collection(db, 'users'))
      .then((snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserRow));
        setError('');
      })
      .catch((e) => setError(e?.message ?? 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q),
    );
  }, [users, search]);

  const onDelete = async (u: UserRow) => {
    const name = u.displayName || u.username || u.uid;
    if (!confirm(`Delete the Firestore profile of "${name}"?\n\nThis removes their user document (profile, follow graph stays orphaned). It does NOT delete their Auth account or local app data.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', u.uid));
      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div>
      <div className="admin-toolbar">
        <h1 className="admin-title" style={{ margin: 0 }}>
          Users <span className="label">({users.length})</span>
        </h1>
        <input
          className="admin-input"
          style={{ maxWidth: 320, marginBottom: 0 }}
          placeholder="Search name, username, email, uid…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="admin-error">{error}</p>}
      {loading ? (
        <p className="admin-empty">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="admin-empty">No users found.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Activities</th>
              <th>Joined</th>
              <th>UID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.uid}>
                <td>
                  {u.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photoURL} alt="" className="admin-avatar" />
                  ) : (
                    <span className="admin-avatar admin-avatar--fallback">
                      {(u.displayName || '?')[0].toUpperCase()}
                    </span>
                  )}
                </td>
                <td>
                  {u.displayName || '—'}
                  {u.bio ? <div className="admin-dim">{u.bio}</div> : null}
                </td>
                <td>{u.username ? `@${u.username}` : '—'}</td>
                <td>{u.email || '—'}</td>
                <td className="num">{u.stats?.activities ?? '—'}</td>
                <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                  <code className="admin-dim" style={{ fontSize: 11 }}>{u.uid.slice(0, 10)}…</code>
                </td>
                <td>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete(u)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
