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
//   Lo que SUBE el gasto (prender, subir) pasa antes por la ZONA y la FECHA DE FIN del negocio (lib/media-buyer/zona.ts), con
//   el público leído en vivo: es la promesa «en tal zona, solamente hasta tal fecha», y vale para el piloto, una persona, la
//   API de MaKo y un Deshacer que vuelve a prender.
// Deshacer es lo mismo al revés, con el `antes` que quedó guardado al lanzar.
// =============================================================================

import 'server-only';
import { metaWrite } from '@/lib/meta-write';
import { anuncioEnVivoPorZernio, cambiarEstadoPorZernio, cambiarPresupuestoPorZernio, variacionPorZernio, borrarAnuncioPorZernio, borrarCampanaPorZernio, leerErrorDeZernio } from '@/lib/zernio-ads';
import { aplicarTopes, presupuestoCambioDesdeLaPropuesta, presupuestoYaCambiado, seEstaCreando } from './topes';
import { saltoPresupuesto } from '@/lib/presupuesto-cambio';
import { revisarMontoEditado } from './monto';
import { fmtDinero } from '@/lib/format';
import { leerConfig, leerDecision, leerDecisiones, reclamar, actualizar, guardarConfig, type ConfigGuardada } from './store';
import { leerDatosCuenta, fmtUnidad, hoyDelNegocio, type DatosCuenta } from './datos';
import { lectorDeZona } from './publico';
import { finDeCampana, frenoPorFecha, motivoZona } from './zona';
import type { Decision, EstadoEntidad, NivelMeta } from './tipos';
import type { NodoMB } from './motor';
import { BORRADO, estaBorrado } from './senales';

export type Quien = { nombre: string; origen: 'piloto' | 'persona' };
export type ResultadoLanzar = { ok: true; decision: Decision; ajuste: string | null } | { ok: false; error: string; confirmar?: 'baja' };

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

/**
 * ¿La zona o la fecha de fin del negocio frenan esto? Sólo lo que SUBE el gasto (prender, subir). La campaña de la entidad
 * sale del árbol; el público, en vivo (publico.ts). Devuelve el motivo, o null si pasa.
 */
async function frenoDeZonaYFecha(ws: number, config: ConfigGuardada, datos: DatosCuenta, nodo: NodoMB, tipo: 'activar' | 'subir_presupuesto'): Promise<string | null> {
  const porId = new Map(datos.arbol.map((n) => [n.id, n] as const));
  let camp: NodoMB | undefined = nodo;
  while (camp && camp.nivel !== 'campaign') camp = camp.parentId ? porId.get(camp.parentId) : undefined;
  const fin = finDeCampana(config, camp?.id ?? null);
  const porFecha = fin ? frenoPorFecha(tipo, fin, await hoyDelNegocio(ws)) : null;
  if (porFecha) return porFecha;
  if (!config.zona.length) return null;
  return motivoZona(await lectorDeZona(ws, datos, config.zona)(nodo.nivel, nodo.id), nodo.nombre, config.zona);
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
export async function lanzar(ws: number, id: string, quien: Quien, opts: { presupuesto?: number; elegidas?: string[]; datos?: DatosCuenta; bajaConfirmada?: boolean } = {}): Promise<ResultadoLanzar> {
  const config = await leerConfig(ws);
  if (!config.existeTabla) return { ok: false, error: 'Falta aplicar la migración del Media Buyer: sin el registro no se lanza nada (no se podría deshacer).' };
  const d = await leerDecision(ws, id);
  if (!d) return { ok: false, error: 'Esa decisión no existe en este negocio.' };
  // Apagado no se lanza nada, SALVO la pausa por fecha de fin: es la regla de la persona (una campaña creada «hasta el 30» con el
  // Media Buyer apagado, que es como arranca todo negocio, tiene que terminar igual: revisión de Integración, M1). Sólo pausa.
  if (!config.encendido && !(d.tactica === 'hasta' && d.tipo === 'pausar')) return { ok: false, error: 'El Media Buyer está apagado: préndelo en Ajustes para lanzar decisiones.' };
  if (!['abierta', 'fallida', 'bloqueada'].includes(d.estado)) return { ok: false, error: `Esa decisión ya está ${d.estado}.` };

  const datos = opts.datos ?? await leerDatosCuenta(ws);
  const fmt = fmtUnidad(datos);

  if (d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook') return lanzarVariaciones(ws, d, quien, datos, opts.elegidas);
  // Una subida de creativos se lanza desde «Subir creativos» (lib/media-buyer/subir.ts): por acá caía en el camino de
  // presupuesto, quedaba «aplicada» sin crear nada y no se podía deshacer (verificación de tren-m, falla 8).
  if (d.tipo === 'crear_anuncios') return { ok: false, error: 'Los creativos se vuelven a subir desde «Subir creativos».' };
  if (d.tipo === 'crear_campana') return { ok: false, error: 'Una campaña nueva se lanza desde «Nueva campaña».' };

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

  // El cambio que se escribe. Si el presupuesto cambió desde que MaKo lo propuso, la decisión está vieja y se cierra: la
  // próxima corrida la vuelve a mirar con el de hoy (verificación de tren-m, falla 1). Lo que editó la persona manda.
  let despues: EstadoEntidad = { ...d.despues };
  let ajuste: string | null = null;
  if (d.despues.presupuesto != null) {
    if (actual.presupuesto == null) return { ok: false, error: 'En Meta ya no tiene presupuesto diario propio (se pasó a la campaña o a uno de por vida).' };
    if (opts.presupuesto != null) {
      // Un monto cinco veces más grande que el de hoy no sale; una baja de 80% o más, sólo confirmada (monto.ts →
      // revisarMontoEditado). Bajar no pasa por ningún tope, así que la confirmación es el único freno de una baja.
      const rev = revisarMontoEditado(opts.presupuesto, actual.presupuesto, { bajaConfirmada: opts.bajaConfirmada === true, fmt: (n) => fmtDinero(n, datos.moneda) });
      if (!rev.ok) return { ok: false, error: rev.error, ...(rev.confirmar ? { confirmar: rev.confirmar } : {}) };
      despues = { presupuesto: Math.round(opts.presupuesto * 100) / 100 };
    } else if (presupuestoYaCambiado(d, (await leerDecisiones(ws, 7)).decisiones)) {
      // Otra decisión ya cambió el presupuesto de esta entidad desde que MaKo propuso ésta: aplicar el mismo porcentaje sobre
      // el de hoy compondría (−20% dos veces deja −36%; revisión de tren-l, falla 1). Se cierra con el motivo.
      const motivo = 'El presupuesto ya se cambió con otra decisión desde que MaKo propuso ésta.';
      await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], { estado: 'vencida', error: motivo });
      return { ok: false, error: motivo };
    } else if (presupuestoCambioDesdeLaPropuesta(d.antes.presupuesto, actual.presupuesto)) {
      // Un cambio que no es una decisión del Media Buyer (el chat, la tabla, a mano en Meta) no lo ve `presupuestoYaCambiado`:
      // aplicar «el mismo porcentaje sobre el de hoy» lo componía, y el piloto lo hacía sin que nadie lo viera.
      const motivo = `El presupuesto cambió desde que MaKo lo propuso (de ${fmtDinero(d.antes.presupuesto!, datos.moneda)} a ${fmtDinero(actual.presupuesto, datos.moneda)} por día): lo vuelve a mirar mañana.`;
      await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], { estado: 'vencida', error: motivo });
      return { ok: false, error: motivo };
    }
  }

  // La zona y la fecha de fin, con el público leído en vivo: lo que sube el gasto fuera de la zona o pasada la fecha no se
  // escribe, lo lance quien lo lance. Queda «bloqueada» con el motivo, como un tope.
  const sube = d.tipo === 'activar' || despues.estado === 'ACTIVE' ? 'activar' as const
    : despues.presupuesto != null && actual.presupuesto != null && despues.presupuesto > actual.presupuesto ? 'subir_presupuesto' as const : null;
  if (sube) {
    const freno = await frenoDeZonaYFecha(ws, config, datos, nodo, sube);
    if (freno) {
      await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], { estado: 'bloqueada', error: freno });
      return { ok: false, error: freno };
    }
  }

  // Los topes, con lo leído en vivo.
  // La pausa por fecha de fin no pasa por los topes (pausar no sube nada) ni por el interruptor: sale también apagado (M1).
  const t = aplicarTopes(d.tipo, despues, {
    config: d.tactica === 'hasta' ? { ...config, encendido: true } : config, actual, inicioDelDia: d.tipo === 'subir_presupuesto' ? await inicioDelDia(ws, d.entidadId) : null,
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
  // Una PERSONA lanza sólo los textos que eligió a la vista: sin elegidas explícitas no sale nada (la tarjeta de Hoy y el
  // lote ya no las lanzan; esto lo asegura también para la API). El piloto usa las que marcó el Diseñador.
  if (quien.origen === 'persona' && !elegidas) return { ok: false, error: 'Elige los textos que salen: ábrelos en el detalle.' };
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
      // La de botón (variacion-boton.ts) cambia también el `call_to_action`: es lo único que prueba.
      const r = await variacionPorZernio(ws, d.entidadId, { primary_text: v.textoPrincipal, ...(v.titulo ? { headline: v.titulo } : {}), ...(v.cta ? { cta_type: v.cta } : {}) },
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
  // Sólo si sigue «aplicada»: si alguien la deshizo mientras se creaban (otra pestaña, MaKo por chat), lo creado se borra
  // en vez de quedar entregando con la decisión «deshecha» (revisión de tren-l, falla 8).
  const guardada = await reclamar(ws, d.id, ['aplicada'], { creados, error: null, nota: errores.length ? `Se crearon ${creados.length} de ${vars.length}: ${errores.join(' · ')}`.slice(0, 1000) : null });
  if (!guardada) {
    for (const ad of creados) await borrarAnuncioPorZernio(ws, ad).catch(() => null);
    return { ok: false, error: 'La deshicieron mientras se creaban los anuncios: los borré.' };
  }
  return { ok: true, decision: { ...tomada, creados }, ajuste: errores.length ? `Se crearon ${creados.length} de ${vars.length}.` : null };
}

/** Deshace una decisión aplicada: devuelve el estado o el presupuesto de ANTES, o apaga los anuncios que creó. */
export async function deshacer(ws: number, id: string, quien: string): Promise<ResultadoLanzar> {
  const config = await leerConfig(ws);
  const d = await leerDecision(ws, id);
  if (!d) return { ok: false, error: 'Esa decisión no existe en este negocio.' };
  if (d.estado !== 'aplicada') return { ok: false, error: 'Sólo se deshace lo que está aplicado.' };

  // Una campaña que lanzó MaKo: deshacerla es BORRARLA (con su conjunto y su anuncio), por la Zernio del negocio. Se lee la
  // cuenta primero: sin la conexión no se borra nada (no hay otro camino, y otro canal podría ser otra cuenta).
  if (d.tipo === 'crear_campana') {
    if (!/^[1-9]\d*$/.test(d.entidadId)) return { ok: false, error: 'No tengo el id de esa campaña en Meta (la creación no terminó): búscala y bórrala en el Administrador de anuncios.' };
    const datos = await leerDatosCuenta(ws);
    if (!datos.conexion) return { ok: false, error: 'Para borrar la campaña hace falta tu cuenta conectada por Zernio.' };
    const tomada = await reclamar(ws, id, ['aplicada'], { estado: 'deshecha', deshecha_por: quien.slice(0, 200), deshecha_at: new Date().toISOString() });
    if (!tomada) return { ok: false, error: 'Otra persona ya la está deshaciendo.' };
    try {
      await borrarCampanaPorZernio(ws, d.entidadId, datos.conexion.accountId);
    } catch (e) {
      const z = leerErrorDeZernio(e);
      const msg = z ? `Zernio: ${z.mensaje}` : e instanceof Error ? e.message : String(e);
      await actualizar(ws, id, { estado: 'aplicada', deshecha_por: null, deshecha_at: null, error: `No se pudo borrar: ${msg}`.slice(0, 1000) });
      return { ok: false, error: msg };
    }
    // Su fecha de fin ya no tiene campaña: se saca (best-effort; si falla, queda una fecha de una campaña borrada, inocua).
    if (config.hastaCampanas[d.entidadId]) await guardarConfig(ws, { hastaCampana: { campanaId: d.entidadId, fecha: null } }, quien).catch(() => null);
    return { ok: true, decision: tomada, ajuste: 'La campaña se borró en Meta, con su conjunto y su anuncio.' };
  }

  if (d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook' || d.tipo === 'crear_anuncios') {
    // «aplicada» con `creados` vacío es una a MITAD de su lanzamiento (los ids se guardan todos juntos al final).
    if (seEstaCreando(d)) return { ok: false, error: 'Todavía se están creando los anuncios: prueba de nuevo en unos segundos.' };
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
  const tipoVuelta = volver.estado === 'ACTIVE' ? 'activar' as const : volver.presupuesto != null && volver.presupuesto > (actual.presupuesto ?? 0) ? 'subir_presupuesto' as const : 'bajar_presupuesto' as const;
  // Volver a prender o volver a subir también respeta la zona y la fecha de fin (un Deshacer no es una puerta trasera).
  if (tipoVuelta !== 'bajar_presupuesto') {
    const freno = await frenoDeZonaYFecha(ws, config, datos, nodo, tipoVuelta);
    if (freno) return { ok: false, error: freno };
  }
  const t = aplicarTopes(tipoVuelta, volver, {
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
