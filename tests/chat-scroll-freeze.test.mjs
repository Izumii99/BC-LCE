import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';

test('freeze integration skips hidden room sizing but preserves visible resize and shared instances', async () => {
    const rt = runtime({mocks: {'src/core/feature-settings.js': {getFeature: () => true}}});
    const parent = rt.document.createElement('div'); parent.id = 'chat-room-div';
    let height = 0, calls = 0;
    parent.getBoundingClientRect = () => ({height}); rt.document.body.append(parent);
    const mod = await rt.load('src/features/chat/chat-scroll-freeze.js');
    mod.installChatScrollFreeze(); mod.installChatScrollFreeze();
    const hook = rt.hooks.get('ChatRoomInputResize');
    const resize = () => { calls++; return 'resized'; };
    hook([{}], resize); assert.equal(calls, 0);
    height = 500; assert.equal(hook([{}], resize), 'resized');
    assert.equal(calls, 1);
    // Existing plugin owned by another loader remains intact.
    rt.window.Liko = {__Sys_ChatScrollFreeze__: {isFrozen: () => true}};
    height = 0; hook([{}], resize); assert.equal(calls, 1);
    assert.equal(rt.window.Liko.__Sys_ChatScrollFreeze__.isFrozen(), true);
    parent.remove(); hook([{}], resize); assert.equal(calls, 2);
    assert.equal(rt.document.head.querySelectorAll('script').length, 1);
});
