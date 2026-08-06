'use client';

// ReunionExtractModal — G3: MaKo lee una reunión de Fathom y saca los action items
// del equipo como tarjetas del plan. Dos fases: elegir la reunión → revisar los
// candidatos (incluir/excluir + reasignar proyecto) → agregar al plan. El perro
// guardián los re-puntúa solo cuando entran (cambia la firma del plan).
//
// Lo que sale de acá al plan es SIEMPRE tuyo: las tareas de otras personas viven en
// su propia tab (ReunionTareas) y se les mandan a ellas — no se pueden tildar.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { SvcIcon } from '../../_components/ServicioVisual';
import { ReunionTareas, type CandidataTarea, type FilaTarea } from './ReunionTareas';
import { type Label, type Fuente } from './types';
import { TIPO_REUNION_UI, type TipoReunion } from '@/lib/reunion-clasificar';
import { frenoDeScope, type FrenoScope } from '@/lib/reunion-gate';
import { WizardShell } from '@/app/_components/WizardShell';
import { useCapaModal } from '@/app/_components/pila-modales';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Participante = { nombre: string; email: string };
type ReunionMeta = { recordingId: number; titulo: string; fecha: string | null; durMin: number | null; url: string | null; involucrados: string[]; tipo: TipoReunion; participantes?: Participante[] };
type Candidata = CandidataTarea;
type Existente = { id: string; titulo: string; detalle: string };
type Duda = { termino: string; porque: string };
// enriquece = ya existe en el plan; el Perro sugiere sumarle a esa tarjeta en vez de duplicar.
type Fila = FilaTarea;

/** Lo que YA salió de una reunión (borrador pendiente o ya aplicado). */
export type ResumenBorrador = { id: string; estado: 'pendiente' | 'aplicada' | 'descartada'; creadas: number; pendientesMias: number; pendientesOtros: number };


// ── El caché de la lista ─────────────────────────────────────────────────────
// Abrir el botón de Fathom pedía la lista entera a su API y tardaba varios segundos
// con la pantalla en blanco, TODAS las veces — aunque la lista fuera la misma que
// hace dos minutos y aunque de casi todas ya tuviéramos el borrador guardado. Ahora
// lo último que se vio queda en sessionStorage y se pinta al instante; el refresco
// corre por atrás y lo reemplaza cuando llega.
//
// sessionStorage (no localStorage): vive lo que dura la pestaña. Es una lista de
// reuniones, no un dato del negocio: si el navegador se cierra, que se vuelva a pedir.
const CACHE_KEY = 'mako.fathom.lista';
const CACHE_TTL_MS = 30 * 60 * 1000;

type CacheLista = { desde: string; ts: number; reuniones: ReunionMeta[]; cursor: string | null; borradores: Record<number, ResumenBorrador> };

function leerCache(desde: string): CacheLista | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CacheLista;
    // El filtro de fecha cambia QUÉ lista es: un caché de otro filtro no sirve.
    if (c.desde !== desde || !Array.isArray(c.reuniones) || !c.reuniones.length) return null;
    if (Date.now() - (c.ts || 0) > CACHE_TTL_MS) return null;
    return c;
  } catch { return null; }
}

function guardarCache(desde: string, reuniones: ReunionMeta[], cursor: string | null, borradoresRaw: Record<string, ResumenBorrador>) {
  try {
    const borradores: Record<number, ResumenBorrador> = {};
    for (const [ref, v] of Object.entries(borradoresRaw)) {
      const n = Number(ref.replace('fathom:', ''));
      if (Number.isFinite(n)) borradores[n] = v;
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ desde, ts: Date.now(), reuniones, cursor, borradores } satisfies CacheLista));
  } catch { /* cuota llena o modo privado: que no se caiga por un caché */ }
}

/** El cliente de la reunión, resuelto por el server contra el CRM. */
export type ClienteReunion = { nombre: string; empresa: string | null; proyecto: string; email: string };
/** Lo que se ofrece cuando el server NO tuvo certeza (pregunta cerrada, una sola). */
type OpcionCliente = { nombre: string; sub: string };

async function apiFathom(body: Record<string, unknown>): Promise<{ ok: boolean; reuniones?: ReunionMeta[]; nextCursor?: string | null; borradores?: Record<string, ResumenBorrador>; tareas?: Candidata[]; dudas?: Duda[]; cruces?: Array<{ i: number; idExistente: string | null; razon: string }>; cliente?: ClienteReunion | null; opcionesCliente?: OpcionCliente[]; borradorId?: string; usage?: unknown; error?: string }> {
  return fetch('/api/plan-fathom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
}

export function ReunionExtractModal({ labels, existentes, archivoInicial, onCrear, onAmpliar, onUsage, onClose, onAbrirBorrador, recibidos, onAbrirRecibido, catalogo }: {
  labels: Label[];
  existentes: Existente[];               // tareas abiertas del plan, para el dedup del Perro (punto 8)
  archivoInicial?: File[] | null;        // los archivos que salieron de la bandeja de importación
  onCrear: (cands: Candidata[], fuente?: Fuente) => void;
  /** Las que YA existen: en vez de crear una segunda, se le suma el contexto a la que está. */
  onAmpliar?: (items: Array<{ id: string; detalle: string; titulo: string }>, fuente?: Fuente) => void;
  onUsage?: (u: unknown) => void;
  onClose: () => void;
  /** entrar a una reunión que YA fue leída: se muestra lo que salió, no se re-analiza. */
  /** `meta` = lo que ya sabemos de la reunión, para pintar el esqueleto sin esperar. */
  onAbrirBorrador?: (recordingId: number, meta?: { titulo: string; fecha: string | null; n: number }) => void;
  /**
   * Borradores que NO salieron de una reunión tuya: te los mandó otra persona desde la
   * suya. No aparecen en la lista de Fathom (esa grabación no es de tu cuenta), así que
   * sin esta sección quedarían sin ninguna puerta desde que el modal dejó de abrirse
   * solo. Van arriba de todo, que es donde se buscan.
   */
  recibidos?: Array<{ id: string; de: string; titulo: string; n: number }>;
  onAbrirRecibido?: (id: string) => void;
  /**
   * La lista cerrada de proyectos grandes. Cuando viene, la reunión SOLO puede
   * mandar tareas a un proyecto del tablero o a uno de estos: sin esto, el modelo
   * proponía el nombre que se le ocurriera y el board lo creaba tal cual — así
   * nacieron tres proyectos de Instagram en dos semanas.
   */
  catalogo?: Array<{ nombre: string; emoji: string; que: string }>;
}) {
  const [fase, setFase] = useState<'lista' | 'extrayendo' | 'cliente' | 'validar' | 'revisar'>('lista');
  // El cliente que el server reconoció en la reunión (por el email del invitado en el
  // CRM). Si no reconoció ninguno se muestra igual, para que el dueño lo elija.
  const [cliente, setCliente] = useState<ClienteReunion | null>(null);
  const [reuniones, setReuniones] = useState<ReunionMeta[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);   // nextCursor de Fathom
  const [cargandoMas, setCargandoMas] = useState(false);
  // Qué salió ya de cada reunión, por recordingId. Lo manda el server con la lista, así
  // que no cuesta un round-trip: es lo que convierte "Extraer →" en "Ver lo que sacó →".
  const [borradores, setBorradores] = useState<Record<number, ResumenBorrador>>({});
  const [q, setQ] = useState('');                              // búsqueda por título/email
  const [desde, setDesde] = useState('');                      // filtro por fecha (YYYY-MM-DD)
  const [elegida, setElegida] = useState<ReunionMeta | null>(null);
  const [archivoNombre, setArchivoNombre] = useState(''); // nombre del archivo subido (para la fuente)
  const [archivosSubiendo, setArchivosSubiendo] = useState<string[]>([]); // qué está leyendo, para no mostrar un spinner mudo
  const [avisos, setAvisos] = useState<string[]>([]);     // los que no pudo leer (el resto igual sigue)
  const [filas, setFilas] = useState<Fila[]>([]);
  const [dudas, setDudas] = useState<Duda[]>([]);              // términos a aclarar (paso previo, punto 7)
  const [defs, setDefs] = useState<Record<number, string>>({}); // definiciones que va escribiendo el usuario
  const [err, setErr] = useState('');
  // Cuando se abre la tarjeta de una tarea encima, ESTE modal se esconde y vuelve con
  // su scroll intacto: la lista de reuniones puede tener 40 filas y volver arriba de
  // todo después de mirar una tarjeta es perder el lugar.
  const capa = useCapaModal(true);

  // Trae una página. `reset` = arranca de cero (cambió el filtro de fecha); si no,
  // agrega a lo que ya hay (botón "cargar más"). El cursor lo da Fathom.
  //
  // `reset` YA NO VACÍA LA PANTALLA si hay algo cacheado: la llamada a Fathom tarda
  // varios segundos y borrar la lista para poner un spinner hacía que abrir el botón
  // se sintiera como empezar de cero cada vez, cuando en realidad ya sabíamos casi
  // todo. Ahora se pinta lo que había y el refresco corre por atrás.
  const cargar = async (reset: boolean, silencioso = false) => {
    if (reset && !silencioso) { setReuniones(null); setCursor(null); }
    setCargandoMas(!reset || silencioso); // no limpiamos err acá: volverALista() puede querer conservar el error de un archivo que falló
    const j = await apiFathom({ action: 'reuniones', cursor: reset ? undefined : cursor ?? undefined, recordedAfter: desde || undefined });
    setCargandoMas(false);
    if (j.ok && j.reuniones) {
      setReuniones((prev) => (reset || !prev ? j.reuniones! : [...prev, ...j.reuniones!]));
      setCursor(j.nextCursor ?? null);
      if (reset) guardarCache(desde, j.reuniones!, j.nextCursor ?? null, j.borradores ?? {});
      const porId: Record<number, ResumenBorrador> = {};
      for (const [ref, v] of Object.entries(j.borradores ?? {})) {
        const n = Number(ref.replace('fathom:', ''));
        if (Number.isFinite(n)) porId[n] = v;
      }
      setBorradores((prev) => (reset ? porId : { ...prev, ...porId }));
    } else { setErr(j.error || 'No pude traer las reuniones.'); if (reset) setReuniones([]); }
  };

  // Lista de Fathom: solo si NO entró por "subir archivo" del toolbar. Recarga al
  // cambiar el filtro de fecha.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (archivoInicial) return;
    setErr('');
    // Lo que ya sabíamos se pinta AL INSTANTE y después se refresca por atrás. La lista
    // de Fathom cambia una vez por reunión, no una vez por segundo: hacerte esperar el
    // round-trip completo para volver a ver lo mismo era el costo más caro del botón.
    const cache = leerCache(desde);
    if (cache) { setReuniones(cache.reuniones); setCursor(cache.cursor); setBorradores(cache.borradores); }
    void cargar(true, !!cache);
  }, [desde]);

  // Búsqueda client-side sobre título + emails de los involucrados.
  const visibles = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n || !reuniones) return reuniones ?? [];
    return reuniones.filter((r) => (r.titulo + ' ' + r.involucrados.join(' ')).toLowerCase().includes(n));
  }, [q, reuniones]);

  const [freno, setFreno] = useState<FrenoScope>(null);   // aviso del Perro por tipo (punto 8)
  // El borrador que el server acaba de crear/encontrar para esta reunión. Con esto (a)
  // la lista queda marcada como leída sin recargar y (b) las correcciones del usuario
  // se van guardando contra esa fila, así que salir del modal ya no las tira.
  const [borradorId, setBorradorId] = useState('');

  // Anota las candidatas: reparto mío/de-otro (viene del backend), y el cruce del
  // Perro contra el plan (dedup, punto 8). Las de otro NO se tildan nunca: van a la
  // tab de esa persona y se le mandan a ella.
  // REUNIÓN CON CLIENTE → TODAS sus tareas al proyecto de ese cliente. El tema de cada
  // tarea deja de decidir dónde se archiva: eso es lo que repartía una misma llamada
  // entre proyectos temáticos inventados, y hasta metía trabajo de un cliente en el
  // proyecto de otro. Si el proyecto ya existe se REUSA (comparando sin acentos); solo
  // se crea uno cuando de verdad no hay.
  const aProyecto = (fs: Fila[], proyecto: string): Fila[] => {
    if (!proyecto) return fs;
    const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const ya = labels.find((l) => n(l.name).includes(n(proyecto)));
    return fs.map((f) => ({ ...f, proyectoId: ya?.id ?? null, proyectoNombre: ya ? undefined : proyecto }));
  };

  const procesar = async (tareas: Candidata[], dudasIn: Duda[], cliente?: ClienteReunion | null, opciones?: OpcionCliente[]) => {
    // Lo resolvió el server contra el CRM (por el email del invitado o por el nombre en
    // el título), no el modelo leyendo títulos de tareas.
    const filasNuevas: Fila[] = aProyecto(tareas.map((t) => ({ ...t, incluir: !t.esDeOtro })), cliente?.proyecto ?? '');
    setCliente(cliente ?? null);
    // Dedup contra el plan (best-effort: apiFathom nunca lanza; si el server falla, ok:false).
    const jc = await apiFathom({ action: 'cruzar', candidatas: tareas.map((t) => ({ titulo: t.titulo, detalle: t.detalle })), existentes, uso: 'Cruzar con el plan' });
    if (jc.ok && Array.isArray(jc.cruces)) {
      // `ampliar: true` es el default de una repetida: no se puede volver a cargar, se
      // le suma el contexto a la tarjeta que ya está. Sin esto la fila solo nacía
      // destildada y alcanzaba con tildarla para dejar la misma tarea dos veces.
      for (const c of jc.cruces) if (filasNuevas[c.i]) filasNuevas[c.i] = { ...filasNuevas[c.i], enriquece: { id: c.idExistente!, razon: c.razon }, incluir: false, ampliar: !!c.idExistente };
    }
    setFilas(filasNuevas); setDudas(dudasIn); setDefs({});
    // SIN CERTEZA → se pregunta, una sola vez y cerrada. Es el paso que faltaba: sin él
    // la duda se resolvía sola por el lado peor (cada tarea a donde el modelo quisiera).
    if (!cliente && opciones?.length) { setOpciones(opciones); setFase('cliente'); return; }
    // Paso previo (punto 7): si MaKo no entendió algún término, que el usuario lo aclare
    // ANTES de revisar.
    setFase(dudasIn.length > 0 ? 'validar' : 'revisar');
  };

  // La respuesta a la pregunta: se aplica a TODAS las tareas de la reunión de una.
  const [opciones, setOpciones] = useState<OpcionCliente[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const responderCliente = () => {
    if (elegido) {
      setCliente({ nombre: elegido, empresa: null, proyecto: elegido, email: '' });
      setFilas((fs) => aProyecto(fs, elegido));
    }
    setFase(dudas.length > 0 ? 'validar' : 'revisar');
  };

  const extraer = async (r: ReunionMeta, reanalizar = false) => {
    setElegida(r); setFase('extrayendo'); setErr(''); setFreno(frenoDeScope(r.tipo));
    // Los del tablero + los del catálogo que todavía no existen. El id `cat:` le dice
    // al board "este hay que crearlo, y se llama exactamente así".
    const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
    const yaEstan = new Set(labels.map((l) => norm(l.name)));
    const proyectos = [
      ...labels.map((l) => ({ id: l.id, emoji: l.emoji, nombre: l.name })),
      ...(catalogo ?? []).filter((c) => !yaEstan.has(norm(c.nombre))).map((c) => ({ id: `cat:${c.nombre}`, emoji: c.emoji, nombre: c.nombre })),
    ];
    // reanalizar: fuerza correr la IA de nuevo (ignora el cache). Sin esto, re-abrir la
    // misma reunión devuelve lo cacheado — NO cobra tokens (feedback jul-19).
    const j = await apiFathom({ action: 'extraer', recordingId: r.recordingId, titulo: r.titulo, proyectos, uso: 'Extraer tareas de reunión', reanalizar });
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && j.tareas) {
      // La lista se entera ACÁ de que esta reunión ya está leída. Antes el mapa
      // `borradores` solo se llenaba al cargar la lista (una vez, antes de extraer):
      // al volver atrás la fila seguía diciendo «Extraer →» como si no hubiera pasado
      // nada, y se leía como que la extracción no se había guardado.
      setBorradorId(j.borradorId ?? '');
      if (j.borradorId) {
        const mias = j.tareas.filter((t) => !t.esDeOtro).length;
        setBorradores((b) => ({ ...b, [r.recordingId]: { id: j.borradorId!, estado: 'pendiente', creadas: 0, pendientesMias: mias, pendientesOtros: j.tareas!.length - mias } }));
      }
      await procesar(j.tareas, j.dudas ?? [], j.cliente ?? null, j.opcionesCliente ?? []);
    } else { setErr(j.error || 'MaKo no pudo leer la reunión.'); setFase('lista'); setElegida(null); }
  };

  // Subir un archivo (md/txt/transcript) → mismo pipeline (punto 5). Los archivos NUNCA
  // auto-cargan (fuente=null): no hay clasificación, así que siempre pasan por revisión.
  const subirArchivo = async (files: File[]) => {
    if (!files.length) return;
    setElegida(null);
    setArchivoNombre(files.length === 1 ? files[0].name : `${files.length} archivos`);
    setArchivosSubiendo(files.map((f) => f.name));
    setFase('extrayendo'); setErr(''); setFreno(null); setAvisos([]);
    const fd = new FormData();
    // MISMA clave repetida: del otro lado se lee con form.getAll('file').
    for (const f of files) fd.append('file', f);
    fd.append('proyectos', JSON.stringify(labels.map((l) => ({ id: l.id, emoji: l.emoji, nombre: l.name }))));
    // TIMEOUT EXPLÍCITO. Sin esto el spinner giraba PARA SIEMPRE: leer un archivo de
    // 6 KB tarda ~2 minutos y la respuesta HTTP no siempre sobrevive tanto, así que el
    // fetch quedaba colgado sin resolver ni rechazar. 4 minutos es el techo real de la
    // función (maxDuration 300) con margen.
    const j = await fetch('/api/plan-fathom', { method: 'POST', body: fd, signal: AbortSignal.timeout(240_000) })
      .then((r) => r.json())
      .catch((e) => ({ ok: false, error: e instanceof Error && e.name === 'TimeoutError'
        // El trabajo NO se perdió: el server guarda el borrador antes de responder.
        ? 'Tardó más de lo que la conexión aguanta. MaKo igual lo terminó: cerrá y volvé a entrar, el borrador te está esperando en la lista.'
        : String(e) }));
    if (j.usage) onUsage?.(j.usage);
    if (j.borradorId) setBorradorId(String(j.borradorId));
    // Los que no se pudieron leer se dicen, aunque el resto haya salido bien.
    if (Array.isArray(j.avisos) && j.avisos.length) setAvisos(j.avisos.map(String));
    if (j.ok && j.tareas) await procesar(j.tareas, j.dudas ?? [], j.cliente ?? null, j.opcionesCliente ?? []);
    // Falló todo: mostramos el error y volvemos a la lista (que se carga sola, porque
    // el modo-archivo la había salteado) para que el usuario no quede colgado.
    else { setErr(j.error || 'No pude leer los archivos.'); volverALista(); }
  };

  // Mount: si entró por la bandeja de importación, procesarlos directo.
  useEffect(() => {
    if (archivoInicial?.length) void subirArchivo(archivoInicial);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // AUTOSAVE de la revisión. Todo lo que el usuario corrige acá —el título, el detalle,
  // «no es mía», destildar— vivía SOLO en `filas`, y volverALista() hace setFilas([]).
  // O sea: se perdía entero al mirar otra reunión. Ahora se guarda contra el borrador
  // (mismo camino que ya usa el modal de tareas recibidas), con 900 ms de espera para
  // no escribir en cada tecla.
  useEffect(() => {
    if (!borradorId || fase !== 'revisar' || !filas.length) return;
    const t = setTimeout(() => {
      void fetch('/api/plan-propuesta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'guardar', id: borradorId,
          tareas: filas.map((f) => ({
            titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad,
            proyecto: labels.find((l) => l.id === f.proyectoId)?.name ?? f.proyectoNombre,
            dueno: f.dueño, duenoEmail: f.dueñoEmail, esDeOtro: f.esDeOtro,
            minuto: f.minuto, minutos: f.minutos, incluir: f.incluir,
          })),
        }),
      }).catch(() => {});
    }, 900);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filas, borradorId, fase]);

  // Guarda las definiciones que el usuario escribió (glosario) y pasa a la revisión.
  // Cuando hubo dudas NO auto-cargamos: había ambigüedad, mejor que las mire.
  const [guardandoDudas, setGuardandoDudas] = useState(false);
  const guardarDudasYSeguir = async () => {
    setGuardandoDudas(true);
    await Promise.all(dudas.map((d, i) => {
      const def = (defs[i] ?? '').trim();
      return def ? apiFathom({ action: 'glosario-guardar', termino: d.termino, definicion: def }) : Promise.resolve();
    }));
    setGuardandoDudas(false); setDudas([]); setFase('revisar');
  };

  // Solo MIS tareas tildadas: una tarea de otra persona jamás entra a mi plan.
  const esAmpliar = (f: Fila): boolean => !!f.enriquece?.id && f.ampliar !== false && !f.esDeOtro;
  const nIncluidas = useMemo(() => filas.filter((f) => f.incluir && !f.esDeOtro && !esAmpliar(f)).length, [filas]);
  const nAmpliar = useMemo(() => filas.filter(esAmpliar).length, [filas]);
  const hayMias = useMemo(() => filas.some((f) => !f.esDeOtro), [filas]);

  const confirmar = () => {
    // fuente: la reunión de Fathom (con link) o el archivo subido (feedback jul-19).
    const fuente: Fuente | undefined = elegida ? { tipo: 'fathom', etiqueta: elegida.titulo, url: elegida.url ?? undefined }
      : archivoNombre ? { tipo: 'archivo', etiqueta: archivoNombre }
        : undefined;
    // Dos destinos, un solo click: lo nuevo se crea y lo repetido AMPLÍA la tarjeta que
    // ya está. Antes lo repetido solo se descartaba y el contexto de esa reunión —los
    // números y las frases que se dijeron— se perdía entero.
    const ampliar = filas.filter(esAmpliar).map((f) => ({ id: f.enriquece!.id, detalle: f.detalle ?? '', titulo: f.titulo }));
    if (ampliar.length && onAmpliar) onAmpliar(ampliar, fuente);
    onCrear(filas.filter((f) => f.incluir && !f.esDeOtro && !esAmpliar(f)).map(({ incluir: _i, enriquece: _e, ampliar: _a, ...c }) => c), fuente);
    onClose();
  };
  const setFila = (i: number, patch: Partial<Fila>) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  // Volver a la lista de reuniones de Fathom. Si nunca se cargó (entramos por "subir
  // archivo", que la saltea), la trae ahora: si no, quedaría un spinner falso eterno.
  const volverALista = () => {
    setFase('lista'); setElegida(null); setFilas([]); setFreno(null); setDudas([]); setOpciones([]); setElegido(null); setCliente(null); setBorradorId('');
    if (reuniones == null && !cargandoMas) void cargar(true);
  };

  // LA PREGUNTA, cuando no hubo certeza. Una sola, cerrada y con lo que YA existe: la
  // regla es no inventar proyectos, así que acá no hay campo para escribir un nombre
  // nuevo. Mismo chrome que el resto de los cuestionarios de la app (WizardShell).
  // Cerrar o Atrás devuelven a la lista de reuniones, no cierran todo (regla de UX).
  if (fase === 'cliente') {
    const nMias = filas.filter((f) => !f.esDeOtro).length;
    return (
      <WizardShell
        titulo={[elegida?.titulo ?? archivoNombre, `${nMias} ${nMias === 1 ? 'tarea' : 'tareas'}`].filter(Boolean).join(' · ')}
        total={1} idx={0}
        pregunta="¿De qué cliente es esta reunión?"
        sub="Van todas a su proyecto. Prefiero preguntarte una vez antes que repartirlas por tema y ensuciar dos clientes."
        puedeAvanzar={elegido !== null}
        enUltimo confirmLabel="Seguir →"
        atrasLabel="← Otra reunión"
        onAtras={volverALista} onSiguiente={responderCliente}
        onConfirmar={responderCliente} onClose={volverALista}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[...opciones, { nombre: '', sub: 'Las dejo donde MaKo propuso' }].map((op) => {
            const on = elegido === op.nombre;
            return (
              <button key={op.nombre || '__ninguno'} type="button" onClick={() => setElegido(on ? null : op.nombre)}
                style={{ width: '100%', padding: '12px 15px', borderRadius: 12, textAlign: 'left', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', transition: 'border-color .12s, background .12s', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface-2)', color: on ? 'var(--primary)' : 'var(--ink)' }}>
                <span style={{ width: 18, height: 18, flex: 'none', borderRadius: '50%', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: on ? 700 : 600 }}>{op.nombre || 'No es de un cliente'}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{op.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </WizardShell>
    );
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: capa.z, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: capa.visible ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      {/* ALTO FIJO, no «hasta 86vh». Con maxHeight el modal se estiraba y se encogía
          solo: la lista con 8 reuniones era chiquita, con 40 llenaba la pantalla, y al
          pasar a la revisión pegaba un salto. Un contenedor que cambia de tamaño según
          lo que tiene adentro obliga a reubicarse en cada paso. Ahora la caja mide
          siempre lo mismo y lo que scrollea es el cuerpo. */}
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, height: 'min(86vh, 760px)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={34} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · REUNIÓN → PLAN</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>
              {/* El título dice lo que está pasando DE VERDAD: decir «Leyendo la reunión»
                  mientras alguien sube un .md es mentirle sobre lo que la app está haciendo. */}
              {fase === 'lista' ? 'Elegí una reunión'
                : fase === 'extrayendo' ? (archivosSubiendo.length ? (archivosSubiendo.length > 1 ? `Leyendo ${archivosSubiendo.length} archivos…` : 'Leyendo tu archivo…') : 'Leyendo la reunión…')
                : fase === 'validar' ? 'Antes de seguir, aclarame esto'
                : `Tareas · ${(elegida?.titulo ?? archivoNombre).slice(0, 40)}`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* cuerpo */}
        <div ref={capa.refScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px' }}>
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>{err}</div>}

          {/* lista de reuniones */}
          {fase === 'lista' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Subir archivo YA NO vive acá: es un botón aparte del toolbar (punto 7). */}
              {/* búsqueda + filtro por fecha (punto 9) */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título o email…"
                  style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS }} />
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde esta fecha"
                  style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: desde ? 'var(--ink)' : 'var(--faint)', fontSize: 13, outline: 'none', fontFamily: SANS }} />
                {desde && <button type="button" onClick={() => setDesde('')} title="Quitar el filtro de fecha" style={{ padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>}
              </div>

              {!!recibidos?.length && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>Te mandaron tareas</div>
                  {recibidos.map((r) => (
                    <button key={r.id} type="button" onClick={() => onAbrirRecibido?.(r.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--primary)', background: 'var(--primary-bg)', color: 'var(--ink)', cursor: 'pointer', fontFamily: SANS }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{r.de ? `Te las mandó ${r.de}` : 'Para confirmar'}</span>
                      </span>
                      <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: '#fff', background: 'var(--primary)', fontFamily: MONO }}>{r.n} esperando</span>
                      <span style={{ flex: 'none', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Confirmar →</span>
                    </button>
                  ))}
                </div>
              )}

              {reuniones == null
                ? <Cargando texto="Buscando tus reuniones en Fathom…" />
                : visibles.length === 0
                  // NADA COINCIDE — pero eso NO quiere decir que no exista. La búsqueda es
                  // local sobre lo que ya se trajo, así que la reunión que buscás puede
                  // estar más atrás en Fathom. El botón tiene que estar acá: sin él, buscar
                  // «Leila» y no verla se leía como «no existe», cuando era «todavía no la
                  // traje». Recién cuando Fathom deja de devolver cursor se dice que no hay.
                  ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <Vacio texto={q ? `Ninguna de las reuniones que traje coincide con «${q.slice(0, 24)}».` : desde ? 'Ninguna reunión coincide con el filtro.' : 'No encontré reuniones recientes en Fathom.'} />
                      {cursor ? (
                        <button type="button" onClick={() => void cargar(false)} disabled={cargandoMas}
                          style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: cargandoMas ? 'default' : 'pointer', fontFamily: SANS }}>
                          {cargandoMas ? 'Buscando…' : q ? 'Buscar más atrás' : 'Traer más reuniones'}
                        </button>
                      ) : (
                        <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>
                          {q ? `Ya miré todas tus reuniones de Fathom y ninguna coincide con «${q.slice(0, 24)}».` : 'Esas son todas las reuniones que tenés en Fathom.'}
                        </div>
                      )}
                    </div>
                  : <>
                      {visibles.map((r) => {
                        const t = TIPO_REUNION_UI[r.tipo];
                        // Reunión ya leída: NO se vuelve a extraer (sería pagar de nuevo por
                        // lo mismo). Se entra a ver lo que salió: las tarjetas que ya están
                        // en el plan y lo que quedó del lado de otras personas.
                        const b = borradores[r.recordingId];
                        const yaLeida = !!b && !!onAbrirBorrador;
                        // Cuántas de esa reunión YA ESTÁN en el plan. Se dice siempre que
                        // haya alguna: antes solo salía si el borrador seguía vivo, así que
                        // una reunión con 32 tareas cargadas se veía igual que una que nunca
                        // se tocó y había que entrar para enterarse.
                        const yaEnPlan = b?.creadas ?? 0;
                        // Las TUYAS y las de OTROS son dos cosas distintas y el server ya las
                        // manda separadas: sumarlas acá era lo que hacía decir «13 esperando»
                        // cuando esas 13 son compromisos de otra persona y a vos no te espera nada.
                        const mias = b?.pendientesMias ?? 0;
                        const otras = b?.pendientesOtros ?? 0;
                        // El estado del borrador manda sobre el CTA. Una reunión ya leída
                        // NUNCA vuelve a decir «Extraer →»: aunque la hayas descartado o
                        // cargado entera, lo que salió de esa charla sigue estando y se
                        // puede volver a mirar.
                        const cerrada = b?.estado === 'aplicada' || b?.estado === 'descartada';
                        return (
                          <button key={r.recordingId} type="button" onClick={() => (yaLeida ? onAbrirBorrador!(r.recordingId, { titulo: r.titulo, fecha: r.fecha, n: yaEnPlan + (b?.pendientesMias ?? 0) + (b?.pendientesOtros ?? 0) }) : extraer(r))}
                            // Sin leer = APAGADA. Lo que MaKo ya miró tiene que saltar a la
                            // vista; lo que todavía no, se ve pero no compite. Una lista donde
                            // todo pesa igual obliga a leer los 40 títulos.
                            style={{ display: 'flex', alignItems: 'stretch', gap: 12, textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontFamily: SANS, opacity: yaLeida ? 1 : 0.62 }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.opacity = yaLeida ? '1' : '0.62'; }}>
                            {/* logo de Fathom (punto 6): son grabaciones de Fathom, no un micrófono genérico */}
                            <span style={{ flex: 'none', marginTop: 1 }}><SvcIcon k="fathom" size={17} box={28} radius={8} /></span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</span>
                                {/* CUÁNTAS esperan, en número y a la vista. El botón de
                                    Fathom ya no te encierra en el borrador pendiente, así
                                    que la lista tiene que decir de un vistazo cuál es la
                                    reunión que te está esperando y con cuántas. */}
                                {/* Solo el chip de lo que TE espera. El de «N de otros» se
                                    fue: la línea de abajo ya dice «· N de otras personas»,
                                    así que era el mismo dato dos veces en la misma fila. */}
                                {mias > 0 && (
                                  <span title={`${mias} tuya${mias === 1 ? '' : 's'} sin cargar${otras ? ` · y ${otras} de otras personas` : ''}`}
                                    style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: '#fff', background: 'var(--primary)', fontFamily: MONO }}>
                                    {mias} sin cargar
                                  </span>
                                )}
                                {/* El tipo se muestra SOLO cuando dice algo. «Equipo» es el
                                    default de la clasificación, así que aparecía en TODAS las
                                    reuniones y por lo tanto no distinguía ninguna: un chip que
                                    está siempre es ruido, no información. Quedan los dos que sí
                                    cambian la lectura: Ventas y Entrega. */}
                                {(r.tipo === 'ventas' || r.tipo === 'entrega') && (
                                  <span title={`Clasificada como ${t.label} por los emails de los invitados`} style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: `var(--${t.tono})`, background: `var(--${t.tono}-bg, var(--surface-2))`, border: `1px solid var(--${t.tono})` }}>{t.label}</span>
                                )}
                              </span>
                              <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{fmtFecha(r.fecha)}{r.durMin ? ` · ${r.durMin} min` : ''}</span>
                              {r.involucrados.length > 0 && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>👤 {r.involucrados.join(', ')}</span>}
                              {b && (
                                <span style={{ display: 'block', fontSize: 11.5, color: b.estado === 'descartada' ? 'var(--faint)' : yaEnPlan > 0 ? 'var(--good)' : 'var(--dim)', fontWeight: 600, marginTop: 3 }}>
                                  {/* Si de esta reunión salió aunque sea UNA tarea al plan, eso
                                      es lo que se dice — aunque el borrador figure descartado.
                                      «La descartaste» sobre una reunión que te dejó 31 tareas
                                      es falso: lo descartado es lo que quedaba, no la reunión. */}
                                  {yaEnPlan > 0
                                    ? `✓ Cargaste ${yaEnPlan} ${yaEnPlan === 1 ? 'tarea' : 'tareas'} al plan`
                                    : b.estado === 'descartada' ? '· la descartaste' : '✓ MaKo ya la leyó'}
                                  {b.estado !== 'descartada' && b.pendientesMias > 0 && <span style={{ color: 'var(--primary)', fontWeight: 600 }}> · {b.pendientesMias} sin cargar</span>}
                                  {b.estado !== 'descartada' && b.pendientesOtros > 0 && <span style={{ color: 'var(--dim)', fontWeight: 500 }}> · {b.pendientesOtros} de otras personas</span>}
                                </span>
                              )}
                            </span>
                            {/* DOS estados y nada más: o MaKo ya la leyó (entrás a ver lo que
                                sacó) o no (la extrae). «Confirmar» y «Repartir» prometían
                                acciones distintas y llevaban a la MISMA pantalla — y
                                «Repartir» encima salía en reuniones donde no había nadie a
                                quien repartirle. Va abajo, alineado con la última línea, para
                                que arriba queden solo los chips. */}
                            <span style={{ display: 'flex', alignItems: 'flex-end', flex: 'none' }}>
                              <span style={{ fontSize: 13, color: yaLeida ? 'var(--primary)' : 'var(--dim)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {yaLeida ? 'Ver lo que sacó →' : 'Extraer →'}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      {/* «Cargar más» NO desaparece al buscar. La búsqueda es LOCAL sobre lo
                          que ya se trajo, así que esconderlo mientras buscás es esconder la
                          única forma de encontrar una reunión más vieja: escribías «Leila»,
                          no salía, y no quedaba manera de seguir buscando hacia atrás. */}
                      {cursor && (
                        <button type="button" onClick={() => void cargar(false)} disabled={cargandoMas}
                          style={{ alignSelf: 'center', marginTop: 4, padding: '8px 18px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: cargandoMas ? 'default' : 'pointer', fontFamily: SANS }}>
                          {cargandoMas ? 'Cargando…' : q ? `Buscar «${q.slice(0, 18)}» más atrás` : 'Cargar más reuniones'}
                        </button>
                      )}
                      {/* Fathom ya no tiene más para dar: decirlo, para que buscar algo que
                          no está no se sienta como que el botón dejó de funcionar. */}
                      {!cursor && (reuniones?.length ?? 0) > 0 && (
                        <div style={{ alignSelf: 'center', marginTop: 4, fontSize: 12.5, color: 'var(--faint)' }}>
                          {q ? `No hay más reuniones con «${q.slice(0, 20)}» en Fathom.` : 'Esas son todas las reuniones que tenés en Fathom.'}
                        </div>
                      )}
                    </>}
            </div>
          )}

          {/* extrayendo */}
          {fase === 'extrayendo' && (
            <div>
              <Cargando texto={archivosSubiendo.length
                ? (archivosSubiendo.length > 1 ? `MaKo está leyendo ${archivosSubiendo.length} archivos y sacando las tareas…` : 'MaKo está leyendo tu archivo y sacando las tareas…')
                : 'MaKo está sacando los action items de la reunión…'} grande />
              {/* Un spinner sin nombre no dice si se colgó o si está trabajando. Con la
                  lista, se ve qué entró — y sobre todo qué NO entró, si faltó alguno. */}
              {archivosSubiendo.length > 0 && (
                <div style={{ maxWidth: 460, margin: '14px auto 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {archivosSubiendo.map((n) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--primary)', flex: 'none', animation: 'makoPulso 1.4s ease-in-out infinite' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>
                    </div>
                  ))}
                  <style>{'@keyframes makoPulso{0%,100%{opacity:.25}50%{opacity:1}}'}</style>
                  {/* Decirlo ANTES de que se haga largo, no después: un archivo denso son
                      dos minutos, y sin este renglón parece que se colgó. */}
                  <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', marginTop: 6, lineHeight: 1.5 }}>
                    Puede tardar un par de minutos. Si cerrás, MaKo lo termina igual y te deja el borrador en la lista.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* paso previo (punto 7): MaKo pregunta por lo que no entendió → glosario */}
          {fase === 'validar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)' }}>
                <GuardianIcon size={26} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>MaKo ya sacó las tareas, pero hay términos que no tiene claros.</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.5 }}>Aclaralos y quedan guardados en el glosario del negocio: la próxima reunión ya los entiende sin preguntar.</div>
                </div>
              </div>
              {dudas.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>¿Qué es <span style={{ color: 'var(--accent)' }}>{d.termino}</span>?</div>
                  {d.porque && <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.45, fontStyle: 'italic' }}>{d.porque}</div>}
                  <input value={defs[i] ?? ''} onChange={(e) => setDefs((s) => ({ ...s, [i]: e.target.value }))} placeholder={`Definí "${d.termino}" en una frase…`}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS }} />
                </div>
              ))}
            </div>
          )}

          {/* revisar candidatos */}
          {/* Lo que NO se pudo leer se dice acá arriba, con nombre y motivo. Tragarse
              un archivo fallado y mostrar igual el resultado es peor que no importar:
              el usuario cree que lo que ve es todo lo que subió. */}
          {fase === 'revisar' && avisos.length > 0 && (
            <div style={{ marginBottom: 12, padding: '10px 13px', borderRadius: 11, border: '1px solid color-mix(in srgb, #C8870C 35%, var(--border))', background: 'color-mix(in srgb, #C8870C 8%, transparent)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                {avisos.length === 1 ? 'Un archivo quedó afuera' : `${avisos.length} archivos quedaron afuera`}
              </div>
              {avisos.map((a, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>· {a}</div>)}
            </div>
          )}
          {fase === 'revisar' && (
            filas.length === 0
              ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <Vacio texto="MaKo no encontró action items concretos en esta reunión." />
                  {elegida && <button type="button" onClick={() => extraer(elegida, true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                    ↻ Volver a analizar (gasta tokens)</button>}
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* A QUÉ CLIENTE va todo. Se dice arriba y una sola vez, no tarjeta por
                      tarjeta: la decisión es de la REUNIÓN. Si MaKo no lo reconoció, se
                      dice también — y el dueño reasigna con el selector de cada fila. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 11, border: `1px solid ${cliente ? 'var(--good)' : 'var(--border-strong)'}`, background: cliente ? 'var(--good-bg, var(--surface-2))' : 'var(--surface-2)' }}>
                    <span style={{ fontSize: 15, flex: 'none' }}>{cliente ? '🤝' : '📁'}</span>
                    <div style={{ minWidth: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                      {cliente
                        ? <>Es una reunión con <b style={{ color: 'var(--ink)' }}>{cliente.nombre}</b>: todas estas tareas van a <b style={{ color: 'var(--ink)' }}>«{cliente.proyecto}»</b>.{' '}<span style={{ color: 'var(--faint)' }}>Si alguna no es de este cliente, cambiásela abajo.</span></>
                        : <>No es de un cliente: <b style={{ color: 'var(--ink)' }}>las dejo donde MaKo propuso</b>. Si alguna sí lo es, elegí su proyecto abajo.</>}
                    </div>
                  </div>
                  {/* Freno del Perro por tipo de reunión (punto 8): ventas/entrega no son del plan */}
                  {freno && (
                    <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--warn)', background: 'var(--warn-bg, var(--surface-2))' }}>
                      <GuardianIcon size={26} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>🐕 {freno.titulo}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.5 }}>{freno.detalle}</div>
                      </div>
                    </div>
                  )}
                  <ReunionTareas
                    filas={filas}
                    labels={labels}
                    onFila={setFila}
                    reunion={{ recordingId: elegida?.recordingId, titulo: elegida?.titulo ?? archivoNombre, fecha: elegida?.fecha ?? null, url: elegida?.url ?? null }}
                    cabecera="Elegí cuáles agregar a TU plan. El perro les pone la prioridad final."
                  />
                </div>
          )}
        </div>

        {/* footer — paso previo (glosario): guardar y seguir / saltear */}
        {fase === 'validar' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setDudas([]); setFase('revisar'); }} style={ghostBtn} disabled={guardandoDudas}>Saltear</button>
            <button type="button" onClick={() => void guardarDudasYSeguir()} disabled={guardandoDudas}
              style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardandoDudas ? 'default' : 'pointer', fontFamily: SANS, opacity: guardandoDudas ? 0.7 : 1 }}>
              {guardandoDudas ? 'Guardando…' : 'Guardar y seguir →'}
            </button>
          </div>
        )}

        {/* footer */}
        {fase === 'revisar' && filas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {/* Las reuniones nuevas del equipo ya se leen SOLAS (cron): esto es para las
                viejas o para re-analizar. Por eso acá no hay ningún opt-in que activar. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={volverALista} style={ghostBtn}>← Otra reunión</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Si NADA de la reunión es tuyo, el botón de cargar no tiene sentido:
                    lo único que queda es mandarle a cada uno lo suyo desde su tab. */}
                {hayMias
                  ? <button type="button" onClick={confirmar} disabled={nIncluidas + nAmpliar === 0}
                      style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: nIncluidas + nAmpliar ? 'var(--primary)' : 'var(--border)', color: nIncluidas + nAmpliar ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: nIncluidas + nAmpliar ? 'pointer' : 'default', fontFamily: SANS }}>
                      {/* El botón dice las DOS cosas que va a hacer: si solo hay repetidas,
                          decir "Agregar 0 al plan" sería mentir sobre lo que pasa al tocarlo. */}
                      {nIncluidas && nAmpliar ? `Agregar ${nIncluidas} y ampliar ${nAmpliar} →`
                        : nIncluidas ? `Agregar ${nIncluidas} al plan →`
                          : nAmpliar ? `Ampliar ${nAmpliar} que ya ${nAmpliar === 1 ? 'está' : 'están'} →`
                            : 'Elegí al menos una'}
                    </button>
                  : <button type="button" onClick={onClose}
                      style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                      Listo
                    </button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Cargando({ texto, grande }: { texto: string; grande?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: grande ? '46px 0' : '30px 0', color: 'var(--dim)', textAlign: 'center' }}>
      {grande && <GuardianIcon size={48} />}
      <Spinner />
      <div style={{ fontSize: 13.5 }}>{texto}</div>
    </div>
  );
}
function Vacio({ texto }: { texto: string }) {
  return <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 14, lineHeight: 1.5 }}>{texto}</div>;
}
function Spinner() {
  return (
    <>
      <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid var(--border-strong)', borderTopColor: 'var(--primary)', display: 'inline-block', animation: 'makoSpin 0.7s linear infinite' }} />
      <style>{'@keyframes makoSpin{to{transform:rotate(360deg)}}'}</style>
    </>
  );
}

const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
