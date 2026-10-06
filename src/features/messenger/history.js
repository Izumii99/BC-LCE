import { openDB } from 'idb';

export function createHistoryRepository(accountName) {
    let opening = null;
    let readyKey = null;
    const key = () => 'im-' + String(accountName() || 'anon').toLowerCase();
    const open = () => opening ??= openDB('lce-im', 1, {
        upgrade(db) { if (!db.objectStoreNames.contains('history')) db.createObjectStore('history'); },
    }).catch(error => { opening = null; throw error; });
    return {
        open,
        restore(render) {
            const restoreKey = key();
            return (async () => {
                const db = await open();
                const history = await db.get('history', restoreKey);
                // Account may have changed while IndexedDB was opening. Never render A into B.
                if (key() !== restoreKey) return false;
                await render(history ?? {});
                if (key() !== restoreKey) return false;
                readyKey = restoreKey;
                return true;
            })();
        },
        async save(history) {
            const saveKey = key();
            if (readyKey !== saveKey) return false;
            try {
                // Re-check after opening: account switches during an awaited operation must not
                // write the current UI snapshot under the wrong account.
                const db = await open();
                if (key() !== saveKey || readyKey !== saveKey) return false;
                await db.put('history', history, saveKey);
                return true; }
            catch (error) { console.warn('🐈‍⬛ [LCE] IM 歷史儲存失敗:', error); return false; }
        },
    };
}
