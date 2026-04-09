import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Trophy, CheckCircle, XCircle, X } from 'lucide-react';

export default function MatchHistory() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Score recording modal state
  const [recordingMatch, setRecordingMatch] = useState<any>(null);
  const [scoreText, setScoreText] = useState('');
  const [winnerId, setWinnerId] = useState('');
  const [submittingScore, setSubmittingScore] = useState(false);

  useEffect(() => {
    if (user) loadMatches();
  }, [user]);

  async function loadMatches() {
    setLoading(true);
    try {
      // Get user's team IDs so we can include doubles matches
      const { data: myTeams } = await supabase
        .from('teams')
        .select('id')
        .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`);
      const myTeamIds = myTeams?.map((t: any) => t.id) || [];
      const teamFilter = myTeamIds.length > 0
        ? `,challenger_team_id.in.(${myTeamIds.join(',')}),defender_team_id.in.(${myTeamIds.join(',')})`
        : '';

      const { data, error } = await supabase
        .from('matches')
        .select(`
          id, status, score_text, played_at, challenger_id, defender_id, winner_id,
          challenger_team_id, defender_team_id, winner_team_id,
          score_submitted_by,
          ladders(id, name, sport, type, club_id, clubs(name)),
          challenger:profiles!matches_challenger_id_fkey(id, nickname, first_name, avatar_url),
          defender:profiles!matches_defender_id_fkey(id, nickname, first_name, avatar_url),
          winner:profiles!matches_winner_id_fkey(nickname, first_name),
          challenger_team:teams!matches_challenger_team_id_fkey(id, name, player1_id, player2_id),
          defender_team:teams!matches_defender_team_id_fkey(id, name, player1_id, player2_id)
        `)
        .or(`challenger_id.eq.${user?.id},defender_id.eq.${user?.id}${teamFilter}`)
        .order('played_at', { ascending: false });
      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function displayName(p: any) {
    return p?.nickname || p?.first_name || '—';
  }

  function formatDate(iso: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
        score_submitted_at: new Date().toISOString(),
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

  async function confirmScore(match: any) {
    try {
      const { error } = await supabase.from('matches').update({ status: 'completed' }).eq('id', match.id);
      if (error) throw error;

      // Rank swap: if challenger won, swap ranks
      const ladder = match.ladders;
      if (!ladder) return;
      const isSingles = ladder.type === 'singles';
      const challengerId = isSingles ? match.challenger_id : match.challenger_team_id;
      const defenderId = isSingles ? match.defender_id : match.defender_team_id;
      const winnerId = isSingles ? match.winner_id : match.winner_team_id;

      if (winnerId === challengerId) {
        const table = isSingles ? 'ladder_players' : 'ladder_teams';
        const idCol = isSingles ? 'player_id' : 'team_id';
        const { data: cEntry } = await supabase.from(table).select('current_rank').eq('ladder_id', ladder.id).eq(idCol, challengerId).single();
        const { data: dEntry } = await supabase.from(table).select('current_rank').eq('ladder_id', ladder.id).eq(idCol, defenderId).single();
        if (cEntry && dEntry && cEntry.current_rank > dEntry.current_rank) {
          await supabase.from(table).update({ current_rank: dEntry.current_rank }).eq('ladder_id', ladder.id).eq(idCol, challengerId);
          await supabase.from(table).update({ current_rank: cEntry.current_rank }).eq('ladder_id', ladder.id).eq(idCol, defenderId);
        }
      }

      // Update win/loss stats
      const table = isSingles ? 'ladder_players' : 'ladder_teams';
      const idCol = isSingles ? 'player_id' : 'team_id';
      const loserId = winnerId === challengerId ? defenderId : challengerId;
      const { data: wData } = await supabase.from(table).select('wins').eq('ladder_id', ladder.id).eq(idCol, winnerId).single();
      const { data: lData } = await supabase.from(table).select('losses').eq('ladder_id', ladder.id).eq(idCol, loserId).single();
      await supabase.from(table).update({ wins: (wData?.wins || 0) + 1 }).eq('ladder_id', ladder.id).eq(idCol, winnerId);
      await supabase.from(table).update({ losses: (lData?.losses || 0) + 1 }).eq('ladder_id', ladder.id).eq(idCol, loserId);

      await loadMatches();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm score.');
    }
  }

  function openRecordScore(match: any) {
    setRecordingMatch(match);
    setScoreText('');
    setWinnerId('');
  }

  return (
    <div className="flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Match History</h1>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading…</p>
      ) : matches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#6b7280' }}>
          No matches recorded yet.
        </div>
      ) : (
        <div className="flex-col gap-3">
          {matches.map(match => {
            const isSingles = match.ladders?.type !== 'doubles';
            const isChallenger = match.challenger_id === user?.id;
            const opponent = isChallenger ? match.defender : match.challenger;
            const me = isChallenger ? match.challenger : match.defender;
            const canRecordScore = match.status === 'accepted';
            const canConfirm = match.status === 'score_submitted' && match.score_submitted_by !== user?.id;

            let result: string = 'In Progress';
            let resultColor = '#6b7280';
            let resultBg = '#f3f4f6';

            if (match.status === 'completed') {
              const won = match.winner_id === user?.id;
              result = won ? 'Win' : 'Loss';
              resultColor = won ? '#059669' : '#dc2626';
              resultBg = won ? '#d1fae5' : '#fee2e2';
            } else if (match.status === 'score_submitted') {
              result = 'Pending Confirmation';
              resultColor = '#0284c7';
              resultBg = '#e0f2fe';
            } else if (match.status === 'accepted') {
              result = 'In Progress';
              resultColor = '#d97706';
              resultBg = '#fef3c7';
            } else if (match.status === 'pending') {
              result = 'Pending';
              resultColor = '#6b7280';
              resultBg = '#f3f4f6';
            } else if (match.status === 'disputed') {
              result = 'Disputed';
              resultColor = '#dc2626';
              resultBg = '#fee2e2';
            } else if (match.status === 'abandoned') {
              result = 'Abandoned';
              resultColor = '#6b7280';
              resultBg = '#f3f4f6';
            } else if (match.status === 'declined') {
              result = 'Declined';
              resultColor = '#6b7280';
              resultBg = '#f3f4f6';
            }

            return (
              <div key={match.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {opponent?.avatar_url
                    ? <img src={opponent.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#e5e7eb' }} />}
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>
                      {isSingles
                        ? <>{displayName(me)} <span style={{ color: '#9ca3af', fontWeight: 400 }}>vs</span> {displayName(opponent)}</>
                        : <>{match.challenger_team?.name || 'Team'} <span style={{ color: '#9ca3af', fontWeight: 400 }}>vs</span> {match.defender_team?.name || 'Team'}</>
                      }
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                      {match.ladders?.clubs?.name} · {match.ladders?.name} · {formatDate(match.played_at)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {match.score_text && (
                    <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>{match.score_text}</span>
                  )}
                  <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, backgroundColor: resultBg, color: resultColor }}>
                    {result}
                  </span>
                  {canRecordScore && (
                    <button
                      onClick={() => openRecordScore(match)}
                      className="btn"
                      style={{ padding: '0.3rem 0.8rem', backgroundColor: '#0284c7', color: 'white', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Trophy size={13} /> Record Score
                    </button>
                  )}
                  {canConfirm && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => confirmScore(match)}
                        className="btn"
                        style={{ padding: '0.3rem 0.8rem', backgroundColor: '#059669', color: 'white', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <CheckCircle size={13} /> Confirm
                      </button>
                      <button
                        onClick={() => supabase.from('matches').update({ status: 'disputed' }).eq('id', match.id).then(() => loadMatches())}
                        className="btn btn-outline"
                        style={{ padding: '0.3rem 0.8rem', color: '#dc2626', borderColor: '#dc2626', fontSize: '0.8rem' }}
                      >
                        <XCircle size={13} /> Dispute
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                  <input
                    type="radio" name="winner"
                    value={recordingMatch.ladders?.type === 'singles' ? recordingMatch.challenger_id : recordingMatch.challenger_team_id}
                    checked={winnerId === (recordingMatch.ladders?.type === 'singles' ? recordingMatch.challenger_id : recordingMatch.challenger_team_id)}
                    onChange={e => setWinnerId(e.target.value)}
                  />
                  {recordingMatch.ladders?.type === 'singles' ? displayName(recordingMatch.challenger) : (recordingMatch.challenger_team?.name || 'Challenger Team')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio" name="winner"
                    value={recordingMatch.ladders?.type === 'singles' ? recordingMatch.defender_id : recordingMatch.defender_team_id}
                    checked={winnerId === (recordingMatch.ladders?.type === 'singles' ? recordingMatch.defender_id : recordingMatch.defender_team_id)}
                    onChange={e => setWinnerId(e.target.value)}
                  />
                  {recordingMatch.ladders?.type === 'singles' ? displayName(recordingMatch.defender) : (recordingMatch.defender_team?.name || 'Defender Team')}
                </label>
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Final Score</label>
              <input
                type="text" value={scoreText}
                onChange={e => setScoreText(e.target.value)}
                placeholder="e.g. 21-15, 21-18"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setRecordingMatch(null)}>Cancel</button>
              <button
                className="btn"
                style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
                disabled={submittingScore || !winnerId}
                onClick={submitScore}
              >
                {submittingScore ? 'Saving…' : 'Submit Result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
