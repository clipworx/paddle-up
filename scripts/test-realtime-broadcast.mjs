import { createClient } from "@supabase/supabase-js";

const url = "https://zgffuzsvqvgjsgrhawgn.supabase.co";
const key = "sb_publishable_mNeM2uuGX1lB5eSs3sHBVQ_XaBEnxAC";
const supabase = createClient(url, key);
const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 23)}]`, ...args);

async function main() {
  log("Trying a broadcast channel (doesn't need publication/RLS)...");
  const ch = supabase
    .channel("probe", { config: { broadcast: { self: true } } })
    .on("broadcast", { event: "ping" }, (p) => log("broadcast received:", p))
    .subscribe((status, err) => {
      log(`broadcast channel status: ${status}${err ? ` err=${err.message ?? err}` : ""}`);
    });

  const waitStart = Date.now();
  while (Date.now() - waitStart < 8000) {
    if (ch.state === "joined") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  log(`broadcast channel.state=${ch.state}`);

  if (ch.state === "joined") {
    log("✅ realtime reachable (broadcast channel joined)");
    log("sending ping");
    await ch.send({ type: "broadcast", event: "ping", payload: { ts: Date.now() } });
    await new Promise((r) => setTimeout(r, 1500));
  } else {
    log("❌ broadcast channel never joined — realtime service unreachable or auth is broken");
  }

  await supabase.removeChannel(ch);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
