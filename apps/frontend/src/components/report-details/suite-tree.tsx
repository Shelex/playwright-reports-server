import { Accordion, AccordionItem, Button, Chip } from '@heroui/react';
import type { ReportFile, ReportHistory, ReportTest } from '@playwright-reports/shared';
import { useState } from 'react';
import { FailureAnalysisButton } from '@/components/analytics/FailureAnalysisButton';
import JiraTicketModal from '@/components/jira-ticket-modal';
import { testStatusToColor } from '@/lib/tailwind';
import TestInfo from './test-info';

interface SuiteNode {
  name: string;
  children: SuiteNode[];
  tests: ReportTest[];
}

function buildTestTree(rootName: string, tests: ReportTest[]): SuiteNode {
  const root: SuiteNode = { name: rootName, children: [], tests: [] };

  tests.forEach((test) => {
    const path = test.path || [];

    const noSuites = path.length === 0;

    if (noSuites) {
      root.tests.push(test);

      return;
    }

    const lastNodeIndex = path.length - 1;

    path.reduce((currentNode: SuiteNode, suiteName: string, index: number) => {
      const existingSuite = currentNode.children.find((child) => child.name === suiteName);

      const noMoreSuites = index === lastNodeIndex;

      if (noMoreSuites && existingSuite) {
        existingSuite.tests.push(test);
      }

      if (existingSuite) {
        return existingSuite;
      }

      const newSuite: SuiteNode = { name: suiteName, children: [], tests: [] };

      currentNode.children.push(newSuite);

      if (noMoreSuites) {
        newSuite.tests.push(test);
      }

      return newSuite;
    }, root);
  });

  return root;
}

interface SuiteNodeComponentProps {
  suite: SuiteNode;
  history: ReportHistory[];
  reportId?: string;
  onCreateJiraTicket: (test: ReportTest) => void;
}

const SuiteNodeComponent = ({
  suite,
  history,
  reportId,
  onCreateJiraTicket,
}: SuiteNodeComponentProps) => {
  return (
    <Accordion key={suite.name} aria-label={suite.name} selectionMode="multiple" title={suite.name}>
      {[
        ...suite.children.map((child) => (
          <AccordionItem
            key={child.name}
            aria-label={child.name}
            className="p-2"
            title={`${child.name}`}
          >
            <SuiteNodeComponent
              history={history}
              reportId={reportId}
              suite={child}
              onCreateJiraTicket={onCreateJiraTicket}
            />
          </AccordionItem>
        )),
        ...suite.tests.map((test) => {
          const status = testStatusToColor(test.outcome || 'passed');
          const isFailed = test.outcome === 'failed' || test.outcome === 'unexpected';

          return (
            <AccordionItem
              key={test.testId || 'unknown'}
              aria-label={test.title || 'Unknown test'}
              className="p-2"
              title={
                <span className="flex flex-row gap-4 flex-wrap items-center">
                  {`· ${test.title}`}
                  <Chip color={status.colorName as any} size="sm">
                    {status.title}
                  </Chip>
                  <Chip color="default" size="sm">
                    {test.projectName || 'Unknown'}
                  </Chip>
                  <div className="ml-auto flex gap-2">
                    {isFailed && (
                      <FailureAnalysisButton
                        reportId={reportId || ''}
                        testId={test.testId || 'unknown'}
                        testTitle={test.title || 'Unknown test'}
                        errorMessage={test.results?.[0]?.message}
                      />
                    )}
                    <Button
                      color="primary"
                      size="sm"
                      title="Create Jira ticket for this failed test"
                      variant="flat"
                      onPress={() => onCreateJiraTicket(test)}
                    >
                      Create Jira Ticket
                    </Button>
                  </div>
                </span>
              }
            >
              <TestInfo history={history} test={test} />
            </AccordionItem>
          );
        }),
      ]}
    </Accordion>
  );
};

interface FileSuitesTreeProps {
  file: ReportFile;
  history: ReportHistory[];
  reportId?: string;
}

const FileSuitesTree = ({ file, history, reportId }: FileSuitesTreeProps) => {
  const [selectedTest, setSelectedTest] = useState<ReportTest | null>(null);
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);

  const handleCreateJiraTicket = (test: ReportTest) => {
    setSelectedTest(test);
    setIsJiraModalOpen(true);
  };

  const suiteTree = buildTestTree(file.fileName || file.name || 'unknown', file.tests || []);

  return (
    <>
      <SuiteNodeComponent
        history={history}
        reportId={reportId}
        suite={suiteTree}
        onCreateJiraTicket={handleCreateJiraTicket}
      />

      <JiraTicketModal
        isOpen={isJiraModalOpen}
        reportId={reportId}
        test={selectedTest}
        onOpenChange={setIsJiraModalOpen}
      />
    </>
  );
};

export default FileSuitesTree;
