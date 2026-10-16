// =============================================================================
// api-mako/areas/video.run — los cuerpos del área `video`
// =============================================================================
// Un runner por id de video.def.ts. En v1 son TODAS lecturas ({ leer }). Todo
// corre adentro de runWithWorkspace(ctx.ws): getSetting y getTenantDb resuelven ese
// workspace, así que los lectores *-datos.ts de app/video-generator (server-only y
// sin sesión) sirven tal cual. Las server actions de esa carpeta NO: su ctxAdmin()
// lee la cookie y fuera de un navegador contestan «solo el administrador».
//
// ⚠️ Nada de acá llama a estadoTomaAction / estadoImagenAction: parecen lecturas y
// cada llamada encola consultas a Google, baja clips y mide el costo por clip.
//
// ⚠️ El historial (video-generator.historial) guarda prompts, data URIs de fotos
// subidas y urls firmadas que vencen. Ningún runner devuelve el item crudo. Se lee
// con leerHistorialEstricto: un fallo de la base NO es «no hay anuncios».
//
// ⚠️ Las marcas «generando» del historial solo avanzan cuando la PANTALLA consulta.
// Por eso cada una se cruza con su trabajo real en flow_trabajos (el cron
// flow-abandono lo cierra sin tocar el historial).
// =============================================================================

import 'server-only';
import type { Runners } from '../tipos';
import type { PlanGuardado } from '@/app/video-generator/video-datos';
import { guionesDisponibles } from '@/app/video-generator/guiones-datos';
import { formatosOfrecidos, puestaDe } from '@/app/video-generator/formatos-datos';
import { leerSaldoGuardado, costoPorClip, alcanzaParaAnuncio } from '@/app/video-generator/saldo-datos';
import { escenariosReusables } from '@/app/video-generator/escenario-reuso';
import { getVozCliente } from '@/app/video-generator/voz-cliente';
import { getRazones } from '@/lib/razones';
import { EXTENSION_VERSION } from '@/lib/extension-version';
import { CATALOGO_ESCENARIOS, escenarioPorId, escenariosParaCamara } from '@/lib/escenarios-data';
import type { Camara } from '@/lib/puestas-data';
import { CREDITOS_POR_DURACION, creditosDeClip } from '@/lib/costo-clip';
import { plantillasParaApi } from '@/lib/editor-video/plantillas';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { causaDeMotivo, causaFlow, textoFlow, type CausaFlow } from '@/lib/flow-fallo-texto';
import { getEstadoTab, onboardingTabPendiente, tabOnboardingDef } from '@/lib/tab-onboarding-state';
import {
  HistorialIlegible, codigosDelDetalle, compararVersion, contextoVideoSinFirmar, estadoDeImagen, estadoDeToma,
  leerDiagnosticoFlow, leerHistorialEstricto, leerMontaje, leerPuenteEstricto, leerTrabajosFlow, leerTrabajosPorId,
  puenteAnda, urlEsPropia, type FilaTrabajoFlow,
} from './video.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const json = (o: unknown): string => JSON.stringify(o);
const error = (content: string) => ({ content, isError: true as const });
const TAB = 'video-generator';

const CAUSAS: readonly CausaFlow[] = [
  'nuestra', 'sesion', 'sin_creditos', 'ritmo', 'puente', 'google', 'contenido', 'persona_publica', 'ciego', 'sin_enlace', 'desconocida',
];
const causaValida = (c: string | undefined): CausaFlow | null => (c && (CAUSAS as readonly string[]).includes(c) ? (c as CausaFlow) : null);

const ERROR_HISTORIAL = 'No pude leer el historial de anuncios de /video-generator (falló la consulta a la base). No significa que no haya anuncios: intenta de nuevo en un rato.';

/** El historial, o null si la base no contestó (≠ lista vacía). */
async function historialOnull(): Promise<PlanGuardado[] | null> {
  try {
    return await leerHistorialEstricto();
  } catch (e) {
    if (e instanceof HistorialIlegible) return null;
    throw e;
  }
}

/** El anuncio por id, o el error legible con qué hay. */
async function anuncioDe(planId: string | null): Promise<{ item: PlanGuardado; historial: PlanGuardado[] } | { error: string }> {
  if (!planId) return { error: 'Falta planId: pídelo con listar_anuncios_video.' };
  const historial = await historialOnull();
  if (!historial) return { error: ERROR_HISTORIAL };
  const item = historial.find((e) => e.id === planId);
  if (!item) {
    return { error: `No hay un anuncio con planId «${planId}» en este negocio. El historial guarda los últimos 10 (hoy hay ${historial.length}); un anuncio viejo puede haberse caído del tope. Pide la lista con listar_anuncios_video.` };
  }
  return { item, historial };
}

const resumenPedido = (p: string): string => {
  const t = (p || '').trim().replace(/\s+/g, ' ');
  return t.length > 120 ? `${t.slice(0, 120)}…` : t;
};

// ── Lo que está «generando», contra la cola real ─────────────────────────────

type Trabajos = Map<number, FilaTrabajoFlow> | null;

/** Los trabajoId que hay que confirmar: tomas generando sin operación e imágenes generando. */
function idsEnVuelo(items: PlanGuardado[]): number[] {
  const ids: number[] = [];
  for (const it of items) {
    for (const c of it.plan.clips) {
      const v = it.video?.[String(c.n)];
      if (estadoDeToma(it, c.n) === 'generando' && !v?.operacion && v?.trabajoId) ids.push(v.trabajoId);
    }
    for (const e of it.escenas ?? []) {
      const m = it.imagenes?.[String(e.n)];
      if (estadoDeImagen(m) === 'generando' && m?.trabajoId) ids.push(m.trabajoId);
    }
  }
  return ids;
}

/** Los trabajos, o null si la consulta falló (se dice «sin_verificar», no se inventa). */
async function trabajosDe(items: PlanGuardado[]): Promise<Trabajos> {
  try {
    return await leerTrabajosPorId(idsEnVuelo(items));
  } catch {
    return null;
  }
}

type Vuelo = { trabajo_estado: string | null; muerto: boolean; extra: Record<string, unknown> };

/**
 * Qué dice la cola de una marca «generando». `operacion` = Google ya aceptó el pedido
 * y el trabajo de encolar terminó: cómo va el clip no lo confirma ningún trabajo.
 */
function vueloDe(trabajoId: number | undefined, operacion: string | undefined, trabajos: Trabajos, que: string, ahora: Date): Vuelo {
  if (operacion) {
    return { trabajo_estado: null, muerto: false, extra: { nota_vuelo: 'Google aceptó el pedido; ningún trabajo de la cola confirma cómo va: lo averigua /video-generator cuando alguien abre la tab.' } };
  }
  if (!trabajoId) return { trabajo_estado: null, muerto: false, extra: { nota_vuelo: 'No hay trabajo que confirme que se está generando.' } };
  if (!trabajos) return { trabajo_estado: 'sin_verificar', muerto: false, extra: { nota_vuelo: 'No se pudo consultar la cola de Flow para confirmarlo.' } };
  const t = trabajos.get(trabajoId);
  if (!t) return { trabajo_estado: 'no_encontrado', muerto: true, extra: { nota_vuelo: `El trabajo ${trabajoId} no está en la cola: nada lo está generando.` } };
  if (t.estado === 'fallido') {
    const causa = causaDeMotivo(t.motivo) ?? causaFlow(t.error);
    const txt = textoFlow(causa, que, undefined, ahora);
    return {
      trabajo_estado: 'fallido', muerto: true,
      extra: { causa, que_paso: txt.titulo, detalle: txt.detalle, nota_vuelo: 'El trabajo ya se cerró como fallido: no se está generando. Al abrir /video-generator figura con error.' },
    };
  }
  if (t.estado === 'listo') {
    return { trabajo_estado: 'listo', muerto: false, extra: { nota_vuelo: 'Google ya contestó el pedido; /video-generator lo registra cuando alguien abre la tab.' } };
  }
  return { trabajo_estado: t.estado || null, muerto: false, extra: { trabajo_creado: t.created_at } };
}

const NOTA_GENERANDO = '«generando» es lo último que registró /video-generator; avanza cuando alguien abre la tab. trabajo_estado es el estado real en la cola de Flow (fallido o no_encontrado = no se está generando).';

// ── lecturas ─────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  ver_puente_flow: {
    leer: async () => {
      const [p, diag] = await Promise.all([leerPuenteEstricto(), leerDiagnosticoFlow()]);
      const ahora = Date.now();
      const { anda, vivo, pausadaPorGoogle } = puenteAnda(p, ahora);
      const version = p.version || null;
      const cmp = version ? compararVersion(version, EXTENSION_VERSION) : null;
      return json({
        emparejado: p.emparejado,
        puede_trabajar: anda,
        vivo_ahora: vivo,
        ultimo_latido: p.ultimoVisto,
        estado_guardado: p.estado,
        sesion_pausada_por_google: pausadaPorGoogle,
        navegador: p.etiqueta || null,
        version_extension: version,
        version_vigente: EXTENSION_VERSION,
        extension_vieja: version ? (cmp == null ? version !== EXTENSION_VERSION : cmp < 0) : null,
        ...(cmp === 1 ? { extension_mas_nueva: true } : {}),
        codigos_diagnostico: p.estado === 'listo' ? [] : codigosDelDetalle(p.detalle),
        operaciones: diag
          ? {
            reportado_el: diag.cuando ? new Date(diag.cuando).toISOString() : null,
            sabe: diag.ops,
            faltan: diag.faltan,
            pestana_en_proyecto: diag.enProyecto,
            dominio: diag.dominio || null,
            pestana_desactualizada: !!(diag.espejo && diag.manifest && diag.espejo !== diag.manifest),
          }
          : null,
        notas: [
          'estado_guardado lo escribe el último latido y se queda en «listo» aunque la extensión esté cerrada o desinstalada: lo que vale es puede_trabajar (listo Y vivo en los últimos 2 minutos).',
          'Aun vivo, sin una pestaña de Google Flow abierta nadie toma los trabajos.',
          ...(version ? [] : ['version_extension null = el navegador no informó su versión (o nunca se conectó).']),
          ...(cmp === 1 ? ['La extensión es MÁS NUEVA que la vigente (una versión de desarrollo): no es vieja.'] : []),
          ...(pausadaPorGoogle ? ['Google pausó la sesión de Flow: MaKo frenó las generaciones y no se levanta sola. La persona la rehabilita desde /video-generator después de hacer lo que pide el aviso.'] : []),
          ...(diag ? [] : ['operaciones null = el navegador todavía no mandó su diagnóstico; no significa que no sepa nada.']),
          ...(diag && diag.espejo && diag.manifest && diag.espejo !== diag.manifest ? [`La pestaña de Flow corre una versión vieja del espejo (${diag.espejo}) con la extensión en ${diag.manifest}: hace falta recargarla (F5).`] : []),
        ],
      });
    },
  },

  listar_trabajos_flow: {
    leer: async (input) => {
      const limite = Math.min(50, Math.max(1, Math.trunc(num(input, 'limite') ?? 10)));
      const filas = await leerTrabajosFlow({ estado: str(input, 'estado'), tipo: str(input, 'tipo'), limite });
      const ahora = new Date();
      return json({
        filtro: { estado: str(input, 'estado'), tipo: str(input, 'tipo') },
        limite,
        devueltos: filas.length,
        ...(filas.length === limite ? { aviso: `Se devolvieron ${limite}, el tope pedido: puede haber más trabajos anteriores.` } : {}),
        trabajos: filas.map((t) => {
          const fallo = t.estado === 'fallido' || (!!t.motivo && t.estado === 'pendiente' && t.intentos > 0);
          const causa = fallo ? (causaDeMotivo(t.motivo) ?? causaFlow(t.error)) : null;
          const txt = causa ? textoFlow(causa, 'este pedido', undefined, ahora) : null;
          return {
            id: t.id, tipo: t.tipo, estado: t.estado, intentos: t.intentos,
            creado: t.created_at, tomado: t.tomado_at, terminado: t.listo_at,
            ...(t.tipo === 'generar_clip' || t.tipo === 'enlace_clip' ? { clip_guardado_en_storage: t.medio_guardado } : {}),
            ...(causa ? { motivo: t.motivo || null, causa, que_paso: txt!.titulo, detalle: txt!.detalle } : {}),
          };
        }),
        nota: 'Un pendiente con intentos > 0 es un reintento en espera. Lo que gasta créditos (generar_imagen, generar_clip) solo se reintenta si el pedido nunca llegó a Google.',
      });
    },
  },

  listar_anuncios_video: {
    leer: async () => {
      const historial = await historialOnull();
      if (!historial) return error(ERROR_HISTORIAL);
      if (!historial.length) return json({ total: 0, anuncios: [], nota: 'Todavía no hay anuncios armados en /video-generator.' });
      const ahora = new Date();
      const trabajos = await trabajosDe(historial);
      const anuncios = await Promise.all(historial.map(async (h) => {
        let filmadas = 0; let generando = 0; let caidas = 0; let conError = 0; let sinTexto = 0;
        for (const c of h.plan.clips) {
          const e = estadoDeToma(h, c.n);
          if (e === 'filmada') filmadas++;
          else if (e === 'con_error') conError++;
          else if (e === 'sin_texto') sinTexto++;
          else if (e === 'sin_poder_leer') generando++;
          else if (e === 'generando') {
            const v = h.video?.[String(c.n)];
            if (vueloDe(v?.trabajoId, v?.operacion, trabajos, `la toma ${c.n}`, ahora).muerto) caidas++;
            else generando++;
          }
        }
        const escenas = h.escenas ?? [];
        const puesta = await puestaDe(h.plan.puestaId);
        return {
          planId: h.id,
          titulo: h.plan.titulo || null,
          pedido: resumenPedido(h.pedido),
          guionId: h.guionId ?? null,
          formato: { id: h.plan.puestaId, nombre: puesta?.nombre ?? null },
          creado: h.at,
          duracion_total_seg: h.plan.duracionTotalSeg,
          tomas_total: h.plan.clips.length,
          tomas_filmadas: filmadas,
          tomas_generando: generando,
          tomas_con_trabajo_caido: caidas,
          tomas_con_error: conError,
          tomas_sin_texto: sinTexto,
          escenas_total: h.escenas ? escenas.length : null,
          escenas_confirmadas: h.escenas ? escenas.filter((e) => h.imagenes?.[String(e.n)]?.confirmada).length : null,
        };
      }));
      return json({
        total: anuncios.length,
        anuncios,
        notas: [
          'El historial guarda hasta 10 anuncios; al pasarse se caen primero los que no tienen ningún clip filmado.',
          'escenas_total null = el anuncio todavía no llegó al paso de escenarios (no es lo mismo que cero).',
          'tomas_con_trabajo_caido = la pantalla las dejó «generando» pero su trabajo en la cola ya murió: no se están filmando.',
          ...(trabajos ? [] : ['No se pudo consultar la cola de Flow: tomas_generando cuenta lo que registró la pantalla sin confirmarlo.']),
          'Que todas las tomas estén filmadas no significa que el anuncio esté montado: eso lo dice ver_montaje_anuncio.',
        ],
      });
    },
  },

  ver_anuncio_video: {
    leer: async (input) => {
      const r = await anuncioDe(str(input, 'planId'));
      if ('error' in r) return error(r.error);
      const { item } = r;
      const ahora = new Date();
      const [puesta, trabajos] = await Promise.all([puestaDe(item.plan.puestaId), trabajosDe([item])]);
      const lugar = escenarioPorId(item.escenarioId);
      const voseante = item.plan.acentoEsVoseante === true;
      let hayVoseo = false; let hayGenerando = false; let hayUrlQueVence = false;

      const tomas = item.plan.clips.map((c) => {
        const v = item.video?.[String(c.n)];
        const estado = estadoDeToma(item, c.n);
        const mostrarVoseo = !!c.voseo?.length && !voseante;
        if (mostrarVoseo) hayVoseo = true;
        const base = {
          n: c.n, segundos: c.segundos, habla_en_camara: c.habla, texto: c.voz,
          palabras: c.palabras, tope_palabras: c.tope, se_pasa_del_tope: c.palabras > c.tope,
          ...(mostrarVoseo ? { marcas_de_voseo: c.voseo } : {}),
          estado,
          ...(v?.descartadas?.length ? { clips_descartados: v.descartadas.length } : {}),
        };
        if (estado === 'filmada') {
          const propia = urlEsPropia(v!.url!);
          if (!propia) hayUrlQueVence = true;
          return { ...base, url: v!.url, ...(propia ? { url_permanente: true } : { url_vence: true }) };
        }
        if (estado === 'con_error') {
          const causa = causaValida(v?.errorCausa) ?? causaFlow(v?.error ?? '');
          const t = textoFlow(causa, `la toma ${c.n}`, v?.errorAt, ahora, v?.errorDetalle ?? '');
          return { ...base, causa, que_paso: t.titulo, detalle: t.detalle, fallos_seguidos: v?.fallosSeguidos ?? null };
        }
        if (estado === 'sin_poder_leer') return { ...base, desde: v?.ciego?.desde ?? null, nota: 'Google aceptó el pedido y MaKo no puede leer cómo va. No es un error: volver a filmar cobraría otro clip.' };
        if (estado === 'generando') {
          hayGenerando = true;
          const vu = vueloDe(v?.trabajoId, v?.operacion, trabajos, `la toma ${c.n}`, ahora);
          return { ...base, trabajo_estado: vu.trabajo_estado, ...vu.extra };
        }
        return base;
      });

      const escenas = item.escenas
        ? item.escenas.map((e) => {
          const m = item.imagenes?.[String(e.n)];
          const estado = estadoDeImagen(m);
          const causa = estado === 'con_error' ? (causaValida(m?.errorCausa) ?? causaFlow(m?.error ?? '')) : null;
          const t = causa ? textoFlow(causa, `la imagen del escenario ${e.n}`, m?.errorAt, ahora, m?.errorDetalle ?? '') : null;
          let vuelo: Record<string, unknown> = {};
          if (estado === 'generando') {
            hayGenerando = true;
            const vu = vueloDe(m?.trabajoId, undefined, trabajos, `la imagen del escenario ${e.n}`, ahora);
            vuelo = { trabajo_estado: vu.trabajo_estado, ...vu.extra };
          }
          return {
            n: e.n, tomas_desde: e.desde, tomas_hasta: e.hasta, lugar: e.lugar,
            imagen: {
              estado,
              variantes: m?.opciones?.length ?? 0,
              ...(m?.propia ? { subida_por_la_persona: true } : {}),
              ...(m?.reusadaDe ? { reusada_de_anuncio: m.reusadaDe } : {}),
              ...(t ? { causa, que_paso: t.titulo, detalle: t.detalle } : {}),
              ...vuelo,
            },
          };
        })
        : null;

      return json({
        planId: item.id,
        titulo: item.plan.titulo || null,
        pedido: resumenPedido(item.pedido),
        guionId: item.guionId ?? null,
        formato: { id: item.plan.puestaId, nombre: puesta?.nombre ?? null },
        creado: item.at,
        duracion_total_seg: item.plan.duracionTotalSeg,
        acento_es_voseante: item.plan.acentoEsVoseante ?? null,
        lugar_elegido: item.escenarioId ? { id: item.escenarioId, nombre: lugar?.nombre ?? null } : null,
        foto_elegida: item.fotoId ? true : false,
        tomas,
        escenas,
        notas: [
          'escenas null = todavía no se escribieron los escenarios (no es una lista vacía).',
          'Una imagen generada NO está confirmada hasta que una persona la aprueba mirándola en /video-generator; sin confirmar, las tomas de ese escenario no se pueden filmar.',
          ...(hayGenerando ? [NOTA_GENERANDO] : []),
          ...(hayUrlQueVence ? ['url_vence = enlace de Google, vence en horas y puede no abrir; abrir /video-generator lo baja al storage de MaKo. url_permanente = archivo de MaKo, no vence.'] : []),
          ...(hayVoseo ? ['marcas_de_voseo = formas rioplatenses (el voseo) en un anuncio cuyo acento no es rioplatense o no consta (acento_es_voseante false o null): revisar ese texto.'] : []),
          ...(voseante ? ['acento_es_voseante true = el cliente habla rioplatense: el voseo es su idioma y no se marca como error.'] : []),
          'Filmar, regenerar o montar se hace en /video-generator: gasta créditos del cliente.',
          ...(item.escenarioId ? [] : ['lugar_elegido null = el lugar lo decidió MaKo leyendo el guion.']),
        ],
      });
    },
  },

  ver_montaje_anuncio: {
    leer: async (input) => {
      const planId = str(input, 'planId');
      if (!planId) return error('Falta planId: pídelo con listar_anuncios_video.');
      // El montaje primero: un anuncio montado que se cayó del tope del historial
      // tiene su fila y su .mp4 igual.
      const m = await leerMontaje(planId);
      const historial = await historialOnull();
      const item = historial?.find((e) => e.id === planId) ?? null;
      if (!item && m.fase === 'sin_empezar') {
        if (!historial) return error(ERROR_HISTORIAL);
        return error(`No hay un anuncio con planId «${planId}» en este negocio (ni en el historial, que guarda los últimos 10, ni con montaje). Pide la lista con listar_anuncios_video.`);
      }
      const tomas = item ? item.plan.clips.map((c) => estadoDeToma(item, c.n)) : null;
      const filmadas = tomas ? tomas.filter((e) => e === 'filmada').length : null;
      const notas = [
        ...(!item && historial ? ['El plan ya no está en el historial (guarda los últimos 10): tomas_filmadas y tomas_total salen null, no cero.'] : []),
        ...(!item && !historial ? ['No se pudo leer el historial: tomas_filmadas y tomas_total salen null, no cero.'] : []),
        ...(m.fase === 'sin_empezar' && tomas && filmadas! < tomas.length ? ['El montaje necesita TODAS las tomas filmadas.'] : []),
        ...(m.fase === 'listo' ? ['segundos_antes_estimados es una estimación (cantidad de clips × duración supuesta por clip), no una medición; segundos_despues sí sale del archivo montado.'] : []),
        ...(m.fase === 'encolado' && m.reintento ? [`Ya falló al menos una vez (${m.motivo_ultimo_fallo}) y volvió a la cola para reintentarse.`] : []),
        ...(m.fase === 'encolado' && m.esperando_min >= 10 ? [`Lleva ${m.esperando_min} minutos esperando: puede que el worker de montaje no esté atendiendo la cola.`] : []),
      ];
      return json({
        planId,
        tomas_filmadas: filmadas,
        tomas_total: tomas ? tomas.length : null,
        montaje: m,
        ...(notas.length ? { notas } : {}),
      });
    },
  },

  contar_escenarios_reusables: {
    leer: async (input) => {
      const r = await anuncioDe(str(input, 'planId'));
      if ('error' in r) return error(r.error);
      if (!r.item.escenas) return json({ planId: r.item.id, reusables: 0, escenas_total: null, nota: 'El anuncio todavía no tiene escenarios escritos: no hay nada que reusar.' });
      const lista = escenariosReusables(r.item, r.historial);
      return json({
        planId: r.item.id,
        reusables: lista.length,
        escenas_total: r.item.escenas.length,
        detalle: lista.map((x) => ({ escena: x.escena, lugar: x.lugar, de_anuncio: x.deAnuncio })),
        nota: 'Solo cuenta escenarios sin imagen elegida, del mismo formato y lugar, con imagen confirmada en otro anuncio (del historial de 10). Reusarlos se hace en /video-generator.',
      });
    },
  },

  listar_guiones_para_video: {
    leer: async (input) => {
      const limite = Math.min(100, Math.max(1, Math.trunc(num(input, 'limite') ?? 30)));
      const [todos, razones, historial] = await Promise.all([guionesDisponibles(), getRazones(), historialOnull()]);
      // celdaId por guion: leer_guion_anuncio lo exige y GuionDisponible no lo trae.
      const celdaDe = new Map<string, string>();
      for (const celda of razones ?? []) {
        for (const g of celda.guiones ?? []) if (g?.id && !celdaDe.has(String(g.id))) celdaDe.set(String(g.id), celda.id);
      }
      const guiones = todos.slice(0, limite).map((g) => ({
        id: g.id, celdaId: celdaDe.get(g.id) ?? null,
        primera_linea: g.primeraLinea, angulo: g.angulo || null, estructura: g.estructura || null,
        estado: g.estado, palabras_habladas: g.palabras,
        creado: g.creadoEn ? new Date(g.creadoEn).toISOString() : null,
        tiene_anuncio: g.conPlan, planId: g.planId ?? null,
        grabado_en_formatos: g.grabadoEn, ya_usado: g.yaUsado,
      }));
      return json({
        total: todos.length,
        devueltos: guiones.length,
        ...(todos.length > guiones.length ? { fuera: todos.length - guiones.length } : {}),
        guiones,
        notas: [
          'El texto completo de un guion se lee con leer_guion_anuncio, pasando celdaId + guionId (el id de esta lista).',
          'tiene_anuncio mira solo el historial de esta tab (últimos 10 anuncios). ya_usado = se grabó o se publicó según el guion.',
          ...(historial ? [] : ['No se pudo leer el historial de anuncios: tiene_anuncio y planId pueden salir false/null sin serlo.']),
        ],
      });
    },
  },

  listar_formatos_video: {
    leer: async () => {
      const formatos = await formatosOfrecidos();
      return json({
        total: formatos.length,
        formatos: formatos.map((p) => ({
          id: p.id, nombre: p.nombre, del_cliente: p.id.startsWith('ws'),
          descripcion: p.descripcion, cuando_conviene: p.cuando,
          camara: p.camara, habla_en_camara: p.habla, personas: p.personas,
          clips: { min: p.clips[0], max: p.clips[1] },
          segundos_por_clip: { min: p.segundosClip[0], max: p.segundosClip[1] },
          palabras_por_segundo: p.densidad,
          escenarios: p.escenarios,
        })),
      });
    },
  },

  listar_lugares_grabacion: {
    leer: async (input) => {
      const camara = str(input, 'camara') as Camara | null;
      const lista = camara ? escenariosParaCamara(camara) : CATALOGO_ESCENARIOS;
      const cayoATodos = !!camara && lista.length === CATALOGO_ESCENARIOS.length && CATALOGO_ESCENARIOS.some((e) => e.camaras.length && !e.camaras.includes(camara));
      return json({
        camara: camara ?? null,
        total: lista.length,
        lugares: lista.map((e) => ({ id: e.id, nombre: e.nombre, descripcion: e.descripcion, cuando_conviene: e.cuando, fondos_distintos: e.fondos.length })),
        ...(cayoATodos ? { nota: 'Ningún lugar declara esa cámara: se listan todos.' } : {}),
      });
    },
  },

  // El catálogo del Video Editor (lo arma lib/editor-video/plantillas.ts, puro), con las sugeridas para ESTE
  // negocio primero, como en la pestaña Plantillas (lib/plantillas-sugeridas.ts).
  listar_plantillas_video: {
    leer: async () => json(plantillasParaApi(await senalesDelNegocio().catch(() => null))),
  },

  ver_contexto_video: {
    leer: async () => {
      const c = await contextoVideoSinFirmar();
      const origen = c.acento.origen;
      return json({
        fotos_cara: c.cantidadFotos,
        tiene_descripcion_persona: c.tieneDescripcion,
        acento: {
          id: c.acento.id, nombre: c.acento.etiqueta, origen,
          ...(origen === 'zona-horaria' ? { zona_horaria: c.acento.zona } : {}),
          muletillas: c.acento.muletillas,
        },
        perfil_negocio_empezado: c.perfilIlegible ? null : c.perfilEmpezado,
        faltan_del_perfil: c.perfilIlegible ? null : c.faltanDelPerfil,
        notas: [
          ...(c.cantidadFotos === 0 ? ['Sin fotos de la cara cada clip inventa una persona: se cargan en el onboarding de /video-generator.'] : []),
          ...(origen !== 'declarado' ? [`El acento NO lo declaró el cliente (origen «${origen}»): no lo presentes como elegido.`] : []),
          'perfil_negocio_empezado true = al menos UN grupo del perfil del negocio tiene algo cargado; no significa que esté completo (lo que falta está en faltan_del_perfil).',
          ...(c.perfilIlegible ? ['No se pudo leer el perfil del negocio: perfil_negocio_empezado y faltan_del_perfil salen null (no se sabe).'] : []),
        ],
      });
    },
  },

  ver_voz_cliente: {
    leer: async () => {
      const v = await getVozCliente();
      const origen = v.acento ? (v.acentoOrigen === 'elegido' ? 'elegido' : v.acentoOrigen === 'sugerido-zona' ? 'sugerido_por_zona' : 'desconocido') : null;
      return json({
        acento_guardado: v.acento || null,
        acento_origen: origen,
        muletillas: v.muletillas,
        muestras_de_audio: v.muestras.length,
        voz_clonada: v.clon ? { nombre: v.clon.nombre || null, creada: v.clon.creadoAt || null } : null,
        notas: [
          ...(v.acento ? [] : ['acento_guardado null = no hay acento guardado y se sigue infiriendo; ver_contexto_video dice cuál se va a usar.']),
          ...(origen === 'desconocido' ? ['acento_origen «desconocido» = se guardó antes de registrar de dónde salía: no se puede afirmar que lo eligió el cliente.'] : []),
          'voz_clonada no se verificó contra ElevenLabs en esta lectura.',
        ],
      });
    },
  },

  estado_onboarding_video: {
    leer: async () => {
      const def = tabOnboardingDef(TAB);
      if (!def) return error('El Video Generator no tiene onboarding declarado.');
      const estado = await getEstadoTab(TAB);
      const requisito = def.requiere ?? null;
      const requisitoPendiente = requisito ? await onboardingTabPendiente(requisito) : false;
      const pasos = def.pasos.map((p) => ({ key: p.key, paso: p.label, hecho: !!estado.steps[p.key]?.done, opcional: !!p.opcional, hecho_el: estado.steps[p.key]?.at ?? null }));
      return json({
        lista: estado.status === 'done' && !requisitoPendiente,
        onboarding_propio_hecho: estado.status === 'done',
        pasos,
        faltan: pasos.filter((p) => !p.hecho && !p.opcional).map((p) => p.paso),
        ...(requisito ? { requiere_tab: requisito, requisito_pendiente: requisitoPendiente } : {}),
        notas: [
          'El último paso lo cierra aprobar la imagen de un escenario real en /video-generator; no se marca a mano.',
          ...(requisitoPendiente ? [`Con ${requisito} pendiente la tab no abre. Un cliente que cerró esos pasos en el onboarding general puede figurar pendiente hasta que abra ${requisito} por primera vez.`] : []),
        ],
      });
    },
  },

  ver_saldo_flow: {
    leer: async () => {
      const [saldo, costo] = await Promise.all([leerSaldoGuardado(), costoPorClip()]);
      return json({
        creditos: saldo.creditos,
        leido_el: saldo.at,
        plan_cuenta_google: saldo.tier || null,
        costo_clip_creditos: costo.creditos,
        costo_clip_medido: costo.medido,
        creditos_por_duracion_seg: CREDITOS_POR_DURACION,
        notas: [
          ...(saldo.creditos == null ? ['creditos null = el saldo nunca se leyó (no es cero).'] : [`Es la última lectura guardada (${saldo.at ?? 'sin fecha'}): el saldo real puede ser otro.`]),
          ...(costo.medido ? [] : ['costo_clip_creditos es una ESTIMACIÓN: todavía no se midió con una generación real. Dilo como estimado.']),
          'Refrescar el saldo se hace desde /video-generator.',
        ],
      });
    },
  },

  calcular_alcance_anuncio: {
    leer: async (input) => {
      const planId = str(input, 'planId');
      const clipsIn = num(input, 'clips');
      if (!planId && clipsIn == null) return error('Pasa `clips` (cuántos clips se van a filmar) o `planId` (de listar_anuncios_video).');

      if (planId) {
        const r = await anuncioDe(planId);
        if ('error' in r) return error(r.error);
        const { item } = r;
        const ahora = new Date();
        const trabajos = await trabajosDe([item]);
        const faltan: typeof item.plan.clips = [];
        let enVuelo = 0; let sinTexto = 0; let caidas = 0;
        for (const c of item.plan.clips) {
          const e = estadoDeToma(item, c.n);
          if (e === 'sin_filmar' || e === 'con_error') faltan.push(c);
          else if (e === 'sin_texto') sinTexto++;
          else if (e === 'sin_poder_leer') enVuelo++;
          else if (e === 'generando') {
            const v = item.video?.[String(c.n)];
            if (vueloDe(v?.trabajoId, v?.operacion, trabajos, `la toma ${c.n}`, ahora).muerto) { faltan.push(c); caidas++; } else enVuelo++;
          }
        }
        const escenariosSinConfirmar = item.escenas
          ? item.escenas
            .map((e) => ({ n: e.n, estado: estadoDeImagen(item.imagenes?.[String(e.n)]) }))
            .filter((x) => x.estado !== 'confirmada')
          : null;
        const notasEscenarios = [
          ...(escenariosSinConfirmar === null ? ['escenarios_sin_imagen_confirmada null = todavía no se escribieron los escenarios: generar sus imágenes también gasta créditos y NO está sumado.'] : []),
          ...(escenariosSinConfirmar?.some((x) => x.estado !== 'generada_sin_confirmar') ? ['Generar las imágenes de escenario que faltan (sin_generar, con_error) también gasta créditos y NO está sumado en este costo; las generada_sin_confirmar solo necesitan que una persona las apruebe.'] : []),
        ];
        const comunes = {
          planId,
          tomas_en_vuelo: enVuelo,
          tomas_sin_texto: sinTexto,
          escenarios_sin_imagen_confirmada: escenariosSinConfirmar,
        };
        const notaAmbos = clipsIn != null ? ['Llegaron planId y clips: se usó planId y se ignoró clips.'] : [];
        if (!faltan.length) {
          return json({ ...comunes, tomas_por_filmar: 0, notas: [...notaAmbos, 'No quedan tomas con texto por filmar en este anuncio.', ...(sinTexto ? ['Las tomas sin_texto no se pueden filmar hasta que tengan texto: no se cuentan.'] : []), ...notasEscenarios] });
        }
        const a = await alcanzaParaAnuncio(faltan.length);
        const porDuracion = faltan.map((c) => creditosDeClip(c.segundos));
        const sinTabla = porDuracion.filter((x) => x == null).length;
        const totalPorDuracion = porDuracion.reduce<number>((s, x) => s + (x ?? 0), 0);
        return json({
          ...comunes,
          tomas_por_filmar: faltan.length,
          ...(caidas ? { tomas_con_trabajo_caido: caidas } : {}),
          costo_total_creditos: a.costoTotal,
          costo_clip_medido: a.medido,
          costo_por_duracion_creditos: sinTabla ? null : totalPorDuracion,
          creditos_guardados: a.creditos,
          alcanza: a.alcanza,
          alcanza_por_duracion: a.creditos == null || sinTabla ? null : a.creditos >= totalPorDuracion,
          notas: [
            ...notaAmbos,
            'costo_total_creditos usa un costo único por clip; costo_por_duracion_creditos suma la tabla por duración de cada toma y es el más exacto.',
            'Las tomas en vuelo ya se pagaron y no se cuentan. Las que tienen error sí: volver a filmarlas cuesta.',
            ...(caidas ? ['tomas_con_trabajo_caido figuraban «generando» pero su trabajo en la cola ya murió: se cuentan como por filmar.'] : []),
            ...(sinTexto ? ['Las tomas sin_texto no se pueden filmar hasta que tengan texto: no se cuentan.'] : []),
            ...notasEscenarios,
            ...(notasEscenarios.length ? ['alcanza mira solo las tomas: con imágenes de escenario por generar puede no alcanzar aunque diga true.'] : []),
            ...(a.alcanza == null ? ['alcanza null = el saldo nunca se leyó (no es que no alcance).'] : []),
            ...(sinTabla ? [`${sinTabla} toma(s) tienen una duración que Flow no genera: no se puede sumar por duración.`] : []),
          ],
        });
      }

      const a = await alcanzaParaAnuncio(Math.trunc(clipsIn!));
      return json({
        clips: a.clips,
        costo_total_creditos: a.costoTotal,
        costo_clip_medido: a.medido,
        creditos_guardados: a.creditos,
        alcanza: a.alcanza,
        anuncios_asi_que_entran: a.anuncios,
        notas: [
          ...(a.medido ? [] : ['El costo por clip es una estimación, no una medición.']),
          ...(a.alcanza == null ? ['alcanza null = el saldo nunca se leyó (no es que no alcance).'] : []),
          'Solo cuenta clips: las imágenes de escenario que haya que generar también gastan créditos y no están sumadas.',
        ],
      });
    },
  },
};
