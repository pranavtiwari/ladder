
import { ChevronUp, ChevronDown, Minus, Swords } from 'lucide-react';

export default function LadderStandings() {
  const standings = [
    { rank: 1, name: 'Alex Rivera', movement: 0, record: '15-2' },
    { rank: 2, name: 'Jordan Lee', movement: 1, record: '12-4' },
    { rank: 3, name: 'Sam Taylor', movement: -1, record: '14-5' },
    { rank: 4, name: 'You (John Doe)', movement: 2, record: '8-3', isUser: true },
    { rank: 5, name: 'Casey Smith', movement: -1, record: '9-6' },
  ];

  return (
    <div className="flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Ladder Standings</h1>
        <select className="btn btn-outline" style={{ backgroundColor: 'white' }}>
          <option>Men's Singles (Metro)</option>
          <option>Mixed Doubles (Metro)</option>
        </select>
      </div>

      <div className="flex-col gap-3">
        {standings.map((player) => (
          <div key={player.rank} className="card flex items-center justify-between" style={player.isUser ? { borderColor: 'var(--primary-color)', borderWidth: 2 } : {}}>
            <div className="flex items-center gap-4">
              <div className="font-semibold text-lg" style={{ width: 30 }}>#{player.rank}</div>
              
              <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                {player.movement > 0 ? <ChevronUp color="var(--accent-color)" size={20} /> :
                 player.movement < 0 ? <ChevronDown color="var(--danger-color)" size={20} /> :
                 <Minus color="var(--text-light)" size={20} />}
              </div>

              <div className="flex items-center gap-2">
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#e2e8f0' }}></div>
                <div>
                  <div className="font-semibold">{player.name}</div>
                  <div className="text-sm text-light">W-L: {player.record}</div>
                </div>
              </div>
            </div>

            {!player.isUser && player.rank < 4 && player.rank >= 1 && (
              <button className="btn btn-accent"><Swords size={16}/> Challenge</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
