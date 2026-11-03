import React from 'react';

export const BreakdownTooltip = ({ label, value, className, style }) => (
  <span
    className={`group/bar absolute top-1/2 h-4 -translate-y-1/2 rounded-sm ${className}`}
    style={style}
    aria-label={`${label}: ${value}`}
  >
    <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-gray-600 bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/bar:opacity-100">
      {label}: {value}
    </span>
  </span>
);
