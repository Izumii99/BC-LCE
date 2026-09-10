import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptLiteHello, refreshLiteIdentity, forgetLiteIdentity } from '../src/features/social/lite-identity.js';

test('Lite identity is versionless, room-scoped and cannot be supplied by a chat message', () => {
    const characters = [{ MemberNumber: 55 }];
    refreshLiteIdentity(characters, true);
    const hello = { Type: 'Hidden', Content: 'BCLiteHello', Sender: 55, Dictionary: [{ client: 'Lite' }] };
    assert.equal(acceptLiteHello({ ...hello, Type: 'Chat' }, characters), false);
    assert.equal(acceptLiteHello({ ...hello, Sender: 66 }, characters), false);
    assert.equal(acceptLiteHello(hello, characters), true);
    assert.deepEqual(characters[0], { MemberNumber: 55, BCLite: true });
    const refreshed = [{ MemberNumber: 55 }];
    refreshLiteIdentity(refreshed); assert.equal(refreshed[0].BCLite, true);
    forgetLiteIdentity(55); refreshLiteIdentity(refreshed); assert.equal(refreshed[0].BCLite, undefined);
    acceptLiteHello(hello, refreshed); refreshLiteIdentity(refreshed, true); assert.equal(refreshed[0].BCLite, undefined);
});
