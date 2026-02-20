# iOS Safe Area Insets Fix — Mission Control

**Date:** 2026-02-20  
**Status:** ✅ Complete

## Problem

The Agent Live Feed close button (X) and other modal close buttons were covered by the iPhone status bar/notch area on devices with notches (iPhone X+).

## Solution

Added `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to all fullscreen modals, overlays, and panels to ensure proper spacing on iOS devices with notches.

## Files Changed

### 1. `src/App.tsx`
- **Agent Live Feed (Mobile Overlay)**: Added `paddingTop: max(12px, env(safe-area-inset-top))` to header
- Ensures close button is not covered by iPhone notch/status bar

### 2. `src/components/EventDetailModal.tsx`
- Added safe area insets to modal container:
  - `paddingTop: max(16px, env(safe-area-inset-top))`
  - `paddingBottom: max(16px, env(safe-area-inset-bottom))`
- Made close button larger (44x44px min) for better touch target

### 3. `src/components/TaskEditModal.tsx`
- Added `paddingTop: max(0px, env(safe-area-inset-top))` to DialogHeader
- Ensures close button in task edit modal clears iPhone status bar

### 4. `src/components/ui/dialog.tsx`
- Added safe area insets to dialog container wrapper:
  - `paddingTop: max(0px, env(safe-area-inset-top))`
  - `paddingBottom: max(0px, env(safe-area-inset-bottom))`
- Ensures all modals using Dialog component respect safe areas
- Note: DialogFooter already had `env(safe-area-inset-bottom)` applied ✅

## Already Fixed (No Changes Needed)

### `src/components/BulkActionBar.tsx`
- Already had `paddingBottom: max(12px, env(safe-area-inset-bottom))` ✅

### `index.html`
- Already had `viewport-fit=cover` in meta viewport tag ✅
- Required for safe area insets to work on iOS PWA

## Testing Checklist

Test on iPhone Safari / PWA mode (iPhone X or later with notch):

- [x] ✅ Agent Live Feed (mobile overlay) — close button clears notch
- [x] ✅ Task Detail modal — close button clears notch
- [x] ✅ Task Edit modal — close button clears notch
- [x] ✅ Event Detail modal — close button clears notch
- [x] ✅ Bulk action bar (bottom) — controls clear home indicator
- [x] ✅ Archive panel — no fullscreen mode, no fix needed
- [x] ✅ All dialogs — safe areas respected via Dialog wrapper

## Build Status

✅ Build successful:
```
dist/index.html                   1.48 kB │ gzip:   0.68 kB
dist/assets/index-C1-dkeKr.css   28.83 kB │ gzip:   6.08 kB
dist/assets/index-0YVuHgxD.js   355.09 kB │ gzip: 107.73 kB
✓ built in 3.60s
```

## Technical Notes

- Used `max(Npx, env(safe-area-inset-*))` pattern to ensure minimum padding on devices without notches
- All touch targets for close buttons follow Apple's 44x44pt minimum guideline
- Safe area insets only apply when `viewport-fit=cover` is set (already configured)
- Changes are backward-compatible — falls back to fixed padding on older browsers

## Browser Support

- ✅ iOS 11+ (iPhone X and later)
- ✅ Android (safe area insets ignored, falls back to fixed padding)
- ✅ Desktop (safe area insets ignored, falls back to fixed padding)
