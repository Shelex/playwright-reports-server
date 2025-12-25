'use client';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Select,
  SelectItem,
} from '@heroui/react';

import type { ServerConfig } from '@playwright-reports/shared';

interface LLMConfigurationProps {
  config: ServerConfig;
  tempConfig: ServerConfig;
  editingSection: string;
  isUpdating: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdateTempConfig: (updates: Partial<ServerConfig>) => void;
}

export default function LLMConfiguration({
  config,
  tempConfig,
  editingSection,
  isUpdating,
  onEdit,
  onSave,
  onCancel,
  onUpdateTempConfig,
}: Readonly<LLMConfigurationProps>) {
  const providers = [
    { key: 'openai', label: 'OpenAI' },
    { key: 'anthropic', label: 'Anthropic' },
  ];

  const isConfigured = config.llm?.baseUrl && config.llm?.apiKey;

  return (
    <Card className="mb-6 p-4">
      <CardHeader
        className={`flex justify-between items-center ${editingSection === 'llm' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''}`}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">LLM Configuration</h2>
          {editingSection === 'llm' && (
            <Chip color="primary" size="sm" variant="flat">
              Editing
            </Chip>
          )}
        </div>
        {editingSection === 'llm' ? (
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="llm-provider">
              LLM Provider
            </label>
            <Select
              id="llm-provider"
              isDisabled={editingSection !== 'llm'}
              placeholder="Select LLM provider"
              selectedKeys={
                editingSection === 'llm' && tempConfig.llm?.provider
                  ? [tempConfig.llm.provider]
                  : config.llm?.provider
                    ? [config.llm.provider]
                    : []
              }
              onSelectionChange={(keys) => {
                if (editingSection === 'llm' && keys !== 'all') {
                  const selectedKey = Array.from(keys)[0] as string;
                  onUpdateTempConfig({
                    llm: { ...tempConfig.llm, provider: selectedKey as any },
                  });
                }
              }}
            >
              {providers.map((provider) => (
                <SelectItem key={provider.key} textValue={provider.key}>
                  {provider.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="llm-base-url">
              Base URL
            </label>
            <Input
              id="llm-base-url"
              isDisabled={editingSection !== 'llm'}
              placeholder="https://api.openai.com/v1"
              value={
                editingSection === 'llm' ? tempConfig.llm?.baseUrl || '' : config.llm?.baseUrl || ''
              }
              onChange={(e) =>
                editingSection === 'llm' &&
                onUpdateTempConfig({
                  llm: { ...tempConfig.llm, baseUrl: e.target.value },
                })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="llm-api-key">
              API Key
            </label>
            <Input
              id="llm-api-key"
              isDisabled={editingSection !== 'llm'}
              placeholder="Your API key"
              type="password"
              value={
                editingSection === 'llm' ? tempConfig.llm?.apiKey || '' : config.llm?.apiKey || ''
              }
              onChange={(e) =>
                editingSection === 'llm' &&
                onUpdateTempConfig({
                  llm: { ...tempConfig.llm, apiKey: e.target.value },
                })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="llm-model">
              Model (Optional)
            </label>
            <Input
              id="llm-model"
              isDisabled={editingSection !== 'llm'}
              placeholder="gpt-4, claude-3-sonnet, etc."
              value={
                editingSection === 'llm' ? tempConfig.llm?.model || '' : config.llm?.model || ''
              }
              onChange={(e) =>
                editingSection === 'llm' &&
                onUpdateTempConfig({
                  llm: { ...tempConfig.llm, model: e.target.value },
                })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="llm-temperature">
              Temperature (0-2)
            </label>
            <Input
              id="llm-temperature"
              isDisabled={editingSection !== 'llm'}
              placeholder="0.3"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={
                editingSection === 'llm'
                  ? tempConfig.llm?.temperature?.toString() || ''
                  : config.llm?.temperature?.toString() || ''
              }
              onChange={(e) =>
                editingSection === 'llm' &&
                onUpdateTempConfig({
                  llm: {
                    ...tempConfig.llm,
                    temperature: e.target.value ? Number.parseFloat(e.target.value) : undefined,
                  },
                })
              }
            />
          </div>

          <Divider />

          {/* Status Display */}
          {isConfigured ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Chip color="success" size="sm">
                  Configured
                </Chip>
                <span className="text-sm text-gray-600">LLM integration is active</span>
              </div>
              {config.llm?.provider && (
                <div>
                  <span className="block text-sm font-medium mb-1">Provider</span>
                  <Chip size="sm" variant="flat">
                    {providers.find((p) => p.key === config.llm?.provider)?.label ||
                      config.llm.provider}
                  </Chip>
                </div>
              )}
              {config.llm?.model && (
                <div>
                  <span className="block text-sm font-medium mb-1">Model</span>
                  <Chip size="sm" variant="flat">
                    {config.llm.model}
                  </Chip>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Chip color="warning" size="sm">
                  Not Configured
                </Chip>
                <span className="text-sm text-gray-600">LLM integration is not set up</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-medium mb-2">To enable LLM integration:</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Fill in the LLM configuration fields above and save the configuration.
                </p>
                <p className="text-sm text-gray-600">
                  You can also set environment variables as a fallback: LLM_PROVIDER, LLM_BASE_URL,
                  LLM_API_KEY, LLM_MODEL, LLM_TEMPERATURE
                </p>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
