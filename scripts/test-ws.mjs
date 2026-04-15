import WebSocket from "ws";

const url =
  "wss://zgffuzsvqvgjsgrhawgn.supabase.co/realtime/v1/websocket" +
  "?apikey=sb_publishable_mNeM2uuGX1lB5eSs3sHBVQ_XaBEnxAC&vsn=1.0.0";

console.log("Connecting to", url);
const ws = new WebSocket(url);

ws.on("open", () => {
  console.log("WS open");
  const join = {
    topic: "realtime:probe",
    event: "phx_join",
    payload: {
      config: {
        broadcast: { self: true },
        presence: { key: "" },
        postgres_changes: [],
      },
      access_token: "sb_publishable_mNeM2uuGX1lB5eSs3sHBVQ_XaBEnxAC",
    },
    ref: "1",
    join_ref: "1",
  };
  ws.send(JSON.stringify(join));
  setTimeout(() => {
    console.log("Closing after 4s");
    ws.close();
    process.exit(0);
  }, 4000);
});

ws.on("message", (data) => {
  console.log("WS message:", data.toString());
});

ws.on("error", (err) => {
  console.log("WS error:", err.message);
});

ws.on("close", (code, reason) => {
  console.log(`WS close code=${code} reason=${reason.toString()}`);
});
