import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Trophy, Share2, Download, AlertCircle } from 'lucide-react';

interface MatchReport {
  id: string;
  challenger_name: string;
  defender_name: string;
  winner_name: string;
  score_text: string;
  status: string;
  played_at: string;
  is_unscheduled: boolean;
}

const BANTER_TEMPLATES = [
  "{winner} skunked {loser}!",
  "What a stunning win pulled off by {winner}!",
  "{loser} needs to work harder at their game to stay on top!",
  "Absolute nail-biter! {winner} edges out {loser}.",
  "Domination! {winner} was on another level against {loser}.",
  "A clinical performance by {winner} today.",
  "Deeper training needed for {loser} after that loss to {winner}."
];

export default function PublicReport() {
  const { clubName, ladderName, date } = useParams();
  const [matches, setMatches] = useState<MatchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [clubName, ladderName, date]);

  async function loadReport() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_public_ladder_report', {
        p_club_name: decodeURIComponent(clubName || ''),
        p_ladder_name: decodeURIComponent(ladderName || ''),
        p_date: date
      });
      if (error) throw error;
      setMatches(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getBanter(match: MatchReport) {
    const winner = match.winner_name;
    const loser = match.winner_name === match.challenger_name ? match.defender_name : match.challenger_name;
    const template = BANTER_TEMPLATES[Math.floor(Math.random() * BANTER_TEMPLATES.length)];
    return template.replace('{winner}', winner).replace('{loser}', loser);
  }

  function downloadText() {
    const content = matches.map(m => {
      const line = `${m.challenger_name} vs ${m.defender_name} | Score: ${m.score_text} | Winner: ${m.winner_name} ${m.status !== 'completed' ? '(Unconfirmed)' : ''}`;
      const banter = getBanter(m);
      return `${line}\nBanter: ${banter}\n`;
    }).join('\n---\n\n');
    
    const blob = new Blob([`Match Report - ${date}\n\n${content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ladder_report_${date}.txt`;
    a.click();
  }

  if (loading) return <div className="app-container items-center" style={{ justifyContent: 'center', color: 'var(--text-light)', height: '100vh', backgroundColor: '#0f172a' }}>Generating report...</div>;

  if (error || matches.length === 0) {
    return (
      <div className="app-container items-center" style={{ justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a' }}>
        <div className="card text-center" style={{ maxWidth: 400 }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h2 className="section-title">No matches found</h2>
          <p className="text-light">We couldn't find any matches recorded for this ladder on {date}.</p>
          <a href="/" style={{ color: 'var(--primary-color)', display: 'block', marginTop: '1rem' }}>Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 1rem', maxWidth: '800px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', color: 'white', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', marginTop: '3rem', marginBottom: '3rem', width: '100%' }}>
        <h1 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'white' }}>Daily Ladder Report</h1>
        <p className="text-light">Recap of all action from {new Date(date!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>

      <div className="flex-col gap-4">
        {matches.map(match => (
          <div key={match.id} className="card" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#1e293b', borderColor: '#334155', color: 'white' }}>
            {match.status !== 'completed' && (
              <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(234, 88, 12, 0.2)', color: '#fb923c', borderBottomLeftRadius: '8px' }}>
                UNCONFIRMED
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>
                {match.challenger_name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>vs</span> {match.defender_name}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00cc66' }}>
                {match.score_text}
              </div>
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', borderLeft: '4px solid #00cc66' }}>
              <p style={{ fontSize: '1.1rem', fontStyle: 'italic', color: '#e2e8f0', lineHeight: 1.4 }}>
                "{getBanter(match)}"
              </p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center', padding: '1rem', width: '100%' }}>
        Public report for {matches[0]?.challenger_name}'s ladder action.
      </div>

      <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', gap: '1rem', width: '100%', flexWrap: 'wrap', paddingBottom: '3rem' }}>
        <button 
          onClick={downloadText} 
          className="btn" 
          style={{ 
            width: '200px',
            padding: '0.75rem 1rem',
            backgroundColor: '#334155', 
            color: 'white',
            border: '1px solid #475569',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Download size={18} /> Download (.txt)
        </button>
        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Share link copied to clipboard!');
          }} 
          className="btn" 
          style={{ 
            width: '200px',
            padding: '0.75rem 1rem',
            backgroundColor: '#00cc66', 
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Share2 size={18} /> Copy Share Link
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem', padding: '3rem 0', borderTop: '1px solid #334155', width: '100%' }}>
        <h2 className="section-title" style={{ color: 'white', justifyContent: 'center' }}>Join the Action!</h2>
        <p className="text-light mb-4" style={{ color: '#94a3b8' }}>Ready to challenge your friends and climb the ladder?</p>
        <a href="/" className="btn" style={{ textDecoration: 'none', backgroundColor: '#00cc66', color: 'white', padding: '0.75rem 2rem', borderRadius: '8px', fontWeight: 600, display: 'inline-flex' }}>Get Started</a>
      </div>
    </div>
  );
}
