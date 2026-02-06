import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BaseButton } from '@/components/ui/base-button';

interface ErrorDisplayProps {
  error: string | Error;
  onDismiss?: () => void;
  /** Optional action button (e.g. "Sign in again") */
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorDisplay({
  error,
  onDismiss,
  actionLabel,
  onAction,
}: ErrorDisplayProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <Alert variant="destructive" className="flex items-center justify-between gap-2">
      <AlertDescription className="flex-1">{errorMessage}</AlertDescription>
      {actionLabel && onAction && (
        <BaseButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAction}
          aria-label={actionLabel}
          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {actionLabel}
        </BaseButton>
      )}
      {onDismiss && !actionLabel && (
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
