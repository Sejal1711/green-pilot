import React from 'react';

export const Button = ({ children, onClick, className = '', variant = 'default' }) => {
  const baseStyle = 'px-4 py-2 rounded font-semibold';
  const variantStyle =
    variant === 'outline'
      ? 'border border-green-600 text-green-600 hover:bg-green-100'
      : 'bg-green-600 text-white hover:bg-green-700';

  return (
    <button onClick={onClick} className={`${baseStyle} ${variantStyle} ${className}`}>
      {children}
    </button>
  );
};
