// =============================================================================
// Media Buyer — LANZAR y DESHACER una decisión
// =============================================================================
// Lo único que escribe en la cuenta de un cliente. El orden, y por qué:
//   1. Se lee la cuenta EN VIVO: entre que MaKo propuso y alguien lanza pueden pasar horas, y una persona pudo haber
//      cambiado el presupuesto o pausado lo mismo a mano.
//   2. Se miran los TOPES con ese estado (lib/media-buyer/topes.ts). Si no pasa, queda «bloqueada» con el motivo.
//   3. Se RECLAMA la decisión (abierta → aplicada) y recién después se escribe: dos clics, dos pestañas, el cron y una
//      persona a la vez lanzaban dos veces (AGENTS.md, «Confirmar RECLAMA antes de ejecutar»). Si la escritura falla,
//      queda «fallida» con el error escrito y se puede reintentar.
//   4. Se escribe por Zernio si el negocio conectó su Zernio con esta cuenta, o con su token de Meta. Un canal por
//      escritura, sin «si falla uno, probar el otro»: un error a mitad de camino puede haber escrito, y reintentar por
//      otro lado duplicaría.
// Deshacer es lo mismo al revés, con el `antes` que quedó guardado al lanzar.
// =============================================================================

import 'server-only';
import { metaWrite } from '@/lib/meta-write';
import { anuncioEnVivoPorZernio, cambiarEstadoPorZernio, cambiarPresupuestoPorZernio, variacionPorZernio, borrarAnuncioPorZernio, leerErrorDeZernio } from '@/lib/zernio-ads';
import { aplicarTopes } from './topes';
import { leerConfig, leerDecision, leerDecisiones, reclamar, actualizar } from './store';
import { leerDatosCuenta, fmtUnidad, type DatosCuenta } from './datos';
import type { Decision, EstadoEntidad, NivelMeta } from './tipos';
import type { NodoMB } from './motor';
import { BORRADO, estaBorrado } from './senales';

export type Quien = { nombre: string; origen: 'piloto' | 'persona' };
export type ResultadoLanzar = { ok: true; decision: Decision; ajuste: string | null } | { ok: false; error: string };

/** La inversa de `aUnidad` (unidad del gasto → moneda de la cuenta), calculada con UN punto de la curva: la conversión es lineal. */
const deUnidadDe = (d: DatosCuenta) => (u: number): number => {
  const uno = d.conversor.aUsdNum(1);
  return uno > 0 ? u / uno : u;
};

function estadoVivo(n: NodoMB): EstadoEntidad {
  const e: EstadoEntidad = {};
  if (n.configurado === 'ACTIVE' || n.configurado === 'PAUSED') e.estado = n.configurado;
  if (n.presupuestoDia != null) e.presupuesto = n.presupuestoDia;
  return e;
}

/**
 * El interruptor de un ANUNCIO se relee en Meta antes de decidir: por Zernio, el árbol trae el de los anuncios con hasta una
 * hora de atraso (lib/zernio-ads.ts → anuncioEnVivoPorZernio). Las campañas y los conjuntos ya vienen en vivo
 * (`conInterruptorEnVivo`); por el token de Meta, todo el árbol es en vivo. Si no contesta, queda lo del árbol.
 */
async function conAnuncioEnVivo(ws: number, datos: DatosCuenta, nodo: NodoMB): Promise<void> {
  if (nodo.nivel !== 'ad' || datos.fuente !== 'zernio') return;
  const v = await anuncioEnVivoPorZernio(ws, nodo.id).catch(() => null);
  if (v && estaBorrado(v.estado, v.entrega)) nodo.configurado = BORRADO;
  else if (v?.configurado === 'ACTIVE' || v?.configurado === 'PAUSED') nodo.configurado = v.configurado;
}

/** El presupuesto con el que la entidad empezó HOY: el `antes` de la primera subida aplicada hoy (Tijuana ≈ UTC-7). */
async function inicioDelDia(ws: number, entidadId: string): Promise<number | null> {
  const { decisiones } = await leerDecisiones(ws, 2);
  const hoy = new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);
  const deHoy = decisiones
    .filter((x) => x.entidadId === entidadId && x.tipo === 'subir_presupuesto' && (x.estado === 'aplicada') && x.aplicadaAt
      && new Date(Date.parse(x.aplicadaAt) - 7 * 3600_000).toISOString().slice(0, 10) === hoy)
    .sort((a, b) => (a.aplicadaAt! < b.aplicadaAt! ? -1 : 1));
  return deHoy[0]?.antes.presupuesto ?? null;
}

/** Escribe un estado o un presupuesto por el canal del negocio. Tira con un mensaje que se le puede mostrar a la persona. */
async function escribir(ws: number, datos: DatosCuenta, nivel: NivelMeta, id: string, cambio: EstadoEntidad): Promise<'zernio' | 'meta'> {
  if (datos.conexion) {
    try {
      if (cambio.estado) await cambiarEstadoPorZernio(ws, nivel, id, cambio.estado);
      if (cambio.presupuesto != null) {
        if (nivel === 'ad') throw new Error('Un anuncio no tiene presupuesto propio.');
        // Con la cuenta de Zernio: una campaña sin anuncios en Zernio da 404 sin ella (lib/zernio-ads.ts).
        await cambiarPresupuestoPorZernio(ws, nivel, id, cambio.presupuesto, datos.conexion.accountId);
      }
      return 'zernio';
    } catch (e) {
      const z = leerErrorDeZernio(e);
      throw new Error(z ? `Zernio: ${z.mensaje}${z.subcode ? ` (Meta ${z.subcode})` : ''}` : e instanceof Error ? e.message : String(e));
    }
  }
  if (cambio.estado) {
    const r = await metaWrite({ level: nivel, id, op: 'status', status: cambio.estado }, ws);
    if (!r.ok) throw new Error(`Meta: ${r.message}${r.error_subcode ? ` (${r.error_subcode})` : ''}`);
  }
  if (cambio.presupuesto != null) {
    if (nivel === 'ad') throw new Error('Un anuncio no tiene presupuesto propio.');
    const r = await metaWrite({ level: nivel, id, op: 'budget', dailyBudgetMxn: cambio.presupuesto }, ws);
    if (!r.ok) throw new Error(`Meta: ${r.message}${r.error_subcode ? ` (${r.error_subcode})` : ''}`);
  }
  return 'meta';
}

/**
 * Lanza una decisión. `presupuesto` = el monto que la persona editó en «Editar» (moneda de la cuenta); `elegidas` = las
 * variaciones tildadas. `datos` = una lectura fresca que ya tiene quien llama (el piloto lanza varias seguidas).
 */
export async function lanzar(ws: number, id: string, quien: Quien, opts: { presupuesto?: number; elegidas?: string[]; datos?: DatosCuenta } = {}): Promise<ResultadoLanzar> {
  const config = await leerConfig(ws);
  if (!config.existeTabla) return { ok: false, error: 'Falta aplicar la migración del Media Buyer: sin el registro no se lanza nada (no se podría deshacer).' };
  if (!config.encendido) return { ok: false, error: 'El Media Buyer está apagado: préndelo en Ajustes para lanzar decisiones.' };
  const d = await leerDecision(ws, id);
  if (!d) return { ok: false, error: 'Esa decisión no existe en este negocio.' };
  if (!['abierta', 'fallida', 'bloqueada'].includes(d.estado)) return { ok: false, error: `Esa decisión ya está ${d.estado}.` };

  const datos = opts.datos ?? await leerDatosCuenta(ws);
  const fmt = fmtUnidad(datos);

  if (d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook') return lanzarVariaciones(ws, d, quien, datos, opts.elegidas);

  const nodo = datos.arbol.find((n) => n.id === d.entidadId);
  if (!nodo) {
    await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], { estado: 'vencida', error: 'Ya no está en la cuenta (se borró o se archivó).' });
    return { ok: false, error: 'Eso ya no está en la cuenta de Meta.' };
  }
  await conAnuncioEnVivo(ws, datos, nodo);
  const actual = estadoVivo(nodo);
  // ⚠️ LO BORRADO NO SE TOCA: Zernio contesta 200 al pausar un anuncio borrado (medido por el chat «Zernio y CAPI», 26/10/2026),
  // y la decisión quedaba «aplicada» sobre algo que ya no existe. Se cierra como vencida, con el motivo.
  if (nodo.configurado === BORRADO) {
    await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], { estado: 'vencida', error: 'Se borró en Meta.' });
    return { ok: false, error: 'Eso se borró en Meta: no hay nada que cambiar.' };
  }

  // ¿Ya está como la decisión lo quería? Entonces no hay nada que lanzar: alguien lo hizo a mano.
  if (d.despues.estado && actual.estado === d.despues.estado && d.despues.presupuesto == null) {
    await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], { estado: 'vencida', error: `Ya estaba ${d.despues.estado === 'PAUSED' ? 'pausado' : 'prendido'} en Meta.` });
    return { ok: false, error: `Ya estaba ${d.despues.estado === 'PAUSED' ? 'pausado' : 'prendido'} en Meta.` };
  }

  // El cambio que se escribe. Si el presupuesto cambió desde que MaKo lo propuso, se aplica el MISMO porcentaje sobre
  // el de hoy (la decisión era «subir 20%», no «llevarlo a 60»). Lo que editó la persona manda.
  let despues: EstadoEntidad = { ...d.despues };
  let ajuste: string | null = null;
  if (d.despues.presupuesto != null) {
    if (actual.presupuesto == null) return { ok: false, error: 'En Meta ya no tiene presupuesto diario propio (se pasó a la campaña o a uno de por vida).' };
    if (opts.presupuesto != null) {
      if (!(opts.presupuesto > 0)) return { ok: false, error: 'El presupuesto tiene que ser mayor que cero.' };
      despues = { presupuesto: Math.round(opts.presupuesto * 100) / 100 };
    } else if (d.antes.presupuesto && Math.abs(actual.presupuesto - d.antes.presupuesto) / d.antes.presupuesto > 0.01) {
      despues = { presupuesto: Math.round(actual.presupuesto * (d.despues.presupuesto / d.antes.presupuesto) * 100) / 100 };
      ajuste = 'El presupuesto había cambiado desde la propuesta: se aplicó el mismo porcentaje sobre el de hoy.';
    }
  }

  // Los topes, con lo leído en vivo.
  const t = aplicarTopes(d.tipo, despues, {
    config, actual, inicioDelDia: d.tipo === 'subir_presupuesto' ? await inicioDelDia(ws, d.entidadId) : null,
    totalActivo: datos.totalActivo,
    presupuestoQueSuma: d.tipo === 'activar' ? presupuestoQueSuma(datos, nodo) : null,
    aUnidad: datos.conversor.aUsdNum, deUnidad: deUnidadDe(datos), fmt,
  });
  if (!t.ok) {
    await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], { estado: 'bloqueada', error: t.motivo });
    return { ok: false, error: t.motivo };
  }
  despues = t.despues;
  ajuste = [ajuste, t.ajuste].filter(Boolean).join(' ') || null;

  const ahora = new Date().toISOString();
  const tomada = await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], {
    estado: 'aplicada', origen: quien.origen, aplicada_por: quien.nombre.slice(0, 200), aplicada_at: ahora,
    antes: actual, despues, nota: ajuste, error: null, canal: datos.conexion ? 'zernio' : 'meta',
  });
  if (!tomada) return { ok: false, error: 'Otra persona (o el piloto) ya la está lanzando.' };
  try {
    const cambio: EstadoEntidad = {};
    if (despues.estado && despues.estado !== actual.estado) cambio.estado = despues.estado;
    if (despues.presupuesto != null && despues.presupuesto !== actual.presupuesto) cambio.presupuesto = despues.presupuesto;
    await escribir(ws, datos, d.nivel, d.entidadId, cambio);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await actualizar(ws, id, { estado: 'fallida', error: msg.slice(0, 1000), aplicada_at: null, aplicada_por: null, origen: null });
    return { ok: false, error: msg };
  }
  // La lectura que tiene quien llama queda al día: el piloto lanza varias seguidas con la MISMA lectura, y el tope de la
  // cuenta de la segunda tiene que ver lo que subió la primera.
  reflejarEnDatos(datos, nodo, despues);
  return { ok: true, decision: { ...tomada }, ajuste };
}

/** Lleva a la lectura en memoria lo que se acaba de escribir (presupuesto, interruptor y el total prendido de la cuenta). */
export function reflejarEnDatos(datos: DatosCuenta, nodo: NodoMB, despues: EstadoEntidad): void {
  const esUnidad = (nodo.nivel === 'campaign' && nodo.nivelPresupuesto === 'campaign') || (nodo.nivel === 'adset' && nodo.nivelPresupuesto !== 'campaign');
  const aU = datos.conversor.aUsdNum;
  const antesPrendido = nodo.configurado === 'ACTIVE';
  const antesMonto = nodo.presupuestoDia ?? 0;
  if (despues.estado) nodo.configurado = despues.estado;
  if (despues.presupuesto != null) nodo.presupuestoDia = despues.presupuesto;
  if (!esUnidad) return;
  const ahoraPrendido = nodo.configurado === 'ACTIVE';
  datos.totalActivo += (ahoraPrendido ? aU(nodo.presupuestoDia ?? 0) : 0) - (antesPrendido ? aU(antesMonto) : 0);
}

/** Lo que suma al gasto diario prender esta entidad: su presupuesto o el de la unidad de presupuesto que la contiene. */
function presupuestoQueSuma(datos: DatosCuenta, n: NodoMB): number | null {
  if (n.presupuestoDia) return n.presupuestoDia;
  // Un anuncio o un conjunto CBO no tienen presupuesto propio: prender UN anuncio no suma presupuesto si su conjunto ya
  // gasta. Sólo suma si todo lo de arriba estaba prendido y él era lo único apagado; eso lo decide Meta, no se adivina.
  return null;
}

async function lanzarVariaciones(ws: number, d: Decision, quien: Quien, datos: DatosCuenta, elegidas?: string[]): Promise<ResultadoLanzar> {
  if (!datos.conexion) {
    return { ok: false, error: 'Para crear anuncios nuevos MaKo usa tu Zernio: conéctalo en Ajustes (con el token propio, Meta los rechaza por la app en desarrollo, error 1885183).' };
  }
  const vars = (d.variaciones ?? []).filter((v) => (elegidas ? elegidas.includes(v.id) : v.elegida));
  if (!vars.length) return { ok: false, error: 'Elige al menos una variación.' };
  const ahora = new Date().toISOString();
  const tomada = await reclamar(ws, d.id, ['abierta', 'fallida', 'bloqueada'], {
    estado: 'aplicada', origen: quien.origen, aplicada_por: quien.nombre.slice(0, 200), aplicada_at: ahora, canal: 'zernio',
    variaciones: (d.variaciones ?? []).map((v) => ({ ...v, elegida: vars.some((x) => x.id === v.id) })),
  });
  if (!tomada) return { ok: false, error: 'Otra persona (o el piloto) ya la está lanzando.' };
  const creados: string[] = [];
  const errores: string[] = [];
  for (const [i, v] of vars.entries()) {
    try {
      const r = await variacionPorZernio(ws, d.entidadId, { primary_text: v.textoPrincipal, ...(v.titulo ? { headline: v.titulo } : {}) },
        { nombre: `MaKo v${i + 1}`, idempotencia: `mb:${d.id}:${v.id}` });
      creados.push(r.adId);
    } catch (e) {
      const z = leerErrorDeZernio(e);
      errores.push(z ? z.mensaje : e instanceof Error ? e.message : String(e));
    }
  }
  // Las copias nacen EN PAUSA (Zernio, `statusOption: PAUSED`). Se prenden juntas al final: un anuncio a medias no entrega.
  for (const ad of creados) {
    try { await cambiarEstadoPorZernio(ws, 'ad', ad, 'ACTIVE'); } catch (e) { errores.push(`No pude prender ${ad}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  if (!creados.length) {
    await actualizar(ws, d.id, { estado: 'fallida', error: errores.join(' · ').slice(0, 1000), aplicada_at: null, aplicada_por: null, origen: null });
    return { ok: false, error: errores[0] ?? 'Zernio no creó ningún anuncio.' };
  }
  await actualizar(ws, d.id, { creados, error: null, nota: errores.length ? `Se crearon ${creados.length} de ${vars.length}: ${errores.join(' · ')}`.slice(0, 1000) : null });
  return { ok: true, decision: { ...tomada, creados }, ajuste: errores.length ? `Se crearon ${creados.length} de ${vars.length}.` : null };
}

/** Deshace una decisión aplicada: devuelve el estado o el presupuesto de ANTES, o apaga los anuncios que creó. */
export async function deshacer(ws: number, id: string, quien: string): Promise<ResultadoLanzar> {
  const config = await leerConfig(ws);
  const d = await leerDecision(ws, id);
  if (!d) return { ok: false, error: 'Esa decisión no existe en este negocio.' };
  if (d.estado !== 'aplicada') return { ok: false, error: 'Sólo se deshace lo que está aplicado.' };

  if (d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook' || d.tipo === 'crear_anuncios') {
    const tomada = await reclamar(ws, id, ['aplicada'], { estado: 'deshecha', deshecha_por: quien.slice(0, 200), deshecha_at: new Date().toISOString() });
    if (!tomada) return { ok: false, error: 'Otra persona ya la está deshaciendo.' };
    const errores: string[] = [];
    for (const ad of d.creados) {
      try { await borrarAnuncioPorZernio(ws, ad); } catch (e) { errores.push(`${ad}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (errores.length) await actualizar(ws, id, { nota: `No pude borrar: ${errores.join(' · ')}`.slice(0, 1000) });
    return { ok: true, decision: tomada, ajuste: errores.length ? 'Algunos anuncios no se pudieron borrar: revísalos en Meta.' : null };
  }

  const datos = await leerDatosCuenta(ws);
  const nodo = datos.arbol.find((n) => n.id === d.entidadId);
  if (!nodo) return { ok: false, error: 'Eso ya no está en la cuenta de Meta.' };
  await conAnuncioEnVivo(ws, datos, nodo);
  const actual = estadoVivo(nodo);
  if (nodo.configurado === BORRADO) return { ok: false, error: 'Eso se borró en Meta: no hay nada que deshacer.' };
  // ⚠️ SÓLO SI NADIE LO TOCÓ DESPUÉS. Si una persona cambió el presupuesto o lo prendió a mano desde que MaKo lo aplicó,
  // «deshacer» pisaría ESE cambio con el de hace días (docs/diseno-ads-autopilot.md, «Deshacer»). Se compara con lo que
  // MaKo dejó; un presupuesto con 1% de diferencia es el redondeo de la moneda, no otra persona.
  const cambio = (a: number | undefined, b: number | undefined) => a != null && b != null && Math.abs(a - b) / Math.max(b, 0.01) > 0.01;
  if ((d.despues.estado && actual.estado && actual.estado !== d.despues.estado) || cambio(actual.presupuesto, d.despues.presupuesto)) {
    return { ok: false, error: 'Cambió desde que MaKo lo aplicó: deshacerlo pisaría ese cambio. Revísalo en la cuenta.' };
  }
  const volver: EstadoEntidad = {};
  if (d.antes.estado && d.antes.estado !== actual.estado) volver.estado = d.antes.estado;
  if (d.antes.presupuesto != null && d.antes.presupuesto !== actual.presupuesto) volver.presupuesto = d.antes.presupuesto;
  if (!Object.keys(volver).length) {
    await reclamar(ws, id, ['aplicada'], { estado: 'deshecha', deshecha_por: quien.slice(0, 200), deshecha_at: new Date().toISOString(), nota: 'Ya estaba como antes.' });
    return { ok: false, error: 'Ya estaba como antes: no hubo nada que deshacer.' };
  }
  const t = aplicarTopes(volver.estado === 'ACTIVE' ? 'activar' : volver.presupuesto != null && volver.presupuesto > (actual.presupuesto ?? 0) ? 'subir_presupuesto' : 'bajar_presupuesto', volver, {
    config, actual, inicioDelDia: null, totalActivo: datos.totalActivo,
    presupuestoQueSuma: presupuestoQueSuma(datos, nodo), aUnidad: datos.conversor.aUsdNum, deUnidad: deUnidadDe(datos), fmt: fmtUnidad(datos),
  }, { deshacer: true });
  if (!t.ok) return { ok: false, error: t.motivo };
  const tomada = await reclamar(ws, id, ['aplicada'], { estado: 'deshecha', deshecha_por: quien.slice(0, 200), deshecha_at: new Date().toISOString() });
  if (!tomada) return { ok: false, error: 'Otra persona ya la está deshaciendo.' };
  try {
    await escribir(ws, datos, d.nivel, d.entidadId, t.despues);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await actualizar(ws, id, { estado: 'aplicada', deshecha_por: null, deshecha_at: null, error: `No se pudo deshacer: ${msg}`.slice(0, 1000) });
    return { ok: false, error: msg };
  }
  return { ok: true, decision: tomada, ajuste: null };
}
