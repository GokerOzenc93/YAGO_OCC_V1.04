import React from 'react';

export const EndpointSnapIcon: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="12" r="8" />
  </svg>
);

export const MidpointSnapIcon: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 4 L20 18 L4 18 Z" />
  </svg>
);

export const CenterSnapIcon: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="12" cy="12" r="8" />
  </svg>
);

export const QuadrantSnapIcon: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4 L12 20 M4 12 L20 12" />
  </svg>
);

export const PerpendicularSnapIcon: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M4 20 L20 4 M20 20 L14 14" />
    <rect x="13" y="13" width="2" height="2" fill="currentColor" />
  </svg>
);

export const IntersectionSnapIcon: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M4 4 L20 20 M4 20 L20 4" />
    <rect x="11" y="11" width="2" height="2" fill="currentColor" />
  </svg>
);

export const NearestSnapIcon: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9 Z" />
  </svg>
);
