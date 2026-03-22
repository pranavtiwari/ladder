import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function MatchHistory() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadMatches();
  }, [user]);

  async function loadMatches() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id, status, score_text, played_at,
          ladders(name, sport, clubs(name)),
          challenger:profiles!matches_challenger_id_fkey(nickname, first_name, avatar_url),
          defender:profiles!matches_defender_id_fkey(nickname, first_name, avatar_url),
          winner:profiles!matches_winner_id_fkey(nickname, first_name)
        `)
        .or(`challenger_id.eq.${user?.id},defender_id.eq.${user?.id}`)
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
            const isChallenger = match.challenger_id === user?.id || match.challenger?.id === user?.id;
            const opponent = isChallenger ? match.defender : match.challenger;
            const me = isChallenger ? match.challenger : match.defender;
            const wonId = match.winner_id;
            let result: 'Win' | 'Loss' | 'Pending' | 'Disputed' = 'Pending';
            if (match.status === 'completed') {
              result = (wonId === user?.id) ? 'Win' : 'Loss';
            } else if (match.status === 'disputed') {
              result = 'Disputed';
            }

            const resultColor = result === 'Win' ? '#059669' : result === 'Loss' ? '#dc2626' : result === 'Disputed' ? '#d97706' : '#6b7280';
            const resultBg = result === 'Win' ? '#d1fae5' : result === 'Loss' ? '#fee2e2' : result === 'Disputed' ? '#fef3c7' : '#f3f4f6';

            return (
              <div key={match.id} className="card flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {opponent?.avatar_url
                    ? <img src={opponent.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#e5e7eb' }} />}
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>
                      {displayName(me)} <span style={{ color: '#9ca3af', fontWeight: 400 }}>vs</span> {displayName(opponent)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                      {match.ladders?.clubs?.name} · {match.ladders?.name} · {formatDate(match.played_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {match.score_text && (
                    <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>{match.score_text}</span>
                  )}
                  <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, backgroundColor: resultBg, color: resultColor }}>
                    {result}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
