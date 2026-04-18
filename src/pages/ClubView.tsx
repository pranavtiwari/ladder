import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Pencil, X, Save, CheckCircle, XCircle, Plus, Trophy, Trash2, Lock, Unlock } from 'lucide-react';

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
  const [deletingLadderId, setDeletingLadderId] = useState<string | null>(null);

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

  // List Expand States
  const [expandJoinReqs, setExpandJoinReqs] = useState(false);
  const [expandMembers, setExpandMembers] = useState(false);
  const [expandLadders, setExpandLadders] = useState(false);

  // Privacy
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);

  // Add Pending to Ladder
  const [showLadderSelect, setShowLadderSelect] = useState(false);
  const [ladderTarget, setLadderTarget] = useState<{ id?: string, email?: string, name?: string, type: 'request' | 'invite', reqId?: string } | null>(null);
  const [processingLadderAdd, setProcessingLadderAdd] = useState(false);

  useEffect(() => {
    if (id && user) loadClub();
  }, [id, user]);

  async function loadClub() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select(`*, club_members(player_id, role, status, profiles(nickname, first_name, last_name, avatar_url, email))`)
        .eq('id', id)
        .single();
      if (error) throw error;
      setClub(data);
      const myMembership = data?.club_members?.find((m: any) => m.player_id === user?.id);
      const admin = myMembership?.role === 'admin';
      setIsAdmin(admin);
      if (myMembership || admin) {
        if (admin) await loadJoinRequests();
        await loadPendingInvitations();
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

  async function handleDeleteLadder(ladderId: string, ladderName: string) {
    if (!isAdmin) return;

    try {
      // 1. Check for matches/data
      const { count, error: countErr } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('ladder_id', ladderId);
      
      if (countErr) throw countErr;

      const { count: playerCount, error: playerErr } = await supabase
        .from('ladder_players')
        .select('*', { count: 'exact', head: true })
        .eq('ladder_id', ladderId);
      
      if (playerErr) throw playerErr;

      const hasData = (count || 0) > 0 || (playerCount || 0) > 0;
      const message = hasData 
        ? `WARNING: The ladder "${ladderName}" has match history or participants. Deleting it will PERMANENTLY remove all standings and scores. This cannot be undone.\n\nAre you sure you want to delete it?`
        : `Are you sure you want to delete the ladder "${ladderName}"?`;

      if (!window.confirm(message)) return;

      setDeletingLadderId(ladderId);

      // 2. Sequential deletion of dependencies
      await supabase.from('matches').delete().eq('ladder_id', ladderId);
      await supabase.from('ladder_players').delete().eq('ladder_id', ladderId);
      await supabase.from('ladder_teams').delete().eq('ladder_id', ladderId);
      await supabase.from('ladder_join_requests').delete().eq('ladder_id', ladderId);
      await supabase.from('member_invitations').delete().eq('ladder_id', ladderId);

      // 3. Delete the ladder itself
      const { error: delErr } = await supabase
        .from('ladders')
        .delete()
        .eq('id', ladderId);
      
      if (delErr) throw delErr;

      // Update local state
      setLadders(prev => prev.filter(l => l.id !== ladderId));
      alert('Ladder deleted successfully.');
    } catch (err: any) {
      console.error('Delete ladder error:', err);
      alert(err.message || 'Failed to delete ladder');
    } finally {
      setDeletingLadderId(null);
    }
  }

  async function loadPendingInvitations() {
    try {
      const { data, error } = await supabase
        .from('member_invitations')
        .select('*')
        .eq('club_id', id);
      if (error) throw error;
      setPendingInvites(data || []);
    } catch (err: any) {
      console.error('Error loading invitations:', err);
    }
  }

  async function handleLadderAssignment(ladderId: string) {
    if (!ladderTarget) return;
    setProcessingLadderAdd(true);
    try {
      if (ladderTarget.type === 'request') {
        const { error: inviteErr } = await supabase
          .from('club_join_requests')
          .update({ ladder_id: ladderId })
          .eq('id', ladderTarget.reqId);
        if (inviteErr) throw inviteErr;
        
        await loadJoinRequests();
      } else {
        // It's an invite
        const { error: inviteErr } = await supabase
          .from('member_invitations')
          .update({ ladder_id: ladderId })
          .eq('id', ladderTarget.reqId); // reqId is the invitation id here
        if (inviteErr) throw inviteErr;
        
        await loadPendingInvitations();
      }

      alert('Successfully assigned to ladder!');
      setShowLadderSelect(false);
      setLadderTarget(null);
      await loadClub();
    } catch (err: any) {
      alert(err.message || 'Failed to assign ladder.');
    } finally {
      setProcessingLadderAdd(false);
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
          try {
            const { error: fnError } = await supabase.functions.invoke('send-invitation-email', {
              body: { email: inviteEmail.trim(), name: inviteName.trim(), clubName: club?.name, inviterName }
            });
            if (fnError) throw fnError;
          } catch (fnErr: any) {
            console.error('Email error:', fnErr);
            // Don't throw, just let the invitation succeed
          }
        }
        alert(`Invitation sent to ${inviteEmail}.`);
        await loadPendingInvitations();
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
      loadClub(); // the trigger will wipe the dummy profile from club_members
    } catch (err: any) {
      alert(err.message || 'Failed to cancel invitation.');
    }
  }

  async function handleRemoveMember(playerId: string) {
    if (!confirm('Are you sure you want to remove this member from the club?')) return;
    try {
      const { error } = await supabase.from('club_members').delete().eq('club_id', id).eq('player_id', playerId);
      if (error) throw error;
      setClub((prev: any) => ({
        ...prev,
        club_members: prev.club_members.filter((m: any) => m.player_id !== playerId)
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 className="page-title" style={{ color: 'var(--primary-color)', marginBottom: 0 }}>{club.name}</h1>
                <div title={club.is_private ? 'Private Club' : 'Public Club'} style={{ color: 'var(--text-light)', display: 'flex', alignItems: 'center' }}>
                  {club.is_private ? <Lock size={20} /> : <Unlock size={20} />}
                </div>
              </div>
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
            {(expandJoinReqs ? joinRequests : joinRequests.slice(0, 2)).map(req => {
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
                      className="btn btn-outline"
                      style={{ 
                        padding: '0.3rem 0.6rem', fontSize: '0.7rem', color: 'var(--primary-color)',
                        borderColor: 'var(--primary-color)', backgroundColor: 'transparent'
                      }}
                      disabled={processingReq === req.id}
                      onClick={() => {
                        setLadderTarget({ id: req.player_id, name: name, type: 'request', reqId: req.id });
                        setShowLadderSelect(true);
                      }}
                    >
                      {req.ladder_id ? 'Change Ladder' : 'Add to Ladder'}
                    </button>
                    {req.ladder_id && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--primary-color)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                        Assigned: {ladders.find(l => l.id === req.ladder_id)?.name}
                      </span>
                    )}
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
          {joinRequests.length > 2 && (
            <button
              onClick={() => setExpandJoinReqs(!expandJoinReqs)}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', border: '1px dashed #d97706', borderRadius: '6px', background: 'none', cursor: 'pointer', color: '#92400e', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {expandJoinReqs ? 'Show Less' : `Show All Requests (${joinRequests.length})`}
            </button>
          )}
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

      {/* Member Management Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <h2 className="section-title" style={{ marginBottom: '1rem' }}>Members & Roles</h2>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)' }}>Player</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)' }}>Email</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)' }}>Role / Status</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Combine Invites and Members to slice top 2 */}
              {(() => {
                const memberEmails = new Set(
                  (club.club_members || [])
                    .map((m: any) => m.profiles?.email?.toLowerCase())
                    .filter(Boolean)
                );
                const deduplicatedInvites = pendingInvites.filter(
                  (inv: any) => !memberEmails.has(inv.email?.toLowerCase())
                );
                const allMemberRows = [
                  ...deduplicatedInvites.map((inv: any) => ({ type: 'invite', data: inv })),
                  ...(club.club_members || []).map((m: any) => ({ type: 'member', data: m }))
                ];
                const displayedRows = expandMembers ? allMemberRows : allMemberRows.slice(0, 2);

                return displayedRows.map((row) => {
                  if (row.type === 'invite') {
                    const inv = row.data;
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(56, 189, 248, 0.03)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>✉️</div>
                            <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{inv.name} (Invited)</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                          {inv.email}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-color)', border: '1px solid var(--accent-color)', padding: '0.1rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                            Pending Invite
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {!inv.ladder_id && isAdmin && (
                              <button
                                onClick={() => {
                                  setLadderTarget({ email: inv.email, name: inv.name, type: 'invite', reqId: inv.id });
                                  setShowLadderSelect(true);
                                }}
                                className="btn btn-outline"
                                style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                              >
                                Add to Ladder
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={() => cancelInvitation(inv.id)} title="Cancel Invitation" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.4rem' }}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  } else {
                    const m = row.data;
                    const p = m.profiles;
                    const displayName = p?.nickname || p?.first_name || (m.player_id === user?.id ? 'You' : m.player_id.slice(0, 8) + '…');
                    const isSelf = m.player_id === user?.id;
                    const isTargetAdmin = m.role === 'admin';
                    return (
                      <tr key={m.player_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {p?.avatar_url
                              ? <img src={p.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                              : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#e5e7eb' }} />}
                            <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>{displayName}{isSelf && <span style={{ color: 'var(--text-light)', fontWeight: 400 }}> (you)</span>}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                          {p?.email || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ 
                              fontSize: '0.75rem', fontWeight: 600, color: isTargetAdmin ? 'var(--orange-accent)' : 'var(--accent-color)', textTransform: 'uppercase',
                              padding: '0.1rem 0.4rem', border: `1px solid ${isTargetAdmin ? 'var(--orange-accent)' : 'var(--accent-color)'}`, borderRadius: '4px'
                            }}>
                              {m.role}
                            </span>
                            {m.status === 'inactive' && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', backgroundColor: '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                INACTIVE
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {isAdmin && !isSelf && (
                              <select
                                value=""
                                onChange={async (e) => {
                                  const action = e.target.value;
                                  if (!action) return;
                                  if (action === 'toggle_admin') {
                                    const newRole = isTargetAdmin ? 'member' : 'admin';
                                    if (!confirm(`Change role to ${newRole}?`)) return;
                                    try {
                                      await supabase.from('club_members').update({ role: newRole }).eq('club_id', id).eq('player_id', m.player_id);
                                      loadClub();
                                    } catch (err) { alert('Failed to update role.'); }
                                  } else if (action === 'toggle_status') {
                                    handleToggleMemberStatus(m.player_id, m.status);
                                  }
                                }}
                                className="input-field"
                                style={{ padding: '0.2rem 1.4rem 0.2rem 0.4rem', fontSize: '0.75rem', minHeight: 'auto', width: 'auto' }}
                              >
                                <option value="">⚙️ Manage</option>
                                <option value="toggle_status">{m.status === 'active' ? 'Deactivate' : 'Reactivate'}</option>
                                <option value="toggle_admin">{isTargetAdmin ? 'Remove Admin' : 'Make Admin'}</option>
                              </select>
                            )}
                            {isAdmin && !isSelf && (
                              <button onClick={() => handleRemoveMember(m.player_id)} title="Remove Player" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.4rem' }}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                });
              })()}
              
              {/* Inline Add Row (Admin Only) */}
              {isAdmin && (
                <tr style={{ backgroundColor: 'rgba(5, 150, 105, 0.03)' }}>
                  <td colSpan={4} style={{ padding: 0 }}>
                    <form onSubmit={handleInviteMember} style={{ display: 'flex', width: '100%', alignItems: 'center', padding: '0.5rem 1rem', gap: '0.75rem' }}>
                      <Plus size={16} color="#059669" style={{ flexShrink: 0 }} />
                      <input 
                        type="text" required placeholder="Player Name" className="input-field" disabled={inviting}
                        value={inviteName} onChange={e => setInviteName(e.target.value)}
                        style={{ flex: 1, minHeight: '34px', fontSize: '0.85rem' }} 
                      />
                      <input 
                        type="email" required placeholder="Email Address" className="input-field" disabled={inviting}
                        value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                        style={{ flex: 1.5, minHeight: '34px', fontSize: '0.85rem' }} 
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-light)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} disabled={inviting} />
                        Send invite email
                      </label>
                      <button type="submit" disabled={inviting} className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', backgroundColor: '#059669', color: 'white', minHeight: '34px' }}>
                        {inviting ? 'Adding...' : 'Add Player'}
                      </button>
                    </form>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {(pendingInvites.length + (club.club_members?.length || 0)) > 2 && (
          <button
            onClick={() => setExpandMembers(!expandMembers)}
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: 600 }}
          >
            {expandMembers ? 'Show Less' : `Show All Members (${pendingInvites.length + (club.club_members?.length || 0)})`}
          </button>
        )}
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
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {(expandLadders ? ladders : ladders.slice(0, 2)).map((l: any) => (
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
                        <>
                          <button
                            onClick={() => { setLadderNameDraft(l.name); setRenamingLadderId(l.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '1px' }}
                            title="Rename ladder"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteLadder(l.id, l.name)}
                            disabled={deletingLadderId === l.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: '1px', marginLeft: '2px' }}
                            title="Delete ladder"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
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
            {ladders.length > 2 && (
              <button
                onClick={() => setExpandLadders(!expandLadders)}
                style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {expandLadders ? 'Show Less' : `Show All Ladders (${ladders.length})`}
              </button>
            )}
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
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.4rem' }}>Privacy</label>
                <button
                  type="button"
                  onClick={handleTogglePrivacy}
                  disabled={togglingPrivacy}
                  style={{ 
                    width: '100%', padding: '0.6rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600,
                    backgroundColor: club.is_private ? '#fee2e2' : '#dcfce7',
                    color: club.is_private ? '#dc2626' : '#16a34a',
                    border: '1px solid', borderColor: club.is_private ? '#fca5a5' : '#86efac',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  {club.is_private ? <Lock size={16} /> : <Unlock size={16} />}
                  {togglingPrivacy ? 'Updating...' : club.is_private ? 'Private — click to make Public' : 'Public — click to make Private'}
                </button>
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
      {/* Ladder Selection Modal */}
      {showLadderSelect && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', position: 'relative' }}>
            <button onClick={() => setShowLadderSelect(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <X size={22} />
            </button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-dark)' }}>Add to Ladder</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              Assign <strong>{ladderTarget?.name}</strong> to a ladder in this club.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {ladders.filter(l => l.type === 'singles').length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '1rem' }}>No singles ladders available.</p>
              ) : (
                ladders.filter(l => l.type === 'singles').map(l => (
                  <button
                    key={l.id}
                    onClick={() => handleLadderAssignment(l.id)}
                    disabled={processingLadderAdd}
                    className="btn btn-outline"
                    style={{ 
                      justifyContent: 'flex-start', 
                      textAlign: 'left', 
                      padding: '0.8rem 1rem', 
                      borderColor: 'var(--border-color)',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{l.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{SPORT_ICONS[l.sport]} {l.sport}</div>
                  </button>
                ))
              )}
            </div>
            
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.75rem', fontStyle: 'italic' }}>
              Note: Doubles ladder assignments are managed via team formation in the ladder view.
            </p>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowLadderSelect(false)}>Cancel</button>
            </div>
            
            {processingLadderAdd && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: 'white', fontWeight: 600 }}>
                Processing...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
