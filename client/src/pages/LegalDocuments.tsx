import { AuditaPatronLogoWordmark } from "@/components/AuditaPatronLogo";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTROLLER_NAME,
  LEGAL_DOCUMENTS_BY_SLUG,
  type LegalDocumentDefinition,
  type LegalDocumentSlug,
} from "@shared/legal";
import { Lock } from "lucide-react";

type MarkdownBlock =
  | { type: "h1"; content: string }
  | { type: "h2"; content: string }
  | { type: "p"; content: string }
  | { type: "quote"; content: string }
  | { type: "ul"; items: string[] };

function normalizeInlineMarkdown(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").trim();
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push({
      type: "p",
      content: normalizeInlineMarkdown(paragraphBuffer.join(" ")),
    });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push({
      type: "ul",
      items: listBuffer.map((item) => normalizeInlineMarkdown(item)),
    });
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h1", content: normalizeInlineMarkdown(line.slice(2)) });
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", content: normalizeInlineMarkdown(line.slice(3)) });
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", content: normalizeInlineMarkdown(line.slice(2)) });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(line.slice(2));
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function LegalDocumentArticle({ document }: { document: LegalDocumentDefinition }) {
  const blocks = parseMarkdown(document.markdown);

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_-60px_rgba(15,23,42,0.4)] sm:p-8 lg:p-10">
      {blocks.map((block, index) => {
        if (block.type === "h1") {
          return (
            <div key={`${block.type}-${index}`} className="border-b border-slate-200 pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Documento legal vigente</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">{block.content}</h1>
              <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
                Responsable: {LEGAL_CONTROLLER_NAME}. Si necesitas ejercer derechos ARCO o realizar una consulta de privacidad,
                escríbenos a <a className="font-semibold text-slate-900 underline underline-offset-4" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
              </p>
            </div>
          );
        }

        if (block.type === "h2") {
          return (
            <h2
              key={`${block.type}-${index}`}
              className="mt-8 text-xl font-semibold tracking-[-0.03em] text-slate-950 first:mt-0 sm:text-2xl"
            >
              {block.content}
            </h2>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={`${block.type}-${index}`}
              className="mt-5 rounded-[1.4rem] border border-teal-100 bg-teal-50 px-5 py-4 text-sm leading-7 text-teal-950 sm:text-base"
            >
              {block.content}
            </blockquote>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={`${block.type}-${index}`} className="mt-4 space-y-3 text-sm leading-7 text-slate-700 sm:text-base">
              {block.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="mt-4 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">
            {block.content}
          </p>
        );
      })}
    </article>
  );
}

function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const document = LEGAL_DOCUMENTS_BY_SLUG[slug];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] px-4 py-8 text-slate-950 sm:py-10">
      <div className="container mx-auto max-w-5xl">
        <div className="rounded-[1.6rem] border border-slate-900 bg-slate-950 px-5 py-5 text-white shadow-[0_24px_70px_-42px_rgba(2,6,23,0.82)] sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <a href="/" className="inline-flex items-center text-sm font-medium text-slate-300 transition hover:text-white">
                Volver al inicio
              </a>
              <div className="mt-4">
                <AuditaPatronLogoWordmark surface="dark" imageClassName="max-w-[250px] w-auto h-auto object-contain" />
              </div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.22em] text-teal-300">Marco legal vigente</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                Consulta aquí la versión completa de nuestros documentos legales actualizados. Están escritos en español y forman parte del uso regular de AuditaPatron y de tu experiencia de acompañamiento laboral dentro de la plataforma.
              </p>
              <div className="mt-4 max-w-3xl rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.55)]">
                <p className="font-semibold text-white">Resumen humano antes del texto completo</p>
                <p className="mt-2">
                  Aquí puedes revisar con calma qué datos usamos, cómo protegemos tu expediente y cuáles son las reglas básicas del servicio antes de entrar al documento completo.
                </p>
              </div>
              {slug === "privacidad" ? (
                <div className="mt-4 max-w-3xl rounded-[1.45rem] border border-teal-200 bg-[linear-gradient(135deg,_rgba(240,253,250,0.96),_rgba(255,255,255,0.98))] p-5 text-sm leading-6 text-slate-800 shadow-[0_22px_46px_-30px_rgba(20,184,166,0.35)] sm:p-6 sm:text-base sm:leading-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800 shadow-sm">
                    <Lock className="h-4 w-4" strokeWidth={1.8} />
                    Privacidad visible y pública
                  </div>
                  <p className="mt-4 text-lg font-semibold leading-8 text-slate-950 sm:text-[1.35rem] sm:leading-9">
                    Nadie de tu empresa puede ver lo que subes. Tus documentos son tuyos. Puedes borrarlos cuando quieras.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
                    Este aviso carga sin login para que puedas leerlo antes de usar la plataforma. Operamos bajo LFPDPPP y reforzamos el resguardo con cifrado AES-256 para piezas sensibles del servicio.
                  </p>
                  <p className="mt-3 inline-flex w-fit rounded-full border border-teal-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800 shadow-sm">
                    Revisión vigente visible · sin cambios ocultos
                  </p>
                </div>
              ) : null}
              {slug === "terminos" ? (
                <div className="mt-4 max-w-3xl rounded-[1.45rem] border border-amber-200 bg-[linear-gradient(135deg,_rgba(255,251,235,0.96),_rgba(255,255,255,0.98))] p-5 text-sm leading-6 text-slate-800 shadow-[0_22px_46px_-30px_rgba(245,158,11,0.25)] sm:p-6 sm:text-base sm:leading-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 shadow-sm">
                    <Lock className="h-4 w-4" strokeWidth={1.8} />
                    Resumen humano de uso de datos
                  </div>
                  <p className="mt-4 text-lg font-semibold leading-8 text-slate-950 sm:text-[1.35rem] sm:leading-9">
                    Tus documentos originales se usan para darte el servicio. Los datos anonimizados o agregados pueden ayudarnos a mejorar el producto sin identificarte razonablemente.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
                    Los términos distinguen entre documentos originales, datos anonimizados y obras derivadas para que puedas leer con más claridad qué se usa para operar tu expediente y qué solo alimenta analítica o mejora de producto.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold sm:justify-end">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-white">{document.version}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-white">Vigente desde {document.effectiveDate}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <a
            href="/legal/privacidad"
            className={`rounded-full border px-4 py-2 font-medium transition ${
              slug === "privacidad"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950"
            }`}
          >
            Aviso de Privacidad
          </a>
          <a
            href="/legal/terminos"
            className={`rounded-full border px-4 py-2 font-medium transition ${
              slug === "terminos"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950"
            }`}
          >
            Términos de Uso
          </a>
          <a
            href="/"
            className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 font-medium text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
          >
            Revisar mi recibo gratis
          </a>
        </div>

        <div className="mt-6">
          <LegalDocumentArticle document={document} />
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500">
          <p>
            Este documento forma parte del marco legal visible de AuditaPatron. Primero puedes leer el resumen humano y después, si lo necesitas, revisar el texto completo. Si necesitas apoyo para ejercer derechos ARCO,
            solicitar revocación o aclarar una versión legal, contáctanos en{" "}
            <a className="font-medium text-slate-700 underline underline-offset-4" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}

export function LegalPrivacyPage() {
  return <LegalDocumentPage slug="privacidad" />;
}

export function LegalTermsPage() {
  return <LegalDocumentPage slug="terminos" />;
}
