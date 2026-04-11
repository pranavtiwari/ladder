import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Pencil, X, Save, CheckCircle, XCircle, Plus, Trophy, Trash2 } from 'lucide-react';

const ALL_SPORTS = ['Badminton', 'Tennis', 'Table Tennis', 'Squash', 'Pickle Ball', 'Paddle'];
const SPORT_ICONS: Record<string, string> = {
  'Badminton': '🏸', 'Tennis': '🎾', 'Table Tennis': '🏓',
  'Squash': '🟡', 'Pickle Ball': '🥒', 'Paddle': '🏏',
};

export default function ClubView() {
  const navigate = useNavigate();
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

  // Inline club name edit
  const [editingClubName, setEditingClubName] = useState(false);
  const [clubNameDraft, setClubNameDraft] = useState('');
  const [savingClubName, setSavingClubName] = useState(false);

  // Inline ladder rename
  const [renamingLadderId, setRenamingLadderId] = useState<string | null>(null);
  const [ladderNameDraft, setLadderNameDraft] = useState('');

  // Ladders
  const [ladders, setLadders] = useState<any[]>([]);
  const [showCreateLadder, setShowCreateLadder] = useState(false);
  const [newLadderName, setNewLadderName] = useState('');
  const [newLadderSport, setNewLadderSport] = useState('');
  const [newLadderType, setNewLadderType] = useState<'singles' | 'doubles'>('singles');
  const [newLadderRules, setNewLadderRules] = useState('');
  const [creatingLadder, setCreatingLadder] = useState(false);

  // Invitations
  const [showAddMember, setShowAddMember] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  // Deactivate
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);

  // Privacy
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);

  useEffect(() => {
    if (id && user) loadClub();
  }, [id, user]);

  async function loadClub() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select(`*, club_members(player_id, role, status, profiles(nickname, first_name, last_name, avatar_url))`)
        .eq('id', id)
        .single();
      if (error) throw error;
      setClub(data);
      const myMembership = data?.club_members?.find((m: any) => m.player_id === user?.id);
      const admin = myMembership?.role === 'admin';
      setIsAdmin(admin);
      if (admin) {
        loadJoinRequests();
        loadPendingInvitations();
      }
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

  async function loadPendingInvitations() {
    try {
      const { data } = await supabase
        .from('member_invitations')
        .select('*')
        .eq('club_id', id);
      setPendingInvites(data || []);
    } catch (err) {
      console.error('Error loading invitations:', err);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc('send_member_invitation', {
        p_email: inviteEmail.trim(),
        p_name: inviteName.trim(),
        p_club_id: id
      });
      if (error) throw error;
      
      if (data === 'added') {
        alert(`${inviteName} is already a user! They have been added to the club immediately.`);
        loadClub();
      } else {
        if (sendEmail) {
          const inviterName = user?.user_metadata?.name || 'A club admin';
          await supabase.functions.invoke('send-invitation-email', {
            body: { email: inviteEmail.trim(), name: inviteName.trim(), clubName: club?.name, inviterName }
          });
        }
        alert(`Invitation sent to ${inviteEmail}. They will join automatically when they log in.`);
        loadPendingInvitations();
      }
      
      setShowAddMember(false);
      setInviteEmail('');
      setInviteName('');
      setSendEmail(false);
    } catch (err: any) {
      alert(err.message || 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  }

  async function handleToggleMemberStatus(playerId: string, currentStatus: string) {
    setTogglingStatusId(playerId);
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('club_members').update({ status: newStatus }).eq('club_id', id).eq('player_id', playerId);
      if (error) throw error;
      
      setClub((prev: any) => ({
        ...prev,
        club_members: prev.club_members.map((m: any) => m.player_id === playerId ? { ...m, status: newStatus } : m)
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to update member status.');
    } finally {
      setTogglingStatusId(null);
    }
  }

  async function handleTogglePrivacy() {
    setTogglingPrivacy(true);
    try {
      const newPrivate = !club.is_private;
      const { error } = await supabase.from('clubs').update({ is_private: newPrivate }).eq('id', id);
      if (error) throw error;
      setClub((prev: any) => ({ ...prev, is_private: newPrivate }));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle privacy.');
    } finally {
      setTogglingPrivacy(false);
    }
  }

  async function cancelInvitation(inviteId: string) {
    if (!confirm('Cancel this invitation?')) return;
    try {
      const { error } = await supabase.from('member_invitations').delete().eq('id', inviteId);
      if (error) throw error;
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err: any) {
      alert(err.message || 'Failed to cancel invitation.');
    }
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

  async function handleDeleteClub() {
    if (!confirm(`Delete "${club?.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('clubs').delete().eq('id', id);
      if (error) throw error;
      navigate('/clubs');
    } catch (err: any) {
      alert(err.message || 'Failed to delete club.');
    }
  }

  async function saveClubName() {
    if (!clubNameDraft.trim()) return;
    setSavingClubName(true);
    try {
      const { error } = await supabase.from('clubs').update({ name: clubNameDraft.trim() }).eq('id', id);
      if (error) throw error;
      setClub((prev: any) => ({ ...prev, name: clubNameDraft.trim() }));
      setEditingClubName(false);
    } catch (err: any) {
      alert(err.message || 'Failed to rename club.');
    } finally {
      setSavingClubName(false);
    }
  }

  async function saveLadderName(ladderId: string) {
    if (!ladderNameDraft.trim()) return;
    try {
      const { error } = await supabase.from('ladders').update({ name: ladderNameDraft.trim() }).eq('id', ladderId);
      if (error) throw error;
      setLadders(prev => prev.map(l => l.id === ladderId ? { ...l, name: ladderNameDraft.trim() } : l));
      setRenamingLadderId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to rename ladder.');
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-light)' }}>Loading club...</div>;
  if (!club) return <div style={{ padding: '2rem', color: '#ef4444' }}>Club not found.</div>;

  return (
    <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Link to="/clubs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to My Clubs
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          {/* Inline club name edit */}
          {editingClubName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <input
                autoFocus
                value={clubNameDraft}
                onChange={e => setClubNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveClubName(); if (e.key === 'Escape') setEditingClubName(false); }}
                style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-color)', border: '2px solid var(--primary-color)', borderRadius: '6px', padding: '0.1rem 0.5rem', width: '100%', maxWidth: '360px' }}
              />
              <button onClick={saveClubName} disabled={savingClubName} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669' }}>
                <Save size={18} />
              </button>
              <button onClick={() => setEditingClubName(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                <X size={18} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ color: 'var(--primary-color)', marginBottom: 0 }}>{club.name}</h1>
              {isAdmin && (
                <button
                  onClick={() => { setClubNameDraft(club.name); setEditingClubName(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}
                  title="Rename club"
                >
                  <Pencil size={15} />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleTogglePrivacy}
                  disabled={togglingPrivacy}
                  style={{ 
                    fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px',
                    backgroundColor: club.is_private ? '#fee2e2' : '#dcfce7',
                    color: club.is_private ? '#dc2626' : '#16a34a',
                    border: '1px solid', borderColor: club.is_private ? '#fca5a5' : '#86efac',
                    cursor: 'pointer'
                  }}
                  title="Toggle privacy"
                >
                  {club.is_private ? 'PRIVATE CLUB' : 'PUBLIC CLUB'}
                </button>
              )}
            </div>
          )}
          <p style={{ color: 'var(--text-light)' }}>{club.description || 'No description provided.'}</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={openEdit} className="btn flex items-center gap-2" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}>
              <Pencil size={15} /> Edit
            </button>
            <button onClick={handleDeleteClub} className="btn" style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
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
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{name}</span>
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
                backgroundColor: enabled ? 'rgba(0, 242, 255, 0.1)' : 'var(--secondary-color)',
                color: enabled ? 'var(--accent-color)' : 'var(--text-light)',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Members</h2>
          {isAdmin && (
            <button
              onClick={() => setShowAddMember(true)}
              className="btn flex items-center gap-2"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', backgroundColor: 'var(--primary-color)', color: 'white' }}
            >
              <Plus size={14} /> Add Member (Gmail)
            </button>
          )}
        </div>
        
        {/* Pending Invitations Section */}
        {isAdmin && pendingInvites.length > 0 && (
          <div style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.75rem' }}>Pending Invitations ({pendingInvites.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pendingInvites.map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-dark)' }}>
                    <span style={{ fontWeight: 600 }}>{inv.name}</span> 
                    <span style={{ color: 'var(--text-light)', marginLeft: '0.5rem' }}>({inv.email})</span>
                  </div>
                  <button 
                    onClick={() => cancelInvitation(inv.id)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {club.club_members?.map((m: any) => {
            const p = m.profiles;
            const displayName = p?.nickname || p?.first_name || (m.player_id === user?.id ? 'You' : m.player_id.slice(0, 8) + '…');
            const isSelf = m.player_id === user?.id;
            const isTargetAdmin = m.role === 'admin';
            return (
            <div key={m.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {p?.avatar_url
                  ? <img src={p.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#e5e7eb' }} />}
                <span style={{ color: 'var(--text-dark)' }}>{displayName}{isSelf ? ' (you)' : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: isTargetAdmin ? 'var(--orange-accent)' : 'var(--accent-color)',
                  textTransform: 'uppercase',
                  textShadow: `0 0 5px ${isTargetAdmin ? 'rgba(255, 159, 28, 0.4)' : 'rgba(0, 242, 255, 0.4)'}`
                }}>
                  {m.role}
                </span>

                {m.status === 'inactive' && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', backgroundColor: '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    INACTIVE
                  </span>
                )}

                {isAdmin && !isSelf && (
                  <button
                    onClick={() => handleToggleMemberStatus(m.player_id, m.status)}
                    disabled={togglingStatusId === m.player_id}
                    className="btn btn-outline"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: m.status === 'active' ? '#dc2626' : '#16a34a', color: m.status === 'active' ? '#dc2626' : '#16a34a' }}
                  >
                    {m.status === 'active' ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
                {isAdmin && !isSelf && (
                  <button
                    onClick={async () => {
                      const newRole = isTargetAdmin ? 'member' : 'admin';
                      const action = isTargetAdmin ? 'remove admin rights from' : 'make admin';
                      if (!confirm(`Are you sure you want to ${action} ${displayName}?`)) return;
                      try {
                        const { error } = await supabase
                          .from('club_members')
                          .update({ role: newRole })
                          .eq('club_id', id)
                          .eq('player_id', m.player_id);
                        if (error) throw error;
                        await loadClub();
                      } catch (err: any) {
                        alert(err.message || 'Failed to update role.');
                      }
                    }}
                    style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                      border: `1px solid ${isTargetAdmin ? '#fca5a5' : '#93c5fd'}`,
                      backgroundColor: isTargetAdmin ? '#fef2f2' : '#eff6ff',
                      color: isTargetAdmin ? '#dc2626' : '#2563eb',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {isTargetAdmin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                )}
              </div>
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
          <form onSubmit={handleCreateLadder} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem', padding: '1rem', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.3rem' }}>Ladder Name*</label>
                <input type="text" required value={newLadderName} onChange={e => setNewLadderName(e.target.value)} placeholder="e.g. Men's Singles Open" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.3rem' }}>Sport*</label>
                <select required value={newLadderSport} onChange={e => setNewLadderSport(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}>
                  <option value="">Select sport…</option>
                  {(club.sports || ALL_SPORTS).map((s: string) => <option key={s} value={s}>{SPORT_ICONS[s]} {s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.3rem' }}>Type</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['singles', 'doubles'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setNewLadderType(t)} style={{ flex: 1, padding: '0.45rem', borderRadius: '6px', border: `2px solid ${newLadderType === t ? '#4f46e5' : '#d1d5db'}`, backgroundColor: newLadderType === t ? '#e0e7ff' : '#f9fafb', color: newLadderType === t ? '#4f46e5' : 'var(--text-light)', fontWeight: newLadderType === t ? 600 : 400, cursor: 'pointer', fontSize: '0.85rem' }}>
                      {t === 'singles' ? '👤 Singles' : '👥 Doubles'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.3rem' }}>Rules / Notes</label>
                <input type="text" value={newLadderRules} onChange={e => setNewLadderRules(e.target.value)} placeholder="Optional rules" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '0.875rem' }} onClick={() => setShowCreateLadder(false)}>Cancel</button>
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
              <div key={l.id} style={{
                padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)', transition: 'box-shadow 0.15s',
                display: 'flex', flexDirection: 'column', gap: '0.4rem',
              }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                {/* Ladder name row — inline edit or link */}
                {renamingLadderId === l.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      autoFocus
                      value={ladderNameDraft}
                      onChange={e => setLadderNameDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveLadderName(l.id); if (e.key === 'Escape') setRenamingLadderId(null); }}
                      style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, border: '1px solid var(--primary-color)', borderRadius: '4px', padding: '0.15rem 0.4rem' }}
                    />
                    <button onClick={() => saveLadderName(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669' }}><Save size={14} /></button>
                    <button onClick={() => setRenamingLadderId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Link
                      to={`/clubs/${id}/ladders/${l.id}`}
                      style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem', textDecoration: 'none', flex: 1 }}
                    >
                      {l.name}
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => { setLadderNameDraft(l.name); setRenamingLadderId(l.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '1px' }}
                        title="Rename ladder"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                  <span className="badge-neon-green">{SPORT_ICONS[l.sport]} {l.sport}</span>
                  <span style={{ 
                    fontSize: '0.78rem', 
                    fontWeight: 600, 
                    color: 'var(--text-light)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    {l.type === 'singles' ? '👤 Singles' : '👥 Doubles'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowAddMember(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={22} />
            </button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-dark)' }}>Add Club Member</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              Members will be added automatically once they log in with this Gmail address.
            </p>
            <form onSubmit={handleInviteMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.3rem' }}>Gmail Address</label>
                <input 
                  type="email" 
                  required 
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)} 
                  placeholder="e.g. user@gmail.com" 
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.3rem' }}>Person's Name</label>
                <input 
                  type="text" 
                  required 
                  value={inviteName} 
                  onChange={e => setInviteName(e.target.value)} 
                  placeholder="e.g. John Doe" 
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px' }} 
                />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-dark)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={e => setSendEmail(e.target.checked)}
                    style={{ transform: 'scale(1.1)', cursor: 'pointer' }}
                  />
                  Send invitation email notification via Resend
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddMember(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }} disabled={inviting}>
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowEditModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={22} />
            </button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-dark)' }}>Edit Club</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.4rem' }}>Club Name</label>
                <input type="text" required value={editingName} onChange={e => setEditingName(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.4rem' }}>Description</label>
                <textarea value={editingDesc} onChange={e => setEditingDesc(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: '80px', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.75rem' }}>Facilities Available</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {ALL_SPORTS.map(sport => {
                    const checked = editingSports.includes(sport);
                    return (
                      <button key={sport} type="button" onClick={() => toggleSport(sport)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.9rem', borderRadius: '9999px',
                        border: `2px solid ${checked ? '#4f46e5' : '#d1d5db'}`,
                        backgroundColor: checked ? '#e0e7ff' : '#f9fafb',
                        color: checked ? '#4f46e5' : 'var(--text-light)',
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
