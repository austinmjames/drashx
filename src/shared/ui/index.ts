/**
 * Shared UI Public API
 * This file serves as the 'index' for the UI segment of the Shared layer.
 * Following FSD, other layers (entities, features, etc.) should only 
 * import from this file, never from internal component files directly.
 */

// Exporting placeholder types/constants for UI components 
// we will build in Phase 4 (e.g., Button, Input, Skeleton).

export const SHARED_UI_THEME = {
  borderRadius: 'rounded-lg',
  transitions: 'transition-all duration-200',
  colors: {
    primary: 'text-slate-900 dark:text-slate-100',
    secondary: 'text-slate-500 dark:text-slate-400',
    accent: 'bg-indigo-600 hover:bg-indigo-700',
  }
};

// Example of how we will export components once created:
// export { Button } from './Button/Button';
// export { Input } from './Input/Input';
// export { Card } from './Card/Card';