import { describe, it, expect } from "vitest";
import {
  contentSchema,
  assertTransition,
  canWrite,
  type Member,
} from "../shared/domain";
import { projectSchema, novoProjeto } from "../src/features/estudio/model";
import { crc32, zipStore } from "../src/features/estudio/zip";
const member = (
  role: Member["role"],
  status: Member["status"] = "aprovado",
): Member => ({ email: "e@example.com", name: "Teste", role, status });
const content = {
  title: "Pauta",
  body: "",
  frente: "Editora NPE",
  canal: "Instagram",
  campanha: "",
  formato: "Carrossel",
  responsible: "",
  date: "2026-11-01",
  time: "19:00",
  status: "Ideia",
};
describe("Permissões editoriais", () => {
  it("bloqueia escrita de visualizadores e pendentes", () => {
    expect(canWrite(member("visualizador"))).toBe(false);
    expect(canWrite(member("admin", "pendente"))).toBe(false);
    expect(() =>
      assertTransition(member("visualizador"), "Ideia", "Em revisão"),
    ).toThrow();
  });
  it("editor pode revisar mas não aprovar nem alterar aprovação existente", () => {
    expect(() =>
      assertTransition(member("editor"), "Em produção", "Em revisão"),
    ).not.toThrow();
    expect(() =>
      assertTransition(member("editor"), "Em revisão", "Aprovado"),
    ).toThrow();
    expect(() =>
      assertTransition(member("editor"), "Aprovado", "Ideia"),
    ).toThrow();
    expect(() =>
      assertTransition(member("editor"), "Publicado", "Publicado"),
    ).toThrow();
  });
  it("administrador aprovado pode confirmar publicação", () => {
    expect(() =>
      assertTransition(member("admin"), "Aprovado", "Publicado"),
    ).not.toThrow();
  });
});
describe("Validação de conteúdo e projetos", () => {
  it("rejeita datas inexistentes, hora inválida e conteúdo sem título", () => {
    expect(contentSchema.safeParse(content).success).toBe(true);
    expect(
      contentSchema.safeParse({ ...content, date: "2026-02-30" }).success,
    ).toBe(false);
    expect(contentSchema.safeParse({ ...content, time: "25:80" }).success).toBe(
      false,
    );
    expect(contentSchema.safeParse({ ...content, title: " " }).success).toBe(
      false,
    );
  });
  it("aceita os exemplos e rejeita imagens remotas e arquivos SVG em projetos importados", () => {
    const p = novoProjeto();
    expect(projectSchema.safeParse(p).success).toBe(true);
    for (const image of [
      "https://example.com/image.jpg",
      "data:image/svg+xml;base64,AAAA",
    ])
      expect(
        projectSchema.safeParse({
          ...p,
          slides: [{ title: "Exemplo", body: "", image }],
        }).success,
      ).toBe(false);
  });
  it("exige de um a dez slides", () => {
    const p = novoProjeto();
    expect(projectSchema.safeParse({ ...p, slides: [] }).success).toBe(false);
    expect(
      projectSchema.safeParse({ ...p, slides: Array(11).fill(p.slides[0]) })
        .success,
    ).toBe(false);
  });
});
describe("ZIP exportado", () => {
  it("calcula CRC32 pelo vetor de referência", () =>
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926));
  it("grava arquivo, diretório central e checksum coerentes", async () => {
    const bytes = new TextEncoder().encode("mensagem NPE");
    const zip = await zipStore([{ name: "slide-01.txt", bytes }]).arrayBuffer();
    const v = new DataView(zip);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const nameLength = v.getUint16(26, true);
    const payload = new Uint8Array(zip, 30 + nameLength, bytes.length);
    expect(new TextDecoder().decode(payload)).toBe("mensagem NPE");
    expect(v.getUint32(14, true)).toBe(crc32(payload));
    const end = zip.byteLength - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(1);
    const central = v.getUint32(end + 16, true);
    expect(v.getUint32(central, true)).toBe(0x02014b50);
    expect(v.getUint32(central + 42, true)).toBe(0);
  });
});
