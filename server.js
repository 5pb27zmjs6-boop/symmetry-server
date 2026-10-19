import express from "express";
const app = express(), KEY = process.env.ANTHROPIC_API_KEY, TOKEN = process.env.APP_TOKEN,
  MODEL = process.env.MODEL || "claude-sonnet-5-5", hits = new Map();
app.use(express.json({ limit: "8mb" }));
app.use((q, s, n) => {
  s.set({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,x-token", "Access-Control-Allow-Methods": "POST,OPTIONS" });
  q.method === "OPTIONS" ? s.sendStatus(204) : n();
});
app.get("/", (q, s) => s.send("ok"));
app.post("/ai", async (q, s) => {
  if (!TOKEN || q.get("x-token") !== TOKEN) return s.sendStatus(401);
  const h = Date.now() - 36e5, l = (hits.get(q.ip) || []).filter(t => t > h);
  if (l.length >= 40) return s.sendStatus(429);
  l.push(Date.now()); hits.set(q.ip, l);
  const { prompt, image } = q.body || {};
  if (typeof prompt !== "string" || prompt.length > 200000) return s.sendStatus(400);
  const c = image ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } }, { type: "text", text: prompt }] : prompt;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages: [{ role: "user", content: c }] })
    });
    const d = await r.json();
    if (!r.ok) return s.status(502).json({ error: d });
    s.json({ text: (d.content || []).filter(b => b.type === "text").map(b => b.text).join("") });
  } catch (e) { s.status(502).json({ error: String(e) }); }
});
app.listen(process.env.PORT || 3000);
