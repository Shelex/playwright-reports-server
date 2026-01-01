'use client';

import { Search, X } from 'lucide-react';
import { useCallback } from 'react';
import ProjectSelect from './project-select';
import TagSelect from './tag-select';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface TablePaginationRowProps {
  total?: number;
  rowsPerPage: number;
  setRowsPerPage: (rows: number) => void;
  setPage: (page: number) => void;
  onProjectChange: (project: string) => void;
  onSearchChange?: (search: string) => void;
  onTagsChange?: (tags: string[]) => void;
  rowPerPageOptions?: number[];
  entity: 'report' | 'result';
  selectedProject?: string;
  selectedTags?: string[];
}

const defaultRowPerPageOptions = [10, 20, 40];

export default function TablePaginationOptions({
  total,
  rowsPerPage,
  entity,
  rowPerPageOptions,
  setRowsPerPage,
  setPage,
  onProjectChange,
  onSearchChange,
  onTagsChange,
  selectedProject,
  selectedTags = [],
}: Readonly<TablePaginationRowProps>) {
  const rowPerPageItems = rowPerPageOptions ?? defaultRowPerPageOptions;

  const onRowsPerPageChange = useCallback(
    (value: string) => {
      const rows = Number(value);
      setRowsPerPage(rows);
      setPage(1);
    },
    [setPage, setRowsPerPage]
  );

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6">
      <div className="flex flex-row gap-3 w-full sm:w-auto items-center">
        <div className="relative w-full sm:w-48">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-transparent"
            placeholder="Search..."
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
        <ProjectSelect
          entity={entity}
          onSelect={onProjectChange}
          selectedProject={selectedProject}
          showLabel={false}
          label="Project"
        />
        {entity === 'result' && onTagsChange && (
          <TagSelect
            entity={entity}
            project={selectedProject}
            onSelect={onTagsChange}
          />
        )}
      </div>
      <div className="flex flex-row gap-3 w-full sm:w-auto items-center justify-between sm:justify-end">
        {entity === 'result' && selectedTags && selectedTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {selectedTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  onClick={() => {
                    const newTags = selectedTags.filter((t) => t !== tag);
                    onTagsChange?.(newTags);
                  }}
                  className="hover:bg-muted-foreground/20 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => onTagsChange?.([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Label htmlFor="rows-per-page" className="text-sm whitespace-nowrap">
            Rows per page:
          </Label>
          <Select value={rowsPerPage.toString()} onValueChange={onRowsPerPageChange}>
            <SelectTrigger id="rows-per-page" className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rowPerPageItems.map((item) => (
                <SelectItem key={item} value={item.toString()}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground text-sm whitespace-nowrap">Total: {total ?? 0}</span>
      </div>
    </div>
  );
}
