import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BaseButton } from '@/components/ui/base-button';

interface ErrorDisplayProps {
  error: string | Error;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <Alert variant="destructive" className="flex items-center justify-between gap-2">
      <AlertDescription className="flex-1">{errorMessage}</AlertDescription>
      {onDismiss && (
        <BaseButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          ×
        </BaseButton>
      )}
    </Alert>
  );
}
