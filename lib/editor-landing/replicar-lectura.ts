// =============================================================================
// editor-landing/replicar-lectura — LEER una landing de afuera antes de replicarla: estructura, ángulos y diseño
// =============================================================================
// Pedido de Martín (28/10/2026): que se defina QUÉ se replica (replicar-partes.ts), y que la lectura de la landing
// «alimente» la réplica y se vea ANTES: el panel «Replicar landing» primero muestra lo que tiene la página y después
// pregunta qué tomar. Esto arma esa lectura (POST /api/landing-generator/replicar/leer) y lo usa también replicar.ts:
//   · el TEXTO de la página: el que bajó el server (`extraerLanding`, la URL tal cual), la lectura del navegador de la
//     persona (`lectura`, cuando el server no puede: una app de Vite, un 403) o el texto pegado;
//   · la ESTRUCTURA: `esquemaDeReplica` + el molde de cada sección (determinista, sin IA: es la MISMA que replica);
//   · los ÁNGULOS: una llamada a la IA del negocio (`FEATURE_GENERAR`, con la red de la plataforma como el esquema: es
//     la primera semana de un cliente), con su prompt editable (`PROMPTS_ANGULOS`). Si falla, la lectura sale igual,
//     sin ángulos y con el motivo: la estructura y el diseño no dependen de ella;
//   · el DISEÑO: los colores y las fuentes de la original (`estiloDeLectura` o `estiloDeLaPagina`, que nunca tiran).
// =============================================================================

import 'server-only';
import { chatClaude } from '../anthropic';
import { renderPrompt } from '../prompt-render';
import { contenidoNoConfiable } from '../prompt-render-pure';
import { esCascadaSinRespuesta } from '../ia-mensajes';
import { errorDeCascada } from '../ai-cheap';
import { extraerLanding } from '../landing-fetch';
import { FEATURE_GENERAR } from './ia';
import { fallaEnNavegador, motivoDeError, motivoDePagina, sanearLectura } from './lectura-reglas';
import type { SeLeeEnNavegador } from './lectura-tipos';
import { urlParaReplicar } from './replicar-reglas';
import { esquemaDeReplica, moldeDeEsquema } from './replicar-estructura';
import type { DisenoLeido, LecturaReplica } from './replicar-lectura-tipos';
import {
  ANGULOS_SYSTEM_TEMPLATE, ANGULOS_USER_TEMPLATE, TIPOS_SECCION_VENTA, angulosDeSalida, salidaDeAngulosUsable,
  seccionesParaAngulos, type Angulos,
} from './replicar-angulos';
import { estiloDeLectura, type EstiloOriginal } from './estilo-original';
import { estiloDeLaPagina } from './estilo-server';
import type { Esquema } from './api-tipos';

/** Las keys del registro (lib/prompt-registry.ts, grupo del editor de landings). El test las compara. */
export const PROMPTS_ANGULOS = {
  system: { key: 'landing_editor.angulos.system', tpl: ANGULOS_SYSTEM_TEMPLATE },
  user: { key: 'landing_editor.angulos.user', tpl: ANGULOS_USER_TEMPLATE },
} as const;

/** El texto pegado que se acepta (el de un esquema). */
const MAX_TEXTO = 60_000;
/** Lo que espera la lectura a los ángulos: la ruta tiene 120 s, y la persona está mirando. */
const PLAZO_ANGULOS_MS = 75_000;

/** De dónde sale la página: la bajada del server, la lectura del navegador o el texto pegado. */
export type FuenteReplica = { url: unknown; lectura?: unknown; texto?: unknown };
/** `conAngulos: false`: la lectura sin la llamada de IA (la «Página web» de la caja: la copia idéntica no los usa). */
export type PedidoLectura = FuenteReplica & { conAngulos?: boolean };

export type TextoDePagina =
  | { ok: true; url: string; texto: string; titulo: string; lectura: unknown | null; pegado: boolean }
  | ({ ok: false; error: string; status: number } & Partial<SeLeeEnNavegador>);

const hostDe = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/**
 * El texto de la página (con las marcas del lector: `# título`, `[BOTÓN]`, `•`). Lo pegado manda; si no, la lectura
 * del navegador; si no, la bajada del server, TAL CUAL la pegó la persona. La página que el server no puede leer
 * contesta `enNavegador` (la pantalla la lee en la ventana del clic y vuelve con la `lectura`).
 */
export async function textoDePagina(p: FuenteReplica): Promise<TextoDePagina> {
  const url = urlParaReplicar(p.url);
  if (!url) return { ok: false, error: 'Pega un enlace válido.', status: 400 };
  const pegado = typeof p.texto === 'string' ? p.texto.trim().slice(0, MAX_TEXTO) : '';
  if (pegado) return { ok: true, url, texto: pegado, titulo: hostDe(url), lectura: null, pegado: true };
  if (p.lectura !== undefined && p.lectura !== null) {
    const l = sanearLectura(p.lectura);
    if (!l || !l.texto.trim()) return { ok: false, error: 'Tu navegador no encontró texto en esa página. Pega el texto.', status: 400 };
    return { ok: true, url, texto: l.texto, titulo: hostDe(url), lectura: p.lectura, pegado: false };
  }
  try {
    const pagina = await extraerLanding(url, { talCual: true });
    const motivo = motivoDePagina(pagina);
    if (motivo) return { ...fallaEnNavegador(motivo), status: 422 };
    return { ok: true, url, texto: pagina.texto, titulo: pagina.titulo || hostDe(url), lectura: null, pegado: false };
  } catch (e) {
    const motivo = motivoDeError(e);
    if (motivo) return { ...fallaEnNavegador(motivo), status: 422 };
    return { ok: false, error: e instanceof Error ? e.message : 'No pude abrir esa página.', status: 502 };
  }
}

/**
 * Los ángulos de la página con la IA del negocio. Nunca tira: `{ angulos: null, error }` si la IA no contestó o no se
 * leyó lo que devolvió (la lectura sigue sin ellos). `hastaMs`: la fecha en que tiene que haber terminado.
 */
export async function angulosDePagina(esq: Esquema, url: string, hastaMs = Date.now() + PLAZO_ANGULOS_MS): Promise<{ angulos: Angulos | null; error?: string }> {
  const errores: string[] = [];
  try {
    const system = await renderPrompt(PROMPTS_ANGULOS.system.key, PROMPTS_ANGULOS.system.tpl, { tipos: TIPOS_SECCION_VENTA.join(', ') });
    const user = await renderPrompt(PROMPTS_ANGULOS.user.key, PROMPTS_ANGULOS.user.tpl, {
      pagina: hostDe(url),
      contenido: contenidoNoConfiable(seccionesParaAngulos(esq), 'pagina_importada'),
    });
    const salida = await chatClaude(system, [{ role: 'user', content: user }], {
      feature: FEATURE_GENERAR,
      motivo: `Ángulos de ${hostDe(url)} para replicarla`,
      maxTokens: 3_000,
      effort: 'low',
      hastaMs,
      redDePlataforma: true,
      erroresOut: errores,
      validar: salidaDeAngulosUsable,
    });
    const angulos = angulosDeSalida(salida, esq.secciones.length);
    return angulos ? { angulos } : { angulos: null, error: 'MaKo no pudo leer los ángulos de esa página.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[editor-landing/replicar-lectura] ángulos de ${url}: ${msg}${errores.length ? ` (${errores.join(' · ')})` : ''}`);
    return { angulos: null, error: esCascadaSinRespuesta(msg, errores) ? await errorDeCascada(errores, 'leer los ángulos') : 'MaKo no pudo leer los ángulos de esa página.' };
  }
}

export function disenoDeEstilo(e: EstiloOriginal | null): DisenoLeido | null {
  if (!e) return null;
  const colores = [...new Set([e.fondo, e.titulo, e.texto, e.acento, e.boton].filter((c): c is string => !!c && /^#[0-9a-f]{3,8}$/i.test(c)))].slice(0, 6);
  const fuentes = [...new Set([e.fuenteTitulo, e.fuenteCuerpo].filter((f): f is string => !!f))];
  return colores.length || fuentes.length ? { colores, fuentes, imagenes: e.imagenes.length } : null;
}

export type ResultadoLectura = ({ ok: true; lectura: LecturaReplica } | ({ ok: false; error: string } & Partial<SeLeeEnNavegador>)) & { status?: number };

/** La lectura entera: el texto, y en paralelo los ángulos (IA) y el diseño (la página o la lectura del navegador). */
export async function leerParaReplicar(p: PedidoLectura): Promise<ResultadoLectura> {
  const t0 = Date.now();
  const t = await textoDePagina(p);
  if (!t.ok) return t;
  const esq = esquemaDeReplica(t.texto, t.titulo);
  if (!esq.secciones.length) return { ok: false, error: 'No encontré secciones en esa página.', status: 422 };
  const estiloP: Promise<EstiloOriginal | null> = t.pegado ? Promise.resolve(null) : t.lectura ? Promise.resolve(estiloDeLectura(t.lectura)) : estiloDeLaPagina(t.url);
  const perfilP = import('../onboarding').then((m) => m.perfilNegocioTexto()).catch(() => '');
  // La oferta principal (12/11/2026): es la que usa la réplica si la persona no escribe otra (replicar.ts); con ella, el negocio
  // SÍ tiene de qué hablar aunque el perfil esté vacío (el ws9).
  const principalP = import('../ofertas').then(async (m) => (await m.listarOfertas(true))[0]?.nombre?.trim() || '').catch(() => '');
  const angP: Promise<{ angulos: Angulos | null; error?: string }> = p.conAngulos === false ? Promise.resolve({ angulos: null }) : angulosDePagina(esq, t.url);
  const [ang, estilo, perfil, principal] = await Promise.all([angP, estiloP, perfilP, principalP]);
  console.log(`[editor-landing/replicar-lectura] ${t.url}${t.pegado ? ' (texto pegado)' : t.lectura ? ' (leída en el navegador)' : ''}: ${esq.secciones.length} secciones, ángulos ${ang.angulos ? `${ang.angulos.secciones.length} por sección` : 'no'}, diseño ${estilo ? 'sí' : 'no'}, ${Math.round((Date.now() - t0) / 1000)} s`);
  return {
    ok: true,
    lectura: {
      url: t.url,
      titulo: esq.titulo || t.titulo,
      secciones: moldeDeEsquema(esq),
      angulos: ang.angulos,
      ...(ang.error ? { errorAngulos: ang.error } : {}),
      diseno: disenoDeEstilo(estilo),
      tieneOferta: perfil.replace(/\s+/g, ' ').trim().length >= 30 || !!principal,
      ...(principal ? { ofertaPrincipal: principal.slice(0, 120) } : {}),
    },
  };
}
