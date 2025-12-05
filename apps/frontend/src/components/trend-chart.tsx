'use client';
import { Alert } from '@heroui/react';
import type { ReportHistory } from '@playwright-reports/shared';
import { Link } from 'react-router-dom';
import { Area, AreaChart, XAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from './ui/chart';

const chartConfig = {
  failed: {
    label: 'Failed',
    color: 'hsl(var(--chart-2))',
  },
  flaky: {
    label: 'Flaky',
    color: 'hsl(var(--chart-4))',
  },
  passed: {
    label: 'Passed',
    color: 'hsl(var(--chart-1))',
  },
  skipped: {
    label: 'Skipped',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

interface WithTotal {
  total: number;
}

interface TrendChartProps {
  reportHistory: ReportHistory[];
}

export function TrendChart({ reportHistory }: Readonly<TrendChartProps>) {
  const getPercentage = (value: number, total: number) => (value / total) * 100;

  const openInNewTab = (url: string) => {
    typeof window !== 'undefined' && window.open(url, '_blank', 'noopener,noreferrer');
  };

  const chartData = reportHistory.map((r) => ({
    date: new Date(r.createdAt).getTime(),
    passed: getPercentage(r.stats?.expected || 0, r.stats?.total || 0),
    passedCount: r.stats?.expected || 0,
    failed: getPercentage(r.stats?.unexpected || 0, r.stats?.total || 0),
    failedCount: r.stats?.unexpected || 0,
    skipped: getPercentage(r.stats?.skipped || 0, r.stats?.total || 0),
    skippedCount: r.stats?.skipped || 0,
    flaky: getPercentage(r.stats?.flaky || 0, r.stats?.total || 0),
    flakyCount: r.stats?.flaky || 0,
    total: r.stats?.total || 0,
    reportUrl: `/report/${r.reportID}`,
  }));

  return (
    <ChartContainer config={chartConfig}>
      {reportHistory.length <= 1 ? (
        <div className="flex items-center justify-center w-auto">
          <div key="warning" className="flex items-center my-3 mt-10">
            <Alert color="warning" title={`Not enough data for trend chart`} />
          </div>
        </div>
      ) : (
        <AreaChart
          accessibilityLayer
          data={chartData.reverse()}
          margin={{
            left: 12,
            right: 12,
            top: 12,
          }}
          onClick={(e) => {
            const url = e.activePayload?.at(0)?.payload?.reportUrl;

            url && openInNewTab(url);
          }}
        >
          <XAxis
            axisLine={false}
            dataKey="date"
            tickFormatter={(value: number) => {
              return new Date(value).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
            }}
            tickLine={false}
            tickMargin={10}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                className="w-[250px]"
                formatter={(value, name, item, index) => (
                  <>
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[--color-bg]"
                      style={
                        {
                          '--color-bg': `var(--color-${name})`,
                        } as React.CSSProperties
                      }
                    />
                    {chartConfig[name as keyof typeof chartConfig]?.label || name}
                    <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                      {
                        item.payload[
                          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                          `${name}Count`
                        ]
                      }{' '}
                      ({Math.round(value as number)}%)
                    </div>
                    {/* Add this after the last item */}
                    {index === 3 && (
                      <>
                        <Link to={'/'} />
                        <div className="mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium text-foreground">
                          Total
                          <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                            {(item.payload as WithTotal).total}
                            <span className="font-normal text-muted-foreground">tests</span>
                          </div>
                        </div>
                        <div className="mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium text-foreground">
                          Created At
                          <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                            {new Date(
                              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                              item.payload.date
                            ).toLocaleString()}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              />
            }
            cursor={true}
          />
          {Object.keys(chartConfig).map((key) => (
            <Area
              key={key}
              dataKey={key}
              fill={`var(--color-${key})`}
              fillOpacity={0.7}
              stackId="single"
              stroke={`var(--color-${key})`}
            />
          ))}
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      )}
    </ChartContainer>
  );
}
