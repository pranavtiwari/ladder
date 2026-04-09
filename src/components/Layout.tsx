
import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { Menu, Home, Layers, Users, TrendingUp, User, X, BookOpen, Palette } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Layout() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [nickname, setNickname] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className={`app-container theme-${theme}`}>
      {/* Mobile Header */}
      <header className="mobile-header">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--primary-color)',
            letterSpacing: '-0.3px',
          }}>
            🏸 RacquetClub
          </div>
        </Link>
        <button
          className="btn btn-outline"
          style={{ padding: '0.25rem 0.5rem' }}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile slide-down menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="mobile-menu-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav className="mobile-menu">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Home size={20} /> Dashboard
            </NavLink>
            <NavLink
              to="/clubs"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Users size={20} /> My Clubs
            </NavLink>
            <NavLink
              to="/ladders"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <TrendingUp size={20} /> Ladders
            </NavLink>
            <NavLink
              to="/matches"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Layers size={20} /> Matches
            </NavLink>
            <NavLink
              to="/profile"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <User size={20} /> {nickname ? nickname : 'Profile'}
            </NavLink>
            <NavLink
              to="/rules"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <BookOpen size={20} /> Rules & Info
            </NavLink>

            {/* Mobile Theme Selector */}
            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                <Palette size={14} /> THEME
              </div>
              <select 
                value={theme} 
                onChange={(e) => {
                  setTheme(e.target.value as any);
                  setMobileMenuOpen(false);
                }}
                className="input"
                style={{ 
                  width: '100%', 
                  padding: '0.4rem 0.6rem', 
                  fontSize: '0.85rem', 
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-dark)'
                }}
              >
                <option value="neon-court">Neon Court</option>
                <option value="glassmorphism">Glassmorphism</option>
                <option value="midnight-navy">Midnight Navy</option>
                <option value="clay-court">Clay & Hardcourt</option>
                <option value="light">Light</option>
              </select>
            </div>
          </nav>
        </>
      )}

      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <Link to="/" className="sidebar-brand" style={{ textDecoration: 'none' }}>
          🏸 RacquetClub
        </Link>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
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
          <NavLink to="/rules" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BookOpen size={20} /> Rules & Info
          </NavLink>
        </nav>

        {/* Theme Selector at Sidebar Bottom */}
        <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <Palette size={14} /> THEME
          </div>
          <select 
            value={theme} 
            onChange={(e) => setTheme(e.target.value as any)}
            className="input"
            style={{ 
              width: '100%', 
              padding: '0.4rem 0.6rem', 
              fontSize: '0.85rem', 
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-dark)'
            }}
          >
            <option value="neon-court">Neon Court</option>
            <option value="glassmorphism">Glassmorphism</option>
            <option value="midnight-navy">Midnight Navy</option>
            <option value="clay-court">Clay & Hardcourt</option>
            <option value="light">Light</option>
          </select>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
