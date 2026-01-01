'use client';

import { toast } from 'sonner';
import useQuery from '../hooks/useQuery';
import { buildUrl } from '../lib/url';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface TagSelectProps {
  onSelect?: (tags: string[]) => void;
  refreshId?: string;
  entity: 'result' | 'report';
  project?: string;
}

export default function TagSelect({
  refreshId,
  onSelect,
  entity,
  project,
}: Readonly<TagSelectProps>) {
  const {
    data: tags,
    error,
    isLoading,
  } = useQuery<string[]>(buildUrl(`/api/${entity}/tags`, project ? { project } : undefined), {
    dependencies: [refreshId, project],
  });

  const handleChange = (value: string) => {
    // For single select, pass as array for compatibility
    onSelect?.([value]);
  };

  error && toast.error(error.message);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="tag-select">Filter by tag</Label>
      <Select onValueChange={handleChange} disabled={!tags?.length || isLoading}>
        <SelectTrigger id="tag-select" className="w-48">
          <SelectValue placeholder="Select tag" />
        </SelectTrigger>
        <SelectContent>
          {tags?.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          )) ?? []}
        </SelectContent>
      </Select>
    </div>
  );
}
