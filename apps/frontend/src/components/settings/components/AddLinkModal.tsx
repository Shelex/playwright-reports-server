'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddLinkModalProps {
  isOpen: boolean;
  newLinkData: { name: string; url: string };
  onAddLink: () => void;
  onCancel: () => void;
  onUpdateLinkData: (data: { name: string; url: string }) => void;
}

export default function AddLinkModal({
  isOpen,
  newLinkData,
  onAddLink,
  onCancel,
  onUpdateLinkData,
}: Readonly<AddLinkModalProps>) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Header Link</DialogTitle>
          <DialogDescription>Add a new link to the header navigation</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="link-name">Link Name</Label>
            <Input
              id="link-name"
              placeholder="e.g., github, telegram, discord"
              value={newLinkData.name}
              onChange={(e) => onUpdateLinkData({ ...newLinkData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={newLinkData.url}
              onChange={(e) => onUpdateLinkData({ ...newLinkData, url: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onAddLink} disabled={!newLinkData.name || !newLinkData.url}>
            Add Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
