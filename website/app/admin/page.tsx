'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Counts {
  users: number | null;
  activities: number | null;
  challenges: number | null;
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>({ users: null, activities: null, challenges: null });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const count = (col: string) =>
      getCountFromServer(collection(db, col))
        .then((s) => s.data().count)
        .catch(() => null);

    Promise.all([count('users'), count('activities'), count('challenges')]).then(
      ([users, activities, challenges]) => setCounts({ users, activities, challenges }),
    );

    getDocs(query(collection(db, 'activities'), orderBy('startedAt', 'desc'), limit(5)))
      .then((snap) => setRecent(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="admin-title">Dashboard</h1>

      <div className="admin-stat-grid">
        <StatCard label="Users" value={counts.users} href="/admin/users" />
        <StatCard label="Shared activities" value={counts.activities} href="/admin/activities" />
        <StatCard label="Challenges" value={counts.challenges} href="/admin/challenges" />
      </div>

      <h2 className="admin-subtitle">Latest shared activities</h2>
      {recent.length === 0 ? (
        <p className="admin-empty">No shared activities yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>User</th>
              <th>Sport</th>
              <th>Distance</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{a.userName || '—'}</td>
                <td>{a.sport}</td>
                <td className="num">{((a.distanceM || 0) / 1000).toFixed(2)} km</td>
                <td>{a.startedAt ? new Date(a.startedAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number | null; href: string }) {
  return (
    <Link href={href} className="card admin-stat-card">
      <div className="stat-big" style={{ fontSize: 44 }}>
        {value === null ? '—' : value.toLocaleString()}
      </div>
      <p className="label" style={{ marginTop: 8 }}>
        {label}
      </p>
    </Link>
  );
}
