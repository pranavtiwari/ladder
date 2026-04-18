import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';

export default function ReportIssue() {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const { error: dbError } = await supabase
        .from('issues')
        .insert([
          { 
            reported_by: user?.id, 
            description 
          }
        ]);

      if (dbError) throw dbError;
      
      setSuccess(true);
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit issue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="page-title flex items-center gap-2">
        <MessageSquare size={24} className="text-primary-color" />
        Report an Issue
      </h1>

      <div className="card">
        {success ? (
          <div className="text-center py-8">
            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
            <h2 className="text-xl font-bold mb-2">Thank you!</h2>
            <p className="text-gray-600 mb-6">Your issue has been reported successfully. Our team will look into it.</p>
            <button 
              className="btn btn-primary"
              onClick={() => setSuccess(false)}
            >
              Report another issue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-gray-600 text-sm mb-2">
              Found a bug or have a suggestion? Let us know the details below and we'll look into it.
            </p>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-1">Issue Description</label>
              <textarea
                required
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue or your suggestion in detail..."
                className="input w-full resize-y"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-dark)',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full mt-2"
              disabled={submitting || !description.trim()}
            >
              {submitting ? 'Submitting...' : 'Submit Issue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
