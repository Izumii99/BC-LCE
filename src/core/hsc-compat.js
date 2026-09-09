/** Read live ownership, so either load order and HSC cleanup work without cached flags. */
export function hscExpressionGroups() {
    const api = globalThis.Liko?.HSC?.expressions;
    if (api?.apiVersion !== 1 || typeof api.getState !== 'function') return new Set();
    try {
        const state = api.getState();
        return new Set(state?.active === true && Array.isArray(state.groups)
            ? state.groups.filter(group => typeof group === 'string') : []);
    } catch {
        return new Set();
    }
}
