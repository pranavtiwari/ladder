import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { session, signInWithGoogle } = useAuth();

  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-container items-center justify-between" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}>
      <div className="flex-col items-center justify-between" style={{ width: '100%', maxWidth: 400, margin: 'auto', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="page-title" style={{ color: 'white', fontSize: '2.5rem', marginBottom: '0.5rem' }}>RacquetClub</h1>
          <p style={{ color: '#93c5fd' }}>The modern way to manage sports ladders and club memberships.</p>
        </div>
        
        <div className="card text-center" style={{ width: '100%' }}>
          <h2 className="section-title text-dark" style={{color: 'var(--text-dark)'}}>Welcome Back</h2>
          <p className="text-light mb-4">Sign in to access your clubs and matches.</p>
          
          <button onClick={signInWithGoogle} className="btn w-full" style={{ backgroundColor: '#ffffff', color: '#333', border: '1px solid #ddd', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: 18, height: 18, marginRight: '0.5rem' }} />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
