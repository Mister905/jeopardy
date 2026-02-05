import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BaseButton } from '@/components/ui/base-button';

interface ErrorDisplayProps {
  error: string | Error;
  onDismiss?: () => void;
  /** Optional primary action (e.g. "Sign in again") */
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
    <Alert variant="destructive" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <AlertDescription className="flex-1">{errorMessage}</AlertDescription>
      <div className="flex items-center gap-2 shrink-0">
        {actionLabel && onAction && (
          <BaseButton
            type="button"
            variant="default"
            size="sm"
            onClick={onAction}
            aria-label={actionLabel}
          >
            {actionLabel}
          </BaseButton>
        )}
        {onDismiss && (
          <BaseButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            ×
          </BaseButton>
        )}
      </div>
    </Alert>
  );
}
