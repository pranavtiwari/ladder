import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, LogOut, Users, Swords, Trophy, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [clubs, setClubs] = useState<any[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<any[]>([]);
  const [pendingScores, setPendingScores] = useState<any[]>([]);
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [processingReq, setProcessingReq] = useState<string | null>(null);

  // Score recording
  const [recordingMatch, setRecordingMatch] = useState<any>(null);
  const [scoreText, setScoreText] = useState('');
  const [winnerId, setWinnerId] = useState('');
  const [submittingScore, setSubmittingScore] = useState(false);

  useEffect(() => {
    if (user) {
      loadClubs();
      loadJoinRequests();
      loadMatches();
      loadRanks();
    }
  }, [user]);

  async function loadClubs() {
    setLoadingClubs(true);
    try {
      const { data } = await supabase
        .from('clubs')
        .select('*, club_members!inner(role)')
        .eq('club_members.player_id', user?.id)
        .order('created_at', { ascending: false });
      setClubs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClubs(false);
    }
  }

  async function loadJoinRequests() {
    try {
      const { data: adminClubs } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('player_id', user?.id)
        .eq('role', 'admin');
      if (!adminClubs || adminClubs.length === 0) return;
      const clubIds = adminClubs.map((c: any) => c.club_id);
      const { data } = await supabase
        .from('club_join_requests')
        .select('id, club_id, player_id, status, clubs(name), profiles(nickname, first_name, last_name, avatar_url)')
        .in('club_id', clubIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      setJoinRequests(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadMatches() {
    try {
      // 1. Get my teams first for filtering
      const { data: myTeams } = await supabase
        .from('teams')
        .select('id')
        .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`);
      const myTeamIds = myTeams?.map(t => t.id) || [];
      const teamFilter = myTeamIds.length > 0 ? `,challenger_team_id.in.(${myTeamIds.join(',')}),defender_team_id.in.(${myTeamIds.join(',')})` : '';

      const { data } = await supabase
        .from('matches')
        .select(`
          id, status, challenger_id, defender_id, challenger_team_id, defender_team_id, winner_id, winner_team_id, score_text, score_submitted_by, score_submitted_at,
          ladders(id, name, type, club_id, clubs(name)),
          challenger:profiles!matches_challenger_id_fkey(id, nickname, first_name, avatar_url),
          defender:profiles!matches_defender_id_fkey(id, nickname, first_name, avatar_url),
          challenger_team:teams!matches_challenger_team_id_fkey(id, name, player1_id, player2_id),
          defender_team:teams!matches_defender_team_id_fkey(id, name, player1_id, player2_id)
        `)
        .or(`challenger_id.eq.${user?.id},defender_id.eq.${user?.id}${teamFilter}`)
        .order('played_at', { ascending: false });

      const matches = data || [];
      const now = new Date();

      // 24h Auto-accept logic
      for (const m of matches) {
        if (m.status === 'score_submitted' && m.score_submitted_at) {
          const submittedAt = new Date(m.score_submitted_at);
          const hoursDiff = (now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60);
          if (hoursDiff >= 24) {
            await supabase.from('matches').update({ status: 'completed' }).eq('id', m.id);
            m.status = 'completed';
          }
        }
      }

      setPendingChallenges(matches.filter((m: any) => m.status === 'pending'));
      setPendingScores(matches.filter((m: any) => m.status === 'accepted'));
      setConfirmations(matches.filter((m: any) => m.status === 'score_submitted' && m.score_submitted_by !== user?.id));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRanks() {
    try {
      const { data } = await supabase
        .from('ladder_players')
        .select('current_rank, wins, losses, ladders(id, name, sport, club_id, clubs(name))')
        .eq('player_id', user?.id)
        .order('current_rank');
      setRanks(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleJoinRequest(reqId: string, playerId: string, clubId: string, approved: boolean) {
    setProcessingReq(reqId);
    try {
      await supabase.from('club_join_requests').update({ status: approved ? 'approved' : 'rejected' }).eq('id', reqId);
      if (approved) {
        await supabase.from('club_members').insert({ club_id: clubId, player_id: playerId, role: 'member' });
      }
      await loadClubs();
      setJoinRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err: any) {
      alert(err.message || 'Failed.');
    } finally {
      setProcessingReq(null);
    }
  }

  async function acceptChallenge(matchId: string) {
    await supabase.from('matches').update({ status: 'accepted' }).eq('id', matchId);
    await loadMatches();
  }

  async function declineChallenge(matchId: string) {
    await supabase.from('matches').update({ status: 'declined' }).eq('id', matchId);
    await loadMatches();
  }

  async function submitScore() {
    if (!recordingMatch || !winnerId) return;
    setSubmittingScore(true);
    try {
      const { error } = await supabase.from('matches').update({
        score_text: scoreText,
        winner_id: winnerId,
        status: 'score_submitted',
        score_submitted_by: user?.id,
        score_submitted_at: new Date().toISOString()
      }).eq('id', recordingMatch.id);
      if (error) throw error;
      setRecordingMatch(null);
      setScoreText('');
      setWinnerId('');
      await loadMatches();
    } catch (err: any) {
      alert(err.message || 'Failed to submit score.');
    } finally {
      setSubmittingScore(false);
    }
  }

  async function abandonMatch() {
    if (!recordingMatch) return;
    setSubmittingScore(true); // Reusing the loading state
    try {
      const { error } = await supabase.from('matches').update({ status: 'abandoned' }).eq('id', recordingMatch.id);
      if (error) throw error;
      setRecordingMatch(null);
      await loadMatches();
    } catch (err: any) {
      alert(err.message || 'Failed to abandon match.');
    } finally {
      setSubmittingScore(false);
    }
  }

  async function confirmScore(match: any) {
    try {
      // Mark match as completed — DB trigger handles rank swap, stats, and ELO automatically
      const { error } = await supabase.from('matches').update({ status: 'completed' }).eq('id', match.id);
      if (error) throw error;
      await loadMatches();
      await loadRanks();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm score.');
    }
  }

  const totalActions = joinRequests.length + pendingChallenges.filter((m: any) => m.defender_id === user?.id).length + pendingScores.length + confirmations.length;

  function displayName(p: any) {
    return p?.nickname || p?.first_name || '—';
  }

  return (
    <div className="flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div className="flex items-center gap-4">
          {user?.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url} alt="Profile" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--primary-color)' }} />
          )}
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'Player'}
          </h1>
        </div>
        <button onClick={signOut} className="btn btn-outline flex items-center gap-2">
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* Action Required */}
      <section className="card">
        <h2 className="section-title">
          Action Required {totalActions > 0 && (
            <span style={{ marginLeft: '0.5rem', padding: '1px 8px', borderRadius: '999px', backgroundColor: '#ef4444', color: 'white', fontSize: '0.75rem', fontWeight: 700 }}>
              {totalActions}
            </span>
          )}
        </h2>

        {totalActions === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No pending actions. You're all caught up! 🎉</p>
        ) : (
          <div className="flex-col gap-3">
            {/* Join requests */}
            {joinRequests.map(req => {
              const p = req.profiles;
              const name = p?.nickname || p?.first_name || 'Someone';
              return (
                <div key={req.id} style={{ padding: '0.85rem 1rem', backgroundColor: '#fefce8', borderRadius: 'var(--radius-md)', border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    {p?.avatar_url
                      ? <img src={p.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                      : <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={16} color="#9ca3af" /></div>}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Club Join Request</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        <strong>{name}</strong> wants to join <Link to={`/clubs/${req.club_id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}>{req.clubs?.name}</Link>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn" style={{ backgroundColor: '#059669', color: 'white', padding: '0.3rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} disabled={processingReq === req.id} onClick={() => handleJoinRequest(req.id, req.player_id, req.club_id, true)}>
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }} disabled={processingReq === req.id} onClick={() => handleJoinRequest(req.id, req.player_id, req.club_id, false)}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Incoming challenges (user is the defender) */}
            {pendingChallenges.filter((m: any) => m.defender_id === user?.id).map(match => (
              <div key={match.id} style={{ padding: '0.85rem 1rem', backgroundColor: '#fff7ed', borderRadius: 'var(--radius-md)', border: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Swords size={20} color="#c2410c" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Match Challenge</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      <strong>{displayName(match.challenger)}</strong> challenged you in <strong>{match.ladders?.name}</strong> ({match.ladders?.clubs?.name})
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" style={{ backgroundColor: '#059669', color: 'white', padding: '0.3rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => acceptChallenge(match.id)}>
                    <CheckCircle size={14} /> Accept
                  </button>
                  <button className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => declineChallenge(match.id)}>
                    <XCircle size={14} /> Decline
                  </button>
                </div>
              </div>
            ))}

            {/* Pending score recording */}
            {pendingScores.map(match => {
              const ladder = match.ladders;
              const isSingles = ladder?.type === 'singles';
              const opponentName = isSingles 
                ? (match.challenger_id === user?.id ? displayName(match.defender) : displayName(match.challenger))
                : (match.challenger_team?.player1_id === user?.id || match.challenger_team?.player2_id === user?.id ? (match.defender_team?.name) : (match.challenger_team?.name));

              return (
                <div key={match.id} style={{ padding: '0.85rem 1rem', backgroundColor: '#f0f9ff', borderRadius: 'var(--radius-md)', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Trophy size={20} color="#0284c7" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>In Progress Match</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        vs <strong>{opponentName}</strong> in <strong>{ladder?.name}</strong>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setRecordingMatch(match)} className="btn" style={{ padding: '0.3rem 0.8rem', backgroundColor: '#0284c7', color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>
                    Record Score
                  </button>
                </div>
              );
            })}

            {/* Score confirmations */}
            {confirmations.map(match => {
              const submitterName = match.score_submitted_by === match.challenger_id ? displayName(match.challenger) : displayName(match.defender);
              
              return (
                <div key={match.id} style={{ padding: '0.85rem 1rem', backgroundColor: '#ecfdf5', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CheckCircle size={20} color="#059669" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Confirm Score</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        <strong>{submitterName}</strong> recorded <strong>{match.score_text}</strong>.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => confirmScore(match)} className="btn" style={{ padding: '0.3rem 0.8rem', backgroundColor: '#059669', color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>
                      Confirm
                    </button>
                    <button onClick={() => supabase.from('matches').update({ status: 'disputed' }).eq('id', match.id).then(() => loadMatches())} className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', color: '#dc2626', borderColor: '#dc2626', fontSize: '0.8rem' }}>
                      Dispute
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Record Score Modal */}
      {recordingMatch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
            <button onClick={() => setRecordingMatch(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy size={20} color="#f59e0b" /> Record Result
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Who won?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="winner" value={recordingMatch.ladders?.type === 'singles' ? recordingMatch.challenger_id : recordingMatch.challenger_team_id} checked={winnerId === (recordingMatch.ladders?.type === 'singles' ? recordingMatch.challenger_id : recordingMatch.challenger_team_id)} onChange={e => setWinnerId(e.target.value)} />
                  {recordingMatch.ladders?.type === 'singles' ? displayName(recordingMatch.challenger) : recordingMatch.challenger_team?.name}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="winner" value={recordingMatch.ladders?.type === 'singles' ? recordingMatch.defender_id : recordingMatch.defender_team_id} checked={winnerId === (recordingMatch.ladders?.type === 'singles' ? recordingMatch.defender_id : recordingMatch.defender_team_id)} onChange={e => setWinnerId(e.target.value)} />
                  {recordingMatch.ladders?.type === 'singles' ? displayName(recordingMatch.defender) : recordingMatch.defender_team?.name}
                </label>
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Final Score</label>
              <input type="text" value={scoreText} onChange={e => setScoreText(e.target.value)} placeholder="e.g. 21-15, 21-18" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button className="btn" style={{ padding: '0.3rem 0.8rem', color: '#6b7280', border: '1px solid #d1d5db', fontSize: '0.8rem' }} onClick={abandonMatch} disabled={submittingScore}>
                Abandon Match
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline" onClick={() => setRecordingMatch(null)}>Cancel</button>
                <button className="btn" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }} disabled={submittingScore || !winnerId} onClick={submitScore}>
                  {submittingScore ? 'Saving…' : 'Submit Result'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Grid */}
      <div className="flex gap-6 mt-4" style={{ flexWrap: 'wrap' }}>
        {/* My Clubs */}
        <section className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="section-title">My Clubs</h2>
          {loadingClubs ? (
            <p className="text-light text-sm">Loading…</p>
          ) : clubs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ color: '#6b7280', marginBottom: '0.75rem' }}>You haven't joined any clubs yet.</p>
              <Link to="/clubs/join" className="btn" style={{ backgroundColor: 'var(--primary-color)', color: 'white', textDecoration: 'none', display: 'inline-block' }}>
                Join or Create a Club
              </Link>
            </div>
          ) : (
            <div className="flex-col gap-2">
              {clubs.slice(0, 4).map(club => (
                <div key={club.id} className="flex items-center justify-between">
                  <Link to={`/clubs/${club.id}`} style={{ fontWeight: 600, color: '#111827', textDecoration: 'none' }}>{club.name}</Link>
                  <span style={{ backgroundColor: club.club_members[0]?.role === 'admin' ? '#e0e7ff' : '#f3f4f6', color: club.club_members[0]?.role === 'admin' ? '#4f46e5' : '#6b7280', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                    {club.club_members[0]?.role}
                  </span>
                </div>
              ))}
              <Link
                to="/clubs"
                className="btn"
                style={{ marginTop: '0.75rem', textAlign: 'center', display: 'block', textDecoration: 'none', padding: '0.4rem 0', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '6px', fontWeight: 600, fontSize: '0.85rem' }}
              >
                View All Clubs →
              </Link>
            </div>
          )}
        </section>

        {/* My Ranks */}
        <section className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="section-title">My Ranks</h2>
          {ranks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: '#6b7280', marginBottom: '0.75rem', fontSize: '0.9rem' }}>You haven't joined any ladders yet.</p>
              <Link to="/ladders" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>Browse Ladders →</Link>
            </div>
          ) : (
            <div className="flex-col gap-3">
              {ranks.map((r: any) => (
                <Link
                  key={r.ladders?.id}
                  to={`/clubs/${r.ladders?.club_id}/ladders/${r.ladders?.id}`}
                  style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{r.ladders?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{r.ladders?.clubs?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary-color)' }}>#{r.current_rank}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.wins}W–{r.losses}L</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
