// Vercel Edge Function: /api/auth/callback
import { callback } from "../../server/auth";

export const config = { runtime: "edge" };

export default function handler(req: Request) {
  return callback(req, process.env);
}
