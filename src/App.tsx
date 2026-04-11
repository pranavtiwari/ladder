import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';

import Dashboard from './pages/Dashboard';
import ClubDetails from './pages/ClubDetails';
import ClubView from './pages/ClubView';
import JoinClub from './pages/JoinClub';
import LadderView from './pages/LadderView';
import LadderStandings from './pages/LadderStandings';
import MatchHistory from './pages/MatchHistory';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Rules from './pages/Rules';
import PublicReport from './pages/PublicReport';

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
        <Route path="/reports/:clubName/:ladderName/:date" element={<PublicReport />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="clubs" element={<ClubDetails />} />
          <Route path="clubs/join" element={<JoinClub />} />
          <Route path="clubs/:id" element={<ClubView />} />
          <Route path="clubs/:id/ladders/:ladderId" element={<LadderView />} />
          <Route path="ladders" element={<LadderStandings />} />
          <Route path="matches" element={<MatchHistory />} />
          <Route path="profile" element={<Profile />} />
          <Route path="rules" element={<Rules />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
