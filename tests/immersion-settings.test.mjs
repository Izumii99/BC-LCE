import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';

test('immersion tabs include every setting once and keep all anti-garble controls in the right column', async () => {
    const rt = runtime({ mocks: {
        'src/settings/pickers.js': { langFlag() {}, openLanguageDropdown() {}, openFontPicker() {}, promptInput() {}, openColorPicker() {} },
        'src/settings/storage-manager.js': { openStorageManager() {}, closeStorageManager() {}, isStorageManagerOpen: () => false, positionStorageManager() {} },
        'src/settings/trusted-domain-manager.js': { openTrustedDomainManager() {}, closeTrustedDomainManager() {}, isTrustedDomainManagerOpen: () => false, positionTrustedDomainManager() {} },
    }, append: { 'src/settings/settings-page.js': `
        export function testLayouts(section) { currentCategory = 'immersion'; currentSection = section; return settingLayouts(); }
    ` } });
    const schema = await rt.load('src/core/settings-schema.js');
    const view = await rt.load('src/settings/settings-page.js');
    const all = schema.IMMERSION_SECTIONS.flat();
    assert.equal(new Set(all).size, all.length);
    assert.deepEqual([...all].sort(), Object.keys(schema.DEFAULT_FEATURE_SETTINGS)
        .filter(key => schema.DEFAULT_FEATURE_SETTINGS[key].category === 'immersion').sort());
    assert.equal('echoActivityExpressions' in schema.DEFAULT_FEATURE_SETTINGS, false);
    assert.equal('smartClosedEyes' in schema.DEFAULT_FEATURE_SETTINGS, false);
    assert.ok(schema.IMMERSION_SECTIONS[2].includes('urlAsOoc'));
    const chat = view.testLayouts(1);
    const right = chat.filter(row => row.x > 1000);
    assert.equal(right.length, 7);
    assert.ok(right.every(row => row.entry[0].startsWith('antiGarble')));
    assert.ok(chat.filter(row => !row.entry[0].startsWith('antiGarble')).every(row => row.x < 1000));
    const other = view.testLayouts(2);
    assert.equal(other.filter(row => row.x > 1000).length, 4);
    assert.ok(other.filter(row => row.entry[0].startsWith('petsuit')).every(row => row.x > 1000));
    assert.ok(other.filter(row => !row.entry[0].startsWith('petsuit')).every(row => row.x < 1000));
    for (let section = 0; section < 3; section++) for (const row of view.testLayouts(section)) {
        assert.ok(row.y + 65 <= 830, `${row.entry[0]} fits vertically`);
        const trailing = row.entry[1].type === 'bar' ? 120 : 0;
        assert.ok(row.controlX + row.controlW + trailing <= row.x + row.width, `${row.entry[0]} fits horizontally`);
    }
});

test('anti-cheat dropdown picks directly, obeys toggle and removes listeners on close', async () => {
    const rt = runtime();
    const settings = await rt.load('src/core/feature-settings.js');
    const schema = await rt.load('src/core/settings-schema.js');
    const dropdown = await rt.load('src/settings/setting-dropdown.js');
    const def = schema.DEFAULT_FEATURE_SETTINGS.antiCheatLevel;
    assert.equal(def.dropdown, true);
    const layout = { controlX: 900, controlW: 340, y: 225 };
    dropdown.openSettingDropdown('antiCheatLevel', def, layout);
    assert.equal(dropdown.isSettingDropdownOpen(), false);
    settings.setFeature('antiCheatLevelEnabled', true);
    dropdown.openSettingDropdown('antiCheatLevel', def, layout);
    const list = rt.document.getElementById('lce-setting-dropdown');
    assert.equal(list.children.length, 6);
    list.children[5].dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
    assert.equal(settings.getFeature('antiCheatLevel'), 'self');
    assert.equal(dropdown.isSettingDropdownOpen(), false);
    assert.equal(rt.document.getElementById('lce-setting-dropdown'), null);
    assert.equal(rt.document.listeners.get('pointerdown').size, 0);
    dropdown.openSettingDropdown('antiCheatLevel', def, layout);
    const second = rt.document.getElementById('lce-setting-dropdown');
    settings.setFeature('antiCheatLevelEnabled', false);
    second.children[0].dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
    assert.equal(settings.getFeature('antiCheatLevel'), 'self');
});
