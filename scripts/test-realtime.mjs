import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const url = "https://zgffuzsvqvgjsgrhawgn.supabase.co";
const key = "sb_publishable_mNeM2uuGX1lB5eSs3sHBVQ_XaBEnxAC";
const supabase = createClient(url, key, {
  realtime: { transport: WebSocket },
});

const TEST_PASSWORD = "realtime-test-password";
const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 23)}]`, ...args);

async function main() {
  log("Creating ephemeral test session...");
  const create = await supabase.rpc("create_session", { p_password: TEST_PASSWORD });
  if (create.error) throw new Error(`create_session failed: ${create.error.message}`);
  const code = create.data;
  log(`Session created. code=${code}`);

  let eventCount = 0;
  let firstEventReceivedAt = null;
  const deadline = new Date(Date.now() + 10000);

  log(`Subscribing to postgres_changes on sessions where code=eq.${code}...`);
  const channel = supabase
    .channel(`test:${code}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `code=eq.${code}`,
      },
      (payload) => {
        eventCount += 1;
        if (!firstEventReceivedAt) firstEventReceivedAt = Date.now();
        const liveA = payload.new?.state?.pending?.liveScoreA;
        const liveB = payload.new?.state?.pending?.liveScoreB;
        log(`📡 realtime UPDATE #${eventCount}: liveScoreA=${liveA} liveScoreB=${liveB}`);
      }
    )
    .subscribe((status, err) => {
      log(`channel status: ${status}${err ? ` err=${err.message ?? err}` : ""}`);
    });

  // Wait until the channel is subscribed before pushing updates
  log("Waiting up to 6s for subscription to become SUBSCRIBED...");
  const waitStart = Date.now();
  while (Date.now() - waitStart < 6000) {
    if (channel.state === "joined") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  log(`channel.state=${channel.state}`);

  // Fire 3 updates 500ms apart
  const fakePending = {
    id: "test-match-1",
    teamA: ["p1", "p2"],
    teamB: ["p3", "p4"],
    serving: "A",
    serverNumber: 2,
    liveScoreA: 0,
    liveScoreB: 0,
    createdAt: Date.now(),
  };

  for (let i = 1; i <= 3; i++) {
    const newState = {
      players: [],
      courtCount: 1,
      pending: { ...fakePending, liveScoreA: i },
      upcoming: [],
      history: [],
    };
    log(`→ update_session_by_code #${i} (liveScoreA=${i})`);
    const u = await supabase.rpc("update_session_by_code", {
      p_code: code,
      p_password: TEST_PASSWORD,
      p_new_state: newState,
    });
    if (u.error) log(`  RPC error: ${u.error.message}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  // Wait a bit to catch lagged events
  await new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())));

  log("---");
  log(`Events received: ${eventCount}/3`);
  if (eventCount === 0) {
    log("❌ No realtime events received. Replication likely not enabled for sessions table.");
  } else if (eventCount < 3) {
    log(`⚠️  Only ${eventCount}/3 events received.`);
  } else {
    log("✅ All 3 realtime events received.");
    if (firstEventReceivedAt) {
      log(`First event latency after first RPC: look at timestamps above.`);
    }
  }
  log(`Test session ${code} left in DB. Delete with: delete from public.sessions where code='${code}';`);

  await supabase.removeChannel(channel);
  process.exit(eventCount >= 3 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
