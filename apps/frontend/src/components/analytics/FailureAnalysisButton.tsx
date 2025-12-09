'use client';

import { Button, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from '@heroui/react';
import { Brain } from 'lucide-react';
import { FailureAnalysisOverlay } from './FailureAnalysisOverlay';

interface FailureAnalysisButtonProps {
  reportId: string;
  testId: string;
  testTitle: string;
  errorMessage?: string;
  failedStepIndex?: number;
}

export function FailureAnalysisButton({
  reportId,
  testId,
  testTitle,
  errorMessage,
  failedStepIndex = 0,
}: Readonly<FailureAnalysisButtonProps>) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <>
      <Button
        color="secondary"
        size="sm"
        variant="flat"
        startContent={<Brain className="h-4 w-4" />}
        onPress={onOpen}
        title="Analyze this test failure with AI"
      >
        🤖 Analyze with LLM
      </Button>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold">LLM Failure Analysis</h3>
            </div>
          </ModalHeader>
          <ModalBody className="pb-6">
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">{testTitle}</h4>
              {errorMessage && (
                <p className="text-sm text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded border">
                  {errorMessage}
                </p>
              )}
            </div>

            <FailureAnalysisOverlay
              reportId={reportId}
              testId={testId}
              testTitle={testTitle}
              failedStepIndex={failedStepIndex}
              errorMessage={errorMessage}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
