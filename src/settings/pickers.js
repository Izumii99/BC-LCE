import { fSettings, setFeature } from '../core/feature-settings.js';
import { DEFAULT_FEATURE_SETTINGS } from '../core/settings-schema.js';
import { currentGameLanguage, gameLanguages, switchGameLanguage } from '../game/language.js';
import { T } from '../core/i18n.js';
import { listSystemFonts } from '../features/theme/theme-font.js';

export function langFlag(code) {
    const { codes, icons } = gameLanguages();
    const i = codes.indexOf(code);
    return i >= 0 ? icons[i] : '🌐';
}

let langPickerOpen = false;

/**
 * 開出「遊戲語言」下拉清單（canvas 設定頁上的 HTML 覆蓋層，與字型/調色器同一套做法）。
 * 直接點選要的語言即可，不必用 ◀▶ 一個個繞。語言清單取自 BC 的 TranslationDictionary。
 */
export function openLanguageDropdown(anchor = { right: 1805, y: 165, width: 320 }) {
    if (langPickerOpen) return;
    langPickerOpen = true;

    const listWrap = document.createElement('div');
    listWrap.id = 'lce-langpicker-dropdown';
    Object.assign(listWrap.style, {
        position: 'fixed', zIndex: '10000', boxSizing: 'border-box', width: `${anchor.width}px`, maxHeight: '55vh',
        overflowY: 'auto', overflowX: 'hidden', padding: '8px',
        background: 'var(--lce-main,#222)', color: 'var(--lce-text,#eee)',
        border: '2px solid var(--lce-login-accent,#7214ff)', borderRadius: '8px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
        fontFamily: '"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif',
    });
    document.body.appendChild(listWrap);

    const position = () => {
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        const rect = canvas?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.min(window.innerWidth - 16, Math.max(180, anchor.width / 2000 * rect.width));
        const right = rect.left + anchor.right / 2000 * rect.width;
        listWrap.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, right - width))}px`;
        listWrap.style.top = `${rect.top + anchor.y / 1000 * rect.height}px`;
        listWrap.style.width = `${width}px`;
    };
    position();
    window.addEventListener('resize', position);

    const close = () => {
        langPickerOpen = false;
        listWrap.remove();
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('mousedown', onOutside, true);
        window.removeEventListener('resize', position);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    const onOutside = (e) => { if (!listWrap.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => document.addEventListener('mousedown', onOutside, true));
    listWrap.addEventListener('mousedown', e => e.stopPropagation());

    const pick = (code) => {
        if (code !== currentGameLanguage()) switchGameLanguage(code, false);
        close();
    };

    const { codes, labels } = gameLanguages();
    codes.forEach((code, i) => {
        const row = document.createElement('div');
        row.textContent = labels[i];
        const selected = currentGameLanguage() === code;
        Object.assign(row.style, {
            padding: '8px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '18px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            background: selected ? 'var(--lce-login-accent,#7214ff)' : '',
        });
        row.addEventListener('mouseenter', () => { if (!selected) row.style.background = 'var(--lce-element-hover,#3a3a3a)'; });
        row.addEventListener('mouseleave', () => { if (!selected) row.style.background = ''; });
        row.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); pick(code); });
        listWrap.appendChild(row);
    });
}

let fontPickerOpen = false;

/** 開出「系統已安裝字型」的 HTML 下拉清單（canvas 設定頁上的覆蓋層，與調色器同一套做法）。 */
export function openFontPicker(key, def) {
    if (fontPickerOpen) return;
    fontPickerOpen = true;

    const backdrop = document.createElement('div');
    backdrop.id = 'lce-fontpicker-backdrop';
    Object.assign(backdrop.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)', zIndex: '10000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
        width: 'min(520px,90vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        background: 'var(--lce-main,#222)', color: 'var(--lce-text,#eee)',
        border: '2px solid var(--lce-login-accent,#7214ff)', borderRadius: '8px',
        overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
    });

    const search = document.createElement('input');
    search.type = 'text';
    search.setAttribute('placeholder', T('themeFont_search'));
    Object.assign(search.style, {
        padding: '10px', border: '0', borderBottom: '1px solid var(--lce-login-accent,#7214ff)',
        background: 'var(--lce-element,#111)', color: 'inherit', fontSize: '16px',
    });

    const listWrap = document.createElement('div');
    Object.assign(listWrap.style, { overflowY: 'auto', overflowX: 'hidden', padding: '8px' });
    listWrap.textContent = '…';

    panel.append(search, listWrap);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    const close = () => {
        fontPickerOpen = false;
        backdrop.remove();
        document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    // 別讓點擊/輸入穿到底下的 BC canvas
    panel.addEventListener('mousedown', e => e.stopPropagation());
    search.addEventListener('keydown', e => e.stopPropagation());

    const pick = (name) => { setFeature(key, name); close(); };

    const makeRow = (label, value, previewFont) => {
        const row = document.createElement('div');
        row.textContent = label;
        const selected = fSettings[key] === value;
        Object.assign(row.style, {
            padding: '8px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '18px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            background: selected ? 'var(--lce-login-accent,#7214ff)' : '',
        });
        if (previewFont) row.style.fontFamily = /\s/.test(previewFont) ? `"${previewFont}"` : previewFont;
        row.addEventListener('mouseenter', () => { if (!selected) row.style.background = 'var(--lce-element-hover,#3a3a3a)'; });
        row.addEventListener('mouseleave', () => { if (!selected) row.style.background = ''; });
        row.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); pick(value); });
        return row;
    };

    let allFonts = [];
    const render = (filter = '') => {
        listWrap.textContent = '';
        listWrap.appendChild(makeRow(T('themeFont_default'), '', ''));   // 清除 → 用預設字型
        const f = filter.trim().toLowerCase();
        for (const name of allFonts) {
            if (f && !name.toLowerCase().includes(f)) continue;
            listWrap.appendChild(makeRow(name, name, name));
        }
    };
    search.addEventListener('input', () => render(search.value));

    listSystemFonts()
        .then((fonts) => { allFonts = fonts; render(); search.focus(); })
        .catch((e) => { listWrap.textContent = String(e?.message ?? e); });
}

export function promptInput(key, def) {
    const next = window.prompt(T(def.label), String(fSettings[key] ?? ''));
    if (next !== null) { setFeature(key, next); }
}

let colorPickerOpen = false;

/** LCE 自有的 RGB / HEX 調色視窗，不呼叫瀏覽器 prompt 或原生選色彈窗。 */
export function openColorPicker(key, def) {
    if (colorPickerOpen) return;
    const cur = /^#([0-9a-fA-F]{6})$/.test(fSettings[key]) ? fSettings[key] : '#000000';
    colorPickerOpen = true;
    const backdrop = document.createElement('div');
    backdrop.id = 'lce-colorpicker-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:#0009';
    const panel = document.createElement('section');
    panel.style.cssText = 'box-sizing:border-box;width:min(440px,90vw);padding:20px;border:2px solid var(--lce-login-accent,#7214ff);border-radius:12px;background:var(--lce-main,#222);color:var(--lce-text,#eee);box-shadow:0 16px 50px #000;font:16px Arial,sans-serif';
    const title = document.createElement('h2'); title.textContent = T(def.label); title.style.cssText = 'margin:0 0 16px;font-size:20px';
    const preview = document.createElement('div'); preview.style.cssText = `height:70px;margin-bottom:14px;border:1px solid #ffffff55;border-radius:8px;background:${cur}`;
    const hex = document.createElement('input'); hex.type = 'text'; hex.value = cur.toUpperCase(); hex.maxLength = 7;
    hex.style.cssText = 'box-sizing:border-box;width:100%;margin-bottom:12px;padding:9px;border:1px solid #ffffff55;border-radius:7px;background:#0005;color:inherit;font:inherit';
    const channels = [];
    const values = [1, 3, 5].map(index => Number.parseInt(cur.slice(index, index + 2), 16));
    const sliders = document.createElement('div');
    ['R', 'G', 'B'].forEach((name, index) => {
        const row = document.createElement('label'); row.style.cssText = 'display:grid;grid-template-columns:24px 1fr 44px;gap:10px;align-items:center;margin:10px 0';
        const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = '255'; range.value = String(values[index]);
        const output = document.createElement('span'); output.textContent = range.value; output.style.textAlign = 'right';
        row.append(name, range, output); sliders.appendChild(row); channels.push({ range, output });
    });
    const error = document.createElement('div'); error.style.cssText = 'min-height:22px;color:#ffb4ab';
    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:10px';
    const makeButton = (label) => { const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.style.cssText = 'padding:8px 14px;border:0;border-radius:8px;cursor:pointer;font:inherit;font-weight:700'; return el; };
    const cancel = makeButton(T('picker_cancel'));
    const reset = makeButton(T('picker_reset'));
    const apply = makeButton(T('picker_apply')); apply.style.background = 'var(--lce-login-accent,#7214ff)'; apply.style.color = '#fff';
    const rgbHex = () => `#${channels.map(({ range }) => Number(range.value).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    const show = value => { hex.value = value; preview.style.background = value; error.textContent = ''; };
    for (const { range, output } of channels) range.addEventListener('input', () => { output.textContent = range.value; show(rgbHex()); });
    hex.addEventListener('input', () => {
        const value = hex.value.trim();
        if (!/^#[0-9a-f]{6}$/i.test(value)) { error.textContent = T('picker_invalid_color'); return; }
        [1, 3, 5].forEach((start, index) => { channels[index].range.value = String(Number.parseInt(value.slice(start, start + 2), 16)); channels[index].output.textContent = channels[index].range.value; });
        preview.style.background = value; error.textContent = '';
    });
    const close = () => { colorPickerOpen = false; backdrop.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    cancel.addEventListener('click', close);
    reset.addEventListener('click', () => {
        const value = DEFAULT_FEATURE_SETTINGS[key]?.value ?? '#ffffff'; hex.value = value;
        hex.dispatchEvent(new Event('input'));
    });
    apply.addEventListener('click', () => { const value = hex.value.trim(); if (!/^#[0-9a-f]{6}$/i.test(value)) { error.textContent = T('picker_invalid_color'); return; } setFeature(key, value); close(); });
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });
    panel.addEventListener('mousedown', e => e.stopPropagation());
    document.addEventListener('keydown', onKey, true);
    actions.append(reset, cancel, apply); panel.append(title, preview, hex, sliders, error, actions); backdrop.appendChild(panel); document.body.appendChild(backdrop); hex.focus(); hex.select();
}

