'use client';

import type { JiraApiResponse, ReportTest } from '@playwright-reports/shared';
import { AlertTriangle, Paperclip } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Spinner } from './ui/spinner';
import { Textarea } from './ui/textarea';

interface JiraTicketModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  test: ReportTest | null;
  reportId?: string;
}

interface JiraTicketData {
  summary: string;
  description: string;
  issueType: string;
  projectKey: string;
}

export default function JiraTicketModal({
  isOpen,
  onOpenChange,
  test,
  reportId,
}: JiraTicketModalProps) {
  const [ticketData, setTicketData] = useState<JiraTicketData>({
    summary: '',
    description: '',
    issueType: 'Bug',
    projectKey: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jiraConfig, setJiraConfig] = useState<JiraApiResponse | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    const loadJiraConfig = async () => {
      try {
        const response = await fetch('/api/jira/config');
        const config = await response.json();

        setJiraConfig(config);

        if (config.configured && config.defaultProjectKey && !ticketData.projectKey) {
          setTicketData((prev) => ({
            ...prev,
            projectKey: config.defaultProjectKey,
          }));
        }

        if (config.configured) {
          const newDefaults: Partial<JiraTicketData> = {};

          if (config.issueTypes?.length > 0 && ticketData.issueType === 'Bug') {
            newDefaults.issueType = config.issueTypes[0].name;
          }

          if (Object.keys(newDefaults).length > 0) {
            setTicketData((prev) => ({ ...prev, ...newDefaults }));
          }
        }
      } catch (error) {
        console.error('Failed to load Jira configuration:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    if (isOpen) {
      loadJiraConfig();
    }
  }, [isOpen, ticketData.issueType, ticketData.projectKey]);

  const handleSubmit = async () => {
    if (!test) return;

    setIsSubmitting(true);

    try {
      const testAttachments =
        test.attachments?.map((att) => ({
          name: att.name,
          path: att.path,
          contentType: att.contentType,
        })) || [];

      const requestData = {
        ...ticketData,
        testId: test.testId,
        testTitle: test.title,
        testOutcome: test.outcome,
        testLocation: test.location,
        testAttachments,
        reportId: reportId,
      };

      const response = await fetch('/api/jira/create-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create Jira ticket');
      }

      toast.success(`Jira ticket created: ${result.issueKey}`);
      onOpenChange(false);

      setTicketData({
        summary: '',
        description: '',
        issueType: 'Bug',
        projectKey: ticketData.projectKey, // Keep the current project key
      });
    } catch (error) {
      toast.error(
        `Failed to create Jira ticket: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateDefaultSummary = () => {
    if (!test) return '';
    return `Test Failed: ${test.title}`;
  };

  const generateDefaultDescription = () => {
    if (!test) return '';

    return `Test Failure Details
Test: ${test.title}
Project: ${test.projectName || 'Unknown'}
Location: ${test.location?.file || 'Unknown'}:${test.location?.line || 'Unknown'}
Test ID: ${test.testId || 'Unknown'}

Steps to Reproduce:
1. Run the test suite
2. Test "${test.title}" fails

Expected Behavior:
Test should pass

Actual Behavior:
Test is failing

Additional Information:
- Duration: ${test.duration || 0}ms
- Tags: ${test.tags?.join(', ') || 'None'}
- Annotations: ${test.annotations?.map((a) => a.description).join(', ') || 'None'}`;
  };

  // Auto-populate form when test changes
  if (test && (!ticketData.summary || ticketData.summary === '')) {
    setTicketData((prev) => ({
      ...prev,
      summary: generateDefaultSummary(),
      description: generateDefaultDescription(),
    }));
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Jira Ticket</DialogTitle>
          <DialogDescription>Create a Jira ticket for a failed test</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {isLoadingConfig ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Spinner size="lg" />
                <p className="text-sm text-muted-foreground mt-2">Loading Jira configuration...</p>
              </div>
            </div>
          ) : !jiraConfig?.configured ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-destructive" />
              <h3 className="text-lg font-semibold mb-2">Jira Not Configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {jiraConfig?.message || 'Jira integration is not properly configured.'}
              </p>
              <div className="bg-muted p-4 rounded-lg text-left">
                <p className="text-sm font-medium mb-2">Required Environment Variables:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• JIRA_BASE_URL</li>
                  <li>• JIRA_EMAIL</li>
                  <li>• JIRA_API_TOKEN</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Input
                  id="summary"
                  placeholder="Brief description of the issue"
                  value={ticketData.summary}
                  onChange={(e) => setTicketData((prev) => ({ ...prev, summary: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Detailed description of the issue"
                  value={ticketData.description}
                  onChange={(e) =>
                    setTicketData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="issue-type">Issue Type</Label>
                <Select
                  value={ticketData.issueType}
                  onValueChange={(value) =>
                    setTicketData((prev) => ({ ...prev, issueType: value }))
                  }
                >
                  <SelectTrigger id="issue-type">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    {jiraConfig?.issueTypes?.map((issueType) => (
                      <SelectItem key={issueType.name} value={issueType.name}>
                        {issueType.name}
                      </SelectItem>
                    )) || (
                      <>
                        <SelectItem value="Bug">Bug</SelectItem>
                        <SelectItem value="Task">Task</SelectItem>
                        <SelectItem value="Story">Story</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-key">Project Key</Label>
                <Input
                  id="project-key"
                  placeholder="e.g., PROJ"
                  value={ticketData.projectKey}
                  onChange={(e) =>
                    setTicketData((prev) => ({ ...prev, projectKey: e.target.value }))
                  }
                />
              </div>

              {test?.attachments && test.attachments.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Paperclip className="h-5 w-5 text-blue-500" />
                  <div className="text-sm">
                    <div className="font-medium text-blue-500 dark:text-blue-400">
                      {test.attachments.length} test attachment(s) will be included
                    </div>
                    <div className="text-blue-500/70 dark:text-blue-400/70">
                      {test.attachments.map((att) => att.name).join(', ')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !jiraConfig?.configured ||
              !ticketData.summary ||
              !ticketData.projectKey ||
              isSubmitting
            }
            onClick={handleSubmit}
          >
            {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
