import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Member } from "../shared/domain";
export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  AI: Ai;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ADMIN_EMAILS: string;
  AI_MODEL: string;
  N8N_WEBHOOK_URL?: string;
  N8N_WEBHOOK_SECRET?: string;
}
const keysets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authenticate(
  request: Request,
  env: Env,
): Promise<Member> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS)
    throw new HttpError(
      503,
      "Configure o Cloudflare Access, o banco D1 e os administradores antes de usar o sistema.",
    );
  const domain = new URL(env.ACCESS_TEAM_DOMAIN);
  if (
    domain.protocol !== "https:" ||
    !domain.hostname.endsWith(".cloudflareaccess.com") ||
    domain.pathname !== "/"
  )
    throw new HttpError(503, "Domínio do Cloudflare Access inválido.");
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token)
    throw new HttpError(
      401,
      "Entre pelo endereço protegido pelo Cloudflare Access.",
    );
  let email = "",
    name = "";
  try {
    if (!keysets.has(domain.origin))
      keysets.set(
        domain.origin,
        createRemoteJWKSet(new URL("/cdn-cgi/access/certs", domain)),
      );
    const { payload } = await jwtVerify(token, keysets.get(domain.origin)!, {
      issuer: domain.origin,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    if (typeof payload.email !== "string" || !payload.email.includes("@"))
      throw new Error("Sem e-mail.");
    email = payload.email.toLowerCase();
    name =
      typeof payload.name === "string"
        ? payload.name.slice(0, 100)
        : email.split("@")[0];
  } catch {
    throw new HttpError(401, "Sessão inválida ou expirada. Entre novamente.");
  }
  const isBootstrapAdmin = env.ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(email);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO members(email,name,role,status) VALUES(?,?,?,?)",
  )
    .bind(
      email,
      name,
      isBootstrapAdmin ? "admin" : "visualizador",
      isBootstrapAdmin ? "aprovado" : "pendente",
    )
    .run();
  const member = await env.DB.prepare(
    "SELECT email,name,role,status FROM members WHERE email=?",
  )
    .bind(email)
    .first<Member>();
  if (!member) throw new HttpError(403, "Conta não disponível.");
  return member;
}
export function requireAdmin(user: Member) {
  if (user.role !== "admin" || user.status !== "aprovado")
    throw new HttpError(403, "Apenas administradores podem fazer isso.");
}
