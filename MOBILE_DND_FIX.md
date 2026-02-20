# Mobile Horizontal Column Scrolling Fix

## Problem
Horizontal scrolling between columns on mobile was broken because @dnd-kit's TouchSensor was capturing touch events that should be used for native horizontal scrolling.

## Solution
Implemented **handle-only drag activation** - users can now:
- **Swipe anywhere on the board** to scroll horizontally between columns
- **Tap the grip icon** (top-right of each card) to drag cards between columns

This completely separates scroll from drag interactions.

## Changes Made

### 1. DraggableCard.tsx
- **Added drag handle (GripVertical icon)** positioned in top-right corner of each card
- **Removed `touchAction: "none"` from card wrapper** - allows native scrolling on card content
- **Applied `touchAction: "none"` only to drag handle** - prevents scrolling when grabbing handle
- **Moved DnD listeners to handle only** - drag only activates when user touches the grip icon
- **Handle is hidden during selection mode** - checkbox takes priority

### 2. App.tsx - MobileDropRow
- **Added `WebkitOverflowScrolling: "touch"`** - smooth momentum scrolling on iOS
- **Added `touchAction: "pan-x pan-y"`** - explicitly allows scrolling in both directions
- Maintains existing `overflow-x-auto` for horizontal scrolling

## Testing Checklist

### Mobile (375px width)
- [ ] Can swipe horizontally to scroll between columns
- [ ] Can tap grip icon on a card to start dragging
- [ ] Dragging a card works smoothly (no scroll interference)
- [ ] Dropping a card in a different column updates the status
- [ ] Horizontal scroll momentum works (iOS)
- [ ] Long-press on grip icon activates selection mode

### Desktop
- [ ] Grip icon visible in top-right of each card
- [ ] Can click and drag cards using grip icon
- [ ] Can drag cards between columns
- [ ] Keyboard navigation still works
- [ ] Selection mode still works (checkbox appears, grip hidden)

### Both
- [ ] Archive drop target still works
- [ ] Bulk actions still work in selection mode
- [ ] No console errors
- [ ] No TypeScript errors

## How to Test

1. **Build the project:**
   ```bash
   cd /home/node/.openclaw/code/mission-control
   npm run build
   ```

2. **Start preview server:**
   ```bash
   npm exec vite preview -- --port 3001 --host
   ```

3. **Test on mobile:**
   - Open browser DevTools
   - Toggle device toolbar (mobile viewport)
   - Set width to 375px (iPhone SE size)
   - Navigate to http://localhost:3001/mission_control/
   - Try swiping left/right between columns
   - Try dragging a card via the grip icon

4. **Test on desktop:**
   - Switch to desktop viewport
   - Verify grip icon is visible
   - Try dragging cards between columns

## Technical Details

### Why This Works
The key insight is that @dnd-kit sensors can be restricted to specific DOM elements by only attaching their event listeners to those elements. By:

1. Only attaching listeners to the handle
2. Removing `touchAction: "none"` from the card wrapper
3. Adding explicit `touchAction: "pan-x pan-y"` to the scroll container

...we allow native touch scrolling to work everywhere EXCEPT the drag handle, while drag still works perfectly when the user grabs the handle.

### TouchSensor Configuration
The existing TouchSensor configuration remains unchanged:
```typescript
useSensor(TouchSensor, {
  activationConstraint: { delay: 300, tolerance: 8 },
})
```

This 300ms delay + 8px tolerance now only applies when touching the handle, preventing accidental drags while preserving intentional ones.

## Deployment

Once tested:
1. Commit changes with message: `fix: enable mobile horizontal scroll with handle-only DnD`
2. Push to dev branch
3. Verify on staging via Tailscale URL
4. Create PR to main

## Files Changed
- `src/components/DraggableCard.tsx` - Added drag handle, removed whole-card touch blocking
- `src/App.tsx` - Added touch-action CSS to MobileDropRow
- `MOBILE_DND_FIX.md` - This documentation
