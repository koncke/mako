// =============================================================================
// leads-markdown — los leads como DOCUMENTO, no como planilla
// =============================================================================
// El export a Markdown era una tabla de 28 columnas y una fila por lead: literal
// mente ilegible. Una tabla de más de cinco o seis columnas no se lee en ningún
// lado (ni en un chat, ni en Notion, ni en un doc) — se corta, se desalinea y hay
// que hacer scroll horizontal para enterarse de un dato.
//
// El formato correcto para "leer" es el opuesto al de "calcular": una FICHA por
// lead, agrupada por etapa, con un resumen arriba para el que solo quiere el número.
// Mismo criterio que app/plan/board/exportar.ts → tableroAMarkdown.
//
// Reglas duras del formato (si las cambiás, cambiá también el wizard):
//  · Un bullet por GRUPO de campos elegido. Si el grupo no tiene NINGÚN dato, la
//    línea no se imprime — una ficha llena de "—" es peor que una ficha corta.
//  · Plata con separador de miles y decimales solo si existen ($7,500 / $1,147.59).
//    fmtUSD de lib/format redondea a entero, así que acá va una variante propia:
//    en cobranza, $1,147.59 redondeado a $1,148 es un dato equivocado.
//  · Booleanos NUNCA "sí/no": una reunión sin marcar no es "no asistió".
//  · Derivados gratis: lo que falta cobrar y el % cobrado se calculan solos.
// =============================================================================

import { fmtDDMMYYYY } from '@/lib/date-utils';
import { type CampoLead } from './leads-exportar';

/** Un lead ya resuelto para el documento (la action lo arma desde la fila cruda). */
export type LeadDoc = {
  id: number;
  nombre: string;
  empresa: string | null;
  etapaKey: string;
  etapaLabel: string;
  email: string | null;
  telefono: string | null;
  estado: string | null;
  calificado: boolean | null;
  monto: number | null;
  cobrado: number | null;
  ventaTipo: string | null;
  suscripcionMonto: number | null;
  suscripcionMeses: number | null;
  fechaR1: string | null;
  asistioR1: boolean | null;
  fechaR2: string | null;
  asistioR2: boolean | null;
  closer: string | null;
  setter: string | null;
  origen: string | null;
  anuncio: string | null;
  campana: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  creado: string | null;
  agenda: string | null;
  cierre: string | null;
  primerPago: string | null;
  visitorId: string | null;
  respuestas: Array<{ q: string; a: string }>;
  motivoPerdida: string | null;
};

export type CabeceraDoc = {
  alcance: string;   // "Mis clientes ganados" / "Ganado · Facturando"
  filtros: string;   // "Este mes (por cuándo entró) · Origen: X"
  incluye: string;   // "Contacto · Montos · Reuniones"
  hoyISO: string;    // fecha del export (YYYY-MM-DD)
};

/**
 * Plata legible: separador de miles y decimales SOLO si existen.
 * $7,500 (venta redonda) y $1,147.59 (cobro real) en el mismo documento.
 */
export function fmtPlata(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
}

/** Una asistencia sin marcar NO es un "no": son tres estados, no dos. */
const asistencia = (b: boolean | null): string => (b === true ? '(asistió)' : b === false ? '(no asistió)' : '(sin marcar)');

const limpio = (s: string | null | undefined): string => (s ?? '').replace(/[\r\n]+/g, ' ').trim();

/** Escapa lo que rompe una celda de tabla Markdown. */
const celda = (s: string): string => limpio(s).replace(/\|/g, '\\|');

const num = (n: number | null | undefined): number => (Number.isFinite(Number(n)) ? Number(n) : 0);

/** Lo que falta cobrar nunca es negativo: un sobrepago no es una deuda al revés. */
const faltaCobrar = (l: LeadDoc): number => Math.max(0, num(l.monto) - num(l.cobrado));

const pctCobrado = (l: LeadDoc): number | null => {
  const v = num(l.monto);
  if (v <= 0) return null;
  return Math.round((num(l.cobrado) / v) * 100);
};

// ── Los bullets de una ficha ─────────────────────────────────────────────────
// Cada uno devuelve null si el grupo no tiene NADA que mostrar: así la línea
// entera desaparece en vez de imprimir una fila de guiones.

function bulletContacto(l: LeadDoc): string | null {
  const p = [limpio(l.email), limpio(l.telefono)].filter(Boolean);
  return p.length ? `- **Contacto** — ${p.join(' · ')}` : null;
}

function bulletEtapa(l: LeadDoc): string | null {
  // La etapa ya está en la línea de identidad; acá va lo que la línea no dice.
  const p: string[] = [];
  if (limpio(l.estado)) p.push(`estado ${limpio(l.estado)}`);
  if (l.calificado === true) p.push('calificado');
  if (l.calificado === false) p.push('no calificado');
  return p.length ? `- **Estado** — ${p.join(' · ')}` : null;
}

function bulletMontos(l: LeadDoc): string | null {
  const vendido = num(l.monto);
  const cobrado = num(l.cobrado);
  const esSub = l.ventaTipo === 'suscripcion';
  if (!vendido && !cobrado && !esSub) return null;
  const p: string[] = [];
  if (vendido) p.push(`vendido **${fmtPlata(vendido)}**`);
  if (cobrado) {
    const pct = pctCobrado(l);
    p.push(`cobrado ${fmtPlata(cobrado)}${pct == null ? '' : ` (${pct}%)`}`);
  }
  const falta = faltaCobrar(l);
  if (falta > 0) p.push(`falta ${fmtPlata(falta)}`);
  if (esSub) {
    const meses = l.suscripcionMeses ? `${l.suscripcionMeses} meses` : 'indefinida';
    p.push(`suscripción ${fmtPlata(l.suscripcionMonto)}/mes · ${meses}`);
  }
  return p.length ? `- **Montos** — ${p.join(' · ')}` : null;
}

function bulletReuniones(l: LeadDoc): string | null {
  const p: string[] = [];
  if (l.fechaR1) p.push(`R1 ${fmtDDMMYYYY(l.fechaR1)} ${asistencia(l.asistioR1)}`);
  if (l.fechaR2) p.push(`R2 ${fmtDDMMYYYY(l.fechaR2)} ${asistencia(l.asistioR2)}`);
  return p.length ? `- **Reuniones** — ${p.join(' · ')}` : null;
}

function bulletEquipo(l: LeadDoc): string | null {
  const p: string[] = [];
  if (limpio(l.closer)) p.push(`closer ${limpio(l.closer)}`);
  if (limpio(l.setter)) p.push(`setter ${limpio(l.setter)}`);
  return p.length ? `- **Equipo** — ${p.join(' · ')}` : null;
}

function bulletOrigen(l: LeadDoc): string | null {
  // Sin duplicar: si el anuncio y la campaña dicen lo mismo, sale una sola vez.
  const vistos = new Set<string>();
  const p: string[] = [];
  for (const v of [l.anuncio, l.campana, l.utmCampaign, l.utmContent, l.origen]) {
    const s = limpio(v);
    if (!s || vistos.has(s.toLowerCase())) continue;
    vistos.add(s.toLowerCase());
    p.push(s);
  }
  return p.length ? `- **Origen** — ${p.slice(0, 3).join(' · ')}` : null;
}

function bulletFechas(l: LeadDoc): string | null {
  const p: string[] = [];
  if (l.creado) p.push(`creado ${fmtDDMMYYYY(l.creado)}`);
  if (l.agenda) p.push(`agendó ${fmtDDMMYYYY(l.agenda)}`);
  if (l.cierre) p.push(`cerró ${fmtDDMMYYYY(l.cierre)}`);
  if (l.primerPago) p.push(`primer pago ${fmtDDMMYYYY(l.primerPago)}`);
  return p.length ? `- **Fechas** — ${p.join(' · ')}` : null;
}

function bulletTracking(l: LeadDoc): string | null {
  return limpio(l.visitorId) ? `- **Tracking** — visitante \`${limpio(l.visitorId)}\`` : null;
}

function bulletPerdida(l: LeadDoc): string | null {
  return limpio(l.motivoPerdida) ? `- **Por qué se perdió** — ${limpio(l.motivoPerdida)}` : null;
}

/** Las respuestas van como sub-lista: seis preguntas en una línea no se leen. */
function bloqueRespuestas(l: LeadDoc): string[] {
  if (!l.respuestas.length) return [];
  return ['- **Respuestas del formulario**', ...l.respuestas.map((r) => `  - ${r.q} — ${limpio(r.a)}`)];
}

function fichaDeLead(l: LeadDoc, on: Set<CampoLead>): string[] {
  const out: string[] = [`### ${limpio(l.nombre) || `Lead #${l.id}`}`];
  const identidad = [limpio(l.empresa), `lead #${l.id}`, limpio(l.etapaLabel)].filter(Boolean);
  out.push(`_${identidad.join(' · ')}_`);

  const lineas: Array<string | null> = [];
  if (on.has('contacto')) lineas.push(bulletContacto(l));
  if (on.has('etapa')) lineas.push(bulletEtapa(l));
  if (on.has('montos')) lineas.push(bulletMontos(l));
  if (on.has('reuniones')) lineas.push(bulletReuniones(l));
  if (on.has('equipo')) lineas.push(bulletEquipo(l));
  if (on.has('origen')) lineas.push(bulletOrigen(l));
  if (on.has('fechas')) lineas.push(bulletFechas(l));
  if (on.has('perdida')) lineas.push(bulletPerdida(l));
  if (on.has('tracking')) lineas.push(bulletTracking(l));
  out.push(...lineas.filter((x): x is string => x != null));
  if (on.has('respuestas')) out.push(...bloqueRespuestas(l));
  out.push('');
  return out;
}

// ── El documento ─────────────────────────────────────────────────────────────

type Grupo = { key: string; label: string; leads: LeadDoc[]; vendido: number; cobrado: number };

/**
 * Agrupa por etapa EN EL ORDEN DEL FUNNEL (no alfabético ni por cantidad): así el
 * documento se lee de arriba a abajo como se recorre el pipeline. Las etapas que
 * no están en el funnel actual (overrides viejos, derivadas legacy) van al final.
 */
function agrupar(leads: LeadDoc[], ordenEtapas: string[], dentro: (a: LeadDoc, b: LeadDoc) => number): Grupo[] {
  const porEtapa = new Map<string, Grupo>();
  for (const l of leads) {
    const g = porEtapa.get(l.etapaKey) ?? { key: l.etapaKey, label: l.etapaLabel, leads: [], vendido: 0, cobrado: 0 };
    g.leads.push(l);
    g.vendido += num(l.monto);
    g.cobrado += num(l.cobrado);
    porEtapa.set(l.etapaKey, g);
  }
  const idx = (k: string) => { const i = ordenEtapas.indexOf(k); return i < 0 ? ordenEtapas.length : i; };
  const grupos = [...porEtapa.values()].sort((a, b) => idx(a.key) - idx(b.key) || a.label.localeCompare(b.label));
  for (const g of grupos) g.leads.sort(dentro);
  return grupos;
}

/** Orden dentro de cada etapa: por defecto el monto manda (lo primero que se mira). */
const porMontoDesc = (a: LeadDoc, b: LeadDoc): number => num(b.monto) - num(a.monto) || a.nombre.localeCompare(b.nombre);

export function leadsAMarkdown(
  leads: LeadDoc[],
  campos: CampoLead[],
  cab: CabeceraDoc,
  ordenEtapas: string[],
  dentroDelGrupo: (a: LeadDoc, b: LeadDoc) => number = porMontoDesc,
): string {
  const on = new Set(campos);
  const vendido = leads.reduce((s, l) => s + num(l.monto), 0);
  const cobrado = leads.reduce((s, l) => s + num(l.cobrado), 0);

  const out: string[] = [
    `# Leads · ${cab.alcance}`,
    '',
    `_${leads.length} lead${leads.length === 1 ? '' : 's'} · ${fmtPlata(vendido)} vendido · ${fmtPlata(cobrado)} cobrado · exportado el ${fmtDDMMYYYY(cab.hoyISO)}_`,
    '',
    `**Filtros:** ${cab.filtros}`,
    '',
    `**Incluye:** ${cab.incluye}`,
    '',
  ];

  if (!leads.length) {
    out.push('> Con esos filtros no salió ningún lead.', '');
    return out.join('\n');
  }

  const grupos = agrupar(leads, ordenEtapas, dentroDelGrupo);

  // Resumen por etapa: es lo único que mira el que abre el documento para decidir
  // si vale la pena leerlo. Va arriba, y las columnas de plata alineadas a la derecha.
  out.push('| Etapa | Leads | Vendido | Cobrado | Falta cobrar |', '| --- | ---: | ---: | ---: | ---: |');
  for (const g of grupos) {
    const falta = Math.max(0, g.vendido - g.cobrado);
    out.push(`| ${celda(g.label)} | ${g.leads.length} | ${fmtPlata(g.vendido)} | ${fmtPlata(g.cobrado)} | ${fmtPlata(falta)} |`);
  }
  out.push(`| **Total** | **${leads.length}** | **${fmtPlata(vendido)}** | **${fmtPlata(cobrado)}** | **${fmtPlata(Math.max(0, vendido - cobrado))}** |`, '');

  for (const g of grupos) {
    const plata = on.has('montos') && g.vendido > 0 ? ` · ${fmtPlata(g.vendido)}` : '';
    out.push('---', '', `## ${g.label} · ${g.leads.length} lead${g.leads.length === 1 ? '' : 's'}${plata}`, '');
    for (const l of g.leads) out.push(...fichaDeLead(l, on));
  }

  return out.join('\n');
}
