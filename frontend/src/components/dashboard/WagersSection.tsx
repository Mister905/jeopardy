import type { UserStats } from '@/lib/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import '@/styles/components/DashboardSection.scss';

interface WagersSectionProps {
  stats: UserStats;
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function WagersSection({ stats }: WagersSectionProps) {
  return (
    <Card className="dashboard-section dashboard-section--wagers">
      <CardHeader>
        <CardTitle asChild>
          <h2 className="text-2xl text-white">Largest Wagers</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-white">Daily Doubles</h3>
          <div className="space-y-2">
            <div>
              <p className="text-white opacity-80 text-sm">Largest Successful</p>
              <p className="text-white text-xl font-bold">{formatCurrency(stats.largestSuccessfulDailyDoubleWager)}</p>
            </div>
            <div>
              <p className="text-white opacity-80 text-sm">Largest Unsuccessful</p>
              <p className="text-white text-xl font-bold">{formatCurrency(stats.largestUnsuccessfulDailyDoubleWager)}</p>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2 text-white">Final Jeopardy</h3>
          <div className="space-y-2">
            <div>
              <p className="text-white opacity-80 text-sm">Largest Successful</p>
              <p className="text-white text-xl font-bold">{formatCurrency(stats.largestSuccessfulFinalJeopardyWager)}</p>
            </div>
            <div>
              <p className="text-white opacity-80 text-sm">Largest Unsuccessful</p>
              <p className="text-white text-xl font-bold">{formatCurrency(stats.largestUnsuccessfulFinalJeopardyWager)}</p>
            </div>
          </div>
        </div>
      </div>
      </CardContent>
    </Card>
  );
}
