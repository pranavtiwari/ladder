import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Trophy, UserPlus, X, Swords, CheckCircle, XCircle, Pencil, Lock, Globe } from 'lucide-react';

const SPORT_ICONS: Record<string, string> = {
  'Badminton': '🏸', 'Tennis': '🎾', 'Table Tennis': '🏓',
  'Squash': '🟡', 'Pickle Ball': '🥒', 'Paddle': '🏏',
};

const CREATE_TEAM_VALUE = '__create_team__';

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

  const [activeTeamId, setActiveTeamId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Ladder Join Requests & Privacy
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [myPendingRequest, setMyPendingRequest] = useState(false);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);

  // Invitations
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<any[]>([]);
  const [inviting, setInviting] = useState(false);

  // For doubles team creation
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [partner, setPartner] = useState('');
  const [clubMembers, setClubMembers] = useState<any[]>([]);
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState('');
  const [myMatches, setMyMatches] = useState<any[]>([]);

  // Add Participant
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participantToAdd, setParticipantToAdd] = useState('');
  const [processingAdd, setProcessingAdd] = useState(false);
  const [allClubTeams, setAllClubTeams] = useState<any[]>([]);

  // Sync activeTeamId when entries/myTeams change (must be before any early returns)
  useEffect(() => {
    const myTeamsInLadder = entries.filter((e: any) => myTeams.some((t: any) => t.id === e.team_id));
    if (myTeamsInLadder.length > 0 && !myTeamsInLadder.find((e: any) => e.team_id === activeTeamId)) {
      setActiveTeamId(myTeamsInLadder[0].team_id);
    }
  }, [entries, activeTeamId, myTeams]);

  // Challenge
  const [challengeTarget, setChallengeTarget] = useState<any>(null);
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [challengeErr, setChallengeErr] = useState('');
  const [challengeWithTeamId, setChallengeWithTeamId] = useState<string>('');

  // Quick Record Match
  const [quickRecordTarget, setQuickRecordTarget] = useState<any>(null);
  const [qrScoreText, setQrScoreText] = useState('');
  const [qrWinnerId, setQrWinnerId] = useState('');
  const [submittingQuickRecord, setSubmittingQuickRecord] = useState(false);
  const [qrErr, setQrErr] = useState('');

  // Admin Match Entry
  const [showAdminMatchModal, setShowAdminMatchModal] = useState(false);
  const [adminP1Id, setAdminP1Id] = useState('');
  const [adminP2Id, setAdminP2Id] = useState('');
  const [adminWinnerId, setAdminWinnerId] = useState('');
  const [adminScore, setAdminScore] = useState('');
  const [submittingAdminMatch, setSubmittingAdminMatch] = useState(false);

  // Edit ladder modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Privacy info modal (visible to all)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Edit team modal
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editTeamId, setEditTeamId] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [savingTeamName, setSavingTeamName] = useState(false);

  // Match History logic
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (ladderId && user) load();
  }, [ladderId, user]);

  // Sort entries by DB current_rank and assign display rank
  function sortByRank(data: any[]) {
    // Fallback sort just in case, but DB should already return rank order
    const sorted = [...data].sort((a, b) => (a.current_rank ?? 9999) - (b.current_rank ?? 9999));
    return sorted.map((entry, i) => ({ ...entry, display_rank: i + 1 }));
  }

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

      // Check admin status
      const { data: membership } = await supabase
        .from('club_members')
        .select('role')
        .eq('club_id', id)
        .eq('player_id', user?.id)
        .single();
      setIsAdmin(membership?.role === 'admin');

      let loadedTeams = myTeams;

      if (lad.type === 'singles') {
        const { data: players } = await supabase
          .from('ladder_players')
          .select('*, profiles(nickname, first_name, avatar_url)')
          .eq('ladder_id', ladderId)
          .gt('current_rank', 0);
        const sorted = sortByRank(players || []);
        setEntries(sorted);
        const me = sorted.find((p: any) => p.player_id === user?.id);
        setMyRank(me?.display_rank ?? null);
      } else {
        const { data: teams } = await supabase
          .from('ladder_teams')
          .select('*, teams(name, player1_id, player2_id, profiles_player1:profiles!teams_player1_id_fkey(nickname, first_name), profiles_player2:profiles!teams_player2_id_fkey(nickname, first_name))')
          .eq('ladder_id', ladderId);
        const sorted = sortByRank(teams || []);
        setEntries(sorted);



        // My teams in this club
        const { data: mt } = await supabase
          .from('teams')
          .select('*, profiles_player1:profiles!teams_player1_id_fkey(nickname, first_name), profiles_player2:profiles!teams_player2_id_fkey(nickname, first_name)')
          .eq('club_id', id)
          .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`);
        setMyTeams(mt || []);
        loadedTeams = mt || [];

        const meTeamIds = (mt || []).map((t: any) => t.id);
        const joined = sorted.find((lt: any) => meTeamIds.includes(lt.team_id));
        setMyRank(joined?.display_rank ?? null);
      }

      // Load all club members for "Add Participant" / admin select
      const { data: members } = await supabase
        .from('club_members')
        .select('player_id, profiles(nickname, first_name)')
        .eq('club_id', id);
      
      // Also include pending invited members so they can be added to teams
      const { data: invitedMembers } = await supabase
        .from('member_invitations')
        .select('id, name, email')
        .eq('club_id', id);
      
      const invitedAsPseudoMembers = (invitedMembers || []).map((inv: any) => ({
        player_id: `invite:${inv.id}`,  // synthetic ID to distinguish
        profiles: { nickname: `${inv.name} (Invited)`, first_name: inv.name },
        _isInvite: true,
        _inviteEmail: inv.email,
      }));
      
      setClubMembers([...(members || []), ...invitedAsPseudoMembers]);

      // Load all teams in club for "Add Participant"
      const { data: act } = await supabase
        .from('teams')
        .select('*')
        .eq('club_id', id);
      setAllClubTeams(act || []);

      // Load pending members (Invitations, Club Requests, and Ladder Join Requests) for ALL ladder types
      const { data: pInvites } = await supabase
        .from('member_invitations')
        .select('*')
        .eq('ladder_id', ladderId);
      setPendingInvites(pInvites || []);

      // Ladder join requests (everyone should see these as pending at the bottom)
      const { data: lReqs } = await supabase
        .from('ladder_join_requests')
        .select('id, player_id, team_id, profiles(nickname, first_name, last_name, avatar_url), teams(name)')
        .eq('ladder_id', ladderId)
        .eq('status', 'pending');
        
      const ladderReqsMerged = (lReqs || []).map((r: any) => ({ ...r, source: 'ladder' }));

      const { data: pClubReqs } = await supabase
        .from('club_join_requests')
        .select('id, player_id, profiles(nickname, first_name, last_name, avatar_url), ladder_id')
        .eq('club_id', id)
        .eq('status', 'pending');
        
      const clubReqsMerged = (pClubReqs || [])
        .filter((r: any) => r.ladder_id === ladderId)
        .map((r: any) => ({ ...r, source: 'club' }));

      const mergedLadderPendings = [...ladderReqsMerged, ...clubReqsMerged];
      setPendingJoinRequests(mergedLadderPendings);

      // Load my active matches in this ladder
      const { data: myMatchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('ladder_id', ladderId)
        .in('status', ['pending', 'accepted', 'score_submitted']);
      const filteredMatches = (myMatchesData || []).filter(m => {
        const isParticipant = (lad.type === 'singles' && (m.challenger_id === user?.id || m.defender_id === user?.id)) ||
                            (lad.type !== 'singles' && loadedTeams.some((t: any) => t.id === m.challenger_team_id || t.id === m.defender_team_id));
        return isParticipant;
      });
      setMyMatches(filteredMatches);

      // Load pending requests
      if (membership?.role === 'admin') {
        const { data: reqs } = await supabase
          .from('ladder_join_requests')
          .select('id, player_id, team_id, status, created_at, profiles(nickname, first_name, last_name, avatar_url), teams(name)')
          .eq('ladder_id', ladderId)
          .eq('status', 'pending');
        
        const adminLadderReqs = (reqs || []).map((r: any) => ({ ...r, source: 'ladder' }));
        setJoinRequests([...adminLadderReqs, ...clubReqsMerged]);
      }

      const { data: myReqs } = await supabase
        .from('ladder_join_requests')
        .select('id')
        .eq('ladder_id', ladderId)
        .eq('player_id', user?.id)
        .eq('status', 'pending');
      setMyPendingRequest(!!(myReqs && myReqs.length > 0));

      // Load recent ladder matches
      const { data: recentData } = await supabase
        .from('matches')
        .select(`
          id, status, score_text, played_at, challenger_id, defender_id, winner_id,
          challenger_team_id, defender_team_id, winner_team_id,
          challenger:profiles!matches_challenger_id_fkey(nickname, first_name),
          defender:profiles!matches_defender_id_fkey(nickname, first_name),
          challenger_team:teams!matches_challenger_team_id_fkey(name),
          defender_team:teams!matches_defender_team_id_fkey(name)
        `)
        .eq('ladder_id', ladderId)
        .order('played_at', { ascending: false })
        .limit(10);
      setRecentMatches(recentData || []);
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
      if (ladder.is_private) {
        const { error } = await supabase.from('ladder_join_requests').insert({ ladder_id: ladderId, player_id: user?.id });
        if (error) throw error;
        setMyPendingRequest(true);
      } else {
        const nextRank = entries.length + 1;
        const { error } = await supabase
          .from('ladder_players')
          .insert({ ladder_id: ladderId, player_id: user?.id, current_rank: nextRank });
        if (error) throw error;
      }
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

    const partner1 = isAdmin ? (adminP1Id || user?.id) : user?.id;
    const partner2 = partner;

    if (!partner1 || !partner2) {
      alert('Please select both partners.');
      setCreatingTeam(false);
      return;
    }

    if (partner1 === partner2) {
      alert('A team cannot have the same player assigned twice. Please choose a different partner.');
      setCreatingTeam(false);
      return;
    }

    // Detect invited (not-yet-signed-up) members
    const partner1IsInvite = String(partner1).startsWith('invite:');
    const partner2IsInvite = String(partner2).startsWith('invite:');

    const finalPlayer1 = partner1IsInvite ? null : (partner1 as string);
    const finalPlayer2 = partner2IsInvite ? null : (partner2 as string);
    const invitedPartnerId  = partner1IsInvite ? partner1.replace('invite:', '') : null;
    const invitedPartner2Id = partner2IsInvite ? partner2.replace('invite:', '') : null;

    // Duplicate team check (only for two real members)
    if (!isAdmin && !partner1IsInvite && !partner2IsInvite) {
      const existingTeam = myTeams.find(
        (t: any) => (t.player1_id === finalPlayer1 && t.player2_id === finalPlayer2) ||
                    (t.player1_id === finalPlayer2 && t.player2_id === finalPlayer1)
      );
      if (existingTeam) {
        alert(`You already have a team with this player (${existingTeam.name}). Please use it instead.`);
        setCreatingTeam(false);
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          club_id: id,
          name: teamName,
          player1_id: finalPlayer1,
          player2_id: finalPlayer2,
          invited_partner_id: invitedPartnerId,
          invited_partner2_id: invitedPartner2Id,
        })
        .select()
        .single();
      if (error) throw error;
      
      if (!isAdmin) {
        setMyTeams((prev: any) => [...prev, data]);
        setSelectedTeam(data.id);
      } else {
        alert('Team created successfully. You can now join it to the ladder if desired, or it will be available for selection.');
      }
      
      setShowCreateTeam(false);
      setTeamName('');
      setPartner('');
      setAdminP1Id('');
      await load(); // refresh to update availability
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
      if (ladder.is_private) {
        const { error } = await supabase.from('ladder_join_requests').insert({ ladder_id: ladderId, player_id: user?.id, team_id: selectedTeam });
        if (error) throw error;
        setMyPendingRequest(true);
      } else {
        // Find the team from 'myTeams'
        const t = myTeams.find(t => t.id === selectedTeam);
        
        const nextRank = entries.length + 1;
        const { error } = await supabase
          .from('ladder_teams')
          .insert({ ladder_id: ladderId, team_id: selectedTeam, current_rank: nextRank });
        if (error) throw error;
        
        // Attempt to ensure ladder_players exist for the team members to initialize individual ELO
        if (t) {
          // Safe to ignore unique constraint errors
          await supabase.from('ladder_players').insert([
            { ladder_id: ladderId, player_id: t.player1_id, current_rank: 0 },
            { ladder_id: ladderId, player_id: t.player2_id, current_rank: 0 }
          ]).select().then(() => {}); 
        }
      }

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
      const payload: any = {
        ladder_id: ladderId,
        challenger_id: user?.id,
        defender_id: isSingles ? challengeTarget.player_id : null,
        challenger_team_id: isSingles ? null : (challengeWithTeamId || activeTeamId || myTeamsInLadder[0]?.team_id),
        defender_team_id: isSingles ? null : challengeTarget.team_id,
        status: 'pending'
      };

      const { error } = await supabase.from('matches').insert(payload);
      if (error) throw error;
      await load();
      setChallengeTarget(null);
      alert('Challenge sent!');
    } catch (err: any) {
      setChallengeErr(err.message || 'Failed to send challenge.');
    } finally {
      setSubmittingChallenge(false);
    }
  }

  async function submitQuickRecord() {
    if (!quickRecordTarget || !qrWinnerId) return;
    setSubmittingQuickRecord(true);
    setQrErr('');
    try {
      const payload: any = {
        ladder_id: ladderId,
        challenger_id: user?.id,
        defender_id: isSingles ? quickRecordTarget.player_id : null,
        challenger_team_id: isSingles ? null : (activeTeamId || myTeamsInLadder[0]?.team_id),
        defender_team_id: isSingles ? null : quickRecordTarget.team_id,
        status: 'score_submitted',
        score_text: qrScoreText,
        score_submitted_by: user?.id,
        score_submitted_at: new Date().toISOString()
      };

      if (isSingles) {
        payload.winner_id = qrWinnerId;
      } else {
        payload.winner_team_id = qrWinnerId;
      }

      const { error } = await supabase.from('matches').insert(payload);
      if (error) throw error;
      
      setQuickRecordTarget(null);
      setQrScoreText('');
      setQrWinnerId('');
      alert('Result submitted! Your opponent needs to confirm this on their dashboard.');
      await load();
    } catch (err: any) {
      setQrErr(err.message || 'Failed to record result.');
    } finally {
      setSubmittingQuickRecord(false);
    }
  }

  async function submitAdminMatch() {
    if (!adminP1Id || !adminP2Id || !adminWinnerId || !adminScore) {
      alert('Please fill all fields.');
      return;
    }
    if (adminP1Id === adminP2Id) {
      alert('Participants cannot be the same.');
      return;
    }
    
    setSubmittingAdminMatch(true);
    try {
      const { error } = await supabase.from('matches').insert({
        ladder_id: ladderId,
        ...(isSingles
          ? { challenger_id: adminP1Id, defender_id: adminP2Id, winner_id: adminWinnerId }
          : { challenger_team_id: adminP1Id, defender_team_id: adminP2Id, winner_team_id: adminWinnerId }),
        score_text: adminScore,
        status: 'completed', // Admin results are final
        played_at: new Date().toISOString(),
      });
      if (error) throw error;
      
      alert('Match recorded successfully!');
      setShowAdminMatchModal(false);
      setAdminP1Id('');
      setAdminP2Id('');
      setAdminWinnerId('');
      setAdminScore('');
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to record admin match.');
    } finally {
      setSubmittingAdminMatch(false);
    }
  }

  async function handleDeleteLadderMatch(matchId: string) {
    if (!window.confirm('Are you sure you want to delete this match result?')) return;
    setDeletingMatchId(matchId);
    try {
      const { error } = await supabase.from('matches').delete().eq('id', matchId);
      if (error) throw error;
      setRecentMatches(prev => prev.filter(m => m.id !== matchId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete match.');
    } finally {
      setDeletingMatchId(null);
    }
  }

  async function handleInviteToLadder(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc('send_member_invitation', {
        p_email: inviteEmail.trim(),
        p_name: inviteName.trim(),
        p_club_id: id,
        p_ladder_id: ladderId
      });
      if (error) throw error;
      
      if (data === 'added') {
        alert(`${inviteName} is already a user! They have been added to the ladder immediately.`);
        await load();
      } else {
        if (sendEmail) {
          // call edge function
          const inviterName = user?.user_metadata?.name || 'A club admin';
          await supabase.functions.invoke('send-invitation-email', {
            body: { email: inviteEmail.trim(), name: inviteName.trim(), clubName: ladder?.name, inviterName }
          });
        }
        alert(`Invitation sent to ${inviteEmail}. They will join this ladder automatically when they log in.`);
      }
      
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setSendEmail(false);
    } catch (err: any) {
      alert(err.message || 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRequest(reqId: string, approved: boolean, playerId: string, teamId: string | null, source: string = 'ladder') {
    setProcessingReqId(reqId);
    try {
      const newStatus = approved ? 'approved' : 'rejected';
      const tableName = source === 'club' ? 'club_join_requests' : 'ladder_join_requests';
      const { error: updateErr } = await supabase.from(tableName).update({ status: newStatus }).eq('id', reqId);
      if (updateErr) throw updateErr;

      if (approved) {
        if (source === 'club') {
          // Add them to the club officially
          const { error: clubInsertErr } = await supabase.from('club_members').insert({ club_id: id, player_id: playerId, role: 'member' });
          if (clubInsertErr) throw clubInsertErr;
        }

        if (ladder.type === 'singles') {
          const nextRank = entries.length + 1;
          const { error } = await supabase.from('ladder_players').insert({ ladder_id: ladderId, player_id: playerId, current_rank: nextRank });
          if (error) throw error;
        } else if (teamId) {
          const nextRank = entries.length + 1;
          const { error } = await supabase.from('ladder_teams').insert({ ladder_id: ladderId, team_id: teamId, current_rank: nextRank });
          if (error) throw error;
          
          const t = allClubTeams.find(tea => tea.id === teamId);
          if (t) {
            await supabase.from('ladder_players').insert([
              { ladder_id: ladderId, player_id: t.player1_id, current_rank: 0 },
              { ladder_id: ladderId, player_id: t.player2_id, current_rank: 0 }
            ]).select().then(() => {}); 
          }
        }
      }
      setJoinRequests(prev => prev.filter(r => r.id !== reqId));
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to process request.');
    } finally {
      setProcessingReqId(null);
    }
  }

  async function handleTogglePrivacy() {
    setTogglingPrivacy(true);
    try {
      const newPrivate = !ladder.is_private;
      const { error } = await supabase.from('ladders').update({ is_private: newPrivate }).eq('id', ladderId);
      if (error) throw error;
      setLadder({ ...ladder, is_private: newPrivate });
    } catch (err: any) {
      alert(err.message || 'Failed to toggle privacy.');
    } finally {
      setTogglingPrivacy(false);
    }
  }

  async function saveEditLadder() {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('ladders').update({ name: editName.trim() }).eq('id', ladderId);
      if (error) throw error;
      setLadder({ ...ladder, name: editName.trim() });
      setShowEditModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveEditTeam() {
    if (!editTeamName.trim() || !editTeamId) return;
    setSavingTeamName(true);
    try {
      const { error } = await supabase.from('teams').update({ name: editTeamName.trim() }).eq('id', editTeamId);
      if (error) throw error;
      
      setMyTeams(prev => prev.map(t => t.id === editTeamId ? { ...t, name: editTeamName.trim() } : t));
      setEntries(prev => prev.map(e => e.team_id === editTeamId ? { ...e, teams: { ...e.teams, name: editTeamName.trim() } } : e));
      setAllClubTeams(prev => prev.map(t => t.id === editTeamId ? { ...t, name: editTeamName.trim() } : t));

      setShowEditTeamModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to rename team.');
    } finally {
      setSavingTeamName(false);
    }
  }

  async function removeParticipant(entryId: string) {
    if (!confirm('Are you sure you want to remove this participant from the ladder?')) return;
    
    try {
      const table = isSingles ? 'ladder_players' : 'ladder_teams';
      const { error } = await supabase.from(table).delete().eq('id', entryId);
      if (error) throw error;
      setEntries(entries.filter(e => e.id !== entryId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove participant.');
    }
  }

  async function handleAddParticipant() {
    if (!participantToAdd) return;

    if (String(participantToAdd).startsWith('invite:')) {
      alert('Invited members must sign up and join the club before they can be added to the ladder directly. Please ask them to accept their invite.');
      return;
    }

    setProcessingAdd(true);
    try {
      const isSingles = ladder.type === 'singles';
      const nextRank = entries.length + (pendingJoinRequests.length || 0) + 1; // Put at the absolute bottom
      
      if (isSingles) {
        const { error } = await supabase
          .from('ladder_players')
          .insert({ ladder_id: ladderId, player_id: participantToAdd, current_rank: nextRank });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ladder_teams')
          .insert({ ladder_id: ladderId, team_id: participantToAdd, current_rank: nextRank });
        if (error) throw error;
        
        // Also ensure ladder_players exist for individual ELO
        const t = allClubTeams.find(tea => tea.id === participantToAdd);
        if (t) {
          await supabase.from('ladder_players').insert([
            { ladder_id: ladderId, player_id: t.player1_id, current_rank: 0 },
            { ladder_id: ladderId, player_id: t.player2_id, current_rank: 0 }
          ]).select().then(() => {}); 
        }
      }
      
      alert('Participant added to ladder!');
      setShowAddParticipant(false);
      setParticipantToAdd('');
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to add participant.');
    } finally {
      setProcessingAdd(false);
    }
  }

  // Handle team select including the "Create new team" sentinel
  function handleTeamSelectChange(value: string) {
    if (value === CREATE_TEAM_VALUE) {
      setShowCreateTeam(true);
      setSelectedTeam('');
    } else {
      setSelectedTeam(value);
      setShowCreateTeam(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-light)' }}>Loading ladder…</div>;
  if (!ladder) return <div style={{ padding: '2rem', color: '#ef4444' }}>Ladder not found.</div>;

  const isSingles = ladder.type === 'singles';
  const alreadyJoined = myRank !== null;
  // For doubles: find which ladder_team entries belong to the user
  const myTeamsInLadder = !isSingles
    ? entries.filter((e: any) => myTeams.some((t: any) => t.id === e.team_id))
    : [];

  const activeTeamEntry = myTeamsInLadder.find((e: any) => e.team_id === activeTeamId) || myTeamsInLadder[0];
  const myActiveRank = isSingles ? myRank : (activeTeamEntry?.display_rank ?? null);

  // Filter available teams for join dropdown
  const availableTeamsForJoin = myTeams.filter((t: any) => {
    if (entries.find((e: any) => e.team_id === t.id)) return false;
    const pairMatch = entries.find((e: any) =>
      (e.teams?.player1_id === t.player1_id && e.teams?.player2_id === t.player2_id) ||
      (e.teams?.player1_id === t.player2_id && e.teams?.player2_id === t.player1_id)
    );
    return !pairMatch;
  });

  return (
    <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Link to={`/clubs/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Club
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ color: 'var(--primary-color)', marginBottom: 0 }}>{ladder.name}</h1>
            {/* Lock icon — clickable by everyone */}
            <button
              onClick={() => setShowPrivacyModal(true)}
              title={ladder.is_private ? 'Private ladder' : 'Public ladder'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', color: ladder.is_private ? '#dc2626' : '#16a34a' }}
            >
              {ladder.is_private ? <Lock size={18} /> : <Globe size={18} />}
            </button>
            {/* Pencil icon — admin only */}
            {isAdmin && (
              <button
                onClick={() => { setEditName(ladder.name); setShowEditModal(true); }}
                title="Edit ladder settings"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', color: 'var(--text-light)' }}
              >
                <Pencil size={16} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{SPORT_ICONS[ladder.sport]} {ladder.sport}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {isSingles ? '👤 Singles' : '👥 Doubles'}
            </span>
          </div>
          {ladder.rules && <p style={{ color: 'var(--text-light)', marginTop: '0.5rem', fontSize: '0.875rem' }}>{ladder.rules}</p>}
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAdminMatchModal(true)}
            className="btn"
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', backgroundColor: 'var(--orange-accent)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Swords size={16} /> Add match result
          </button>
        )}
      </div>

      {isAdmin && joinRequests.length > 0 && (
        <div className="card" style={{ border: '2px solid #fbbf24', backgroundColor: '#fffbeb' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem', color: '#92400e' }}>
            ⏳ Pending Join Requests ({joinRequests.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {joinRequests.map(req => {
              const p = req.profiles;
              const name = req.team_id ? req.teams?.name : ([p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.nickname || 'Unknown user');
              const isClubReq = req.source === 'club';
              return (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.6rem 0', borderBottom: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{name}</span>
                    {isClubReq && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', backgroundColor: '#ede9fe', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Club Request</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn"
                      style={{ backgroundColor: '#059669', color: 'white', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                      disabled={processingReqId === req.id}
                      onClick={() => handleRequest(req.id, true, req.player_id, req.team_id ?? null, req.source)}
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#dc2626' }}
                      disabled={processingReqId === req.id}
                      onClick={() => handleRequest(req.id, false, req.player_id, req.team_id ?? null, req.source)}
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

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
        {isSingles ? (
          alreadyJoined ? (
            <span style={{ padding: '0.4rem 1rem', borderRadius: '8px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--primary-color)', fontWeight: 800, fontSize: '1rem', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              ✅ RANK #{myRank}
            </span>
          ) : (
            <button
              className="btn"
              style={{ backgroundColor: myPendingRequest ? '#d1d5db' : 'var(--primary-color)', color: myPendingRequest ? '#4b5563' : 'white' }}
              onClick={joinSingles}
              disabled={joining || myPendingRequest}
            >
              <UserPlus size={16} /> {myPendingRequest ? 'Pending Request...' : joining ? 'Joining…' : (ladder.is_private ? 'Join the ladder' : 'Join Ladder')}
            </button>
          )
        ) : (
          <>
            {alreadyJoined && (
              <>
                {myTeamsInLadder.length > 1 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select
                      value={activeTeamId}
                      onChange={e => setActiveTeamId(e.target.value)}
                      style={{ padding: '0.35rem 0.6rem', border: '1px solid rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--primary-color)', borderRadius: '6px', fontSize: '1rem', fontWeight: 600 }}
                    >
                      {myTeamsInLadder.map((mt: any) => (
                        <option key={mt.team_id} value={mt.team_id}>As {mt.teams?.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setEditTeamId(activeTeamId);
                        setEditTeamName(myTeamsInLadder.find(mt => mt.team_id === activeTeamId)?.teams?.name || '');
                        setShowEditTeamModal(true);
                      }}
                      className="btn btn-outline"
                      style={{ padding: '0.35rem 0.5rem' }}
                      title="Edit team name"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ padding: '0.35rem 0.6rem', backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--primary-color)', borderRadius: '6px', fontSize: '1rem', fontWeight: 600, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      {myTeamsInLadder[0]?.teams?.name}
                    </span>
                    <button
                      onClick={() => {
                        const teamId = myTeamsInLadder[0]?.team_id;
                        setEditTeamId(teamId);
                        setEditTeamName(myTeamsInLadder[0]?.teams?.name || '');
                        setShowEditTeamModal(true);
                      }}
                      className="btn btn-outline"
                      style={{ padding: '0.35rem 0.5rem' }}
                      title="Edit team name"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                )}
                <span style={{ padding: '0.4rem 1rem', borderRadius: '8px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--primary-color)', fontWeight: 800, fontSize: '1rem', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  ✅ RANK #{myActiveRank}
                </span>
              </>
            )}
            {!alreadyJoined && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '180px' }}>
                  <select
                    value={selectedTeam}
                    onChange={e => handleTeamSelectChange(e.target.value)}
                    style={{ flex: 1, padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                  >
                    <option value="">Select team…</option>
                    {availableTeamsForJoin.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name || 'Unnamed Team'}</option>
                    ))}
                    <option value={CREATE_TEAM_VALUE}>＋ Form a new team…</option>
                  </select>
                  {selectedTeam && selectedTeam !== CREATE_TEAM_VALUE && (
                    <button
                      onClick={() => {
                        setEditTeamId(selectedTeam);
                        setEditTeamName(availableTeamsForJoin.find(t => t.id === selectedTeam)?.name || '');
                        setShowEditTeamModal(true);
                      }}
                      className="btn btn-outline"
                      style={{ padding: '0.45rem 0.5rem' }}
                      title="Edit team name"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
                <button
                  className="btn"
                  style={{ backgroundColor: myPendingRequest ? '#d1d5db' : 'var(--primary-color)', color: myPendingRequest ? '#4b5563' : 'white' }}
                  onClick={joinDoubles}
                  disabled={joining || !selectedTeam || myPendingRequest}
                >
                  <UserPlus size={16} /> {myPendingRequest ? 'Pending Request...' : joining ? 'Joining…' : (ladder.is_private ? 'Join the ladder' : 'Join')}
                </button>
              </div>
            )}
          </>
        )}
        {joinError && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0, width: '100%' }}>{joinError}</p>}
      </div>

      {!isSingles && showCreateTeam && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <form onSubmit={createTeam} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>Form a Doubles Team</span>
              <button type="button" onClick={() => setShowCreateTeam(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}><X size={16} /></button>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>Team Name</label>
              <input type="text" required value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. The Giants" className="input" style={{ width: '100%' }} />
            </div>
            {isAdmin && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>Partner 1 (Admin override)</label>
                <select required value={adminP1Id} onChange={e => setAdminP1Id(e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select first partner…</option>
                  {clubMembers.map((m: any) => <option key={m.player_id} value={m.player_id}>{m.profiles?.nickname || m.profiles?.first_name || 'Member'}</option>)}
                  <option value={user?.id}>You ({user?.user_metadata?.name || 'Admin'})</option>
                </select>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>Partner</label>
              <select required value={partner} onChange={e => setPartner(e.target.value)} className="input" style={{ width: '100%' }}>
                <option value="">Select a partner…</option>
                {clubMembers.map((m: any) => <option key={m.player_id} value={m.player_id}>{m.profiles?.nickname || m.profiles?.first_name || 'Member'}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowCreateTeam(false)}>Cancel</button>
              <button type="submit" className="btn" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }} disabled={creatingTeam}>{creatingTeam ? 'Creating…' : 'Create Team'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="section-title" style={{ marginBottom: '1.25rem' }}>
          <Trophy size={18} style={{ display: 'inline', marginRight: '0.4rem', color: '#f59e0b' }} />
          Standings
        </h2>

        {entries.length === 0 && pendingJoinRequests.length === 0 && pendingInvites.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1.5rem' }}>No one has joined yet. Be the first!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {entries.map((entry: any, i: number) => {
              const isMe = isSingles ? entry.player_id === user?.id : (entry.teams?.player1_id === user?.id || entry.teams?.player2_id === user?.id);
              const displayName = isSingles ? (entry.profiles?.nickname || entry.profiles?.first_name || '—') : (entry.teams?.name || 'Unnamed Team');
              const subText = isSingles ? `${entry.wins}W – ${entry.losses}L · ELO: ${entry.elo_rating ?? 800}` : `${entry.wins}W – ${entry.losses}L · Team ELO: ${entry.elo_rating ?? 800}`;
              const rank = entry.display_rank;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              const canChallenge = !isMe && alreadyJoined && myActiveRank !== null && Math.abs(rank - myActiveRank) <= 2;
              const hasActiveMatch = myMatches.some(m => (isSingles && (m.challenger_id === entry.player_id || m.defender_id === entry.player_id)) || (!isSingles && (m.challenger_team_id === entry.team_id || m.defender_team_id === entry.team_id)));
              const hasBorder = (i < entries.length - 1) || pendingJoinRequests.length > 0 || pendingInvites.length > 0;

              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.5rem', backgroundColor: isMe ? 'rgba(34,197,94,0.08)' : 'transparent', borderBottom: hasBorder ? '1px solid var(--border-color)' : 'none', borderRadius: '6px' }}>
                  <span style={{ minWidth: '2.5rem', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-dark)', textAlign: 'center' }}>{medal || `#${rank}`}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isMe ? 700 : 600, color: isMe ? 'var(--primary-color)' : 'var(--text-dark)' }}>{displayName} {isMe ? '(you)' : ''}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{subText}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {canChallenge && (
                      <button onClick={() => { setChallengeTarget(entry); setChallengeErr(''); if (!isSingles) setChallengeWithTeamId(activeTeamId || myTeamsInLadder[0]?.team_id); }} disabled={hasActiveMatch} className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, backgroundColor: hasActiveMatch ? '#cbd5e1' : '#fef3c7', color: hasActiveMatch ? '#64748b' : '#92400e', border: '1px solid' + (hasActiveMatch ? '#94a3b8' : '#f59e0b') }}>
                        <Swords size={12} /> {hasActiveMatch ? 'Active' : 'Challenge'}
                      </button>
                    )}
                    {alreadyJoined && !isMe && (
                      <button onClick={() => { setQuickRecordTarget(entry); setQrErr(''); }} className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--primary-color)', border: '1px solid var(--primary-color)' }}>
                         Record
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {pendingJoinRequests.map((req, i) => {
              const p = req.profiles;
              const name = req.team_id ? req.teams?.name : ([p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.nickname || 'Unknown user');
              const hasBorder = (i < pendingJoinRequests.length - 1) || pendingInvites.length > 0;
              return (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.5rem', backgroundColor: 'transparent', borderBottom: hasBorder ? '1px solid var(--border-color)' : 'none', borderRadius: '6px', opacity: 0.7 }}>
                  <span style={{ minWidth: '2.5rem', fontWeight: 700, fontSize: '0.8rem', color: '#f59e0b', textAlign: 'center', backgroundColor: '#fef3c7', padding: '0.2rem 0', borderRadius: '4px' }}>PEND</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Waiting for admin approval</div>
                  </div>
                </div>
              );
            })}
            {pendingInvites.map((inv, i) => {
                const hasBorder = (i < pendingInvites.length - 1);
                return (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.5rem', backgroundColor: 'transparent', borderBottom: hasBorder ? '1px solid var(--border-color)' : 'none', borderRadius: '6px', opacity: 0.7 }}>
                    <span style={{ minWidth: '2.5rem', fontWeight: 700, fontSize: '0.8rem', color: '#8b5cf6', textAlign: 'center', backgroundColor: '#ede9fe', padding: '0.2rem 0', borderRadius: '4px' }}>INV</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{inv.name || inv.email}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Invited to join</div>
                    </div>
                  </div>
              );
            })}
          </div>
        )}

        {!loading && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            {alreadyJoined && (
              <div style={{ marginTop: '1.25rem' }}>
                {!showAddParticipant ? (
                  <button onClick={() => setShowAddParticipant(true)} className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <UserPlus size={16} /> Add {isSingles ? 'Player' : 'Team'}
                  </button>
                ) : (
                  <div style={{ backgroundColor: 'var(--bg-light)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>Add to Ladder Standing</h4>
                      <button onClick={() => setShowAddParticipant(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}><X size={16} /></button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {isSingles ? (
                        <select className="input" value={participantToAdd} onChange={(e) => setParticipantToAdd(e.target.value)} style={{ width: '100%' }}>
                          <option value="">Select a member...</option>
                          {clubMembers.filter(m => !entries.some(e => e.player_id === m.player_id)).map(m => <option key={m.player_id} value={m.player_id}>{m.profiles?.nickname || m.profiles?.first_name || 'Member'}</option>)}
                        </select>
                      ) : (
                        <select className="input" value={participantToAdd} onChange={(e) => { if (e.target.value === CREATE_TEAM_VALUE) { setShowCreateTeam(true); setParticipantToAdd(''); } else { setParticipantToAdd(e.target.value); } }} style={{ width: '100%' }}>
                          <option value="">Select team…</option>
                          {allClubTeams?.filter(t => !entries.some(e => e.team_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          <option value={CREATE_TEAM_VALUE}>＋ Form a new team…</option>
                        </select>
                      )}
                      <button onClick={handleAddParticipant} disabled={!participantToAdd || processingAdd} className="btn" style={{ width: '100%', backgroundColor: 'var(--primary-color)', color: 'white' }}>{processingAdd ? 'Adding...' : isSingles ? 'Add player' : 'Add team'}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Recent Matches</h2>
        </div>
        {recentMatches.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '1.5rem' }}>No matches yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {recentMatches.map(m => {
              const challengerName = isSingles ? (m.challenger?.nickname || m.challenger?.first_name) : m.challenger_team?.name;
              const defenderName = isSingles ? (m.defender?.nickname || m.defender?.first_name) : m.defender_team?.name;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{challengerName}</span>
                      <span style={{ color: '#9ca3af' }}>vs</span>
                      <span style={{ fontWeight: 600 }}>{defenderName}</span>
                      {m.score_text && <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--primary-color)' }}>{m.score_text}</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDeleteLadderMatch(m.id)} disabled={deletingMatchId === m.id} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {challengeTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
             <button onClick={() => setChallengeTarget(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
             <h3 style={{ marginBottom: '1rem' }}>Send Challenge</h3>
             <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Challenge {isSingles ? challengeTarget.profiles?.nickname : challengeTarget.teams?.name}?</p>
             {challengeErr && <p style={{ color: 'red', fontSize: '0.8rem' }}>{challengeErr}</p>}
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="btn btn-outline" onClick={() => setChallengeTarget(null)}>Cancel</button>
                <button className="btn" onClick={submitChallenge} disabled={submittingChallenge}>{submittingChallenge ? 'Sending...' : 'Challenge'}</button>
             </div>
          </div>
        </div>
      )}

      {quickRecordTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
             <button onClick={() => setQuickRecordTarget(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
             <h3 style={{ marginBottom: '1rem' }}>Record Match</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                   <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Winner</label>
                   <select className="input" style={{ width: '100%' }} value={qrWinnerId} onChange={e => setQrWinnerId(e.target.value)}>
                      <option value="">Select winner...</option>
                      <option value={isSingles ? user?.id : (activeTeamId || myTeamsInLadder[0]?.team_id)}>Me</option>
                      <option value={isSingles ? quickRecordTarget.player_id : quickRecordTarget.team_id}>{isSingles ? quickRecordTarget.profiles?.nickname : quickRecordTarget.teams?.name}</option>
                   </select>
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Score</label>
                   <input className="input" style={{ width: '100%' }} value={qrScoreText} onChange={e => setQrScoreText(e.target.value)} placeholder="e.g. 21-15, 21-18" />
                </div>
                {qrErr && <p style={{ color: 'red', fontSize: '0.8rem' }}>{qrErr}</p>}
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button className="btn btn-outline" onClick={() => setQuickRecordTarget(null)}>Cancel</button>
                <button className="btn" onClick={submitQuickRecord} disabled={submittingQuickRecord}>{submittingQuickRecord ? 'Submitting...' : 'Submit Result'}</button>
             </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Invite to Ladder</h3>
            <form onSubmit={handleInviteToLadder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <input className="input" type="email" placeholder="Gmail Address" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
               <input className="input" type="text" placeholder="Name" required value={inviteName} onChange={e => setInviteName(e.target.value)} />
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowInviteModal(false)}>Cancel</button>
                  <button type="submit" className="btn" disabled={inviting}>{inviting ? 'Inviting...' : 'Invite'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showAdminMatchModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Record Admin Result</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <select className="input" value={adminP1Id} onChange={e => setAdminP1Id(e.target.value)}>
                  <option value="">Challenger...</option>
                  {entries.map(e => <option key={isSingles ? e.player_id : e.team_id} value={isSingles ? e.player_id : e.team_id}>{isSingles ? e.profiles?.nickname : e.teams?.name}</option>)}
               </select>
               <select className="input" value={adminP2Id} onChange={e => setAdminP2Id(e.target.value)}>
                  <option value="">Defender...</option>
                  {entries.map(e => <option key={isSingles ? e.player_id : e.team_id} value={isSingles ? e.player_id : e.team_id}>{isSingles ? e.profiles?.nickname : e.teams?.name}</option>)}
               </select>
               <select className="input" value={adminWinnerId} onChange={e => setAdminWinnerId(e.target.value)}>
                  <option value="">Winner...</option>
                  {adminP1Id && <option value={adminP1Id}>Participant 1</option>}
                  {adminP2Id && <option value={adminP2Id}>Participant 2</option>}
               </select>
               <input className="input" placeholder="Score text" value={adminScore} onChange={e => setAdminScore(e.target.value)} />
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button className="btn btn-outline" onClick={() => setShowAdminMatchModal(false)}>Cancel</button>
                  <button className="btn" onClick={submitAdminMatch} disabled={submittingAdminMatch}>{submittingAdminMatch ? 'Recording...' : 'Record'}</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Ladder Modal (admin only) ─────────────────────────────── */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowEditModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            <h3 style={{ marginBottom: '1.25rem' }}>Edit Ladder Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.3rem' }}>Ladder Name</label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Ladder name"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>Privacy</label>
                <button
                  onClick={handleTogglePrivacy}
                  disabled={togglingPrivacy}
                  style={{
                    width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem',
                    backgroundColor: ladder.is_private ? '#fee2e2' : '#dcfce7',
                    color: ladder.is_private ? '#dc2626' : '#16a34a',
                    border: `1px solid ${ladder.is_private ? '#fca5a5' : '#86efac'}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  {ladder.is_private ? <Lock size={15} /> : <Globe size={15} />}
                  {togglingPrivacy ? 'Updating…' : ladder.is_private ? 'Private — click to make Public' : 'Public — click to make Private'}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button className="btn" onClick={saveEditLadder} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save'}</button>
              </div>
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Ladder Participants</h4>
                {entries.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No participants yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {entries.map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-light)', padding: '0.5rem 0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <span>{isSingles ? (e.profiles?.nickname || e.profiles?.first_name || 'Unknown') : (e.teams?.name || 'Unnamed Team')}</span>
                        <button onClick={() => removeParticipant(e.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }} title="Remove from ladder">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy Info Modal (visible to all) ────────────────────────── */}
      {showPrivacyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '380px', position: 'relative' }}>
            <button onClick={() => setShowPrivacyModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              {ladder.is_private
                ? <Lock size={22} style={{ color: '#dc2626' }} />
                : <Globe size={22} style={{ color: '#16a34a' }} />}
              <h3 style={{ margin: 0 }}>{ladder.is_private ? 'Private Ladder' : 'Public Ladder'}</h3>
            </div>
            {ladder.is_private ? (
              <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                This ladder is <strong>private</strong>. Players cannot join on their own — they must submit a join request which an admin reviews and approves. Only approved members appear in the standings.
              </p>
            ) : (
              <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                This ladder is <strong>open to everyone</strong>. Any club member can join instantly without admin approval.
              </p>
            )}
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowPrivacyModal(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Edit Team Modal ─────────────────────────────── */}
      {showEditTeamModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '380px', position: 'relative' }}>
            <button onClick={() => setShowEditTeamModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            <h3 style={{ marginBottom: '1.25rem' }}>Edit Team Name</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.3rem' }}>Team Name</label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  value={editTeamName}
                  onChange={e => setEditTeamName(e.target.value)}
                  placeholder="Team name"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button className="btn btn-outline" onClick={() => setShowEditTeamModal(false)}>Cancel</button>
                <button className="btn" onClick={saveEditTeam} disabled={savingTeamName}>{savingTeamName ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
