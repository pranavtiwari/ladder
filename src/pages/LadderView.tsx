import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Trophy, UserPlus, X, Swords, CheckCircle } from 'lucide-react';

const SPORT_ICONS: Record<string, string> = {
  'Badminton': '🏸', 'Tennis': '🎾', 'Table Tennis': '🏓',
  'Squash': '🟡', 'Pickle Ball': '🥒', 'Paddle': '🏏',
};

const CREATE_TEAM_VALUE = '__create_team__';

export default function LadderView() {
  const { id, ladderId } = useParams<{ id: string; ladderId: string }>();
  const { user } = useAuth();

  const [ladder, setLadder] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);   // ladder_players or ladder_teams
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [ladderPlayersMap, setLadderPlayersMap] = useState<Map<string, number>>(new Map());
  const [activeTeamId, setActiveTeamId] = useState<string>('');

  // For doubles team creation
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [partner, setPartner] = useState('');
  const [clubMembers, setClubMembers] = useState<any[]>([]);
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState('');
  const [myMatches, setMyMatches] = useState<any[]>([]);

  // Sync activeTeamId when entries/myTeams change (must be before any early returns)
  useEffect(() => {
    const myTeamsInLadder = entries.filter((e: any) => myTeams.some((t: any) => t.id === e.team_id));
    if (myTeamsInLadder.length > 0 && !myTeamsInLadder.find((e: any) => e.team_id === activeTeamId)) {
      setActiveTeamId(myTeamsInLadder[0].team_id);
    }
  }, [entries, activeTeamId, myTeams]);

  // Challenge
  const [challengeTarget, setChallengeTarget] = useState<any>(null);
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [challengeErr, setChallengeErr] = useState('');

  useEffect(() => {
    if (ladderId && user) load();
  }, [ladderId, user]);

  // Sort entries by ELO descending and assign display ranks
  function sortByElo(data: any[], kind: 'singles' | 'doubles') {
    const sorted = [...data].sort((a, b) => (b.elo_rating ?? 800) - (a.elo_rating ?? 800));
    return sorted.map((entry, i) => ({ ...entry, display_rank: i + 1 }));
  }

  async function load() {
    setLoading(true);
    try {
      const { data: lad, error: lErr } = await supabase
        .from('ladders')
        .select('*')
        .eq('id', ladderId)
        .single();
      if (lErr) throw lErr;
      setLadder(lad);

      let loadedTeams = myTeams;

      if (lad.type === 'singles') {
        const { data: players } = await supabase
          .from('ladder_players')
          .select('*, profiles(nickname, first_name, avatar_url)')
          .eq('ladder_id', ladderId)
          .gt('current_rank', 0);
        const sorted = sortByElo(players || [], 'singles');
        setEntries(sorted);
        const me = sorted.find((p: any) => p.player_id === user?.id);
        setMyRank(me?.display_rank ?? null);
      } else {
        const { data: teams } = await supabase
          .from('ladder_teams')
          .select('*, teams(name, player1_id, player2_id, profiles_player1:profiles!teams_player1_id_fkey(nickname, first_name), profiles_player2:profiles!teams_player2_id_fkey(nickname, first_name))')
          .eq('ladder_id', ladderId);
        const sorted = sortByElo(teams || [], 'doubles');
        setEntries(sorted);

        const { data: lPlayers } = await supabase.from('ladder_players').select('*').eq('ladder_id', ladderId);
        const lPMap = new Map((lPlayers || []).map((p: any) => [p.player_id, p.elo_rating]));
        setLadderPlayersMap(lPMap);

        // My teams in this club
        const { data: mt } = await supabase
          .from('teams')
          .select('*, profiles_player1:profiles!teams_player1_id_fkey(nickname, first_name), profiles_player2:profiles!teams_player2_id_fkey(nickname, first_name)')
          .eq('club_id', id)
          .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`);
        setMyTeams(mt || []);
        loadedTeams = mt || [];

        const meTeamIds = (mt || []).map((t: any) => t.id);
        const joined = sorted.find((lt: any) => meTeamIds.includes(lt.team_id));
        setMyRank(joined?.display_rank ?? null);

        // For displaying club members to pick a partner
        const { data: members } = await supabase
          .from('club_members')
          .select('player_id, profiles(nickname, first_name, avatar_url)')
          .eq('club_id', id)
          .neq('player_id', user?.id);
        setClubMembers(members || []);
      }

      // Load my active matches in this ladder
      const { data: myMatchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('ladder_id', ladderId)
        .in('status', ['pending', 'accepted', 'score_submitted']);
      const filteredMatches = (myMatchesData || []).filter(m => {
        const isParticipant = (lad.type === 'singles' && (m.challenger_id === user?.id || m.defender_id === user?.id)) ||
                            (lad.type !== 'singles' && loadedTeams.some((t: any) => t.id === m.challenger_team_id || t.id === m.defender_team_id));
        return isParticipant;
      });
      setMyMatches(filteredMatches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function joinSingles() {
    setJoining(true);
    setJoinError('');
    try {
      const nextRank = entries.length + 1;
      const { error } = await supabase
        .from('ladder_players')
        .insert({ ladder_id: ladderId, player_id: user?.id, current_rank: nextRank });
      if (error) throw error;
      await load();
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join ladder.');
    } finally {
      setJoining(false);
    }
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setCreatingTeam(true);

    // Check if the pair already exists in myTeams
    const existingTeam = myTeams.find(
      (t: any) => (t.player1_id === user?.id && t.player2_id === partner) ||
                  (t.player1_id === partner && t.player2_id === user?.id)
    );

    if (existingTeam) {
      alert(`You already have a team with this player (${existingTeam.name}). Please use it instead.`);
      setCreatingTeam(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({ club_id: id, name: teamName, player1_id: user?.id, player2_id: partner })
        .select()
        .single();
      if (error) throw error;
      setMyTeams(prev => [...prev, data]);
      setSelectedTeam(data.id);
      setShowCreateTeam(false);
      setTeamName('');
      setPartner('');
    } catch (err: any) {
      alert(err.message || 'Failed to create team.');
    } finally {
      setCreatingTeam(false);
    }
  }

  async function joinDoubles() {
    if (!selectedTeam) return;
    setJoining(true);
    setJoinError('');
    try {
      // Find the team from 'myTeams'
      const t = myTeams.find(t => t.id === selectedTeam);
      
      const nextRank = entries.length + 1;
      const { error } = await supabase
        .from('ladder_teams')
        .insert({ ladder_id: ladderId, team_id: selectedTeam, current_rank: nextRank });
      if (error) throw error;
      
      // Attempt to ensure ladder_players exist for the team members to initialize individual ELO
      if (t) {
        // Safe to ignore unique constraint errors
        await supabase.from('ladder_players').insert([
          { ladder_id: ladderId, player_id: t.player1_id, current_rank: 0 },
          { ladder_id: ladderId, player_id: t.player2_id, current_rank: 0 }
        ]).select().then(() => {}); 
      }

      await load();
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join ladder.');
    } finally {
      setJoining(false);
    }
  }

  const [challengeWithTeamId, setChallengeWithTeamId] = useState('');

  async function submitChallenge() {
    if (!challengeTarget) return;
    setSubmittingChallenge(true);
    setChallengeErr('');
    try {
      const isSinglesLadder = ladder.type === 'singles';
      const { error } = await supabase.from('matches').insert({
        ladder_id: ladderId,
        ...(isSinglesLadder
          ? { challenger_id: user?.id, defender_id: challengeTarget.player_id }
          : { challenger_team_id: challengeWithTeamId || myTeamsInLadder[0]?.team_id, defender_team_id: challengeTarget.team_id }),
        status: 'pending',
      });
      if (error) throw error;
      setChallengeTarget(null);
      await load(); // Reload to update UI
    } catch (err: any) {
      setChallengeErr(err.message || 'Failed to send challenge.');
    } finally {
      setSubmittingChallenge(false);
    }
  }

  // Handle team select including the "Create new team" sentinel
  function handleTeamSelectChange(value: string) {
    if (value === CREATE_TEAM_VALUE) {
      setShowCreateTeam(true);
      setSelectedTeam('');
    } else {
      setSelectedTeam(value);
      setShowCreateTeam(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading ladder…</div>;
  if (!ladder) return <div style={{ padding: '2rem', color: '#ef4444' }}>Ladder not found.</div>;

  const isSingles = ladder.type === 'singles';
  const alreadyJoined = myRank !== null;
  // For doubles: find which ladder_team entries belong to the user
  const myTeamsInLadder = !isSingles
    ? entries.filter((e: any) => myTeams.some((t: any) => t.id === e.team_id))
    : [];

  const activeTeamEntry = myTeamsInLadder.find((e: any) => e.team_id === activeTeamId) || myTeamsInLadder[0];
  const myActiveRank = isSingles ? myRank : (activeTeamEntry?.display_rank ?? null);

  // Filter available teams for join dropdown
  const availableTeamsForJoin = myTeams.filter((t: any) => {
    if (entries.find((e: any) => e.team_id === t.id)) return false;
    const pairMatch = entries.find((e: any) =>
      (e.teams?.player1_id === t.player1_id && e.teams?.player2_id === t.player2_id) ||
      (e.teams?.player1_id === t.player2_id && e.teams?.player2_id === t.player1_id)
    );
    return !pairMatch;
  });

  return (
    <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Link to={`/clubs/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Club
      </Link>

      {/* ── Ladder title ── */}
      <div>
        <h1 className="page-title" style={{ color: 'var(--primary-color)', marginBottom: '0.2rem' }}>{ladder.name}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{SPORT_ICONS[ladder.sport]} {ladder.sport}</span>
          <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: isSingles ? '#dbeafe' : '#fce7f3', color: isSingles ? '#1d4ed8' : '#be185d' }}>
            {isSingles ? '👤 Singles' : '👥 Doubles'}
          </span>
        </div>
        {ladder.rules && <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.875rem' }}>{ladder.rules}</p>}
      </div>

      {/* ── Status bar: rank + team selector (mobile-first top row) ── */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
        {isSingles ? (
          alreadyJoined ? (
            <span style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', backgroundColor: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: '1rem' }}>
              ✅ Rank #{myRank}
            </span>
          ) : (
            <button
              className="btn"
              style={{ backgroundColor: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={joinSingles}
              disabled={joining}
            >
              <UserPlus size={16} /> {joining ? 'Joining…' : 'Join Ladder'}
            </button>
          )
        ) : (
          <>
            {alreadyJoined && (
              <>
                <span style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', backgroundColor: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: '1rem' }}>
                  ✅ Rank #{myActiveRank}
                </span>
                {myTeamsInLadder.length > 1 && (
                  <select
                    value={activeTeamId}
                    onChange={e => setActiveTeamId(e.target.value)}
                    style={{ padding: '0.35rem 0.6rem', border: '1px solid #d1fae5', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    {myTeamsInLadder.map((mt: any) => (
                      <option key={mt.team_id} value={mt.team_id}>As {mt.teams?.name}</option>
                    ))}
                  </select>
                )}
                {myTeamsInLadder.length === 1 && (
                  <span style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>
                    🤝 {activeTeamEntry?.teams?.name}
                  </span>
                )}
              </>
            )}
          </>
        )}
        {joinError && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0 }}>{joinError}</p>}
      </div>

      {/* ── Join / create team widget (doubles) ── */}
      {!isSingles && (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedTeam}
              onChange={e => handleTeamSelectChange(e.target.value)}
              style={{ flex: 1, minWidth: '180px', padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
            >
              <option value="">Select a team to join…</option>
              {availableTeamsForJoin.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name || 'Unnamed Team'}</option>
              ))}
              <option value={CREATE_TEAM_VALUE}>＋ Form a new team…</option>
            </select>
            <button
              className="btn"
              style={{ backgroundColor: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={joinDoubles}
              disabled={joining || !selectedTeam}
            >
              <UserPlus size={16} /> {joining ? 'Joining…' : 'Join'}
            </button>
          </div>

          {/* Inline team creation form */}
          {showCreateTeam && (
            <form onSubmit={createTeam} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fafbfc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>Form a Doubles Team</span>
                <button type="button" onClick={() => setShowCreateTeam(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={16} /></button>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Team Name</label>
                <input
                  type="text" required value={teamName} onChange={e => setTeamName(e.target.value)}
                  placeholder="e.g. The Giants"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Partner</label>
                <select
                  required value={partner} onChange={e => setPartner(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                >
                  <option value="">Select a club member…</option>
                  {clubMembers.map((m: any) => {
                    const p = m.profiles;
                    const name = p?.nickname || p?.first_name || m.player_id.slice(0, 8);
                    return <option key={m.player_id} value={m.player_id}>{name}</option>;
                  })}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateTeam(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }} disabled={creatingTeam}>
                  {creatingTeam ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Standings ── */}
      <div className="card">
        <h2 className="section-title" style={{ marginBottom: '1rem' }}>
          <Trophy size={18} style={{ display: 'inline', marginRight: '0.4rem', color: '#f59e0b' }} />
          Standings
        </h2>

        {entries.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1.5rem' }}>No one has joined yet. Be the first!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {entries.map((entry: any, i: number) => {
              const isMe = isSingles
                ? entry.player_id === user?.id
                : (entry.teams?.player1_id === user?.id || entry.teams?.player2_id === user?.id);

              const displayName = isSingles
                ? (entry.profiles?.nickname || entry.profiles?.first_name || '—')
                : (entry.teams?.name || 'Unnamed Team');

              const subText = isSingles
                ? `${entry.wins}W – ${entry.losses}L · ELO: ${entry.elo_rating ?? 800}`
                : (() => {
                    const p1 = entry.teams?.profiles_player1?.nickname || entry.teams?.profiles_player1?.first_name || '?';
                    const p2 = entry.teams?.profiles_player2?.nickname || entry.teams?.profiles_player2?.first_name || '?';
                    const p1dElo = ladderPlayersMap.get(entry.teams?.player1_id) ?? 800;
                    const p2dElo = ladderPlayersMap.get(entry.teams?.player2_id) ?? 800;
                    return `${p1} (${p1dElo}) & ${p2} (${p2dElo}) · ${entry.wins}W – ${entry.losses}L`;
                  })();

              const rank = entry.display_rank;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

              // Allow challenging up to 3 above and 3 below
              const canChallenge =
                !isMe &&
                alreadyJoined &&
                myActiveRank !== null &&
                Math.abs(rank - myActiveRank) <= 3 &&
                rank !== myActiveRank;

              const hasActiveMatch = myMatches.some(m =>
                (isSingles && (m.challenger_id === entry.player_id || m.defender_id === entry.player_id)) ||
                (!isSingles && (m.challenger_team_id === entry.team_id || m.defender_team_id === entry.team_id))
              );

              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 0.5rem', borderBottom: i < entries.length - 1 ? '1px solid #f3f4f6' : 'none',
                    backgroundColor: isMe ? '#f0fdf4' : 'transparent',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ minWidth: '2rem', fontWeight: 700, fontSize: '1.1rem', color: '#374151', textAlign: 'center' }}>
                    {medal || `#${rank}`}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isMe ? 700 : 600, color: isMe ? '#065f46' : '#111827' }}>
                      {displayName} {isMe ? '(you)' : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{subText}</div>
                  </div>
                  {/* ELO badge for doubles */}
                  {!isSingles && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', backgroundColor: '#ede9fe', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                      Team ELO: {entry.elo_rating ?? 800}
                    </span>
                  )}
                  {canChallenge && (
                    <button
                      onClick={() => {
                        if (!hasActiveMatch) {
                          setChallengeTarget(entry);
                          setChallengeErr('');
                          if (!isSingles) {
                            setChallengeWithTeamId(activeTeamId || myTeamsInLadder[0]?.team_id);
                          }
                        }
                      }}
                      disabled={hasActiveMatch}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem',
                        backgroundColor: hasActiveMatch ? '#f3f4f6' : '#fff7ed',
                        color: hasActiveMatch ? '#9ca3af' : '#c2410c',
                        border: '1px solid ' + (hasActiveMatch ? '#e5e7eb' : '#fdba74'),
                        cursor: hasActiveMatch ? 'default' : 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                      }}
                    >
                      <Swords size={13} /> {hasActiveMatch ? 'Active' : 'Challenge'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Challenge Confirmation Modal */}
      {challengeTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
            <button onClick={() => setChallengeTarget(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <Swords size={22} color="#c2410c" />
              <h2 style={{ fontWeight: 700, fontSize: '1.15rem', color: '#111827' }}>Send Challenge</h2>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              You are challenging{' '}
              <strong style={{ color: '#111827' }}>
                {isSingles
                  ? (challengeTarget.profiles?.nickname || challengeTarget.profiles?.first_name)
                  : (challengeTarget.teams?.name || 'this team')}
              </strong>{' '}
              (rank #{challengeTarget.display_rank}) in <strong>{ladder.name}</strong>.
            </p>
            {!isSingles && myTeamsInLadder.length > 1 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>Challenge As Team</label>
                <select
                  value={challengeWithTeamId}
                  onChange={e => setChallengeWithTeamId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                >
                  {myTeamsInLadder.map((mt: any) => (
                    <option key={mt.team_id} value={mt.team_id}>{mt.teams?.name}</option>
                  ))}
                </select>
              </div>
            )}
            {challengeErr && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{challengeErr}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setChallengeTarget(null)}>Cancel</button>
              <button
                className="btn"
                style={{ backgroundColor: '#c2410c', color: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                disabled={submittingChallenge}
                onClick={submitChallenge}
              >
                <CheckCircle size={15} /> {submittingChallenge ? 'Sending…' : 'Send Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
