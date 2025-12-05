import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from '@heroui/react';
import type { Result } from '@playwright-reports/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import useMutation from '../hooks/useMutation';
import useQuery from '../hooks/useQuery';
import { invalidateCache } from '../lib/query-cache';

interface DeleteProjectButtonProps {
  results: Result[];
  projects: string[];
  onGeneratedReport?: () => void;
}

export default function GenerateReportButton({
  results,
  projects,
  onGeneratedReport,
}: Readonly<DeleteProjectButtonProps>) {
  const queryClient = useQueryClient();
  const [generationError, setGenerationError] = useState<string | null>(null);

  const { mutate: generateReport, isPending } = useMutation('/api/report/generate', {
    method: 'POST',
    onSuccess: (data: { reportId: string }) => {
      invalidateCache(queryClient, {
        queryKeys: ['/api/info'],
        predicate: '/api/report',
      });
      invalidateCache(queryClient, {
        queryKeys: ['/api/info'],
        predicate: '/api/result',
      });
      toast.success(`report ${data?.reportId} is generated`);
      setProjectName('');
      setCustomName('');
      setGenerationError(null);
      onClose();
      onGeneratedReport?.();
    },
    onError: (err: Error) => {
      let errorMessage = err.message;
      if (
        err.message.includes('ENOENT') ||
        err.message.includes('not found') ||
        err.message.includes('404')
      ) {
        errorMessage =
          'One or more selected results were not found. Please refresh the page and try again.';
      } else if (err.message.includes('ResultID not found')) {
        errorMessage =
          'Some selected results no longer exist. Please refresh the page and select valid results.';
      }

      setGenerationError(errorMessage);
    },
  });

  const {
    data: resultProjects,
    error: resultProjectsError,
    isLoading: isResultProjectsLoading,
  } = useQuery<string[]>(`/api/result/projects`);

  const [projectName, setProjectName] = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    !projectName && setProjectName(projects?.at(0) ?? '');
  }, [projects, projectName]);

  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();

  const handleModalOpen = () => {
    setGenerationError(null);
    onOpen();
  };

  const GenerateReport = async () => {
    if (!results?.length) {
      return;
    }

    setGenerationError(null);

    const validResults = results.filter((r) => r.resultID && r.resultID.trim() !== '');
    if (validResults.length !== results.length) {
      setGenerationError('Some selected results are invalid or missing IDs');
      return;
    }

    const resultIds = validResults.map((r) => r.resultID);
    generateReport({
      body: { resultsIds: resultIds, project: projectName, title: customName },
    });
  };

  return (
    <>
      <Button
        color="primary"
        isDisabled={!results?.length}
        isLoading={isPending}
        size="md"
        onPress={handleModalOpen}
      >
        Generate Report
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Generate report</ModalHeader>
              <ModalBody>
                {generationError ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-danger font-semibold">Report generation failed:</p>
                    <pre className="bg-danger-50 border border-danger-200 rounded-lg p-4 text-sm text-danger-700 font-mono whitespace-pre-wrap break-words overflow-auto max-h-96 select-text">
                      {generationError}
                    </pre>
                  </div>
                ) : (
                  <>
                    <Autocomplete
                      allowsCustomValue
                      errorMessage={resultProjectsError?.message}
                      inputValue={projectName}
                      isDisabled={isPending}
                      isLoading={isResultProjectsLoading}
                      items={Array.from(new Set([...projects, ...(resultProjects ?? [])])).map(
                        (project) => ({
                          label: project,
                          value: project,
                        })
                      )}
                      label="Project name"
                      labelPlacement="outside"
                      placeholder="leave empty if not required"
                      variant="bordered"
                      onInputChange={(value) => setProjectName(value)}
                      onSelectionChange={(value) =>
                        value && setProjectName(value?.toString() ?? '')
                      }
                    >
                      {(item) => <AutocompleteItem key={item.value}>{item.label}</AutocompleteItem>}
                    </Autocomplete>
                    <Input
                      fullWidth
                      isClearable
                      label="Custom report name"
                      labelPlacement="outside"
                      maxLength={36}
                      placeholder="leave empty if not required"
                      value={customName}
                      variant="bordered"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCustomName(e.target.value ?? '')
                      }
                      onClear={() => setCustomName('')}
                    />
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="primary" isDisabled={isPending} variant="light" onPress={onClose}>
                  Close
                </Button>
                {!generationError && (
                  <Button
                    color="primary"
                    isLoading={isPending}
                    type="submit"
                    onPress={GenerateReport}
                  >
                    Generate
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
