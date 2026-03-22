

export default function ClubDetails() {
  return (
    <div className="flex-col gap-6">
      <div className="flex items-center gap-4 mb-4">
        <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-color)' }}></div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Metropolitan Tennis Club</h1>
          <div className="text-light">Founded 1998 • 245 Members</div>
        </div>
      </div>

      <div className="card" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
        <div className="font-semibold mb-2" style={{ color: '#1e40af' }}>📢 Announcements</div>
        <p style={{ color: '#1e3a8a' }}>The Spring Singles Tournament starts next week! Register before Friday.</p>
      </div>

      <div className="flex gap-6 mt-4" style={{ flexWrap: 'wrap' }}>
        <div className="flex-col gap-4" style={{ flex: '2 1 400px' }}>
          <h2 className="section-title">Active Ladders</h2>
          <div className="card flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">Men's Singles</div>
              <div className="text-sm text-light">42 Players • Standard Bump Rules</div>
            </div>
            <button className="btn btn-primary">Join Ladder</button>
          </div>
          <div className="card flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">Women's Singles</div>
              <div className="text-sm text-light">28 Players • Standard Bump Rules</div>
            </div>
            <button className="btn btn-primary">Join Ladder</button>
          </div>
        </div>
        
        <div className="flex-col gap-4" style={{ flex: '1 1 250px' }}>
          <h2 className="section-title">Member Roster</h2>
          <div className="card flex-col gap-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#e2e8f0' }}></div>
                  <span className="font-semibold">Player {i}</span>
                </div>
                <span className="badge badge-blue">Advanced</span>
              </div>
            ))}
            <button className="btn btn-outline mt-4 w-full">View All Members</button>
          </div>
        </div>
      </div>
    </div>
  );
}
