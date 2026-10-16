// Cloudflare Pages Function: /api/auth/config
import { config, type AuthEnv } from "../../../server/auth";

export const onRequestGet = (ctx: { request: Request; env: AuthEnv }) => config(ctx.request, ctx.env);
