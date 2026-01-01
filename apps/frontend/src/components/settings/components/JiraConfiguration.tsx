'use client';

import type { JiraConfig, ServerConfig } from '@playwright-reports/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface JiraConfigurationProps {
  config: ServerConfig;
  tempConfig: ServerConfig;
  jiraConfig?: JiraConfig;
  editingSection: string;
  isUpdating: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdateTempConfig: (updates: Partial<ServerConfig>) => void;
}

export default function JiraConfiguration({
  config,
  tempConfig,
  jiraConfig,
  editingSection,
  isUpdating,
  onEdit,
  onSave,
  onCancel,
  onUpdateTempConfig,
}: Readonly<JiraConfigurationProps>) {
  return (
    <Card className="mb-6 p-4">
      <CardHeader
        className={`flex justify-between items-center flex-row ${editingSection === 'jira' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 -mx-4 px-4' : ''}`}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Jira Integration</h2>
          {editingSection === 'jira' && (
            <Badge variant="secondary" className="text-xs">
              Editing
            </Badge>
          )}
        </div>
        {editingSection !== 'jira' ? (
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
            <Label htmlFor="jira-base-url">Jira Base URL</Label>
            <Input
              id="jira-base-url"
              disabled={editingSection !== 'jira'}
              placeholder="https://your-domain.atlassian.net"
              value={
                editingSection === 'jira'
                  ? tempConfig.jira?.baseUrl || ''
                  : config.jira?.baseUrl || ''
              }
              onChange={(e) =>
                editingSection === 'jira' &&
                onUpdateTempConfig({
                  jira: { ...tempConfig.jira, baseUrl: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jira-email">Jira Email</Label>
            <Input
              id="jira-email"
              disabled={editingSection !== 'jira'}
              placeholder="your-email@example.com"
              value={
                editingSection === 'jira' ? tempConfig.jira?.email || '' : config.jira?.email || ''
              }
              onChange={(e) =>
                editingSection === 'jira' &&
                onUpdateTempConfig({
                  jira: { ...tempConfig.jira, email: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jira-api-token">Jira API Token</Label>
            <Input
              id="jira-api-token"
              disabled={editingSection !== 'jira'}
              placeholder="Your Jira API token"
              type="password"
              value={
                editingSection === 'jira'
                  ? tempConfig.jira?.apiToken || ''
                  : config.jira?.apiToken || ''
              }
              onChange={(e) =>
                editingSection === 'jira' &&
                onUpdateTempConfig({
                  jira: { ...tempConfig.jira, apiToken: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jira-project-key">Default Project Key (Optional)</Label>
            <Input
              id="jira-project-key"
              disabled={editingSection !== 'jira'}
              placeholder="PROJECT"
              value={
                editingSection === 'jira'
                  ? tempConfig.jira?.projectKey || ''
                  : config.jira?.projectKey || ''
              }
              onChange={(e) =>
                editingSection === 'jira' &&
                onUpdateTempConfig({
                  jira: { ...tempConfig.jira, projectKey: e.target.value },
                })
              }
            />
          </div>

          <Separator />

          {/* Status Display */}
          {jiraConfig?.configured ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">
                  Configured
                </Badge>
                <span className="text-sm text-muted-foreground">Jira integration is active</span>
              </div>
              {jiraConfig.issueTypes && jiraConfig.issueTypes.length > 0 && (
                <div>
                  <span className="block text-sm font-medium mb-2">Available Issue Types</span>
                  <div className="flex flex-wrap gap-1">
                    {jiraConfig.issueTypes.map((type) => (
                      <Badge key={type.id} variant="secondary">
                        {type.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : jiraConfig?.error ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Error</Badge>
                <span className="text-sm text-muted-foreground">Jira integration failed</span>
              </div>
              <Alert variant="destructive">
                <AlertTitle>Connection Error</AlertTitle>
                <AlertDescription>{jiraConfig.error}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Not Configured</Badge>
                <span className="text-sm text-muted-foreground">
                  Jira integration is not set up
                </span>
              </div>
              <Alert>
                <AlertTitle>To enable Jira integration:</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Fill in the Jira configuration fields above and save the configuration.</p>
                  <p className="text-xs">
                    You can also set environment variables as a fallback: JIRA_BASE_URL, JIRA_EMAIL,
                    JIRA_API_TOKEN, JIRA_PROJECT_KEY
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
