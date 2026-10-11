// =============================================================================
// Los datos de un lead (y del negocio), listos para meter en un mensaje
// =============================================================================
// ⚠️ MÓDULO SIN `server-only`, A PROPÓSITO. Esto es la mitad que se puede equivocar
// —qué columna alimenta cada token y cómo se escribe un monto, una fecha o un booleano—
// y adentro de `variables-resolver.ts` (que sí es `server-only`, porque lee la base)
// ningún test la podría importar. Es la misma razón por la que vive afuera la condición
// de `exigirClienteDePrueba`.
//
// Una función por ENTIDAD (sexta tanda, 09/10/2026): la ficha, la hora de sus reuniones, su
// producto, sus etiquetas, sus cuotas, su curso, el perfil del negocio y su lead magnet. El
// resolvedor lee una entidad sólo si el texto la nombra (`fuentesQueNombra`, lib/variables-aviso.ts)
// y le pasa lo leído a la función de acá: lo que se decide sin base se decide acá, con test.
//
// Los `import type` se borran en compilación, así que no arrastran nada del server.

import type { Lead } from './leads';
import type { Pago } from './pagos';
import type { Clase, Progreso } from './curso';
// Puros y sin `server-only`, igual que este módulo: el test los sigue pudiendo importar.
import { resumenRespuestas } from './meta-leads-campos';
import { claseCompleta } from './curso-bloqueo';

/** `1500` → `US$ 1.500`. Sin decimales: un aviso no es un recibo. */
export const plata = (n: number): string => `US$ ${Math.round(n).toLocaleString('es-AR')}`;
/** `2026-10-14` → `14/10`. El año no entra: lo que se avisa es de esta semana. */
export const fecha = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
};

/**
 * Cómo se llama en pantalla cada valor de `estado_lead`. Lo pone el CÓDIGO: lo que la
 * base guarda es `no_responde`, que adentro de un WhatsApp se lee como un slug.
 */
const ROTULO_ESTADO: Readonly<Record<string, string>> = {
  abierto: 'abierto', ganado: 'ganado', perdido: 'perdido',
  descalificado: 'descalificado', no_responde: 'no responde',
};

/**
 * El nombre del lead partido como lo parte el motor (lib/template-vars.ts, `valoresVariablesLead`):
 * `nombre` es el PRIMERO —para saludar «Hola Sofía» y no «Hola Sofía Contreras»—, `apellido` el
 * resto. `lead_nombre` es el nombre de antes de los avisos (el completo). Vacío no entra.
 */
export function valoresDelNombre(nombreCompleto: string | null | undefined): Record<string, string> {
  const full = (nombreCompleto ?? '').trim().replace(/\s+/g, ' ');
  if (!full) return {};
  const partes = full.split(' ');
  const out: Record<string, string> = { nombre: partes[0]!, nombre_completo: full, lead_nombre: full };
  const apellido = partes.slice(1).join(' ');
  if (apellido) out.apellido = apellido;
  return out;
}

/**
 * Los valores que salen de la FICHA del lead.
 *
 * ⚠️ LO QUE ESTÁ EN `null` NO ENTRA AL MAPA, y entonces su token sale CRUDO. Es la
 * decisión que ya estaba escrita para los tokens de otro alcance y vale igual acá: un
 * `{{lead_saldo}}` crudo se ve raro y se nota, y uno reemplazado por «—» o por vacío
 * deja el mensaje cojo sin que nadie se entere de que faltaba un dato. Y `0` SÍ entra:
 * «no debe nada» es un hecho, no un faltante.
 */
export function valoresDelLead(l: Lead): Record<string, string> {
  const out: Record<string, string> = { ...valoresDelNombre(l.nombre) };
  const txt = (k: string, v: string | null | undefined) => { if (typeof v === 'string' && v.trim()) out[k] = v.trim(); };
  const num = (k: string, v: number | null | undefined) => { if (typeof v === 'number' && Number.isFinite(v)) out[k] = plata(v); };
  const dia = (k: string, v: string | null | undefined) => { if (v) out[k] = fecha(v); };
  const si = (k: string, v: boolean | null | undefined) => { if (typeof v === 'boolean') out[k] = v ? 'sí' : 'no'; };
  // Las columnas que el tipo `Lead` no declara (las trae `getLead`, que hace `select(*)`).
  const fila = l as Lead & { junta_1_url?: string | null; junta_2_url?: string | null };

  txt('lead_email', l.email);
  txt('lead_telefono', l.telefono);
  txt('empresa', l.empresa);
  txt('lead_empresa', l.empresa);
  txt('lead_web', l.web ?? null);
  dia('lead_alta', l.created_at);

  txt('lead_estado', ROTULO_ESTADO[l.estado_lead] ?? l.estado_lead);
  txt('lead_motivo_perdida', l.motivo_perdida);
  txt('lead_closer', l.closer ?? null);
  txt('lead_setter', l.setter ?? null);
  si('lead_calificado', l.calificado);

  dia('lead_fecha_agenda', l.fecha_agenda);
  dia('lead_fecha_r1', l.fecha_junta_1);
  dia('lead_fecha_r2', l.fecha_junta_2);
  txt('lead_link_r1', fila.junta_1_url ?? null);
  txt('lead_link_r2', fila.junta_2_url ?? null);
  si('lead_asistio_r1', l.asistio_j1);
  si('lead_asistio_r2', l.asistio_j2);

  num('lead_monto_cierre', l.monto_cierre_usd);
  num('lead_cobrado', l.total_cobrado_usd);
  // El saldo se CALCULA, y sólo si hay cierre: sin monto de cierre, «falta cobrar» no
  // tiene referencia y daría el negativo de lo pagado.
  if (typeof l.monto_cierre_usd === 'number' && Number.isFinite(l.monto_cierre_usd)) {
    out.lead_saldo = plata(Math.max(0, l.monto_cierre_usd - (l.total_cobrado_usd ?? 0)));
  }
  num('lead_cuota', l.monto_cuota_usd);
  if (typeof l.dia_de_pago === 'number') out.lead_dia_de_pago = String(l.dia_de_pago);
  dia('lead_fecha_cierre', l.fecha_cierre);
  num('lead_suscripcion', l.suscripcion_monto_usd ?? null);

  txt('lead_origen', l.origen_lead);
  txt('lead_campana', l.meta_campaign_name);
  txt('lead_conjunto', l.meta_adset_name);
  txt('lead_anuncio', l.meta_ad_name);
  txt('lead_utm_source', l.utm_source);
  txt('lead_utm_medium', l.utm_medium);
  txt('lead_utm_campaign', l.utm_campaign);
  txt('lead_utm_content', l.utm_content);

  txt('lead_facturacion', l.respuesta_facturacion);
  txt('lead_colaboradores', l.respuesta_colaboradores);
  txt('lead_objetivo', l.respuesta_objetivo);
  txt('lead_cuando_empezar', l.respuesta_cuando_empezar);
  txt('lead_inversion', l.respuesta_inversion);
  txt('lead_decisor', l.respuesta_decisor);
  txt('lead_formulario', resumenRespuestas(l.meta_field_data));

  return out;
}

/** «17:30»: la hora de pared de un instante en una zona. `null` = el instante o la zona no se entienden. */
export function horaEnZona(iso: string | null | undefined, tz: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    return new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
  } catch { return null; }
}

/**
 * La HORA de sus reuniones, en la zona del NEGOCIO (nunca la del servidor, que en Vercel es UTC:
 * medido el 08/10/2026, un aviso dijo «01:00 a.m.» para una reunión de las 18 de Tijuana). Sale de
 * `junta_*_at` (la hora exacta que guarda la agenda); una reunión con sólo la fecha no tiene hora
 * y no se le inventa una.
 */
export function valoresConZona(l: Pick<Lead, 'junta_1_at' | 'junta_2_at'>, tz: string): Record<string, string> {
  const out: Record<string, string> = {};
  const h1 = horaEnZona(l.junta_1_at, tz);
  const h2 = horaEnZona(l.junta_2_at, tz);
  if (h1) out.lead_hora_r1 = h1;
  if (h2) out.lead_hora_r2 = h2;
  return out;
}

/**
 * Su ETAPA y su PRODUCTO. `etapaClave` es la que decide `etapaVigenteDe` (lib/funnel-etapas.ts) con
 * las etapas de ESE producto: la misma que dibujan el tablero y la ficha. Se dice con el rótulo de la
 * etapa; una clave que el producto ya no tiene no se dice (sería un slug en un WhatsApp).
 */
export function valoresDelProducto(p: { etapaClave: string | null; etapas: ReadonlyArray<{ key: string; label: string }>; producto: string | null }): Record<string, string> {
  const out: Record<string, string> = {};
  const etapa = p.etapaClave ? p.etapas.find((e) => e.key === p.etapaClave)?.label?.trim() : null;
  if (etapa) out.lead_etapa = etapa;
  if (p.producto?.trim()) out.lead_producto = p.producto.trim();
  return out;
}

/** Sus etiquetas, en el orden del catálogo. Sin ninguna es un hecho («ninguna»), no un faltante. */
export function valoresDeEtiquetas(nombres: readonly string[]): Record<string, string> {
  const n = nombres.map((x) => x.trim()).filter(Boolean);
  return { lead_etiquetas: n.length ? n.join(', ') : 'ninguna' };
}

/**
 * Sus CUOTAS (`pagos`, número 0 = el cobro inicial, 1…6 = las cuotas).
 *   · la próxima: la primera sin pagar, por número (el inicial también, si falta);
 *   · su vencimiento: la `fecha_esperada` de ésa (sin fecha no se inventa una);
 *   · las pagadas: «N de M» sobre las cuotas, sin el cobro inicial.
 * Sin filas, nada: un lead sin plan de pagos no tiene «0 de 0 cuotas».
 */
export function valoresDePagos(pagos: ReadonlyArray<Pick<Pago, 'numero' | 'monto_usd' | 'fecha_esperada' | 'pagado'>>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!pagos.length) return out;
  const orden = [...pagos].sort((a, b) => a.numero - b.numero);
  const proxima = orden.find((p) => !p.pagado);
  if (proxima) {
    if (Number.isFinite(proxima.monto_usd)) out.lead_proxima_cuota = plata(proxima.monto_usd);
    if (proxima.fecha_esperada) out.lead_proxima_cuota_vence = fecha(proxima.fecha_esperada);
  }
  const cuotas = orden.filter((p) => p.numero >= 1);
  if (cuotas.length) out.lead_cuotas_pagadas = `${cuotas.filter((p) => p.pagado).length} de ${cuotas.length}`;
  return out;
}

/** Lo que dice `{{link_pago}}` cuando el lead no tiene ningún cobro pendiente. */
export const SIN_LINK_DE_PAGO = 'sin link de pago pendiente';

/**
 * Su LINK PARA PAGAR: el de su cobro PENDIENTE más nuevo (`cobroPendienteDelLead` + `linkDelCobro`,
 * lib/cobros.ts), que el resolvedor busca en la tabla y nunca en la pasarela.
 *
 * ⚠️ SIN COBRO PENDIENTE NO QUEDA CRUDO, a diferencia de un dato de la ficha en null: «no tiene un
 * link para pagar» es un HECHO (como «ninguna» en las etiquetas), y un `{{link_pago}}` crudo le
 * llegaría a la persona que tiene que pagar con pinta de mensaje roto. Lo que no se pudo LEER sí
 * queda crudo (el resolvedor no llama a esta función): eso no es un hecho.
 */
export function valoresDelCobro(link: string | null | undefined): Record<string, string> {
  const l = typeof link === 'string' ? link.trim() : '';
  return { link_pago: l || SIN_LINK_DE_PAGO };
}

/**
 * Su CURSO: el avance con la MISMA regla que abre las clases en el portal (`claseCompleta`,
 * lib/curso-bloqueo.ts: con tarea, la envió; sin tarea, la marcó hecha o vio el video). Con una
 * cuenta propia, el mensaje diría «te faltan 3» sobre un portal que dice 2.
 *   · `clases` en el orden del curso (`clasesDelProducto`), de todos sus productos con curso;
 *   · `link`: el de SU portal, sólo si ya se le dio (`linkDeAccesoExistente`).
 * Sin clases, nada (no tiene curso). Con todo completo no hay «próxima clase».
 */
export function valoresDelCurso(p: { clases: readonly Clase[]; progreso: ReadonlyMap<number, Pick<Progreso, 'estado' | 'pct' | 'hechaAt'>>; link: string | null }): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.link) out.curso_link = p.link;
  if (!p.clases.length) return out;
  const hecha = (c: Clase) => claseCompleta(c, p.progreso.get(c.id));
  const n = p.clases.filter(hecha).length;
  out.curso_avance = `${n} de ${p.clases.length}`;
  out.curso_pct = `${Math.round((n / p.clases.length) * 100)} %`;
  const sigue = p.clases.find((c) => !hecha(c));
  if (sigue?.titulo?.trim()) out.curso_proxima_clase = sigue.titulo.trim();
  return out;
}

/**
 * El PERFIL del negocio que cargó en el Archivero (Second Brain: `mako.onboarding.answers`, lo que
 * lee `ver_perfil_negocio`). Las claves son las de `DEFAULT_SCHEMA` (lib/onboarding.ts). El precio
 * se escribe como plata si es un número; si alguien escribió «5 mil», tal cual.
 */
export function valoresDelPerfil(respuestas: Readonly<Record<string, unknown>>): Record<string, string> {
  const out: Record<string, string> = {};
  const v = (k: string): string => (typeof respuestas[k] === 'string' ? (respuestas[k] as string).trim() : typeof respuestas[k] === 'number' ? String(respuestas[k]) : '');
  const poner = (k: string, val: string) => { if (val) out[k] = val; };
  poner('negocio_oferta', v('oferta_nombre'));
  const precio = v('oferta_ticket');
  const n = Number(precio.replace(/[^\d.]/g, ''));
  poner('negocio_precio', /^\s*(us\$|usd|\$)?\s*[\d.,]+\s*(usd)?\s*$/i.test(precio) && Number.isFinite(n) && n > 0 ? plata(n) : precio);
  poner('negocio_promesa', v('oferta_promesa'));
  poner('negocio_garantia', v('oferta_garantia'));
  poner('negocio_personaje', v('marca_nombre'));
  return out;
}

/** El LEAD MAGNET del negocio (el primero de `getEntregables`): su nombre y dónde está. */
export function valoresDelLeadMagnet(entregables: ReadonlyArray<{ nombre?: string; enlace?: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  const e = entregables.find((x) => x?.nombre?.trim());
  if (!e) return out;
  out.negocio_lead_magnet = e.nombre!.trim();
  if (e.enlace?.trim()) out.negocio_lead_magnet_link = e.enlace.trim();
  return out;
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** La fecha, el día y la hora de AHORA, en la zona del negocio. Una zona que no se entiende no inventa nada. */
export function valoresDelMomento(ahoraMs: number, tz: string): Record<string, string> {
  try {
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(new Date(ahoraMs));
    const de = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
    const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(de('weekday'));
    return {
      fecha: `${de('day')}/${de('month')}`,
      hora: `${de('hour')}:${de('minute')}`,
      ...(dia >= 0 ? { dia_semana: DIAS_SEMANA[dia]! } : {}),
    };
  } catch { return {}; }
}
