import type { UserStats } from '@/lib/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import '@/styles/components/DashboardSection.scss';

interface AccuracySectionProps {
  stats: UserStats;
}

function formatPercentage(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

export function AccuracySection({ stats }: AccuracySectionProps) {
  return (
    <Card className="dashboard-section dashboard-section--accuracy">
      <CardHeader>
        <CardTitle asChild>
          <h2 className="text-2xl text-white">Accuracy</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-white opacity-80 text-sm">Overall Accuracy</p>
          <p className="text-white text-xl font-bold">{formatPercentage(stats.overallAccuracy)}</p>
          <p className="text-white opacity-70 text-xs mt-1">
            {stats.correctAnswerCount ?? 0} correct, {stats.incorrectAnswerCount ?? 0} incorrect
          </p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Jeopardy! Round</p>
          <p className="text-white text-xl font-bold">{formatPercentage(stats.jeopardyAccuracy)}</p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Double Jeopardy!</p>
          <p className="text-white text-xl font-bold">{formatPercentage(stats.doubleJeopardyAccuracy)}</p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Daily Doubles</p>
          <p className="text-white text-xl font-bold">{formatPercentage(stats.dailyDoubleAccuracy)}</p>
        </div>
        <div>
          <p className="text-white opacity-80 text-sm">Final Jeopardy</p>
          <p className="text-white text-xl font-bold">{formatPercentage(stats.finalJeopardyAccuracy)}</p>
        </div>
      </div>
      </CardContent>
    </Card>
  );
}
