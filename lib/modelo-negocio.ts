// =============================================================================
// modelo-negocio — CÓMO VENDE un negocio, y lo que eso decide en su arranque (27/10/2026)
// =============================================================================
// Martín (27/10/2026), textual: «no quiero que el onboarding se personalice a cada cliente, quiero que el onboarding sea
// capaz de entender todos los nichos y en este caso inmobiliarias». El onboarding estaba pensado para quien vende con
// una llamada (VSL, alto ticket): sin canal, el CRM caía en «Llamada de venta» con R1/R2, el volumen preguntaba por
// llamadas y el Plan arrancaba con proyectos de anuncios y VSL. A una inmobiliaria (campañas a formulario y cierre en
// persona) eso no le sirve.
//
// Acá vive el catálogo de MODELOS y lo que cada uno decide, como DATOS (nunca un `if` por cliente, que es lo que Martín
// prohibió; tests/onboarding-modelo.test.ts barre que ninguna regla del arranque pregunte por un workspace):
//   · `canal`: dónde cierra la venta (lib/fase-diagnostico.ts). Con él la pregunta de canal no se hace.
//   · `plantilla`: la base de su cuenta (lib/plantillas-modelo-reglas.ts: funnel, objetivo, KPIs, guía y, la que la trae,
//     su hoja del Dashboard). Sus etapas son las que se proponen como CRM.
//   · `tipoCrm`: el tipo de «Nuevo CRM» (lib/pipeline.ts → TIPOS_CRM). Sin plantilla, es el que se propone; con ella, sólo
//     pone por dónde entra la gente (sus `entradas`): las etapas son las de la plantilla.
//   · `agenda`: si vende con reuniones o visitas. Sin agenda, conectar Google Calendar se puede saltear (setup).
//   · `vsl`: si al tablero le sirven los proyectos de anuncios y VSL que siembra lib/todo-seeds.ts.
//   · `volumen`: la pregunta de volumen del diagnóstico con SUS palabras (los tramos son los de su canal: el voto de
//     cada opción a su fase no cambia).
//
// CÓMO SE ENTIENDE: la lectura (`modeloDeTexto`) sólo ORDENA y PROPONE con lo que la persona ya contó (el nombre de su
// negocio, lo que vende y a quién). Se guarda recién con el toque (AGENTS.md, «Leer texto libre con reglas falla en lo
// obvio: la red es que la persona CONFIRME lo que se entendió»). Sin una lectura clara, se pregunta sin recomendar.
//
// SIN `server-only`: lo usan la pantalla, la ruta, la API y los tests.
// =============================================================================

import type { CanalId } from './fase-diagnostico';
import { VOLUMEN_POR_CANAL } from './fase-diagnostico';
import type { TipoCrmId } from './pipeline';
import type { ModeloCliente } from './plantillas-modelo-reglas';

export const MODELOS_NEGOCIO = ['llamada', 'formulario', 'inmobiliaria', 'tienda', 'b2b', 'manufactura', 'chat', 'otro'] as const;
export type ModeloNegocio = (typeof MODELOS_NEGOCIO)[number];

export const esModeloNegocio = (v: unknown): v is ModeloNegocio =>
  typeof v === 'string' && (MODELOS_NEGOCIO as readonly string[]).includes(v);

export type DefModelo = {
  id: ModeloNegocio;
  /** La opción que se toca (corta: entra en un botón del chat). */
  label: string;
  /** Dónde cierra la venta. null = no se sabe: el diagnóstico lo pregunta. */
  canal: CanalId | null;
  /** La plantilla de su cuenta, si la hay. */
  plantilla?: ModeloCliente;
  /** El tipo de CRM: sin plantilla, el que se propone; con ella, por dónde entra la gente. Sin él, el de su canal. */
  tipoCrm?: TipoCrmId;
  /** Vende con reuniones o visitas: Google Calendar es obligatorio en el setup. */
  agenda: boolean;
  /** Al Plan le sirven los proyectos de anuncios y VSL (lib/todo-seeds.ts). */
  vsl: boolean;
  /** La pregunta de volumen del diagnóstico con sus palabras (con los tramos de su canal). */
  volumen?: string;
};

export const MODELOS: Readonly<Record<ModeloNegocio, DefModelo>> = {
  llamada: { id: 'llamada', label: 'Llamada de venta (alto ticket)', canal: 'llamadas', agenda: true, vsl: true },
  // Sin R1 ni R2: la gente deja sus datos en el anuncio y se le escribe (Joan, MK-15: «esa lógica no se utiliza»).
  formulario: {
    id: 'formulario', label: 'Anuncios con formulario', canal: 'conversaciones', tipoCrm: 'formulario_meta', agenda: true, vsl: false,
    volumen: '¿Cuántos formularios te llegan por mes?',
  },
  inmobiliaria: {
    id: 'inmobiliaria', label: 'Inmobiliaria', canal: 'presencial', plantilla: 'inmobiliaria', tipoCrm: 'formulario_meta', agenda: true, vsl: false,
    volumen: '¿Cuántas tasaciones o visitas haces por mes?',
  },
  tienda: {
    id: 'tienda', label: 'Tienda o local', canal: 'conversaciones', plantilla: 'tienda-b2c', tipoCrm: 'conversaciones', agenda: false, vsl: false,
    volumen: '¿Cuántas consultas o pedidos te llegan por mes?',
  },
  b2b: {
    id: 'b2b', label: 'A empresas, con reuniones', canal: 'llamadas', plantilla: 'b2b-crm', tipoCrm: 'llamada', agenda: true, vsl: false,
    volumen: '¿Cuántas reuniones con empresas tienes por mes?',
  },
  manufactura: {
    id: 'manufactura', label: 'Fabrico y vendo por cotización', canal: 'presencial', plantilla: 'manufactura', tipoCrm: 'presencial', agenda: true, vsl: false,
    volumen: '¿Cuántas cotizaciones envías por mes?',
  },
  chat: { id: 'chat', label: 'Servicios: vendo por chat', canal: 'conversaciones', tipoCrm: 'conversaciones', agenda: false, vsl: false },
  // «Otro»: lo de siempre. El diagnóstico pregunta el canal y el CRM sale de ahí (o lo arma MaKo).
  otro: { id: 'otro', label: 'Otro', canal: null, agenda: true, vsl: true },
};

export const defModelo = (id: ModeloNegocio): DefModelo => MODELOS[id];

/** El modelo de una opción tocada (su label exacto), o null. */
export const modeloDeLabel = (label: string): ModeloNegocio | null =>
  MODELOS_NEGOCIO.find((m) => MODELOS[m].label === label) ?? null;

/** Sin tildes ni mayúsculas: las regex de abajo son ASCII y su `\b` funciona (AGENTS.md: el `\b` de JS es ASCII). */
const normal = (t: string): string => (t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Las palabras que delatan cada modelo, EN ORDEN: gana la primera familia que aparece. Lo específico va primero (una
 * inmobiliaria también habla de «formularios»; un fabricante, de «empresas»). Ninguna nombra a un cliente: son
 * palabras del rubro.
 */
const PALABRAS: ReadonlyArray<[ModeloNegocio, RegExp]> = [
  ['inmobiliaria', /\b(?:inmobiliari\w*|bienes raices|real estate|propiedades|inmuebles?|tasacion\w*|captacion\w*|corredor\w* de propiedades|pre ?listing)\b/],
  ['manufactura', /\b(?:fabricamos|fabrico|fabricante\w*|fabricacion|manufactur\w*|industrial\w*|maquila\w*|metalurgic\w*|orden(?:es)? de compra|planta de produccion)\b/],
  ['llamada', /\b(?:curso\w*|mentori\w*|coaching|coach|programa\w*|alto ticket|high ticket|vsl|infoproducto\w*|masterclass|acompanamiento)\b/],
  ['tienda', /\b(?:tienda\w*|restaurante?s?|cafeteria\w*|e-?commerce|boutique\w*|panaderia\w*|delivery|venta al publico|local comercial|comida)\b/],
  ['b2b', /\b(?:b2b|empresas|corporativ\w*|saas|software para)\b/],
  ['formulario', /\b(?:formularios?|lead ads)\b/],
  ['chat', /\b(?:whatsapp|por chat|mensajes directos|dms?)\b/],
];

/**
 * El modelo que se ENTIENDE de lo que la persona ya contó, o null si no hay una señal clara. Sólo ordena y propone: el
 * toque decide. No mira nada que no sea el texto (ni el workspace ni quién es).
 */
export function modeloDeTexto(texto: string): ModeloNegocio | null {
  const t = normal(texto);
  if (!t.trim()) return null;
  for (const [m, re] of PALABRAS) if (re.test(t)) return m;
  return null;
}

/** Las opciones de la pregunta: el leído primero (si hay), y los demás en su orden. «Otro», siempre al final. */
export function opcionesDeModelo(leido: ModeloNegocio | null): string[] {
  const orden = leido && leido !== 'otro' ? [leido, ...MODELOS_NEGOCIO.filter((m) => m !== leido)] : [...MODELOS_NEGOCIO];
  return orden.map((m) => MODELOS[m].label);
}

/** El índice (en `opciones`) del modelo que se entiende de un texto escrito, o null. */
export function indiceDeModelo(texto: string, opciones: readonly string[]): number | null {
  const m = modeloDeTexto(texto);
  if (!m) return null;
  const i = opciones.indexOf(MODELOS[m].label);
  return i >= 0 ? i : null;
}

/** La pregunta: con lo leído, lo propone; sin lectura, pregunta sin recomendar. */
export function preguntaDeModelo(leido: ModeloNegocio | null, negocio: string): string {
  if (leido && leido !== 'otro') return `Por lo que me contaste, vendes así: «${MODELOS[leido].label}». ¿Es así? Con eso armo tu CRM y tus métricas.`;
  return `¿Cómo vende ${negocio.trim() || 'tu negocio'}? Con eso armo tu CRM y tus métricas.`;
}

/** La plantilla de su cuenta, si su modelo la trae (lib/plantillas-modelo-reglas.ts). */
export const plantillaDe = (m: ModeloNegocio | null | undefined): ModeloCliente | null => (m ? MODELOS[m].plantilla ?? null : null);

/** El tipo de CRM de su modelo, si lo declara. */
export const tipoCrmDe = (m: ModeloNegocio | null | undefined): TipoCrmId | null => (m ? MODELOS[m].tipoCrm ?? null : null);

/** Dónde cierra la venta según el modelo (null: el diagnóstico lo pregunta). */
export const canalDelModelo = (m: ModeloNegocio | null | undefined): CanalId | null => (m ? MODELOS[m].canal : null);

/** ¿Al tablero le sirven los proyectos de anuncios y VSL? Sin modelo guardado, lo de siempre (sí). */
export const siembraVsl = (m: unknown): boolean => (esModeloNegocio(m) ? MODELOS[m].vsl : true);

/** ¿Vende con reuniones o visitas? Sin modelo, sí (el lado seguro: Calendar queda obligatorio). */
export const usaAgenda = (m: unknown): boolean => (esModeloNegocio(m) ? MODELOS[m].agenda : true);

/** La pregunta de volumen: el texto del modelo con los tramos de su canal; sin modelo, la del canal. */
export function volumenDe(m: ModeloNegocio | null | undefined, canal: CanalId | null | undefined): { texto: string; opciones: string[] } {
  const base = VOLUMEN_POR_CANAL[canal ?? 'llamadas'];
  const propio = m ? MODELOS[m].volumen : undefined;
  return propio ? { texto: propio, opciones: base.opciones } : base;
}

/** El setting del negocio con su modelo (lo escribe el onboarding al confirmarlo; lo leen el Plan y la API). */
export const CLAVE_MODELO = 'negocio.modelo';

/** El modelo guardado, o null. Tolera lo viejo o lo roto (un valor que no es un modelo es «no hay»). */
export function modeloGuardado(raw: string | null | undefined): ModeloNegocio | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return esModeloNegocio(v) ? v : null;
  } catch {
    return esModeloNegocio(raw) ? raw : null;
  }
}
