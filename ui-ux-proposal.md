# Mission Control UI/UX Improvement Proposal

**Audited by:** Patch (Subagent)  
**Date:** February 23, 2026  
**Status:** Pending Review

---

## Executive Summary

This audit reviews the entire Mission Control board UI across mobile and desktop breakpoints, identifying improvements in responsiveness, visual hierarchy, accessibility, interaction patterns, and polish. **No code changes have been made** — this is a comprehensive proposal for Davin's review before implementation.

---

## 1. Mobile Responsiveness

### Current State
- Mobile layout uses compressed horizontal rows per status with scroll rail navigation
- Breakpoint: `lg:` (1024px+) for desktop grid
- Mobile header is 2-row compact design with collapsible stats

### Issues Identified

**1.1 Inconsistent Touch Target Sizes**
- Some buttons (Stats, Feed, role pills) use `py-0.5 px-2` → ~28-32px targets
- iOS/Android accessibility guidelines recommend 44×44px minimum
- **Risk:** Mis-taps on mobile, especially for users with motor impairments

**1.2 Horizontal Scroll Ambiguity**
- Mobile uses horizontal card scrolling within each status row
- No visual indicator (gradient fade, scroll arrows) to show more cards exist off-screen
- `scrollbar-hide` class removes native scroll indicators entirely

**1.3 Mobile Column Rail Overlap**
- Column scroll rail (sticky nav) sits at `top-0` with `z-10`
- No safe-area padding for top notch on newer iPhones
- Could collide with system UI or get clipped

**1.4 Archive Panel on Mobile**
- Archive panel grid uses `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`
- On small screens (<640px), single-column archive can be cramped
- Cards are `opacity-75` by default → low contrast for older users

### Proposed Improvements

- **Touch targets:** Enforce `min-h-[44px] min-w-[44px]` on all interactive elements (buttons, pills, cards)
- **Scroll indicators:** Add subtle gradient fade or scroll-shadow on horizontal card rows to signal more content
- **Safe areas:** Wrap mobile header/footer in `env(safe-area-inset-*)` padding (already done for modals, extend to header)
- **Archive clarity:** Increase base opacity on archive cards to `opacity-85`, add hover state to `opacity-100`
- **Responsive columns:** Test `xs:grid-cols-1 sm:grid-cols-2` breakpoints for archive — may need intermediate step

---

## 2. Visual Hierarchy

### Current State
- Desktop uses 3-column layout: Agents (left) | Board (center) | Events (right)
- Column colors: backlog/done are muted, others have subtle bg tints
- Priority badges: `outline`, `default`, `warning`, `danger` variants

### Issues Identified

**2.1 Lost Elements**
- Archive button in column headers (inline) is subtle → easy to miss
- Event feed "↻" refresh button is tiny (`h-7 px-2`) and unlabeled
- Mobile "Stats" and "Feed" buttons compete visually with primary "+ New" button

**2.2 Priority Badge Contrast**
- `Badge` component uses Tailwind defaults — some variants (e.g., `outline` for `low`) are low-contrast on dark backgrounds
- No explicit color contrast testing for WCAG AA (4.5:1 for text)

**2.3 Column Visual Weight**
- "In Progress" and "Testing" have colored backgrounds (`bg-violet-500/5`, `bg-amber-500/5`)
- "Backlog" and "Done" have no background → feel "flat" or less important
- Inconsistent: some columns pop, others recede

**2.4 Modal Hierarchy**
- Task edit modal: title and description inputs look similar visually
- No clear emphasis on "title" being required vs. description optional
- Save/Delete buttons have equal visual weight (both default size)

### Proposed Improvements

- **Archive prominence:** Replace tiny inline archive icon with more visible button (or badge indicator when hovering column header)
- **Icon labels:** Add `aria-label` + tooltip or visible text for refresh button, search trigger
- **Badge contrast:** Audit all badge variants against WCAG AA — consider custom color values for `low` priority (e.g., `bg-slate-600/20 text-slate-300`)
- **Column backgrounds:** Either add subtle bg to all columns (consistency) or remove from all except active drag-over state
- **Modal emphasis:** Bold the "Title" label, add `(required)` text, or use red asterisk
- **Button hierarchy:** Make "Save" button primary (`bg-primary`), "Delete" secondary (`variant="outline"` or `variant="destructive"`)

---

## 3. Interaction Patterns

### Current State
- Drag-and-drop via `@dnd-kit` with snap-to-cursor modifier
- Multi-select: long-press (300ms) on drag handle → checkbox mode
- Bulk actions bar appears at bottom with safe-area padding
- GlobalSearch: Cmd+K shortcut, debounced API calls, arrow-key navigation

### Issues Identified

**3.1 Long-Press Confusion**
- Long-press on drag handle triggers multi-select, but users expect long-press on the *card* itself
- `onPointerDown` on handle only → inconsistent with native mobile gestures

**3.2 Shift-Click Range Select**
- Shift-click range selection is desktop-only (no equivalent on mobile)
- No visual feedback during range selection (cards don't highlight as you shift-click)

**3.3 DnD Feedback**
- Drag overlay uses `rotate-2 shadow-2xl ring-2 ring-primary/60 opacity-95`
- Good! But drop zones (columns) only show `border-primary/60 bg-primary/5` on hover
- No "insert here" indicator (e.g., horizontal line between cards)

**3.4 Search Modal Keyboard Nav**
- Arrow keys navigate flat list of results, but results are grouped by status
- Jumping between groups feels jarring (no visual separation during nav)
- Active item highlight (`bg-primary/20 ring-1 ring-primary/40`) is subtle

**3.5 Modal Escape Key**
- TaskEditModal: close button (`X`) is present, but no `onKeyDown` handler for Escape
- EventDetailModal: *does* have Escape handler
- Inconsistent UX between modals

### Proposed Improvements

- **Long-press on card:** Move long-press detection to the card wrapper, not just the handle
- **Shift-click feedback:** Animate/highlight cards as they're added to range selection
- **DnD precision:** Add insertion indicator (thin colored line) between cards when dragging within same column
- **Search nav:** Darken group headers or add separator animation as active index crosses group boundaries
- **Modal consistency:** Add Escape key handler to TaskEditModal, ensure all dialogs can be dismissed with Escape or outside-click
- **Mobile multi-select:** Add explicit "Select" toggle button in mobile header (checkbox icon) to enter/exit multi-select mode without long-press

---

## 4. Accessibility (A11y)

### Current State
- Some ARIA labels present (`aria-label="Close"`, `aria-expanded`)
- Keyboard navigation: Tab order follows DOM, Enter/Space on cards
- Focus indicators: browser defaults (thin outline)

### Issues Identified

**4.1 Missing ARIA Roles**
- `KanbanColumn`: no `role="region"` or `aria-label` → screen reader can't announce column context
- `DraggableCard`: checkbox indicator during selection mode is `pointer-events-none` (correct), but no `aria-checked` or `role="checkbox"` on the card itself

**4.2 Focus Indicators**
- No custom `:focus-visible` styling beyond Tailwind defaults
- Default browser outline is often thin (1-2px) and low-contrast
- Cards use `tabIndex={0}` but no visible focus ring

**4.3 Keyboard-Only Navigation**
- No visible skip-link ("Skip to board", "Skip to events")
- Keyboard users must tab through entire agent list to reach board
- GlobalSearch: Cmd+K shortcut is documented in UI, but no hint for screen readers

**4.4 Color-Only Information**
- Priority badges rely on color (`outline`, `warning`, `danger`) — no icon or pattern
- Column headers use emoji + color — emoji helps, but color alone conveys status (e.g., "In Progress" = violet)
- Archive panel "drop to archive" state uses `text-primary` — color-only cue

**4.5 Screen Reader Announcements**
- No live region (`aria-live`) for notifications or real-time events
- Notification tray badge shows unread count visually, but not announced when it updates
- Task move/create operations don't announce success/failure to screen readers

### Proposed Improvements

- **ARIA roles:** Add `role="region"` + `aria-label="[Status] column"` to each KanbanColumn
- **Selection state:** Add `aria-checked={isSelected}` to DraggableCard, consider `role="checkbox"` if card is selectable
- **Focus rings:** Add custom `:focus-visible` style → `ring-2 ring-primary/70 ring-offset-2 ring-offset-background` (matches design system)
- **Skip links:** Add hidden-but-accessible skip link at page top (visible on focus)
- **Priority icons:** Add small icon next to priority badge (e.g., 🔴 for critical, ⚠️ for high, ℹ️ for low)
- **Status patterns:** Use both color *and* pattern (e.g., striped bg for testing, solid for done) for color-blind users
- **Live regions:** Add `aria-live="polite"` region for toast notifications, `aria-live="assertive"` for critical errors
- **Announcements:** After DnD move or bulk action, insert hidden `aria-live` element: "Task moved to In Progress"
- **Notification count:** Update `aria-label` on bell button to include unread count ("3 unread notifications")

---

## 5. Polish (Animations, Transitions, Spacing, Typography)

### Current State
- Tailwind transitions on most hover states (`transition`, `transition-colors`)
- New event feed items animate in with `animate-in slide-in-from-top-2 fade-in duration-300`
- Modal entry/exit uses Dialog component (Radix/shadcn) — default animations

### Issues Identified

**5.1 Inconsistent Transition Durations**
- Some elements use bare `transition` (default 150ms)
- Event feed items use `duration-300` (explicit 300ms)
- No design system constant for animation timing

**5.2 Layout Shift on Hover**
- Archive panel cards add shadow on hover → can cause micro-jank
- Badge hover states change background → no `will-change` hint for GPU acceleration

**5.3 Spacing Inconsistencies**
- Card padding: `p-3` on mobile, `p-4` on desktop (not universally applied)
- Gap between columns: `gap-4` on desktop, `gap-2` on mobile rows — fine, but no documented reason
- Agent list: `space-y-2`, event feed: `space-y-4` — inconsistent vertical rhythm

**5.4 Typography Hierarchy**
- Headers use `text-xs uppercase tracking-[0.25em]` for labels — good
- But `tracking-[0.3em]` in mobile header → inconsistent tracking scale
- Font weights: `font-semibold` used everywhere — no clear distinction between primary/secondary text

**5.5 Missing Polish Opportunities**
- No micro-interaction on "+ New Task" button (e.g., pulse, scale-up on hover)
- Drag handle (`GripVertical` icon) is static — could animate on hover (shift or pulse)
- Column sort dropdown: no transition when options change
- Archive panel expand/collapse: no easing or spring animation

### Proposed Improvements

- **Animation tokens:** Define design system variables (150ms fast, 250ms medium, 400ms slow) and use consistently
- **Performance hints:** Add `will-change: transform, opacity` on hover states that animate (or use Tailwind plugin)
- **Spacing scale:** Audit all `p-*`, `gap-*`, `space-y-*` and normalize to 4/8/12/16/24px scale
- **Tracking scale:** Unify uppercase label tracking to `tracking-[0.2em]` or `tracking-wider` (avoid magic numbers)
- **Font weight scale:** Use `font-medium` for secondary text, `font-semibold` for primary, `font-bold` for emphasis (currently only semibold used)
- **Micro-interactions:**
  - "+ New Task" button: `hover:scale-105 active:scale-95 transition-transform`
  - Drag handle: `hover:opacity-70 hover:rotate-2 transition-all`
  - Column sort: `transition-all duration-200` on dropdown open
- **Archive animation:** Add `transition-[max-height] duration-300 ease-in-out` on expand/collapse (consider `framer-motion` for spring physics)
- **Card entry:** Stagger animation on initial board load (delay = index × 50ms)

---

## 6. Additional Findings

### 6.1 Color Contrast Audit (WCAG AA)
**Not tested programmatically** — recommend running Axe DevTools or Lighthouse on deployed build.
- Suspect areas: `text-muted-foreground` on `bg-card/40` (low opacity bg)
- Archive cards: `opacity-75` text may fall below 4.5:1 ratio

### 6.2 Dark Mode Only
- No light mode toggle or support
- Good for current use case, but limits accessibility for users with light sensitivity or photophobia
- **Recommendation:** Add theme toggle if user base expands

### 6.3 Mobile Landscape Orientation
- Not tested in audit (simulator only)
- Horizontal card scroll may be cramped in landscape (less vertical space)
- **Recommendation:** Test on physical devices, consider collapsing header in landscape

### 6.4 Browser Compatibility
- Uses modern CSS: `backdrop-blur`, `env(safe-area-inset-*)`, `scrollbar-hide`
- No polyfills detected
- **Recommendation:** Test on Safari 15+, Firefox ESR, Chrome 100+

---

## 7. Implementation Priority (Proposed)

### Phase 1: Critical Accessibility (1-2 days)
- Add ARIA labels to columns, cards, buttons
- Implement focus-visible rings
- Add skip links
- Fix touch target sizes

### Phase 2: Visual Hierarchy (1 day)
- Audit badge contrast, adjust colors
- Emphasize required fields in modals
- Normalize column backgrounds

### Phase 3: Interaction Polish (2 days)
- Escape key consistency across modals
- Insertion indicators for DnD
- Mobile multi-select toggle button
- Long-press on card (not just handle)

### Phase 4: Animation & Spacing (1 day)
- Define animation tokens
- Normalize spacing scale
- Add micro-interactions
- Stagger card entry

### Phase 5: Testing & Refinement (1 day)
- Run Axe/Lighthouse audits
- Test on physical mobile devices (iOS/Android)
- Cross-browser QA

**Total estimated effort:** 6-7 days (single developer)

---

## 8. Summary of Recommendations

| Area | Issues Found | Priority | Effort |
|------|--------------|----------|--------|
| **Mobile Responsiveness** | Touch targets, scroll indicators, safe areas | High | 0.5 day |
| **Visual Hierarchy** | Badge contrast, modal emphasis, column weight | Medium | 1 day |
| **Interaction Patterns** | Long-press, DnD feedback, modal consistency | High | 2 days |
| **Accessibility** | ARIA, focus rings, live regions, keyboard nav | **Critical** | 1.5 days |
| **Polish** | Animations, spacing, typography inconsistencies | Low | 1 day |
| **Testing** | Cross-browser, mobile devices, contrast audit | Medium | 1 day |

**Grand Total:** ~7 days development + QA

---

## 9. Next Steps

1. **Davin reviews this proposal** and prioritizes improvements
2. Break into granular tasks in Mission Control board
3. Implement in phases (start with Phase 1: Accessibility)
4. Deploy to staging, run automated audits (Axe, Lighthouse)
5. User acceptance testing on mobile devices
6. Iterate based on feedback

---

## Appendix: Code Examples (Proposed)

### A.1 Touch Target Enforcement
```tsx
// Before
<button className="py-0.5 px-2 text-xs">Stats</button>

// After
<button className="min-h-[44px] min-w-[44px] py-0.5 px-2 text-xs">Stats</button>
```

### A.2 ARIA Region for Column
```tsx
<KanbanColumn 
  id={status} 
  role="region" 
  aria-label={`${columnLabels[status]} tasks`}
>
  {children}
</KanbanColumn>
```

### A.3 Focus Ring Custom Style
```tsx
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      ringWidth: {
        focus: '3px',
      },
      ringColor: {
        focus: 'hsl(var(--primary) / 0.7)',
      },
    },
  },
}

// Component usage
className="focus-visible:ring-focus focus-visible:ring-focus focus-visible:ring-offset-2"
```

### A.4 Live Region for Notifications
```tsx
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  className="sr-only"
>
  {lastNotification && `New notification: ${lastNotification.title}`}
</div>
```

---

**End of Proposal**
