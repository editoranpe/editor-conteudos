import { BRAND } from "@/config/brand";
import { FORMATOS, type Projeto } from "./model";

export function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    const timeout = setTimeout(
      () =>
        reject(new Error("A imagem demorou para carregar. Tente novamente.")),
      15000,
    );
    i.onload = () => {
      clearTimeout(timeout);
      resolve(i);
    };
    i.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Não foi possível abrir a imagem."));
    };
    i.src = src;
  });
}

export function quebrarLinhas(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      // Quebra inclusive URLs e palavras muito compridas.
      if (ctx.measureText(word).width > width) {
        if (current) {
          lines.push(current);
          current = "";
        }
        for (const char of word) {
          if (current && ctx.measureText(current + char).width > width) {
            lines.push(current);
            current = "";
          }
          current += char;
        }
      } else if (
        current &&
        ctx.measureText(current + " " + word).width > width
      ) {
        lines.push(current);
        current = word;
      } else current += (current ? " " : "") + word;
    }
    lines.push(current);
  }
  return lines;
}

function texto(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  max: number,
  weight: number,
  color: string,
) {
  let size = max;
  let lines: string[] = [];
  do {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    lines = quebrarLinhas(ctx, value, width);
    if (lines.length * size * 1.18 <= height) break;
    size -= 1;
  } while (size >= 16);
  if (lines.length * size * 1.18 > height)
    throw new Error(
      "Texto muito longo para este modelo. Reduza o texto do slide.",
    );
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  lines.forEach((line, n) => ctx.fillText(line, x, y + n * size * 1.18));
}

export async function renderSlide(
  project: Projeto,
  index: number,
): Promise<HTMLCanvasElement> {
  const slide = project.slides[index];
  if (!slide) throw new Error("Slide não encontrado.");
  const [w, h] = FORMATOS[project.formato];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("Seu navegador não suporta a exportação de imagens.");
  const clean = project.modelo === "clean";
  ctx.fillStyle = clean
    ? "#FAF8FF"
    : project.modelo === "destaque"
      ? "#B50062"
      : BRAND.colors.blue;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = clean ? "#EC007F12" : "#FFFFFF0C";
  ctx.beginPath();
  ctx.arc(w + 70, h * 0.48, w * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BRAND.colors.yellow;
  ctx.fillRect(76, 76, 64, 8);
  texto(
    ctx,
    project.frente.toUpperCase(),
    164,
    66,
    650,
    42,
    24,
    700,
    clean ? BRAND.colors.blue : "#FFFFFF",
  );
  texto(
    ctx,
    String(index + 1).padStart(2, "0") +
      " / " +
      String(project.slides.length).padStart(2, "0"),
    875,
    66,
    130,
    45,
    23,
    400,
    clean ? BRAND.colors.blue : "#FFFFFF",
  );
  const titleY = 160;
  const imageTop = Math.round(h * 0.4);
  const bodyTop = slide.image ? Math.round(h * 0.66) : Math.round(h * 0.53);
  const bodyBottom = h - 245;
  texto(
    ctx,
    slide.title,
    76,
    titleY,
    w - 152,
    (slide.image ? imageTop : bodyTop) - titleY - 38,
    88,
    800,
    clean ? BRAND.colors.blue : "#FFFFFF",
  );
  if (slide.image) {
    const img = await carregarImagem(slide.image);
    const boxH = Math.round(h * 0.23),
      boxW = w - 152;
    const scale = Math.max(boxW / img.width, boxH / img.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(76, imageTop, boxW, boxH);
    ctx.clip();
    ctx.drawImage(
      img,
      76 + (boxW - img.width * scale) / 2,
      imageTop + (boxH - img.height * scale) / 2,
      img.width * scale,
      img.height * scale,
    );
    ctx.restore();
  }
  texto(
    ctx,
    slide.body,
    76,
    bodyTop,
    w - 152,
    bodyBottom - bodyTop,
    38,
    400,
    clean ? "#363346" : "#FFFFFF",
  );
  ctx.fillStyle = clean ? "#39358022" : "#FFFFFF33";
  ctx.fillRect(76, h - 202, w - 152, 2);
  const logo = await carregarImagem(BRAND.logo);
  const logoW = 195,
    logoH = (logo.height * logoW) / logo.width;
  ctx.drawImage(logo, 76, h - 174, logoW, logoH);
  texto(
    ctx,
    BRAND.tagline,
    320,
    h - 143,
    w - 396,
    65,
    25,
    700,
    clean ? BRAND.colors.blue : "#FFFFFF",
  );
  return canvas;
}

export async function imageFromFile(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Escolha PNG, JPEG ou WebP de até 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await carregarImagem(url);
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a imagem.");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function baixar(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function png(canvas: HTMLCanvasElement): Promise<Blob> {
  const data = atob(canvas.toDataURL("image/png").split(",")[1]);
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}
