'use client';

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
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import useQuery from '../hooks/useQuery';
import { invalidateCache } from '../lib/query-cache';
import { buildUrl, withBase } from '../lib/url';

interface UploadReportButtonProps {
  onUploadedReport?: () => void;
  label?: string;
}

export default function UploadReportButton({
  onUploadedReport,
  label = 'Upload Report',
}: Readonly<UploadReportButtonProps>) {
  const queryClient = useQueryClient();
  const session = useAuth();

  const {
    data: reportProjects,
    error: reportProjectsError,
    isLoading: isReportProjectsLoading,
  } = useQuery<string[]>(buildUrl('/api/report/projects'));

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [file, setFile] = useState<File | null>(null);
  const [project, setProject] = useState('');
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      const metadata: Record<string, string> = {};
      if (project) metadata.project = project;
      if (title) metadata.title = title;

      formData.append('metadata', JSON.stringify(metadata));
      formData.append('report', file);

      const response = await fetch(withBase('/api/report/upload'), {
        method: 'POST',
        body: formData,
        headers: {
          authorization: session.data?.user.apiToken ?? '',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error(`Upload failed: ${errorText}`);
        return;
      }

      const uploadedReport = await response.json();
      const reportId = uploadedReport.reportId;

      invalidateCache(queryClient, {
        queryKeys: ['/api/info'],
        predicate: '/api/report',
      });
      toast.success(`Report uploaded successfully: ${reportId}`);
      onUploadedReport?.();
    } catch (error) {
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleClose = () => {
    setFile(null);
    setProject('');
    setTitle('');
  };

  return (
    <>
      <Button
        color="primary"
        isLoading={isUploading}
        size="md"
        title="Upload Playwright report as ZIP file"
        variant="solid"
        onPress={onOpen}
      >
        {label}
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Upload Report</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="report-file-input">
                      Report ZIP File
                    </label>
                    <Button
                      className="justify-start border-default-200 hover:border-default-400"
                      color="primary"
                      variant="bordered"
                      onPress={handleFileButtonClick}
                    >
                      {file ? file.name : 'Choose ZIP file'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      accept=".zip"
                      className="hidden"
                      id="report-file-input"
                      type="file"
                      onChange={handleFileChange}
                    />
                  </div>
                  <Autocomplete
                    allowsCustomValue
                    errorMessage={reportProjectsError?.message}
                    inputValue={project}
                    isDisabled={isUploading}
                    isLoading={isReportProjectsLoading}
                    items={(reportProjects ?? []).map((proj) => ({
                      label: proj,
                      value: proj,
                    }))}
                    label="Project (optional)"
                    labelPlacement="outside"
                    placeholder="Enter project name"
                    variant="bordered"
                    onInputChange={(value) => setProject(value)}
                    onSelectionChange={(value) => value && setProject(value?.toString() ?? '')}
                  >
                    {(item) => <AutocompleteItem key={item.value}>{item.label}</AutocompleteItem>}
                  </Autocomplete>
                  <Input
                    errorMessage=""
                    isDisabled={isUploading}
                    label="Title (optional)"
                    labelPlacement="outside"
                    placeholder="Enter report title"
                    value={title}
                    variant="bordered"
                    onValueChange={setTitle}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  color="primary"
                  variant="light"
                  onPress={() => {
                    handleClose();
                    onClose();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isDisabled={!file}
                  isLoading={isUploading}
                  onPress={() => {
                    handleUpload();
                    handleClose();
                    onClose();
                  }}
                >
                  Upload
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
