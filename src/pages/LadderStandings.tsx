import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Trophy, Swords, X, CheckCircle, XCircle, Share2 } from 'lucide-react';

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
  const [sortMode, setSortMode] = useState<'rank' | 'elo'>('rank');

  // Challenge modal
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeTarget, setChallengeTarget] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challengeMsg, setChallengeMsg] = useState('');

  // Unscheduled modal
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [unscheduledOpponent, setUnscheduledOpponent] = useState<any>(null);
  const [unscheduledScore, setUnscheduledScore] = useState('');
  const [unscheduledDate, setUnscheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [whoWon, setWhoWon] = useState<'me' | 'opponent' | 'p1' | 'p2'>('me');
  const [isAdmin, setIsAdmin] = useState(false);
  const [p1EntryId, setP1EntryId] = useState('');
  const [p2EntryId, setP2EntryId] = useState('');
  const [pendingParticipants, setPendingParticipants] = useState<any[]>([]);

  useEffect(() => {
    if (user) loadMyLadders();
  }, [user]);

  async function loadMyLadders() {
    setLoading(true);
    try {
      // 1. Fetch user's club memberships
      const { data: memberships } = await supabase
        .from('club_members')
        .select('club_id, role, clubs(name)')
        .eq('player_id', user?.id);
      
      const clubIds = (memberships || []).map((m: any) => m.club_id);
      if (clubIds.length === 0) {
        setGrouped([]);
        setLoading(false);
        return;
      }

      // 2. Fetch ALL ladders for these clubs
      const { data: allLadders, error: lError } = await supabase
        .from('ladders')
        .select('id, name, sport, type, club_id, clubs(name)')
        .in('club_id', clubIds)
        .order('name');
      if (lError) throw lError;

      // 3. Fetch user's entries (ladder_players & ladder_teams)
      const { data: sEntries } = await supabase
        .from('ladder_players')
        .select('ladder_id, current_rank, wins, losses')
        .eq('player_id', user?.id)
        .neq('current_rank', 0);

      // Fetch doubles entries
      // We use a cleaner join strategy to avoid OXC/PostgREST transform issues
      const { data: dEntries } = await supabase
        .from('ladder_teams')
        .select('ladder_id, team_id, current_rank, wins, losses, teams!inner(id, name, player1_id, player2_id)')
        .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`, { foreignTable: 'teams' });

      // 4. Merge into GroupedLadder structure
      const allResults: GroupedLadder[] = (allLadders || []).map((lad: any) => {
        const singles = (sEntries || []).filter((e: any) => e.ladder_id === lad.id);
        const doubles = (dEntries || []).filter((e: any) => e.ladder_id === lad.id);

        return {
          ladder_id: lad.id,
          kind: lad.type as 'singles' | 'doubles',
          ladders: lad,
          entries: lad.type === 'singles' ? singles : doubles,
          activeTeamId: lad.type === 'doubles' ? (doubles[0]?.team_id || '') : '',
        };
      });

      // Filter to ONLY show ladders the user has joined
      const results = allResults.filter(group => group.entries.length > 0);

      setGrouped(results);
      if (results.length > 0) {
        // Find if we had one selected before, otherwise pick first
        const toSelect = selected ? (results.find((r: any) => r.ladder_id === selected.ladder_id) || results[0]) : results[0];
        await selectLadder(toSelect);
      }
    } catch (err) {
      console.error('Error loading ladders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function selectLadder(group: GroupedLadder) {
    if (!group || !group.ladders) return;
    setSelected(group);
    setLoadingDetails(true);
    setPendingParticipants([]);
    try {
      // 1. Check admin role for this club
      const { data: member } = await supabase
        .from('club_members')
        .select('role')
        .eq('club_id', group.ladders.club_id)
        .eq('player_id', user?.id)
        .maybeSingle(); // switch to maybeSingle to avoid 0 row error
      setIsAdmin(member?.role === 'admin');

      // 2. Load standings
      if (group.kind === 'singles') {
        const { data } = await supabase
          .from('ladder_players')
          .select('*, profiles(id, nickname, first_name, avatar_url)')
          .eq('ladder_id', group.ladder_id)
          .gt('current_rank', 0);
        const sorted = [...(data || [])].sort((a: any, b: any) => (a.current_rank ?? 9999) - (b.current_rank ?? 9999))
          .map((e: any, i: number) => ({ ...e, display_rank: i + 1 }));
        setStandings(sorted);
        const me = sorted.find((e: any) => e.player_id === user?.id);
        setMyRank(me?.display_rank ?? null);
      } else {
        const { data } = await supabase
          .from('ladder_teams')
          .select('*, teams(id, name, player1_id, player2_id, profiles_player1:profiles!teams_player1_id_fkey(nickname, first_name, avatar_url, elo_rating), profiles_player2:profiles!teams_player2_id_fkey(nickname, first_name, avatar_url, elo_rating))')
          .eq('ladder_id', group.ladder_id);
        const sortedByRank = [...(data || [])].sort((a: any, b: any) => (a.current_rank ?? 9999) - (b.current_rank ?? 9999))
          .map((e: any, i: number) => ({ ...e, display_rank: i + 1 }));
        setStandings(sortedByRank);
        const activeTeamEntry = sortedByRank.find((e: any) => e.team_id === group.activeTeamId);
        setMyRank(activeTeamEntry?.display_rank ?? null);
      }

      // 3. Load Pending (Invites, Club Requests for this ladder, and Ladder Join Requests)
      const { data: invites } = await supabase
        .from('member_invitations')
        .select('*')
        .eq('ladder_id', group.ladder_id);
      
      const { data: clubReqs } = await supabase
        .from('club_join_requests')
        .select('player_id, profiles(nickname, first_name, avatar_url)')
        .eq('club_id', group.ladders.club_id)
        .eq('ladder_id', group.ladder_id)
        .eq('status', 'pending');

      const { data: ladderReqs } = await supabase
        .from('ladder_join_requests')
        .select('id, player_id, team_id, profiles(nickname, first_name, avatar_url), teams(name)')
        .eq('ladder_id', group.ladder_id)
        .eq('status', 'pending');

      const mergedPending = [
        ...(invites || []).map(i => ({ id: i.id, name: i.name, type: 'INVITED' })),
        ...(clubReqs || []).map(r => ({ id: r.player_id, player_id: r.player_id, name: r.profiles?.nickname || r.profiles?.first_name || 'Anonymous', type: 'PENDING CLUB JOIN' })),
        ...(ladderReqs || []).map(r => ({ 
          id: r.id, 
          player_id: r.player_id,
          team_id: r.team_id,
          name: group.kind === 'singles' ? (r.profiles?.nickname || r.profiles?.first_name || 'Anonymous') : (r.teams?.name || 'Anonymous Team'), 
          type: 'PENDING LADDER JOIN' 
        }))
      ];
      setPendingParticipants(mergedPending);

    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  }

  const getSortedStandings = () => {
    if (sortMode === 'rank') return standings;
    return [...standings].sort((a, b) => (b.elo_rating ?? 800) - (a.elo_rating ?? 800));
  };

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

  async function submitUnscheduledResult() {
    if (!selected || !unscheduledScore) return;
    
    // Validate participants
    let p1Id = '';
    let p2Id = '';
    let winnerId = '';

    if (isAdmin && p1EntryId && p2EntryId) {
      if (p1EntryId === p2EntryId) {
        alert('Participants cannot be the same.');
        return;
      }
      const e1 = standings.find(s => s.id === p1EntryId) || pendingParticipants.find(p => p.id === p1EntryId);
      const e2 = standings.find(s => s.id === p2EntryId) || pendingParticipants.find(p => p.id === p2EntryId);
      if (!e1 || !e2) {
        alert('Invalid participant selection.');
        return;
      }
      
      if (selected.kind === 'singles') {
        p1Id = e1.player_id;
        p2Id = e2.player_id;
        winnerId = whoWon === 'p1' ? p1Id : p2Id;
      } else {
        p1Id = e1.team_id;
        p2Id = e2.team_id;
        winnerId = whoWon === 'p1' ? p1Id : p2Id;
      }
    } else if (unscheduledOpponent) {
      const isSingles = selected.kind === 'singles';
      p1Id = isSingles ? user?.id : selected.activeTeamId;
      p2Id = isSingles ? unscheduledOpponent.player_id : unscheduledOpponent.team_id;
      winnerId = whoWon === 'me' ? p1Id : p2Id;
    } else {
      alert('Please select participant(s).');
      return;
    }

    setSubmitting(true);
    try {
      const isSingles = selected.kind === 'singles';
      const { error } = await supabase.from('matches').insert({
        ladder_id: selected.ladder_id,
        ...(isSingles
          ? { challenger_id: p1Id, defender_id: p2Id, winner_id: winnerId }
          : { challenger_team_id: p1Id, defender_team_id: p2Id, winner_team_id: winnerId }),
        score_text: unscheduledScore,
        played_at: new Date(unscheduledDate).toISOString(),
        status: isAdmin ? 'completed' : 'score_submitted',
        score_submitted_by: user?.id,
        score_submitted_at: new Date().toISOString(),
        is_unscheduled: true,
      });
      if (error) throw error;
      setShowUnscheduled(false);
      setUnscheduledScore('');
      setP1EntryId('');
      setP2EntryId('');
      setUnscheduledOpponent(null);
      await selectLadder(selected); // refresh
    } catch (err: any) {
      alert(err.message || 'Failed to record result.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownloadReport() {
    if (!selected || !selected.ladders) return;
    const clubName = selected.ladders.clubs?.name || 'Unknown';
    const ladderName = selected.ladders.name || 'Unnamed';
    const dateStr = new Date().toISOString().split('T')[0];
    const reportUrl = `${window.location.origin}/reports/${encodeURIComponent(clubName)}/${encodeURIComponent(ladderName)}/${dateStr}`;
    
    // Copy link
    navigator.clipboard.writeText(reportUrl);
    alert('Shareable report link copied to clipboard!\nGenerating download...');
    
    // Trigger download (opens the public report page)
    window.open(reportUrl); 
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
              const hasEntries = group.entries.length > 0;
              const multiTeam = isDoubles && group.entries.length > 1;
              const activeEntry = group.entries.find((e: any) => e.team_id === group.activeTeamId) ?? group.entries[0];
              // Guard: user may not be in this ladder at all
              const rankLabel = activeEntry
                ? `Rank #${activeEntry.current_rank} · ${activeEntry.wins}W–${activeEntry.losses}L`
                : 'Not joined';

              return (
                <div
                  key={group.ladder_id}
                  onClick={() => selectLadder({ ...group })}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: `1px solid var(--border-color)`,
                    backgroundColor: isActive ? 'rgba(34, 197, 94, 0.15)' : 'var(--surface-color)',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 0 15px rgba(34, 197, 94, 0.1)' : 'none',
                    opacity: hasEntries ? 1 : 0.65,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--secondary-color)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-color)';
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '1rem', marginBottom: '0.2rem' }}>{l?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
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
                    <span style={{ fontSize: '0.8rem', color: hasEntries ? 'var(--primary-color)' : '#9ca3af', fontWeight: 700 }}>{rankLabel}</span>
                  </div>

                  {/* Team selector — only shown for doubles when user has entries */}
                  {isDoubles && hasEntries && (
                    <div style={{ marginTop: '0.5rem' }} onClick={e => e.stopPropagation()}>
                      {multiTeam ? (
                        <select
                          value={group.activeTeamId}
                          onChange={e => {
                            setActiveTeam(group.ladder_id, e.target.value);
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
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            backgroundColor: 'var(--surface-color)',
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
                          🤝 {activeEntry?.teams?.name || 'Unnamed Team'}
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
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-color)' }}>
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
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      onClick={() => setSortMode(sortMode === 'rank' ? 'elo' : 'rank')}
                      className="btn"
                      style={{ 
                        padding: '0.4rem 0.85rem', 
                        fontSize: '0.82rem', 
                        backgroundColor: 'var(--surface-color)', 
                        border: '1px solid var(--primary-color)',
                        color: 'var(--primary-color)',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      <Trophy size={14} /> Sort: {sortMode === 'rank' ? 'Ladder Rank' : 'ELO Rating'}
                    </button>
                    <button
                      onClick={handleDownloadReport}
                      className="btn"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', backgroundColor: 'var(--primary-color)', color: 'white' }}
                    >
                      <Share2 size={13} style={{ marginRight: '0.3rem' }} /> Report
                    </button>
                    <Link
                      to={`/clubs/${selected.ladders?.club_id}/ladders/${selected.ladder_id}`}
                      style={{ fontSize: '0.8rem', color: 'var(--primary-color)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >
                      Full page →
                    </Link>
                  </div>
                </div>

                {/* Sub-header for Unscheduled */}
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    Ranked matches update ELO. Unscheduled matches shift ±1 rank.
                  </span>
                  <button
                    onClick={() => {
                      setUnscheduledOpponent(null);
                      setShowUnscheduled(true);
                    }}
                    className="btn btn-outline"
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Record Unscheduled
                  </button>
                </div>

                {/* Standings rows */}
                {loadingDetails ? (
                  <div style={{ padding: '3rem', color: 'var(--text-light)', textAlign: 'center' }}>Loading standings…</div>
                ) : standings.length === 0 ? (
                  <div style={{ padding: '3rem', color: 'var(--text-light)', textAlign: 'center' }}>No entries yet.</div>
                ) : selected.kind === 'singles' ? (
                  getSortedStandings().map((e: any, i: number) => {
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
                        borderBottom: i < standings.length - 1 || pendingParticipants.length > 0 ? '1px solid var(--border-color)' : 'none',
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
                  getSortedStandings().map((e: any, i: number) => {
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
                        borderBottom: i < standings.length - 1 || pendingParticipants.length > 0 ? '1px solid var(--border-color)' : 'none',
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

                {/* Pending Participants */}
                {pendingParticipants.map((p, idx) => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.25rem',
                    borderBottom: idx < pendingParticipants.length - 1 ? '1px solid var(--border-color)' : 'none',
                    opacity: 0.7
                  }}>
                    <span style={{ minWidth: '2rem', fontWeight: 700, fontSize: '1.1rem', color: '#9ca3af', textAlign: 'center' }}>?</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{p.type}</div>
                    </div>
                  </div>
                ))}
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
      {/* Unscheduled Match Modal */}
      {showUnscheduled && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>
            <button onClick={() => setShowUnscheduled(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-dark)', marginBottom: '1rem' }}>Record Unscheduled Match</h2>
            
            {isAdmin ? (
               <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.5rem' }}>PARTICIPANT 1</label>
                    <select value={p1EntryId} onChange={(e) => setP1EntryId(e.target.value)} className="input" style={{ width: '100%', padding: '0.6rem' }}>
                      <option value="">-- Choose P1 --</option>
                      {standings.map(s => (
                        <option key={s.id} value={s.id}>
                          {selected?.kind === 'singles' ? (s.profiles?.nickname || s.profiles?.first_name) : s.teams?.name} (#{s.current_rank})
                        </option>
                      ))}
                      {pendingParticipants.filter(p => {
                        if (p.type === 'INVITED') return false;
                        if (selected?.kind === 'singles') return !!p.player_id;
                        return !!p.team_id;
                      }).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Pending)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.5rem' }}>PARTICIPANT 2</label>
                    <select value={p2EntryId} onChange={(e) => setP2EntryId(e.target.value)} className="input" style={{ width: '100%', padding: '0.6rem' }}>
                      <option value="">-- Choose P2 --</option>
                      {standings.map(s => (
                        <option key={s.id} value={s.id}>
                          {selected?.kind === 'singles' ? (s.profiles?.nickname || s.profiles?.first_name) : s.teams?.name} (#{s.current_rank})
                        </option>
                      ))}
                      {pendingParticipants.filter(p => {
                        if (p.type === 'INVITED') return false;
                        if (selected?.kind === 'singles') return !!p.player_id;
                        return !!p.team_id;
                      }).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Pending)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {(p1EntryId && p2EntryId) && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.5rem' }}>WHO WON?</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-dark)' }}>
                        <input type="radio" name="whoWonAdmin" checked={whoWon === 'p1'} onChange={() => setWhoWon('p1')} /> 
                        {(() => {
                          let s = standings.find(s => s.id === p1EntryId);
                          if (!s) s = pendingParticipants.find(p => p.id === p1EntryId);
                          return selected?.kind === 'singles' ? (s?.profiles?.nickname || s?.name || 'P1') : (s?.teams?.name || s?.name || 'P1');
                        })()}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-dark)' }}>
                        <input type="radio" name="whoWonAdmin" checked={whoWon === 'p2'} onChange={() => setWhoWon('p2')} /> 
                        {(() => {
                          let s = standings.find(s => s.id === p2EntryId);
                          if (!s) s = pendingParticipants.find(p => p.id === p2EntryId);
                          return selected?.kind === 'singles' ? (s?.profiles?.nickname || s?.name || 'P2') : (s?.teams?.name || s?.name || 'P2');
                        })()}
                      </label>
                    </div>
                  </div>
                )}
               </>
            ) : (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.5rem' }}>SELECT OPPONENT</label>
                  <select 
                    value={unscheduledOpponent?.id || ''} 
                    onChange={(e) => {
                      let opp = standings.find(s => s.id === e.target.value);
                      if (!opp) opp = pendingParticipants.find(p => p.id === e.target.value);
                      setUnscheduledOpponent(opp);
                    }}
                    className="input"
                    style={{ width: '100%', padding: '0.6rem' }}
                  >
                    <option value="">-- Choose Opponent --</option>
                    {standings.filter(s => {
                      if (selected?.kind === 'singles') return s.player_id !== user?.id;
                      return s.team_id !== selected?.activeTeamId;
                    }).map(s => (
                      <option key={s.id} value={s.id}>
                        {selected?.kind === 'singles' 
                          ? (s.profiles?.nickname || s.profiles?.first_name)
                          : s.teams?.name} (Rank #{s.current_rank})
                      </option>
                    ))}
                    {pendingParticipants.filter(p => {
                      if (p.type === 'INVITED') return false;
                      if (selected?.kind === 'singles') return p.player_id && p.player_id !== user?.id;
                      return p.team_id && p.team_id !== selected?.activeTeamId;
                    }).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Pending)
                      </option>
                    ))}
                  </select>
                </div>
            )}

            {(isAdmin ? (p1EntryId && p2EntryId) : unscheduledOpponent) && (
              <>
                {!isAdmin && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.5rem' }}>WHO WON?</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-dark)' }}>
                        <input type="radio" name="whoWon" checked={whoWon === 'me'} onChange={() => setWhoWon('me')} /> Me / My Team
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-dark)' }}>
                        <input type="radio" name="whoWon" checked={whoWon === 'opponent'} onChange={() => setWhoWon('opponent')} /> {selected?.kind === 'singles' ? (unscheduledOpponent.profiles?.nickname || unscheduledOpponent.name || 'Opponent') : (unscheduledOpponent.teams?.name || unscheduledOpponent.name || 'Opponent Team')}
                      </label>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.5rem' }}>SCORE</label>
                    <input 
                      type="text" 
                      value={unscheduledScore} 
                      onChange={e => setUnscheduledScore(e.target.value)}
                      placeholder="e.g. 21-15, 21-18"
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.5rem' }}>DATE</label>
                    <input 
                      type="date" 
                      value={unscheduledDate} 
                      onChange={e => setUnscheduledDate(e.target.value)}
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-outline" onClick={() => setShowUnscheduled(false)}>Cancel</button>
                  <button 
                    className="btn" 
                    disabled={submitting || !unscheduledScore}
                    onClick={submitUnscheduledResult}
                    style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
                  >
                    {submitting ? 'Saving...' : 'Submit Result'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

