import type { UserStats } from '@/lib/api/types';
import '@/styles/components/DashboardSection.scss';

interface SummarySectionProps {
  stats: UserStats;
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
  return `$${value.toLocaleString('en-US')}`;
}

export function SummarySection({ stats }: SummarySectionProps) {
  return (
    <section className="dashboard-section dashboard-section--summary">
      <h2 className="text-2xl font-bold mb-4 text-white">Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <p className="text-white opacity-80 text-sm">Games Played</p>
          <p className="text-white text-2xl font-bold">{stats.totalGamesPlayed ?? 'N/A'}</p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Average Score</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(stats.averageScore)}</p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Best Score</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(stats.bestScore)}</p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Worst Score</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(stats.worstScore)}</p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Total Winnings</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalWinnings)}</p>
        </div>
      </div>
    </section>
  );
}
