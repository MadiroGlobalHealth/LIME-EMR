// Vercel Edge Function: /api/auth/login
import { login } from "../../server/auth";

export const config = { runtime: "edge" };

export default function handler(req: Request) {
  return login(req, process.env);
}
