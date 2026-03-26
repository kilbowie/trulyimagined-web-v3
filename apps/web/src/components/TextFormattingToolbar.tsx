'use client';

import { Button } from '@/components/ui/button';
import { Bold, Italic, List, ListOrdered, Quote, Code, Link as LinkIcon } from 'lucide-react';

interface TextFormattingToolbarProps {
  onFormat: (format: string, wrapper?: string) => void;
  disabled?: boolean;
}

export function TextFormattingToolbar({ onFormat, disabled }: TextFormattingToolbarProps) {
  const formatButtons = [
    { icon: Bold, format: '**', label: 'Bold' },
    { icon: Italic, format: '_', label: 'Italic' },
    { icon: Code, format: '`', label: 'Inline code' },
    { icon: Quote, format: '> ', label: 'Quote', prefix: true },
    { icon: List, format: '- ', label: 'Bullet list', prefix: true },
    { icon: ListOrdered, format: '1. ', label: 'Numbered list', prefix: true },
    { icon: LinkIcon, format: '[text](url)', label: 'Link', custom: true },
  ];

  const handleFormat = (format: string, prefix?: boolean, custom?: boolean) => {
    if (custom && format === '[text](url)') {
      onFormat('[', '](url)');
    } else if (prefix) {
      onFormat(format, '', true); // prefix mode
    } else {
      onFormat(format);
    }
  };

  return (
    <div className="flex items-center gap-1 border-b pb-2 mb-2">
      {formatButtons.map(({ icon: Icon, format, label, prefix, custom }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => handleFormat(format, prefix, custom)}
          title={label}
          className="h-8 w-8 p-0"
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}
