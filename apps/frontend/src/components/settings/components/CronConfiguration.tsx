'use client';

import type { ServerConfig } from '@playwright-reports/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CronConfigurationProps {
  config: ServerConfig;
  tempConfig: ServerConfig;
  editingSection: string;
  isUpdating: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdateTempConfig: (updates: Partial<ServerConfig>) => void;
}

export default function CronConfiguration({
  config,
  tempConfig,
  editingSection,
  isUpdating,
  onEdit,
  onSave,
  onCancel,
  onUpdateTempConfig,
}: Readonly<CronConfigurationProps>) {
  return (
    <Card className="mb-6 p-4">
      <CardHeader
        className={`flex justify-between items-center flex-row ${editingSection === 'cron' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 -mx-4 px-4' : ''}`}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Cron Settings</h2>
          {editingSection === 'cron' && (
            <Badge variant="secondary" className="text-xs">
              Editing
            </Badge>
          )}
        </div>
        {editingSection !== 'cron' ? (
          <Button disabled={editingSection !== 'none'} onClick={onEdit}>
            {editingSection === 'none' ? 'Edit Configuration' : 'Section in Use'}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button disabled={isUpdating} onClick={onSave}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="result-expire-days">Result Expire Days</Label>
            <Input
              id="result-expire-days"
              disabled={editingSection !== 'cron'}
              placeholder="30"
              type="number"
              value={
                editingSection === 'cron'
                  ? tempConfig.cron?.resultExpireDays?.toString() || ''
                  : config.cron?.resultExpireDays?.toString() || ''
              }
              onChange={(e) => {
                if (editingSection === 'cron') {
                  onUpdateTempConfig({
                    cron: {
                      ...tempConfig.cron,
                      resultExpireDays: Number.parseInt(e.target.value, 10) || undefined,
                    },
                  });
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Number of days before test results are automatically deleted
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="result-expire-cron-schedule">Result Expire Cron Schedule</Label>
            <Input
              id="result-expire-cron-schedule"
              disabled={editingSection !== 'cron'}
              placeholder="0 2 * * *"
              value={
                editingSection === 'cron'
                  ? tempConfig.cron?.resultExpireCronSchedule || ''
                  : config.cron?.resultExpireCronSchedule || ''
              }
              onChange={(e) => {
                if (editingSection === 'cron') {
                  onUpdateTempConfig({
                    cron: {
                      ...tempConfig.cron,
                      resultExpireCronSchedule: e.target.value,
                    },
                  });
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Cron expression for when to run result cleanup (e.g., &quot;0 2 * * *&quot; for daily
              at 2 AM)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-expire-days">Report Expire Days</Label>
            <Input
              id="report-expire-days"
              disabled={editingSection !== 'cron'}
              placeholder="90"
              type="number"
              value={
                editingSection === 'cron'
                  ? tempConfig.cron?.reportExpireDays?.toString() || ''
                  : config.cron?.reportExpireDays?.toString() || ''
              }
              onChange={(e) => {
                if (editingSection === 'cron') {
                  onUpdateTempConfig({
                    cron: {
                      ...tempConfig.cron,
                      reportExpireDays: Number.parseInt(e.target.value, 10) || undefined,
                    },
                  });
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Number of days before test reports are automatically deleted
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-expire-cron-schedule">Report Expire Cron Schedule</Label>
            <Input
              id="report-expire-cron-schedule"
              disabled={editingSection !== 'cron'}
              placeholder="0 3 * * *"
              value={
                editingSection === 'cron'
                  ? tempConfig.cron?.reportExpireCronSchedule || ''
                  : config.cron?.reportExpireCronSchedule || ''
              }
              onChange={(e) => {
                if (editingSection === 'cron') {
                  onUpdateTempConfig({
                    cron: {
                      ...tempConfig.cron,
                      reportExpireCronSchedule: e.target.value,
                    },
                  });
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Cron expression for when to run report cleanup (e.g., &quot;0 3 * * *&quot; for daily
              at 3 AM)
            </p>
          </div>

          {editingSection === 'cron' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onUpdateTempConfig({
                  cron: {
                    resultExpireDays: 30,
                    resultExpireCronSchedule: '0 2 * * *',
                    reportExpireDays: 90,
                    reportExpireCronSchedule: '0 3 * * *',
                  },
                })
              }
            >
              Reset Cron Settings
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
