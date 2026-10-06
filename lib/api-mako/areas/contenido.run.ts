// =============================================================================
// api-mako/areas/contenido.run — los cuerpos del área `contenido`
// =============================================================================
// Un runner por id de contenido.def.ts. Lecturas: { leer }. Acciones: { preparar,
// ejecutar }. Todo corre adentro de runWithWorkspace(ctx.ws).
//
// ⚠️ SETTINGS CAE AL DUEÑO SIN WORKSPACE. getRazones/setRazones, las recomendaciones
// de formatos y el onboarding leen y ESCRIBEN app_settings con
// `getWorkspaceActual() ?? OWNER_WS`: fuera de runWithWorkspace tocarían el negocio de
// Mauricio sin ningún error. El choke point (ejecutar.ts) envuelve y lo comprueba;
// no llamar nada de esto desde otro lado sin ese wrap.
//
// ⚠️ LOS ANUNCIOS SON UN JSON, NO FILAS. Toda la matriz (celdas + guiones) vive en UNA
// clave; cada escritura la reescribe entera. Por eso solo se usan las escrituras
// QUIRÚRGICAS de lib/razones.ts (setEstadoGuion, borrarGuionDeCelda, editarTextoGuion,
// generarGuion, elegirAngulo), que releen antes de escribir. setRazones con una
// copia vieja pisa lo que otra pestaña escribió: nunca desde aquí.
//
// ⚠️ EL GUION SE VUELVE A MIRAR AL CONFIRMAR. Entre proponer y confirmar pasan hasta
// 2 h (y la propuesta de pantalla no vence) y alguien pudo borrarlo, moverlo o editarlo
// desde la tab: ejecutar() relee. Editar y borrar exigen además la `huella` del texto:
// la pantalla genérica deja editar celdaId/guionId y vuelve a correr preparar() con lo
// editado, así que sin la huella se podía borrar un guion que la persona nunca vio.
//
// ⚠️ «NO PUDE LEER» NO ES «NO HAY». La matriz se lee con getRazonesEstricto (helpers):
// getRazones convierte un 5xx en [] y la tool afirmaba «no tienes anuncios».
//
// ⚠️ generarGuion y elegirAngulo (lib) releen la matriz DESPUÉS de la IA con getRazones:
// si esa segunda lectura falla, escriben [] y BORRAN la matriz entera. No se puede
// arreglar desde aquí (es lib/razones.ts y lib/angulos-formatos.ts); lo que sí se hace
// es verificar después de escribir y decir la verdad si el guion no quedó.
// =============================================================================

import 'server-only';
import type { Ejecutado, Preparado, Runners, SalidaLectura } from '../tipos';
import { siguientePasoOpciones, sugerirGuion, setEstadoGuion, borrarGuionDeCelda, editarTextoGuion, type RazonCelda } from '@/lib/razones';
import { ESTADOS_GUION, esEstadoGuion, estadoMasAvanzado, type EstadoGuion, type GuionItem } from '@/lib/guion-estado';
import { getAvatares, type Avatar } from '@/lib/avatares';
import { getAngulosGuion } from '@/lib/guion-angulos-store';
import { getEstructurasGuion } from '@/lib/guion-estructuras-store';
import { BIBLIOTECA_ANGULOS, formatoPorId, type FormatoAngulo } from '@/lib/angulos-data';
import { getRecomendaciones, setRecomendaciones, recomendarFormatos, elegirAngulo } from '@/lib/angulos-formatos';
import { separarGuiones } from '@/lib/guiones-separar';
import { huellaGuion } from '@/lib/guiones-normalizar';
import { cierreDeGuion, ctaInventado, fidelidad } from '@/lib/guion-cierre';
import { getEstadoTab, tabOnboardingDef } from '@/lib/tab-onboarding-state';
import { limitesDe, CAPTION_MAX, CAPTION_VISIBLE, LIMITES_IMAGEN, type FormatoIg } from '@/lib/ig-formatos';
import { estadoContextoReels } from '@/app/reels/reels-datos';
import { getSettingEstricto } from '@/lib/settings';
import { escribirGuionAuto, escribirGuionConDecisiones, bloquesDeGuion, tzSinResolver, diaEnTz, getRazonesEstricto, leerMatrizEstricta, grabadoComoDe, huellaTexto, conTope } from './contenido.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const str = (input: Record<string, unknown>, k: string): string => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const bool = (input: Record<string, unknown>, k: string, def: boolean): boolean => (typeof input[k] === 'boolean' ? (input[k] as boolean) : def);
const error = (content: string): SalidaLectura => ({ content, isError: true });
const json = (v: unknown): string => JSON.stringify(v);
const corta = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);
const palabras = (t: string): number => t.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
const fallo = (err: unknown): string => (err instanceof Error ? err.message : String(err));
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** La celda virtual donde caen los guiones que el cliente cargó (app/video-generator). */
const CELDA_PROPIOS = 'guiones-propios';

const formatoCorto = (id: string): { id: string; nombre: string } | null => {
  if (!id) return null;
  const f = formatoPorId(id);
  return f ? { id: f.id, nombre: f.nombre } : { id, nombre: '(formato que ya no está en la biblioteca)' };
};
const formatoLargo = (f: FormatoAngulo) => ({ id: f.id, medio: f.medio, nombre: f.nombre, descripcion: f.descripcion, ejemplo: f.ejemplo });

const siguienteEstado = (e: EstadoGuion): EstadoGuion | null => ESTADOS_GUION[ESTADOS_GUION.indexOf(e) + 1] ?? null;

const NO_PUDE_LEER = (err: unknown): string => `No pude leer los anuncios planteados del negocio (${fallo(err)}). No es que no haya: reintenta en un momento.`;

/** La matriz en estricto, o el error legible. */
async function matriz(): Promise<{ razones: RazonCelda[] } | { error: string }> {
  try { return { razones: await getRazonesEstricto() }; } catch (err) { return { error: NO_PUDE_LEER(err) }; }
}

/** El guion identificado por el par, o el error legible. Lee la base AHORA. */
async function guionEn(celdaId: string, guionId: string): Promise<{ celda: RazonCelda; guion: GuionItem } | { error: string }> {
  if (!celdaId || !guionId) return { error: 'Faltan celdaId y guionId (de listar_guiones_anuncio o ver_anuncio_planteado).' };
  const m = await matriz();
  if ('error' in m) return m;
  const celda = m.razones.find((r) => r.id === celdaId);
  if (!celda) return { error: `No hay ningún anuncio planteado con celdaId «${celdaId}» en este negocio. Pide listar_anuncios_planteados.` };
  const guion = celda.guiones.find((g) => g.id === guionId);
  if (!guion) return { error: `El anuncio «${celda.nombre}» no tiene un guion con guionId «${guionId}» (quizá ya se borró). Pide ver_anuncio_planteado.` };
  return { celda, guion };
}

async function celdaEn(celdaId: string): Promise<{ celda: RazonCelda } | { error: string }> {
  if (!celdaId) return { error: 'Falta celdaId (de listar_anuncios_planteados).' };
  const m = await matriz();
  if ('error' in m) return m;
  const celda = m.razones.find((r) => r.id === celdaId);
  if (!celda) return { error: `No hay ningún anuncio planteado con celdaId «${celdaId}» en este negocio. Pide listar_anuncios_planteados.` };
  return { celda };
}

/** Editar y borrar exigen la huella del texto que la persona vio al proponer. */
const huellaNoCoincide = (input: Record<string, unknown>, g: GuionItem): string | null => {
  const h = str(input, 'huella');
  if (!h) return 'Falta «huella»: pide leer_guion_anuncio (o listar_guiones_anuncio) y copia la huella del guion tal cual.';
  if (h !== huellaTexto(g.texto)) return 'El guion no coincide con el que se propuso: cambió su texto desde que se leyó, o celdaId/guionId apuntan a otro guion. No se aplicó nada: vuelve a leerlo y propón de nuevo.';
  return null;
};

/** Después de que la lib escribió un guion: ¿quedó guardado de verdad? */
async function verificarGuionNuevo(celdaId: string, guionId: string): Promise<string | null> {
  let razones: RazonCelda[];
  try { razones = await getRazonesEstricto(); } catch (err) {
    return `El guion se escribió, pero no pude volver a leer los anuncios para confirmar que quedó guardado (${fallo(err)}). Revisa con ver_anuncio_planteado antes de pedirlo otra vez.`;
  }
  if (!razones.length) return 'ATENCIÓN: después de escribir el guion, la lista de anuncios planteados quedó VACÍA. Es probable que una lectura fallida haya pisado todos los anuncios y sus guiones. Avisa a la persona y a soporte ahora: no escribas nada más.';
  const celda = razones.find((r) => r.id === celdaId);
  if (!celda) return 'El anuncio se borró mientras MaKo escribía: el guion no quedó guardado.';
  if (!celda.guiones.some((g) => g.id === guionId)) return 'El guion no quedó guardado en el anuncio (alguien lo cambió mientras MaKo escribía). Revisa con ver_anuncio_planteado.';
  return null;
}

const nombreAvatar = (celda: RazonCelda, av: Map<string, Avatar>): string =>
  celda.id === CELDA_PROPIOS ? '(guiones propios cargados por el negocio)' : av.get(celda.avatarId)?.nombre ?? '(avatar que ya no existe)';

/** Cómo se nombra un guion en un resumen: ángulo, estado y cómo empieza. */
const rotuloGuion = (celda: RazonCelda, g: GuionItem): string =>
  `el guion «${g.anguloNombre}» (${g.estado}) del anuncio «${celda.nombre}», que empieza «${corta(g.texto.replace(/\s+/g, ' '), 90)}»`;

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ── Lecturas: anuncios y guiones ───────────────────────────────────────────
  listar_anuncios_planteados: {
    leer: async (input) => {
      const [m, avatares] = await Promise.all([matriz(), getAvatares()]);
      if ('error' in m) return error(m.error);
      const razones = m.razones;
      const av = new Map(avatares.map((a) => [a.id, a]));
      const avatarId = str(input, 'avatarId');
      const lista = avatarId ? razones.filter((r) => r.avatarId === avatarId) : razones;
      if (!razones.length) return json({ total: 0, anuncios: [], nota: 'El negocio todavía no tiene anuncios planteados: se arman en la tab Ads Writer a partir de sus avatares.' });
      return json({
        total: lista.length,
        ...(avatarId ? { filtro_avatarId: avatarId, total_sin_filtro: razones.length } : {}),
        anuncios: lista.map((r) => ({
          celdaId: r.id,
          avatar: r.id === CELDA_PROPIOS ? null : { id: r.avatarId, nombre: nombreAvatar(r, av) },
          es_guiones_propios: r.id === CELDA_PROPIOS,
          motivacion: r.nombre,
          descripcion: corta(r.descripcion, 280),
          copy: corta(r.copy, 280),
          formato_imagen: formatoCorto(r.anguloImagen),
          formato_video: formatoCorto(r.anguloVideo),
          guiones_total: r.guiones.length,
          estado_mas_avanzado: estadoMasAvanzado(r.guiones.map((g) => g.estado)),
        })),
        nota: 'descripcion y copy recortados a 280 caracteres (el completo, en ver_anuncio_planteado). estado_mas_avanzado null = sin guiones. formato_* null = MaKo todavía no eligió.',
      });
    },
  },

  ver_anuncio_planteado: {
    leer: async (input) => {
      const celdaId = str(input, 'celdaId');
      if (!celdaId) return error('Falta celdaId (de listar_anuncios_planteados).');
      let mat: Awaited<ReturnType<typeof leerMatrizEstricta>>;
      try { mat = await leerMatrizEstricta(); } catch (err) { return error(NO_PUDE_LEER(err)); }
      const r = mat.razones.find((x) => x.id === celdaId);
      if (!r) return error(`No hay ningún anuncio planteado con celdaId «${celdaId}» en este negocio. Pide listar_anuncios_planteados.`);
      const [avatares, zona] = await Promise.all([r.id === CELDA_PROPIOS ? Promise.resolve([] as Avatar[]) : getAvatares(), tzSinResolver()]);
      const avatar = avatares.find((a) => a.id === r.avatarId);
      const fi = r.anguloImagen ? formatoPorId(r.anguloImagen) : undefined;
      const fv = r.anguloVideo ? formatoPorId(r.anguloVideo) : undefined;
      return json({
        celdaId: r.id,
        es_guiones_propios: r.id === CELDA_PROPIOS,
        avatar: avatar ? { id: avatar.id, nombre: avatar.nombre, segmento: avatar.segmento, situacion: avatar.situacion, dolor: avatar.dolor } : null,
        motivacion: r.nombre,
        descripcion: r.descripcion,
        copy: r.copy,
        formato_imagen: fi ? formatoLargo(fi) : null,
        formato_video: fv ? formatoLargo(fv) : null,
        guiones: r.guiones.map((g) => ({
          guionId: g.id, angulo: g.anguloNombre, anguloId: g.anguloId || null,
          estructura: g.estructuraNombre || null, estado: g.estado,
          grabado_como: grabadoComoDe(mat.grabadoComo, r.id, g.id),
          dia_creado: diaEnTz(g.creadoEn, zona.tz) || 'sin fecha', palabras: palabras(g.texto),
          huella: huellaTexto(g.texto),
          comienzo: corta(g.texto.replace(/\s+/g, ' '), 160),
        })),
        zona_horaria: zona.tz,
        nota: `guiones[].comienzo son los primeros 160 caracteres; el texto completo sale de leer_guion_anuncio. dia_creado = día de CREACIÓN del guion (YYYY-MM-DD, zona ${zona.tz}); «sin fecha» = guion anterior a que se registrara la fecha. estado es lo que la persona DECLARÓ; grabado_como son los formatos con los que se grabó de verdad en el Video Generator (null = no hay registro, no «no se grabó»). huella se copia tal cual para editar o borrar ese guion. avatar null en «guiones propios» o si el avatar se borró.`,
      });
    },
  },

  listar_guiones_anuncio: {
    leer: async (input) => {
      const estado = str(input, 'estado');
      const desde = str(input, 'desde');
      const hasta = str(input, 'hasta');
      const avatarId = str(input, 'avatarId');
      const anguloId = str(input, 'anguloId');
      const celdaId = str(input, 'celdaId');
      const limite = num(input, 'limite') ?? 50;
      if (desde && !FECHA_RE.test(desde)) return error('«desde» va en formato YYYY-MM-DD (por ejemplo 2026-09-01).');
      if (hasta && !FECHA_RE.test(hasta)) return error('«hasta» va en formato YYYY-MM-DD (por ejemplo 2026-09-15).');
      if (desde && hasta && desde > hasta) return error(`«desde» (${desde}) es posterior a «hasta» (${hasta}).`);

      const [m, avatares, zona] = await Promise.all([matriz(), getAvatares(), tzSinResolver()]);
      if ('error' in m) return error(m.error);
      const razones = m.razones;
      const av = new Map(avatares.map((a) => [a.id, a]));
      const todos = razones.flatMap((c) => c.guiones.map((g) => ({ c, g })));
      let sinFechaExcluidos = 0;
      const filtrados = todos.filter(({ c, g }) => {
        if (estado && g.estado !== estado) return false;
        if (avatarId && c.avatarId !== avatarId) return false;
        if (anguloId && g.anguloId !== anguloId) return false;
        if (celdaId && c.id !== celdaId) return false;
        if (desde || hasta) {
          const dia = diaEnTz(g.creadoEn, zona.tz);
          if (!dia) { sinFechaExcluidos++; return false; }
          if (desde && dia < desde) return false;
          if (hasta && dia > hasta) return false;
        }
        return true;
      });
      // Los más nuevos primero; los sin fecha (creadoEn 0) al final.
      filtrados.sort((a, b) => b.g.creadoEn - a.g.creadoEn);
      const pagina = filtrados.slice(0, limite);
      const porEstado = Object.fromEntries(ESTADOS_GUION.map((e) => [e, filtrados.filter(({ g }) => g.estado === e).length]));
      return json({
        total: filtrados.length, devueltos: pagina.length, quedaron_afuera: filtrados.length - pagina.length,
        por_estado: porEstado,
        ...(desde || hasta ? {
          ventana_de_creacion: { desde: desde || null, hasta: hasta || null, zona_horaria: zona.tz, zona_fijada_por_el_negocio: zona.fijada },
          sin_fecha_excluidos: sinFechaExcluidos,
        } : {}),
        guiones: pagina.map(({ c, g }) => ({
          celdaId: c.id, guionId: g.id,
          avatar: nombreAvatar(c, av), motivacion: c.nombre,
          angulo: g.anguloNombre, anguloId: g.anguloId || null, estructura: g.estructuraNombre || null,
          estado: g.estado, dia_creado: diaEnTz(g.creadoEn, zona.tz) || 'sin fecha',
          palabras: palabras(g.texto), huella: huellaTexto(g.texto), comienzo: corta(g.texto.replace(/\s+/g, ' '), 140),
        })),
        nota: 'comienzo = primeros 140 caracteres; el texto completo sale de leer_guion_anuncio con celdaId + guionId. desde/hasta y dia_creado son la fecha de CREACIÓN del guion, no la de cuándo cambió de estado (esa no se registra): «grabado entre tal y tal día» no se puede contestar con esto. «sin fecha» = guion anterior a que se registrara la fecha: nunca entra en un filtro por fechas.',
      });
    },
  },

  leer_guion_anuncio: {
    leer: async (input) => {
      const celdaId = str(input, 'celdaId');
      const guionId = str(input, 'guionId');
      if (!celdaId || !guionId) return error('Faltan celdaId y guionId (de listar_guiones_anuncio o ver_anuncio_planteado).');
      let mat: Awaited<ReturnType<typeof leerMatrizEstricta>>;
      try { mat = await leerMatrizEstricta(); } catch (err) { return error(NO_PUDE_LEER(err)); }
      const celda = mat.razones.find((x) => x.id === celdaId);
      if (!celda) return error(`No hay ningún anuncio planteado con celdaId «${celdaId}» en este negocio. Pide listar_anuncios_planteados.`);
      const guion = celda.guiones.find((g) => g.id === guionId);
      if (!guion) return error(`El anuncio «${celda.nombre}» no tiene un guion con guionId «${guionId}» (quizá ya se borró). Pide ver_anuncio_planteado.`);
      const [estructuras, zona] = await Promise.all([getEstructurasGuion(), tzSinResolver()]);
      const estructura = guion.estructuraId ? estructuras.find((e) => e.id === guion.estructuraId) : undefined;
      const bloques = bloquesDeGuion(guion.texto, estructura?.etiquetas ?? []);
      return json({
        celdaId: celda.id, guionId: guion.id, motivacion: celda.nombre,
        angulo: guion.anguloNombre, estructura: guion.estructuraNombre || null,
        estado: guion.estado, siguiente_estado: siguienteEstado(guion.estado),
        grabado_como: grabadoComoDe(mat.grabadoComo, celda.id, guion.id),
        dia_creado: diaEnTz(guion.creadoEn, zona.tz) || 'sin fecha', zona_horaria: zona.tz,
        palabras: palabras(guion.texto),
        huella: huellaTexto(guion.texto),
        bloques,
        cierre: cierreDeGuion(guion.texto) || null,
        texto: guion.texto,
        nota: `bloques parte el texto por los rótulos ${estructura ? `de la estructura «${estructura.nombre}» (${estructura.etiquetas.join(' / ')})` : 'en MAYÚSCULA que tenga (la estructura con la que se escribió ya no está en el catálogo o no se registró)'}. Un bloque «SIN RÓTULO» es texto antes del primer rótulo. siguiente_estado null = ya está publicado. estado es lo que la persona DECLARÓ (puede estar en «grabado» sin haberse grabado); grabado_como son los formatos con los que se grabó de verdad en el Video Generator (null = no hay registro, no «no se grabó»). huella: cópiala tal cual en editar_texto_guion_anuncio o borrar_guion_anuncio.`,
      });
    },
  },

  cobertura_guiones_anuncio: {
    leer: async () => {
      const m = await matriz();
      if ('error' in m) return error(m.error);
      const razones = m.razones;
      const planteados = razones.filter((r) => r.id !== CELDA_PROPIOS);
      const sinGuion = planteados.filter((r) => !r.guiones.length);
      const todos = razones.flatMap((r) => r.guiones);
      const propios = razones.find((r) => r.id === CELDA_PROPIOS)?.guiones.length ?? 0;
      return json({
        anuncios_planteados: planteados.length,
        con_guion: planteados.length - sinGuion.length,
        sin_guion: sinGuion.length,
        anuncios_sin_guion: sinGuion.slice(0, 30).map((r) => ({ celdaId: r.id, motivacion: r.nombre })),
        ...(sinGuion.length > 30 ? { anuncios_sin_guion_afuera: sinGuion.length - 30 } : {}),
        guiones_total: todos.length,
        guiones_por_estado: Object.fromEntries(ESTADOS_GUION.map((e) => [e, todos.filter((g) => g.estado === e).length])),
        guiones_propios_cargados: propios,
        nota: 'Los guiones propios (cargados por el negocio) cuentan en guiones_total y por estado, no como anuncio planteado.',
      });
    },
  },

  catalogo_angulos_guion: {
    leer: async (input) => {
      const soloActivos = bool(input, 'soloActivos', true);
      const angulos = (await getAngulosGuion()).filter((a) => !soloActivos || a.activo);
      return json({
        total: angulos.length,
        angulos: angulos.map((a) => ({ id: a.id, nombre: a.nombre, cuando: a.cuando, requisitos: a.requisitos || null, estructuras: a.estructuras, ...(soloActivos ? {} : { activo: a.activo }) })),
        nota: 'estructuras = ids compatibles (la primera es la sugerida; vacía = cualquiera). requisitos null = sin requisitos. Son ángulos para tráfico frío de Meta.',
      });
    },
  },

  catalogo_estructuras_guion: {
    leer: async (input) => {
      const soloActivas = bool(input, 'soloActivas', true);
      const estructuras = (await getEstructurasGuion()).filter((e) => !soloActivas || e.activo);
      return json({
        total: estructuras.length,
        estructuras: estructuras.map((e) => ({ id: e.id, nombre: e.nombre, cuando: e.cuando, rotulos: e.etiquetas, ...(soloActivas ? {} : { activa: e.activo }) })),
      });
    },
  },

  listar_formatos_creativo: {
    leer: async (input) => {
      const medio = str(input, 'medio');
      const recomendaciones = await getRecomendaciones();
      return json({
        biblioteca: BIBLIOTECA_ANGULOS.filter((f) => !medio || f.medio === medio).map(formatoLargo),
        recomendaciones: recomendaciones.map((r) => ({ formatoId: r.formatoId, formato: formatoPorId(r.formatoId)?.nombre ?? r.formatoId, medio: formatoPorId(r.formatoId)?.medio ?? null, para: r.para, porque: r.porque })),
        nota: recomendaciones.length ? 'recomendaciones = las que MaKo eligió para este negocio (no se filtran por medio).' : 'Sin recomendaciones guardadas: se generan con recomendar_formatos_creativo.',
      });
    },
  },

  opciones_siguiente_paso_guion: {
    leer: async () => {
      const opciones = await siguientePasoOpciones();
      return json({ default: opciones[0] ?? null, opciones, nota: 'La primera es el default del funnel del negocio. Para escribir_guion_anuncio se copia el texto EXACTO de una opción.' });
    },
  },

  sugerir_guion_anuncio: {
    leer: async (input) => {
      const celdaId = str(input, 'celdaId');
      const c = await celdaEn(celdaId);
      if ('error' in c) return error(c.error);
      const r = await sugerirGuion(celdaId, { anguloId: str(input, 'anguloId') || undefined, timeoutMs: 25000 });
      if (!r.ok) return error(r.error);
      const [angulos, estructuras] = await Promise.all([getAngulosGuion(), getEstructurasGuion()]);
      const s = r.sugerencia;
      return json({
        celdaId, motivacion: c.celda.nombre,
        anguloId: s.anguloId, angulo: angulos.find((a) => a.id === s.anguloId)?.nombre ?? s.anguloId,
        por_que: s.porQue,
        estructuraId: s.estructuraId || null, estructura: estructuras.find((e) => e.id === s.estructuraId)?.nombre ?? null,
        siguientePaso: s.siguientePaso || null,
        preguntas: s.preguntas,
        nota: 'No se guardó nada. siguientePaso null = MaKo no eligió uno de la lista y se usará el default del funnel. Para escribir: escribir_guion_anuncio con anguloId, estructuraId, siguientePaso y las respuestas elegidas en respuestasAngulo.',
      });
    },
  },

  separar_guiones_pegados: {
    leer: async (input) => {
      const texto = str(input, 'texto');
      const guiones = separarGuiones(texto);
      if (!guiones.length) return json({ encontrados: 0, guiones: [], nota: 'No se encontró ningún guion: el texto es muy corto (menos de 25 palabras por guion).' });
      const m = await matriz();
      if ('error' in m) return error(`No pude comparar contra los guiones guardados: ${m.error}`);
      const guardadas = new Set(m.razones.flatMap((c) => c.guiones).map((g) => huellaGuion(g.texto)));
      const lista = guiones.map((g, i) => ({
        indice: i, titulo: g.titulo || null, palabras: g.palabras,
        repetido_en_el_texto: g.duplicado, ya_guardado: guardadas.has(huellaGuion(g.texto)),
        comienzo: corta(g.texto.replace(/\s+/g, ' '), 160),
      }));
      return json({
        encontrados: lista.length,
        repetidos_en_el_texto: lista.filter((g) => g.repetido_en_el_texto).length,
        ya_guardados: lista.filter((g) => g.ya_guardado).length,
        guiones: lista,
        nota: 'No se guardó nada. comienzo = primeros 160 caracteres. La carga se hace desde la tab (Video Generator → cargar guiones).',
      });
    },
  },

  extraer_cierre_guion: {
    leer: async (input) => {
      const texto = str(input, 'texto');
      const adaptada = str(input, 'adaptada');
      const cierre = cierreDeGuion(texto);
      if (!adaptada) return json({ cierre: cierre || null });
      return json({
        cierre: cierre || null,
        cierre_adaptada: cierreDeGuion(adaptada) || null,
        cta_inventado: ctaInventado(texto, adaptada),
        fidelidad_0_a_1: Math.round(fidelidad(texto, adaptada) * 100) / 100,
        nota: 'cta_inventado = palabras de llamado a la acción que la versión nueva metió y el original no tenía (vacío = no inventó ningún mecanismo). fidelidad_0_a_1 = qué parte de las palabras con contenido del original sigue estando (1 = todo).',
      });
    },
  },

  // ── Lecturas: estado de las tabs y límites ─────────────────────────────────
  estado_contexto_contenido: {
    leer: async () => {
      // getSchema/getAnswers (lib/onboarding.ts) leen con getSetting, que nunca tira: un
      // 5xx llega como «schema default + respuestas vacías» y se leería «perfil vacío».
      // Se sondean las dos claves en estricto antes (deuda: las claves no están exportadas).
      try {
        await Promise.all([getSettingEstricto('mako.onboarding.schema'), getSettingEstricto('mako.onboarding.answers')]);
      } catch (err) {
        return error(`No pude leer el perfil del negocio (${fallo(err)}). No es que esté vacío: reintenta en un momento.`);
      }
      const e = await estadoContextoReels();
      return json({
        listo: e.listo,
        grupos_vacios: e.faltan,
        nota: e.listo
          ? 'listo = al menos un grupo del perfil tiene datos; grupos_vacios son los que todavía no tienen ninguno.'
          : 'El perfil del negocio está vacío: las piezas saldrían genéricas. grupos_vacios dice qué completar.',
      });
    },
  },

  estado_onboarding_contenido: {
    leer: async (input) => {
      const tab = str(input, 'tab');
      const def = tabOnboardingDef(tab);
      if (!def) return error(`La tab «${tab}» no tiene onboarding.`);
      const estado = await getEstadoTab(tab);
      const pasos = def.pasos.map((p) => ({ key: p.key, paso: p.label, hecho: !!estado.steps[p.key]?.done, opcional: !!p.opcional, hecho_el: estado.steps[p.key]?.at ?? null }));
      return json({
        tab, nombre: def.nombre ?? def.titulo, lista: estado.status === 'done',
        pasos, faltan: pasos.filter((p) => !p.hecho && !p.opcional).map((p) => p.paso),
        ...(tab === 'ads-writer' && estado.status !== 'done' ? { aviso: 'Un cliente que ya cerró estos pasos en el onboarding general puede figurar pendiente hasta que abra la tab Ads Writer por primera vez (ahí se trasladan solos). Con Ads Writer pendiente, el Video Generator no abre.' } : {}),
      });
    },
  },

  limites_formato_instagram: {
    leer: async (input) => {
      const formato = str(input, 'formato') as FormatoIg;
      if (!['reel', 'carrusel', 'story'].includes(formato)) return error('«formato» tiene que ser reel, carrusel o story.');
      return json({
        formato,
        limites: limitesDe(formato),
        caption: { max_caracteres: CAPTION_MAX, visibles_antes_de_mas: CAPTION_VISIBLE },
        imagen: LIMITES_IMAGEN,
        nota: 'maxSeg/videoMaxSeg en segundos, maxMB en megabytes. interactivosPorApi false = stickers, encuestas y links se agregan a mano en la app de Instagram. MaKo no publica en Instagram: la pieza se publica a mano.',
      });
    },
  },

  // ── Acciones chat ──────────────────────────────────────────────────────────
  mover_estado_guion_anuncio: {
    preparar: async (input): Promise<Preparado> => {
      const estado = str(input, 'estado');
      if (!esEstadoGuion(estado)) return { error: `«estado» tiene que ser uno de: ${ESTADOS_GUION.join(', ')}.` };
      const r = await guionEn(str(input, 'celdaId'), str(input, 'guionId'));
      if ('error' in r) return { error: r.error };
      if (r.guion.estado === estado) return { error: `Ese guion ya está en «${estado}».` };
      return {
        payload: { celdaId: r.celda.id, guionId: r.guion.id, estado },
        resumen: `Pasar ${rotuloGuion(r.celda, r.guion)} a «${estado}».`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const estado = str(payload, 'estado');
      if (!esEstadoGuion(estado)) return { ok: false, resumen: 'La acción quedó con un estado inválido.' };
      const r = await guionEn(str(payload, 'celdaId'), str(payload, 'guionId'));
      if ('error' in r) return { ok: false, resumen: r.error };
      const w = await setEstadoGuion(r.celda.id, r.guion.id, estado);
      if (!w.ok) return { ok: false, resumen: `No se pudo mover el guion: ${w.error}` };
      return { ok: true, resumen: `Listo: ${rotuloGuion(r.celda, { ...r.guion, estado })}.`, datos: { celdaId: r.celda.id, guionId: r.guion.id, estado } };
    },
  },

  escribir_guion_anuncio_auto: {
    preparar: async (input): Promise<Preparado> => {
      const c = await celdaEn(str(input, 'celdaId'));
      if ('error' in c) return { error: c.error };
      if (c.celda.id === CELDA_PROPIOS) return { error: 'Los guiones propios no son un anuncio planteado: elige un anuncio de listar_anuncios_planteados.' };
      const n = c.celda.guiones.length;
      return {
        payload: { celdaId: c.celda.id },
        resumen: `MaKo escribe un guion nuevo para el anuncio «${c.celda.nombre}» (elige ángulo, estructura y siguiente paso${c.celda.anguloVideo ? '' : ', y el formato de video'}). Queda en borrador${n === 0 ? ' (es el primero de ese anuncio)' : n === 1 ? ' junto al guion que ya tiene' : ` junto a los ${n} que ya tiene`}. Al confirmar invoca hasta tres modelos en serie y tarda cerca de un minuto.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const c = await celdaEn(str(payload, 'celdaId'));
      if ('error' in c) return { ok: false, resumen: c.error };
      try {
        const r = await escribirGuionAuto(c.celda.id);
        if (!r.ok) return { ok: false, resumen: `No se pudo escribir el guion: ${r.error}` };
        const falla = await verificarGuionNuevo(c.celda.id, r.guion.id);
        if (falla) return { ok: false, resumen: falla };
        return {
          ok: true,
          resumen: `Guion nuevo en borrador para «${c.celda.nombre}»: ángulo «${r.guion.anguloNombre}», estructura «${r.guion.estructuraNombre}».${r.conSugerencia ? '' : ' (La sugerencia de ángulo falló: se usaron los defaults del catálogo.)'}`,
          datos: { celdaId: c.celda.id, guionId: r.guion.id },
        };
      } catch (err) {
        return { ok: false, resumen: `No se pudo escribir el guion: ${fallo(err)}` };
      }
    },
  },

  elegir_formato_creativo_anuncio: {
    preparar: async (input): Promise<Preparado> => {
      const medio = str(input, 'medio');
      if (medio !== 'imagen' && medio !== 'video') return { error: '«medio» tiene que ser imagen o video.' };
      const c = await celdaEn(str(input, 'celdaId'));
      if ('error' in c) return { error: c.error };
      const actual = formatoCorto(medio === 'imagen' ? c.celda.anguloImagen : c.celda.anguloVideo);
      return {
        payload: { celdaId: c.celda.id, medio },
        resumen: `MaKo elige el formato de ${medio} del anuncio «${c.celda.nombre}»${actual ? ` (reemplaza «${actual.nombre}»)` : ''}.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const medio = str(payload, 'medio') === 'video' ? 'video' : 'imagen';
      const c = await celdaEn(str(payload, 'celdaId'));
      if ('error' in c) return { ok: false, resumen: c.error };
      // 12 s POR PROVEEDOR (ver helpers, punto 1): sin carrera, porque elegirAngulo escribe.
      const r = await elegirAngulo(c.celda.id, medio, 12000);
      if (!r.ok) return { ok: false, resumen: `No se pudo elegir el formato: ${r.error}` };
      return { ok: true, resumen: `Formato de ${medio} de «${c.celda.nombre}»: ${r.formato.nombre} — ${r.formato.descripcion}`, datos: { celdaId: c.celda.id, medio, formatoId: r.formatoId } };
    },
  },

  recomendar_formatos_creativo: {
    preparar: async (): Promise<Preparado> => {
      const [m, recs] = await Promise.all([matriz(), getRecomendaciones()]);
      if ('error' in m) return { error: m.error };
      const razones = m.razones;
      if (!razones.some((r) => r.id !== CELDA_PROPIOS)) return { error: 'El negocio todavía no tiene anuncios planteados: de ahí salen los formatos. Se arman en la tab Ads Writer.' };
      return {
        payload: {},
        resumen: `MaKo elige los formatos de creativo que mejor le sirven al negocio${recs.length ? ` y reemplaza las ${recs.length} recomendaciones guardadas` : ''}.`,
      };
    },
    ejecutar: async (): Promise<Ejecutado> => {
      // recomendarFormatos no acepta timeoutMs (30 s por proveedor × la cascada). Aquí SÍ
      // hay carrera: la función no escribe, y setRecomendaciones va después y solo si ganó.
      const r = await conTope(recomendarFormatos(), 45000);
      if (r === 'tope') return { ok: false, resumen: 'La IA tardó demasiado en elegir los formatos. No se cambió nada: vuelve a intentarlo en un momento.' };
      if (!r.ok) return { ok: false, resumen: `No se pudieron generar las recomendaciones: ${r.error}` };
      await setRecomendaciones(r.recomendaciones);
      const nombres = r.recomendaciones.map((x) => formatoPorId(x.formatoId)?.nombre ?? x.formatoId);
      return { ok: true, resumen: `${r.recomendaciones.length} formatos recomendados: ${nombres.join(', ')}.`, datos: { total: r.recomendaciones.length } };
    },
  },

  // ── Acciones pantalla (genérica /mako/revisar: preparar recibe los `parametros`) ─
  escribir_guion_anuncio: {
    preparar: async (input): Promise<Preparado> => {
      const c = await celdaEn(str(input, 'celdaId'));
      if ('error' in c) return { error: c.error };
      if (c.celda.id === CELDA_PROPIOS) return { error: 'Los guiones propios no son un anuncio planteado: elige un anuncio de listar_anuncios_planteados.' };
      const anguloId = str(input, 'anguloId');
      const estructuraId = str(input, 'estructuraId');
      const siguientePaso = str(input, 'siguientePaso');
      const [angulos, estructuras, pasos] = await Promise.all([getAngulosGuion(), getEstructurasGuion(), siguientePasoOpciones()]);
      const angulo = anguloId ? angulos.find((a) => a.id === anguloId && a.activo) : undefined;
      if (anguloId && !angulo) return { error: `No hay un ángulo activo con id «${anguloId}».`, disponibles: angulos.filter((a) => a.activo).map((a) => a.id) };
      const estructura = estructuraId ? estructuras.find((e) => e.id === estructuraId && e.activo) : undefined;
      if (estructuraId && !estructura) return { error: `No hay una estructura activa con id «${estructuraId}».`, disponibles: estructuras.filter((e) => e.activo).map((e) => e.id) };
      // generarGuion acepta cualquier texto como siguiente paso; la regla es que salga
      // de la lista cerrada (un CTA inventado manda a la gente a un paso que no existe).
      if (siguientePaso && !pasos.includes(siguientePaso)) return { error: 'siguientePaso tiene que ser el texto EXACTO de una opción de opciones_siguiente_paso_guion.', disponibles: pasos };
      const respuestasAngulo = (Array.isArray(input.respuestasAngulo) ? input.respuestasAngulo : [])
        .map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { pregunta: str(o, 'pregunta'), respuesta: str(o, 'respuesta') }; })
        .filter((x) => x.pregunta && x.respuesta);
      const nota = str(input, 'nota');
      return {
        payload: {
          celdaId: c.celda.id,
          ...(angulo ? { anguloId: angulo.id } : {}),
          ...(estructura ? { estructuraId: estructura.id } : {}),
          ...(siguientePaso ? { siguientePaso } : {}),
          ...(respuestasAngulo.length ? { respuestasAngulo } : {}),
          ...(nota ? { nota } : {}),
        },
        resumen: `Escribir un guion para el anuncio «${c.celda.nombre}» con el ángulo ${angulo ? `«${angulo.nombre}»` : 'que elija MaKo'}, la estructura ${estructura ? `«${estructura.nombre}»` : 'compatible'} y el siguiente paso ${siguientePaso ? `«${siguientePaso}»` : 'del funnel'}${respuestasAngulo.length ? `, con ${respuestasAngulo.length} respuestas` : ''}${nota ? ' y la nota de la persona' : ''}. Queda en borrador.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const c = await celdaEn(str(payload, 'celdaId'));
      if ('error' in c) return { ok: false, resumen: c.error };
      const respuestasAngulo = Array.isArray(payload.respuestasAngulo) ? (payload.respuestasAngulo as Array<{ pregunta: string; respuesta: string }>) : undefined;
      try {
        const r = await escribirGuionConDecisiones(c.celda.id, {
          anguloId: str(payload, 'anguloId') || undefined,
          estructuraId: str(payload, 'estructuraId') || undefined,
          siguientePaso: str(payload, 'siguientePaso') || undefined,
          respuestasAngulo,
          nota: str(payload, 'nota') || undefined,
        });
        if (!r.ok) return { ok: false, resumen: `No se pudo escribir el guion: ${r.error}` };
        const falla = await verificarGuionNuevo(c.celda.id, r.guion.id);
        if (falla) return { ok: false, resumen: falla };
        return { ok: true, resumen: `Guion nuevo en borrador para «${c.celda.nombre}»: ángulo «${r.guion.anguloNombre}», estructura «${r.guion.estructuraNombre}».`, datos: { celdaId: c.celda.id, guionId: r.guion.id } };
      } catch (err) {
        return { ok: false, resumen: `No se pudo escribir el guion: ${fallo(err)}` };
      }
    },
  },

  editar_texto_guion_anuncio: {
    preparar: async (input): Promise<Preparado> => {
      const texto = str(input, 'texto');
      if (!texto) return { error: 'El guion no puede quedar vacío.', faltan: ['texto'] };
      const r = await guionEn(str(input, 'celdaId'), str(input, 'guionId'));
      if ('error' in r) return { error: r.error };
      const distinta = huellaNoCoincide(input, r.guion);
      if (distinta) return { error: distinta, ...(str(input, 'huella') ? {} : { faltan: ['huella'] }) };
      if (r.guion.texto.trim() === texto) return { error: 'El texto nuevo es igual al actual: no hay nada que cambiar.' };
      const estructura = r.guion.estructuraId ? (await getEstructurasGuion()).find((e) => e.id === r.guion.estructuraId) : undefined;
      const rotulosPerdidos = estructura ? estructura.etiquetas.filter((et) => !bloquesDeGuion(texto, estructura.etiquetas).some((b) => b.etiqueta === et)) : [];
      const inventado = ctaInventado(r.guion.texto, texto);
      const avisos = [
        rotulosPerdidos.length ? `faltan los rótulos ${rotulosPerdidos.join(', ')} (ya no se mostrará por bloques)` : '',
        inventado.length ? `el texto nuevo mete llamados a la acción que el original no tenía: ${inventado.join(', ')}` : '',
      ].filter(Boolean);
      return {
        payload: { celdaId: r.celda.id, guionId: r.guion.id, texto, huella: huellaTexto(r.guion.texto) },
        resumen: `Reemplazar el texto de ${rotuloGuion(r.celda, r.guion)} (${palabras(r.guion.texto)} → ${palabras(texto)} palabras). La versión anterior se pierde.${avisos.length ? ` Atención: ${avisos.join('; ')}.` : ''}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await guionEn(str(payload, 'celdaId'), str(payload, 'guionId'));
      if ('error' in r) return { ok: false, resumen: r.error };
      const distinta = huellaNoCoincide(payload, r.guion);
      if (distinta) return { ok: false, resumen: distinta };
      const w = await editarTextoGuion(r.celda.id, r.guion.id, str(payload, 'texto'));
      if (!w.ok) return { ok: false, resumen: `No se pudo guardar el texto: ${w.error}` };
      return { ok: true, resumen: `Texto actualizado en el guion «${r.guion.anguloNombre}» del anuncio «${r.celda.nombre}».`, datos: { celdaId: r.celda.id, guionId: r.guion.id } };
    },
  },

  borrar_guion_anuncio: {
    preparar: async (input): Promise<Preparado> => {
      const r = await guionEn(str(input, 'celdaId'), str(input, 'guionId'));
      if ('error' in r) return { error: r.error };
      const distinta = huellaNoCoincide(input, r.guion);
      if (distinta) return { error: distinta, ...(str(input, 'huella') ? {} : { faltan: ['huella'] }) };
      return {
        payload: { celdaId: r.celda.id, guionId: r.guion.id, huella: huellaTexto(r.guion.texto) },
        resumen: `BORRAR ${rotuloGuion(r.celda, r.guion)}. No hay papelera: no se puede deshacer.${r.guion.estado === 'grabado' || r.guion.estado === 'publicado' ? ` Ojo: está ${r.guion.estado}.` : ''}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await guionEn(str(payload, 'celdaId'), str(payload, 'guionId'));
      if ('error' in r) return { ok: false, resumen: r.error };
      const distinta = huellaNoCoincide(payload, r.guion);
      if (distinta) return { ok: false, resumen: distinta };
      const w = await borrarGuionDeCelda(r.celda.id, r.guion.id);
      if (!w.ok) return { ok: false, resumen: `No se pudo borrar el guion: ${w.error}` };
      return { ok: true, resumen: `Borrado ${rotuloGuion(r.celda, r.guion)}.`, datos: { celdaId: r.celda.id, guionId: r.guion.id } };
    },
  },
  // `crear_borrador_instagram` salió el 06/10/2026 con la tab Instagram: dejaba un
  // borrador en un programador que ya no existe (contenido_posts sin pantalla).
};
