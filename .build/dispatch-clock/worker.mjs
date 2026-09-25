/* auspol dispatch clock — a Cloudflare Worker that starts the updater
   workflows on time. See README.md in this directory for why and how to
   deploy it.

   Every minute (the cron trigger in wrangler.toml) it reads schedule.json
   from the repo and sends a workflow_dispatch for each workflow with a slot
   in that Sydney minute. A dispatch starts a run within seconds; GitHub's
   own `schedule` trigger ran these same slots 2–5 hours late at the median
   in Sep 2026 and dropped whole release windows. The workflows keep their
   cron blocks as the backup, so a dead clock only means late runs again.

   Bindings (wrangler.toml / secrets):
     REPO          owner/name
     TABLE_URL     raw URL of .build/dispatch-clock/schedule.json on main
     GITHUB_TOKEN  secret — fine-grained PAT, this repository only,
                   Actions: read and write (nothing else) */
import { loadTable, nextSlots, sydneyClock, tick } from "./clock.mjs";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(new Date(event.scheduledTime), env));
  },
  // a read-only status page: the Sydney time, and what dispatches next
  async fetch(_request, env) {
    const table = await loadTable(env);
    const now = new Date();
    return new Response(JSON.stringify({ sydney: sydneyClock(now), slots: table.slots.length, next: nextSlots(table, now, 12) }, null, 1),
      { headers: { "content-type": "application/json" } });
  },
};
