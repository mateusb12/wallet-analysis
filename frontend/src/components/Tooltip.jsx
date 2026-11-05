import React, { useRef, useState } from 'react';

export const Tooltip = ({ content, children, className = '' }) => {
  const triggerRef = useRef(null);
  const [tooltipMaxWidth, setTooltipMaxWidth] = useState(null);

  const updateTooltipWidth = () => {
    if (!triggerRef.current) return;

    const { left } = triggerRef.current.getBoundingClientRect();
    const availableRight = window.innerWidth - left - 16;
    setTooltipMaxWidth(Math.max(1, availableRight));
  };

  return (
    <span
      ref={triggerRef}
      className={`group/tooltip relative inline-flex ${className}`}
      tabIndex={0}
      onMouseEnter={updateTooltipWidth}
      onFocus={updateTooltipWidth}
    >
      {children}
      <span
        role="tooltip"
        style={tooltipMaxWidth ? { maxWidth: `${tooltipMaxWidth}px` } : undefined}
        className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 w-max max-w-[calc(100vw-1rem)] whitespace-normal rounded-md border border-gray-600 bg-gray-900 px-2.5 py-1.5 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/tooltip:opacity-100 group-focus/tooltip:opacity-100"
      >
        {content}
      </span>
    </span>
  );
};

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
