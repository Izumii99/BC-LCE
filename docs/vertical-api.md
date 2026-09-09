# LCE vertical layout API (v1)

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

AEE integration location: `src/components/color-picker/ColorPickerPanel.tsx`.
Its current `defaultLeft = canvasRect.left + canvasRect.width * 0.65` places the
picker outside the visible left half of LCE's canvas. In dialog mode use
`dialogRect.left/top/width` for picker placement and available width instead of
the full canvas rectangle. Clamp saved picker coordinates to that region and
allow scrolling when the panel is taller than `dialogRect.height`.

The API describes active LCE room/search layouts, not the login layout. No
change event is emitted; read it during the consumer's existing layout updates.
