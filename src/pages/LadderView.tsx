import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Trophy, UserPlus, Plus, X, Swords, CheckCircle } from 'lucide-react';

const SPORT_ICONS: Record<string, string> = {
  'Badminton': '🏸', 'Tennis': '🎾', 'Table Tennis': '🏓',
  'Squash': '🟡', 'Pickle Ball': '🥒', 'Paddle': '🏏',
};

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

  // For doubles team creation
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [partner, setPartner] = useState('');
  const [clubMembers, setClubMembers] = useState<any[]>([]);
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState('');
  const [myMatches, setMyMatches] = useState<any[]>([]);

  // Challenge
  const [challengeTarget, setChallengeTarget] = useState<any>(null);
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [challengeErr, setChallengeErr] = useState('');

  useEffect(() => {
    if (ladderId && user) load();
  }, [ladderId, user]);

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

      if (lad.type === 'singles') {
        const { data: players } = await supabase
          .from('ladder_players')
          .select('*, profiles(nickname, first_name, avatar_url, elo_rating)')
          .eq('ladder_id', ladderId)
          .order('current_rank');
        setEntries(players || []);
        const me = (players || []).find((p: any) => p.player_id === user?.id);
        setMyRank(me?.current_rank ?? null);
      } else {
        const { data: teams } = await supabase
          .from('ladder_teams')
          .select('*, teams(name, player1_id, player2_id, elo_rating, profiles_player1:profiles!teams_player1_id_fkey(nickname, first_name, elo_rating, doubles_elo), profiles_player2:profiles!teams_player2_id_fkey(nickname, first_name, elo_rating, doubles_elo))')
          .eq('ladder_id', ladderId)
          .order('current_rank'); // current_rank is ELO-ordered by DB trigger
        setEntries(teams || []);

        // My teams in this club
        const { data: mt } = await supabase
          .from('teams')
          .select('*, profiles_player1:profiles!teams_player1_id_fkey(nickname, first_name), profiles_player2:profiles!teams_player2_id_fkey(nickname, first_name)')
          .eq('club_id', id)
          .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`);
        setMyTeams(mt || []);

        const meTeamIds = (mt || []).map((t: any) => t.id);
        const joined = (teams || []).find((lt: any) => meTeamIds.includes(lt.team_id));
        setMyRank(joined?.current_rank ?? null);

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
        const isParticipant = (isSingles && (m.challenger_id === user?.id || m.defender_id === user?.id)) ||
                            (!isSingles && myTeams.some(t => t.id === m.challenger_team_id || t.id === m.defender_team_id));
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
      const nextRank = entries.length + 1;
      const { error } = await supabase
        .from('ladder_teams')
        .insert({ ladder_id: ladderId, team_id: selectedTeam, current_rank: nextRank });
      if (error) throw error;
      await load();
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join ladder.');
    } finally {
      setJoining(false);
    }
  }

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
          : { challenger_team_id: myTeamInLadder?.team_id, defender_team_id: challengeTarget.team_id }),
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

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading ladder…</div>;
  if (!ladder) return <div style={{ padding: '2rem', color: '#ef4444' }}>Ladder not found.</div>;

  const isSingles = ladder.type === 'singles';
  const alreadyJoined = myRank !== null;
  // For doubles: find which ladder_team entry belongs to the user
  const myTeamInLadder = !isSingles
    ? entries.find((e: any) => myTeams.some((t: any) => t.id === e.team_id))
    : null;

  return (
    <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Link to={`/clubs/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Club
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
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

        {!alreadyJoined && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
            {isSingles ? (
              <button
                className="btn"
                style={{ backgroundColor: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={joinSingles}
                disabled={joining}
              >
                <UserPlus size={16} /> {joining ? 'Joining…' : 'Join Ladder'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={selectedTeam}
                    onChange={e => setSelectedTeam(e.target.value)}
                    style={{ padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                  >
                    <option value="">Select your team…</option>
                    {myTeams.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name || 'Unnamed Team'}</option>
                    ))}
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
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => setShowCreateTeam(!showCreateTeam)}
                >
                  <Plus size={14} /> Form a new team
                </button>
              </div>
            )}
            {joinError && <p style={{ color: '#dc2626', fontSize: '0.8rem' }}>{joinError}</p>}
          </div>
        )}

        {alreadyJoined && (
          <span style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', backgroundColor: '#d1fae5', color: '#065f46', fontWeight: 600, fontSize: '0.85rem' }}>
            ✅ You're in at rank #{myRank}
          </span>
        )}
      </div>

      {/* Form new team panel */}
      {showCreateTeam && (
        <div className="card" style={{ border: '2px solid var(--primary-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, color: '#111827' }}>Form a Doubles Team</h3>
            <button onClick={() => setShowCreateTeam(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <form onSubmit={createTeam} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>Team Name</label>
              <input
                type="text" required value={teamName} onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. The Giants"
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>Partner</label>
              <select
                required value={partner} onChange={e => setPartner(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
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
        </div>
      )}

      {/* Standings */}
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
                ? `${entry.wins}W – ${entry.losses}L · ELO: ${entry.profiles?.elo_rating || 800}`
                : (() => {
                    const p1 = entry.teams?.profiles_player1?.nickname || entry.teams?.profiles_player1?.first_name || '?';
                    const p2 = entry.teams?.profiles_player2?.nickname || entry.teams?.profiles_player2?.first_name || '?';
                    const p1dElo = entry.teams?.profiles_player1?.doubles_elo || 800;
                    const p2dElo = entry.teams?.profiles_player2?.doubles_elo || 800;
                    // Individual doubles ELOs shown as bragging rights only
                    return `${p1} (${p1dElo}) & ${p2} (${p2dElo}) · ${entry.wins}W – ${entry.losses}L`;
                  })();

              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

              // Show challenge button only for entries 1 or 2 ranks above the user
              const canChallenge =
                !isMe &&
                alreadyJoined &&
                myRank !== null &&
                entry.current_rank >= myRank - 2 &&
                entry.current_rank < myRank;

              const hasActiveMatch = myMatches.some(m => 
                (isSingles && (m.challenger_id === entry.player_id || m.defender_id === entry.player_id)) ||
                (!isSingles && (m.challenger_team_id === entry.team_id || m.defender_team_id === entry.team_id))
              );

              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.75rem 0.5rem', borderBottom: i < entries.length - 1 ? '1px solid #f3f4f6' : 'none',
                    backgroundColor: isMe ? '#f0fdf4' : 'transparent',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ minWidth: '2rem', fontWeight: 700, fontSize: '1.1rem', color: '#374151' }}>
                    {medal || `#${entry.current_rank}`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: isMe ? 700 : 600, color: isMe ? '#065f46' : '#111827' }}>
                      {displayName} {isMe ? '(you)' : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{subText}</div>
                  </div>
                  {/* ELO badge for doubles */}
                  {!isSingles && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', backgroundColor: '#ede9fe', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                      Team ELO: {entry.teams?.elo_rating || 800}
                    </span>
                  )}
                  {canChallenge && (
                    <button
                      onClick={() => { if (!hasActiveMatch) { setChallengeTarget(entry); setChallengeErr(''); } }}
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
                      <Swords size={13} /> {hasActiveMatch ? 'Already Challenged' : 'Challenge'}
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
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
              (rank #{challengeTarget.current_rank}) in <strong>{ladder.name}</strong>.
            </p>
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
