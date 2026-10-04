import { fSettings, setFeature } from '../core/feature-settings.js';
import { T } from '../core/i18n.js';

let dismiss = null;
export const isSettingDropdownOpen = () => dismiss !== null;
export function closeSettingDropdown() { dismiss?.(); }

/** Canvas-anchored list: select a value directly, with keyboard/touch support. */
export function openSettingDropdown(key, def, layout) {
    closeSettingDropdown();
    if (def.disabled?.(fSettings) || (def.withToggle && !fSettings[`${key}Enabled`])) return;
    const list = document.createElement('div');
    list.id = 'lce-setting-dropdown';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', T(def.label));
    Object.assign(list.style, {
        position: 'fixed', zIndex: '10000', padding: '6px', boxSizing: 'border-box',
        font: '16px "Segoe UI", "Noto Sans TC", sans-serif',
        overflowY: 'auto', background: 'var(--lce-main,#222)', color: 'var(--lce-text,#eee)',
        border: '2px solid var(--lce-login-accent,#7214ff)', borderRadius: '8px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
    });
    const rows = def.options.map((value, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.textContent = T(def.optionLabels?.[index] ?? value);
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(fSettings[key] === value));
        Object.assign(row.style, { display: 'block', width: '100%', padding: '10px', border: '0',
            textAlign: 'left', borderRadius: '4px', cursor: 'pointer', font: 'inherit', color: 'inherit',
            background: fSettings[key] === value ? 'var(--lce-login-accent,#7214ff)' : 'transparent' });
        row.addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation();
            if (!def.disabled?.(fSettings) && (!def.withToggle || fSettings[`${key}Enabled`])) setFeature(key, value);
            closeSettingDropdown();
        });
        list.appendChild(row);
        return row;
    });
    const position = () => {
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        const rect = canvas?.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        const width = Math.min(vw - 16, Math.max(180, rect ? layout.controlW / 2000 * rect.width : 240));
        const height = Math.min(vh - 16, rows.length * 44 + 16);
        const left = rect ? rect.left + layout.controlX / 2000 * rect.width : 8;
        const top = rect ? rect.top + (layout.y + 65) / 1000 * rect.height : 8;
        Object.assign(list.style, { width: `${width}px`, maxHeight: `${height}px`,
            left: `${Math.max(8, Math.min(vw - width - 8, left))}px`,
            top: `${Math.max(8, Math.min(vh - height - 8, top))}px` });
    };
    const outside = event => { if (!list.contains(event.target)) closeSettingDropdown(); };
    const keydown = event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSettingDropdown(); }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            const index = rows.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
            rows[next]?.focus();
        }
    };
    dismiss = () => {
        dismiss = null;
        list.remove();
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', keydown, true);
        window.removeEventListener('resize', position);
    };
    document.body.appendChild(list);
    list.addEventListener('pointerdown', event => event.stopPropagation());
    list.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', position);
    position();
    rows[Math.max(0, def.options.indexOf(fSettings[key]))]?.focus();
}
