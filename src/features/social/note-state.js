/** Coalesce reads only while pending. WCE shares this store, so never cache settled reads. */
export function createNoteState({read, characters, ownsState}) {
    const pending = new Map();
    const revisions = new Map();
    function publish(memberNumber, exists) {
        revisions.set(memberNumber, (revisions.get(memberNumber) || 0) + 1);
        pending.delete(memberNumber);
        for (const c of characters()) {
            if (c?.MemberNumber === memberNumber) c.FBCNoteExists = exists;
        }
    }
    async function refresh(c) {
        if (!c?.MemberNumber || !ownsState()) return;
        const id = c.MemberNumber, revision = revisions.get(id) || 0;
        let request = pending.get(id);
        if (!request) {
            request = Promise.resolve().then(() => read(id));
            pending.set(id, request);
        }
        try {
            const note = await request;
            if (ownsState() && revision === (revisions.get(id) || 0)) {
                c.FBCNoteExists = !!(note && typeof note.note === 'string' && note.note);
            }
        } catch { /* Keep the last known flag on storage failure. */ }
        finally { if (pending.get(id) === request) pending.delete(id); }
    }
    return {publish, refresh, refreshAll: () => Promise.all([...characters()].map(refresh))};
}
