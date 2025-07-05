import React from 'react';

export const Card = ({ className = '', children }) => (
  <div className={`bg-white p-4 rounded-md shadow ${className}`}>
    {children}
  </div>
);

export const CardContent = ({ children }) => (
  <div className="mt-2">
    {children}
  </div>
);