import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';

import Dashboard from './pages/Dashboard';
import ClubDetails from './pages/ClubDetails';
import LadderStandings from './pages/LadderStandings';
import MatchHistory from './pages/MatchHistory';
import Login from './pages/Login';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  
  if (loading) {
    return <div className="app-container items-center" style={{ justifyContent: 'center' }}>Loading...</div>;
  }
  
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="clubs" element={<ClubDetails />} />
          <Route path="ladders" element={<LadderStandings />} />
          <Route path="matches" element={<MatchHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
