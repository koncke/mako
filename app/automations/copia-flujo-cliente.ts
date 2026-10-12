// =============================================================================
// copia-flujo-cliente — copiar un flujo como TOKEN y saber qué es lo pegado (lo del navegador)
// =============================================================================
// Decimoquinta tanda de Automations (12/10/2026), punto 8. Martín, textual: «Me gustaría que al momento de copiar un
// flujo se cree como un ID o Token para que los usuarios se pasen ese token, y al momento de pegar eso por ejemplo en el
// input de texto, en lugar de ver el token debería decir "Flujo copiado: NOMBRE DEL FLUJO"...». El formato y las reglas
// puras viven en lib/flujo-copia.ts; la tabla y la ruta, en lib/flujo-copia-negocio.ts y POST /api/chat-agent/secuencias
// (`copiar_flujo`, `leer_copia`). Acá, lo que comparten las pantallas que copian o leen lo pegado: la lista («Copiar
// flujo»), la caja de «Nueva automatización», la galería («Pegar lo copiado») y el aviso al entrar a la tab.
//
// ⚠️ «COPIAR FLUJO» NUNCA SE QUEDA SIN COPIAR: si el server no guarda (falta la mig 0265, sin red), se copia el texto
// entero de antes, que se sigue pegando en cualquier negocio. El motivo queda en la consola.

import { leerCopia, resumenDeCopia, textoDeCopia, tokenDeTexto, type CopiaFlujo, type ResumenCopia } from '@/lib/flujo-copia';

const API = '/api/chat-agent/secuencias';

/** Lo que el server ya dijo de cada token (una vez por pestaña: el aviso al entrar mira el portapapeles en cada foco). */
const resumenes = new Map<string, Promise<ResumenCopia | null>>();

/**
 * ¿Qué es lo pegado? El texto entero de una copia se lee acá; un token lo resuelve el server (`leer_copia`). null = no
 * es un flujo de MaKo, el token no existe o no se pudo preguntar (sin red: no se recuerda, se vuelve a preguntar).
 */
export function resumenDePegado(texto: string): Promise<ResumenCopia | null> {
  const entera = leerCopia(texto);
  if (entera) return Promise.resolve(resumenDeCopia(entera));
  const token = tokenDeTexto(texto);
  if (!token) return Promise.resolve(null);
  const ya = resumenes.get(token);
  if (ya) return ya;
  const p = fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ action: 'leer_copia', copia: token }),
  })
    .then(async (r) => {
      const j = await r.json().catch(() => null) as ({ ok?: boolean; falta?: string; error?: string } & Partial<ResumenCopia>) | null;
      if (j?.falta) console.warn(`[copiar flujo] ${j.error ?? 'falta la tabla flujo_copias'}`);
      if (!j?.ok || typeof j.nombre !== 'string' || (j.que !== 'flujo' && j.que !== 'tarjetas')) {
        // Un 404 (no existe) se recuerda; lo demás (sin tabla, un 500) se vuelve a preguntar.
        if (r.status !== 404) resumenes.delete(token);
        return null;
      }
      return { nombre: j.nombre, que: j.que, tarjetas: Number(j.tarjetas) || 0 };
    })
    .catch(() => { resumenes.delete(token); return null; });
  resumenes.set(token, p);
  return p;
}

/**
 * «COPIAR FLUJO»: el server guarda la copia y devuelve su TOKEN, que es lo que va al portapapeles. Si no pudo (falta la
 * tabla, sin red), el texto entero de siempre. Devuelve lo que se copió.
 */
export async function textoParaCopiar(copia: CopiaFlujo, secuenciaId: number | null): Promise<string> {
  try {
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ action: 'copiar_flujo', copia: textoDeCopia(copia), ...(secuenciaId ? { secuenciaId } : {}) }),
    });
    const j = await r.json().catch(() => null) as { ok?: boolean; token?: unknown; error?: string } | null;
    const token = j?.ok ? tokenDeTexto(j.token) : null;
    if (token) {
      // Ya se sabe qué es: pegarlo en esta pestaña no le pregunta al server.
      resumenes.set(token, Promise.resolve(resumenDeCopia(copia)));
      return token;
    }
    console.warn(`[copiar flujo] sin token (${j?.error ?? r.status}): se copia el flujo entero`);
  } catch {
    console.warn('[copiar flujo] sin conexión: se copia el flujo entero');
  }
  return textoDeCopia(copia);
}

/**
 * Pone en el portapapeles un texto que TODAVÍA NO LLEGÓ (el token sale del server). Safari pierde el permiso del clic si
 * se espera un `fetch` antes de `writeText`; con `ClipboardItem` y una promesa el permiso se toma en el clic. Donde no
 * hay `ClipboardItem` (o falla), se espera y se escribe.
 */
export async function copiarAlPortapapeles(texto: Promise<string>): Promise<string> {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (nav?.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await nav.clipboard.write([new ClipboardItem({ 'text/plain': texto.then((t) => new Blob([t], { type: 'text/plain' })) })]);
      return await texto;
    } catch { /* sigue con writeText */ }
  }
  const t = await texto;
  if (!nav?.clipboard?.writeText) throw new Error('sin portapapeles');
  await nav.clipboard.writeText(t);
  return t;
}
