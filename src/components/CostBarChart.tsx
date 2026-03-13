import * as React from 'react';
import { Card } from '@/components/ui/card';
import type { PeriodData } from '@/lib/api';

type Period = 'hour' | 'day' | 'week' | 'month';

type Props = {
  periodData: PeriodData[];
  period: Period;
};

const formatCost = (cost: number) => `$${cost.toFixed(4)}`;

const formatDate = (timestamp: number, period: Period) => {
  const date = new Date(timestamp);
  switch (period) {
    case 'hour':
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
    case 'day':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'week':
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    default:
      return date.toLocaleDateString();
  }
};

export function CostBarChart({ periodData, period }: Props) {
  const maxTotal = React.useMemo(() => {
    return periodData.reduce((max, item) => {
      const total = item.billedCost + item.anthropicCost;
      return total > max ? total : max;
    }, 0);
  }, [periodData]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Visual Trend
        </h4>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-rose-500 to-amber-500" />
            Billed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Anthropic
          </span>
        </div>
      </div>
      {periodData.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No data for this period
        </div>
      ) : (
        <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
          {periodData.map((item, index) => {
            const total = item.billedCost + item.anthropicCost;
            const barWidth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            const billedWidth = total > 0 ? (item.billedCost / total) * 100 : 0;
            const anthropicWidth = total > 0 ? (item.anthropicCost / total) * 100 : 0;
            const title = `Total ${formatCost(total)} | Billed ${formatCost(item.billedCost)} | Anthropic ${formatCost(item.anthropicCost)}`;

            return (
              <div
                key={`${item.timestamp}-${index}`}
                className="group grid grid-cols-[minmax(96px,1.1fr)_minmax(140px,3fr)_minmax(80px,1fr)] items-center gap-3 rounded-md px-2 py-2 transition hover:bg-muted/30"
                title={title}
              >
                <div className="text-xs font-medium text-muted-foreground truncate">
                  {formatDate(item.timestamp, period)}
                </div>
                <div className="flex h-4 items-center">
                  <div className="h-3 w-full rounded-full bg-muted/40">
                    <div
                      className="flex h-3 items-center overflow-hidden rounded-full"
                      style={{ width: `${barWidth}%` }}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500"
                        style={{ width: `${billedWidth}%` }}
                      />
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${anthropicWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs font-mono text-muted-foreground">
                  {formatCost(total)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
