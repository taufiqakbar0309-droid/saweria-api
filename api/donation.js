// api/prime/index.js
import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" 
        ? JSON.parse(req.body) 
        : req.body;

      const donator = body.donator_name || body.donator || "Unknown";
      const amount  = body.amount_raw  || body.amount  || 0;
      const message = body.message     || "...";

      if (!donator || !amount || Number(amount) <= 0) {
        return res.status(400).json({ error: "Invalid data" });
      }

      const numAmount = Number(amount);

      // Simpan pending donation untuk Roblox polling
      await redis.setex("pending_donation", 300, JSON.stringify({
        donator: donator,
        amount:  numAmount,
        message: message
      }));

      // ✅ AUTO UPDATE LEADERBOARD
      let leaderboard = await redis.get("leaderboard") || [];
      if (typeof leaderboard === "string") {
        leaderboard = JSON.parse(leaderboard);
      }

      const existing = leaderboard.find(
        e => e.member.toLowerCase() === donator.toLowerCase()
      );

      if (existing) {
        existing.score += numAmount;
      } else {
        leaderboard.push({ member: donator, score: numAmount });
      }

      leaderboard.sort((a, b) => b.score - a.score);
      await redis.set("leaderboard", JSON.stringify(leaderboard));

      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "GET") {
    try {
      const data = await redis.get("pending_donation");
      if (!data) {
        return res.status(200).send("null");
      }
      await redis.del("pending_donation");
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return res.status(200).json(parsed);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
