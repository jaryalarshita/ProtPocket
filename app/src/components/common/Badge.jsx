import React from 'react';

export function Badge({ variant = 'unknown', children }) {
  const baseClasses = "inline-flex items-center justify-center text-[11px] uppercase tracking-[0.06em] rounded px-2 py-0.5 border font-body whitespace-nowrap";
  
  const variants = {
    who: "text-danger bg-danger-dim border-danger",
    undrugged: "text-accent bg-accent-dim border-accent",
    drugged: "text-text-muted bg-border-subtle border-border",
    unknown: "text-warning bg-warning-dim border-warning",
    unreviewed: "text-warning bg-warning-dim border-warning",
  };

  const variantClass = variants[variant] || variants.unknown;

  return (
    <span className={`${baseClasses} ${variantClass}`}>
      {children}
    </span>
  );
}
