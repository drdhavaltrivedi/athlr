'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ActivityRow {
  id: string;
  title?: string;
  userName?: string;
  uid?: string;
  sport?: string;
  distanceM?: number;
  movingS?: number;
  startedAt?: number;
  visibility?: string;
  kudosCount?: number;
}

export default function AdminActivities() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getDocs(query(collection(db, 'activities'), orderBy('startedAt', 'desc'), limit(100)))
      .then((snap) => {
        setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ActivityRow));
        setError('');
      })
      .catch((e) => setError(e?.message ?? 'Failed to load activities'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onDelete = async (a: ActivityRow) => {
    if (!confirm(`Remove "${a.title}" by ${a.userName || 'unknown'} from the community feed?\n\nThis only deletes the shared copy — the athlete keeps it locally on their device.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'activities', a.id));
      setActivities((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  const fmtDuration = (s?: number) => {
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div>
      <h1 className="admin-title">
        Shared activities <span className="label">(latest {activities.length})</span>
      </h1>
      <p className="admin-dim" style={{ marginBottom: 24 }}>
        Moderation view of the community feed. Deleting here removes the shared copy only —
        athletes always keep their activities on-device.
      </p>

      {error && <p className="admin-error">{error}</p>}
      {loading ? (
        <p className="admin-empty">Loading…</p>
      ) : activities.length === 0 ? (
        <p className="admin-empty">Nothing has been shared yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>User</th>
              <th>Sport</th>
              <th>Distance</th>
              <th>Time</th>
              <th>Visibility</th>
              <th>Kudos</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id}>
                <td>{a.title || '—'}</td>
                <td>{a.userName || '—'}</td>
                <td>{a.sport || '—'}</td>
                <td className="num">{((a.distanceM || 0) / 1000).toFixed(2)} km</td>
                <td className="num">{fmtDuration(a.movingS)}</td>
                <td>
                  <span className={`admin-badge${a.visibility === 'everyone' ? ' admin-badge--live' : ''}`}>
                    {a.visibility || '—'}
                  </span>
                </td>
                <td className="num">{a.kudosCount ?? 0}</td>
                <td>{a.startedAt ? new Date(a.startedAt).toLocaleDateString() : '—'}</td>
                <td>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete(a)}>
                    Remove
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
