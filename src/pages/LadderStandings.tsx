import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Trophy, Swords, X, CheckCircle, XCircle } from 'lucide-react';

const SPORT_ICONS: Record<string, string> = {
  'Badminton': '🏸', 'Tennis': '🎾', 'Table Tennis': '🏓',
  'Squash': '🟡', 'Pickle Ball': '🥒', 'Paddle': '🏏',
};

export default function LadderStandings() {
  const { user } = useAuth();
  const [myLadders, setMyLadders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);

  // Challenge modal
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeTarget, setChallengeTarget] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challengeMsg, setChallengeMsg] = useState('');

  useEffect(() => {
    if (user) loadMyLadders();
  }, [user]);

  async function loadMyLadders() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('ladder_players')
        .select('ladder_id, current_rank, wins, losses, ladders(id, name, sport, type, club_id, clubs(name))')
        .eq('player_id', user?.id);
      setMyLadders(data || []);
      if (data && data.length > 0) selectLadder(data[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function selectLadder(entry: any) {
    setSelected(entry);
    const { data } = await supabase
      .from('ladder_players')
      .select('*, profiles(nickname, first_name, avatar_url)')
      .eq('ladder_id', entry.ladder_id)
      .order('current_rank');
    setEntries(data || []);
    const me = (data || []).find((e: any) => e.player_id === user?.id);
    setMyRank(me?.current_rank ?? null);
  }

  function openChallenge(target: any) {
    setChallengeTarget(target);
    setChallengeMsg('');
    setShowChallenge(true);
  }

  async function submitChallenge() {
    if (!selected || !challengeTarget) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('matches').insert({
        ladder_id: selected.ladder_id,
        challenger_id: user?.id,
        defender_id: challengeTarget.player_id,
        status: 'pending',
      });
      if (error) throw error;
      setShowChallenge(false);
    } catch (err: any) {
      setChallengeMsg(err.message || 'Failed to send challenge.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading…</div>;

  return (
    <div className="flex-col gap-6">
      <h1 className="page-title" style={{ marginBottom: 0 }}>My Ladders</h1>

      {myLadders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <Trophy size={40} style={{ color: '#d1d5db', margin: '0 auto 1rem' }} />
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>You haven't joined any ladders yet.</p>
          <Link to="/clubs" style={{ textDecoration: 'none', backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 600 }}>
            Browse Clubs &amp; Ladders
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Ladder picker */}
          <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {myLadders.map((entry: any) => {
              const l = entry.ladders;
              const isActive = selected?.ladder_id === entry.ladder_id;
              return (
                <button
                  key={entry.ladder_id}
                  onClick={() => selectLadder(entry)}
                  style={{
                    textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${isActive ? 'var(--primary-color)' : '#e5e7eb'}`,
                    backgroundColor: isActive ? '#eef2ff' : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{l?.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{l?.clubs?.name} · {SPORT_ICONS[l?.sport]} {l?.sport}</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '0.2rem', color: '#4f46e5', fontWeight: 600 }}>Rank #{entry.current_rank} · {entry.wins}W–{entry.losses}L</div>
                </button>
              );
            })}
          </div>

          {/* Standings */}
          {selected && (
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#111827' }}>{selected.ladders?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{selected.ladders?.clubs?.name}</div>
                  </div>
                  <Link
                    to={`/clubs/${selected.ladders?.club_id}/ladders/${selected.ladder_id}`}
                    style={{ fontSize: '0.8rem', color: 'var(--primary-color)', textDecoration: 'none' }}
                  >
                    Full page →
                  </Link>
                </div>
                {entries.map((e: any, i: number) => {
                  const isMe = e.player_id === user?.id;
                  const name = e.profiles?.nickname || e.profiles?.first_name || '—';
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  const canChallenge = !isMe && myRank !== null && e.current_rank < myRank;
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 1.25rem',
                        backgroundColor: isMe ? '#f0fdf4' : 'transparent',
                        borderBottom: i < entries.length - 1 ? '1px solid #f9fafb' : 'none',
                      }}
                    >
                      <span style={{ minWidth: '2rem', fontWeight: 700, color: '#374151' }}>
                        {medal || `#${e.current_rank}`}
                      </span>
                      {e.profiles?.avatar_url
                        ? <img src={e.profiles.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                        : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#e5e7eb' }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: isMe ? 700 : 600, color: isMe ? '#065f46' : '#111827', fontSize: '0.9rem' }}>
                          {name} {isMe ? '(you)' : ''}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{e.wins}W – {e.losses}L</div>
                      </div>
                      {canChallenge && (
                        <button
                          onClick={() => openChallenge(e)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem',
                            backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74',
                            cursor: 'pointer', fontWeight: 600,
                          }}
                        >
                          <Swords size={13} /> Challenge
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Challenge modal */}
      {showChallenge && challengeTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
            <button onClick={() => setShowChallenge(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontWeight: 700, fontSize: '1.15rem', color: '#111827', marginBottom: '0.5rem' }}>Send Challenge</h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              You are challenging <strong>{challengeTarget.profiles?.nickname || challengeTarget.profiles?.first_name}</strong> (rank #{challengeTarget.current_rank}) in <strong>{selected?.ladders?.name}</strong>.
            </p>
            {challengeMsg && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{challengeMsg}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowChallenge(false)}>
                <XCircle size={15} /> Cancel
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#c2410c', color: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                disabled={submitting}
                onClick={submitChallenge}
              >
                <CheckCircle size={15} /> {submitting ? 'Sending…' : 'Send Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
