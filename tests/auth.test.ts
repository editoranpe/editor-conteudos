import { describe, it, expect } from "vitest";
import { authenticate, type Env } from "../worker/auth";
import worker from "../worker/index";
const env = {
  ACCESS_TEAM_DOMAIN: "https://npe.cloudflareaccess.com",
  ACCESS_AUD: "audience",
  ADMIN_EMAILS: "admin@example.com",
} as Env;
describe("Autenticação fecha o acesso por padrão", () => {
  it("não permite API sem configuração de Access", async () => {
    await expect(
      authenticate(new Request("https://app.example.com/api/me"), {} as Env),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("não usa e-mail em cabeçalho como autenticação", async () => {
    await expect(
      authenticate(
        new Request("https://app.example.com/api/me", {
          headers: {
            "Cf-Access-Authenticated-User-Email": "admin@example.com",
          },
        }),
        env,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejeita token falso antes de tocar no banco", async () => {
    await expect(
      authenticate(
        new Request("https://app.example.com/api/me", {
          headers: { "Cf-Access-Jwt-Assertion": "fake.token.invalid" },
        }),
        env,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejeita escrita vinda de outro site antes da autenticação", async () => {
    const res = await worker.fetch(
      new Request("https://app.example.com/api/contents", {
        method: "POST",
        headers: { Origin: "https://other.example.com" },
        body: "{}",
      }),
      env,
    );
    expect(res.status).toBe(403);
  });
  it("API sem sessão devolve erro JSON e nunca o HTML da SPA", async () => {
    const res = await worker.fetch(
      new Request("https://app.example.com/api/contents"),
      env,
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });
});
