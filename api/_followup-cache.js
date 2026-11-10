'use strict';

/**
 * Short-lived, process-local snapshot cache for read-only Follow-up.
 * No disk or client storage: prospects remain behind the existing session.
 * Claims, schedules, and sending are ALWAYS validated by the product backend.
 */
function createFollowupCache({ now = () => Date.now(), freshMs = 25_000, staleMs = 4 * 60_000 } = {}) {
  const entries = new Map();
  const inFlight = new Map();
  let generation = 0;

  function invalidate(prefix = '') {
    generation++;
    for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
    // Prevent a pre-write load from putting old data back in the cache.
    for (const key of inFlight.keys()) if (key.startsWith(prefix)) inFlight.delete(key);
  }

  async function get(key, loader) {
    const hit = entries.get(key);
    const age = hit ? now() - hit.at : Infinity;
    if (hit && age >= 0 && age < freshMs)
      return { data: hit.data, source: 'fresh', ageMs: age };

    if (inFlight.has(key)) return inFlight.get(key);
    const currentGeneration = generation;
    const task = Promise.resolve().then(loader)
      .then((data) => {
        if (currentGeneration === generation) {
          if (entries.size >= 24) entries.clear();
          entries.set(key, { data, at: now() });
        }
        return { data, source: 'network', ageMs: 0 };
      })
      .catch((error) => {
        const fallbackAge = hit ? now() - hit.at : Infinity;
        if (hit && fallbackAge >= 0 && fallbackAge < staleMs)
          return { data: hit.data, source: 'stale', ageMs: fallbackAge, warning: error.message };
        throw error;
      })
      .finally(() => { if (inFlight.get(key) === task) inFlight.delete(key); });
    inFlight.set(key, task);
    return task;
  }

  return { get, invalidate };
}

module.exports = { createFollowupCache };
