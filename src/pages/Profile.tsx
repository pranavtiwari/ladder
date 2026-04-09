import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, UserCircle } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    avatar_url: ''
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, nickname, avatar_url')
        .eq('id', user?.id)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          nickname: data.nickname || '',
          avatar_url: data.avatar_url || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      setMessage({ text: '', type: '' });

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          nickname: profile.nickname,
          avatar_url: profile.avatar_url
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ text: error.message || 'Failed to update profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0 || !user) {
      return;
    }
    const file = e.target.files[0];
    
    try {
      setUploadingAvatar(true);
      setMessage({ text: '', type: '' });

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatar_url = urlData.publicUrl;

      // Update local state
      setProfile({ ...profile, avatar_url });

      // Automatically persist it to profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      setMessage({ text: 'Avatar uploaded successfully!', type: 'success' });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setMessage({ text: error.message || 'Failed to upload avatar', type: 'error' });
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full" style={{ padding: '2rem' }}>
        <p style={{ color: '#6b7280' }}>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>
          My Profile
        </h1>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ flexShrink: 0, position: 'relative' }}>
            <label htmlFor="avatar_upload" style={{ cursor: 'pointer', display: 'block', position: 'relative' }}>
              {profile.avatar_url ? (
                 <img 
                   src={profile.avatar_url} 
                   alt="Avatar" 
                   style={{ height: '6rem', width: '6rem', objectFit: 'cover', borderRadius: '9999px', border: '4px solid #f3f4f6', opacity: uploadingAvatar ? 0.5 : 1 }} 
                 />
              ) : (
                 <UserCircle size={96} color="#d1d5db" style={{ opacity: uploadingAvatar ? 0.5 : 1 }} />
              )}
              {uploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '0.8rem', fontWeight: 600 }}>
                  ...
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'white', borderRadius: '50%', padding: '0.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              </div>
            </label>
            <input 
              type="file" 
              id="avatar_upload" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleUploadAvatar}
              disabled={uploadingAvatar}
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
              {profile.first_name} {profile.last_name}
            </h2>
            {profile.nickname && (
              <p style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: '0.9rem' }}>@{profile.nickname}</p>
            )}
            <p style={{ color: '#6b7280' }}>{user?.email}</p>
          </div>
        </div>

        {message.text && (
          <div style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: '0.375rem', backgroundColor: message.type === 'success' ? '#ecfdf5' : '#fef2f2', color: message.type === 'success' ? '#065f46' : '#991b1b' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={updateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label htmlFor="first_name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                value={profile.first_name}
                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                className="input border-gray-300"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              />
            </div>

            <div>
              <label htmlFor="last_name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                value={profile.last_name}
                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                className="input border-gray-300"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="nickname" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
              Nickname <span style={{ color: '#9ca3af', fontWeight: 400 }}>(public display name)</span>
            </label>
            <input
              type="text"
              id="nickname"
              value={profile.nickname}
              onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
              className="input border-gray-300"
              placeholder="e.g. Ace, Smash King…"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
            />
            <p style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#9ca3af' }}>This is how other players will see you in ladders, matches, and clubs.</p>
          </div>

          <div>
            <label htmlFor="avatar_url" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
              Avatar URL
            </label>
            <input
              type="url"
              id="avatar_url"
              value={profile.avatar_url}
              onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
              className="input border-gray-300"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
            />
          </div>


          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="submit"
              disabled={saving}
              className="btn"
              style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--primary-color)', color: 'white', opacity: saving ? 0.7 : 1 }}
            >
              <Save size={16} style={{ marginRight: '0.5rem' }} />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
