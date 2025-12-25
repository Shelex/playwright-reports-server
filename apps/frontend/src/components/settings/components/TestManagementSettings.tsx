'use client';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Slider,
  Switch,
} from '@heroui/react';

import type { ServerConfig } from '@playwright-reports/shared';

interface TestManagementSettingsProps {
  config: ServerConfig;
  tempConfig: ServerConfig;
  editingSection: string;
  isUpdating: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdateTempConfig: (updates: Partial<ServerConfig>) => void;
}

const DEFAULT_QUARANTINE_THRESHOLD = 50;
const DEFAULT_WARNING_THRESHOLD = 30;
const DEFAULT_FLAKINESS_MIN_RUNS = 5;
const DEFAULT_FLAKINESS_EVALUATION_WINDOW_DAYS = 30;

export default function TestManagementSettings({
  config,
  tempConfig,
  editingSection,
  isUpdating,
  onEdit,
  onSave,
  onCancel,
  onUpdateTempConfig,
}: Readonly<TestManagementSettingsProps>) {
  const testManagement = tempConfig.testManagement ?? {};
  const currentTestManagement = config.testManagement ?? {};

  const updateTestManagementConfig = (updates: Partial<ServerConfig['testManagement']>) => {
    onUpdateTempConfig({
      testManagement: {
        ...testManagement,
        ...updates,
      },
    });
  };

  const handleReset = () => {
    updateTestManagementConfig({
      quarantineThresholdPercentage: DEFAULT_QUARANTINE_THRESHOLD,
      warningThresholdPercentage: DEFAULT_WARNING_THRESHOLD,
      autoQuarantineEnabled: false,
      flakinessMinRuns: DEFAULT_FLAKINESS_MIN_RUNS,
      flakinessEvaluationWindowDays: DEFAULT_FLAKINESS_EVALUATION_WINDOW_DAYS,
    });
  };

  const quarantineThreshold =
    testManagement.quarantineThresholdPercentage ??
    currentTestManagement.quarantineThresholdPercentage ??
    DEFAULT_QUARANTINE_THRESHOLD;
  const warningThreshold =
    testManagement.warningThresholdPercentage ??
    currentTestManagement.warningThresholdPercentage ??
    DEFAULT_WARNING_THRESHOLD;
  const autoQuarantineEnabled =
    testManagement.autoQuarantineEnabled ?? currentTestManagement.autoQuarantineEnabled ?? false;
  const flakinessMinRuns =
    testManagement.flakinessMinRuns ??
    currentTestManagement.flakinessMinRuns ??
    DEFAULT_FLAKINESS_MIN_RUNS;
  const flakinessEvaluationWindowDays =
    testManagement.flakinessEvaluationWindowDays ??
    currentTestManagement.flakinessEvaluationWindowDays ??
    DEFAULT_FLAKINESS_EVALUATION_WINDOW_DAYS;

  return (
    <Card className="mb-6 p-4">
      <CardHeader
        className={`flex justify-between items-center ${editingSection === 'testManagement' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''}`}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Test Management</h2>
          {editingSection === 'testManagement' && (
            <Chip color="primary" size="sm" variant="flat">
              Editing
            </Chip>
          )}
        </div>
        {editingSection === 'testManagement' ? (
          <div className="flex gap-2">
            <Button color="success" isLoading={isUpdating} onPress={onSave}>
              Save Changes
            </Button>
            <Button color="default" onPress={onCancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button color="primary" isDisabled={editingSection !== 'none'} onPress={onEdit}>
            {editingSection === 'none' ? 'Edit Configuration' : 'Section in Use'}
          </Button>
        )}
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              About Test Management Settings
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Configure thresholds for test flakiness detection and automatic quarantine. Tests
              exceeding these thresholds will be flagged or quarantined based on their failure
              history.
            </p>
          </div>

          <Divider />

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="warning-threshold">
              Warning Threshold (%)
            </label>
            <div className="flex items-center gap-4">
              <Slider
                aria-label="Warning threshold percentage"
                className="flex-1"
                isDisabled={editingSection !== 'testManagement'}
                maxValue={100}
                minValue={0}
                step={1}
                value={warningThreshold}
                onChange={(value) => {
                  if (editingSection === 'testManagement') {
                    updateTestManagementConfig({ warningThresholdPercentage: value as number });
                  }
                }}
              />
              <Input
                aria-label="Warning threshold input"
                className="w-20"
                endContent={<span className="text-default-400 text-small">%</span>}
                isDisabled={editingSection !== 'testManagement'}
                max={100}
                min={0}
                type="number"
                value={warningThreshold.toString()}
                onChange={(e) => {
                  if (editingSection === 'testManagement') {
                    const value = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(value) && value >= 0 && value <= 100) {
                      updateTestManagementConfig({ warningThresholdPercentage: value });
                    }
                  }
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tests with a flakiness score at or above this percentage will be marked with a warning
              indicator.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="quarantine-threshold">
              Quarantine Threshold (%)
            </label>
            <div className="flex items-center gap-4">
              <Slider
                aria-label="Quarantine threshold percentage"
                className="flex-1"
                isDisabled={editingSection !== 'testManagement'}
                maxValue={100}
                minValue={0}
                step={1}
                value={quarantineThreshold}
                onChange={(value) => {
                  if (editingSection === 'testManagement') {
                    updateTestManagementConfig({ quarantineThresholdPercentage: value as number });
                  }
                }}
              />
              <Input
                aria-label="Quarantine threshold input"
                className="w-20"
                endContent={<span className="text-default-400 text-small">%</span>}
                isDisabled={editingSection !== 'testManagement'}
                max={100}
                min={0}
                type="number"
                value={quarantineThreshold.toString()}
                onChange={(e) => {
                  if (editingSection === 'testManagement') {
                    const value = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(value) && value >= 0 && value <= 100) {
                      updateTestManagementConfig({ quarantineThresholdPercentage: value });
                    }
                  }
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tests with a flakiness score at or above this percentage will be automatically
              quarantined (if auto-quarantine is enabled).
            </p>
          </div>

          <Divider />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Auto-Quarantine Tests</h4>
              <p className="text-xs text-gray-500 mt-1">
                Automatically quarantine tests that exceed the quarantine threshold
              </p>
            </div>
            <Switch
              aria-label="Auto-quarantine enabled"
              isDisabled={editingSection !== 'testManagement'}
              isSelected={autoQuarantineEnabled}
              onValueChange={(checked) => {
                if (editingSection === 'testManagement') {
                  updateTestManagementConfig({ autoQuarantineEnabled: checked });
                }
              }}
            />
          </div>

          <Divider />

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="flakiness-min-runs">
              Minimum Runs for Flakiness Evaluation
            </label>
            <Input
              aria-label="Minimum runs for flakiness evaluation"
              isDisabled={editingSection !== 'testManagement'}
              min={1}
              type="number"
              value={flakinessMinRuns.toString()}
              onChange={(e) => {
                if (editingSection === 'testManagement') {
                  const value = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(value) && value >= 1) {
                    updateTestManagementConfig({ flakinessMinRuns: value });
                  }
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum number of times a test must run before being evaluated for flakiness
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="flakiness-evaluation-window">
              Evaluation Window (Days)
            </label>
            <Input
              aria-label="Evaluation window in days"
              isDisabled={editingSection !== 'testManagement'}
              min={1}
              type="number"
              value={flakinessEvaluationWindowDays.toString()}
              onChange={(e) => {
                if (editingSection === 'testManagement') {
                  const value = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(value) && value >= 1) {
                    updateTestManagementConfig({ flakinessEvaluationWindowDays: value });
                  }
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of days to look back when calculating test flakiness scores
            </p>
          </div>

          {editingSection === 'testManagement' && (
            <Button color="warning" size="sm" onPress={handleReset}>
              Reset to Defaults
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
