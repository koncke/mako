'use client';

// =============================================================================
// TareaAlumno — la tarea de una clase, como la contesta el cliente en su portal
// =============================================================================
// Los seis tipos de campo del programa de Mauricio (texto, línea, número, elección, casillas y
// tabla con columnas y filas fijas o un mínimo de filas), o una respuesta libre si la clase no
// trae campos. «Guardar» deja el borrador; «Enviar» la marca enviada si alcanza
// (`respuestaCompleta`, en el server) y puede pasar al cliente a la etapa siguiente.
//
// Tres decisiones:
//   · MIENTRAS ESTÁ PENDIENTE, SE GUARDA SOLO (unos segundos después de dejar de escribir, y por
//     `sendBeacon` al cerrar la pestaña). Es un empresario contestando preguntas largas desde el
//     teléfono: un «Guardar» que no se toca pierde media hora de trabajo (lo aprendió el
//     cuaderno del programa viejo, 07d07139^:app/compartido/[token]/TareaCliente.tsx).
//   · YA ENVIADA, SE LEE Y NO SE TOCA hasta «Editar». Ahí no hay autoguardado: el borrador de
//     una tarea que Mauricio ya revisó cambiaría lo que él aprobó sin que nadie la reenvíe. Se
//     edita y se ENVÍA de nuevo (y vuelve a quedar para revisar).
//   · ANTES DE ENVIAR SE MIRA QUÉ FALTA (`queFalta`, misma regla que el server pero sin contar
//     la etiqueta de una fila fija como contestada) y se dice en una frase.
//
// EL PASO 5 DE #665 (07/10/2026): después de la llamada, la IA reescribe su respuesta con lo que se
// habló (lib/curso-propuesta-ia.ts) y llega acá PENDIENTE (`propuesta`). Se dibujan «Tu respuesta» y
// «Con lo que hablaron», una debajo de la otra (en el teléfono, lado a lado no se lee una tabla), y
// dos salidas:
//   · «Aprobar» manda `aprobar: desde` y el server copia la versión de la IA a su respuesta con
//     compare-and-set (sólo si sigue pendiente y es la misma que vio). Un 409 = ya no está.
//   · «Corregir» abre SU formulario con la versión de la IA cargada; al «Enviar de nuevo», el server
//     marca la propuesta corregida (`guardarTarea`). «Descartar cambios» vuelve a la suya, y la
//     propuesta sigue ahí.
// Mientras hay una propuesta, «Editar» no se ofrece: «Corregir» es editar, partiendo de la de la IA.
// Nada de esto manda mensajes ni mueve de etapa: la tarea ya estaba enviada.
//
// LOS TIPOS DE LA #18 (07/10/2026): archivo, audio y video (grabados acá), link, escala, quiz,
// checklist, agenda y «lo hice» (`CampoTipo`, lib/curso.ts). Cinco decisiones que no se ven:
//   · UN ARCHIVO SE SUBE DIRECTO AL BUCKET con una URL firmada que pide /api/compartido/curso/entrega
//     (el mismo candado que la tarea), con barra de progreso por XMLHttpRequest (`fetch` no da el
//     progreso de SUBIDA). Recién cuando TERMINÓ entra a los valores: el autoguardado y el beacon
//     nunca mandan un archivo a medio subir. «Enviar» espera a que no haya ninguna subida en curso.
//   · LOS VALORES SE CAMBIAN SOBRE LO ÚLTIMO (`ultimo.current`), no sobre el `valores` del render: dos
//     subidas que terminan casi juntas agregan las dos (con el del render, la segunda pisaba a la
//     primera).
//   · EL QUIZ SE CORRIGE EN EL SERVER: acá no llegan las correctas (`camposParaAlumno`). Un envío
//     desaprobado vuelve como borrador con su nota, y el alumno reintenta. Aprobado, no se vuelve a
//     contestar. En la vista previa del EQUIPO (que sí tiene las correctas) se corrige en local.
//   · GRABAR: `MediaRecorder` con permiso, contador y tope (para solo al llegar), escuchar o ver antes
//     de usarla, y regrabar. Si el navegador no graba, o no dio permiso, se ofrece subir un archivo.
//   · UN LINK, UNA ESCALA, «YA AGENDÉ» Y «LO HICE» cuentan con la MISMA regla que el server
//     (`campoLleno`): un link que no es un link no es una respuesta.
//
// LOS AJUSTES DEL 08/10/2026:
//   · La PREGUNTA es el título del campo, arriba del cuadro, NUNCA su placeholder (item 5: «No podés poner
//     la pregunta dentro del cuadro de texto donde va a completar el alumno como si fuera un placeholder,
//     eso confunde»). El cuadro lleva, si el equipo lo escribió, su TEXTO DE EJEMPLO (`Campo.placeholder`).
//   · LA COMUNIDAD (item 17): un campo «Publicar en la comunidad» deja escribir el post (título y texto)
//     acá mismo, y uno «Comentar en la comunidad» muestra el post y deja comentarlo. Va por la ruta de la
//     tarea (`comunidad`, con su token y su candado) y lo que queda en la respuesta es QUÉ post o comentario
//     (lib/curso-tarea-comunidad.ts), que la ruta verifica antes de guardar.
//
// Texto de pantalla: español neutro con TÚ (los clientes de Mauricio son mexicanos), corto.

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ArchivoEntregado, Calificacion, Campo, EstadoTarea, NotaQuiz, Valores, ValorCampo } from '@/lib/curso';
import {
  aceptaDeCampo, corregirEnvio, esCampoDeArchivo, esCampoDeComunidad, linkValido, mimeBase, mimeDeEntrega, mimesDeCampo, nombreDeEntrega,
  pathsDeEntregas, sanearValores, seApruebaSola, MAX_SEG_DEFAULT, TOPE_ENTREGA_BYTES,
} from '@/lib/curso';
import type { PropuestaVista } from '@/lib/curso-portal';
import { Button, Input, Textarea, Radio, Checkbox, Progress } from '@/app/_ui';
import { subirConProgreso } from '@/app/customer-success/curso/subir-video';
import { filasDeTabla, filaVacia, queFalta, fraseQueFalta, fraseDeBytes, reloj, estadoDeQuiz } from './tarea-valores';
import { useVistaPrevia } from './vista-previa';

const URL_TAREA = '/api/compartido/curso/tarea';
const URL_ENTREGA = '/api/compartido/curso/entrega';
const RESPIRO_MS = 2500;

type Guardado = 'limpio' | 'sucio' | 'guardando' | 'guardado' | 'error';
type Respuesta = {
  ok?: boolean;
  error?: string;
  progreso?: { estado: EstadoTarea; valores: Valores };
  faltaCompletar?: boolean;
  avance?: { movido: boolean; hacia: string | null } | null;
  /** La nota de los quizzes recién corregidos (#18). */
  calificacion?: Calificacion;
  /** Cuántos archivos no entraron (no eran de esta tarea, o no terminaron de subir). */
  descartados?: number;
};

/** Lo que contesta la ruta de la tarea a un pedido de la comunidad (item 17). */
type RespuestaComunidad = { ok: boolean; error?: string; valor?: string | null; post?: { id: number; titulo: string; extracto: string } | null };

/** Lo que un campo de la #18 necesita de la tarea: subir, abrir, cambiar sobre lo último y las notas. */
type Herramientas = {
  subir: (c: Campo, f: File, onPct: (n: number) => void) => Promise<ArchivoEntregado>;
  abrir: (a: ArchivoEntregado) => Promise<string | null>;
  /** Pone la lista de archivos de un campo, o le agrega uno, sobre los valores MÁS NUEVOS. */
  archivos: (id: string, cambio: (antes: ArchivoEntregado[]) => ArchivoEntregado[]) => void;
  calificacion: Calificacion;
  /** Publicar, comentar o mirar qué post se comenta, en la comunidad del producto (item 17). */
  comunidad: (c: Campo, accion: 'publicar' | 'comentar' | 'ver', datos?: { titulo?: string; cuerpo?: string }) => Promise<RespuestaComunidad>;
  /** Sin alumno detrás: la vista previa del equipo (no sale nada). */
  previa: boolean;
};

/**
 * Lo que contestaría el server, en la VISTA PREVIA del equipo (no sale nada). Un quiz se corrige acá
 * SÓLO si los campos traen las correctas: los de la tab Curso sí; los del portal en vista previa no
 * (pasan por `claseVista`), y ahí se da por enviado sin nota en vez de decir «0 %».
 */
function respuestaDeVistaPrevia(campos: readonly Campo[], v: Valores, enviar: boolean, antes: Calificacion): Respuesta {
  let estado: EstadoTarea = enviar ? 'enviada' : 'pendiente';
  let calificacion: Calificacion | undefined;
  const conCorrectas = campos.some((c) => c.tipo === 'quiz')
    && campos.every((c) => c.tipo !== 'quiz' || (c.preguntas ?? []).every((p) => (p.correctas ?? []).length > 0));
  if (enviar && conCorrectas) {
    const r = corregirEnvio(campos, sanearValores(campos, v), antes, new Date().toISOString());
    if (r?.tipo === 'sin-intentos') return { ok: false, error: 'sin intentos', calificacion: r.calificacion };
    if (r?.tipo === 'corregido') {
      calificacion = r.calificacion;
      estado = !r.aprobado ? 'pendiente' : seApruebaSola(campos) ? 'aprobada' : 'enviada';
    }
  }
  return { ok: true, progreso: { estado, valores: v }, faltaCompletar: false, avance: null, ...(calificacion ? { calificacion } : {}) };
}

/** Los archivos de un valor, a la defensiva: un jsonb viejo o de otro tipo no revienta la pantalla. */
const archivosDe = (v: ValorCampo | undefined): ArchivoEntregado[] =>
  Array.isArray(v) ? (v as unknown[]).filter((x): x is ArchivoEntregado => !!x && typeof x === 'object' && !Array.isArray(x) && typeof (x as ArchivoEntregado).path === 'string') : [];

export default function TareaAlumno({ token, claseId, area, tarea, campos, valoresIniciales, estadoInicial, propuesta, calificacion, onEstado, onPropuesta, onAvance, onValores }: {
  token: string;
  claseId: number;
  /**
   * De qué área es esta tarea, en una clase POR ÁREA (#665). Ausente = la del cliente. Viaja como
   * `a` en cada guardado — también en el beacon — y el server decide si este link puede escribirla
   * (`areaDeLaTarea`): con el link de un líder se ignora y manda su área.
   */
  area?: string;
  /** La instrucción de llenado que escribió Mauricio. */
  tarea: string;
  campos: Campo[];
  valoresIniciales: Valores;
  estadoInicial: EstadoTarea;
  /** La versión de la IA, PENDIENTE de que la apruebe o la corrija (paso 5 de #665). */
  propuesta?: PropuestaVista;
  /**
   * La nota de sus quizzes como quedó guardada (#18, `ClaseVista.calificacion`): en qué quedó cada
   * uno y cuántos intentos usó. Ausente = ninguno corregido todavía.
   */
  calificacion?: Calificacion;
  onEstado: (e: EstadoTarea) => void;
  /** Se resolvió la propuesta (la aprobó, la corrigió o ya no estaba): el chip de la clase se va. */
  onPropuesta?: () => void;
  /** El envío completó la etapa y el cliente pasó a la siguiente. */
  onAvance: () => void;
  /**
   * Lo último que quedó, AL DESMONTARSE: el borrador si sigue pendiente, lo enviado si no.
   *
   * ⚠️ Desde el 07/10/2026 la tarea vive en la LECCIÓN del curso (app/_cursos/CursoUgc.tsx), y
   *    pasar a otra clase la desmonta. El borrador se salva solo (el `sendBeacon` de la limpieza),
   *    pero `valoresIniciales` es lo que trajo la PÁGINA: al volver, la tarea se dibujaba con lo de
   *    antes y parecía que lo escrito se había perdido. El portal guarda esto y lo devuelve como
   *    `valoresIniciales` la próxima vez. Lo editado de una tarea enviada SIN reenviar no se
   *    devuelve: no se guardó, y mostrarlo como su respuesta sería mentir.
   */
  onValores?: (v: Valores) => void;
}) {
  const previa = useVistaPrevia();
  // ⚠️ Los ids de los campos llevan el de ESTA tarea: con una clase por área hay N formularios
  // iguales en la misma página, y un `<label htmlFor>` repetido enfoca el campo de otra área.
  const idBase = useId();
  const [valores, setValores] = useState<Valores>(valoresIniciales);
  const [estado, setEstado] = useState<EstadoTarea>(estadoInicial);
  const [editando, setEditando] = useState(estadoInicial === 'pendiente');
  const [guardado, setGuardado] = useState<Guardado>('limpio');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'falta' | 'ok' | 'error'; texto: string } | null>(null);
  /** La propuesta de la IA que sigue pendiente en esta pantalla (paso 5 de #665). */
  const [prop, setProp] = useState<PropuestaVista | null>(propuesta ?? null);
  const [aprobando, setAprobando] = useState(false);
  /** Las notas de los quizzes (#18): lo que trajo la página, y lo que devuelve cada envío. */
  const [calif, setCalif] = useState<Calificacion>(calificacion ?? {});
  /** Cuántas subidas hay en curso: con alguna, «Enviar» espera. */
  const [subiendo, setSubiendo] = useState(0);

  const timer = useRef<number | undefined>(undefined);
  const ultimo = useRef<Valores>(valoresIniciales);
  // Lo último que quedó ENVIADO: «Descartar cambios» vuelve acá, no a lo que trajo la página.
  const base = useRef<Valores>(valoresIniciales);
  const sucio = useRef(false);
  // El autoguardado sólo corre en una tarea PENDIENTE (ver la cabecera).
  const autoguarda = estado === 'pendiente';
  // Para lo que corre DESPUÉS del render que lo armó (el final de una subida, el corrector local).
  const autoguardaRef = useRef(autoguarda);
  const califRef = useRef(calif);
  /** path → URL local de lo que se subió o grabó en esta pantalla: se reproduce sin ir a la red. */
  const locales = useRef(new Map<string, string>());
  const cancelaciones = useRef(new Set<() => void>());
  useEffect(() => { autoguardaRef.current = autoguarda; califRef.current = calif; });

  // `onValores`, al desmontarse (ver el prop). Las refs se ponen al día en un efecto, no en el render.
  const alDesmontar = useRef({ estado, onValores });
  useEffect(() => { alDesmontar.current = { estado, onValores }; });
  useEffect(() => () => {
    const { estado: e, onValores: f } = alDesmontar.current;
    f?.(e === 'pendiente' ? ultimo.current : base.current);
  }, []);
  // Al irse: se cortan las subidas en curso y se sueltan las URLs locales.
  useEffect(() => {
    const subidas = cancelaciones.current;
    const urls = locales.current;
    return () => {
      for (const c of subidas) c();
      for (const u of urls.values()) URL.revokeObjectURL(u);
    };
  }, []);

  const mandar = useCallback(async (v: Valores, enviar: boolean): Promise<Respuesta | null> => {
    // ⚠️ VISTA PREVIA DEL EQUIPO: no hay alumno, así que no sale nada (./vista-previa.ts). Se
    // contesta en local lo mismo que contestaría el server, para que el formulario se pueda
    // probar entero; el pie del portal dice que no se guarda.
    if (previa) return respuestaDeVistaPrevia(campos, v, enviar, califRef.current);
    try {
      const r = await fetch(URL_TAREA, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token, c: claseId, a: area, valores: v, enviar }),
      });
      // Un 409 trae su motivo (un quiz sin intentos, o desaprobado sobre una tarea ya enviada): se lee.
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as Respuesta | null;
        return j?.error ? { ...j, ok: false } : null;
      }
      return (await r.json()) as Respuesta;
    } catch {
      return null;
    }
  }, [previa, token, claseId, area, campos]);

  /**
   * Los archivos que mandó y el server NO guardó (no eran de esta tarea, o no terminaron de subir):
   * se sacan de lo último, para que la pantalla no muestre como entregado algo que no está.
   */
  const reconciliar = useCallback((mandado: Valores, guardados: Valores) => {
    const quedaron = new Set(pathsDeEntregas(guardados));
    const perdidos = new Set(pathsDeEntregas(mandado).filter((p) => !quedaron.has(p)));
    if (!perdidos.size) return;
    const v: Valores = { ...ultimo.current };
    for (const c of campos) if (esCampoDeArchivo(c.tipo)) v[c.id] = archivosDe(v[c.id]).filter((a) => !perdidos.has(a.path));
    ultimo.current = v;
    setValores(v);
  }, [campos]);

  const guardarBorrador = useCallback(async (v: Valores) => {
    window.clearTimeout(timer.current);
    setGuardado('guardando');
    const j = await mandar(v, false);
    if (!j?.ok) { setGuardado('error'); return; }
    if (j.descartados && j.progreso) {
      reconciliar(v, j.progreso.valores);
      setAviso({ tono: 'error', texto: 'Un archivo no llegó. Súbelo de nuevo.' });
    }
    if (ultimo.current === v) sucio.current = false;
    setGuardado((g) => (g === 'guardando' ? 'guardado' : g));
  }, [mandar, reconciliar]);

  /** Cambia UN campo sobre los valores más nuevos (ver la cabecera), y programa el autoguardado. */
  const cambiar = useCallback((id: string, valor: ValorCampo) => {
    const v = { ...ultimo.current, [id]: valor };
    setValores(v);
    ultimo.current = v;
    sucio.current = true;
    setAviso(null);
    setGuardado('sucio');
    if (!autoguardaRef.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void guardarBorrador(v); }, RESPIRO_MS);
  }, [guardarBorrador]);

  // ── Las entregas (#18) ──────────────────────────────────────────────────────

  /** Sube un archivo del campo `c` directo al bucket. Tira con un error corto si no se pudo. */
  const subir = useCallback(async (c: Campo, file: File, onPct: (n: number) => void): Promise<ArchivoEntregado> => {
    const mime = mimeDeEntrega(file.name, file.type, mimesDeCampo(c.tipo));
    if (!mime) throw new Error('Ese formato no va.');
    if (!(file.size > 0)) throw new Error('El archivo está vacío.');
    // El tope ANTES de subir: el bucket rechaza recién al terminar, después de toda la barra.
    if (file.size > TOPE_ENTREGA_BYTES) throw new Error('Pasa de 100 MB.');
    const nombre = nombreDeEntrega(file.name);
    setSubiendo((n) => n + 1);
    try {
      if (previa) {
        // En la vista previa no se sube nada: se ve en local y nada más.
        const path = `previa/${Date.now()}-${Math.random().toString(36).slice(2)}`;
        locales.current.set(path, URL.createObjectURL(file));
        onPct(100);
        return { path, nombre, mime, bytes: file.size };
      }
      const r = await fetch(URL_ENTREGA, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token, c: claseId, a: area, accion: 'subir', campo: c.id, mime, bytes: file.size }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; path?: string; signedUrl?: string; apikey?: string | null } | null;
      if (!r.ok || !j?.ok || !j.path || !j.signedUrl) {
        // 429 = el tope de firmas por minuto de la ruta (diez archivos de golpe, dos veces): esperar
        // lo destraba, y «no se pudo» lo mandaría a reintentar contra el mismo tope.
        throw new Error(r.status === 403 ? 'Esta clase todavía no está abierta.'
          : r.status === 429 ? 'Espera un minuto.'
          : r.status === 400 && j?.error ? j.error : 'No se pudo preparar la subida.');
      }
      // El tipo viaja en la parte del multipart: tiene que ser el que se validó, no el del navegador.
      const tipado = file.type === mime ? file : new File([file], file.name, { type: mime });
      const s = subirConProgreso(j.signedUrl, tipado, j.apikey ?? null, onPct, 'PDF, imagen, audio o video');
      cancelaciones.current.add(s.cancelar);
      try { await s.promesa; } finally { cancelaciones.current.delete(s.cancelar); }
      onPct(100);
      locales.current.set(j.path, URL.createObjectURL(file));
      return { path: j.path, nombre, mime, bytes: file.size };
    } finally {
      setSubiendo((n) => Math.max(0, n - 1));
    }
  }, [previa, token, claseId, area]);

  /** El link para volver a ver una entrega: la local si se subió en esta pantalla, o una firmada. */
  const abrir = useCallback(async (a: ArchivoEntregado): Promise<string | null> => {
    const local = locales.current.get(a.path);
    if (local) return local;
    if (previa) return null;
    try {
      const r = await fetch(URL_ENTREGA, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token, c: claseId, a: area, accion: 'ver', path: a.path, nombre: a.nombre }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      return r.ok && j?.ok && typeof j.url === 'string' ? j.url : null;
    } catch {
      return null;
    }
  }, [previa, token, claseId, area]);

  /**
   * Publicar o comentar en la comunidad (item 17), o mirar qué post se comenta. Por la ruta de la TAREA,
   * con el token y la clase: pasa por su candado. Lo que vuelve (`valor`, QUÉ post o comentario) entra a
   * la respuesta como cualquier campo, y el server ya lo anotó. En la vista previa no sale nada.
   */
  const comunidad = useCallback(async (c: Campo, accion: 'publicar' | 'comentar' | 'ver', datos?: { titulo?: string; cuerpo?: string }): Promise<RespuestaComunidad> => {
    if (previa) {
      if (accion === 'ver') return { ok: true, post: c.postTitulo ? { id: c.postId ?? 0, titulo: c.postTitulo, extracto: '' } : null };
      return { ok: true, valor: 'previa' };
    }
    try {
      const r = await fetch(URL_TAREA, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token, c: claseId, a: area, comunidad: { campo: c.id, accion, ...datos } }),
      });
      const j = (await r.json().catch(() => null)) as RespuestaComunidad | null;
      if (r.status === 429) return { ok: false, error: 'Espera un minuto.' };
      if (r.status === 403) return { ok: false, error: j?.error ?? 'Sin acceso a la comunidad.' };
      return j ?? { ok: false, error: 'No se pudo.' };
    } catch {
      return { ok: false, error: 'Sin conexión.' };
    }
  }, [previa, token, claseId, area]);

  const herramientas: Herramientas = {
    subir,
    abrir,
    archivos: (id, cambio) => cambiar(id, cambio(archivosDe(ultimo.current[id]))),
    calificacion: calif,
    comunidad,
    previa,
  };

  // Al cerrar u ocultar la pestaña con algo sin guardar: `sendBeacon` sobrevive a la navegación,
  // un `fetch` normal no. Sólo el borrador de una tarea pendiente (nunca un envío).
  useEffect(() => {
    const salir = () => {
      if (previa || !autoguarda || !sucio.current || typeof navigator.sendBeacon !== 'function') return;
      const ok = navigator.sendBeacon(URL_TAREA, new Blob(
        [JSON.stringify({ t: token, c: claseId, a: area, valores: ultimo.current, enviar: false })],
        { type: 'text/plain' },
      ));
      if (ok) sucio.current = false;
    };
    const alOcultar = () => { if (document.visibilityState === 'hidden') salir(); };
    window.addEventListener('pagehide', salir);
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      window.removeEventListener('pagehide', salir);
      document.removeEventListener('visibilitychange', alOcultar);
      window.clearTimeout(timer.current);
      salir();
    };
  }, [previa, autoguarda, token, claseId, area]);

  /** El quiz que quedó abajo de su nota en esta respuesta, con lo que se le dice. */
  const quizDesaprobado = (c: Calificacion | undefined): string | null => {
    for (const q of campos) {
      if (q.tipo !== 'quiz') continue;
      const e = estadoDeQuiz(q, c?.[q.id]);
      if (e && !e.aprobado) return e.titulo;
    }
    return null;
  };
  const sinIntentos = campos.some((q) => q.tipo === 'quiz' && estadoDeQuiz(q, calif[q.id])?.sinIntentos);

  async function enviar() {
    window.clearTimeout(timer.current);
    if (subiendo > 0) { setAviso({ tono: 'falta', texto: 'Espera a que termine la subida.' }); return; }
    const falta = queFalta(campos, valores);
    if (falta) {
      // No se manda un envío que va a rebotar: se guarda el borrador y se dice qué falta.
      setAviso({ tono: 'falta', texto: fraseQueFalta(falta) });
      if (autoguarda && sucio.current) void guardarBorrador(valores);
      return;
    }
    setEnviando(true);
    setAviso(null);
    const mandado = valores;
    const j = await mandar(mandado, true);
    setEnviando(false);
    if (j?.calificacion) setCalif(j.calificacion);
    if (!j?.ok || !j.progreso) {
      if (j?.error === 'sin intentos') { setAviso({ tono: 'error', texto: 'Ya no quedan intentos.' }); return; }
      if (j?.error === 'no aprobó') { setAviso({ tono: 'falta', texto: quizDesaprobado(j.calificacion) ?? 'No aprobaste el quiz.' }); return; }
      setAviso({ tono: 'error', texto: 'No se pudo enviar. Intenta de nuevo.' });
      return;
    }
    if (j.descartados) reconciliar(mandado, j.progreso.valores);
    if (j.faltaCompletar) {
      setAviso({ tono: 'falta', texto: j.descartados ? 'Un archivo no llegó. Súbelo de nuevo.' : 'Faltan respuestas obligatorias.' });
      return;
    }
    // ⚠️ UN QUIZ DESAPROBADO VUELVE COMO BORRADOR (el server no la dejó enviada): se queda editando,
    // con su nota a la vista, y puede volver a intentar.
    const desaprobado = j.progreso.estado === 'pendiente' ? quizDesaprobado(j.calificacion) : null;
    if (desaprobado) {
      sucio.current = false;
      ultimo.current = j.progreso.valores;
      setValores(j.progreso.valores);
      setGuardado('guardado');
      setAviso({ tono: 'falta', texto: desaprobado });
      return;
    }
    sucio.current = false;
    base.current = j.progreso.valores;
    ultimo.current = j.progreso.valores;
    setValores(j.progreso.valores);
    setGuardado('limpio');
    setEstado(j.progreso.estado);
    onEstado(j.progreso.estado);
    setEditando(false);
    // Mandar su versión resolvió la propuesta de la IA en el server (`guardarTarea`): la «corrigió».
    if (prop) sinPropuesta();
    if (j.avance?.movido) {
      setAviso({ tono: 'ok', texto: '¡Etapa completada!' });
      onAvance();
    } else if (j.descartados) {
      setAviso({ tono: 'falta', texto: 'Tarea enviada. Un archivo no llegó.' });
    } else {
      setAviso({ tono: 'ok', texto: j.progreso.estado === 'aprobada' ? 'Tarea aprobada.' : 'Tarea enviada.' });
    }
  }

  function descartar() {
    window.clearTimeout(timer.current);
    setValores(base.current);
    ultimo.current = base.current;
    sucio.current = false;
    setGuardado('limpio');
    setAviso(null);
    setEditando(false);
  }

  /** Ya no hay propuesta que mostrar: la aprobó, la corrigió, o ya no estaba. */
  function sinPropuesta() {
    setProp(null);
    onPropuesta?.();
  }

  /**
   * «Aprobar»: el server copia la versión de la IA a su respuesta, con compare-and-set sobre el
   * `desde` que se ve acá. En la vista previa del equipo no sale nada (se contesta en local).
   */
  async function aprobar() {
    if (!prop) return;
    window.clearTimeout(timer.current);
    setAprobando(true);
    setAviso(null);
    let j: Respuesta | null = null;
    let yaNoEsta = false;
    if (previa) {
      j = { ok: true, progreso: { estado: 'enviada', valores: prop.valores }, faltaCompletar: false, avance: null };
    } else {
      try {
        const r = await fetch(URL_TAREA, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ t: token, c: claseId, a: area, aprobar: prop.desde }),
        });
        if (r.status === 409) yaNoEsta = true;
        else if (r.ok) j = (await r.json()) as Respuesta;
      } catch {
        // Sin red: abajo se dice que no se pudo, y la propuesta sigue a la vista.
      }
    }
    setAprobando(false);
    if (yaNoEsta) {
      sinPropuesta();
      setAviso({ tono: 'error', texto: 'Esa versión ya no está.' });
      return;
    }
    if (!j?.ok || !j.progreso) { setAviso({ tono: 'error', texto: 'No se pudo aprobar. Intenta de nuevo.' }); return; }
    base.current = j.progreso.valores;
    ultimo.current = j.progreso.valores;
    sucio.current = false;
    setValores(j.progreso.valores);
    setGuardado('limpio');
    setEstado(j.progreso.estado);
    onEstado(j.progreso.estado);
    sinPropuesta();
    setAviso({ tono: 'ok', texto: 'Versión aprobada.' });
  }

  /** «Corregir»: SU formulario, con la versión de la IA cargada. Lo manda con «Enviar de nuevo». */
  function corregir() {
    if (!prop) return;
    setValores(prop.valores);
    ultimo.current = prop.valores;
    sucio.current = true;
    setAviso(null);
    setEditando(true);
  }

  const soloLectura = !editando;
  const conPropuesta = prop != null && !editando;

  /** Un formulario entero (o la respuesta libre), con sus valores. Lo usan su respuesta y la de la IA. */
  const formulario = (v: Valores, ro: boolean, ids: string, rotulo: string) => campos.length ? (
    <ol className="cp-campos">
      {campos.map((c) => (
        <li key={c.id} className="cp-campo">
          <CampoAlumno idBase={ids} campo={c} valor={v[c.id]} soloLectura={ro} onCambio={(x) => cambiar(c.id, x)} h={herramientas} />
        </li>
      ))}
    </ol>
  ) : (
    <Textarea
      aria-label={rotulo}
      placeholder="Escribe tu respuesta"
      value={typeof v.respuesta === 'string' ? v.respuesta : ''}
      onChange={(e) => cambiar('respuesta', e.target.value)}
      readOnly={ro}
      rows={5}
    />
  );

  return (
    <section className="cp-tarea" aria-label="Tarea">
      <div className="cp-tarea-cab">
        <span className="cp-eyebrow">Tarea</span>
      </div>
      {tarea.trim() && <p className="cp-tarea-instr">{tarea}</p>}

      {conPropuesta && <p className="cp-prop-tit">Tu respuesta</p>}
      {formulario(valores, soloLectura, idBase, 'Tu respuesta')}

      {/* La versión de la IA, de sólo lectura: se aprueba tal cual o se corrige en SU formulario.
          Sus ids van aparte: dos formularios iguales en la misma tarea. */}
      {conPropuesta && prop && (
        <div className="cp-prop">
          <p className="cp-prop-tit">Con lo que hablaron</p>
          {formulario(prop.valores, true, `${idBase}ia`, 'Con lo que hablaron')}
        </div>
      )}

      {aviso && <p className={`cp-aviso cp-aviso--${aviso.tono}`} role="status">{aviso.texto}</p>}

      <div className="cp-tarea-pie">
        {conPropuesta ? (
          <>
            <Button onClick={() => void aprobar()} loading={aprobando}>Aprobar</Button>
            <Button variant="secondary" onClick={corregir} disabled={aprobando}>Corregir</Button>
          </>
        ) : editando ? (
          <>
            <Button onClick={() => void enviar()} loading={enviando} disabled={sinIntentos}>
              {estado === 'pendiente' ? 'Enviar' : 'Enviar de nuevo'}
            </Button>
            {estado === 'pendiente' ? (
              <Button variant="secondary" onClick={() => void guardarBorrador(valores)} disabled={enviando || guardado === 'guardando'}>
                Guardar
              </Button>
            ) : (
              <Button variant="tertiary" onClick={descartar} disabled={enviando}>Descartar cambios</Button>
            )}
            {estado === 'pendiente' && <span className={`cp-guardado cp-guardado--${guardado}`}>{subiendo > 0 ? 'Subiendo…' : TEXTO_GUARDADO[guardado]}</span>}
          </>
        ) : (
          <Button variant="secondary" onClick={() => { setEditando(true); setAviso(null); }}>Editar</Button>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS_TIPOS }} />
    </section>
  );
}

const TEXTO_GUARDADO: Record<Guardado, string> = {
  limpio: '',
  sucio: 'Sin guardar',
  guardando: 'Guardando…',
  guardado: 'Guardado',
  error: 'No se guardó',
};

// ── Los tipos de campo ────────────────────────────────────────────────────────

function CampoAlumno({ idBase, campo, valor, soloLectura, onCambio, h }: {
  idBase: string; campo: Campo; valor: ValorCampo | undefined; soloLectura: boolean; onCambio: (v: ValorCampo) => void; h: Herramientas;
}) {
  const id = `cp-c-${idBase}-${campo.id}`;
  const rotulo = (
    <>
      {campo.label}
      {campo.obligatorio && <span className="cp-req" aria-label="obligatoria"> *</span>}
    </>
  );
  const ayuda = campo.ayuda ? <p className="cp-ayuda">{campo.ayuda}</p> : null;
  // Un control solo lleva <label>; un grupo (opciones, tabla) lleva <legend>, que no admite
  // párrafos adentro: la ayuda va debajo.
  const cabeza = (
    <>
      <label className="cp-preg" htmlFor={id}>{rotulo}</label>
      {ayuda}
    </>
  );
  /** Un grupo de controles (o uno que no es un input): el rótulo como leyenda, la ayuda debajo. */
  const grupo = (cuerpo: ReactNode) => (
    <fieldset className="cp-fieldset">
      <legend className="cp-preg">{rotulo}</legend>
      {ayuda}
      {cuerpo}
    </fieldset>
  );

  if (campo.tipo === 'eleccion') {
    const actual = typeof valor === 'string' ? valor : '';
    return grupo((campo.opciones ?? []).map((o) => (
      <Radio key={o} name={id} checked={actual === o} disabled={soloLectura} onChange={(on) => { if (on) onCambio(o); }} label={o} />
    )));
  }

  if (campo.tipo === 'checks' || campo.tipo === 'checklist') {
    const marcadas = Array.isArray(valor) && !Array.isArray(valor[0]) ? (valor as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const ops = campo.opciones ?? [];
    return grupo(
      <>
        {ops.map((o) => (
          <Checkbox key={o} checked={marcadas.includes(o)} disabled={soloLectura}
            onChange={(on) => onCambio(on ? [...marcadas, o] : marcadas.filter((x) => x !== o))} label={o} />
        ))}
        {campo.tipo === 'checklist' && ops.length > 0 && (
          <p className="cpt-meta">{ops.filter((o) => marcadas.includes(o)).length} de {ops.length}</p>
        )}
      </>,
    );
  }

  if (campo.tipo === 'tabla') {
    return grupo(<Tabla campo={campo} valor={valor} soloLectura={soloLectura} onCambio={onCambio} />);
  }

  if (campo.tipo === 'archivo') {
    return grupo(<CampoArchivos campo={campo} valor={valor} soloLectura={soloLectura} h={h} />);
  }

  if (campo.tipo === 'audio' || campo.tipo === 'video') {
    return grupo(<CampoGrabacion campo={campo} valor={valor} soloLectura={soloLectura} h={h} />);
  }

  if (campo.tipo === 'escala') {
    const e = campo.escala ?? { min: 1, max: 10, bajo: '', alto: '' };
    const actual = typeof valor === 'string' ? valor : '';
    const nums = Array.from({ length: e.max - e.min + 1 }, (_, i) => e.min + i);
    return grupo(
      <>
        <div className="cpt-escala" role="radiogroup" aria-label={campo.label}>
          {nums.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={actual === String(n)} disabled={soloLectura}
              className={`cpt-esc${actual === String(n) ? ' is-on' : ''}`} onClick={() => onCambio(String(n))}>
              {n}
            </button>
          ))}
        </div>
        <div className="cpt-extremos" aria-hidden>
          <span>{e.min} · {e.bajo}</span>
          <span>{e.max} · {e.alto}</span>
        </div>
      </>,
    );
  }

  if (campo.tipo === 'quiz') {
    return grupo(<CampoQuiz idBase={id} campo={campo} valor={valor} soloLectura={soloLectura} onCambio={onCambio} nota={h.calificacion[campo.id]} />);
  }

  if (campo.tipo === 'agenda') {
    const url = linkValido(campo.url);
    return grupo(
      <div className="cpt-fila">
        {url && <a className="mk-btn mk-btn--primary mk-btn--md" href={url} target="_blank" rel="noopener noreferrer">Agendar</a>}
        <Checkbox checked={valor === 'si'} disabled={soloLectura} label="Ya agendé" onChange={(on) => onCambio(on ? 'si' : '')} />
      </div>,
    );
  }

  if (campo.tipo === 'confirmacion') {
    return grupo(<Checkbox checked={valor === 'si'} disabled={soloLectura} label="Lo hice" onChange={(on) => onCambio(on ? 'si' : '')} />);
  }

  if (esCampoDeComunidad(campo.tipo)) {
    return grupo(<CampoComunidad idBase={id} campo={campo} valor={valor} soloLectura={soloLectura} onCambio={onCambio} h={h} />);
  }

  // ⚠️ LA PREGUNTA VA ARRIBA (`cabeza`, el título del campo) Y EL CUADRO LLEVA SÓLO EL TEXTO DE EJEMPLO
  //    que escribió el equipo (`campo.placeholder`), o nada: nunca la pregunta (item 5 del 08/10/2026).
  const ejemplo = campo.placeholder?.trim() || undefined;

  if (campo.tipo === 'link') {
    const s = typeof valor === 'string' ? valor : '';
    const valido = linkValido(s);
    return (
      <div>
        {cabeza}
        <Input id={id} type="url" inputMode="url" placeholder={ejemplo ?? 'https://'} value={s} onChange={(e) => onCambio(e.target.value)} readOnly={soloLectura} />
        {s.trim() && !valido && !soloLectura && <p className="cp-aviso cp-aviso--falta">Revisa el link.</p>}
        {soloLectura && valido && <a className="cpt-link" href={valido} target="_blank" rel="noopener noreferrer">Abrir</a>}
      </div>
    );
  }

  if (campo.tipo === 'linea' || campo.tipo === 'numero') {
    return (
      <div>
        {cabeza}
        <Input
          id={id}
          type="text"
          inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
          placeholder={ejemplo}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onCambio(e.target.value)}
          readOnly={soloLectura}
        />
      </div>
    );
  }

  return (
    <div>
      {cabeza}
      <Textarea id={id} rows={4} placeholder={ejemplo} value={typeof valor === 'string' ? valor : ''} onChange={(e) => onCambio(e.target.value)} readOnly={soloLectura} />
    </div>
  );
}

// ── La comunidad (item 17 del 08/10/2026) ─────────────────────────────────────

/**
 * Publicar un post o comentar uno, DESDE la tarea. Hecho, dice que está hecho (y no se vuelve a
 * publicar: un segundo post sería otro post en la comunidad de todos). Sin hacer, el formulario corto:
 * título y texto para un post; el post y el comentario para comentar.
 */
function CampoComunidad({ idBase, campo, valor, soloLectura, onCambio, h }: {
  idBase: string; campo: Campo; valor: ValorCampo | undefined; soloLectura: boolean; onCambio: (v: ValorCampo) => void; h: Herramientas;
}) {
  const publicar = campo.tipo === 'publicar';
  const hecho = typeof valor === 'string' && valor.trim() !== '';
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El post que se comenta: `undefined` = todavía no se sabe; `null` = no hay. */
  const [objetivo, setObjetivo] = useState<{ titulo: string; extracto: string } | null | undefined>(undefined);
  const { comunidad } = h;
  useEffect(() => {
    if (publicar || hecho || soloLectura) return;
    let vivo = true;
    void comunidad(campo, 'ver').then((r) => { if (vivo) setObjetivo(r.ok ? (r.post ?? null) : null); });
    return () => { vivo = false; };
  }, [publicar, hecho, soloLectura, comunidad, campo]);

  if (hecho) {
    return <p className="cpt-hecho">{publicar ? 'Publicado en la comunidad.' : 'Comentado en la comunidad.'}</p>;
  }
  if (soloLectura) return <p className="cpt-meta">{publicar ? 'Sin publicar.' : 'Sin comentar.'}</p>;

  async function mandar() {
    setError(null);
    if (publicar && !titulo.trim()) { setError('Falta el título.'); return; }
    if (!cuerpo.trim() && !publicar) { setError('Escribe tu comentario.'); return; }
    setMandando(true);
    const r = await comunidad(campo, publicar ? 'publicar' : 'comentar', publicar ? { titulo, cuerpo } : { cuerpo });
    setMandando(false);
    if (!r.ok || !r.valor) { setError(r.error ?? 'No se pudo.'); return; }
    onCambio(r.valor);
  }

  return (
    <div className="cpt-col">
      {!publicar && (
        objetivo === undefined ? <p className="cpt-meta">Buscando el post…</p>
          : objetivo === null ? <p className="cpt-meta">Todavía no hay un post para comentar.</p>
            : (
              <div className="cpt-post">
                <p className="cpt-post-t">{objetivo.titulo}</p>
                {objetivo.extracto && <p className="cpt-post-x">{objetivo.extracto}</p>}
              </div>
            )
      )}
      {publicar && (
        <Input id={`${idBase}-t`} value={titulo} placeholder="Título" aria-label="Título del post" maxLength={200}
          onChange={(e) => { setTitulo(e.target.value); setError(null); }} />
      )}
      {(publicar || objetivo) && (
        <>
          <Textarea id={`${idBase}-c`} rows={4} value={cuerpo} placeholder={publicar ? 'Escribe tu post' : 'Escribe tu comentario'}
            aria-label={publicar ? 'Texto del post' : 'Tu comentario'} onChange={(e) => { setCuerpo(e.target.value); setError(null); }} />
          <div className="cpt-fila">
            <Button size="sm" onClick={() => void mandar()} loading={mandando}>{publicar ? 'Publicar' : 'Comentar'}</Button>
            {h.previa && <span className="cpt-meta">Vista previa: no se publica.</span>}
          </div>
        </>
      )}
      {error && <p className="cp-aviso cp-aviso--error">{error}</p>}
    </div>
  );
}

/**
 * La tabla, como tabla. En el teléfono cada fila pasa a ser un bloque con sus columnas
 * rotuladas (el CSS de `.cp-tabla`): cinco columnas en 375 px no se leen, y un scroll lateral
 * adentro de un formulario largo se pierde.
 */
function Tabla({ campo, valor, soloLectura, onCambio }: {
  campo: Campo; valor: ValorCampo | undefined; soloLectura: boolean; onCambio: (v: ValorCampo) => void;
}) {
  const cols = campo.columnas?.length ? campo.columnas : [''];
  const filas = filasDeTabla(campo, valor);
  const fijas = campo.filasFijas?.length ?? 0;
  const set = (i: number, j: number, v: string) => {
    const n = filas.map((f) => [...f]);
    n[i][j] = v;
    onCambio(n);
  };
  return (
    <div className="cp-tabla-caja">
      <table className="cp-tabla">
        <thead>
          <tr>{cols.map((c, j) => <th key={j} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {cols.map((col, j) => (
                <td key={j} data-col={col}>
                  {j === 0 && i < fijas ? (
                    <span className="cp-fija">{fila[0]}</span>
                  ) : (
                    <input
                      className="cp-celda"
                      value={fila[j] ?? ''}
                      onChange={(e) => set(i, j, e.target.value)}
                      readOnly={soloLectura}
                      aria-label={`${col || 'Valor'}, fila ${i + 1}`}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!fijas && !soloLectura && (
        <Button variant="tertiary" size="sm" onClick={() => onCambio([...filas, filaVacia(campo)])}>Agregar fila</Button>
      )}
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

/**
 * Las preguntas de un quiz. Sin las correctas (no llegan): la nota la pone el server al enviar, y acá
 * se dice cómo le fue (`estadoDeQuiz`). Aprobado, o sin intentos, ya no se contesta.
 */
function CampoQuiz({ idBase, campo, valor, soloLectura, onCambio, nota }: {
  idBase: string; campo: Campo; valor: ValorCampo | undefined; soloLectura: boolean; onCambio: (v: ValorCampo) => void; nota: NotaQuiz | undefined;
}) {
  const ps = campo.preguntas ?? [];
  const filas = Array.isArray(valor) ? (valor as unknown[]) : [];
  const deFila = (i: number): string[] => (Array.isArray(filas[i]) ? (filas[i] as unknown[]).filter((x): x is string => typeof x === 'string') : []);
  const est = estadoDeQuiz(campo, nota);
  const ro = soloLectura || !!est?.aprobado || !!est?.sinIntentos;
  const set = (i: number, marcadas: string[]) => onCambio(ps.map((_, k) => (k === i ? marcadas : deFila(k))));
  return (
    <>
      <ol className="cpt-quiz">
        {ps.map((p, i) => {
          const marcadas = deFila(i);
          const mal = !!est && !est.aprobado && (nota?.malas ?? []).includes(i);
          return (
            <li key={p.id} className={`cpt-preg${mal ? ' is-mal' : ''}`}>
              <p className="cpt-preg-t">{p.texto}</p>
              {p.opciones.map((o) => (p.multiple ? (
                <Checkbox key={o} checked={marcadas.includes(o)} disabled={ro} label={o}
                  onChange={(on) => set(i, on ? [...marcadas, o] : marcadas.filter((x) => x !== o))} />
              ) : (
                <Radio key={o} name={`${idBase}-q${i}`} checked={marcadas[0] === o} disabled={ro} label={o}
                  onChange={(on) => { if (on) set(i, [o]); }} />
              )))}
            </li>
          );
        })}
      </ol>
      {est && (
        <p className={`cpt-nota ${est.aprobado ? 'is-ok' : 'is-mal'}`} role="status">
          {est.titulo}{est.detalle ? ` ${est.detalle}` : ''}
        </p>
      )}
    </>
  );
}

// ── Archivos ──────────────────────────────────────────────────────────────────

/** Un archivo entregado, en una fila: nombre, tamaño, abrirlo y (si se puede) quitarlo. */
function FilaArchivo({ a, h, onQuitar }: { a: ArchivoEntregado; h: Herramientas; onQuitar?: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  /** Si el navegador bloqueó la pestaña nueva: el link, para tocarlo a mano. */
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const esAudio = a.mime.startsWith('audio/');
  const esVideo = a.mime.startsWith('video/');

  async function abrir() {
    setError(false);
    if (esAudio || esVideo) {
      // Se reproduce acá mismo: el `<audio>`/`<video>` sigue pidiendo rangos a esa URL.
      setAbriendo(true);
      const url = await h.abrir(a);
      setAbriendo(false);
      if (url) setSrc(url); else setError(true);
      return;
    }
    // ⚠️ La pestaña se abre ANTES del pedido: abierta después de un `await`, el navegador la toma por
    // un pop-up y la bloquea. Sin `noopener` en la apertura (hace falta el manejador), se lo saca acá.
    const w = window.open('', '_blank');
    const url = await h.abrir(a);
    if (!url) { w?.close(); setError(true); return; }
    // Bloqueada igual (algunos navegadores del teléfono): el link queda a la vista. Navegar la página
    // del portal hacia el archivo sería sacarlo de su tarea.
    if (w) { w.opener = null; w.location.href = url; } else setLink(url);
  }

  return (
    <li className="cpt-arch">
      <div className="cpt-fila">
        <span className="cpt-arch-nom">{a.nombre}</span>
        <span className="cpt-meta">{a.seg ? reloj(a.seg) : fraseDeBytes(a.bytes)}</span>
        {!src && (
          <Button variant="tertiary" size="sm" onClick={() => void abrir()} loading={abriendo}>
            {esAudio ? 'Escuchar' : esVideo ? 'Ver' : 'Abrir'}
          </Button>
        )}
        {onQuitar && <Button variant="tertiary" size="sm" onClick={onQuitar}>Quitar</Button>}
      </div>
      {src && esAudio && <audio className="cpt-audio" src={src} controls autoPlay />}
      {src && esVideo && <video className="cpt-video" src={src} controls autoPlay playsInline />}
      {link && <a className="cpt-link" href={link} target="_blank" rel="noopener noreferrer">Abrir {a.nombre}</a>}
      {error && <p className="cp-aviso cp-aviso--error">No se pudo abrir.</p>}
    </li>
  );
}

type SubidaEnCurso = { id: number; nombre: string; pct: number };

/** Un entregable: uno o varios archivos, cada uno con su barra mientras sube. */
function CampoArchivos({ campo, valor, soloLectura, h }: {
  campo: Campo; valor: ValorCampo | undefined; soloLectura: boolean; h: Herramientas;
}) {
  const lista = archivosDe(valor);
  const max = Math.max(1, campo.maxArchivos ?? 1);
  const [enCurso, setEnCurso] = useState<SubidaEnCurso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const libres = max - lista.length - enCurso.length;

  async function elegir(files: FileList | null) {
    setError(null);
    const todos = [...(files ?? [])];
    const elegidos = todos.slice(0, Math.max(0, libres));
    if (input.current) input.current.value = '';
    if (todos.length > elegidos.length) setError(max === 1 ? 'Un archivo por vez.' : `Hasta ${max} archivos.`);
    await Promise.all(elegidos.map(async (f) => {
      const id = Date.now() + Math.random();
      setEnCurso((x) => [...x, { id, nombre: f.name, pct: 0 }]);
      try {
        const a = await h.subir(campo, f, (pct) => setEnCurso((x) => x.map((y) => (y.id === id ? { ...y, pct } : y))));
        // Sobre lo MÁS NUEVO, y sin pasarse del tope (dos tandas elegidas casi juntas).
        h.archivos(campo.id, (antes) => [...antes.filter((x) => x.path !== a.path), a].slice(0, max));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo subir.');
      } finally {
        setEnCurso((x) => x.filter((y) => y.id !== id));
      }
    }));
  }

  return (
    <div className="cpt-col">
      {(lista.length > 0 || enCurso.length > 0) && (
        <ul className="cpt-archivos">
          {lista.map((a) => (
            <FilaArchivo key={a.path} a={a} h={h}
              onQuitar={soloLectura ? undefined : () => h.archivos(campo.id, (antes) => antes.filter((x) => x.path !== a.path))} />
          ))}
          {enCurso.map((u) => (
            <li key={u.id} className="cpt-arch">
              <div className="cpt-fila">
                <span className="cpt-arch-nom">{u.nombre}</span>
                <span className="cpt-meta">{u.pct} %</span>
              </div>
              <Progress value={u.pct} label="Subiendo" />
            </li>
          ))}
        </ul>
      )}
      {soloLectura && !lista.length && <p className="cpt-meta">Sin archivos.</p>}
      {!soloLectura && libres > 0 && (
        <div className="cpt-fila">
          <input ref={input} type="file" hidden multiple={max > 1} accept={aceptaDeCampo(campo.tipo)} onChange={(e) => void elegir(e.target.files)} />
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
            {lista.length ? 'Agregar archivo' : max > 1 ? 'Subir archivos' : 'Subir archivo'}
          </Button>
          {max > 1 && <span className="cpt-meta">Hasta {max}</span>}
        </div>
      )}
      {error && <p className="cp-aviso cp-aviso--error">{error}</p>}
    </div>
  );
}

// ── Grabar audio o video ──────────────────────────────────────────────────────

type Fase =
  | { tipo: 'quieto' }
  | { tipo: 'pidiendo' }
  | { tipo: 'grabando'; desde: number }
  | { tipo: 'grabado'; blob: Blob; url: string; seg: number }
  | { tipo: 'subiendo'; pct: number };

/** Si el navegador puede grabar no cambia mientras la página está abierta: no hay a qué suscribirse. */
const sinSuscripcion = () => () => {};

/** ¿Este navegador puede grabar? `MediaRecorder` y `getUserMedia`, los dos (Safari los tiene desde 14.3). */
const puedeGrabar = (): boolean =>
  typeof window !== 'undefined' && typeof window.MediaRecorder === 'function' && !!navigator.mediaDevices?.getUserMedia;

/** El formato a pedirle al grabador: el primero que el navegador soporte de los que el bucket acepta. */
function tipoDeGrabacion(video: boolean): string | undefined {
  const candidatos = video
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidatos.find((t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t));
}

const EXT_GRABACION: Record<string, string> = { 'audio/webm': 'weba', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'video/webm': 'webm', 'video/mp4': 'mp4' };

/** Lo que se dice cuando el navegador no dejó grabar, según por qué. */
function motivoSinGrabar(e: unknown, video: boolean): string {
  const nombre = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return video ? 'Sin acceso a la cámara.' : 'Sin acceso al micrófono.';
  if (nombre === 'NotFoundError') return video ? 'No se encontró una cámara.' : 'No se encontró un micrófono.';
  return 'No se pudo grabar.';
}

/**
 * Grabar en el navegador (practicar un pitch): permiso, contador con tope, escuchar o ver antes de
 * usarla, regrabar, y subirla con su barra. Si el navegador no graba o no dio permiso, subir un archivo.
 */
function CampoGrabacion({ campo, valor, soloLectura, h }: {
  campo: Campo; valor: ValorCampo | undefined; soloLectura: boolean; h: Herramientas;
}) {
  const esVideo = campo.tipo === 'video';
  const tope = campo.maxSeg ?? MAX_SEG_DEFAULT;
  const guardada = archivosDe(valor)[0] ?? null;
  // Se pregunta en el navegador, no en el render del server: con `useSyncExternalStore` el server (y la
  // hidratación) ven `null` y recién después el navegador dice si hay con qué grabar, sin que el HTML
  // del server y el primero del navegador difieran.
  const soporta = useSyncExternalStore(sinSuscripcion, puedeGrabar, () => null);
  const [fase, setFase] = useState<Fase>({ tipo: 'quieto' });
  const [seg, setSeg] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const vivo = useRef<HTMLVideoElement>(null);
  const urlGrabada = useRef<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const apagar = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  const soltarUrl = () => {
    if (urlGrabada.current) URL.revokeObjectURL(urlGrabada.current);
    urlGrabada.current = null;
  };

  // Al irse: se corta la grabación y se apagan la cámara y el micrófono (si no, la luz queda prendida).
  useEffect(() => () => {
    try { if (rec.current?.state === 'recording') rec.current.stop(); } catch { /* ya estaba parado */ }
    stream.current?.getTracks().forEach((t) => t.stop());
    if (urlGrabada.current) URL.revokeObjectURL(urlGrabada.current);
  }, []);

  // El contador, y el corte al llegar al tope.
  const desde = fase.tipo === 'grabando' ? fase.desde : null;
  useEffect(() => {
    if (desde == null) return;
    const t = window.setInterval(() => {
      const s = (Date.now() - desde) / 1000;
      setSeg(s);
      if (s >= tope && rec.current?.state === 'recording') rec.current.stop();
    }, 250);
    return () => window.clearInterval(t);
  }, [desde, tope]);

  // La cámara en vivo mientras graba un video.
  useEffect(() => {
    if (desde != null && esVideo && vivo.current && stream.current) vivo.current.srcObject = stream.current;
  }, [desde, esVideo]);

  async function grabar() {
    setError(null);
    soltarUrl();
    setFase({ tipo: 'pidiendo' });
    try {
      const s = await navigator.mediaDevices.getUserMedia(esVideo
        ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } }
        : { audio: true });
      stream.current = s;
      const tipo = tipoDeGrabacion(esVideo);
      // 1 Mbps de video: un pitch de 5 minutos son ~40 MB, lejos del tope del bucket.
      const r = new MediaRecorder(s, { ...(tipo ? { mimeType: tipo } : {}), ...(esVideo ? { videoBitsPerSecond: 1_000_000 } : { audioBitsPerSecond: 96_000 }) });
      trozos.current = [];
      const inicio = Date.now();
      r.ondataavailable = (e) => { if (e.data.size) trozos.current.push(e.data); };
      r.onstop = () => {
        const dur = Math.min(tope, (Date.now() - inicio) / 1000);
        apagar();
        const mime = mimeBase(r.mimeType || tipo || (esVideo ? 'video/webm' : 'audio/webm'));
        const blob = new Blob(trozos.current, { type: mime });
        if (!blob.size) { setError('No se grabó nada. Intenta de nuevo.'); setFase({ tipo: 'quieto' }); return; }
        const url = URL.createObjectURL(blob);
        urlGrabada.current = url;
        setFase({ tipo: 'grabado', blob, url, seg: dur });
      };
      rec.current = r;
      r.start(1000);
      setSeg(0);
      setFase({ tipo: 'grabando', desde: inicio });
    } catch (e) {
      apagar();
      setError(motivoSinGrabar(e, esVideo));
      setFase({ tipo: 'quieto' });
    }
  }

  function detener() {
    if (rec.current?.state === 'recording') rec.current.stop();
  }

  async function subirArchivo(f: File, dur?: number) {
    setError(null);
    setFase({ tipo: 'subiendo', pct: 0 });
    try {
      const a = await h.subir(campo, f, (pct) => setFase({ tipo: 'subiendo', pct }));
      h.archivos(campo.id, () => [dur ? { ...a, seg: Math.round(dur) } : a]);
      soltarUrl();
      setFase({ tipo: 'quieto' });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir.');
      return false;
    }
  }

  async function usar() {
    if (fase.tipo !== 'grabado') return;
    const { blob, seg: dur } = fase;
    const antes = fase;
    const mime = mimeBase(blob.type) || (esVideo ? 'video/webm' : 'audio/webm');
    const f = new File([blob], `grabacion.${EXT_GRABACION[mime] ?? (esVideo ? 'webm' : 'weba')}`, { type: mime });
    if (!(await subirArchivo(f, dur))) setFase(antes);
  }

  async function elegirArchivo(files: FileList | null) {
    const f = files?.[0];
    if (archivo.current) archivo.current.value = '';
    if (f) await subirArchivo(f);
  }

  const subirOtro = (
    <>
      <input ref={archivo} type="file" hidden accept={aceptaDeCampo(campo.tipo)} onChange={(e) => void elegirArchivo(e.target.files)} />
      <Button variant="tertiary" size="sm" onClick={() => archivo.current?.click()}>Subir un archivo</Button>
    </>
  );

  if (soloLectura) {
    return guardada
      ? <ul className="cpt-archivos"><FilaArchivo a={guardada} h={h} /></ul>
      : <p className="cpt-meta">Sin grabar.</p>;
  }

  return (
    <div className="cpt-col">
      {fase.tipo === 'quieto' && guardada && (
        <ul className="cpt-archivos"><FilaArchivo a={guardada} h={h} onQuitar={() => h.archivos(campo.id, () => [])} /></ul>
      )}
      {fase.tipo === 'quieto' && (
        <div className="cpt-fila">
          {soporta && <Button variant={guardada ? 'secondary' : 'primary'} size="sm" onClick={() => void grabar()}>{guardada ? 'Regrabar' : 'Grabar'}</Button>}
          {soporta && <span className="cpt-meta">Hasta {reloj(tope)}</span>}
          {soporta === false && <span className="cpt-meta">Este navegador no graba.</span>}
          {subirOtro}
        </div>
      )}
      {fase.tipo === 'pidiendo' && <p className="cpt-meta">{esVideo ? 'Pidiendo la cámara…' : 'Pidiendo el micrófono…'}</p>}
      {fase.tipo === 'grabando' && (
        <>
          {esVideo && <video ref={vivo} className="cpt-video" muted autoPlay playsInline />}
          <div className="cpt-fila">
            <span className="cpt-rec" aria-live="polite"><i aria-hidden /> {reloj(seg)} / {reloj(tope)}</span>
            <Button size="sm" onClick={detener}>Detener</Button>
          </div>
        </>
      )}
      {fase.tipo === 'grabado' && (
        <>
          {esVideo
            ? <video className="cpt-video" src={fase.url} controls playsInline />
            : <audio className="cpt-audio" src={fase.url} controls />}
          <div className="cpt-fila">
            <Button size="sm" onClick={() => void usar()}>Usar esta</Button>
            <Button variant="secondary" size="sm" onClick={() => void grabar()}>Regrabar</Button>
            <Button variant="tertiary" size="sm" onClick={() => { soltarUrl(); setFase({ tipo: 'quieto' }); }}>Cancelar</Button>
          </div>
        </>
      )}
      {fase.tipo === 'subiendo' && (
        <div className="cpt-col">
          <Progress value={fase.pct} label="Subiendo" />
          <span className="cpt-meta">Subiendo… {fase.pct} %</span>
        </div>
      )}
      {error && <p className="cp-aviso cp-aviso--error">{error}</p>}
    </div>
  );
}

// =============================================================================
// Los estilos de los tipos de la #18. Van acá y no en ./estilos.ts para que viajen con el componente
// (la tab Curso también lo dibuja, en su vista previa). Tokens de la casa y --fs-*.
// ⚠️ Adentro de esta cadena no va ningún acento grave ni la secuencia de interpolación: la cortan.
// =============================================================================
const CSS_TIPOS = `
.cpt-col{ display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cpt-fila{ display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; min-width: 0; }
.cpt-meta{ margin: 0; font-size: var(--fs-meta); color: var(--faint); font-variant-numeric: tabular-nums; }
.cpt-archivos{ list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.cpt-arch{ display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; min-width: 0; }
.cpt-arch-nom{ flex: 1 1 140px; min-width: 0; font-size: var(--fs-sm); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpt-audio{ width: 100%; }
.cpt-video{ width: 100%; max-height: 360px; background: #000; border-radius: 10px; }
.cpt-rec{ display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--bad); }
.cpt-rec i{ width: 10px; height: 10px; border-radius: 50%; background: var(--bad); }
.cpt-escala{ display: flex; flex-wrap: wrap; gap: 6px; }
.cpt-esc{ min-width: var(--touch); min-height: var(--touch); border: 1px solid var(--border-strong); border-radius: 10px; background: var(--surface);
  color: var(--ink); font: inherit; font-size: var(--fs-md); font-variant-numeric: tabular-nums; cursor: pointer; }
.cpt-esc.is-on{ background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }
.cpt-esc:disabled{ cursor: default; }
.cpt-esc:disabled:not(.is-on){ opacity: .6; }
.cpt-extremos{ display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; font-size: var(--fs-meta); color: var(--dim); }
.cpt-extremos span:last-child{ text-align: right; }
.cpt-quiz{ list-style: decimal; margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 12px; }
.cpt-preg{ display: flex; flex-direction: column; gap: 2px; }
.cpt-preg-t{ margin: 0 0 4px; font-size: var(--fs-md); line-height: 1.45; overflow-wrap: anywhere; }
.cpt-preg.is-mal .cpt-preg-t{ color: var(--bad); }
.cpt-nota{ margin: 6px 0 0; font-size: var(--fs-sm); font-weight: 600; }
.cpt-nota.is-ok{ color: var(--good); }
.cpt-nota.is-mal{ color: var(--warn); }
.cpt-link{ display: inline-block; margin-top: 6px; font-size: var(--fs-sm); }
.cpt-hecho{ margin: 0; font-size: var(--fs-sm); font-weight: 600; color: var(--good); }
.cpt-post{ padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); min-width: 0; }
.cpt-post-t{ margin: 0; font-size: var(--fs-md); font-weight: 600; overflow-wrap: anywhere; }
.cpt-post-x{ margin: 4px 0 0; font-size: var(--fs-sm); color: var(--dim); line-height: 1.5; overflow-wrap: anywhere; }
`;
