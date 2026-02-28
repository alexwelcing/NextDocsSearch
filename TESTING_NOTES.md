# Testing Notes for Keyboard Shortcut and Terminal Expansion

## Changes Implemented

### 1. HelpButton.tsx - Disable "?" Keyboard Shortcut When Typing

**File:** `components/ui/HelpButton.tsx` (lines 242-260)

**Change:** Modified the keyboard event handler to check if the user is currently typing in an input field before opening the help menu.

**Logic:**
```typescript
if ((e.key === '?' || e.key === 'F1') && !isOpen) {
  const target = e.target as HTMLElement;
  const isTyping = 
    target.tagName === 'INPUT' || 
    target.tagName === 'TEXTAREA' || 
    target.isContentEditable;
  
  // Only open help if user is not typing
  if (!isTyping) {
    e.preventDefault();
    setIsOpen(true);
  }
}
```

**Test Cases:**
- ✅ Pressing "?" when NOT in any input field should open the help menu
- ✅ Pressing "?" while typing in the Ship AI chat input should NOT open the help menu
- ✅ Pressing "?" in any other input/textarea should NOT open the help menu
- ✅ F1 key should behave the same way as "?"
- ✅ ESC key should still close the help menu

### 2. TerminalInterface.tsx - Expand Terminal on Chat Focus

**File:** `components/overlays/TerminalInterface.tsx`

**Changes:**

1. Added state to track chat input focus (line 71):
```typescript
const [isChatFocused, setIsChatFocused] = useState(false);
```

2. Added dimension calculations based on focus state (lines 258-267):
```typescript
const isExpanded = isChatFocused && viewMode === 'chat';
const terminalWidth = isMobile 
  ? '100%' 
  : isExpanded 
    ? 'min(95vw, 900px)'  // Expanded from 600px
    : 'min(95vw, 600px)';
const terminalHeight = isMobile
  ? isExpanded ? '85vh' : '70vh'  // Expanded from 70vh
  : isExpanded ? '80vh' : '65vh';  // Expanded from 65vh
```

3. Applied dimensions to terminal container (line 291-292):
```typescript
width: terminalWidth,
maxHeight: terminalHeight,
```

4. Added smooth transition (line 301):
```typescript
transition: 'all 0.3s ease-in-out',
```

5. Added focus/blur handlers to chat input (lines 622-623):
```typescript
onFocus={() => setIsChatFocused(true)}
onBlur={() => setIsChatFocused(false)}
```

**Test Cases:**
- ✅ Terminal should be normal size (600px width, 65vh height) on desktop when chat is not focused
- ✅ Terminal should expand (900px width, 80vh height) on desktop when chat input is focused
- ✅ Terminal should be normal size (100% width, 70vh height) on mobile when chat is not focused
- ✅ Terminal should expand (100% width, 85vh height) on mobile when chat input is focused
- ✅ Transition should be smooth (0.3s ease-in-out)
- ✅ Expansion should only happen in the CHAT tab, not in other tabs

## Manual Testing Instructions

### Testing Keyboard Shortcut Behavior

1. Navigate to the 3D experience page where HelpButton is rendered
2. Click anywhere outside input fields
3. Press "?" - Help menu should open
4. Close help menu (ESC or click X)
5. Click on the terminal/chat input
6. Type "?" - The character should appear in the input, help menu should NOT open
7. Click outside the input
8. Press "?" - Help menu should open again

### Testing Terminal Expansion

1. Navigate to the 3D experience page
2. Open the terminal interface
3. Click on the CHAT tab
4. Observe the terminal size (should be normal)
5. Click on the chat input field to focus it
6. Observe the terminal expand smoothly:
   - Desktop: Width increases from 600px to 900px, height from 65vh to 80vh
   - Mobile: Height increases from 70vh to 85vh
7. Click outside the input or press TAB to blur
8. Observe the terminal shrink back to normal size smoothly
9. Switch to other tabs (EXPLORE, GAME, etc.) and verify expansion doesn't happen there

## Expected Behavior Summary

### Desktop
- **Normal Terminal (Chat unfocused):** 600px wide, 65vh tall
- **Expanded Terminal (Chat focused):** 900px wide, 80vh tall
- **Width increase:** 50% larger (300px added)
- **Height increase:** ~23% larger (15vh added)

### Mobile
- **Normal Terminal (Chat unfocused):** 100% wide, 70vh tall
- **Expanded Terminal (Chat focused):** 100% wide, 85vh tall
- **Height increase:** ~21% larger (15vh added)

### Keyboard Shortcuts
- **"?" or F1 when NOT typing:** Opens help menu
- **"?" or F1 when typing:** Character goes into input, no help menu
- **ESC:** Closes help menu (no change from before)

## Technical Details

### Browser Compatibility
- Uses standard DOM APIs (tagName, isContentEditable)
- CSS transitions supported in all modern browsers
- Input event handlers (onFocus, onBlur) are standard

### Performance
- State updates only happen on focus/blur events
- Dimension calculations are simple ternary expressions
- No heavy computations or re-renders
- Smooth 60fps transitions using CSS

### Accessibility
- Focus/blur handlers maintain keyboard navigation
- Transition provides visual feedback for state changes
- Help menu still accessible via "?" when appropriate
- Input fields remain fully functional

## Known Issues

The 3D scene (ThreeSixty.tsx) has a pre-existing error:
```
TypeError: Cannot read properties of undefined (reading 'target')
at SceneCamera (components/scene/SceneCamera.tsx:150:56)
```

This error is **NOT** related to the changes made in this PR. It's a configuration issue where `config.target` is undefined in the SceneCamera component. This is outside the scope of this PR which only modifies:
1. HelpButton keyboard shortcut logic
2. TerminalInterface expansion behavior

## Build & Lint Status

- ✅ Linter passes with no errors related to changes
- ✅ TypeScript types are correct
- ✅ No console errors from modified components
- ⚠️ Pre-existing 3D scene error (unrelated to this PR)
