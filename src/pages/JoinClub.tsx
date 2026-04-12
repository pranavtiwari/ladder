import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, CheckCircle, Unlock } from 'lucide-react';

const SPORT_ICONS: Record<string, string> = {
  'Badminton': '🏸', 'Tennis': '🎾', 'Table Tennis': '🏓',
  'Squash': '🟡', 'Pickle Ball': '🥒', 'Paddle': '🏏',
};

export default function JoinClub() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [myClubIds, setMyClubIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    try {
      const [clubsRes, memberRes, requestRes] = await Promise.all([
        supabase.from('clubs').select('id, name, description, sports').eq('is_private', false).order('name'),
        supabase.from('club_members').select('club_id').eq('player_id', user?.id),
        supabase.from('club_join_requests').select('club_id, status').eq('player_id', user?.id),
      ]);

      setAllClubs(clubsRes.data || []);
      setMyClubIds(new Set((memberRes.data || []).map((r: any) => r.club_id)));
      setPendingIds(new Set(
        (requestRes.data || []).filter((r: any) => r.status === 'pending').map((r: any) => r.club_id)
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function requestJoin(clubId: string) {
    if (!user) return;
    setRequesting(clubId);
    try {
      const { error } = await supabase.from('club_join_requests').insert({ club_id: clubId, player_id: user.id });
      if (error) throw error;
      setPendingIds(prev => new Set([...prev, clubId]));
    } catch (err: any) {
      alert(err.message || 'Failed to send request.');
    } finally {
      setRequesting(null);
    }
  }

  const filtered = allClubs.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 className="page-title" style={{ color: 'var(--primary-color)', marginBottom: '0.35rem' }}>Find a Club</h1>
        <p style={{ color: 'var(--text-light)' }}>Search for a club and request to join. Club admins will review your request.</p>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          type="text"
          placeholder="Search by club name or description…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', padding: '0.65rem 0.85rem 0.65rem 2.5rem',
            border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading clubs…</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2.5rem' }}>
          No clubs found{query ? ` matching "${query}"` : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(club => {
            const isMember = myClubIds.has(club.id);
            const isPending = pendingIds.has(club.id);
            return (
              <div key={club.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-dark)' }}>{club.name}</h3>
                    <div title="Public Club" style={{ color: 'var(--text-light)', display: 'flex', alignItems: 'center' }}>
                      <Unlock size={14} />
                    </div>
                  </div>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{club.description || 'No description.'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {(club.sports || []).map((s: string) => (
                      <span key={s} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#e0e7ff', color: '#4f46e5', fontWeight: 500 }}>
                        {SPORT_ICONS[s]} {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {isMember ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#059669', fontWeight: 600, fontSize: '0.875rem' }}>
                      <CheckCircle size={16} /> Member
                    </span>
                  ) : isPending ? (
                    <span style={{ color: '#d97706', fontWeight: 600, fontSize: '0.875rem' }}>⏳ Request Sent</span>
                  ) : (
                    <button
                      className="btn"
                      style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.4rem 1rem', fontSize: '0.875rem' }}
                      disabled={requesting === club.id}
                      onClick={() => requestJoin(club.id)}
                    >
                      {requesting === club.id ? 'Sending…' : 'Request to Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
