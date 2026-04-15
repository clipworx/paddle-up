import { createClient } from "@supabase/supabase-js";

const url = "https://zgffuzsvqvgjsgrhawgn.supabase.co";
const key = "sb_publishable_mNeM2uuGX1lB5eSs3sHBVQ_XaBEnxAC";

const supabase = createClient(url, key, {
  realtime: { params: { log_level: "info" } },
});

// Tap into the underlying realtime client for logs
const rt = supabase.realtime;
rt.logger = (kind, msg, data) => {
  console.log(`[rt ${kind}] ${msg}`, data ? JSON.stringify(data).slice(0, 200) : "");
};

const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 23)}]`, ...args);

async function main() {
  log("Subscribing to broadcast channel 'probe'...");
  const ch = supabase
    .channel("probe", { config: { broadcast: { self: true } } })
    .subscribe((status, err) => {
      log(`subscribe cb: status=${status}${err ? ` err=${err.message ?? err}` : ""}`);
    });

  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (ch.state === "joined") break;
    await new Promise((r) => setTimeout(r, 250));
  }
  log(`final channel.state=${ch.state}`);
  await supabase.removeChannel(ch);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
