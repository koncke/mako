// =============================================================================
// Media Buyer — UNA corrida del agente sobre un negocio
// =============================================================================
// Lo que hace el cron (y el botón «Analizar ahora»): lee la cuenta, corre el motor, escribe las variaciones de los
// ganadores con la IA del negocio, guarda las decisiones nuevas y, SÓLO si el negocio eligió el piloto automático,
// las lanza. Madgicx audita «every 24 hours»; acá el cron corre una vez por día después de la ingesta de Meta, y las
// decisiones tienen clave por día: correr dos veces no duplica.
//
// ⚠️ EL PILOTO AUTOMÁTICO LO PRENDE CADA NEGOCIO. Por defecto (sin fila de configuración) el modo es «propone»: las
// decisiones quedan abiertas hasta que una persona las lanza. Nada en este archivo cambia el modo de nadie.
// =============================================================================

import 'server-only';
import { hoyEnTijuana } from '@/lib/date-utils';
import { proponer, objetivoRecomendado, previaDeDecision } from './motor';
import { leerConfig, leerDecisiones, guardarPropuestas, vencerViejas, marcarCorrida, MediaBuyerSinTabla, cupoDe } from './store';
import { lugaresParaPropios, modoEfectivo, ordenDelCupo, recomendadasHoy, textoCupo } from './plan';
import { resolverTacticas } from './tacticas';
import { leerDatosCuenta, SinCuentaParaOperar, fmtUnidad, presupuestoMinimoCuenta, diasAntes, cuentaDelNegocio, hoyDelNegocio } from './datos';
import { lectorDeZona } from './publico';
import { motivoZona, pausasPorFecha, pausasPendientes } from './zona';
import { prepararVariaciones } from './variaciones';
import { propuestasDeAgentesPropios } from './agentes-ia';
import { alertasProtect, type Alerta } from './protect';
import { lanzar } from './ejecutar';
import { crearNotificacion } from '@/lib/notificaciones';
import { MUEVE_PLATA, type Decision, type Propuesta } from './tipos';

export type ResumenCorrida = {
  /**
   * `parcial`, `datos_viejos` y `moneda_sin_tasa` son ABSTENERSE: el agente no decide sobre una cuenta que no vio entera, con
   * el día de ayer sin cerrar, o con un gasto que no sabe pasar a dólares (docs/diseno-ads-autopilot.md, «Qué decide y con qué»).
   */
  estado: 'ok' | 'apagado' | 'sin_tabla' | 'sin_cuenta' | 'parcial' | 'datos_viejos' | 'moneda_sin_tasa' | 'cuenta_compartida' | 'error';
  mensaje?: string;
  objetivo?: number | null;
  objetivoEsRecomendado?: boolean;
  propuestas?: number;
  nuevas?: number;
  lanzadas?: number;
  fallidas?: string[];
  sinVariaciones?: string[];
  /** Lo que no pudieron mirar los agentes propios (su IA no contestó, por ejemplo). */
  agentes?: string[];
  /** Protect: lo que se rompió en la cuenta (protect.ts). Queda en `ultimaCorridaInfo` y la pantalla lo muestra. */
  alertas?: Alerta[];
  /** Las que el motor vio y no entraron en el cupo del plan de hoy (MaKo Esencial: lib/media-buyer/plan.ts). */
  fueraDelCupo?: number;
  /**
   * Lo que el agente VIO en la cuenta: campañas vivas y, de ellas, prendidas. Van SÓLO con la corrida terminada (estado
   * `ok`): una cuenta vista a medias no dice cuántas hay. Quedan en `ultimaCorridaInfo` y es con lo que la pantalla de Hoy
   * distingue «todavía no tienes campañas» de «no hubo cambios» sin volver a leer Meta
   * (lib/media-buyer/cartel-hoy.ts; docs/hallazgos-ads.md, «Hoy no hay cambios»).
   */
  campanas?: number;
  activas?: number;
  /** DÓNDE: lo que subía o prendía algo fuera de la zona del negocio (o que no se pudo confirmar adentro), con el motivo. */
  fueraDeZona?: string[];
  avisos?: string[];
  fuente?: string;
};

// Lo que el motor ve de cada decisión: UNA función (motor.ts), con los anuncios creados y su original (el Relevo los usa).
const previa = previaDeDecision;

/** Analiza la cuenta del negocio y guarda (y en piloto, lanza) lo que haya que hacer hoy. Nunca tira. */
/**
 * `soloProponer`: deja las decisiones abiertas aunque el negocio tenga el piloto automático. Lo usa MaKo cuando se lo piden
 * por chat (analizar_cuenta_media_buyer): un «mirá la cuenta» no es un «lanzá lo que veas».
 */
export async function analizarCuenta(ws: number, opts: { hoy?: string; quien?: string; cuentasVistas?: Set<string>; soloProponer?: boolean } = {}): Promise<ResumenCorrida> {
  const hoy = opts.hoy ?? hoyEnTijuana();
  let r: ResumenCorrida;
  try {
    r = await correr(ws, hoy, opts.cuentasVistas, opts.soloProponer === true);
  } catch (e) {
    r = e instanceof MediaBuyerSinTabla ? { estado: 'sin_tabla', mensaje: e.message }
      : e instanceof SinCuentaParaOperar ? { estado: 'sin_cuenta', mensaje: e.message }
        : { estado: 'error', mensaje: e instanceof Error ? e.message : String(e) };
  }
  if (r.estado !== 'sin_tabla') await marcarCorrida(ws, { ...r, quien: opts.quien ?? 'cron', hoy }).catch(() => null);
  return r;
}

async function correr(ws: number, hoy: string, cuentasVistas: Set<string> | undefined, soloProponer: boolean): Promise<ResumenCorrida> {
  const config = await leerConfig(ws);
  if (!config.existeTabla) return { estado: 'sin_tabla', mensaje: 'Falta aplicar la migración del Media Buyer.' };
  if (!config.encendido) return { estado: 'apagado' };
  // ⚠️ UNA CUENTA PUBLICITARIA COMPARTIDA POR DOS NEGOCIOS se maneja UNA vez por corrida (ws13 y ws14 comparten token y cuenta;
  // el ws3 llegó a tener la del ws1): si no, el agente actuaría dos veces sobre la misma cuenta, con los topes de cada uno.
  if (cuentasVistas) {
    const act = await cuentaDelNegocio(ws);
    if (act && cuentasVistas.has(act)) return { estado: 'cuenta_compartida', mensaje: `La cuenta ${act} ya la miró otro negocio en esta corrida.` };
    if (act) cuentasVistas.add(act);
  }
  await vencerViejas(ws);
  const datos = await leerDatosCuenta(ws, hoy);
  if (datos.parcial) return { estado: 'parcial', mensaje: 'Meta devolvió la cuenta a medias: hoy no se decide nada.', fuente: datos.fuente };
  if (datos.conversor.aUsd(1) == null) {
    return { estado: 'moneda_sin_tasa', mensaje: `La cuenta cobra en ${datos.moneda ?? 'una moneda desconocida'} y MaKo no tiene su tasa: no decide sobre montos que no sabe comparar.`, fuente: datos.fuente };
  }
  // Datos viejos: con gasto en la ventana y sin el día de AYER, la ingesta no llegó (o la cuenta se frenó, como el ws1 por
  // saldo impago el 15/10): decidir sobre eso es decidir sobre un hueco. Sin gasto en dos semanas no hay nada que decidir.
  // Con nada prendido no hay riesgo (sólo puede proponer un Revive), así que sólo se abstiene si algo está gastando.
  if (datos.ultimoDia && datos.ultimoDia < diasAntes(hoy, 1) && datos.fuente === 'meta' && datos.totalActivo > 0) {
    return { estado: 'datos_viejos', mensaje: `El último día con gasto es el ${datos.ultimoDia}: MaKo espera a tener el de ayer.`, fuente: datos.fuente };
  }
  const cupo = await cupoDe(ws);
  const recomendado = objetivoRecomendado(datos.crm, config.kpi);
  const objetivo = config.objetivo ?? recomendado;
  const { decisiones } = await leerDecisiones(ws, 21);

  // Cada táctica con su estado, sus umbrales y lo que cubre (tacticas.ts). Sin piloto en el plan, ninguna es automática.
  const tacticas = resolverTacticas(config.tacticas, { piloto: modoEfectivo(config.modo, cupo) === 'piloto', pilotoPermitido: cupo.piloto });
  // HASTA: el día del negocio (su zona horaria), no el de Tijuana de las ventanas: «hasta el 5» es el 5 de quien lo puso.
  const hoyNegocio = await hoyDelNegocio(ws);
  const avisos = [...datos.avisos];
  if (!hoyNegocio && (config.hasta || Object.keys(config.hastaCampanas).length)) avisos.push('No pude leer tu zona horaria: hoy no se pausa nada por fecha de fin y no se sube lo que tiene fecha.');
  const todasProps = proponer({
    ahora: Date.now(), config, objetivo, arbol: datos.arbol, tacticas,
    corta: datos.corta, larga: datos.larga, crm: datos.crm,
    historial: decisiones.map(previa),
    aUnidad: datos.conversor.aUsdNum, fmt: fmtUnidad(datos), presupuestoMinimo: presupuestoMinimoCuenta(datos), hoyNegocio,
  }, hoy);
  // Las pausas por fecha de fin no son recomendaciones: no entran al cupo del plan y se guardan aparte (abajo).
  const porFecha = todasProps.filter((p) => p.tactica === 'hasta');
  const props = todasProps.filter((p) => p.tactica !== 'hasta');

  // Las variaciones se escriben ANTES de guardar: una propuesta de variaciones sin variaciones no se puede lanzar. Sólo las
  // que todavía no existen (misma clave = ya se escribieron hoy, no se gasta IA dos veces).
  // EL CUPO DEL PLAN (Esencial: 2 por día) se mira ANTES de escribirlas: lo que no entra hoy no gasta IA, y mañana el motor
  // lo vuelve a ver si sigue igual. Entra primero lo que cuida la plata (plan.ts → ordenDelCupo).
  const yaGuardadas = new Set(decisiones.map((d) => d.clave));
  // Los agentes PROPIOS (una regla escrita en palabras, agentes-propios.ts): la IA del negocio la mira contra la cuenta y
  // deja acciones con la táctica `manual`, que el piloto no lanza nunca (abajo, `automaticas`). Entran al cupo al final.
  // Se les pregunta sólo si queda lugar en el cupo después de lo nuevo del motor, que entra antes (falla 9 de tren-m):
  // preguntarle a un agente propio gasta IA, y gastarla por algo que no va a entrar hoy es gastarla al vacío.
  const yaHoy = recomendadasHoy(decisiones, hoy);
  const libres = lugaresParaPropios(props.filter((p) => !yaGuardadas.has(p.clave)).length, yaHoy, cupo.recomendacionesDia);
  const propios = await propuestasDeAgentesPropios(ws, { hoy, datos, kpi: config.kpi, objetivo, fmt: fmtUnidad(datos), yaHoy: yaGuardadas, lugares: libres });
  // DÓNDE: lo que sube o prende algo que muestra anuncios fuera de la zona (o que no se pudo confirmar adentro) no se propone.
  // Se mira ANTES del cupo (no le saca el lugar a otra) y con el público leído en vivo, sólo de lo que se iba a proponer.
  // `lanzar` lo vuelve a mirar al escribir: entre proponer y lanzar alguien pudo cambiar el público.
  const lector = config.zona.length ? lectorDeZona(ws, datos, config.zona) : null;
  const fueraDeZona: string[] = [];
  const candidatas: Propuesta[] = [];
  for (const p of [...props, ...propios.propuestas].filter((x) => !yaGuardadas.has(x.clave))) {
    if (lector && MUEVE_PLATA.has(p.tipo)) {
      const motivo = motivoZona(await lector(p.nivel, p.entidadId), p.entidadNombre, config.zona);
      if (motivo) { fueraDeZona.push(motivo); continue; }
    }
    candidatas.push(p);
  }
  const { orden, lugares } = ordenDelCupo(candidatas, yaHoy, cupo.recomendacionesDia);
  let quedan = lugares;
  let fueraDelCupo = 0;
  const sinVariaciones: string[] = [];
  const listas: Propuesta[] = [];
  for (const p of orden) {
    if (quedan <= 0) { fueraDelCupo++; continue; }
    if (p.tipo === 'variaciones_texto' || p.tipo === 'variaciones_hook') {
      const v = await prepararVariaciones(ws, p);
      if (!v.variaciones.length) { sinVariaciones.push(`${p.entidadNombre}: ${v.motivo ?? 'sin variaciones'}`); continue; }
      listas.push({ ...p, variaciones: v.variaciones });
    } else {
      listas.push(p);
    }
    quedan--;
  }
  const nuevasMotor = await guardarPropuestas(ws, listas, datos.moneda);
  // Aparte: sin la 0350 la táctica `hasta` rompe el CHECK de la tabla, y eso no puede llevarse puesta la corrida entera.
  let nuevasFecha: Decision[] = [];
  const porFechaNuevas = porFecha.filter((p) => !yaGuardadas.has(p.clave));
  if (porFechaNuevas.length) {
    try { nuevasFecha = await guardarPropuestas(ws, porFechaNuevas, datos.moneda); }
    catch (e) { avisos.push(`No pude guardar las pausas por fecha de fin (${e instanceof Error ? e.message.slice(0, 160) : String(e)}).`); }
  }
  const nuevas = [...nuevasFecha, ...nuevasMotor];
  // Las pausas por fecha guardadas antes que todavía no salieron (zona.ts → pausasPendientes): se relanzan cada vez.
  const fechaPendientes = pausasPendientes(pausasPorFecha(datos.arbol, config, hoyNegocio), decisiones);

  // El piloto automático: lanza lo nuevo con la MISMA lectura (que `lanzar` mantiene al día), de lo que BAJA el gasto a lo
  // que lo SUBE, así el tope de la cuenta ve primero lo que se liberó.
  let lanzadas = 0;
  const fallidas: string[] = [];
  // Sólo lo de las tácticas AUTOMÁTICAS (tacticas.ts: la táctica elegida así, o todas con el piloto general). Un negocio que
  // bajó a Esencial con el piloto prendido queda en «propone» (resolverTacticas con `pilotoPermitido`). La fecha de fin se
  // lanza SIEMPRE (también en «propone» y en un «mirá la cuenta» por chat): es la regla que puso la persona, no algo que MaKo
  // recomienda.
  const automaticas = [
    ...nuevasFecha, ...fechaPendientes,
    ...(soloProponer ? [] : nuevasMotor.filter((d) => d.tactica !== 'manual' && d.tactica !== 'hasta' && tacticas[d.tactica].estado === 'automatica')),
  ];
  const enPiloto = automaticas.length > 0;
  const fallasFecha: string[] = [];
  if (enPiloto) {
    const orden = (d: Decision) => (d.tipo === 'pausar' ? 0 : d.tipo === 'bajar_presupuesto' ? 1 : d.tipo === 'activar' ? 2 : d.tipo === 'subir_presupuesto' ? 3 : 4);
    for (const d of [...automaticas].sort((a, b) => orden(a) - orden(b))) {
      const x = await lanzar(ws, d.id, { nombre: d.tactica === 'hasta' ? 'Tu fecha de fin' : 'Piloto automático', origen: 'piloto' }, { datos });
      if (x.ok) lanzadas++;
      else { fallidas.push(`${d.titulo}: ${x.error}`); if (d.tactica === 'hasta') fallasFecha.push(`${d.entidadNombre}: ${x.error}`); }
    }
  }
  // Una campaña que no se pudo pausar pasada su fecha sigue gastando: se avisa (una vez por corrida, o sea por día; el vigía la
  // reintenta cada dos horas sin avisar de nuevo).
  if (fallasFecha.length) {
    await crearNotificacion({
      ws, tipo: 'media_buyer', severidad: 'warn', origen: 'media-buyer', link: '/ads-manager',
      titulo: `No pude pausar ${fallasFecha.length === 1 ? 'una campaña que llegó' : `${fallasFecha.length} campañas que llegaron`} a su fecha de fin`,
      descripcion: fallasFecha.join(' · ').slice(0, 400),
    }).catch(() => null);
  }

  // Protect (el de AdAmigo): lo roto en la cuenta. Las graves van al aviso del negocio, aparte de las recomendaciones.
  const alertas = alertasProtect({
    arbol: datos.arbol, corta: datos.corta, larga: datos.larga, totalActivo: datos.totalActivo, presupuestoMaxDia: config.presupuestoMaxDia,
    fmt: fmtUnidad(datos),
  });
  const graves = alertas.filter((a) => a.gravedad === 'alta');
  if (graves.length) {
    await crearNotificacion({
      ws, tipo: 'media_buyer', severidad: 'warn', origen: 'media-buyer', link: '/ads-manager',
      titulo: `Protect: ${graves[0].titulo}`, descripcion: graves.map((a) => a.detalle).join(' · ').slice(0, 400),
    }).catch(() => null);
  }

  // El aviso: lo que propone un cron no dispara nada solo (docs/hallazgos-ads.md, «El Autopilot»: «una propuesta de
  // madrugada espera sin que nadie se entere»). Va al feed de avisos del negocio, el de la campanita y el Inbox del teléfono.
  const esperan = nuevas.length - (automaticas.length - fechaPendientes.length);
  if (lanzadas > 0 || esperan > 0) {
    await crearNotificacion({
      ws, tipo: 'media_buyer', severidad: fallidas.length ? 'warn' : 'info', origen: 'media-buyer', link: '/ads-manager',
      titulo: lanzadas > 0
        ? `MaKo hizo ${lanzadas} ${lanzadas === 1 ? 'cambio' : 'cambios'} en tus anuncios${esperan > 0 ? ` y tiene ${esperan} para ti` : ''}`
        : `MaKo tiene ${esperan} ${esperan === 1 ? 'recomendación' : 'recomendaciones'} para tus anuncios`,
      descripcion: nuevas.slice(0, 3).map((d) => d.titulo).join(' · ') || null,
    }).catch(() => null);
  }

  // Lo que había en la cuenta, del MISMO árbol con que se decidió (sin una lectura más): es lo único con que la pantalla de
  // Hoy puede no mentirle a una cuenta sin campañas. `configurado` es el interruptor que puso la persona, como en Campañas.
  const vivas = datos.arbol.filter((n) => n.nivel === 'campaign' && n.configurado !== 'DELETED');

  return {
    estado: 'ok', objetivo, objetivoEsRecomendado: config.objetivo == null,
    campanas: vivas.length, activas: vivas.filter((n) => n.configurado === 'ACTIVE').length,
    propuestas: todasProps.length + propios.propuestas.length, nuevas: nuevas.length, lanzadas, fallidas, sinVariaciones, fueraDelCupo,
    ...(fueraDeZona.length ? { fueraDeZona } : {}),
    ...(propios.avisos.length ? { agentes: propios.avisos } : {}),
    alertas,
    avisos: fueraDelCupo && cupo.recomendacionesDia != null ? [...avisos, textoCupo(cupo.recomendacionesDia)] : avisos,
    fuente: datos.fuente,
  };
}
