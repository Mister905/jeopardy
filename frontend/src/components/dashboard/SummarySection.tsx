import type { UserStats } from '@/lib/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import '@/styles/components/DashboardSection.scss';

interface SummarySectionProps {
  stats: UserStats;
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function SummarySection({ stats }: SummarySectionProps) {
  return (
    <Card className="dashboard-section dashboard-section--summary">
      <CardHeader>
        <CardTitle asChild>
          <h2 className="text-2xl text-white">Summary</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
