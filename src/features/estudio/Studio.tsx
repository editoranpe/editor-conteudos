import { useEffect, useRef, useState } from "react";
import {
  Download,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Upload,
  ImagePlus,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FRENTES,
  CANAIS,
  MODELOS,
  FORMATOS,
  novoProjeto,
  projectSchema,
  type Projeto,
} from "./model";
import { renderSlide, imageFromFile, baixar, png } from "./render";
import { zipStore } from "./zip";

interface Props {
  canEdit: boolean;
  saved?: { id: string; title: string; content?: string }[];
  onLoad?: (id: string) => Promise<unknown>;
  onSave?: (project: Projeto, id: string | null) => Promise<string>;
  error?: string;
}
function PreviewSlide({ project, index }: { project: Projeto; index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setError("");
    renderSlide(project, index)
      .then((c) => {
        if (!alive || !ref.current) return;
        ref.current.width = c.width;
        ref.current.height = c.height;
        ref.current.getContext("2d")?.drawImage(c, 0, 0);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [project, index]);
  return (
    <div className="relative mx-auto max-w-[430px]">
      <canvas
        ref={ref}
        className="w-full rounded-2xl shadow-xl"
        aria-label={`Prévia do slide ${index + 1}: ${project.slides[index]?.title}`}
        role="img"
      />
      {error && (
        <p
          className="absolute inset-0 grid place-items-center rounded-2xl bg-background/95 p-8 text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function Studio({ canEdit, saved = [], onLoad, onSave, error }: Props) {
  const [project, setProject] = useState<Projeto>(novoProjeto);
  const [active, setActive] = useState(0);
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  const slide = project.slides[active];
  const edit = (patch: Partial<Projeto>) => {
    setProject((p) => ({ ...p, ...patch }));
    setDirty(true);
  };
  const editSlide = (patch: Partial<Projeto["slides"][number]>) =>
    edit({
      slides: project.slides.map((s, i) =>
        i === active ? { ...s, ...patch } : s,
      ),
    });
  const isEditable = canEdit && !busy;
  const check = () => projectSchema.parse(project);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  };
  const load = (p: unknown, nextId: string | null) => {
    const valid = projectSchema.parse(p);
    if (
      dirty &&
      !window.confirm(
        "Abrir outro projeto descarta as alterações ainda não salvas. Continuar?",
      )
    )
      return;
    setProject(valid);
    setId(nextId);
    setActive(0);
    setDirty(false);
  };
  const exportAll = () =>
    run(async () => {
      const valid = check(),
        files: { name: string; bytes: Uint8Array }[] = [];
      for (let n = 0; n < valid.slides.length; n++) {
        const blob = await png(await renderSlide(valid, n));
        files.push({
          name: `slide-${String(n + 1).padStart(2, "0")}.png`,
          bytes: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      files.push({
        name: "projeto-npe.json",
        bytes: new TextEncoder().encode(JSON.stringify(valid, null, 2)),
      });
      baixar(zipStore(files), "carrossel-npe.zip");
      toast.success("Carrossel exportado com PNGs e arquivo editável.");
    });
  const move = (direction: number) => {
    const target = active + direction;
    if (target < 0 || target >= project.slides.length) return;
    const next = [...project.slides];
    [next[active], next[target]] = [next[target], next[active]];
    edit({ slides: next });
    setActive(target);
  };
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#BD0066]">
            Criação • Identidade NPE
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Uma ideia. Muitos legados.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Escolha um modelo, escreva sua mensagem e prepare o próximo conteúdo
            da sua marca.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => importRef.current?.click()}
            disabled={!isEditable}
          >
            <Upload className="mr-2 h-4 w-4" />
            Abrir projeto
          </Button>
          <Button
            className="bg-[#BD0066] text-white hover:bg-[#A60059]"
            onClick={exportAll}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Baixar carrossel
          </Button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          Não foi possível carregar os projetos: {error}
        </p>
      )}
      {!canEdit && (
        <p className="rounded-xl bg-secondary p-4 text-sm">
          Seu acesso é de visualização. Você pode abrir projetos salvos e baixar
          as artes.
        </p>
      )}
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void run(async () => {
            if (file.size > 16 * 1024 * 1024)
              throw new Error("O projeto deve ter até 16 MB.");
            load(JSON.parse(await file.text()), null);
          });
        }}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(340px,1fr)_minmax(340px,1.05fr)]">
        <div className="space-y-5">
          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">1. Direção do conteúdo</h2>
              <span className="text-xs text-muted-foreground">
                {dirty ? "Alterações pendentes" : "Pronto para editar"}
              </span>
            </div>
            {onSave && (
              <div>
                <Label htmlFor="saved-project">Projetos da equipe</Label>
                <select
                  id="saved-project"
                  className="npe-select mt-2"
                  value={id ?? ""}
                  onChange={(e) => {
                    const s = saved.find((v) => v.id === e.target.value);
                    if (s)
                      void run(async () =>
                        load(
                          s.content
                            ? JSON.parse(s.content)
                            : await onLoad?.(s.id),
                          s.id,
                        ),
                      );
                  }}
                >
                  <option value="" disabled>
                    Escolha um projeto salvo
                  </option>
                  {saved.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="project-name">Nome do projeto</Label>
              <Input
                id="project-name"
                className="mt-2"
                maxLength={100}
                value={project.name}
                onChange={(e) => edit({ name: e.target.value })}
                disabled={!isEditable}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="frente">Frente</Label>
                <select
                  id="frente"
                  className="npe-select mt-2"
                  value={project.frente}
                  onChange={(e) =>
                    edit({ frente: e.target.value as Projeto["frente"] })
                  }
                  disabled={!isEditable}
                >
                  {FRENTES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="canal">Canal</Label>
                <select
                  id="canal"
                  className="npe-select mt-2"
                  value={project.canal}
                  onChange={(e) =>
                    edit({ canal: e.target.value as Projeto["canal"] })
                  }
                  disabled={!isEditable}
                >
                  {CANAIS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="campanha">Campanha, livro ou autor</Label>
              <Input
                id="campanha"
                className="mt-2"
                placeholder="Ex.: lançamento do livro, agenda do EPV…"
                maxLength={120}
                value={project.campanha}
                onChange={(e) => edit({ campanha: e.target.value })}
                disabled={!isEditable}
              />
            </div>
          </section>
          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">2. Seu modelo NPE</h2>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(MODELOS).map(([key, label]) => (
                <button
                  type="button"
                  aria-pressed={project.modelo === key}
                  key={key}
                  disabled={!isEditable}
                  onClick={() => edit({ modelo: key as Projeto["modelo"] })}
                  className={`relative rounded-xl border-2 p-3 text-left text-xs ${project.modelo === key ? "border-primary" : "border-border"}`}
                >
                  <span
                    className="mb-2 block h-12 rounded-lg"
                    style={{
                      background:
                        key === "clean"
                          ? "#F1EDF9"
                          : key === "destaque"
                            ? "#B50062"
                            : "#393580",
                    }}
                  />
                  <span>{label}</span>
                  {project.modelo === key && (
                    <Check className="absolute right-4 top-4 h-4 w-4 text-[#FFCC00]" />
                  )}
                </button>
              ))}
            </div>
            <div>
              <Label htmlFor="format">Formato de saída</Label>
              <select
                id="format"
                className="npe-select mt-2"
                value={project.formato}
                onChange={(e) =>
                  edit({ formato: e.target.value as Projeto["formato"] })
                }
                disabled={!isEditable}
              >
                {Object.entries(FORMATOS).map(([key, dims]) => (
                  <option key={key} value={key}>
                    {key === "retrato"
                      ? "Feed vertical"
                      : key === "stories"
                        ? "Stories"
                        : "Quadrado"}{" "}
                    · {dims[0]} × {dims[1]} px
                  </option>
                ))}
              </select>
            </div>
          </section>
          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                3. Mensagem do slide {active + 1}
              </h2>
              <span className="text-xs text-muted-foreground">
                Até 10 slides
              </span>
            </div>
            <div>
              <Label htmlFor="slide-title">Título</Label>
              <Textarea
                id="slide-title"
                className="mt-2 text-base"
                rows={3}
                maxLength={180}
                value={slide.title}
                onChange={(e) => editSlide({ title: e.target.value })}
                disabled={!isEditable}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {slide.title.length}/180
              </p>
            </div>
            <div>
              <Label htmlFor="slide-body">Texto de apoio</Label>
              <Textarea
                id="slide-body"
                className="mt-2"
                rows={4}
                maxLength={650}
                value={slide.body}
                onChange={(e) => editSlide({ body: e.target.value })}
                disabled={!isEditable}
              />
            </div>
            <input
              ref={imageRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f)
                  void run(async () =>
                    editSlide({ image: await imageFromFile(f) }),
                  );
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!isEditable}
                onClick={() => imageRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {slide.image ? "Trocar imagem" : "Adicionar imagem"}
              </Button>
              {slide.image && (
                <Button
                  variant="ghost"
                  disabled={!isEditable}
                  onClick={() => editSlide({ image: "" })}
                >
                  Remover imagem
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A imagem ocupa uma faixa do modelo e é recortada ao centro. PNG,
              JPEG ou WebP, até 10 MB.
            </p>
          </section>
        </div>
        <section className="space-y-5 rounded-2xl border bg-[#ECEAF3] p-4 sm:p-7 dark:bg-[#1C1930] xl:sticky xl:top-20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Prévia da arte
            </span>
            <span className="rounded-full bg-card px-3 py-1 text-xs">
              {FORMATOS[project.formato].join(" × ")} px
            </span>
          </div>
          <PreviewSlide project={project} index={active} />
          <div className="flex flex-wrap justify-center gap-2">
            {project.slides.map((_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setActive(n)}
                aria-label={`Editar slide ${n + 1}`}
                aria-pressed={active === n}
                className={`h-9 w-9 rounded-lg border text-sm ${active === n ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
              >
                {n + 1}
              </button>
            ))}
            <Button
              size="icon"
              variant="outline"
              aria-label="Adicionar slide"
              disabled={!isEditable || project.slides.length === 10}
              onClick={() => {
                edit({
                  slides: [
                    ...project.slides,
                    {
                      title: "Seu próximo capítulo.",
                      body: "Escreva sua mensagem aqui.",
                      image: "",
                    },
                  ],
                });
                setActive(project.slides.length);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!isEditable || active === 0}
              onClick={() => move(-1)}
              aria-label="Mover slide para antes"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!isEditable || active === project.slides.length - 1}
              onClick={() => move(1)}
              aria-label="Mover slide para depois"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!isEditable || project.slides.length === 1}
              onClick={() => {
                edit({ slides: project.slides.filter((_, n) => n !== active) });
                setActive(Math.max(0, active - 1));
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir slide
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  baixar(
                    await png(await renderSlide(check(), active)),
                    `npe-slide-${active + 1}.png`,
                  ),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar este slide
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                try {
                  baixar(
                    new Blob([JSON.stringify(check(), null, 2)], {
                      type: "application/json",
                    }),
                    "projeto-npe.json",
                  );
                  setDirty(false);
                } catch {
                  toast.error("Revise os campos do projeto.");
                }
              }}
            >
              Baixar editável
            </Button>
          </div>
          {onSave ? (
            <div className="flex justify-center gap-2">
              <Button
                disabled={!isEditable}
                onClick={() =>
                  void run(async () => {
                    const next = await onSave(check(), id);
                    setId(next);
                    setDirty(false);
                    toast.success("Projeto salvo para a equipe.");
                  })
                }
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar projeto
              </Button>
              <Button
                variant="outline"
                disabled={!isEditable}
                onClick={() =>
                  void run(async () => {
                    const next = await onSave(check(), null);
                    setId(next);
                    setDirty(false);
                    toast.success("Nova cópia salva.");
                  })
                }
              >
                Salvar cópia
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Prévia sem acesso aos dados da equipe. Baixe o editável para
              guardar seu trabalho e reabrir depois.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
