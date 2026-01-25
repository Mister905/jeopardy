import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantStyles = {
    primary: 'text-white',
    secondary: 'text-white',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  const primaryStyle =
    variant === 'primary'
      ? {
          backgroundColor: '#001AA5',
          border: '2px solid #3F3A3E',
        }
      : undefined;

  const secondaryStyle =
    variant === 'secondary'
      ? {
          backgroundColor: 'rgba(0, 24, 140, 0.4)',
          border: '2px solid #3F3A3E',
        }
      : undefined;

  const primaryHoverStyle =
    variant === 'primary'
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = '#00188C';
            }
          },
          onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.backgroundColor = '#001AA5';
          },
        }
      : {};

  const secondaryHoverStyle =
    variant === 'secondary'
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'rgba(0, 24, 140, 0.6)';
            }
          },
          onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 24, 140, 0.4)';
          },
        }
      : {};

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={primaryStyle || secondaryStyle}
      disabled={disabled}
      {...(variant === 'primary' ? primaryHoverStyle : variant === 'secondary' ? secondaryHoverStyle : {})}
      {...props}
    >
      {children}
    </button>
  );
}
