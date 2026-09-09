# LCE vertical layout API (v1)

## AEE panel mapping

LCE now calls `window.Liko?.AEE?.ColorPickerLayout.setMapping(bounds)` after
moving the native dialog DOM. The API exposes `version: 1`. Bounds contain
`left`, `width`, `headingTop`, `top`, and `bottom`, all in CSS viewport pixels.
Horizontal bounds come from the mapped `color-picker-header`; the panel starts
below the menu and heading. AEE fits its existing interactive panel into these
bounds and docks it to their right edge. Passing `null` restores native AEE
placement. LCE clears the mapping on dialog exit or picker disappearance.

Both plugins must support this API for panel mapping.

## Layout state

Read current state on each layout update; do not cache it across screen changes.

```js
const state = window.Liko?.LCE?.Vertical?.getState();
if (state?.mode === 'dialog' && state.dialogRect) {
    const { left, top, width, height, scale } = state.dialogRect;
    // CSS viewport pixels. Place the picker inside this rectangle.
    // scale maps 1000 logical units to width/height pixels.
}
```

Fields: `version: 1`, `active: boolean`, `mode: 'chatroom' | 'dialog' | 'search' | 'select' | null`,
`dialogRect: { left, top, width, height, scale } | null`, `keyboardLocked: boolean`.
Optional chaining supports old LCE versions and either plugin load order.

The API describes active LCE room/search layouts, not the login layout. No
change event is emitted; read it during the consumer's existing layout updates.
