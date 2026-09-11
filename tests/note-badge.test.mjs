import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';

test('database readiness hydrates characters already loaded during login', async () => {
    let ready;
    const room = {MemberNumber: 2}, other = {MemberNumber: 3, FBCNoteExists: true};
    const rt = runtime({globals: {Character: [], ChatRoomCharacter: []}, mocks: {
        idb: {openDB: () => new Promise(resolve => { ready = resolve; })},
        'src/ui/chat/notification.js': {lceChatNotify() {}},
    }});
    const settings = await rt.load('src/core/feature-settings.js');
    settings.setFeature('pastProfiles', true);
    const profiles = await rt.load('src/features/social/past-profiles.js');
    const installing = profiles.installPastProfiles();
    // These instances arrive before CharacterLoadOnline is hooked.
    rt.context.Character.push(room, other);
    rt.context.ChatRoomCharacter.push(room, other);
    ready({get: async (_, id) => id === 2 ? {note: 'Remember this player'} : undefined});
    await installing;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(room.FBCNoteExists, true);
    assert.equal(other.FBCNoteExists, false);
    const later = {MemberNumber: 2};
    rt.hooks.get('CharacterLoadOnline')([], () => later);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(later.FBCNoteExists, true);
});

test('saving and clearing a note updates all matching characters only after storage succeeds', async () => {
    const room = {MemberNumber: 2}, profile = {MemberNumber: 2}, cached = {MemberNumber: 2};
    const other = {MemberNumber: 3, FBCNoteExists: true};
    let fail = false;
    const rt = runtime({globals: {Character: [cached, other], ChatRoomCharacter: [room],
        InformationSheetSelection: profile, testDb: {put: async () => { if (fail) throw Error('write failed'); }}},
    mocks: {idb: {openDB: async () => ({})}, 'src/ui/chat/notification.js': {lceChatNotify() {}}},
    append: {'src/features/social/past-profiles.js': 'db = testDb; export {setNote};'}});
    const {setNote} = await rt.load('src/features/social/past-profiles.js');
    await setNote(2, 'Note');
    for (const c of [room, profile, cached]) assert.equal(c.FBCNoteExists, true);
    await setNote(2, '');
    for (const c of [room, profile, cached]) assert.equal(c.FBCNoteExists, false);
    assert.equal(other.FBCNoteExists, true);
    fail = true;
    await assert.rejects(setNote(2, 'Not saved'));
    for (const c of [room, profile, cached]) assert.equal(c.FBCNoteExists, false);
});
