import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Users, Lock, Unlock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ClubDetails() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubDesc, setNewClubDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadClubs();
    }
  }, [user]);

  async function loadClubs() {
    try {
      setLoading(true);
      // Fetch clubs where the user is a member
      const { data, error } = await supabase
        .from('clubs')
        .select(`
          *,
          club_members!inner(role)
        `)
        .eq('club_members.player_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClubs(data || []);
    } catch (error) {
      console.error('Error loading clubs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClub(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newClubName.trim()) return;

    try {
      setCreating(true);
      const { error } = await supabase
        .from('clubs')
        .insert({
          name: newClubName.trim(),
          description: newClubDesc.trim(),
          owner_id: user.id
        });

      if (error) throw error;

      setNewClubName('');
      setNewClubDesc('');
      setShowCreateForm(false);
      // reload clubs to see the newly created one
      await loadClubs();
    } catch (error) {
      console.error('Error creating club:', error);
      alert('Failed to create club. Please ensure you have run the updated SQL schema.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8" style={{ color: 'var(--text-light)' }}>Loading clubs...</div>;
  }

  return (
    <div className="flex-col gap-6 max-w-4xl mx-auto" style={{ width: '100%' }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title" style={{ marginBottom: 0, color: 'var(--primary-color)' }}>My Clubs</h1>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link
            to="/clubs/join"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', borderRadius: '6px',
              border: '2px solid var(--primary-color)', color: 'var(--primary-color)',
              fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none',
            }}
          >
            Browse &amp; Join Clubs
          </Link>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn flex items-center gap-2"
            style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
          >
            <Plus size={18} /> Create Club
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="card mb-6" style={{ border: '2px solid var(--primary-color)' }}>
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Create a New Club</h2>
          <form onSubmit={handleCreateClub} className="flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Club Name</label>
              <input 
                type="text" 
                required
                className="input border-gray-300" 
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                value={newClubName}
                onChange={e => setNewClubName(e.target.value)}
                placeholder="e.g. Downtown Tennis Club"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Description</label>
              <textarea 
                className="input border-gray-300" 
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: '80px', fontFamily: 'inherit' }}
                value={newClubDesc}
                onChange={e => setNewClubDesc(e.target.value)}
                placeholder="Describe your club..."
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn" 
                style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Club'}
              </button>
            </div>
          </form>
        </div>
      )}

      {clubs.length === 0 ? (
        <div className="card text-center p-12 text-gray-500" style={{ backgroundColor: '#f9fafb' }}>
          <Users size={48} className="mx-auto mb-4 opacity-40 text-gray-400" />
          <h3 className="text-xl font-medium text-gray-800 mb-2">No clubs found</h3>
          <p className="text-gray-500">You aren't a member of any clubs yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {clubs.map(club => (
            <div key={club.id} className="card flex-col justify-between hover:shadow-md transition-shadow" style={{ minHeight: '160px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-dark)' }}>{club.name}</h3>
                  <div title={club.is_private ? 'Private Club' : 'Public Club'} style={{ color: 'var(--text-light)', marginTop: '0.2rem' }}>
                    {club.is_private ? <Lock size={16} /> : <Unlock size={16} />}
                  </div>
                </div>
                <p style={{ color: 'var(--text-light)', marginBottom: '1rem', fontSize: '0.875rem', minHeight: '40px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{club.description || 'No description provided.'}</p>
              </div>
              <div className="flex justify-between items-center pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: club.club_members[0]?.role === 'admin' ? 'var(--orange-accent)' : 'var(--accent-color)',
                  textTransform: 'uppercase',
                  textShadow: `0 0 5px ${club.club_members[0]?.role === 'admin' ? 'rgba(255, 159, 28, 0.4)' : 'rgba(0, 242, 255, 0.4)'}`
                }}>
                  {club.club_members[0]?.role}
                </span>
                <Link to={`/clubs/${club.id}`} className="btn btn-outline btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', textDecoration: 'none' }}>View Club</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
