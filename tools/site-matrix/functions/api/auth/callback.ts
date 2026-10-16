// Cloudflare Pages Function: /api/auth/callback
import { callback, type AuthEnv } from "../../../server/auth";

export const onRequestGet = (ctx: { request: Request; env: AuthEnv }) => callback(ctx.request, ctx.env);
