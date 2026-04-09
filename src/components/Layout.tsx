
import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { Menu, Home, Layers, Users, TrendingUp, User, X, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user } = useAuth();
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
    <div className="app-container">
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
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
