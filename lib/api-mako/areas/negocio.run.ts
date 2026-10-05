// =============================================================================
// api-mako/areas/negocio.run — los cuerpos del área `negocio`
// =============================================================================
// Un runner por id de negocio.def.ts. Lecturas: { leer }. Acciones: { preparar,
// ejecutar }. Las heredadas de MAKO_TOOLS se ENVUELVEN con runMakoTool (siete tests
// leen lib/mako-tools.ts por regex: los cuerpos no se mudan). Todo corre adentro de
// runWithWorkspace(ctx.ws): las libs que usan getSetting/getTenantDb scopean solas.
//
// ⚠️ NADA ESCRIBE EN leer() NI EN preparar(). La pantalla genérica /mako/revisar
// guarda el INPUT y al confirmar vuelve a llamar preparar(input): por eso cada
// preparar acepta exactamente los `parametros` declarados, revalida contra la base
// y NO lanza (un throw tiraría la pantalla de revisión): los «no existe» vuelven
// como { error }. ejecutar() tampoco lanza: todo error sale como { ok:false }.
//
// ⚠️ Las generaciones con IA (avatares, lead magnets, productos) corren al CONFIRMAR,
// nunca al proponer: proponer no gasta la cuota de IA del cliente.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Preparado, Runners, SalidaLectura } from '../tipos';
import { runMakoTool } from '@/lib/mako-tools';
import { contextoParaAgente, seccionContexto, type SeccionAgente } from '@/lib/agente-contexto';
import { getFile, urlDescarga, urlPreview } from '@/lib/archivero';
import { generarPreguntasCerradas, getSchema } from '@/lib/onboarding';
import { getDiagnosticoFase, setDiagnosticoFase } from '@/lib/fase-store';
import { faseDef, diagnosticar, PREGUNTAS, CANALES, type CanalId } from '@/lib/fase-diagnostico';
import { getEstadoOnboarding } from '@/lib/onboarding-state';
import { getAvatares, getContextoAvatares, siguientePreguntaAvatares } from '@/lib/avatares';
import { getEntregables, siguientePreguntaEntregable } from '@/lib/entregable';
import { getPersona, personaEstado } from '@/lib/persona';
import { getPersonalidad, setPersonalidad, personalizarPregunta } from '@/lib/personalidad-store';
import { PERSONALIDAD_PREGUNTAS, personalidadCompleta } from '@/lib/personalidad';
import { getRazones } from '@/lib/razones';
import { listProductos, deleteProducto } from '@/lib/productos';
import { cuantosEnEntrega } from '@/lib/entrega-servicio';
import { fraseEntregaAlBorrar } from '@/lib/servicio-etapas';
import { sugerirProductos } from '@/lib/productos-ia';
import { construirCerebro } from '@/lib/cerebro-grafo';
import { construirVault } from '@/lib/vault';
import { matchNodo, type CampoCerebro } from '@/lib/buscar-cerebro';
import { AREAS as AREAS_CEREBRO, type AreaId } from '@/lib/cerebro-modelo';
import {
  capaDelWs, camposPerfil, estadoArchivero, faltantesYConocido, campoOcupado, completarHuecoPerfil,
  borrarDocumentoArchivero, regenerarAvatares, editarAvatar, borrarAvatar, regenerarLeadMagnets, editarLeadMagnet,
  aplicarSugerenciasProductos, guardarDescripcionPersona, borrarFotoPersona, personalidadParaEscribir, glosarioPropio, tabsPorConfigurar,
  nodosDeDatos, faltaBrief, faltaBriefProductos, type PasoRespuesta, type PatchAvatar, type PatchLeadMagnet,
} from './negocio.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const json = (x: unknown): string => JSON.stringify(x);
const errorLectura = (msg: string): SalidaLectura => ({ content: msg, isError: true });
const str = (input: Record<string, unknown>, k: string): string => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** preparar() de la pantalla genérica no puede lanzar: se envuelve. */
const seguro = (fn: (input: Record<string, unknown>, ctx: Ctx) => Promise<Preparado>) =>
  async (input: Record<string, unknown>, ctx: Ctx): Promise<Preparado> => {
    try { return await fn(input, ctx); } catch (e) { return { error: `No pude revisar la propuesta contra la base (${msg(e)}).` }; }
  };

/** ejecutar() nunca lanza: si algo falla, ok:false con el motivo. */
const sinLanzar = (fn: (payload: Record<string, unknown>, ctx: Ctx) => Promise<Ejecutado>) =>
  async (payload: Record<string, unknown>, ctx: Ctx): Promise<Ejecutado> => {
    try { return await fn(payload, ctx); } catch (e) { return { ok: false, resumen: `No se pudo aplicar (${msg(e)}).` }; }
  };

const respuestasDe = (v: unknown): PasoRespuesta[] =>
  Array.isArray(v)
    ? v.map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { pregunta: String(o.pregunta ?? '').trim(), respuesta: String(o.respuesta ?? '').trim() }; })
      .filter((x) => x.pregunta && x.respuesta)
    : [];

/** Si la IA devolvió menos avatares que los que había, dice cuántos se fueron y cuántas razones quedaron sin avatar. */
const avisoQuitados = async (ids: string[]): Promise<string> => {
  if (!ids.length) return '';
  const huerfanas = (await getRazones().catch(() => null))?.filter((r) => ids.includes(r.avatarId ?? '')).length;
  const razones = huerfanas == null ? ' (no pude contar las razones de compra que quedaron sin avatar)' : `; ${huerfanas} razón${huerfanas === 1 ? '' : 'es'} de compra quedaron sin avatar`;
  return ` Se quitaron ${ids.length} avatar${ids.length === 1 ? '' : 'es'}${razones}.`;
};

const TOPE_RESULTADOS_CEREBRO = 30;
const TOPE_VAULT_CHARS = 60_000;
const recorte = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ── los runners ──────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas ────────────────────────────────────────────────────────────────
  contexto_negocio: {
    leer: async (input) => {
      const seccion = str(input, 'seccion') as SeccionAgente | '';
      // El pie del núcleo manda a pedir las secciones por `GET /api/agente/contexto?seccion=…`,
      // una URL que el modelo no tiene por WhatsApp ni en la app: se traduce a esta operación.
      if (!seccion) return (await contextoParaAgente()).replace(/`GET \/api\/agente\/contexto\?seccion=(\w+)`/g, 'contexto_negocio con seccion=«$1»');
      const md = await seccionContexto(seccion);
      // Una sección vacía NO es un error: es un negocio que todavía no cargó eso.
      return md || `_Todavía no hay nada cargado en «${seccion}»._\n`;
    },
  },

  ver_perfil_negocio: {
    leer: async (_input, ctx) => {
      const campos = await camposPerfil(ctx.ws);
      const huecos = campos.filter((c) => c.valor == null).length;
      return json({ campos, total: campos.length, huecos, nota: '`pregunta` es cómo se le pide el dato al dueño, no el dato. `valor: null` = nunca se cargó.' });
    },
  },

  ver_archivero: {
    leer: async () => {
      const est = await estadoArchivero();
      const nombres = new Map(est.brief.map((c) => [c.key, c.label]));
      return json({
        documentos: est.files.map((f) => ({ id: f.id, nombre: f.nombre, mime: f.mime, tamano_bytes: f.tamano, fecha: f.created_at, que_entendio: f.razonamiento, campos_aportados: f.aporto })),
        procedencia: Object.entries(est.fuente).map(([key, f]) => ({ key, origen: f.tipo === 'manual' ? 'editado a mano' : `documento «${f.nombre ?? f.id}»` })),
        huecos: est.gaps.map((key) => ({ key, pregunta: nombres.get(key) ?? key })),
        nota: 'Solo los campos de a qué se dedica, oferta y cliente salen de documentos. El texto de los documentos no se guarda.',
      });
    },
  },

  obtener_link_documento_archivero: {
    leer: async (input) => {
      const f = await getFile(str(input, 'id'));
      if (!f) return errorLectura('No existe un documento con ese id en este negocio. Pide la lista con ver_archivero.');
      // Una web pegada guarda la URL como storage_path: firmarla sobre el bucket da null.
      if (f.mime === 'text/html' && /^https?:\/\//i.test(f.storage_path)) {
        return json({ nombre: f.nombre, url: f.storage_path, vence_en_segundos: null, nota: 'Es una página web: el link es la dirección original y no vence.' });
      }
      const preview = input.preview === true;
      const url = preview ? await urlPreview(f.storage_path) : await urlDescarga(f.storage_path, f.nombre);
      if (!url) return errorLectura('No pude generar el link de ese documento. Puede verse desde /onboarding, en El Archivero.');
      return json({ nombre: f.nombre, url, vence_en_segundos: preview ? 300 : 120, modo: preview ? 'ver en línea' : 'descarga' });
    },
  },

  generar_preguntas_huecos_perfil: {
    leer: async () => {
      const { faltantes, conocido } = await faltantesYConocido();
      if (!faltantes.length) return json({ preguntas: [], nota: 'No hay huecos en el perfil de oferta y cliente.' });
      const preguntas = await generarPreguntasCerradas(faltantes, conocido);
      return json({ preguntas, nota: 'Una pregunta sin opciones es la de respaldo (la IA no pudo armarla cerrada): pregúntala abierta.' });
    },
  },

  ver_diagnostico_fase: {
    leer: async () => {
      const d = await getDiagnosticoFase();
      if (!d) return json({ diagnostico: null, nota: 'El negocio nunca hizo el diagnóstico de fase.' });
      const f = faseDef(d.fase);
      return json({
        fase: f.id, fase_nombre: f.nombre, rango: f.rango,
        cuello: f.cuelloLabel, canal: d.canal ? (CANALES.find((c) => c.id === d.canal)?.label ?? d.canal) : null,
        consistencia_pct: d.consistencia, mixto: d.mixto,
        votos_por_fase: d.reparto.map((n, i) => ({ fase: i + 1, votos: n })),
        objetivo: f.objetivo, hito: f.hito,
        prioridades_criticas: f.acciones.filter((a) => a.critica).map((a) => a.titulo),
        no_hacer_todavia: f.noHacer,
        nota: 'La fase va del 1 al 5 (el número que ve el cliente).',
      });
    },
  },

  listar_preguntas_diagnostico_fase: {
    leer: async () => json({
      preguntas: PREGUNTAS.map((p, i) => ({ orden: i + 1, id: p.id, texto: p.texto, opciones: p.opciones.map((o, idx) => ({ indice: idx, texto: o })) })),
      canales: CANALES.map((c) => ({ id: c.id, nombre: c.label, descripcion: c.desc })),
      nota: 'La pregunta de volumen usa el texto del canal «llamadas»; con otro canal se adapta, pero los índices valen igual.',
    }),
  },

  ver_estado_onboarding: {
    leer: async (_input, ctx) => {
      const [s, capa] = await Promise.all([getEstadoOnboarding(), capaDelWs(ctx.ws)]);
      const pasos = capa.onboarding.map((p) => ({ paso: p, hecho: !!s.steps[p]?.done, postergado: !!s.steps[p]?.postergado }));
      return json({
        estado: s.status, pasos,
        // Sin completedBy: es el email de quien lo cerró (dato del equipo) y esto sale por http.
        empezo: s.startedAt ?? null, termino: s.completedAt ?? null,
        nota: pasos.length ? 'Solo los pasos que le tocan a este plan.' : 'Este plan no tiene asistente de arranque.',
      });
    },
  },

  listar_tabs_por_configurar: {
    leer: async (_input, ctx) => {
      const config = await tabsPorConfigurar(await capaDelWs(ctx.ws));
      return json({ tabs: config, nota: config.length ? 'En el orden en que conviene configurarlas.' : 'No le falta configurar ninguna tab de su plan.' });
    },
  },

  listar_avatares_negocio: {
    leer: async () => {
      const [avatares, contexto] = await Promise.all([getAvatares(), getContextoAvatares()]);
      return json({ avatares, precisado_por_el_dueno: contexto.trim() || null, nota: avatares.length ? undefined : 'El negocio todavía no tiene avatares.' });
    },
  },

  siguiente_pregunta_avatares: {
    leer: async (input) => {
      const r = await siguientePreguntaAvatares(respuestasDe(input.historial));
      if (!r.ok) return errorLectura(r.error);
      return json(r.terminado ? { terminado: true } : { terminado: false, pregunta: r.pregunta });
    },
  },

  listar_lead_magnets: {
    leer: async () => {
      const lista = await getEntregables();
      return json({ lead_magnets: lista.map((e) => ({ ...e, enlace: e.enlace ?? null })), nota: lista.length ? undefined : 'El negocio todavía no tiene lead magnets.' });
    },
  },

  siguiente_pregunta_lead_magnet: {
    leer: async (input) => {
      const r = await siguientePreguntaEntregable(respuestasDe(input.historial));
      if (!r.ok) return errorLectura(r.error);
      return json(r.terminado ? { terminado: true } : { terminado: false, pregunta: r.pregunta });
    },
  },

  ver_cara_de_marca: {
    leer: async (input) => {
      if (input.conLinks === true) {
        const e = await personaEstado();
        return json({ descripcion: e.descripcion || null, fotos: e.fotos.map((f) => ({ id: f.id, nombre: f.nombre, url: f.url, vence_en_horas: 6 })) });
      }
      const p = await getPersona();
      return json({ descripcion: p.descripcion || null, fotos: p.fotos.map((f) => ({ id: f.id, nombre: f.nombre })), nota: 'La cara de los creativos; no afirmes que es el dueño.' });
    },
  },

  ver_personalidad_voz: {
    leer: async () => {
      const p = await getPersonalidad();
      const respuestas = PERSONALIDAD_PREGUNTAS.filter((q) => p.respuestas[q.key]).map((q) => ({ key: q.key, dimension: q.dimension, rasgo: p.respuestas[q.key].rasgo, frase: p.respuestas[q.key].texto || null }));
      return json({ respuestas, muletillas: p.muletillas || null, contestadas: respuestas.length, total: PERSONALIDAD_PREGUNTAS.length, completa: personalidadCompleta(p) });
    },
  },

  ver_pregunta_personalidad: {
    leer: async (input) => {
      const idx = Number(input.idx);
      const total = PERSONALIDAD_PREGUNTAS.length;
      if (!Number.isInteger(idx) || idx < 0 || idx >= total) return errorLectura(`El quiz tiene ${total} preguntas: idx va de 0 a ${total - 1}.`);
      const q = input.personalizar === true ? await personalizarPregunta(idx) : PERSONALIDAD_PREGUNTAS[idx];
      return json({ idx, total, pregunta: q, nota: 'Para guardar, copia el `rasgo` EXACTO de la opción elegida.' });
    },
  },

  buscar_en_segundo_cerebro: {
    leer: async (input) => {
      const cerebro = await construirCerebro();
      const area = str(input, 'area') as AreaId | '';
      const nodos = nodosDeDatos(cerebro.nodos).filter((n) => !area || n.area === area);
      const texto = str(input, 'texto');
      if (!texto) {
        const areas = AREAS_CEREBRO.filter((a) => !area || a.id === area).map((a) => {
          const deArea = nodos.filter((n) => n.area === a.id);
          return { id: a.id, nombre: a.nombre, que: a.que, datos: deArea.filter((n) => n.autoria !== 'pendiente').length, pendientes: deArea.filter((n) => n.autoria === 'pendiente').length };
        });
        return json({ negocio: cerebro.negocio, areas });
      }
      const campos = (Array.isArray(input.campos) && input.campos.length ? input.campos : ['nombre']) as CampoCerebro[];
      const hallados = nodos.filter((n) => matchNodo(n, texto, campos));
      const nombreArea = (id: string) => AREAS_CEREBRO.find((a) => a.id === id)?.nombre ?? id;
      return json({
        resultados: hallados.slice(0, TOPE_RESULTADOS_CEREBRO).map((n) => ({
          id: n.id, area: nombreArea(n.area), etiqueta: n.etiqueta, detalle: recorte(n.detalle, 600), fuente: n.fuente || null,
          quien: n.autoria === 'mako' ? 'lo dedujo MaKo' : n.autoria === 'usuario' ? 'lo escribió el dueño' : 'todavía no existe',
          datos: (n.datos ?? []).filter((d) => d.v?.trim()).map((d) => ({ [d.k]: recorte(d.v, 300) })),
        })),
        total: hallados.length,
        quedaron_afuera: Math.max(0, hallados.length - TOPE_RESULTADOS_CEREBRO),
        buscado_en: campos,
      });
    },
  },

  leer_segundo_cerebro_como_archivos: {
    leer: async (input) => {
      const pedidas = Array.isArray(input.areas) ? (input.areas as string[]) : [];
      const areas = (pedidas.length ? pedidas : AREAS_CEREBRO.map((a) => a.id)) as AreaId[];
      const archivos = construirVault(await construirCerebro(), areas);
      let md = '';
      const afuera: string[] = [];
      for (const a of archivos) {
        const bloque = `\n\n---\n## ${a.ruta}\n\n${a.texto}`;
        if (md.length + bloque.length > TOPE_VAULT_CHARS) { afuera.push(a.ruta); continue; }
        md += bloque;
      }
      const pie = afuera.length
        ? `\n\n---\n_Se cortó en ${TOPE_VAULT_CHARS} caracteres. Quedaron afuera ${afuera.length} de ${archivos.length} archivos: ${afuera.join(', ')}. Pídelos con menos áreas._\n`
        : '';
      return `# Segundo cerebro (${archivos.length} archivos)${md}${pie}`;
    },
  },

  ver_glosario_negocio: {
    leer: async () => {
      const g = await glosarioPropio();
      return json({ terminos: g.terminos, total: g.terminos.length, ...(g.recortado ? { nota: 'Se muestran los primeros 500 términos; hay más.' } : {}) });
    },
  },

  // Heredadas de MAKO_TOOLS → runMakoTool con el MISMO nombre (misma salida de siempre).
  buscar_conocimiento: { leer: (input) => runMakoTool('buscar_conocimiento', input) },
  buscar_tutorial: { leer: (input) => runMakoTool('buscar_tutorial', input) },

  // ── Acción por chat ─────────────────────────────────────────────────────────
  responder_pregunta_personalidad: {
    preparar: seguro(async (input) => {
      const key = str(input, 'key');
      const q = PERSONALIDAD_PREGUNTAS.find((p) => p.key === key);
      if (!q) return { error: `No existe la pregunta «${key}».`, disponibles: PERSONALIDAD_PREGUNTAS.map((p) => p.key) };
      const rasgo = str(input, 'rasgo');
      // normalizarPersonalidad descarta EN SILENCIO un rasgo que no sea idéntico: se valida aquí.
      if (!q.opciones.some((o) => o.rasgo === rasgo)) return { error: 'Ese rasgo no es uno de los de esta pregunta: cópialo tal cual de la opción elegida.', disponibles: q.opciones.map((o) => o.rasgo) };
      const texto = str(input, 'texto').slice(0, 300);
      return { payload: { key, rasgo, texto }, resumen: `Guardar en el quiz de voz («${q.dimension}»): ${rasgo}${texto ? ` — «${texto}»` : ''}` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const key = String(payload.key ?? '');
      const actual = await personalidadParaEscribir();
      const nueva = await setPersonalidad({ ...actual, respuestas: { ...actual.respuestas, [key]: { rasgo: String(payload.rasgo ?? ''), texto: String(payload.texto ?? '') } } });
      if (!nueva.respuestas[key]) return { ok: false, resumen: 'El rasgo no coincide con el catálogo actual del quiz; no se guardó.' };
      const contestadas = Object.keys(nueva.respuestas).length;
      return { ok: true, resumen: `Respuesta guardada (${contestadas} de ${PERSONALIDAD_PREGUNTAS.length} contestadas).`, datos: { contestadas, completa: personalidadCompleta(nueva) } };
    }),
  },

  // ── Acciones por pantalla (genérica /mako/revisar) ─────────────────────────
  guardar_campo_perfil: {
    preparar: seguro(async (input, ctx) => {
      const key = str(input, 'key');
      const valor = str(input, 'valor');
      const campos = await camposPerfil(ctx.ws);
      const campo = campos.find((c) => c.key === key);
      if (!campo) return { error: `«${key}» no es un campo del perfil de este negocio.`, disponibles: campos.map((c) => c.key) };
      if (!valor) return { error: 'Falta el valor.', faltan: ['valor'] };
      if (await campoOcupado(key)) return { error: `«${campo.pregunta}» ya tiene valor. Corregir un dato cargado se hace en /onboarding, no por aquí.` };
      return { payload: { key, valor }, resumen: `Completar en el perfil «${campo.pregunta}»: ${valor.slice(0, 200)}` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      // La key se revalida contra el esquema: la pantalla guardó el input y pudo pasar tiempo.
      const key = String(payload.key ?? '');
      const esquema = (await getSchema()).flatMap((g) => g.fields.map((f) => f.key));
      if (!esquema.includes(key)) return { ok: false, resumen: 'Ese campo ya no existe en el perfil.' };
      const r = await completarHuecoPerfil(key, String(payload.valor ?? ''));
      return r.ok ? { ok: true, resumen: 'Campo del perfil completado.' } : { ok: false, resumen: `No se guardó: ${r.motivo}.` };
    }),
  },

  borrar_documento_archivero: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const f = await getFile(id);
      if (!f) return { error: 'No existe un documento con ese id en este negocio. Pide la lista con ver_archivero.' };
      const aporta = Object.keys(f.campos ?? {}).length;
      return { payload: { id }, resumen: `Borrar del Archivero «${f.nombre}» (aportó ${aporta} campo${aporta === 1 ? '' : 's'} del perfil). No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const r = await borrarDocumentoArchivero(String(payload.id ?? ''));
      if (!r.ok) return { ok: false, resumen: `No se borró: ${r.motivo}.` };
      return { ok: true, resumen: `Documento borrado y perfil recalculado${r.panoramaVaciado ? '; era el último, así que el resumen del negocio quedó vacío' : ''}.` };
    }),
  },

  guardar_diagnostico_fase: {
    preparar: seguro(async (input) => {
      const crudas = Array.isArray(input.respuestas) ? (input.respuestas as string[]) : [];
      if (crudas.length !== PREGUNTAS.length) return { error: `Hacen falta exactamente ${PREGUNTAS.length} respuestas, una por pregunta y en orden (llegaron ${crudas.length}).`, faltan: ['respuestas'] };
      const respuestas = crudas.map((x) => Number(x));
      const canalPedido = str(input, 'canal');
      const canal = (canalPedido || (await getDiagnosticoFase())?.canal || '') as CanalId | '';
      if (canal && !CANALES.some((c) => c.id === canal)) return { error: `Canal desconocido: ${canal}.`, disponibles: CANALES.map((c) => c.id) };
      const f = faseDef(diagnosticar(respuestas).fase);
      return {
        payload: { respuestas, canal: canal || null },
        resumen: `Guardar el diagnóstico de fase: queda en Fase ${f.id} (${f.nombre}), cuello «${f.cuelloLabel}»${canal ? `, canal ${canal}` : ', sin canal'}.`,
      };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const respuestas = Array.isArray(payload.respuestas) ? payload.respuestas.map(Number) : [];
      if (respuestas.length !== PREGUNTAS.length || respuestas.some((n) => !Number.isInteger(n) || n < 0 || n > 4)) return { ok: false, resumen: 'Las respuestas no son válidas.' };
      const canal = typeof payload.canal === 'string' && CANALES.some((c) => c.id === payload.canal) ? (payload.canal as CanalId) : undefined;
      const d = await setDiagnosticoFase(respuestas, canal);
      const f = faseDef(d.fase);
      return { ok: true, resumen: `Diagnóstico guardado: Fase ${f.id} (${f.nombre}).`, datos: { fase: f.id, consistencia_pct: d.consistencia, mixto: d.mixto } };
    }),
  },

  generar_avatares: {
    preparar: seguro(async () => {
      const falta = await faltaBrief();
      if (falta) return { error: falta, faltan: ['perfil'] };
      const n = (await getAvatares()).length;
      return { payload: {}, resumen: n ? `Regenerar con MaKo los avatares del negocio: reemplaza los ${n} actuales (ids conservados por posición).` : 'Generar con MaKo los avatares del negocio.' };
    }),
    ejecutar: sinLanzar(async () => {
      const r = await regenerarAvatares();
      return r.ok ? { ok: true, resumen: `Avatares regenerados: ${r.nombres.join(', ')}.${await avisoQuitados(r.idsQuitados)}` } : { ok: false, resumen: r.error };
    }),
  },

  afinar_avatares: {
    preparar: seguro(async (input) => {
      const respuestas = respuestasDe(input.respuestas);
      if (!respuestas.length) return { error: 'Faltan las respuestas (pregunta y respuesta).', faltan: ['respuestas'] };
      const falta = await faltaBrief();
      if (falta) return { error: falta, faltan: ['perfil'] };
      return { payload: { respuestas }, resumen: `Sumar ${respuestas.length} respuesta${respuestas.length === 1 ? '' : 's'} sobre a quién le vende y regenerar los avatares.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const respuestas = respuestasDe(payload.respuestas);
      if (!respuestas.length) return { ok: false, resumen: 'No llegaron respuestas.' };
      const r = await regenerarAvatares(respuestas);
      return r.ok ? { ok: true, resumen: `Avatares afinados: ${r.nombres.join(', ')}.${await avisoQuitados(r.idsQuitados)}` } : { ok: false, resumen: `${r.error} Las respuestas no quedaron guardadas.` };
    }),
  },

  editar_avatar_negocio: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const patch: PatchAvatar = {};
      for (const k of ['nombre', 'segmento', 'senalesMeta', 'situacion', 'dolor'] as const) { const v = str(input, k); if (v) patch[k] = v; }
      if (!Object.keys(patch).length) return { error: 'No viene ningún dato para cambiar.', faltan: ['nombre', 'segmento', 'senalesMeta', 'situacion', 'dolor'] };
      if (id) {
        const av = (await getAvatares()).find((a) => a.id === id);
        if (!av) return { error: 'No existe un avatar con ese id.', disponibles: (await getAvatares()).map((a) => ({ id: a.id, nombre: a.nombre })) };
        return { payload: { id, ...patch }, resumen: `Editar el avatar «${av.nombre}»: ${Object.keys(patch).join(', ')}.` };
      }
      if (!patch.nombre) return { error: 'Para agregar un avatar hace falta el nombre.', faltan: ['nombre'] };
      return { payload: { ...patch }, resumen: `Agregar el avatar «${patch.nombre}».` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const patch: PatchAvatar = {};
      for (const k of ['nombre', 'segmento', 'senalesMeta', 'situacion', 'dolor'] as const) if (typeof payload[k] === 'string' && payload[k]) patch[k] = payload[k] as string;
      const r = await editarAvatar(typeof payload.id === 'string' && payload.id ? payload.id : null, patch);
      return r.ok ? { ok: true, resumen: payload.id ? 'Avatar actualizado.' : 'Avatar agregado.', datos: { id: r.id } } : { ok: false, resumen: `No se guardó: ${r.motivo}.` };
    }),
  },

  borrar_avatar_negocio: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const [avatares, razones] = await Promise.all([getAvatares(), getRazones()]);
      const av = avatares.find((a) => a.id === id);
      if (!av) return { error: 'No existe un avatar con ese id.', disponibles: avatares.map((a) => ({ id: a.id, nombre: a.nombre })) };
      const huerfanas = razones.filter((r) => r.avatarId === id).length;
      return { payload: { id }, resumen: `Borrar el avatar «${av.nombre}». ${huerfanas} razón${huerfanas === 1 ? '' : 'es'} de compra quedan sin avatar. No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const r = await borrarAvatar(String(payload.id ?? ''));
      return r.ok ? { ok: true, resumen: 'Avatar borrado.' } : { ok: false, resumen: `No se borró: ${r.motivo}.` };
    }),
  },

  generar_lead_magnets: {
    preparar: seguro(async (input) => {
      const respuestas = respuestasDe(input.respuestas);
      const falta = await faltaBrief();
      if (falta) return { error: falta, faltan: ['perfil'] };
      const actuales = await getEntregables();
      const conEnlace = actuales.filter((e) => e.enlace).length;
      return {
        payload: { respuestas },
        resumen: `Generar lead magnets con MaKo${respuestas.length ? ` usando ${respuestas.length} respuesta${respuestas.length === 1 ? '' : 's'}` : ''}: reemplaza ${actuales.length - conEnlace} y conserva ${conEnlace} con enlace.`,
      };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const r = await regenerarLeadMagnets(respuestasDe(payload.respuestas));
      return r.ok ? { ok: true, resumen: `Lead magnets generados: ${r.nuevos} nuevos, ${r.conservados} con enlace conservados.` } : { ok: false, resumen: r.error };
    }),
  },

  editar_lead_magnet: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const patch: PatchLeadMagnet = {};
      for (const k of ['nombre', 'tipo', 'queEs', 'fomo', 'enlace'] as const) { const v = str(input, k); if (v) patch[k] = v; }
      if (!Object.keys(patch).length) return { error: 'No viene ningún dato para cambiar.', faltan: ['nombre', 'tipo', 'queEs', 'fomo', 'enlace'] };
      if (patch.enlace && !/^https?:\/\//i.test(patch.enlace)) return { error: 'El enlace tiene que empezar con http:// o https://.' };
      const lista = await getEntregables();
      const lm = lista.find((e) => e.id === id);
      if (!lm) return { error: 'No existe un lead magnet con ese id.', disponibles: lista.map((e) => ({ id: e.id, nombre: e.nombre })) };
      return { payload: { id, ...patch }, resumen: `Editar el lead magnet «${lm.nombre}»: ${Object.keys(patch).join(', ')}.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const patch: PatchLeadMagnet = {};
      for (const k of ['nombre', 'tipo', 'queEs', 'fomo', 'enlace'] as const) if (typeof payload[k] === 'string' && payload[k]) patch[k] = payload[k] as string;
      if (patch.enlace && !/^https?:\/\//i.test(patch.enlace)) return { ok: false, resumen: 'El enlace tiene que empezar con http:// o https://.' };
      const r = await editarLeadMagnet(String(payload.id ?? ''), patch);
      return r.ok ? { ok: true, resumen: 'Lead magnet actualizado.' } : { ok: false, resumen: `No se guardó: ${r.motivo}.` };
    }),
  },

  sugerir_productos: {
    preparar: seguro(async () => {
      const falta = await faltaBriefProductos();
      if (falta) return { error: falta, faltan: ['perfil'] };
      const n = (await listProductos()).length;
      return { payload: {}, resumen: `Armar el catálogo con MaKo: crea los productos nuevos INACTIVOS (su precio lo propone MaKo y hay que revisarlo en /crm antes de activarlos) y completa los campos vacíos de los ${n} existentes, sin pisar nada.` };
    }),
    ejecutar: sinLanzar(async () => {
      const r = await sugerirProductos();
      if (!r.ok) return { ok: false, resumen: r.error };
      const a = await aplicarSugerenciasProductos(r.productos);
      return { ok: true, resumen: `Catálogo armado: ${a.creados} productos nuevos y ${a.completados} completados. Los nuevos quedan inactivos hasta que revises su precio en /crm y los actives.`, datos: a };
    }),
  },

  borrar_producto: {
    preparar: seguro(async (input) => {
      const id = Number(input.id);
      const prods = await listProductos();
      const p = prods.find((x) => x.id === id);
      if (!p) return { error: 'No existe un producto con ese id en este negocio. Pide la lista con listar_productos.' };
      // ⚠️ LA CONSECUENCIA ENTERA, Y ANTES DEL CLICK. Desde la migración 0188, borrar un
      // producto se lleva por cascada su tablero de entrega y la etapa en la que está
      // CADA cliente: el resumen decía la verdad y le faltaba la mitad más cara, que es
      // justo lo que esta pantalla existe para que alguien vea antes de confirmar.
      // (El historial de cada movimiento sobrevive: `lead_audit` no tiene FK al producto.)
      const cola = fraseEntregaAlBorrar(await cuantosEnEntrega(id));
      return { payload: { id }, resumen: `Borrar el producto «${p.nombre}»${p.monto_usd != null ? ` (USD ${p.monto_usd})` : ''}. No se puede deshacer.${cola}` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const id = Number(payload.id);
      if (!(await listProductos()).some((x) => x.id === id)) return { ok: false, resumen: 'El producto ya no existe.' };
      await deleteProducto(id);
      return { ok: true, resumen: 'Producto borrado.' };
    }),
  },

  guardar_descripcion_cara_de_marca: {
    preparar: seguro(async (input) => {
      const descripcion = str(input, 'descripcion');
      if (!descripcion) return { error: 'Falta la descripción.', faltan: ['descripcion'] };
      const actual = (await getPersona()).descripcion;
      return { payload: { descripcion }, resumen: `Reemplazar la descripción física de la cara de marca${actual ? ' (la anterior se pierde)' : ''}: «${descripcion.slice(0, 160)}${descripcion.length > 160 ? '…' : ''}»` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      await guardarDescripcionPersona(String(payload.descripcion ?? ''));
      return { ok: true, resumen: 'Descripción de la cara de marca guardada.' };
    }),
  },

  borrar_foto_cara_de_marca: {
    preparar: seguro(async (input) => {
      const id = str(input, 'id');
      const foto = (await getPersona()).fotos.find((f) => f.id === id);
      if (!foto) return { error: 'No existe una foto con ese id. Pide la lista con ver_cara_de_marca.' };
      return { payload: { id }, resumen: `Borrar la foto «${foto.nombre}» de la cara de marca. No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      if (!(await borrarFotoPersona(String(payload.id ?? '')))) return { ok: false, resumen: 'La foto ya no existe.' };
      return { ok: true, resumen: 'Foto borrada. La descripción física no se recalculó.' };
    }),
  },

  guardar_muletillas_marca: {
    preparar: seguro(async (input) => {
      const muletillas = str(input, 'muletillas').slice(0, 500);
      if (!muletillas) return { error: 'Faltan las muletillas.', faltan: ['muletillas'] };
      const antes = (await getPersonalidad()).muletillas.trim();
      return { payload: { muletillas }, resumen: `Guardar las muletillas de la marca: «${muletillas.slice(0, 200)}»${antes ? ` (reemplaza: «${antes.slice(0, 200)}»)` : ''}` };
    }),
    ejecutar: sinLanzar(async (payload) => {
      const actual = await personalidadParaEscribir();
      await setPersonalidad({ ...actual, muletillas: String(payload.muletillas ?? '') });
      return { ok: true, resumen: 'Muletillas guardadas.' };
    }),
  },

  reiniciar_personalidad: {
    preparar: seguro(async () => {
      const p = await getPersonalidad();
      const n = Object.keys(p.respuestas).length;
      return { payload: {}, resumen: `Reiniciar el quiz de voz: se borran ${n} respuesta${n === 1 ? '' : 's'}${p.muletillas ? ' y las muletillas' : ''}. No se puede deshacer.` };
    }),
    ejecutar: sinLanzar(async () => {
      await setPersonalidad({ respuestas: {}, muletillas: '' });
      return { ok: true, resumen: 'Quiz de voz reiniciado.' };
    }),
  },
};
