import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, LogOut, Users, Swords, Trophy, X, Mail } from 'lucide-react';
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
  const [ranksTitle, setRanksTitle] = useState<string>("My Ranks");
  const [processingReq, setProcessingReq] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<any[]>([]);

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
      loadInvitations();
    }
  }, [user]);

  useEffect(() => {
    const titles = ["My Court Cred", "The Rung Report", "Bragging Rights", "Smash Stats", "Bump Status", "String Tension & Standings"];
    setRanksTitle(titles[Math.floor(Math.random() * titles.length)]);
  }, []);

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

  async function loadInvitations() {
    try {
      const { data } = await supabase
        .from('member_invitations')
        .select('*, clubs(name), ladders(name, type)')
        .eq('email', user?.email)
        .order('created_at', { ascending: false });
      setInvitations(data || []);
    } catch (err) {
      console.error('Error loading invitations:', err);
    }
  }

  async function handleAcceptInvitation(inv: any) {
    try {
      setProcessingReq(inv.id);
      // We can use the existing RPC which processes all, OR manually join.
      // Since the user said "auto join is fine", the existing RPC is the most robust way.
      const { error } = await supabase.rpc('process_pending_invitations');
      if (error) throw error;
      
      // Refresh all data
      await Promise.all([
        loadClubs(),
        loadInvitations(),
        loadRanks(),
        loadJoinRequests()
      ]);
    } catch (err: any) {
      alert(err.message || 'Failed to accept invitation.');
    } finally {
      setProcessingReq(null);
    }
  }

  async function handleDeclineInvitation(id: string) {
    if (!window.confirm('Are you sure you want to decline this invitation?')) return;
    try {
      setProcessingReq(id);
      const { error } = await supabase.from('member_invitations').delete().eq('id', id);
      if (error) throw error;
      setInvitations(prev => prev.filter(inv => inv.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to decline invitation.');
    } finally {
      setProcessingReq(null);
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
      // 1. Process 24h stale matches BEFORE pulling accurate database state
      const { error: rpcErr } = await supabase.rpc('accept_stale_matches');
      if (rpcErr) console.error(rpcErr);

      // 2. Get my teams first for filtering
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

      setPendingChallenges(matches.filter((m: any) => m.status === 'pending'));
      setPendingScores(matches.filter((m: any) => m.status === 'accepted'));
      setConfirmations(matches.filter((m: any) => m.status === 'score_submitted' && m.score_submitted_by !== user?.id));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRanks() {
    try {
      const { data: playerLadders } = await supabase
        .from('ladder_players')
        .select('id, current_rank, elo_rating, wins, losses, ladder_id, ladders(id, name, sport, type, club_id, clubs(name))')
        .eq('player_id', user?.id);

      const { data: myTeams } = await supabase
        .from('teams')
        .select('id, name')
        .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`);

      const teamIds = (myTeams || []).map((t: any) => t.id);

      let teamLadders: any[] = [];
      if (teamIds.length > 0) {
        const { data: lt } = await supabase
          .from('ladder_teams')
          .select('id, current_rank, elo_rating, wins, losses, team_id, ladder_id, ladders!inner(id, name, sport, type, club_id, clubs(name))')
          .in('team_id', teamIds);
        teamLadders = lt || [];
      }

      const combined: any[] = [];
      const lpMap = new Map();
      (playerLadders || []).forEach((pl: any) => lpMap.set(pl.ladders?.id, pl.elo_rating));

      // Fetch all participants for these ladders to calculate accurate display ranks
      const ladderIds = Array.from(new Set([
        ...(playerLadders || []).map(pl => pl.ladder_id),
        ...teamLadders.map(tl => tl.ladder_id)
      ]));

      let allSinglesParticipants: any[] = [];
      let allDoublesParticipants: any[] = [];

      if (ladderIds.length > 0) {
        const [ { data: sData }, { data: dData } ] = await Promise.all([
          supabase.from('ladder_players').select('ladder_id, player_id, current_rank, wins, losses').in('ladder_id', ladderIds),
          supabase.from('ladder_teams').select('ladder_id, team_id, current_rank, wins, losses').in('ladder_id', ladderIds)
        ]);
        allSinglesParticipants = sData || [];
        allDoublesParticipants = dData || [];
      }

      const calculateDisplayRank = (participants: any[], myItem: any, isDoubles: boolean) => {
        const ladderParticipants = participants.filter(p => p.ladder_id === myItem.ladder_id);
        const played = ladderParticipants.filter(p => (p.wins ?? 0) + (p.losses ?? 0) > 0);
        const unplayed = ladderParticipants.filter(p => (p.wins ?? 0) + (p.losses ?? 0) === 0);
        
        played.sort((a, b) => (a.current_rank ?? 9999) - (b.current_rank ?? 9999));
        unplayed.sort((a, b) => (a.current_rank ?? 9999) - (b.current_rank ?? 9999));

        const myPlayed = (myItem.wins ?? 0) + (myItem.losses ?? 0) > 0;
        if (myPlayed) {
          const idx = played.findIndex(p => isDoubles ? p.team_id === myItem.team_id : p.player_id === myItem.player_id);
          return idx >= 0 ? idx + 1 : myItem.current_rank;
        } else {
          const idx = unplayed.findIndex(p => isDoubles ? p.team_id === myItem.team_id : p.player_id === myItem.player_id);
          return played.length + (idx >= 0 ? idx + 1 : myItem.current_rank);
        }
      };

      (playerLadders || []).forEach((pl: any) => {
        if (pl.ladders?.type === 'singles' && pl.current_rank > 0) {
          combined.push({
            id: pl.ladders?.id,
            ladder_id: pl.ladders?.id,
            name: pl.ladders?.name,
            club_name: pl.ladders?.clubs?.name,
            club_id: pl.ladders?.club_id,
            type: 'singles',
            display_rank: calculateDisplayRank(allSinglesParticipants, pl, false),
            current_rank: pl.current_rank,
            wins: pl.wins,
            losses: pl.losses,
            elo_rating: pl.elo_rating,
            player_id: user?.id
          });
        }
      });

      teamLadders.forEach((tl: any) => {
        const teamName = myTeams?.find((t: any) => t.id === tl.team_id)?.name || 'Team';
        const indElo = lpMap.get(tl.ladder_id) ?? 800;
        combined.push({
            id: `${tl.ladder_id}_${tl.team_id}`,
            ladder_id: tl.ladder_id,
            name: `${tl.ladders?.name} (${teamName})`,
            club_name: tl.ladders?.clubs?.name,
            club_id: tl.ladders?.club_id,
            type: 'doubles',
            display_rank: calculateDisplayRank(allDoublesParticipants, tl, true),
            current_rank: tl.current_rank,
            wins: tl.wins,
            losses: tl.losses,
            elo_rating: indElo,
            team_elo: tl.elo_rating,
            team_id: tl.team_id
        });
      });

      combined.sort((a, b) => a.display_rank - b.display_rank);
      setRanks(combined);
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
      const isSingles = recordingMatch.ladders?.type === 'singles';
      const payload: any = {
        score_text: scoreText,
        status: 'score_submitted',
        score_submitted_by: user?.id,
        score_submitted_at: new Date().toISOString()
      };

      if (isSingles) {
        payload.winner_id = winnerId;
      } else {
        payload.winner_team_id = winnerId;
      }

      const { error } = await supabase.from('matches').update(payload).eq('id', recordingMatch.id);
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

  const totalActions = joinRequests.length + 
    invitations.length +
    pendingChallenges.filter((m: any) => m.defender_id === user?.id || (m.defender_team && (m.defender_team.player1_id === user?.id || m.defender_team.player2_id === user?.id))).length + 
    pendingScores.length + confirmations.length;

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
          Your Serve {totalActions > 0 && (
            <span style={{ marginLeft: '0.5rem', padding: '1px 8px', borderRadius: '999px', backgroundColor: '#ef4444', color: 'white', fontSize: '0.75rem', fontWeight: 700 }}>
              {totalActions}
            </span>
          )}
        </h2>

        {totalActions === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No pending actions. You're all caught up! 🎉</p>
        ) : (
          <div className="flex-col gap-3">
            {/* Invitations */}
            {invitations.map(inv => {
              const clubName = inv.clubs?.name || 'a club';
              const ladderName = inv.ladders?.name;
              return (
                <div key={inv.id} style={{ padding: '0.85rem 1rem', backgroundColor: '#ecfdf5', borderRadius: 'var(--radius-md)', border: '1px solid #6ee7b7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={20} color="white" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#065f46' }}>New Invitation</div>
                      <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                        You've been invited to join <strong>{clubName}</strong>{ladderName ? ` (${ladderName} ladder)` : ''}!
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="btn" 
                      style={{ backgroundColor: '#059669', color: 'white', padding: '0.35rem 1rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }} 
                      disabled={processingReq === inv.id} 
                      onClick={() => handleAcceptInvitation(inv)}
                    >
                      {processingReq === inv.id ? 'Joining...' : 'Accept & Join'}
                    </button>
                    <button 
                      className="btn btn-outline" 
                      style={{ padding: '0.35rem 1rem', fontSize: '0.85rem', color: '#dc2626', borderColor: '#dc2626' }} 
                      disabled={processingReq === inv.id} 
                      onClick={() => handleDeclineInvitation(inv.id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}

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
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
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
            {pendingChallenges.filter((m: any) => 
              m.defender_id === user?.id || 
              (m.defender_team && (m.defender_team.player1_id === user?.id || m.defender_team.player2_id === user?.id))
            ).map(match => {
              const challengerName = match.ladders?.type === 'singles' 
                ? displayName(match.challenger) 
                : (match.challenger_team?.name || 'A team');
              const challengeSubject = match.ladders?.type === 'singles' ? 'you' : 'your team';
              
              return (
                <div key={match.id} style={{ padding: '0.85rem 1rem', backgroundColor: '#fff7ed', borderRadius: 'var(--radius-md)', border: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Swords size={20} color="#c2410c" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Match Challenge</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                        <strong>{challengerName}</strong> challenged {challengeSubject} in <strong>{match.ladders?.name}</strong> ({match.ladders?.clubs?.name})
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
              );
            })}

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
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
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
              const ladder = match.ladders;
              const isSingles = ladder?.type === 'singles';
              
              let submitterName = '';
              if (isSingles) {
                submitterName = match.score_submitted_by === match.challenger_id ? displayName(match.challenger) : displayName(match.defender);
              } else {
                submitterName = match.score_submitted_by === match.challenger_id || 
                               (match.challenger_team && (match.challenger_team.player1_id === match.score_submitted_by || match.challenger_team.player2_id === match.score_submitted_by))
                               ? (match.challenger_team?.name || 'Challenger Team')
                               : (match.defender_team?.name || 'Defender Team');
              }
              
              return (
                <div key={match.id} style={{ padding: '0.85rem 1rem', backgroundColor: '#ecfdf5', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CheckCircle size={20} color="#059669" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Confirm Score</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                        <strong>{submitterName}</strong> recorded <strong>{match.score_text}</strong> in <strong>{ladder?.name}</strong>.
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
            <button onClick={() => setRecordingMatch(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy size={20} color="#f59e0b" /> Record Result
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>Who won?</label>
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
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>Final Score</label>
              <input type="text" value={scoreText} onChange={e => setScoreText(e.target.value)} placeholder="e.g. 21-15, 21-18" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button className="btn" style={{ padding: '0.3rem 0.8rem', color: 'var(--text-light)', border: '1px solid #d1d5db', fontSize: '0.8rem' }} onClick={abandonMatch} disabled={submittingScore}>
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
          <h2 className="section-title">Stomping Grounds</h2>
          {loadingClubs ? (
            <p className="text-light text-sm">Loading…</p>
          ) : clubs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ color: 'var(--text-light)', marginBottom: '0.75rem' }}>You haven't joined any clubs yet.</p>
              <Link to="/clubs/join" className="btn" style={{ backgroundColor: 'var(--primary-color)', color: 'white', textDecoration: 'none', display: 'inline-block' }}>
                Join or Create a Club
              </Link>
            </div>
          ) : (
            <div className="flex-col gap-2">
              {clubs.slice(0, 4).map(club => (
                <div key={club.id} className="flex items-center justify-between">
                  <Link to={`/clubs/${club.id}`} style={{ fontWeight: 600, color: 'var(--text-dark)', textDecoration: 'none' }}>{club.name}</Link>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    fontWeight: 600, 
                    color: club.club_members[0]?.role === 'admin' ? 'var(--orange-accent)' : 'var(--accent-color)',
                    textTransform: 'uppercase',
                    textShadow: `0 0 5px ${club.club_members[0]?.role === 'admin' ? 'rgba(255, 159, 28, 0.4)' : 'rgba(0, 242, 255, 0.4)'}`
                  }}>
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
          <h2 className="section-title">{ranksTitle}</h2>
          {ranks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: 'var(--text-light)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>You haven't joined any ladders yet.</p>
              <Link to="/ladders" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>Browse Ladders →</Link>
            </div>
          ) : (
            <div className="flex-col gap-3" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {ranks.map((r: any) => (
                <Link
                  key={r.id}
                  to={`/clubs/${r.club_id}/ladders/${r.ladder_id}`}
                  style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{r.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{r.club_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 700, marginTop: '2px' }}>
                      {r.type === 'doubles' 
                        ? `IND. ELO: ${r.elo_rating} | TEAM ELO: ${r.team_elo}` 
                        : `ELO: ${r.elo_rating}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary-color)', textShadow: '0 0 10px rgba(34, 197, 94, 0.4)' }}>#{r.display_rank}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{r.wins}W–{r.losses}L</div>
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
