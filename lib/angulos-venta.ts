// =============================================================================
// angulos-venta — MaKo propone 3 ÁNGULOS de venta (estilo "100 anuncios")
// =============================================================================
// El diferencial de la competencia (100ads) es la fábrica de creativos, y el
// primer eslabón son los ÁNGULOS. Un ángulo NO se inventa: se ENCUENTRA en lo que
// el negocio ya dice (metodología de Jan, "Anuncio Ganador"). MaKo razona POR DENTRO
// con las 3 palancas de Jan sobre el brief del Archivero y devuelve 3 ángulos; el
// usuario solo ve el resultado (por eso no es complejo).
//
//   1. ¿A QUIÉN?  → subnichos del avatar.
//   2. ¿POR QUÉ compraría? → el DOLOR / razón de compra.
//   3. ¿DE QUÉ OTRA FORMA explicar la oferta? → el mecanismo / encuadre.
//   Cruzás las 3 y bajás al DOLOR concreto de cada subnicho.
//
// Formato de salida = el de 100ads: {tipo, titulo, hook, descripcion}. SIN score
// por ahora (el CTR real llega cuando conecta Meta y el Script Analyst trae los
// hooks ganadores). Patrón "writer" (ver scaffold-mako-writer): genera a pedido y
// guarda el resultado en app_settings. NO persiste por-entidad ni sincroniza.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { chatClaude } from './anthropic';
import { renderPrompt } from './prompt-render';
import { parseJsonObject } from './campaign-structurer';
import { perfilNegocioTexto } from './onboarding';
import { faseNegocioTexto } from './fase-store';
import { getSetting, setSetting } from './settings';

export type AnguloVenta = { id: string; tipo: string; titulo: string; hook: string; descripcion: string };
export type Uso = { tokens: number; costUsd: number } | null;

const SETTING_KEY = 'mako.angulos_venta';
// Los tipos válidos (la "razón de compra" dominante). Alineados con 100ads + Jan.
export const TIPOS_ANGULO = ['Problema', 'Deseo', 'Mecanismo', 'Creencia', 'Prueba social', 'Enemigo común'] as const;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// ── Persistencia (por workspace, vía runWithWorkspace del route) ──────────────
export async function getAngulosVenta(): Promise<AnguloVenta[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as AnguloVenta[]).filter((a) => a && a.titulo) : [];
  } catch { return []; }
}
export async function setAngulosVenta(list: AnguloVenta[]): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify(list));
}

// ── Prompt (editable en /configuraciones) ────────────────────────────────────
export const ANGULOS_SYSTEM_TEMPLATE = `Sos MaKo, generando ÁNGULOS DE VENTA para los anuncios de Meta de un negocio (estilo "100 anuncios que venden"). Un ángulo NO se inventa: se ENCUENTRA en lo que el negocio YA dice (metodología de Jan, "Anuncio Ganador"). La OFERTA no es el producto: es CÓMO lo explicás. Cada ángulo es la CARNADA (el tráiler de 90 segundos), no la película.

Para encontrar los ángulos usás las 3 PALANCAS y las CRUZÁS:
1. ¿A QUIÉN? — distintos SUBNICHOS del avatar (no "todos"; el que no delega, el que ya probó y falló, etc.).
2. ¿POR QUÉ compraría? — el DOLOR o razón de compra concreta de ese subnicho.
3. ¿DE QUÉ OTRA FORMA explicar la oferta? — un mecanismo, enemigo o encuadre distinto.
Bajá al DOLOR CONCRETO de cada subnicho ("debajo de la piel"), no le hables a todos con el mismo mensaje.

Devolvé 3 ÁNGULOS DISTINTOS entre sí, cada uno con:
- "tipo": la razón de compra dominante. EXACTAMENTE UNO de: Problema, Deseo, Mecanismo, Creencia, Prueba social, Enemigo común.
- "titulo": el nombre del ángulo, 2-4 palabras, con gancho (ej: "El Silencio Cómplice", "El Cuello de Botella Eres Tú").
- "hook": la PRIMERA línea del anuncio, la que frena el scroll, 5-12 palabras, fuerte y del dolor real (ej: "Tu empresa no avanza por lo que no se dice.").
- "descripcion": 2-3 frases que explican el ángulo — a QUIÉN le habla (el subnicho), el DOLOR/razón, y CÓMO encuadra la oferta.

REGLAS:
- NO inventes cifras, garantías ni resultados que no estén en el contexto del negocio.
- Aterrizá TODO en los datos reales del negocio que te paso; nada genérico.
- IDIOMA: el "titulo", "hook" y "descripcion" son para la AUDIENCIA del cliente (MÉXICO): español NEUTRO/MEXICANO, de "tú", SIN voseo ni modismos argentinos (nada de "tenés/querés/subí/mirá").

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto afuera) con esta forma EXACTA:
{"angulos":[{"tipo":"","titulo":"","hook":"","descripcion":""}]}`;

export const ANGULOS_USER_TEMPLATE = `CONTEXTO DEL NEGOCIO (datos reales del Archivero):
{{brief}}
{{fase}}
Encontrá 3 ángulos de venta. Devolvé solo el JSON.`;

// ── Parseo ────────────────────────────────────────────────────────────────────
export function parseAngulos(text: string): AnguloVenta[] {
  const raw = parseJsonObject(text);
  const arr = Array.isArray(raw.angulos) ? raw.angulos : [];
  const tiposOk = new Set<string>(TIPOS_ANGULO as readonly string[]);
  return arr
    .slice(0, 3)
    .map((v) => {
      const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      const tipoCrudo = str(o.tipo);
      const tipo = tiposOk.has(tipoCrudo) ? tipoCrudo : (TIPOS_ANGULO.find((t) => tipoCrudo.toLowerCase().includes(t.toLowerCase().split(' ')[0])) ?? 'Problema');
      return { id: randomUUID(), tipo, titulo: str(o.titulo), hook: str(o.hook).replace(/^["“”']+|["“”']+$/g, ''), descripcion: str(o.descripcion) };
    })
    .filter((a) => a.titulo && a.hook);
}

// ── Generación (envelope {ok}; nunca lanza) ───────────────────────────────────
export type GenResult = { ok: true; angulos: AnguloVenta[]; uso: Uso } | { ok: false; error: string };

export async function generarAngulos(): Promise<GenResult> {
  try {
    const [brief, fase] = await Promise.all([perfilNegocioTexto(), faseNegocioTexto()]);
    if (!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20) {
      return { ok: false, error: 'Primero cargá tu negocio en El Archivero: de ahí salen los ángulos.' };
    }
    const sys = await renderPrompt('angulos.system', ANGULOS_SYSTEM_TEMPLATE, {});
    const user = await renderPrompt('angulos.user', ANGULOS_USER_TEMPLATE, {
      brief,
      fase: fase ? `\nFASE DEL NEGOCIO (para el tono/urgencia):\n${fase}\n` : '',
    });
    let uso: Uso = null;
    const text = await chatClaude(sys, [{ role: 'user', content: user }], {
      thinking: true, effort: 'high', maxTokens: 8000, feature: 'angulos-venta',
      onUsage: (u) => { uso = { tokens: u.inputTokens + u.outputTokens, costUsd: u.costUsd }; },
    });
    const angulos = parseAngulos(text);
    if (!angulos.length) return { ok: false, error: 'MaKo no devolvió ángulos. Reintentá en un momento.' };
    return { ok: true, angulos, uso };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
