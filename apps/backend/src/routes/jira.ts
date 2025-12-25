import type { FastifyInstance } from 'fastify';
import { service } from '../lib/service/index.js';
import type { JiraIssueType } from '../lib/service/jira.js';
import { JiraService } from '../lib/service/jira.js';
import { withError } from '../lib/withError.js';
import { type AuthRequest, authenticate } from './auth.js';

interface CreateTicketRequest {
  summary: string;
  description: string;
  issueType: string;
  projectKey: string;
  testId: string;
  testTitle: string;
  testOutcome: string;
  testLocation: {
    file: string;
    line: number;
    column: number;
  };
  reportId: string;
  testAttachments?: Array<{
    name: string;
    path: string;
    contentType: string;
  }>;
}

export async function registerJiraRoutes(fastify: FastifyInstance) {
  fastify.get('/api/jira/config', async (_request, reply) => {
    try {
      const config = await service.getConfig();
      const jiraConfig = config.jira;

      const isConfigured = !!(jiraConfig?.baseUrl && jiraConfig?.email && jiraConfig?.apiToken);

      if (!isConfigured) {
        return reply.send({
          configured: false,
          message: 'Jira is not configured. Please configure Jira settings in the admin panel.',
          config: jiraConfig || {},
        });
      }

      const jiraService = JiraService.getInstance(jiraConfig);

      let issueTypes: JiraIssueType[] = [];

      if (jiraConfig?.projectKey) {
        try {
          const project = await jiraService.getProject(jiraConfig.projectKey);

          issueTypes = project.issueTypes || [];
        } catch (error) {
          fastify.log.warn(
            { error },
            `Could not fetch project-specific issue types for ${jiraConfig.projectKey}`
          );
        }
      }

      return reply.send({
        configured: true,
        baseUrl: jiraConfig.baseUrl,
        defaultProjectKey: jiraConfig.projectKey,
        issueTypes: issueTypes.map((type: JiraIssueType) => ({
          id: type.id,
          name: type.name,
          description: type.description,
        })),
      });
    } catch (error) {
      return reply.status(500).send({
        configured: false,
        error: `Failed to connect to Jira: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });

  fastify.post('/api/jira/create-ticket', async (request, reply) => {
    const authResult = await authenticate(request as AuthRequest, reply);
    if (authResult) return authResult;

    const { result: data, error: parseError } = await withError(Promise.resolve(request.body));

    if (parseError) {
      return reply.status(400).send({ error: parseError.message });
    }

    if (!data) {
      return reply.status(400).send({ error: 'Request data is missing' });
    }

    const ticketData = data as CreateTicketRequest;

    try {
      const report = await service.getReport(ticketData.reportId);
      const projectPath = report.project ? `${report.project}/` : '';

      ticketData.testAttachments = ticketData.testAttachments?.map((att) => ({
        ...att,
        path: `${projectPath}${ticketData.reportId}/${att.path}`,
      }));
    } catch (error) {
      fastify.log.error({ error }, `Failed to get report ${ticketData.reportId}`);
    }

    try {
      if (!ticketData.summary || !ticketData.projectKey) {
        return reply.status(400).send({
          error: 'Summary and project key are required',
        });
      }

      const config = await service.getConfig();
      const jiraService = JiraService.getInstance(config.jira);

      const jiraResponse = await jiraService.createIssue(
        ticketData.summary,
        ticketData.description,
        ticketData.issueType,
        ticketData.projectKey,
        {
          testId: ticketData.testId,
          testTitle: ticketData.testTitle,
          testOutcome: ticketData.testOutcome,
          testLocation: ticketData.testLocation,
        },
        ticketData.testAttachments
      );

      return reply.status(201).send({
        success: true,
        issueKey: jiraResponse.key,
        issueId: jiraResponse.id,
        issueUrl: jiraResponse.self,
        message: 'Jira ticket created successfully',
        data: {
          ...ticketData,
          issueKey: jiraResponse.key,
          issueId: jiraResponse.id,
          issueUrl: jiraResponse.self,
          created: new Date().toISOString(),
        },
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to create Jira ticket');

      if (error instanceof Error && error.message.includes('Jira configuration is incomplete')) {
        return reply.status(500).send({
          error:
            'Jira is not configured. Please set up JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.',
        });
      }

      return reply.status(500).send({
        error: `Failed to create Jira ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });
}
