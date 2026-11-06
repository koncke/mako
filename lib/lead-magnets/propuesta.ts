// =============================================================================
// lead-magnets/propuesta — MaKo propone el lead magnet: lo que lee la IA y lo que el código le acepta (puro, 6/11/2026)
// =============================================================================
// El pedido (Martín, 29/10/2026, por el Cerebro el 6/11): «MaKo propone el lead magnet según la oferta del negocio y lo que
// hacen sus competidores en Competitors Spy. Sin caras ni nombres de gurús en la galería. Cada negocio paga su IA».
//
// La IA del negocio ELIGE y REDACTA; el código decide qué se muestra (AGENTS.md: «una regla en un prompt no es una regla»):
//   · la plantilla tiene que existir (un id inventado no se puede armar);
//   · la fuente tiene que estar en lo que se le pasó (sin competidores leídos, «la competencia» es inventada);
//   · ni el nombre ni el porqué nombran a un competidor: a la IA le llegan ANÓNIMOS («Competidor 1»), y el código igual
//     busca sus nombres y su @ por si los dedujo (un referente famoso se reconoce por lo que promete);
//   · español neutro, de «tú» (lo lee el lead: el nombre es el título del lead magnet);
//   · nada que ya tenga, ni dos iguales.
// Lo que no pasa se cuenta (`descartadas`, con su motivo), no se rellena: si no queda ninguna, la pantalla lo dice.
//
// SIN server-only: lo prueban tests/lead-magnets-propuesta.test.ts y lo lee el registro de prompts. La lectura y la llamada a
// la IA viven en ./proponer.ts.
// =============================================================================

import { PLANTILLAS_LEAD_MAGNET } from './plantillas';
import { parseJsonObject } from '../json-del-modelo';
import { marcasDeVoseo } from '../voseo';
import { cortarSinPartir } from '../unicode-seguro';

export const TOPE_PROPUESTAS = 3;
export const TOPES_PROPUESTA = { nombre: 90, porQue: 240, competidores: 6, texto: 320 } as const;
export const FUENTES_PROPUESTA = ['oferta', 'competencia', 'las-dos'] as const;
export type FuentePropuesta = (typeof FUENTES_PROPUESTA)[number];

/** Lo que MaKo propone: con qué plantilla, cómo se llama y por qué, y de dónde lo sacó. */
export type PropuestaLM = { plantilla: string; nombre: string; porQue: string; fuente: FuentePropuesta };

/** Lo que se lee de la oferta (lib/oferta-modelo.ts). */
export type OfertaParaProponer = {
  nombre: string; promesa?: string | null; para_quien?: string | null; objeciones?: string | null; incluye?: string | null;
};
/** Lo que se lee de un competidor (lib/spy.ts → `Competidor`, con su `oferta` leída). */
export type CompetidorParaProponer = {
  nombre: string; instagram?: string | null;
  oferta: { promete?: string | null; aQuien?: string | null; objecion?: string | null; huecos?: readonly string[] | null } | null;
};

export type DossierLM = {
  oferta: string;
  competencia: string;
  yaTiene: string;
  /** Cuántos competidores entraron (con su oferta leída). Sin ninguno, «la competencia» no puede ser una fuente. */
  nCompetidores: number;
  /** Los nombres y los @ de los competidores: ni el nombre ni el porqué de una propuesta los puede decir. */
  prohibidos: string[];
};

const limpio = (v: unknown, tope: number = TOPES_PROPUESTA.texto): string =>
  typeof v === 'string' ? cortarSinPartir(v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(), tope).trim() : '';

/** Sin tildes ni mayúsculas, para comparar. */
export const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Lo que lee la IA. null si no hay de dónde proponer: ni una oferta con promesa o a quién, ni un competidor leído. La oferta
 * principal va primero (`listarOfertas` ya las ordena así); de los competidores, sólo los que tienen su oferta leída, ANÓNIMOS.
 */
export function dossierParaProponer(o: {
  ofertas: readonly OfertaParaProponer[];
  competidores: readonly CompetidorParaProponer[];
  yaTiene: readonly string[];
}): DossierLM | null {
  const oferta = o.ofertas.find((x) => limpio(x.promesa) || limpio(x.para_quien)) ?? null;
  const conOferta = o.competidores.filter((c) => c.oferta && (limpio(c.oferta.promete) || (c.oferta.huecos ?? []).some((h) => limpio(h))))
    .slice(0, TOPES_PROPUESTA.competidores);
  if (!oferta && !conOferta.length) return null;
  const textoOferta = oferta
    ? [
      `Se llama: ${limpio(oferta.nombre, 120)}`,
      limpio(oferta.promesa) && `Promete: ${limpio(oferta.promesa)}`,
      limpio(oferta.para_quien) && `Para quién: ${limpio(oferta.para_quien)}`,
      limpio(oferta.objeciones) && `Lo que le frena a su cliente: ${limpio(oferta.objeciones)}`,
      limpio(oferta.incluye) && `Incluye: ${limpio(oferta.incluye)}`,
    ].filter(Boolean).join('\n')
    : '(No cargó su oferta: propón desde lo que hace la competencia.)';
  const competencia = conOferta.length
    ? conOferta.map((c, i) => {
      const of = c.oferta!;
      const huecos = (of.huecos ?? []).map((h) => limpio(h, 160)).filter(Boolean).slice(0, 4);
      return [
        `Competidor ${i + 1}:`,
        limpio(of.promete) && `  promete: ${limpio(of.promete)}`,
        limpio(of.aQuien) && `  a quién: ${limpio(of.aQuien)}`,
        limpio(of.objecion) && `  la objeción que ataca: ${limpio(of.objecion)}`,
        huecos.length && `  lo que dice y el negocio no: ${huecos.join(' · ')}`,
      ].filter(Boolean).join('\n');
    }).join('\n')
    : '(No hay competidores leídos en Competitors Spy: propón desde la oferta.)';
  const yaTiene = o.yaTiene.map((n) => limpio(n, 120)).filter(Boolean);
  const prohibidos = new Set<string>();
  for (const c of o.competidores) {
    const n = limpio(c.nombre, 120);
    if (n.length >= 3) prohibidos.add(n);
    const ig = limpio(c.instagram ?? '', 60).replace(/^@/, '');
    if (ig.length >= 3) prohibidos.add(ig);
  }
  return {
    oferta: textoOferta,
    competencia,
    yaTiene: yaTiene.length ? yaTiene.map((n) => `- ${n}`).join('\n') : '(Todavía ninguno.)',
    nCompetidores: conOferta.length,
    prohibidos: [...prohibidos],
  };
}

/** Las plantillas, como las lee la IA: su id, su nombre y cuándo usarla. */
export function plantillasParaLaIA(): string {
  return PLANTILLAS_LEAD_MAGNET.map((p) => `- ${p.id}: ${p.nombre} — ${p.ayuda}`).join('\n');
}

/** La forma exacta del JSON que se pide. */
export const FORMA_PROPUESTAS = '{"propuestas":[{"plantilla":"<id de una plantilla>","nombre":"<cómo se llama>","porQue":"<una frase>","fuente":"oferta|competencia|las-dos"}]}';

export const PROPONER_LM_SYSTEM_TEMPLATE = `Eres MaKo. Propones hasta 3 lead magnets para un negocio: lo que regala a cambio del contacto de alguien que todavía no le compró.

Cómo elegir:
- Cada uno resuelve UN problema chico y concreto del cliente ideal, que se pueda usar hoy. Nada genérico («guía de marketing»).
- Sale de la oferta (lo que promete, a quién, lo que frena a su cliente) o de un hueco de la competencia (lo que ella ataca y el negocio no dice). Di de cuál en "fuente".
- Cada uno con una plantilla distinta si se puede. Sólo estas plantillas (usa su id):
{{plantillas}}
- No repitas uno que ya tiene.

Cómo escribirlo:
- "nombre": el título que lee el lead, con el resultado que promete. Máximo 90 caracteres. Español neutro, tratando de «tú».
- "porQue": una frase para el dueño del negocio: qué problema toca y de dónde sale. Máximo 240 caracteres.
- Nunca nombres a un competidor, a una persona ni a una marca: a los competidores los conoces como «Competidor 1», «Competidor 2», y tampoco escribas eso.
- No inventes números ni resultados que no estén en lo que te pasan.

Contesta SÓLO el JSON, con esta forma: {{forma}}`;

export const PROPONER_LM_USER_TEMPLATE = `LA OFERTA DEL NEGOCIO
{{oferta}}

LO QUE HACE SU COMPETENCIA (Competitors Spy)
{{competencia}}

LOS LEAD MAGNETS QUE YA TIENE
{{yaTiene}}`;

export type Descarte = { nombre: string; motivo: string };

/** ¿El texto nombra alguno de estos? Sin tildes ni mayúsculas, con límites de palabra Unicode (`\b` es ASCII). */
function nombraA(texto: string, nombres: readonly string[]): string | null {
  const t = normalizar(texto);
  for (const n of nombres) {
    const k = normalizar(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!k) continue;
    if (new RegExp(`(?<![\\p{L}\\p{N}])${k}(?![\\p{L}\\p{N}])`, 'u').test(t)) return n;
  }
  return null;
}

/**
 * Lo que el código le acepta a la IA. `ok: false` sólo si la respuesta no se entiende; una respuesta entendida con todo
 * descartado es `ok: true` con `propuestas: []` (y los motivos).
 */
export function leerPropuestas(texto: string, d: Pick<DossierLM, 'nCompetidores' | 'prohibidos'> & { yaTiene: readonly string[] }):
  { ok: true; propuestas: PropuestaLM[]; descartadas: Descarte[] } | { ok: false; motivo: string } {
  let crudo: Record<string, unknown>;
  try { crudo = parseJsonObject(texto); } catch { return { ok: false, motivo: 'la IA no contestó un JSON' }; }
  const lista = Array.isArray(crudo.propuestas) ? crudo.propuestas : null;
  if (!lista) return { ok: false, motivo: 'la respuesta no trae "propuestas"' };
  const ids = new Set(PLANTILLAS_LEAD_MAGNET.map((p) => p.id));
  const vistos = new Set(d.yaTiene.map(normalizar));
  const propuestas: PropuestaLM[] = [];
  const descartadas: Descarte[] = [];
  for (const raw of lista.slice(0, 6)) {
    const x = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const nombre = limpio(x.nombre, TOPES_PROPUESTA.nombre);
    const porQue = limpio(x.porQue ?? x.porque, TOPES_PROPUESTA.porQue);
    const plantilla = typeof x.plantilla === 'string' ? x.plantilla.trim() : '';
    const fuente = FUENTES_PROPUESTA.find((f) => f === x.fuente) ?? null;
    const no = (motivo: string) => { descartadas.push({ nombre: nombre || '(sin nombre)', motivo }); };
    if (!nombre || nombre.length < 6) { no('sin nombre'); continue; }
    if (!porQue) { no('sin el porqué'); continue; }
    if (!ids.has(plantilla)) { no(`la plantilla «${plantilla || '?'}» no existe`); continue; }
    if (!fuente) { no('no dice de dónde sale'); continue; }
    if (fuente !== 'oferta' && !d.nCompetidores) { no('dice que sale de la competencia, y no se le pasó ninguna'); continue; }
    const nombrado = nombraA(`${nombre} ${porQue}`, d.prohibidos);
    if (nombrado) { no(`nombra a un competidor (${nombrado})`); continue; }
    if (/(?<![\p{L}])competidor(?:es)?\s*\d/iu.test(`${nombre} ${porQue}`)) { no('nombra a un competidor por su número'); continue; }
    const voseo = marcasDeVoseo(`${nombre}. ${porQue}`);
    if (voseo.length) { no(`no está en español neutro (${voseo[0]})`); continue; }
    const k = normalizar(nombre);
    if (vistos.has(k)) { no('ya lo tiene, o está repetida'); continue; }
    vistos.add(k);
    propuestas.push({ plantilla, nombre, porQue, fuente });
    if (propuestas.length >= TOPE_PROPUESTAS) break;
  }
  return { ok: true, propuestas, descartadas };
}

/** Lo que se guarda: la última propuesta, para verla al volver sin gastar otra vez la IA. */
export type PropuestasGuardadas = { en: string; propuestas: PropuestaLM[] };

/** Lee lo guardado, o null. Pasa por la misma validación de forma (no la de los nombres: ya pasó al guardarse). */
export function leerGuardadas(raw: unknown): PropuestasGuardadas | null {
  try {
    const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!j || typeof j !== 'object' || typeof (j as { en?: unknown }).en !== 'string' || !Array.isArray((j as { propuestas?: unknown }).propuestas)) return null;
    const ids = new Set(PLANTILLAS_LEAD_MAGNET.map((p) => p.id));
    const propuestas = ((j as { propuestas: unknown[] }).propuestas).flatMap((x): PropuestaLM[] => {
      const o = x && typeof x === 'object' ? x as Record<string, unknown> : {};
      const nombre = limpio(o.nombre, TOPES_PROPUESTA.nombre);
      const porQue = limpio(o.porQue, TOPES_PROPUESTA.porQue);
      const fuente = FUENTES_PROPUESTA.find((f) => f === o.fuente);
      const plantilla = typeof o.plantilla === 'string' && ids.has(o.plantilla) ? o.plantilla : null;
      return nombre && porQue && fuente && plantilla ? [{ plantilla, nombre, porQue, fuente }] : [];
    }).slice(0, TOPE_PROPUESTAS);
    return { en: (j as { en: string }).en, propuestas };
  } catch { return null; }
}

/** De dónde sale, como lo lee el dueño. */
export const ROTULO_FUENTE: Record<FuentePropuesta, string> = {
  oferta: 'De tu oferta',
  competencia: 'De tu competencia',
  'las-dos': 'De tu oferta y tu competencia',
};
