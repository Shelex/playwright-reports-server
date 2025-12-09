'use client';

import { Button } from '@heroui/react';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface CopyButtonProps {
  content: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'ghost';
}

export function CopyButton({ content, size = 'sm', variant = 'light' }: Readonly<CopyButtonProps>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(`Failed to copy to clipboard: ${error}`);
    }
  };

  return (
    <Button
      isIconOnly
      size={size}
      variant={variant}
      onPress={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
