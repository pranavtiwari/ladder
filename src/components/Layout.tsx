
import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Menu, Home, Layers, Users, TrendingUp, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user } = useAuth();
  const [nickname, setNickname] = useState<string>('');

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('nickname, first_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setNickname(data?.nickname || data?.first_name || '');
        });
    }
  }, [user]);

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="font-semibold text-lg" style={{ color: 'var(--primary-color)' }}>
          RacquetClub
        </div>
        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }}>
          <Menu size={20} />
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          RacquetClub
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Home size={20} /> Dashboard
          </NavLink>
          <NavLink to="/clubs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} /> My Clubs
          </NavLink>
          <NavLink to="/ladders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <TrendingUp size={20} /> Ladders
          </NavLink>
          <NavLink to="/matches" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Layers size={20} /> Matches
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <User size={20} />
            {nickname ? nickname : 'Profile'}
          </NavLink>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
