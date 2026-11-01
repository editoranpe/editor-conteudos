import { z } from "zod";
export const frentes = [
  "Editora NPE",
  "Método EPV",
  "Cursos e mentorias",
  "Livros e autores",
  "Jeff e Gi",
] as const;
export const canais = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "Blog",
] as const;
export const statuses = [
  "Ideia",
  "Em produção",
  "Em revisão",
  "Aprovado",
  "Publicado",
] as const;
export const contentSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    body: z.string().max(20000),
    frente: z.enum(frentes),
    canal: z.enum(canais),
    campanha: z.string().max(120),
    formato: z.enum([
      "Carrossel",
      "Estático",
      "Reels",
      "Vídeo",
      "Artigo",
      "Live",
    ]),
    responsible: z.string().email().max(254).or(z.literal("")),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal("")),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    status: z.enum(statuses),
  })
  .superRefine((v, ctx) => {
    if (
      v.date &&
      (isNaN(Date.parse(v.date)) ||
        new Date(v.date).toISOString().slice(0, 10) !== v.date)
    )
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Data inválida.",
      });
  });
export type ContentData = z.infer<typeof contentSchema>;
export interface Content extends ContentData {
  id: string;
  revision: number;
  updated_at: string;
}
export interface Member {
  email: string;
  name: string;
  role: "admin" | "editor" | "visualizador";
  status: "pendente" | "aprovado" | "recusado";
}
export function canWrite(user: Member) {
  return user.status === "aprovado" && user.role !== "visualizador";
}
export function canApprove(user: Member) {
  return user.status === "aprovado" && user.role === "admin";
}
export function assertTransition(
  user: Member,
  previous: string | null,
  next: string,
) {
  if (!canWrite(user))
    throw new Error("Seu acesso não permite editar conteúdos.");
  if (
    !canApprove(user) &&
    (previous === "Aprovado" ||
      previous === "Publicado" ||
      next === "Aprovado" ||
      next === "Publicado")
  )
    throw new Error(
      "Somente administradores alteram conteúdos aprovados ou publicados.",
    );
}
