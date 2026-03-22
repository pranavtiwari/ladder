import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, LogOut, Users, Swords, Trophy } from 'lucide-react';
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
  const [ranks, setRanks] = useState<any[]>([]);
  const [processingReq, setProcessingReq] = useState<string | null>(null);

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
      const { data } = await supabase
        .from('matches')
        .select(`
          id, status, challenger_id, defender_id, winner_id, score_text,
          ladders(name, club_id, clubs(name)),
          challenger:profiles!matches_challenger_id_fkey(nickname, first_name, avatar_url),
          defender:profiles!matches_defender_id_fkey(nickname, first_name, avatar_url)
        `)
        .or(`challenger_id.eq.${user?.id},defender_id.eq.${user?.id}`)
        .in('status', ['pending', 'completed'])
        .order('played_at', { ascending: false });

      const pending = (data || []).filter((m: any) => m.status === 'pending');
      const awaitingScore = (data || []).filter((m: any) => m.status === 'completed' && !m.winner_id);
      setPendingChallenges(pending);
      setPendingScores(awaitingScore);
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
      setJoinRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err: any) {
      alert(err.message || 'Failed.');
    } finally {
      setProcessingReq(null);
    }
  }

  async function acceptChallenge(matchId: string) {
    await supabase.from('matches').update({ status: 'accepted' }).eq('id', matchId);
    setPendingChallenges(prev => prev.filter(m => m.id !== matchId));
  }

  async function declineChallenge(matchId: string) {
    await supabase.from('matches').update({ status: 'declined' }).eq('id', matchId);
    setPendingChallenges(prev => prev.filter(m => m.id !== matchId));
  }

  const totalActions = joinRequests.length + pendingChallenges.length + pendingScores.length;

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
              const isChallenger = match.challenger_id === user?.id;
              const opponent = isChallenger ? match.defender : match.challenger;
              return (
                <div key={match.id} style={{ padding: '0.85rem 1rem', backgroundColor: '#f0f9ff', borderRadius: 'var(--radius-md)', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Trophy size={20} color="#0284c7" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Record Score</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        vs <strong>{displayName(opponent)}</strong> in <strong>{match.ladders?.name}</strong> — score not yet recorded
                      </div>
                    </div>
                  </div>
                  <Link to="/matches" style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', backgroundColor: '#0284c7', color: 'white', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>
                    Record Score
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
