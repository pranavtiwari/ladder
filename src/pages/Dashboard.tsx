
import { CheckCircle, XCircle } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex-col gap-6">
      <h1 className="page-title">Dashboard</h1>
      
      {/* To-Do Widget */}
      <section className="card">
        <h2 className="section-title">Action Required</h2>
        <div className="flex-col gap-3">
          <div className="flex items-center justify-between p-4" style={{ backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div className="font-semibold">Match Challenge</div>
              <div className="text-sm text-light">Accept challenge from John Doe</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary"><CheckCircle size={16} /> Accept</button>
              <button className="btn btn-outline"><XCircle size={16} /> Decline</button>
            </div>
          </div>
          <div className="flex items-center justify-between p-4" style={{ backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div className="font-semibold">Confirm Score</div>
              <div className="text-sm text-light">Confirm result against Sarah Smith: 6-4, 5-7, 7-6</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-accent"><CheckCircle size={16} /> Confirm</button>
              <button className="btn btn-danger"><XCircle size={16} /> Dispute</button>
            </div>
          </div>
        </div>
      </section>

      {/* Grid for Clubs and Ranks */}
      <div className="flex gap-6 mt-4" style={{ flexWrap: 'wrap' }}>
        <section className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="section-title">My Clubs</h2>
          <div className="flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Metropolitan Tennis Club</span>
              <span className="badge badge-green">Member</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Downtown Squash</span>
              <span className="badge badge-gray">Pending</span>
            </div>
          </div>
        </section>

        <section className="card" style={{ flex: '1 1 300px' }}>
          <h2 className="section-title">My Ranks</h2>
          <div className="flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-light">Men's Singles (Metro)</span>
              <span className="font-semibold text-lg">#4</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-light">Mixed Doubles (Metro)</span>
              <span className="font-semibold text-lg">#12</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
