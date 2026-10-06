// Vercel Edge Function: /api/auth/config
import { config as authConfig } from "../../server/auth";

export const config = { runtime: "edge" };

export default function handler(req: Request) {
  return authConfig(req, process.env);
}
