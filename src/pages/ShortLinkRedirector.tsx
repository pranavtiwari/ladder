import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

export default function ShortLinkRedirector() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function redirect() {
      if (!id) return;

      try {
        const { data, error: dbError } = await supabase
          .from('short_links')
          .select('destination')
          .eq('id', id)
          .single();

        if (dbError || !data) {
          throw new Error('Link not found or expired.');
        }

        // Redirect to the destination path
        // Destination should be a relative path like /reports/...
        navigate(data.destination, { replace: true });
      } catch (err: any) {
        console.error('Redirection error:', err);
        setError(err.message || 'Something went wrong.');
      }
    }

    redirect();
  }, [id, navigate]);

  if (error) {
    return (
      <div className="app-container items-center" style={{ justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'white' }}>
        <div className="card text-center" style={{ maxWidth: 400 }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h2 className="section-title">Invalid Link</h2>
          <p className="text-light">{error}</p>
          <a href="/" style={{ color: 'var(--primary-color)', display: 'block', marginTop: '1rem' }}>Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container items-center" style={{ justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--primary-color)' }} />
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 500 }}>Redirecting you to the report...</p>
      </div>
    </div>
  );
}
