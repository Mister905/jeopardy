import type { UserStats } from '@/lib/api/types';

interface StreaksSectionProps {
  stats: UserStats;
}

export function StreaksSection({ stats }: StreaksSectionProps) {
  return (
    <section className="mb-8 p-6 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 26, 165, 0.3)', borderColor: '#00188C' }}>
      <h2 className="text-2xl font-bold mb-4 text-white">Streaks</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-white opacity-80 text-sm">Longest Correct</p>
          <p className="text-white text-2xl font-bold">{stats.longestCorrectStreak ?? 'N/A'}</p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Longest Incorrect</p>
          <p className="text-white text-2xl font-bold">{stats.longestIncorrectStreak ?? 'N/A'}</p>
        </div>
      </div>
    </section>
  );
}
