import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {

  // Roblox ambil leaderboard
  if (req.method === "GET") {
    try {
      const data = await redis.get("leaderboard");
      if (!data) return res.status(200).json([]);

      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return res.status(200).json(parsed);

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Update leaderboard
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

      const username = body.username;
      const amount   = Number(body.amount) || 0;

      if (!username || amount <= 0) {
        return res.status(400).json({ error: "Invalid data" });
      }

      let leaderboard = await redis.get("leaderboard") || [];
      if (typeof leaderboard === "string") {
        leaderboard = JSON.parse(leaderboard);
      }

      const existing = leaderboard.find(
        e => e.member.toLowerCase() === username.toLowerCase()
      );

      if (existing) {
        existing.score += amount;
      } else {
        leaderboard.push({ member: username, score: amount });
      }

      leaderboard.sort((a, b) => b.score - a.score);

      await redis.set("leaderboard", JSON.stringify(leaderboard));
      return res.status(200).json({ success: true });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
