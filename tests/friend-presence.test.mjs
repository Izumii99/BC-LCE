import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';

test('presence drops background events, resyncs on return and clears only its own cards', async () => {
    let receive, now = 0;
    const cards = [], sounds = [], locals = [], queries = [];
    const manager = {
        queue: [{category: 'private-message'}],
        _process() {},
        info(text, options) { cards.push({text, ...options}); this.queue.push(options); },
        dismissByCategory(category) {
            assert.equal(this.queue.some(t => t.category === category), false);
        },
    };
    const rt = runtime({globals: {
        CurrentScreen: 'ChatRoom', ServerSocket: {}, ServerIsConnected: () => true,
        Date: {now: () => now},
        ToastManager: manager, ServerSend: (...args) => queries.push(args),
        AudioPlayInstantSound: (...args) => sounds.push(args),
        ChatRoomSendLocal: (...args) => locals.push(args),
    }, mocks: {
        'src/core/lifecycle.js': {createSocketBinding: handlers => {
            receive = handlers.AccountQueryResult; return {bind() {}};
        }},
        'src/core/feature-settings.js': {getFeature: key => key.endsWith('Notify') ? 'both' : true},
        'src/core/wce-compat.js': {isWceFeatureEnabled: () => false},
        'src/features/chat/local-messages.js': {LOCAL_MARKER: 'local'},
    }});
    const mod = await rt.load('src/features/social/friend-presence.js');
    mod.installFriendPresence();
    const send = ids => receive({Query: 'OnlineFriends', Result: ids.map(MemberNumber => ({MemberNumber, MemberName: 'Friend'}))});
    send([1]);
    assert.equal(cards.length, 1);
    rt.document.hidden = true;
    rt.document.dispatchEvent({type: 'visibilitychange'});
    assert.deepEqual(manager.queue, [{category: 'private-message'}]);
    send([2]); send([3]);
    assert.equal(cards.length, 1);
    assert.equal(sounds.length, 1);
    assert.equal(locals.length, 1);
    rt.document.hidden = false;
    rt.document.dispatchEvent({type: 'visibilitychange'});
    assert.equal(queries.length, 1);
    send([4]); // Includes changes made while the tab was suspended.
    assert.equal(cards.length, 1);
    send([4, 5]);
    assert.equal(cards.length, 2);
    send([4, 5, 6]);
    assert.equal(manager.queue.filter(t => t.category === 'lce-friend-presence').length, 2);
    send([4, 5, 7]); // Online and offline cards must coexist.
    assert.equal(manager.queue.filter(t => t.category === 'lce-friend-presence').length, 4);
    now = 10000;
    rt.hooks.get('ToastManager._process')([], () => {
        assert.deepEqual(manager.queue, [{category: 'private-message'}]);
    });
});
