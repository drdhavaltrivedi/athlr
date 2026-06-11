'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ChallengeRow {
  id: string;
  title: string;
  description: string;
  type: 'distance' | 'elevation' | 'count';
  sport: string;
  targetValue: number;
  startDate: number;
  endDate: number;
  participantCount?: number;
}

interface Participant {
  uid: string;
  displayName?: string;
  progressValue?: number;
}

const SPORTS = ['all', 'run', 'ride', 'walk', 'hike', 'swim', 'yoga', 'workout', 'hiit', 'cycling', 'tennis'];

const emptyForm = {
  title: '',
  description: '',
  type: 'distance' as ChallengeRow['type'],
  sport: 'all',
  targetValue: '',
  startDate: '',
  endDate: '',
};

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({});

  const load = () => {
    setLoading(true);
    getDocs(query(collection(db, 'challenges'), orderBy('endDate', 'desc')))
      .then((snap) => {
        setChallenges(snap.docs.map((d) => ({ ...(d.data() as ChallengeRow), id: d.id })));
        setError('');
      })
      .catch((e) => setError(e?.message ?? 'Failed to load challenges'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const startEdit = (c: ChallengeRow) => {
    setEditingId(c.id);
    setForm({
      title: c.title,
      description: c.description,
      type: c.type,
      sport: c.sport,
      targetValue: String(c.targetValue),
      startDate: new Date(c.startDate).toISOString().slice(0, 10),
      endDate: new Date(c.endDate).toISOString().slice(0, 10),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(form.targetValue);
    if (!form.title.trim() || !target || !form.startDate || !form.endDate) {
      alert('Title, target value and both dates are required.');
      return;
    }
    setSaving(true);
    try {
      const ref = editingId
        ? doc(db, 'challenges', editingId)
        : doc(collection(db, 'challenges'));
      const payload = {
        id: ref.id,
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        sport: form.sport,
        targetValue: target,
        startDate: new Date(form.startDate + 'T00:00:00').getTime(),
        endDate: new Date(form.endDate + 'T23:59:59').getTime(),
        ...(editingId ? {} : { participantCount: 0 }),
      };
      await setDoc(ref, payload, { merge: true });
      cancelEdit();
      load();
    } catch (err) {
      alert(`Save failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (c: ChallengeRow) => {
    if (!confirm(`Delete challenge "${c.title}"?\n\nParticipant progress docs under it will be orphaned.`)) return;
    try {
      await deleteDoc(doc(db, 'challenges', c.id));
      setChallenges((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  const toggleParticipants = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!participants[id]) {
      try {
        const snap = await getDocs(
          query(collection(db, 'challenges', id, 'participants'), orderBy('progressValue', 'desc')),
        );
        setParticipants((p) => ({
          ...p,
          [id]: snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Participant),
        }));
      } catch {
        setParticipants((p) => ({ ...p, [id]: [] }));
      }
    }
  };

  const fmtTarget = (c: ChallengeRow) =>
    c.type === 'distance' ? `${c.targetValue / 1000} km` : c.type === 'elevation' ? `${c.targetValue} m` : `${c.targetValue}×`;

  return (
    <div>
      <h1 className="admin-title">Clubs &amp; Challenges</h1>

      {/* Create / edit form */}
      <form className="card admin-form" onSubmit={onSubmit}>
        <h2 className="admin-subtitle" style={{ marginTop: 0 }}>
          {editingId ? 'Edit challenge' : 'Create a challenge'}
        </h2>
        <div className="admin-form__grid">
          <input className="admin-input" placeholder="Title" value={form.title} onChange={set('title')} />
          <select className="admin-input" value={form.sport} onChange={set('sport')}>
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All sports' : s}</option>
            ))}
          </select>
          <select className="admin-input" value={form.type} onChange={set('type')}>
            <option value="distance">Distance (meters)</option>
            <option value="elevation">Elevation (meters)</option>
            <option value="count">Activity count</option>
          </select>
          <input
            className="admin-input"
            type="number"
            placeholder={form.type === 'distance' ? 'Target in meters (100km = 100000)' : 'Target value'}
            value={form.targetValue}
            onChange={set('targetValue')}
          />
          <input className="admin-input" type="date" value={form.startDate} onChange={set('startDate')} />
          <input className="admin-input" type="date" value={form.endDate} onChange={set('endDate')} />
        </div>
        <textarea
          className="admin-input"
          rows={2}
          placeholder="Description"
          value={form.description}
          onChange={set('description')}
        />
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn--primary" type="submit" disabled={saving} style={{ padding: '12px 28px', fontSize: 14 }}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create challenge'}
          </button>
          {editingId && (
            <button className="btn btn--ghost" type="button" onClick={cancelEdit} style={{ padding: '12px 28px', fontSize: 14 }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && <p className="admin-error">{error}</p>}
      {loading ? (
        <p className="admin-empty">Loading…</p>
      ) : challenges.length === 0 ? (
        <p className="admin-empty">No challenges yet — create the first one above.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Sport</th>
              <th>Goal</th>
              <th>Window</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c) => (
              <ChallengeRows
                key={c.id}
                c={c}
                fmtTarget={fmtTarget}
                expanded={expanded === c.id}
                participants={participants[c.id]}
                onToggle={() => toggleParticipants(c.id)}
                onEdit={() => startEdit(c)}
                onDelete={() => onDelete(c)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ChallengeRows({
  c,
  fmtTarget,
  expanded,
  participants,
  onToggle,
  onEdit,
  onDelete,
}: {
  c: ChallengeRow;
  fmtTarget: (c: ChallengeRow) => string;
  expanded: boolean;
  participants?: Participant[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const window = `${new Date(c.startDate).toLocaleDateString()} → ${new Date(c.endDate).toLocaleDateString()}`;
  return (
    <>
      <tr>
        <td>
          {c.title}
          {c.description ? <div className="admin-dim">{c.description}</div> : null}
        </td>
        <td>{c.sport}</td>
        <td className="num">{fmtTarget(c)}</td>
        <td>{window}</td>
        <td className="num">{c.participantCount ?? 0}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <button className="admin-btn" onClick={onToggle}>
            {expanded ? 'Hide' : 'Participants'}
          </button>{' '}
          <button className="admin-btn" onClick={onEdit}>
            Edit
          </button>{' '}
          <button className="admin-btn admin-btn--danger" onClick={onDelete}>
            Delete
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--surface-alt)' }}>
            {!participants ? (
              <span className="admin-dim">Loading participants…</span>
            ) : participants.length === 0 ? (
              <span className="admin-dim">No participants yet.</span>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 24 }}>
                {participants.map((p) => (
                  <li key={p.uid} style={{ padding: '4px 0', fontSize: 14 }}>
                    {p.displayName || p.uid} —{' '}
                    <span className="num" style={{ color: 'var(--accent)' }}>
                      {c.type === 'distance'
                        ? `${(((p.progressValue ?? 0) as number) / 1000).toFixed(1)} km`
                        : `${p.progressValue ?? 0}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
