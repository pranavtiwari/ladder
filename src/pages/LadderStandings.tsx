import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Trophy, Swords, X, CheckCircle, XCircle } from 'lucide-react';

const SPORT_ICONS: Record<string, string> = {
  'Badminton': '🏸', 'Tennis': '🎾', 'Table Tennis': '🏓',
  'Squash': '🟡', 'Pickle Ball': '🥒', 'Paddle': '🏏',
};

// A "grouped" entry represents one ladder in the left pane.
// For doubles, it may contain multiple team entries.
interface GroupedLadder {
  ladder_id: string;
  kind: 'singles' | 'doubles';
  ladders: any;          // the ladder object
  entries: any[];        // all user's entries for this ladder (1 for singles, 1+ for doubles)
  activeTeamId: string;  // currently selected team_id (doubles only)
}

export default function LadderStandings() {
  const { user } = useAuth();
  const [grouped, setGrouped] = useState<GroupedLadder[]>([]);
  const [loading, setLoading] = useState(true);

  // The selected GroupedLadder (which ladder is highlighted)
  const [selected, setSelected] = useState<GroupedLadder | null>(null);
  // Standings rows for the selected ladder
  const [standings, setStandings] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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
      // --- Singles ---
      const { data: singlesData } = await supabase
        .from('ladder_players')
        .select('ladder_id, current_rank, wins, losses, ladders(id, name, sport, type, club_id, clubs(name))')
        .eq('player_id', user?.id)
        .neq('current_rank', 0); // rank 0 = ELO placeholder rows

      // --- Doubles (player1 and player2 separately, then merge) ---
      const { data: d1 } = await supabase
        .from('ladder_teams')
        .select('ladder_id, team_id, current_rank, wins, losses, ladders(id, name, sport, type, club_id, clubs(name)), teams(id, name, player1_id, player2_id)')
        .filter('teams.player1_id', 'eq', user?.id);

      const { data: d2 } = await supabase
        .from('ladder_teams')
        .select('ladder_id, team_id, current_rank, wins, losses, ladders(id, name, sport, type, club_id, clubs(name)), teams(id, name, player1_id, player2_id)')
        .filter('teams.player2_id', 'eq', user?.id);

      const seenKey = new Set<string>();
      const doublesEntries = [...(d1 || []), ...(d2 || [])]
        .filter((e: any) => {
          if (!e.teams) return false;
          const key = `${e.ladder_id}-${e.team_id}`;
          if (seenKey.has(key)) return false;
          seenKey.add(key);
          return true;
        })
        .map((e: any) => ({ ...e, kind: 'doubles' as const }));

      const doublesLadderIds = new Set(doublesEntries.map((e: any) => e.ladder_id));

      // Exclude singles entries that belong to a doubles ladder (ELO scaffolding rows)
      const singlesEntries = (singlesData || [])
        .filter((e: any) => !doublesLadderIds.has(e.ladder_id))
        .map((e: any) => ({ ...e, kind: 'singles' as const }));

      // --- Group by ladder_id ---
      const groupMap = new Map<string, GroupedLadder>();

      for (const e of singlesEntries) {
        groupMap.set(e.ladder_id, {
          ladder_id: e.ladder_id,
          kind: 'singles',
          ladders: e.ladders,
          entries: [e],
          activeTeamId: '',
        });
      }

      for (const e of doublesEntries) {
        if (groupMap.has(e.ladder_id)) {
          groupMap.get(e.ladder_id)!.entries.push(e);
        } else {
          groupMap.set(e.ladder_id, {
            ladder_id: e.ladder_id,
            kind: 'doubles',
            ladders: e.ladders,
            entries: [e],
            activeTeamId: e.team_id,
          });
        }
        // Ensure activeTeamId is set to the first entry
        if (!groupMap.get(e.ladder_id)!.activeTeamId) {
          groupMap.get(e.ladder_id)!.activeTeamId = e.team_id;
        }
      }

      const all = Array.from(groupMap.values());
      setGrouped(all);
      if (all.length > 0) await selectLadder(all[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function selectLadder(group: GroupedLadder) {
    setSelected(group);
    setLoadingDetails(true);
    try {
      if (group.kind === 'singles') {
        const { data } = await supabase
          .from('ladder_players')
          .select('*, profiles(nickname, first_name, avatar_url)')
          .eq('ladder_id', group.ladder_id)
          .gt('current_rank', 0);
        // Sort by DB current_rank directly and assign display rank
        const sorted = [...(data || [])].sort((a: any, b: any) => (a.current_rank ?? 9999) - (b.current_rank ?? 9999))
          .map((e: any, i: number) => ({ ...e, display_rank: i + 1 }));
        setStandings(sorted);
        const me = sorted.find((e: any) => e.player_id === user?.id);
        setMyRank(me?.display_rank ?? null);
      } else {
        const { data } = await supabase
          .from('ladder_teams')
          .select('*, teams(id, name, player1_id, player2_id, profiles_player1:profiles!teams_player1_id_fkey(nickname, first_name, avatar_url), profiles_player2:profiles!teams_player2_id_fkey(nickname, first_name, avatar_url))')
          .eq('ladder_id', group.ladder_id);
        // Sort by DB current_rank directly and assign display rank
        const sorted = [...(data || [])].sort((a: any, b: any) => (a.current_rank ?? 9999) - (b.current_rank ?? 9999))
          .map((e: any, i: number) => ({ ...e, display_rank: i + 1 }));
        setStandings(sorted);
        const activeTeamEntry = sorted.find((e: any) => e.team_id === group.activeTeamId);
        setMyRank(activeTeamEntry?.display_rank ?? null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  }

  // Update which team is "active" in the left pane without re-fetching standings
  function setActiveTeam(ladderId: string, teamId: string) {
    setGrouped(prev => prev.map(g =>
      g.ladder_id === ladderId ? { ...g, activeTeamId: teamId } : g
    ));
    // Also update selected so the challenge modal uses the right team
    if (selected?.ladder_id === ladderId) {
      const updated = { ...selected, activeTeamId: teamId };
      setSelected(updated);
      // Update myRank to reflect the newly selected team
      const activeEntry = standings.find((e: any) => e.team_id === teamId);
      setMyRank(activeEntry?.display_rank ?? null);
    }
  }

  async function submitChallenge() {
    if (!selected || !challengeTarget) return;
    setSubmitting(true);
    try {
      const isSingles = selected.kind === 'singles';
      const { error } = await supabase.from('matches').insert({
        ladder_id: selected.ladder_id,
        ...(isSingles
          ? { challenger_id: user?.id, defender_id: challengeTarget.player_id }
          : { challenger_team_id: selected.activeTeamId, defender_team_id: challengeTarget.team_id }),
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

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-light)' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 className="page-title" style={{ marginBottom: 0 }}>My Ladders</h1>

      {grouped.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <Trophy size={40} style={{ color: '#d1d5db', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>You haven't joined any ladders yet.</p>
          <Link to="/clubs" style={{ textDecoration: 'none', backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 600 }}>
            Browse Clubs &amp; Ladders
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

          {/* ── Left: scrollable ladder list ── */}
          <div style={{
            width: '240px',
            flexShrink: 0,
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            paddingRight: '0.25rem',
          }}>
            {grouped.map((group) => {
              const l = group.ladders;
              const isDoubles = group.kind === 'doubles';
              const isActive = selected?.ladder_id === group.ladder_id;
              const multiTeam = isDoubles && group.entries.length > 1;
              const activeEntry = group.entries.find(e => e.team_id === group.activeTeamId) ?? group.entries[0];
              const rankLabel = `Rank #${activeEntry.current_rank} · ${activeEntry.wins}W–${activeEntry.losses}L`;

              return (
                <div
                  key={group.ladder_id}
                  onClick={() => selectLadder({ ...group })}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: `1px solid ${isActive ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.1)'}`,
                    backgroundColor: isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 0 15px rgba(34, 197, 94, 0.1)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '1rem', marginBottom: '0.2rem' }}>{l?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.15rem' }}>
                    {l?.clubs?.name} · {SPORT_ICONS[l?.sport]} {l?.sport}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 600, 
                      color: 'var(--text-light)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em'
                    }}>
                      {isDoubles ? '👥 Doubles' : '👤 Singles'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 700 }}>{rankLabel}</span>
                  </div>

                  {/* Team selector — only shown for doubles */}
                  {isDoubles && (
                    <div style={{ marginTop: '0.5rem' }} onClick={e => e.stopPropagation()}>
                      {multiTeam ? (
                        <select
                          value={group.activeTeamId}
                          onChange={e => {
                            setActiveTeam(group.ladder_id, e.target.value);
                            // If this ladder is already selected, re-select to update myRank
                            if (selected?.ladder_id === group.ladder_id) {
                              /* myRank updated in setActiveTeam */
                            } else {
                              selectLadder({ ...group, activeTeamId: e.target.value });
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.78rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-dark)',
                            cursor: 'pointer',
                            outline: 'none',
                            transition: 'all 0.2s'
                          }}
                        >
                          {group.entries.map((e: any) => (
                            <option key={e.team_id} value={e.team_id}>
                              🤝 {e.teams?.name || 'Unnamed Team'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                          🤝 {activeEntry.teams?.name || 'Unnamed Team'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Right: standings detail ── */}
          {selected && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '1.1rem' }}>{selected.ladders?.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                      {selected.ladders?.clubs?.name}
                      {selected.kind === 'doubles' && (() => {
                        const ae = selected.entries.find((e: any) => e.team_id === selected.activeTeamId) ?? selected.entries[0];
                        return ae?.teams?.name ? ` · 👥 ${ae.teams.name}` : '';
                      })()}
                    </div>
                  </div>
                  <Link
                    to={`/clubs/${selected.ladders?.club_id}/ladders/${selected.ladder_id}`}
                    style={{ fontSize: '0.8rem', color: 'var(--primary-color)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    Full page →
                  </Link>
                </div>

                {/* Standings rows */}
                {loadingDetails ? (
                  <div style={{ padding: '3rem', color: 'var(--text-light)', textAlign: 'center' }}>Loading standings…</div>
                ) : standings.length === 0 ? (
                  <div style={{ padding: '3rem', color: 'var(--text-light)', textAlign: 'center' }}>No entries yet.</div>
                ) : selected.kind === 'singles' ? (
                  standings.map((e: any, i: number) => {
                    const isMe = e.player_id === user?.id;
                    const name = e.profiles?.nickname || e.profiles?.first_name || '—';
                    const rank = e.display_rank ?? (i + 1);
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                    const canChallenge = !isMe && myRank !== null && Math.abs(rank - myRank) <= 2 && rank !== myRank;
                    return (
                      <div key={e.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 1.25rem',
                        backgroundColor: isMe ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                        borderBottom: i < standings.length - 1 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                      }}>
                        <span style={{ minWidth: '2rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                          {medal || `#${rank}`}
                        </span>
                        {e.profiles?.avatar_url
                          ? <img src={e.profiles.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--border-color)', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: isMe ? 700 : 600, color: isMe ? 'var(--primary-color)' : 'var(--text-dark)', fontSize: '0.9rem' }}>
                            {name} {isMe ? '(you)' : ''}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{e.wins}W – {e.losses}L</div>
                        </div>
                        {canChallenge && (
                          <button
                            onClick={() => { setChallengeTarget(e); setChallengeMsg(''); setShowChallenge(true); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem',
                              backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#fb923c', border: '1px solid #fb923c',
                              cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                            }}
                          >
                            <Swords size={13} /> Challenge
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  standings.map((e: any, i: number) => {
                    const myTeamIds = new Set(selected.entries.map((en: any) => en.team_id));
                    const isMe = myTeamIds.has(e.team_id);
                    const teamName = e.teams?.name || 'Unnamed Team';
                    const p1 = e.teams?.profiles_player1?.nickname || e.teams?.profiles_player1?.first_name || '?';
                    const p2 = e.teams?.profiles_player2?.nickname || e.teams?.profiles_player2?.first_name || '?';
                    const rank = e.display_rank ?? (i + 1);
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                    // Can challenge ±2 ranks
                    const canChallenge = !isMe && myRank !== null && Math.abs(rank - myRank) <= 2 && rank !== myRank;
                    return (
                      <div key={e.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 1.25rem',
                        backgroundColor: isMe ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                        borderBottom: i < standings.length - 1 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                      }}>
                        <span style={{ minWidth: '2rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                          {medal || `#${rank}`}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: isMe ? 700 : 600, color: isMe ? 'var(--primary-color)' : 'var(--text-dark)', fontSize: '0.9rem' }}>
                            {teamName} {isMe ? '(you)' : ''}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                            {p1} &amp; {p2} · {e.wins}W – {e.losses}L · <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>ELO: {e.elo_rating ?? 800}</span>
                          </div>
                        </div>
                        {canChallenge && (
                          <button
                            onClick={() => { setChallengeTarget(e); setChallengeMsg(''); setShowChallenge(true); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem',
                              backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#fb923c', border: '1px solid #fb923c',
                              cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                            }}
                          >
                            <Swords size={13} /> Challenge
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Challenge modal */}
      {showChallenge && challengeTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
            <button onClick={() => setShowChallenge(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-dark)', marginBottom: '0.5rem' }}>Send Challenge</h2>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              You are challenging{' '}
              <strong>
                {selected?.kind === 'singles'
                  ? (challengeTarget.profiles?.nickname || challengeTarget.profiles?.first_name)
                  : (challengeTarget.teams?.name || 'this team')}
              </strong>{' '}
              (rank #{challengeTarget.current_rank}) in <strong>{selected?.ladders?.name}</strong>.
            </p>
            {challengeMsg && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{challengeMsg}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowChallenge(false)}>
                <XCircle size={15} /> Cancel
              </button>
              <button
                className="btn"
                style={{ backgroundColor: '#ea580c', color: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
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
