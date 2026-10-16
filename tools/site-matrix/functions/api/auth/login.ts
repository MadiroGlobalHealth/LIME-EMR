// Cloudflare Pages Function: /api/auth/login
import { login, type AuthEnv } from "../../../server/auth";

export const onRequestGet = (ctx: { request: Request; env: AuthEnv }) => login(ctx.request, ctx.env);
