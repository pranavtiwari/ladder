import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';

// Lazy load page components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ClubDetails = lazy(() => import('./pages/ClubDetails'));
const ClubView = lazy(() => import('./pages/ClubView'));
const JoinClub = lazy(() => import('./pages/JoinClub'));
const LadderView = lazy(() => import('./pages/LadderView'));
const LadderStandings = lazy(() => import('./pages/LadderStandings'));
const MatchHistory = lazy(() => import('./pages/MatchHistory'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const Rules = lazy(() => import('./pages/Rules'));
const PublicReport = lazy(() => import('./pages/PublicReport'));

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

function LoadingFallback() {
  return (
    <div className="app-container items-center" style={{ justifyContent: 'center', height: '100vh' }}>
      <div className="loading-spinner" style={{ color: 'var(--primary-color)', fontSize: '1.2rem', fontWeight: 600 }}>
        Loading page...
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
