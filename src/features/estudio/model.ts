import { z } from "zod";

export const FRENTES = [
  "Editora NPE",
  "Método EPV",
  "Cursos e mentorias",
  "Livros e autores",
  "Jeff e Gi",
] as const;
export const CANAIS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "Blog",
] as const;
export const FORMATOS = {
  retrato: [1080, 1350],
  quadrado: [1080, 1080],
  stories: [1080, 1920],
} as const;
export const MODELOS = {
  editorial: "Editorial azul",
  destaque: "Destaque rosa",
  clean: "Legado em branco",
} as const;
const imageSchema = z
  .string()
  .max(1_500_000)
  .refine(
    (v) => !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Use uma imagem PNG, JPEG ou WebP.",
  );
export const projectSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(100),
  frente: z.enum(FRENTES),
  canal: z.enum(CANAIS),
  campanha: z.string().max(120),
  formato: z.enum(["retrato", "quadrado", "stories"]),
  modelo: z.enum(["editorial", "destaque", "clean"]),
  slides: z
    .array(
      z.object({
        title: z.string().max(180),
        body: z.string().max(650),
        image: imageSchema,
      }),
    )
    .min(1)
    .max(10),
});
export type Projeto = z.infer<typeof projectSchema>;
export function novoProjeto(): Projeto {
  return {
    version: 1,
    name: "Sua história merece um livro",
    frente: "Editora NPE",
    canal: "Instagram",
    campanha: "",
    formato: "retrato",
    modelo: "editorial",
    slides: [
      {
        title: "Sua história merece um livro.",
        body: "O primeiro passo é tirar a ideia da gaveta. Vamos começar?",
        image: "",
      },
      {
        title: "Encontre a sua mensagem.",
        body: "Que transformação você quer provocar na vida de quem lê?",
        image: "",
      },
      {
        title: "Escreva o próximo capítulo.",
        body: "Converse com a Editora NPE e dê o primeiro passo para construir o seu legado.",
        image: "",
      },
    ],
  };
}
