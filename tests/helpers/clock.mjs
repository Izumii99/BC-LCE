/** Opt-in deterministic timers; advancing a clock never waits in real time. */
export function fakeClock() {
    let now = 0, sequence = 0;
    const timers = new Map();
    const schedule = (fn, delay = 0, interval = 0) => {
        const id = ++sequence;
        timers.set(id, {fn, at: now + Math.max(0, delay), interval});
        return id;
    };
    return {
        globals: {
            Date: class extends Date { static now() { return now; } },
            performance: {now: () => now},
            setTimeout: (fn, delay) => schedule(fn, delay),
            clearTimeout: id => timers.delete(id),
            setInterval: (fn, delay) => schedule(fn, Math.max(1, delay), Math.max(1, delay)),
            clearInterval: id => timers.delete(id),
            requestAnimationFrame: fn => schedule(() => fn(now), 16),
            cancelAnimationFrame: id => timers.delete(id),
        },
        advance(ms) {
            const end = now + ms;
            let count = 0;
            while (true) {
                const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                if (++count > 10000) throw Error('Timer loop exceeded safety limit');
                const [id, timer] = next; now = timer.at;
                if (timer.interval) timer.at += timer.interval; else timers.delete(id);
                timer.fn();
            }
            now = end;
        },
    };
}
