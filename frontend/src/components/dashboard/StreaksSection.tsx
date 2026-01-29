import type { UserStats } from '@/lib/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import '@/styles/components/DashboardSection.scss';

interface StreaksSectionProps {
  stats: UserStats;
}

export function StreaksSection({ stats }: StreaksSectionProps) {
  return (
    <Card className="dashboard-section dashboard-section--streaks">
      <CardHeader>
        <CardTitle asChild>
          <h2 className="text-2xl text-white">Streaks</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
