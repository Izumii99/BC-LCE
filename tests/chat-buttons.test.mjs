import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';

async function fixture() {
    const observers = []; let tick;
    const commands = [{ Tag: 'help', Description: '<img src=x onerror=bad()>' }];
    const rt = runtime({ globals: {
        Commands: commands,
        MutationObserver: class { constructor(cb) { observers.push(cb); } observe() {} disconnect() {} },
        setInterval: fn => { tick = fn; return 1; },
    } });
    rt.context.window.Commands = commands;
    const log = rt.document.createElement('div'); log.id = 'TextAreaChatLog'; rt.document.body.append(log);
    const input = rt.document.createElement('input'); input.id = 'InputChat'; rt.document.body.append(input);
    const settings = await rt.load('src/core/feature-settings.js');
    const mod = await rt.load('src/features/chat/index.js'); mod.installChat(); mod.installChat();
    const message = text => {
        const el = rt.document.createElement('div'); el.className = 'chat-room-message-content'; el.textContent = text; log.append(el);
        observers[0]([{type:'childList',target:log,addedNodes:[el]}]); return el;
    };
    return { rt, log, input, settings, message, tick: () => tick(),
        changed: el => observers[0]([{type:'childList',target:el,addedNodes:[...el.childNodes]}]) };
}

test('chat buttons toggle immediately, restore exact literal text, and preserve adjacent DOM', async () => {
    const { rt, settings, message, input, tick } = await fixture();
    const original = '#  room" onmouseover="bad()  # /help <img src=x>';
    const el = message(original);
    const link = rt.document.createElement('a'); link.textContent = '#keep#'; el.append(link);
    settings.setFeature('commandButtons', true);
    const room = el.querySelector('.lceRoom'), cmd = el.querySelector('.lceCmd');
    assert.ok(room); assert.ok(cmd); assert.equal(room.getAttribute('onmouseover'),null);
    rt.document.dispatchEvent({type:'mouseover',target:cmd});
    const desc = rt.document.getElementById('lceChatDesc');
    assert.match(desc.textContent, /<img src=x/); assert.equal(desc.querySelector('img'),null);
    rt.document.dispatchEvent({type:'click',target:cmd}); assert.equal(input.value,'/help ');
    settings.setFeature('commandButtons',false);
    assert.equal(desc.style.display,'none'); assert.equal(el.textContent,original+'#keep#');
    assert.equal(el.querySelector('.lceRoom'),null); assert.equal(el.querySelector('a'),link);
    assert.equal(el.querySelector('img'),null);
    // Rapid toggles before the shared 500ms refresh must still redecorate.
    settings.setFeature('commandButtons',true);tick(); assert.ok(el.querySelector('.lceCmd'));
    tick();tick();assert.equal(el.querySelectorAll('.lceCmd').length,1);
    rt.document.dispatchEvent({type:'mouseover',target:el.querySelector('.lceCmd')});
    assert.equal(rt.hooks.get('ChatRoomLeave')([],()=>42),42);assert.equal(desc.style.display,'none');
});

test('same-text DOM replacements are redecorated while pending messages stay untouched', async () => {
    const { settings, message, changed, rt, tick } = await fixture();
    settings.setFeature('commandButtons',true);tick();
    const el=message('/help'); const old=el.querySelector('.lceCmd');assert.ok(old);
    el.textContent='/help';changed(el);
    assert.ok(el.querySelector('.lceCmd'));assert.notEqual(el.querySelector('.lceCmd'),old);
    const pending=rt.document.createElement('div');pending.className='lce-pending';
    const inner=rt.document.createElement('div');inner.className='chat-room-message-content';inner.textContent='/help';pending.append(inner);
    rt.document.getElementById('TextAreaChatLog').append(pending);changed(inner);
    assert.equal(inner.querySelector('.lceCmd'),null);
    pending.classList.remove('lce-pending');changed(inner);assert.ok(inner.querySelector('.lceCmd'));
});

test('standalone Chat TtoB takes ownership; disabling it resumes LCE without nested buttons', async () => {
    const { settings, message, rt, tick, changed } = await fixture();
    settings.setFeature('commandButtons',true);tick();const el=message('/help');assert.ok(el.querySelector('.lceCmd'));
    let active=true;rt.context.window.LikoChatTtoBInstance={isEnabled:()=>active};tick();
    assert.equal(el.querySelector('.lceCmd'),null);assert.equal(el.textContent,'/help');
    const foreign=rt.document.createElement('span');foreign.className='likoCommandInChat';foreign.textContent='/help';el.replaceChildren(foreign);
    active=false;tick();changed(el);assert.equal(foreign.querySelector('.lceCmd'),null);
    foreign.replaceWith(rt.document.createTextNode('/help'));changed(el);assert.ok(el.querySelector('.lceCmd'));
});
