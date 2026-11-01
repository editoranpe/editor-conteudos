import { z } from "zod";
import { authenticate, requireAdmin, HttpError, type Env } from "./auth";
import {
  canWrite,
  assertTransition,
  contentSchema,
  type Member,
  type ContentData,
} from "../shared/domain";
import { projectSchema } from "../src/features/estudio/model";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
async function limitedBody(req: Request, max: number) {
  if (Number(req.headers.get("content-length")) > max)
    throw new HttpError(413, "Arquivo ou conteúdo muito grande.");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new HttpError(413, "Arquivo ou conteúdo muito grande.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let i = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, i);
    i += chunk.length;
  }
  return bytes;
}
async function body(req: Request, max = 100_000): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await limitedBody(req, max)));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "JSON inválido.");
  }
}
function writer(user: Member) {
  if (!canWrite(user))
    throw new HttpError(403, "Seu perfil não permite editar.");
}
function audit(env: Env, user: Member, action: string, id: string) {
  return env.DB.prepare(
    "INSERT INTO audit_log(id,email,action,entity_id) VALUES(?,?,?,?)",
  ).bind(crypto.randomUUID(), user.email, action, id);
}
async function getContent(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT * FROM contents WHERE id=?")
    .bind(id)
    .first<{
      id: string;
      data: string;
      revision: number;
      updated_at: string;
    }>();
  if (!row) throw new HttpError(404, "Conteúdo não encontrado.");
  return row;
}
async function api(req: Request, env: Env) {
  const url = new URL(req.url),
    path = url.pathname,
    method = req.method;
  // Requisições de escrita só da mesma origem, além da sessão validada.
  if (
    !["GET", "HEAD"].includes(method) &&
    req.headers.get("origin") !== url.origin
  )
    throw new HttpError(403, "Origem da requisição inválida.");
  const user = await authenticate(req, env);
  if (path === "/api/me" && method === "GET") return json({ user });
  if (user.status !== "aprovado")
    throw new HttpError(
      403,
      "Seu acesso aguarda liberação de um administrador.",
    );
  if (path === "/api/team" && method === "GET") {
    const fields =
      user.role === "admin"
        ? "email,name,role,status"
        : "email,name,role,status";
    const result = await env.DB.prepare(
      `SELECT ${fields} FROM members WHERE status='aprovado' OR ?='admin' ORDER BY name`,
    )
      .bind(user.role)
      .all();
    return json(result.results);
  }
  if (path === "/api/team" && method === "PATCH") {
    requireAdmin(user);
    const data = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "editor", "visualizador"]),
        status: z.enum(["pendente", "aprovado", "recusado"]),
      })
      .parse(await body(req));
    if (data.email === user.email)
      throw new HttpError(
        400,
        "Peça a outro administrador para alterar seu próprio acesso.",
      );
    const result = await env.DB.batch([
      env.DB.prepare("UPDATE members SET role=?,status=? WHERE email=?").bind(
        data.role,
        data.status,
        data.email,
      ),
      audit(env, user, "team.update", data.email),
    ]);
    if (!result[0].meta.changes)
      throw new HttpError(404, "Membro não encontrado.");
    return json({ ok: true });
  }
  if (path === "/api/contents" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT id,data,revision,updated_at FROM contents ORDER BY updated_at DESC LIMIT 1000",
    ).all<{ id: string; data: string; revision: number; updated_at: string }>();
    return json(
      result.results.map((r) => ({
        ...JSON.parse(r.data),
        id: r.id,
        revision: r.revision,
        updated_at: r.updated_at,
      })),
    );
  }
  if (path === "/api/contents" && method === "POST") {
    const data = contentSchema.parse(await body(req));
    try {
      assertTransition(user, null, data.status);
    } catch (e) {
      throw new HttpError(403, (e as Error).message);
    }
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO contents(id,data,created_by,updated_by) VALUES(?,?,?,?)",
      ).bind(id, JSON.stringify(data), user.email, user.email),
      audit(env, user, "content.create", id),
    ]);
    return json({ ...data, id, revision: 1 }, 201);
  }
  const contentRoute = path.match(/^\/api\/contents\/([a-z0-9-]+)$/);
  if (contentRoute && method === "PUT") {
    writer(user);
    const schema = z.object({
      data: contentSchema,
      revision: z.number().int().positive(),
    });
    const payload = schema.parse(await body(req));
    const old = await getContent(env, contentRoute[1]);
    try {
      assertTransition(user, JSON.parse(old.data).status, payload.data.status);
    } catch (e) {
      throw new HttpError(403, (e as Error).message);
    }
    const result = await env.DB.prepare(
      "UPDATE contents SET data=?,revision=revision+1,updated_by=?,updated_at=datetime('now') WHERE id=? AND revision=?",
    )
      .bind(JSON.stringify(payload.data), user.email, old.id, payload.revision)
      .run();
    if (!result.meta.changes)
      throw new HttpError(
        409,
        "Outra pessoa alterou este conteúdo. Atualize a página antes de salvar.",
      );
    await audit(env, user, "content.update", old.id).run();
    return json({ ok: true });
  }
  if (contentRoute && method === "DELETE") {
    requireAdmin(user);
    const old = await getContent(env, contentRoute[1]);
    const files = await env.DB.prepare(
      "SELECT object_key FROM attachments WHERE content_id=?",
    )
      .bind(old.id)
      .all<{ object_key: string }>();
    const dispatched = await env.DB.prepare(
      "SELECT id FROM dispatches WHERE content_id=? LIMIT 1",
    )
      .bind(old.id)
      .first();
    if (dispatched)
      throw new HttpError(
        409,
        "Conteúdo enviado à automação deve ser preservado no histórico.",
      );
    if (files.results.length)
      await env.FILES.delete(files.results.map((f) => f.object_key));
    await env.DB.batch([
      env.DB.prepare("DELETE FROM contents WHERE id=?").bind(old.id),
      audit(env, user, "content.delete", old.id),
    ]);
    return json({ ok: true });
  }
  if (path === "/api/arts" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT id,title,revision,updated_at FROM art_projects ORDER BY updated_at DESC LIMIT 200",
    ).all();
    return json(result.results);
  }
  const artRoute = path.match(/^\/api\/arts\/([a-z0-9-]+)$/);
  if (artRoute && method === "GET") {
    const row = await env.DB.prepare(
      "SELECT object_key,revision FROM art_projects WHERE id=?",
    )
      .bind(artRoute[1])
      .first<{ object_key: string; revision: number }>();
    if (!row) throw new HttpError(404, "Projeto não encontrado.");
    const object = await env.FILES.get(row.object_key);
    if (!object) throw new HttpError(404, "Arquivo do projeto não encontrado.");
    return json({
      project: JSON.parse(await object.text()),
      revision: row.revision,
    });
  }
  if (artRoute && method === "PUT") {
    writer(user);
    const payload = z
      .object({ project: projectSchema, revision: z.number().int().positive() })
      .parse(await body(req, 16 * 1024 * 1024));
    const old = await env.DB.prepare(
      "SELECT object_key,revision FROM art_projects WHERE id=?",
    )
      .bind(artRoute[1])
      .first<{ object_key: string; revision: number }>();
    if (!old) throw new HttpError(404, "Projeto não encontrado.");
    const key = "arts/" + artRoute[1] + "/" + crypto.randomUUID() + ".json";
    await env.FILES.put(key, JSON.stringify(payload.project), {
      httpMetadata: { contentType: "application/json" },
    });
    const result = await env.DB.prepare(
      "UPDATE art_projects SET title=?,object_key=?,revision=revision+1,updated_at=datetime('now') WHERE id=? AND revision=?",
    )
      .bind(payload.project.name, key, artRoute[1], payload.revision)
      .run();
    if (!result.meta.changes) {
      await env.FILES.delete(key);
      throw new HttpError(
        409,
        "Outra pessoa alterou este projeto. Reabra a versão salva antes de continuar.",
      );
    }
    await env.FILES.delete(old.object_key);
    await audit(env, user, "art.update", artRoute[1]).run();
    return json({ id: artRoute[1] });
  }
  if (path === "/api/arts" && method === "POST") {
    writer(user);
    const project = projectSchema.parse(await body(req, 16 * 1024 * 1024));
    const id = crypto.randomUUID(),
      key = `arts/${id}.json`;
    await env.FILES.put(key, JSON.stringify(project), {
      httpMetadata: { contentType: "application/json" },
    });
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO art_projects(id,title,object_key,created_by) VALUES(?,?,?,?)",
        ).bind(id, project.name, key, user.email),
        audit(env, user, "art.create", id),
      ]);
    } catch (e) {
      await env.FILES.delete(key);
      throw e;
    }
    return json({ id }, 201);
  }
  if (path === "/api/ai" && method === "POST") {
    writer(user);
    const data = z
      .object({
        prompt: z.string().min(1).max(25000),
        mode: z.enum(["escrita", "revisao", "cortes"]),
      })
      .parse(await body(req));
    const bucket = Math.floor(Date.now() / 60000);
    const usage = await env.DB.prepare(
      "INSERT INTO rate_limits(email,bucket,count) VALUES(?,?,1) ON CONFLICT(email,bucket) DO UPDATE SET count=count+1 RETURNING count",
    )
      .bind(user.email, bucket)
      .first<{ count: number }>();
    if ((usage?.count ?? 99) > 5)
      throw new HttpError(429, "Aguarde um minuto antes de gerar novamente.");
    const task =
      data.mode === "cortes"
        ? "Analise a transcrição fornecida e sugira cortes com início e fim SOMENTE quando houver marcações de tempo no texto. Nunca invente timecodes. Gere também ideias de posts. Não afirme que produziu arquivos de vídeo."
        : data.mode === "revisao"
          ? "Revise o texto, preservando a voz e o sentido do autor. Explique brevemente mudanças relevantes."
          : "Ajude a escrever conteúdo editorial adequado ao objetivo e canal informado.";
    const result = await env.AI.run(env.AI_MODEL as Parameters<Ai["run"]>[0], {
      messages: [
        {
          role: "system",
          content: `Você é o assistente editorial da Editora NPE. Responda em português brasileiro com clareza, sem promessas de vendas garantidas. Não invente fatos, resultados, depoimentos ou dados. ${task}`,
        },
        { role: "user", content: data.prompt },
      ],
      max_tokens: 2000,
    });
    const text = (result as { response?: string }).response;
    if (!text)
      throw new HttpError(
        502,
        "A IA não devolveu texto. Verifique o modelo configurado.",
      );
    return json({ text });
  }
  const fileList = path.match(/^\/api\/contents\/([a-z0-9-]+)\/files$/);
  if (fileList && method === "GET") {
    await getContent(env, fileList[1]);
    const result = await env.DB.prepare(
      "SELECT id,filename,mime,size FROM attachments WHERE content_id=? ORDER BY created_at DESC",
    )
      .bind(fileList[1])
      .all();
    return json(result.results);
  }
  if (fileList && method === "POST") {
    writer(user);
    const item = await getContent(env, fileList[1]);
    try {
      assertTransition(
        user,
        JSON.parse(item.data).status,
        JSON.parse(item.data).status,
      );
    } catch (e) {
      throw new HttpError(403, (e as Error).message);
    }
    const mime = req.headers.get("content-type") ?? "";
    if (
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/pdf",
        "video/mp4",
        "text/plain",
        "application/json",
      ].includes(mime)
    )
      throw new HttpError(415, "Formato de arquivo não permitido.");
    const bytes = await limitedBody(req, 25 * 1024 * 1024);
    if (!bytes.length) throw new HttpError(400, "Arquivo vazio.");
    const filename = decodeURIComponent(
      req.headers.get("x-file-name") ?? "arquivo",
    )
      .replace(/[\r\n/\\]/g, "_")
      .slice(0, 180);
    const id = crypto.randomUUID(),
      key = `attachments/${item.id}/${id}`;
    await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      await env.DB.prepare(
        "INSERT INTO attachments(id,content_id,object_key,filename,mime,size,created_by) VALUES(?,?,?,?,?,?,?)",
      )
        .bind(id, item.id, key, filename, mime, bytes.length, user.email)
        .run();
    } catch (e) {
      await env.FILES.delete(key);
      throw e;
    }
    return json({ id }, 201);
  }
  const fileRoute = path.match(/^\/api\/files\/([a-z0-9-]+)$/);
  if (fileRoute && method === "GET") {
    const row = await env.DB.prepare("SELECT * FROM attachments WHERE id=?")
      .bind(fileRoute[1])
      .first<{ object_key: string; filename: string; mime: string }>();
    if (!row) throw new HttpError(404, "Anexo não encontrado.");
    const object = await env.FILES.get(row.object_key);
    if (!object) throw new HttpError(404, "Arquivo não encontrado.");
    return new Response(object.body, {
      headers: {
        "Content-Type": row.mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path === "/api/dispatches" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id,content_id,revision,state,created_at FROM dispatches ORDER BY created_at DESC LIMIT 200",
    ).all();
    return json(rows.results);
  }
  const dispatchRoute = path.match(/^\/api\/contents\/([a-z0-9-]+)\/dispatch$/);
  if (dispatchRoute && method === "POST") {
    requireAdmin(user);
    if (!env.N8N_WEBHOOK_URL || !env.N8N_WEBHOOK_SECRET)
      throw new HttpError(
        503,
        "Configure o endereço e o segredo do webhook n8n no Worker.",
      );
    if (new URL(env.N8N_WEBHOOK_URL).protocol !== "https:")
      throw new HttpError(503, "O webhook deve usar HTTPS.");
    const item = await getContent(env, dispatchRoute[1]),
      data = JSON.parse(item.data) as ContentData;
    if (data.status !== "Aprovado")
      throw new HttpError(
        409,
        "Somente conteúdos aprovados podem ser enviados ao n8n.",
      );
    const eventId = `${item.id}:${item.revision}`;
    const inserted = await env.DB.prepare(
      "INSERT OR IGNORE INTO dispatches(id,content_id,revision,state,created_by) VALUES(?,?,?,'enviando',?)",
    )
      .bind(eventId, item.id, item.revision, user.email)
      .run();
    if (!inserted.meta.changes)
      throw new HttpError(
        409,
        "Esta versão já foi enviada ou está em verificação. Confira o histórico e o n8n antes de reenviar.",
      );
    try {
      const res = await fetch(env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-NPE-Secret": env.N8N_WEBHOOK_SECRET,
          "Idempotency-Key": eventId,
        },
        body: JSON.stringify({
          version: 1,
          event: "content.approved",
          eventId,
          timezone: "America/Sao_Paulo",
          content: { ...data, id: item.id, revision: item.revision },
        }),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!res.ok) throw new Error("Webhook recusou a requisição.");
      await env.DB.prepare(
        "UPDATE dispatches SET state='aceito',updated_at=datetime('now') WHERE id=?",
      )
        .bind(eventId)
        .run();
      return json({
        ok: true,
        message:
          "Recebido pelo n8n. A publicação ainda precisa ser executada e confirmada.",
      });
    } catch {
      await env.DB.prepare(
        "UPDATE dispatches SET state='falhou',updated_at=datetime('now') WHERE id=?",
      )
        .bind(eventId)
        .run();
      throw new HttpError(
        502,
        "Não foi possível confirmar o recebimento. Verifique o n8n antes de tentar uma nova versão.",
      );
    }
  }
  throw new HttpError(404, "Rota não encontrada.");
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (!new URL(req.url).pathname.startsWith("/api/"))
      return env.ASSETS.fetch(req);
    try {
      return await api(req, env);
    } catch (e) {
      if (e instanceof z.ZodError)
        return json(
          {
            error: "Revise os campos enviados.",
            details: e.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
          400,
        );
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("Falha interna na API NPE");
      return json(
        {
          error:
            "Não foi possível concluir. Verifique a configuração e tente novamente.",
        },
        500,
      );
    }
  },
};
