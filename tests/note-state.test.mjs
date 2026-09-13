import test from 'node:test';
import assert from 'node:assert/strict';
import {createNoteState} from '../src/features/social/note-state.js';

test('note reads coalesce, respect WCE ownership and cannot undo a saved note', async () => {
    let resolve, reads = 0, owns = true;
    const a = {MemberNumber: 1}, b = {MemberNumber: 1};
    const state = createNoteState({characters: () => [a, b], ownsState: () => owns,
        read: () => { reads++; return new Promise(r => { resolve = r; }); }});
    const pending = state.refreshAll();
    await Promise.resolve(); assert.equal(reads, 1);
    state.publish(1, true); resolve({note: ''}); await pending;
    assert.equal(a.FBCNoteExists, true); assert.equal(b.FBCNoteExists, true);
    const later = state.refreshAll(); await Promise.resolve();
    owns = false; resolve({note: ''}); await later;
    assert.equal(a.FBCNoteExists, true);
    await state.refreshAll(); assert.equal(reads, 2);
    owns = true;
    const takeover = state.refreshAll(); await Promise.resolve();
    resolve({note: ''}); await takeover;
    assert.equal(a.FBCNoteExists, false);
});
