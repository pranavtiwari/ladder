import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Pencil, X, Save, CheckCircle, XCircle, Plus, Trophy } from 'lucide-react';

const ALL_SPORTS = ['Badminton', 'Tennis', 'Table Tennis', 'Squash', 'Pickle Ball', 'Paddle'];
const SPORT_ICONS: Record<string, string> = {
  'Badminton': '🏸', 'Tennis': '🎾', 'Table Tennis': '🏓',
  'Squash': '🟡', 'Pickle Ball': '🥒', 'Paddle': '🏏',
};

export default function ClubView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [club, setClub] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [processingReq, setProcessingReq] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSports, setEditingSports] = useState<string[]>([]);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Ladders
  const [ladders, setLadders] = useState<any[]>([]);
  const [showCreateLadder, setShowCreateLadder] = useState(false);
  const [newLadderName, setNewLadderName] = useState('');
  const [newLadderSport, setNewLadderSport] = useState('');
  const [newLadderType, setNewLadderType] = useState<'singles' | 'doubles'>('singles');
  const [newLadderRules, setNewLadderRules] = useState('');
  const [creatingLadder, setCreatingLadder] = useState(false);

  useEffect(() => {
    if (id && user) loadClub();
  }, [id, user]);

  async function loadClub() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select(`*, club_members(player_id, role, profiles(nickname, first_name, last_name, avatar_url))`)
        .eq('id', id)
        .single();
      if (error) throw error;
      setClub(data);
      const myMembership = data?.club_members?.find((m: any) => m.player_id === user?.id);
      const admin = myMembership?.role === 'admin';
      setIsAdmin(admin);
      if (admin) loadJoinRequests();
      loadLadders();
    } catch (err) {
      console.error('Error loading club:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadJoinRequests() {
    const { data } = await supabase
      .from('club_join_requests')
      .select('id, player_id, status, created_at, profiles(nickname, first_name, last_name, avatar_url)')
      .eq('club_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setJoinRequests(data || []);
  }

  async function handleRequest(reqId: string, playerId: string, approved: boolean) {
    setProcessingReq(reqId);
    try {
      const newStatus = approved ? 'approved' : 'rejected';
      const { error: updateErr } = await supabase
        .from('club_join_requests')
        .update({ status: newStatus })
        .eq('id', reqId);
      if (updateErr) throw updateErr;

      if (approved) {
        const { error: insertErr } = await supabase
          .from('club_members')
          .insert({ club_id: id, player_id: playerId, role: 'member' });
        if (insertErr) throw insertErr;
      }
      setJoinRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to process request.');
    } finally {
      setProcessingReq(null);
    }
  }

  async function loadLadders() {
    const { data } = await supabase
      .from('ladders')
      .select('id, name, sport, type')
      .eq('club_id', id)
      .order('name');
    setLadders(data || []);
  }

  async function handleCreateLadder(e: React.FormEvent) {
    e.preventDefault();
    setCreatingLadder(true);
    try {
      const { error } = await supabase
        .from('ladders')
        .insert({ club_id: id, name: newLadderName, sport: newLadderSport || (club?.sports?.[0] ?? 'Badminton'), type: newLadderType, rules: newLadderRules || null });
      if (error) throw error;
      setShowCreateLadder(false);
      setNewLadderName(''); setNewLadderSport(''); setNewLadderType('singles'); setNewLadderRules('');
      loadLadders();
    } catch (err: any) {
      alert(err.message || 'Failed to create ladder.');
    } finally {
      setCreatingLadder(false);
    }
  }

  function openEdit() {
    setEditingSports(club?.sports ?? []);
    setEditingName(club?.name ?? '');
    setEditingDesc(club?.description ?? '');
    setSaveMsg('');
    setShowEditModal(true);
  }

  function toggleSport(sport: string) {
    setEditingSports(prev => prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const { error } = await supabase
        .from('clubs')
        .update({ name: editingName, description: editingDesc, sports: editingSports })
        .eq('id', id);
      if (error) throw error;
      setClub((prev: any) => ({ ...prev, name: editingName, description: editingDesc, sports: editingSports }));
      setSaveMsg('Saved!');
      setTimeout(() => setShowEditModal(false), 700);
    } catch (err: any) {
      setSaveMsg(err.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading club...</div>;
  if (!club) return <div style={{ padding: '2rem', color: '#ef4444' }}>Club not found.</div>;

  return (
    <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Link to="/clubs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to My Clubs
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ color: 'var(--primary-color)', marginBottom: '0.25rem' }}>{club.name}</h1>
          <p style={{ color: '#6b7280' }}>{club.description || 'No description provided.'}</p>
        </div>
        {isAdmin && (
          <button onClick={openEdit} className="btn flex items-center gap-2" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}>
            <Pencil size={15} /> Edit Club
          </button>
        )}
      </div>

      {/* Pending Join Requests — Admin only */}
      {isAdmin && joinRequests.length > 0 && (
        <div className="card" style={{ border: '2px solid #fbbf24', backgroundColor: '#fffbeb' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem', color: '#92400e' }}>
            ⏳ Pending Join Requests ({joinRequests.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {joinRequests.map(req => {
              const p = req.profiles;
              const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Unknown user';
              return (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.6rem 0', borderBottom: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {p?.avatar_url
                      ? <img src={p.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                      : <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#d1d5db' }} />
                    }
                    <span style={{ fontWeight: 600, color: '#374151' }}>{name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn"
                      style={{ backgroundColor: '#059669', color: 'white', padding: '0.3rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      disabled={processingReq === req.id}
                      onClick={() => handleRequest(req.id, req.player_id, true)}
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      disabled={processingReq === req.id}
                      onClick={() => handleRequest(req.id, req.player_id, false)}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sports Facilities */}
      <div className="card">
        <h2 className="section-title" style={{ marginBottom: '1rem' }}>Sports Facilities</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {ALL_SPORTS.map(sport => {
            const enabled = club.sports?.includes(sport);
            return (
              <div key={sport} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '9999px',
                backgroundColor: enabled ? '#e0e7ff' : '#f3f4f6',
                color: enabled ? '#4f46e5' : '#9ca3af',
                fontWeight: enabled ? 600 : 400,
                fontSize: '0.875rem', opacity: enabled ? 1 : 0.6,
              }}>
                <span>{SPORT_ICONS[sport]}</span> {sport}
              </div>
            );
          })}
        </div>
        {!isAdmin && <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#9ca3af' }}>Only club admins can modify facilities.</p>}
      </div>

      {/* Members */}
      <div className="card">
        <h2 className="section-title" style={{ marginBottom: '1rem' }}>Members</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {club.club_members?.map((m: any) => {
            const p = m.profiles;
            const displayName = p?.nickname || p?.first_name || (m.player_id === user?.id ? 'You' : m.player_id.slice(0, 8) + '…');
            return (
            <div key={m.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {p?.avatar_url
                  ? <img src={p.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#e5e7eb' }} />}
                <span style={{ color: '#374151' }}>{displayName}{m.player_id === user?.id ? ' (you)' : ''}</span>
              </div>
              <span style={{
                padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                backgroundColor: m.role === 'admin' ? '#e0e7ff' : '#f3f4f6',
                color: m.role === 'admin' ? '#4f46e5' : '#6b7280',
              }}>
                {m.role}
              </span>
            </div>
            );
          })}
        </div>
      </div>

      {/* Ladders */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            <Trophy size={18} style={{ display: 'inline', marginRight: '0.4rem', color: '#f59e0b' }} />
            Ladders
          </h2>
          {isAdmin && (
            <button
              onClick={() => setShowCreateLadder(!showCreateLadder)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.3rem 0.8rem', borderRadius: '6px',
                border: '2px solid var(--primary-color)', color: 'var(--primary-color)',
                background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              }}
            >
              <Plus size={14} /> Create Ladder
            </button>
          )}
        </div>

        {showCreateLadder && (
          <form onSubmit={handleCreateLadder} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.3rem' }}>Ladder Name*</label>
                <input type="text" required value={newLadderName} onChange={e => setNewLadderName(e.target.value)} placeholder="e.g. Men's Singles Open" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.3rem' }}>Sport*</label>
                <select required value={newLadderSport} onChange={e => setNewLadderSport(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}>
                  <option value="">Select sport…</option>
                  {(club.sports || ALL_SPORTS).map((s: string) => <option key={s} value={s}>{SPORT_ICONS[s]} {s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.3rem' }}>Type</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['singles', 'doubles'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setNewLadderType(t)} style={{ flex: 1, padding: '0.45rem', borderRadius: '6px', border: `2px solid ${newLadderType === t ? '#4f46e5' : '#d1d5db'}`, backgroundColor: newLadderType === t ? '#e0e7ff' : '#f9fafb', color: newLadderType === t ? '#4f46e5' : '#6b7280', fontWeight: newLadderType === t ? 600 : 400, cursor: 'pointer', fontSize: '0.85rem' }}>
                      {t === 'singles' ? '👤 Singles' : '👥 Doubles'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.3rem' }}>Rules / Notes</label>
                <input type="text" value={newLadderRules} onChange={e => setNewLadderRules(e.target.value)} placeholder="Optional rules" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem' }} onClick={() => setShowCreateLadder(false)}>Cancel</button>
              <button type="submit" disabled={creatingLadder} style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                {creatingLadder ? 'Creating…' : 'Create Ladder'}
              </button>
            </div>
          </form>
        )}

        {ladders.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem 0' }}>
            {isAdmin ? 'No ladders yet. Create one above to get players competing!' : 'No ladders have been created yet.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {ladders.map((l: any) => (
              <Link
                key={l.id}
                to={`/clubs/${id}/ladders/${l.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb',
                  backgroundColor: '#fafafa', transition: 'box-shadow 0.15s',
                  display: 'flex', flexDirection: 'column', gap: '0.4rem',
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>{l.name}</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', padding: '1px 7px', borderRadius: '999px', backgroundColor: '#e0e7ff', color: '#4f46e5' }}>{SPORT_ICONS[l.sport]} {l.sport}</span>
                    <span style={{ fontSize: '0.75rem', padding: '1px 7px', borderRadius: '999px', backgroundColor: l.type === 'singles' ? '#dbeafe' : '#fce7f3', color: l.type === 'singles' ? '#1d4ed8' : '#be185d' }}>
                      {l.type === 'singles' ? '👤 Singles' : '👥 Doubles'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}

      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowEditModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
              <X size={22} />
            </button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: '#111827' }}>Edit Club</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.4rem' }}>Club Name</label>
                <input type="text" required value={editingName} onChange={e => setEditingName(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.4rem' }}>Description</label>
                <textarea value={editingDesc} onChange={e => setEditingDesc(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: '80px', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.75rem' }}>Facilities Available</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {ALL_SPORTS.map(sport => {
                    const checked = editingSports.includes(sport);
                    return (
                      <button key={sport} type="button" onClick={() => toggleSport(sport)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.9rem', borderRadius: '9999px',
                        border: `2px solid ${checked ? '#4f46e5' : '#d1d5db'}`,
                        backgroundColor: checked ? '#e0e7ff' : '#f9fafb',
                        color: checked ? '#4f46e5' : '#6b7280',
                        fontWeight: checked ? 600 : 400, cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.15s',
                      }}>
                        {SPORT_ICONS[sport]} {sport}
                      </button>
                    );
                  })}
                </div>
              </div>
              {saveMsg && <p style={{ color: saveMsg === 'Saved!' ? '#059669' : '#dc2626', fontSize: '0.875rem' }}>{saveMsg}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ backgroundColor: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }} disabled={saving}>
                  <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
