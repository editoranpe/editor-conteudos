import { useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  Palette,
  Sparkles,
  Scissors,
  Users,
  Workflow,
  Plus,
  Search,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Download,
  Paperclip,
  Send,
  BookOpen,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/Notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND } from "@/config/brand";
import { Studio } from "@/features/estudio/Studio";
import { novoProjeto, type Projeto } from "@/features/estudio/model";
import { api } from "@/lib/api";
import {
  frentes,
  canais,
  statuses,
  contentSchema,
  canWrite,
  canApprove,
  type Content,
  type ContentData,
  type Member,
} from "../shared/domain";

const nav = [
  ["painel", "Visão geral", LayoutDashboard],
  ["pautas", "Pautas e produção", ListTodo],
  ["calendario", "Calendário", CalendarDays],
  ["estudio", "Estúdio de artes", Palette],
  ["assistente", "Escrita com IA", Sparkles],
  ["cortes", "Lives em conteúdos", Scissors],
  ["equipe", "Equipe", Users],
  ["automacoes", "Automações", Workflow],
] as const;
type Tab = (typeof nav)[number][0];
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const newContent = (): ContentData => ({
  title: "",
  body: "",
  frente: "Editora NPE",
  canal: "Instagram",
  campanha: "",
  formato: "Carrossel",
  responsible: "",
  date: "",
  time: "19:00",
  status: "Ideia",
});
const demoUser: Member = {
  name: "Equipe NPE • demonstração",
  email: "demo@example.com",
  role: "admin",
  status: "aprovado",
};
function demoContents(): Content[] {
  return [
    {
      ...newContent(),
      id: "demo-1",
      title: "Sua história merece um livro",
      body: "Apresente o primeiro passo para tirar o livro da gaveta.",
      campanha: "Construção de legado",
      responsible: "demo@example.com",
      date: today(),
      status: "Em produção",
      revision: 1,
      updated_at: new Date().toISOString(),
    },
    {
      ...newContent(),
      id: "demo-2",
      title: "O segredo dos primeiros 100 livros",
      body: "Planejar conteúdo prático sobre leitores interessados no tema da obra.",
      frente: "Método EPV",
      formato: "Live",
      canal: "YouTube",
      status: "Em revisão",
      revision: 1,
      updated_at: new Date().toISOString(),
    },
    {
      ...newContent(),
      id: "demo-3",
      title: "Os bastidores de uma nova história",
      body: "Compartilhe uma etapa real do processo de escrita.",
      frente: "Livros e autores",
      campanha: "Lançamentos",
      formato: "Reels",
      status: "Ideia",
      revision: 1,
      updated_at: new Date().toISOString(),
    },
  ];
}
interface Art {
  id: string;
  title: string;
  revision: number;
}
interface Dispatch {
  id: string;
  content_id: string;
  revision: number;
  state: string;
  created_at: string;
}

export default function App() {
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  const [user, setUser] = useState<Member | null>(preview ? demoUser : null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!preview);
  const [tab, setTab] = useState<Tab>("painel"),
    [contents, setContents] = useState<Content[]>(preview ? demoContents : []),
    [members, setMembers] = useState<Member[]>(preview ? [demoUser] : []),
    [arts, setArts] = useState<Art[]>([]),
    [artData, setArtData] = useState<Record<string, Projeto>>({}),
    [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [front, setFront] = useState("Todas as frentes"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("Todos os status");
  const [editing, setEditing] = useState<Content | null | undefined>(undefined),
    [draft, setDraft] = useState<ContentData>(newContent),
    [saving, setSaving] = useState(false);
  const [aiInput, setAiInput] = useState(""),
    [aiOutput, setAiOutput] = useState(""),
    [aiBusy, setAiBusy] = useState(false),
    [aiMode, setAiMode] = useState<"escrita" | "revisao">("escrita");
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const reload = async () => {
    if (preview) return;
    const [c, t, a, d] = await Promise.all([
      api<Content[]>("/contents"),
      api<Member[]>("/team"),
      api<Art[]>("/arts"),
      api<Dispatch[]>("/dispatches"),
    ]);
    setContents(c);
    setMembers(t);
    setArts(a);
    setDispatches(d);
  };
  useEffect(() => {
    if (preview) return;
    api<{ user: Member }>("/me")
      .then(async (r) => {
        setUser(r.user);
        if (r.user.status === "aprovado") await reload();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const filtered = contents.filter(
    (c) =>
      (front === "Todas as frentes" || c.frente === front) &&
      (status === "Todos os status" || c.status === status) &&
      `${c.title} ${c.campanha} ${c.body}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const open = (content: Content | null) => {
    setEditing(content);
    setDraft(content ? { ...content } : newContent());
  };
  const save = () =>
    run(async () => {
      const data = contentSchema.parse(draft);
      if (preview) {
        const row = {
          ...data,
          id: editing?.id ?? crypto.randomUUID(),
          revision: (editing?.revision ?? 0) + 1,
          updated_at: new Date().toISOString(),
        };
        setContents((prev) => [row, ...prev.filter((c) => c.id !== row.id)]);
      } else {
        if (editing)
          await api(`/contents/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify({ data, revision: editing.revision }),
          });
        else
          await api("/contents", {
            method: "POST",
            body: JSON.stringify(data),
          });
        await reload();
      }
      setEditing(undefined);
      toast.success(
        preview
          ? "Conteúdo atualizado nesta demonstração."
          : "Conteúdo salvo para a equipe.",
      );
    });
  const generate = async () => {
    if (preview) {
      toast.info(
        "A geração com IA fica disponível após configurar o Worker. Nenhuma chamada foi feita.",
      );
      return;
    }
    setAiBusy(true);
    try {
      const result = await api<{ text: string }>("/ai", {
        method: "POST",
        body: JSON.stringify({
          prompt: aiInput,
          mode: tab === "cortes" ? "cortes" : aiMode,
        }),
      });
      setAiOutput(result.text);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };
  const write = user ? canWrite(user) : false,
    admin = user ? canApprove(user) : false;
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <p>Carregando seu espaço editorial…</p>
      </div>
    );
  if (!user || user.status !== "aprovado")
    return (
      <>
        <Toaster />
        <main className="grid min-h-screen place-items-center bg-[#F4F2FA] p-6">
          <section className="max-w-lg space-y-5 rounded-3xl bg-white p-9 shadow-sm">
            <img src={BRAND.logo} alt={BRAND.company} className="w-40" />
            <h1 className="text-2xl font-bold">
              Seu próximo legado começa aqui.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {user
                ? "Seu acesso está pendente ou foi recusado. Peça a um administrador da equipe para verificar."
                : error || "Entre pelo endereço protegido do sistema."}
            </p>
            <Button onClick={() => location.reload()}>Tentar novamente</Button>
            <a
              className="ml-4 text-sm text-primary underline"
              href="?preview=1"
            >
              Experimentar o estúdio e a gestão
            </a>
            <p className="text-xs text-muted-foreground">
              A demonstração usa exemplos locais. Nenhum conteúdo da equipe fica
              disponível sem autenticação.
            </p>
          </section>
        </main>
      </>
    );
  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-[#F7F6FB] text-[#29263D]">
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-white px-5 py-7 lg:flex">
          <img src={BRAND.logo} alt={BRAND.company} className="mb-3 w-32" />
          <p className="mb-9 text-[10px] uppercase tracking-[.2em] text-muted-foreground">
            Editor de Conteúdos
          </p>
          <nav className="space-y-2">
            {nav.map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors ${tab === key ? "bg-[#393580] text-white" : "text-muted-foreground hover:bg-[#F4F2FA]"}`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-xl bg-[#FFCC00]/15 p-4">
            <BookOpen size={20} className="mb-3 text-[#393580]" />
            <p className="text-sm font-semibold">
              Nossa História é<br />
              Criar Legados!
            </p>
          </div>
          <p className="mt-5 truncate text-xs text-muted-foreground">
            {user.name}
          </p>
        </aside>
        <div className="lg:ml-60">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-4 sm:px-8">
            <div>
              <p className="text-sm font-medium">Seu espaço editorial</p>
              <p className="text-xs text-muted-foreground">
                Ideias que ganham forma. Histórias que deixam marcas.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {preview ? (
                <span className="rounded-full bg-[#FFCC00]/20 px-3 py-2 text-xs">
                  Demonstração • dados temporários
                </span>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    {user.role}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Sair"
                    onClick={() => (location.href = "/cdn-cgi/access/logout")}
                  >
                    <LogOut size={16} />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() =>
                  void run(async () => {
                    await reload();
                    toast.success(
                      preview
                        ? "Você está na demonstração."
                        : "Dados atualizados.",
                    );
                  })
                }
              >
                <RefreshCw size={14} />
                <span className="ml-2">Atualizar</span>
              </Button>
            </div>
          </header>
          <div className="p-4 lg:hidden">
            <select
              aria-label="Navegação"
              className="npe-select"
              value={tab}
              onChange={(e) => setTab(e.target.value as Tab)}
            >
              {nav.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <main className="mx-auto max-w-[1500px] space-y-7 p-4 sm:p-8">
            {tab === "estudio" ? (
              <Studio
                canEdit={write}
                saved={arts.map((a) => ({
                  id: a.id,
                  title: a.title,
                  content: preview ? JSON.stringify(artData[a.id]) : undefined,
                }))}
                onLoad={async (id) =>
                  (await api<{ project: Projeto }>(`/arts/${id}`)).project
                }
                onSave={async (project, id) => {
                  if (preview) {
                    const id = crypto.randomUUID();
                    setArts((a) => [
                      { id, title: project.name, revision: 1 },
                      ...a,
                    ]);
                    setArtData((a) => ({ ...a, [id]: project }));
                    toast.info(
                      "Projeto guardado apenas nesta demonstração. Baixe o editável para conservar.",
                    );
                    return id;
                  }
                  const r = id
                    ? await api<{ id: string }>(`/arts/${id}`, {
                        method: "PUT",
                        body: JSON.stringify({
                          project,
                          revision: arts.find((a) => a.id === id)?.revision,
                        }),
                      })
                    : await api<{ id: string }>("/arts", {
                        method: "POST",
                        body: JSON.stringify(project),
                      });
                  await reload();
                  return r.id;
                }}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#BD0066]">
                      Planejar • Criar • Compartilhar
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                      {tab === "painel"
                        ? "Mais clareza para criar."
                        : nav.find(([k]) => k === tab)?.[1]}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {tab === "painel"
                        ? "Acompanhe a produção e escolha o próximo passo da sua equipe."
                        : tab === "pautas"
                          ? "Do primeiro rascunho à aprovação, cada conteúdo tem seu lugar."
                          : tab === "calendario"
                            ? "Organize as datas da equipe. Agendar aqui não publica nas redes."
                            : tab === "cortes"
                              ? "Cole uma transcrição para encontrar oportunidades de novos conteúdos."
                              : tab === "assistente"
                                ? "Escreva e revise preservando a voz de quem tem uma história para contar."
                                : tab === "equipe"
                                  ? "Pessoas, responsabilidades e acesso ao espaço editorial."
                                  : "Envios ao n8n com aprovação e histórico de recebimento."}
                    </p>
                  </div>
                  {["painel", "pautas", "calendario"].includes(tab) &&
                    write && (
                      <Button
                        className="bg-[#BD0066] hover:bg-[#A60059]"
                        onClick={() => open(null)}
                      >
                        <Plus size={17} className="mr-2" />
                        Nova pauta
                      </Button>
                    )}
                </div>
                {["painel", "pautas", "calendario"].includes(tab) && (
                  <div className="flex flex-wrap gap-3">
                    <select
                      aria-label="Filtrar por frente"
                      className="npe-select max-w-xs"
                      value={front}
                      onChange={(e) => setFront(e.target.value)}
                    >
                      <option>Todas as frentes</option>
                      {frentes.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        aria-label="Buscar conteúdo"
                        className="pl-10"
                        placeholder="Buscar tema, campanha ou livro…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Filtrar por status"
                      className="npe-select max-w-[210px]"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option>Todos os status</option>
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
                {tab === "painel" && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        [
                          "Na produção",
                          filtered.filter((c) =>
                            ["Ideia", "Em produção"].includes(c.status),
                          ).length,
                          "Um passo de cada vez",
                        ],
                        [
                          "Para revisar",
                          filtered.filter((c) => c.status === "Em revisão")
                            .length,
                          "Seu olhar faz a diferença",
                        ],
                        [
                          "Aprovados",
                          filtered.filter((c) => c.status === "Aprovado")
                            .length,
                          "Prontos para o próximo passo",
                        ],
                        [
                          "Publicados",
                          filtered.filter((c) => c.status === "Publicado")
                            .length,
                          "Histórias compartilhadas",
                        ],
                      ].map(([label, value, hint]) => (
                        <section
                          key={label}
                          className="rounded-2xl border bg-white p-6"
                        >
                          <p className="text-sm text-muted-foreground">
                            {label}
                          </p>
                          <p className="my-3 text-4xl font-semibold text-[#393580]">
                            {value}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {hint}
                          </p>
                        </section>
                      ))}
                    </div>
                    <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#393580] p-7 text-white">
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-widest text-[#FFCC00]">
                          Da ideia à arte
                        </p>
                        <h2 className="text-xl font-semibold">
                          Sua próxima mensagem já tem identidade.
                        </h2>
                        <p className="mt-2 text-sm text-white/75">
                          Modelos NPE, textos e imagens. Preencha e baixe seu
                          carrossel.
                        </p>
                      </div>
                      <Button
                        className="bg-white text-[#393580] hover:bg-white/90"
                        onClick={() => setTab("estudio")}
                      >
                        Abrir estúdio
                        <ArrowRight size={16} className="ml-2" />
                      </Button>
                    </section>
                    <ContentTable
                      contents={filtered.slice(0, 8)}
                      onOpen={open}
                    />
                  </>
                )}
                {tab === "pautas" && (
                  <ContentTable contents={filtered} onOpen={open} />
                )}
                {tab === "calendario" && (
                  <Calendar
                    contents={filtered}
                    month={month}
                    onMonth={setMonth}
                    onOpen={open}
                  />
                )}
                {(tab === "assistente" || tab === "cortes") && (
                  <div className="grid gap-6 xl:grid-cols-2">
                    <section className="space-y-4 rounded-2xl border bg-white p-6">
                      {tab === "assistente" && (
                        <select
                          aria-label="Objetivo da IA"
                          className="npe-select"
                          value={aiMode}
                          onChange={(e) =>
                            setAiMode(e.target.value as typeof aiMode)
                          }
                        >
                          <option value="escrita">Criar conteúdo</option>
                          <option value="revisao">Revisar texto</option>
                        </select>
                      )}
                      <Label htmlFor="ai-prompt">
                        {tab === "cortes"
                          ? "Transcrição com marcações de tempo"
                          : "Tema, objetivo e instruções"}
                      </Label>
                      <Textarea
                        id="ai-prompt"
                        rows={14}
                        value={aiInput}
                        maxLength={25000}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder={
                          tab === "cortes"
                            ? "[00:00] Cole aqui a transcrição da sua live…"
                            : "Ex.: crie uma legenda para Instagram sobre como planejar a pré-venda de um livro, com tom próximo e um convite para conversar com a NPE."
                        }
                      />
                      <Button
                        disabled={!write || !aiInput.trim() || aiBusy}
                        onClick={() => void generate()}
                      >
                        {aiBusy
                          ? "Preparando…"
                          : tab === "cortes"
                            ? "Encontrar cortes e posts"
                            : "Gerar texto"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {tab === "cortes"
                          ? "A análise sugere trechos e textos. Esta versão não recorta nem renderiza o vídeo."
                          : "A IA roda no Workers AI e depende da configuração na conta Cloudflare."}
                      </p>
                    </section>
                    <section className="space-y-4 rounded-2xl border bg-white p-6">
                      <h2 className="font-semibold">
                        Seu rascunho começa aqui
                      </h2>
                      <Textarea
                        aria-label="Resultado editável da IA"
                        rows={17}
                        value={aiOutput}
                        onChange={(e) => setAiOutput(e.target.value)}
                        placeholder="A resposta da IA aparecerá aqui para você revisar."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={!aiOutput || !write}
                          onClick={() => {
                            open(null);
                            setDraft({
                              ...newContent(),
                              title: "Rascunho criado com IA",
                              body: aiOutput.slice(0, 20000),
                            });
                          }}
                        >
                          Transformar em pauta
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!aiOutput}
                          onClick={() => {
                            const a = document.createElement("a");
                            const url = URL.createObjectURL(
                              new Blob([aiOutput], {
                                type: "text/plain;charset=utf-8",
                              }),
                            );
                            a.href = url;
                            a.download = "rascunho-npe.txt";
                            a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 10000);
                          }}
                        >
                          <Download size={16} className="mr-2" />
                          Baixar texto
                        </Button>
                      </div>
                    </section>
                  </div>
                )}
                {tab === "equipe" && (
                  <div className="space-y-4">
                    {members.map((m) => (
                      <section
                        key={m.email}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"
                      >
                        <div>
                          <p className="font-semibold">{m.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {m.email}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                            {m.status}
                          </span>
                          <span className="text-sm">{m.role}</span>
                          {admin && m.email !== user.email && (
                            <>
                              <select
                                aria-label={`Papel de ${m.name}`}
                                className="npe-select w-40"
                                value={m.role}
                                onChange={(e) =>
                                  void run(async () => {
                                    await api("/team", {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        ...m,
                                        role: e.target.value,
                                      }),
                                    });
                                    await reload();
                                  })
                                }
                              >
                                {["admin", "editor", "visualizador"].map(
                                  (r) => (
                                    <option key={r}>{r}</option>
                                  ),
                                )}
                              </select>
                              <Button
                                variant="outline"
                                disabled={saving}
                                onClick={() =>
                                  void run(async () => {
                                    await api("/team", {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        ...m,
                                        status:
                                          m.status === "aprovado"
                                            ? "recusado"
                                            : "aprovado",
                                      }),
                                    });
                                    await reload();
                                  })
                                }
                              >
                                {m.status === "aprovado"
                                  ? "Revogar"
                                  : "Liberar acesso"}
                              </Button>
                            </>
                          )}
                        </div>
                      </section>
                    ))}
                    <p className="text-sm text-muted-foreground">
                      O acesso começa pelo e-mail autorizado no Cloudflare
                      Access. Novos membros aparecem aqui após o primeiro login.
                    </p>
                  </div>
                )}
                {tab === "automacoes" && (
                  <div className="space-y-5">
                    <section className="rounded-2xl border bg-white p-6">
                      <h2 className="font-semibold">
                        Aprovar → enviar → acompanhar
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                        Somente administradores enviam conteúdos aprovados. Cada
                        versão tem uma identificação única para evitar envios
                        duplicados. O fluxo n8n precisa estar configurado para o
                        canal de destino. O status de publicação deve ser
                        confirmado após a execução.
                      </p>
                    </section>
                    {contents
                      .filter((c) => c.status === "Aprovado")
                      .map((c) => (
                        <section
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"
                        >
                          <div>
                            <h3 className="font-semibold">{c.title}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {c.canal} • {c.date || "Sem data"} às {c.time} •
                              versão {c.revision}
                            </p>
                          </div>
                          <Button
                            disabled={!admin || saving || preview}
                            onClick={() =>
                              void run(async () => {
                                const r = await api<{ message: string }>(
                                  `/contents/${c.id}/dispatch`,
                                  { method: "POST", body: "{}" },
                                );
                                toast.success(r.message);
                                await reload();
                              })
                            }
                          >
                            <Send size={15} className="mr-2" />
                            Enviar ao n8n
                          </Button>
                        </section>
                      ))}
                    <section className="rounded-2xl border bg-white p-6">
                      <h2 className="mb-4 font-semibold">
                        Histórico de recebimento
                      </h2>
                      {dispatches.length ? (
                        dispatches.map((d) => (
                          <p key={d.id} className="border-t py-3 text-sm">
                            {contents.find((c) => c.id === d.content_id)
                              ?.title ?? d.content_id}{" "}
                            • versão {d.revision} • {d.state}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhum envio registrado.
                        </p>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
        <Dialog
          open={editing !== undefined}
          onOpenChange={(v) => {
            if (!v && !saving) setEditing(undefined);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? "Editar conteúdo"
                  : "Uma nova ideia para compartilhar"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={draft.title}
                maxLength={180}
                disabled={!write}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["frente", "Frente", frentes],
                  ["canal", "Canal", canais],
                  [
                    "formato",
                    "Formato",
                    [
                      "Carrossel",
                      "Estático",
                      "Reels",
                      "Vídeo",
                      "Artigo",
                      "Live",
                    ],
                  ],
                  [
                    "status",
                    "Etapa",
                    statuses.filter(
                      (s) => admin || !["Aprovado", "Publicado"].includes(s),
                    ),
                  ],
                ].map(([key, label, options]) => (
                  <div key={String(key)}>
                    <Label htmlFor={String(key)}>{String(label)}</Label>
                    <select
                      id={String(key)}
                      className="npe-select mt-2"
                      disabled={!write}
                      value={draft[key as keyof ContentData]}
                      onChange={(e) =>
                        setDraft({ ...draft, [String(key)]: e.target.value })
                      }
                    >
                      {(options as readonly string[]).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="campaign">Campanha, livro ou autor</Label>
                <Input
                  id="campaign"
                  className="mt-2"
                  value={draft.campanha}
                  disabled={!write}
                  maxLength={120}
                  onChange={(e) =>
                    setDraft({ ...draft, campanha: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="owner">Responsável</Label>
                  <select
                    id="owner"
                    className="npe-select mt-2"
                    disabled={!write}
                    value={draft.responsible}
                    onChange={(e) =>
                      setDraft({ ...draft, responsible: e.target.value })
                    }
                  >
                    <option value="">A definir</option>
                    {members
                      .filter((m) => m.status === "aprovado")
                      .map((m) => (
                        <option key={m.email} value={m.email}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    className="mt-2"
                    value={draft.date}
                    disabled={!write}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="time">Horário de Brasília</Label>
                  <Input
                    id="time"
                    type="time"
                    className="mt-2"
                    value={draft.time}
                    disabled={!write}
                    onChange={(e) =>
                      setDraft({ ...draft, time: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="body">Texto, roteiro ou briefing</Label>
                <Textarea
                  id="body"
                  className="mt-2"
                  rows={7}
                  disabled={!write}
                  maxLength={20000}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </div>
              {editing && !preview && (
                <Attachments
                  id={editing.id}
                  canEdit={
                    write &&
                    (admin ||
                      !["Aprovado", "Publicado"].includes(editing.status))
                  }
                />
              )}
              <div className="flex flex-wrap justify-between gap-3">
                {editing && admin && (
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      if (!confirm("Excluir este conteúdo e seus anexos?"))
                        return;
                      void run(async () => {
                        if (preview)
                          setContents((c) =>
                            c.filter((r) => r.id !== editing.id),
                          );
                        else {
                          await api(`/contents/${editing.id}`, {
                            method: "DELETE",
                          });
                          await reload();
                        }
                        setEditing(undefined);
                      });
                    }}
                  >
                    Excluir conteúdo
                  </Button>
                )}
                <Button
                  className="ml-auto"
                  disabled={
                    !write ||
                    saving ||
                    !draft.title.trim() ||
                    (!admin &&
                      Boolean(
                        editing &&
                        ["Aprovado", "Publicado"].includes(editing.status),
                      ))
                  }
                  onClick={() => void save()}
                >
                  {saving ? "Salvando…" : "Salvar conteúdo"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

function ContentTable({
  contents,
  onOpen,
}: {
  contents: Content[];
  onOpen: (c: Content) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="border-b p-5">
        <h2 className="font-semibold">Conteúdos em movimento</h2>
      </div>
      {!contents.length ? (
        <p className="p-8 text-sm text-muted-foreground">
          Nenhum conteúdo encontrado. Crie uma pauta ou ajuste os filtros.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF9FD] text-xs text-muted-foreground">
              <tr>
                {["Conteúdo", "Frente / Canal", "Etapa", "Data"].map((h) => (
                  <th key={h} className="px-5 py-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contents.map((c) => (
                <tr key={c.id} className="border-t hover:bg-[#FAF9FD]">
                  <td className="min-w-[240px] px-5 py-4">
                    <button
                      className="text-left font-semibold text-[#393580] hover:underline"
                      onClick={() => onOpen(c)}
                    >
                      {c.title}
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.campanha || c.formato}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p>{c.frente}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.canal}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${c.status === "Aprovado" ? "bg-green-50 text-green-800" : c.status === "Em revisão" ? "bg-amber-50 text-amber-800" : "bg-[#F0EDF9] text-[#393580]"}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                    {c.date
                      ? c.date.split("-").reverse().join("/")
                      : "A definir"}
                    {c.date && <p className="mt-1">{c.time}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function Calendar({
  contents,
  month,
  onMonth,
  onOpen,
}: {
  contents: Content[];
  month: string;
  onMonth: (v: string) => void;
  onOpen: (c: Content) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1).getDay(),
    days = new Date(y, m, 0).getDate();
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    onMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex items-center justify-between p-5">
        <h2 className="text-lg font-semibold capitalize">
          {new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => shift(-1)}
          >
            <ArrowLeft size={16} />
          </Button>
          <Button
            variant="outline"
            onClick={() => onMonth(today().slice(0, 7))}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            onClick={() => shift(1)}
          >
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div
              key={d}
              className="border-t bg-[#FAF9FD] p-3 text-center text-xs text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: start + days }, (_, i) => {
            const day = i - start + 1,
              date = `${month}-${String(day).padStart(2, "0")}`;
            return (
              <div key={i} className="min-h-32 border-r border-t p-2">
                {day > 0 && (
                  <>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs ${date === today() ? "bg-[#393580] text-white" : ""}`}
                    >
                      {day}
                    </span>
                    <div className="mt-2 space-y-2">
                      {contents
                        .filter((c) => c.date === date)
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => onOpen(c)}
                            className="w-full rounded-lg border-l-2 border-[#BD0066] bg-[#F4F1FA] p-2 text-left text-[11px]"
                          >
                            <span className="block text-muted-foreground">
                              {c.time} • {c.canal}
                            </span>
                            {c.title}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
function Attachments({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [files, setFiles] = useState<
      { id: string; filename: string; size: number }[]
    >([]),
    [busy, setBusy] = useState(false);
  const load = () => api<typeof files>(`/contents/${id}/files`).then(setFiles);
  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [id]);
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip size={15} />
        Anexos
      </h3>
      {files.map((f) => (
        <a
          key={f.id}
          href={`/api/files/${f.id}`}
          className="block text-sm text-primary underline"
        >
          {f.filename} ({(f.size / 1024 / 1024).toFixed(1)} MB)
        </a>
      ))}
      {canEdit && (
        <>
          <Label htmlFor="attachment">Adicionar arquivo (até 25 MB)</Label>
          <Input
            id="attachment"
            type="file"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 25 * 1024 * 1024) {
                toast.error("Limite de 25 MB nesta versão.");
                return;
              }
              setBusy(true);
              try {
                await api(`/contents/${id}/files`, {
                  method: "POST",
                  body: file,
                  headers: {
                    "Content-Type": file.type,
                    "X-File-Name": encodeURIComponent(file.name),
                  },
                });
                await load();
                toast.success("Arquivo anexado.");
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </section>
  );
}
