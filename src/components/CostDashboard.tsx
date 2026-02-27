import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { getCosts, type CostData, type Agent } from '@/lib/api';
import { cn } from '@/lib/utils';

type Period = 'hour' | 'day' | 'week' | 'month';

type Props = {
  agents: Agent[];
};

export function CostDashboard({ agents }: Props) {
  const [costData, setCostData] = React.useState<CostData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<Period>('day');
  const [showAnthropic, setShowAnthropic] = React.useState(true);

  React.useEffect(() => {
    loadCostData();
  }, [period]);

  const loadCostData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCosts({ period, limit: 30 });
      setCostData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data');
    } finally {
      setLoading(false);
    }
  };

  const agentById = React.useMemo(() => {
    return agents.reduce<Record<string, Agent>>((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {});
  }, [agents]);

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Loading cost data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (!costData) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">No cost data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Today
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{formatCost(costData.summary.todayBilledCost)}</span>
            <span className="text-xs text-muted-foreground">billed</span>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            This Week
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{formatCost(costData.summary.weekBilledCost)}</span>
            <span className="text-xs text-muted-foreground">billed</span>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            This Month
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{formatCost(costData.summary.monthBilledCost)}</span>
            <span className="text-xs text-muted-foreground">billed</span>
          </div>
        </Card>
      </div>

      {/* Anthropic (Included in Max Plan) */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Anthropic Claude
            </p>
            <p className="text-xs text-muted-foreground">
              Included in $200/mo Max Plan (not billed per-request)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAnthropic(!showAnthropic)}
            className="text-xs text-primary hover:underline"
          >
            {showAnthropic ? 'Hide' : 'Show'}
          </button>
        </div>
        {showAnthropic && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Usage (All Time)</p>
              <p className="text-xl font-semibold text-emerald-400">
                {formatCost(costData.summary.totalAnthropicCost)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {(costData.summary.totalAnthropicTokens / 1_000_000).toFixed(2)}M tokens
              </p>
            </div>
            <div className="flex items-center">
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/40">
                Included in Plan
              </Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cost Over Time</h3>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Period:</label>
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="h-8 w-auto rounded-md border-border/60 bg-muted/40 px-3 text-xs"
          >
            <option value="hour">Hourly</option>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </Select>
        </div>
      </div>

      {/* Period Data Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Period
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Billed Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Anthropic (Included)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Requests
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {costData.periodData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No data for this period
                  </td>
                </tr>
              ) : (
                costData.periodData.map((item, index) => (
                  <tr key={index} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-medium">
                      {formatDate(item.timestamp, period)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCost(item.billedCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">
                      {formatCost(item.anthropicCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {item.count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Provider Breakdown */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Provider Breakdown</h3>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Requests
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {costData.providerBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No provider data
                    </td>
                  </tr>
                ) : (
                  costData.providerBreakdown.map((item, index) => (
                    <tr key={index} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.provider}</span>
                          {item.isAnthropic && (
                            <Badge variant="outline" className="text-emerald-400 border-emerald-400/40 text-[10px]">
                              Included
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-right font-mono",
                        item.isAnthropic ? "text-emerald-400" : ""
                      )}>
                        {formatCost(item.cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {(item.tokens / 1000).toFixed(1)}K
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {item.count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Agent Breakdown */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Agent Breakdown</h3>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Agent
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Billed Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Anthropic (Included)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Requests
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {costData.agentBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No agent data
                    </td>
                  </tr>
                ) : (
                  costData.agentBreakdown.map((item, index) => {
                    const agent = agentById[item.agentId];
                    return (
                      <tr key={index} className="hover:bg-muted/30 transition">
                        <td className="px-4 py-3 font-medium">
                          {agent?.name || item.agentId}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCost(item.billedCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatCost(item.anthropicCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {formatCost(item.cost)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {item.count}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Total Summary */}
      <Card className="bg-muted/30 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Total Billed (All Time)
            </p>
            <p className="text-3xl font-bold">{formatCost(costData.summary.totalBilledCost)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Anthropic Included (All Time)
            </p>
            <p className="text-3xl font-bold text-emerald-400">
              {formatCost(costData.summary.totalAnthropicCost)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(costData.summary.totalAnthropicTokens / 1_000_000).toFixed(2)}M tokens
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
