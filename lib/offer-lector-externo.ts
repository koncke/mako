// =============================================================================
// offer-lector-externo — la página que nuestro servidor no puede leer, por un lector de afuera
// =============================================================================
// El dueño pega el link de su landing en Offer y la ruta la baja con lib/landing-fetch.ts (SSRF-segura). Hay dos casos
// en que eso no alcanza y la persona sí la ve en su navegador:
//   · un antibots que frena a los SERVIDORES (401/403/429): la landing del Sprint de Mauricio (22/10/2026, llamada,
//     31:44) daba «está bloqueando la lectura automática» desde Vercel, y abría en su navegador y en ChatGPT;
//   · una página que se arma con JavaScript (casi sin texto en el HTML).
// Para eso, r.jina.ai: baja la página desde SU red con un navegador y devuelve el texto. El host es fijo (no hay SSRF
// hacia nosotros: la URL del dueño va como ruta del pedido) y sólo viaja esa URL, que es pública. Se usa sólo después
// de que landing-fetch validó el destino (`bloqueaLaLectura` o una página sin texto), nunca en su lugar.
// Y una URL con algo que parece un acceso (un token, una firma, usuario y clave: `credencialEnLaUrl`) NO sale (OF2,
// 22/10/2026): el lector de afuera es para lo público.
// =============================================================================

import 'server-only';
import { credencialEnLaUrl, textoDelLectorExterno } from './offer-reglas';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * La página por el LECTOR DE AFUERA (r.jina.ai, 22/10/2026): baja la página desde su red, con un navegador, y devuelve
 * el texto. Para lo que nuestro servidor no puede: un antibots que frena a los servidores (la landing del Sprint de
 * Mauricio daba 403 desde Vercel y abría en su navegador y en ChatGPT) o una página que se arma con JavaScript. Sólo
 * viaja la URL que pegó el dueño, que es pública. null si no contestó o si lo que trae no sirve (`textoDelLectorExterno`).
 */
export async function leerConLectorExterno(url: string): Promise<{ urlFinal: string; titulo: string; descripcion: string; texto: string; bloqueada: boolean } | null> {
  // La ruta ya lo frena con su mensaje (PIDE_ACCESO); esto es la última puerta antes de mandar el link afuera.
  const cred = credencialEnLaUrl(url);
  if (cred) { console.warn(`[offer:link] no mando al lector de afuera un link con «${cred}»`); return null; }
  try {
    const res = await fetch(`${LECTOR_EXTERNO}${url}`, { headers: { accept: 'text/plain' }, signal: AbortSignal.timeout(LECTOR_EXTERNO_MS) });
    if (!res.ok) { console.warn(`[offer:link] el lector de afuera respondió ${res.status} para ${url}`); return null; }
    const leida = textoDelLectorExterno(await res.text());
    if (!leida) { console.warn(`[offer:link] el lector de afuera no trajo texto que sirva para ${url}`); return null; }
    return { urlFinal: leida.url || url, titulo: leida.titulo, descripcion: '', texto: leida.texto, bloqueada: false };
  } catch (e) {
    console.warn(`[offer:link] el lector de afuera falló para ${url}: ${msg(e)}`);
    return null;
  }
}
const LECTOR_EXTERNO = 'https://r.jina.ai/';
const LECTOR_EXTERNO_MS = 25_000;
