export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({
      error:
        "API indisponível. Configure o Worker e o Cloudflare Access para entrar.",
    }));
  if (!response.ok || data.error)
    throw new Error(data.error || "Não foi possível concluir a operação.");
  return data as T;
}
