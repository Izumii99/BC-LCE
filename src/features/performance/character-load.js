import { createHook } from '../../core/hooks.js';
import { getFeature } from '../../core/feature-settings.js';

const hook = createHook('character-load');
const INTERVAL_MS = 50;
let installed = false;

/** Pace room draw-triggered rebuilds, never synchronous editor/preview work. */
export function installCharacterLoadPerformance() {
    if (installed) return;
    installed = true;
    const pending = new Set();
    let nextBuildAt = 0;
    let drawing = null;
    const enabled = () => getFeature('staggerCharacterBuild') &&
        typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom' &&
        typeof CurrentCharacter !== 'undefined' && !CurrentCharacter;

    hook('DrawCharacter', 100, (args, next) => {
        const c = args[0];
        if (!enabled()) {
            pending.clear(); nextBuildAt = 0;
            return next(args);
        }
        const room = typeof ChatRoomCharacter !== 'undefined' ? ChatRoomCharacter : [];
        for (const queued of pending) {
            if (!room.includes(queued) || !queued.MustDraw) pending.delete(queued);
        }
        if (!room.includes(c) || (typeof Player !== 'undefined' && c === Player)) return next(args);
        const previous = drawing;
        const context = { character: c, deferred: false };
        drawing = context;
        try { return next(args); }
        finally {
            // BC clears MustDraw after CharacterLoadCanvas returns, even when
            // our hook deferred it. Restore here so changes are never lost.
            if (context.deferred) c.MustDraw = true;
            drawing = previous;
        }
    });

    hook('CharacterLoadCanvas', 100, (args, next) => {
        const c = args[0];
        if (!enabled() || drawing?.character !== c || !c.Canvas || !c.CanvasBlink) return next(args);
        pending.add(c);
        const now = performance.now();
        if (now < nextBuildAt || pending.values().next().value !== c) {
            drawing.deferred = true;
            return;
        }
        pending.delete(c);
        nextBuildAt = now + INTERVAL_MS;
        const previous = drawing;
        drawing = null; // Nested ECHO/AEE partial renders must finish synchronously.
        try { return next(args); }
        finally { drawing = previous; }
    });
}
