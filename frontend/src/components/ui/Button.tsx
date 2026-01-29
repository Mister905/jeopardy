'use client';

import React from 'react';
import { BaseButton } from '@/components/ui/base-button';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

const variantMap = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
} as const;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => (
    <BaseButton
      ref={ref}
      variant={variantMap[variant] as 'default' | 'secondary' | 'destructive'}
      className={className}
      disabled={disabled}
      {...props}
    >
      {children}
    </BaseButton>
  )
);
Button.displayName = 'Button';
