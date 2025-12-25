'use client';

import { Select, SelectItem, type SharedSelection } from '@heroui/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import useQuery from '../hooks/useQuery';
import { defaultProjectName } from '../lib/constants';
import { buildUrl } from '../lib/url';

interface ProjectSelectProps {
  onSelect: (project: string) => void;
  refreshId?: string;
  entity: 'result' | 'report';
  selectedProject?: string;
  className?: string;
  label?: string;
  labelPlacement?: 'inside' | 'outside' | 'outside-left';
  variant?: 'flat' | 'bordered' | 'faded' | 'underlined';
}

export default function ProjectSelect({
  refreshId,
  onSelect,
  entity,
  selectedProject,
  className = 'w-64 min-w-36 bg-transparent',
  label = 'Project',
  labelPlacement = 'outside',
  variant = 'bordered',
}: Readonly<ProjectSelectProps>) {
  const {
    data: projects,
    error,
    isLoading,
  } = useQuery<string[]>(buildUrl(`/api/${entity}/projects`), {
    dependencies: [refreshId],
  });

  const [localStorageProject, setLocalStorageProject] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const items = [defaultProjectName, ...(projects ?? [])];
  const localStorageKey = `selected-project`;

  useEffect(() => {
    if (isInitialized) return;

    try {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        const stored = localStorage.getItem(localStorageKey);
        if (!stored) {
          setIsInitialized(true);
          return;
        }

        setLocalStorageProject(stored);
        console.log(`[ProjectSelect] Loaded selected project from localStorage: ${stored}`);
      }
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
    }
    setIsInitialized(true);
  }, [isInitialized]);

  useEffect(() => {
    if (!isInitialized || !localStorageProject) return;

    try {
      if (
        !items.includes(localStorageProject) &&
        localStorageProject !== defaultProjectName &&
        !isLoading
      ) {
        console.log(
          `[ProjectSelect] localStorage project ${localStorageProject} is no longer valid, clearing it`
        );
        localStorage.removeItem(localStorageKey);
        setLocalStorageProject(null);
      }
    } catch (error) {
      console.warn('Failed to validate localStorage project:', error);
    }
  }, [localStorageProject, isInitialized, items.includes, isLoading]);

  const effectiveSelectedProject = localStorageProject || selectedProject || defaultProjectName;
  onSelect?.(effectiveSelectedProject);

  const onChange = (keys: SharedSelection) => {
    if (keys instanceof Set) {
      if (keys.has(defaultProjectName)) {
        onSelect?.(defaultProjectName);
        saveToLocalStorage(defaultProjectName);
        return;
      }

      const selectedKey = Array.from(keys)?.at(0);
      if (selectedKey) {
        const project = String(selectedKey);
        onSelect?.(project);
        saveToLocalStorage(project);
      }
      return;
    }

    if (keys === defaultProjectName) {
      onSelect?.(defaultProjectName);
      saveToLocalStorage(defaultProjectName);
      return;
    }

    if (typeof keys === 'string' || typeof keys === 'number') {
      const project = String(keys);
      onSelect?.(project);
      saveToLocalStorage(project);
    }
  };

  const saveToLocalStorage = (project: string) => {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        localStorage.setItem(localStorageKey, project);
        setLocalStorageProject(project);
      }
    } catch (error) {
      console.warn('Failed to write to localStorage:', error);
    }
  };

  error && toast.error(error.message);
  const selectedKeys = effectiveSelectedProject ? [effectiveSelectedProject] : [defaultProjectName];

  return (
    <Select
      className={className}
      selectedKeys={selectedKeys}
      isDisabled={items.length <= 1}
      isLoading={isLoading}
      label={label}
      labelPlacement={labelPlacement}
      variant={variant}
      onSelectionChange={onChange}
    >
      {items.map((project) => (
        <SelectItem key={project}>{project}</SelectItem>
      ))}
    </Select>
  );
}
