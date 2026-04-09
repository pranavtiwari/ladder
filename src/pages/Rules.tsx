import { BookOpen, Shield, Swords, TrendingUp } from 'lucide-react';

export default function Rules() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ textAlign: 'center', margin: '2rem 0' }}>
        <h1 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>How the Ladder Works</h1>
        <p style={{ color: '#6b7280', fontSize: '1.2rem' }}>Understanding rankings, challenges, and ELO</p>
      </div>

      <div className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111827', marginBottom: '1rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
          <TrendingUp size={20} color="var(--primary-color)" />
          The Bump Ladder Ranking System
        </h2>
        <div style={{ color: '#4b5563', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p>
            The Racquet Club uses a traditional <strong>Bump Ladder</strong> system. When you join a ladder, you start at the bottom. To move up, you must challenge and defeat players ranked higher than you.
          </p>
          <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #22c55e' }}>
            <strong>When a Challenger Wins:</strong><br />
            If a lower-ranked player challenges a higher-ranked player and wins, the winner takes the loser's exact rank. 
            The loser bumps down one spot, and everyone in between also shifts down by one position.
          </div>
          <div style={{ backgroundColor: '#f3f4f6', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #6b7280' }}>
            <strong>When a Defender Wins:</strong><br />
            If the higher-ranked player wins the match, the defender successfully defended their spot. No rank changes occur.
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111827', marginBottom: '1rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
          <Swords size={20} color="#ea580c" />
          Challenge Rules
        </h2>
        <ul style={{ color: '#4b5563', lineHeight: 1.6, paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Proximity Rule:</strong> You may only challenge players who are up to <strong>2 spots</strong> above or below your current rank.</li>
          <li><strong>Active Matches:</strong> A single match result must be recorded to resolve a challenge. You cannot challenge someone if you already have an active pending match with them.</li>
          <li><strong>Score Confirmation:</strong> Once a score is entered, the opponent has 24 hours to review and confirm it, otherwise it is auto-accepted.</li>
        </ul>
      </div>

      <div className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111827', marginBottom: '1rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
          <Shield size={20} color="#6366f1" />
          What roughly is ELO?
        </h2>
        <p style={{ color: '#4b5563', lineHeight: 1.6, marginBottom: '1rem' }}>
          While your actual position on the ladder determines who you can challenge, we also track an <strong>ELO Rating</strong> for fun.
        </p>
        <p style={{ color: '#4b5563', lineHeight: 1.6 }}>
          ELO is a dynamic score (starting at 800) evaluating your overall skill level compared to everyone else in the club. 
          Beating a player with a much higher ELO rewards you with more points than beating a player with a lower ELO. 
          While ELO fluctuations occur alongside ladder climbs, your official Ladder Rank is strictly determined by individual bumps.
        </p>
      </div>

      <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
        <BookOpen size={24} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.5 }} />
        Get out there and climb that ladder!
      </div>
    </div>
  );
}
