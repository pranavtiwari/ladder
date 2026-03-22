import { useState } from 'react';
import { Plus } from 'lucide-react';

export default function MatchHistory() {
  const [showModal, setShowModal] = useState(false);

  const matches = [
    { date: 'Oct 12, 2023', opponent: 'Casey Smith', result: 'Win', score: '6-4, 5-7, 7-6' },
    { date: 'Oct 05, 2023', opponent: 'Jordan Lee', result: 'Loss', score: '3-6, 4-6' },
    { date: 'Sep 28, 2023', opponent: 'Sam Taylor', result: 'Win', score: '6-2, 6-1' },
  ];

  return (
    <div className="flex-col gap-6" style={{ position: 'relative' }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Match History</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Record Match
        </button>
      </div>

      <div className="flex-col gap-3">
        {matches.map((match, idx) => (
          <div key={idx} className="card flex items-center justify-between">
            <div>
              <div className="font-semibold">{match.opponent}</div>
              <div className="text-sm text-light">{match.date}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="font-semibold text-lg">{match.score}</div>
              <span className={`badge ${match.result === 'Win' ? 'badge-green' : 'badge-red'}`}>
                {match.result}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Record Match Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, margin: '1rem' }}>
            <h2 className="section-title">Record Match Result</h2>
            <div className="flex-col gap-4 mt-4">
              <div className="flex-col gap-2">
                <label className="font-semibold text-sm">Opponent</label>
                <select className="p-2" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <option>Select opponent...</option>
                  <option>Casey Smith</option>
                  <option>Sam Taylor</option>
                </select>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-col gap-2" style={{ flex: 1 }}>
                  <label className="font-semibold text-sm">You (Sets Won)</label>
                  <input type="number" min="0" max="3" className="p-2 w-full" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }} />
                </div>
                <div className="flex-col gap-2" style={{ flex: 1 }}>
                  <label className="font-semibold text-sm">Opponent (Sets Won)</label>
                  <input type="number" min="0" max="3" className="p-2 w-full" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }} />
                </div>
              </div>

              <div className="flex-col gap-2">
                <label className="font-semibold text-sm">Match Notes (Optional)</label>
                <textarea rows={3} className="p-2 w-full" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }} placeholder="Great match!"></textarea>
              </div>

              <div className="flex gap-2 justify-between mt-4">
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => setShowModal(false)}>Submit Result</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
