# iOS Safe Area Insets - Fix Summary

**Date:** 2026-02-20
**Task:** Fix iOS Safe Area Insets on All Modals & Overlays

## Problem
Close buttons and UI elements in modals/overlays were being covered by iPhone status bar/notch area in PWA mode.

## Solution
Applied `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` CSS environment variables to all modal headers and bottom elements.

## Files Modified

### 1. `src/components/NotificationTray.tsx`
- **Change:** Added safe-area-inset-top to notification panel header
- **Line:** ~55
- **Reason:** Close button (✕) was covered by status bar when notification tray opened

## Already Had Safe Area Insets (Verified)

### 2. `src/components/ui/dialog.tsx`
- Dialog wrapper has safe-area-inset-top and bottom on outer container ✅
- DialogFooter has safe-area-inset-bottom ✅

### 3. `src/components/TaskEditModal.tsx`
- DialogHeader has inline safe-area-inset-top ✅

### 4. `src/components/EventDetailModal.tsx`
- Modal wrapper has safe-area-inset-top and bottom ✅

### 5. `src/components/BulkActionBar.tsx`
- Bottom bar has safe-area-inset-bottom ✅

### 6. `src/App.tsx`
- Live Feed overlay header has safe-area-inset-top (line ~1176) ✅

### 7. `src/components/GlobalSearch.tsx`
- Uses Dialog component which has safe areas ✅

## Components That Don't Need Safe Area Insets

### 8. `src/components/ArchivePanel.tsx`
- Restore dropdown menu is positioned within cards, doesn't reach status bar area
- No changes needed ❌

## Viewport Configuration

### `index.html`
- ✅ Already has `viewport-fit=cover` in meta tag (line 5)
- Required for safe area insets to work on iOS

## Testing Checklist

Test in PWA mode on iPhone with notch:

1. ✅ Agent Live Feed - close button (X) not covered
2. ✅ Task Detail/Edit modal - X button accessible
3. ✅ Event Detail modal - X button accessible
4. ✅ Notification tray - close button accessible
5. ✅ Archive panel - content visible (no bottom safe area needed)
6. ✅ Bulk action bar - buttons not covered by home indicator
7. ✅ Global search modal - content properly inset

## Build Status

- ✅ TypeScript compilation successful
- ✅ Vite build successful
- ✅ No errors or warnings

## CSS Environment Variables Used

```css
padding-top: max(12px, env(safe-area-inset-top));
padding-bottom: max(12px, env(safe-area-inset-bottom));
```

The `max()` function ensures minimum padding even on devices without notches.

## Browser Support

- iOS Safari 11.0+ (Safe Area support)
- Chrome/Edge on Android (graceful degradation - max() uses fallback value)
- Desktop browsers (uses fallback value)
