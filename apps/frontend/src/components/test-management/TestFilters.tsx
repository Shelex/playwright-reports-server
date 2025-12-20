import { Input, Select, SelectItem } from '@heroui/react';
import type { TestFilters as TestFiltersType } from '@playwright-reports/shared';

interface TestFiltersProps {
  filters: TestFiltersType;
  onFiltersChange: (filters: TestFiltersType) => void;
}

export function TestFilters({ filters, onFiltersChange }: Readonly<TestFiltersProps>) {
  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value as TestFiltersType['status'],
    });
  };

  const handleFlakinessMinChange = (value: string) => {
    const numValue = Number.parseInt(value, 10);
    const validatedValue = Number.isNaN(numValue) ? 0 : Math.min(Math.max(numValue, 0), 100);

    onFiltersChange({
      ...filters,
      flakinessMin: validatedValue,
      flakinessMax:
        filters.flakinessMax && validatedValue > filters.flakinessMax
          ? validatedValue
          : filters.flakinessMax,
    });
  };

  const handleFlakinessMaxChange = (value: string) => {
    const numValue = Number.parseInt(value, 10);
    const validatedValue = Number.isNaN(numValue) ? 100 : Math.min(Math.max(numValue, 0), 100);

    onFiltersChange({
      ...filters,
      flakinessMin:
        filters.flakinessMin && validatedValue < filters.flakinessMin
          ? validatedValue
          : filters.flakinessMin,
      flakinessMax: validatedValue,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Select
        label="Status"
        selectedKeys={filters.status ? [filters.status] : ['all']}
        onSelectionChange={(keys) => handleStatusChange(Array.from(keys)[0] as string)}
      >
        <SelectItem key="all">All Tests</SelectItem>
        <SelectItem key="not-quarantined">Not Quarantined</SelectItem>
        <SelectItem key="quarantined">Quarantined</SelectItem>
      </Select>
      <Input
        type="number"
        label="Min Flakiness (%)"
        placeholder="0"
        min={0}
        max={Math.min(filters.flakinessMax ?? 100, 100)}
        step={1}
        value={String(filters.flakinessMin || 0)}
        onChange={(e) => handleFlakinessMinChange(e.target.value)}
        labelPlacement="inside"
      />
      <Input
        type="number"
        label="Max Flakiness (%)"
        placeholder="100"
        min={Math.max(filters.flakinessMin ?? 0, 0)}
        max={100}
        step={1}
        value={String(filters.flakinessMax || 100)}
        onChange={(e) => handleFlakinessMaxChange(e.target.value)}
        labelPlacement="inside"
      />
    </div>
  );
}
