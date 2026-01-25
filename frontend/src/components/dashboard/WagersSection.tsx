import type { UserStats } from '@/lib/api/types';

interface WagersSectionProps {
  stats: UserStats;
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
  return `$${value.toLocaleString('en-US')}`;
}

export function WagersSection({ stats }: WagersSectionProps) {
  return (
    <section className="mb-8 p-6 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 26, 165, 0.3)', borderColor: '#00188C' }}>
      <h2 className="text-2xl font-bold mb-4 text-white">Largest Wagers</h2>
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
    </section>
  );
}
