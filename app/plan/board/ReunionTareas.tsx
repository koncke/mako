'use client';

// =============================================================================
// ReunionTareas — el reparto: MIS tareas en una tab, las de cada persona en la suya
// =============================================================================
// De una reunión salen compromisos de varios. Antes entraban todos a la misma lista
// (destildados, pero cargables) y las de otro terminaban en tu tablero. Ahora:
//
//   · Tab "Mías"  → lo único que se puede cargar a TU plan (las de otro ni aparecen).
//   · Tab por persona → sus tareas + qué hacer con ellas: bajarlas (.md), MANDÁRSELAS
//     por WhatsApp y mail, y —si tiene cuenta en la app— dejárselas en SU plan para
//     que las confirme ("Martín te envió estas tareas…").
//
// Lo comparten la extracción manual (ReunionExtractModal) y el modal de confirmación
// de un borrador pendiente (TareasRecibidasModal), así el reparto es el mismo venga
// de donde venga.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { SvcIcon } from '../../_components/ServicioVisual';
import { type Label, type Prio } from './types';
import { DetalleDoc } from './DetalleDoc';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type CandidataTarea = {
  titulo: string; detalle: string; prioridad: Prio; proyectoId: string | null;
  /** Proyecto que propuso MaKo y que TODAVÍA NO EXISTE en el tablero. Sin esto, al
   *  mandarle las tareas a otra persona el nombre se perdía y le llegaban sueltas. */
  proyectoNombre?: string;
  dueño?: string; dueñoEmail?: string; esDeOtro?: boolean;
  /** segundo de la grabación donde se dijo — para ir a escuchar ese momento. */
  minuto?: number;
  /** todos los momentos en que se habló de esto (la misma tarea vuelve en la charla). */
  minutos?: number[];
};

/** Los momentos de una tarea, siempre como lista (compat con el campo viejo). */
const momentosDe = (f: { minuto?: number; minutos?: number[] }): number[] =>
  f.minutos?.length ? f.minutos : (f.minuto != null ? [f.minuto] : []);

/** 4530 → "1:15:30" (o "12:34" si no llega a la hora). */
function relojDe(seg?: number): string {
  if (seg == null || !Number.isFinite(seg) || seg < 0) return '';
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = Math.floor(seg % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
/** El link a la grabación PARADO en ese segundo (Fathom acepta ?timestamp=). */
function urlEnMinuto(url?: string | null, seg?: number): string | null {
  if (!url) return null;
  if (seg == null) return url;
  return `${url}${url.includes('?') ? '&' : '?'}timestamp=${seg}`;
}
export type ReunionRefUI = { recordingId?: number; titulo: string; fecha?: string | null; url?: string | null };
// `reunion` viaja EN LA FILA: cuando MaKo dejó varias reuniones esperando, la misma
// pantalla mezcla tareas de todas y cada una tiene que saber de cuál salió (para
// agruparlas, fecharlas y, si son de otra persona, mandárselas con el candado de ESA
// grabación). Si falta, se usa la reunión única que pasa el modal de extracción.
// `ampliar` solo existe si `enriquece`: la tarea YA está en el plan y lo que se hace es
// sumarle contexto a esa tarjeta, no crear una segunda. Arranca en true (el pedido es
// que una repetida no se pueda volver a cargar) y solo se apaga si el dueño dice
// explícitamente "no es la misma" — el cruce puede equivocarse y ahí perder la tarea
// sería peor que duplicarla.
/** `faltante` = el borrador la da por cargada pero en el tablero no está (la borraron,
 *  o la creación falló después de que el borrador ya la anotara). Se muestra ARRIBA de
 *  todo y con la MISMA fila que el resto —con «no es mía» y «corregir contexto»—, porque
 *  es una candidata más: lo único distinto es por qué llegó hasta acá. */
export type FilaTarea = CandidataTarea & { incluir: boolean; enriquece?: { id: string; razon: string; confianza?: 'alta' | 'media' }; ampliar?: boolean; reunion?: ReunionRefUI; faltante?: boolean;
  /** el borrador se descartó: la fila queda TACHADA en vez de desaparecer. Que una tarea
   *  que se decidió no hacer se borre de la pantalla es peor que verla: al volver a la
   *  reunión no se entiende qué se hizo con cada cosa. */
  descartada?: boolean };

type Destinatario = {
  email: string; nombre: string; registrado: boolean;
  workspaceId: number | null; telefono: string; puedeCargarPlan: boolean;
  /** sos VOS mirando el tablero de otro: el destino es tu propio plan, no un reparto. */
  esVos?: boolean;
};

export const banda = (p: Prio): string => (p === 'alta' ? '#D0504A' : p === 'media' ? '#C8870C' : p === 'baja' ? '#1E9E57' : '#98A0AC');

/** Alguien a quien se le puede pasar una tarea (de la reunión, o cargado a mano). */
export type PersonaRef = { nombre: string; email: string };

/** Opción clickeable del selector de dueño (esas SÍ son cajitas: son opciones). */
const chip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)',
  fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1.6,
};

// Acciones de fila: TEXTO, no botones con caja. En una lista de 80 tareas, 160 cajitas
// son ruido; el subrayado al pasar el mouse alcanza para que se lean como accionables.
const btnChico: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0,
  border: 'none', background: 'transparent', color: 'var(--faint)',
  fontFamily: MONO, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', lineHeight: 1.6,
};

/**
 * "¿De quién es esta tarea?" — el paso que faltaba. Antes "no es mía" la mandaba a una
 * tab inventada con el nombre que hubiera adivinado la IA (llegó a crear una tab
 * "Martin Carballo", o sea el propio dueño del tablero). Ahora se elige a quién va:
 * alguien de la reunión, vos mismo, o una persona nueva que cargás en el momento.
 */
function ElegirDueño({ personas, actual, esMiaHoy, onElegir, onCancelar }: {
  personas: PersonaRef[];
  /** email/nombre del dueño actual, para no ofrecerlo de nuevo. */
  actual: string;
  esMiaHoy: boolean;
  onElegir: (p: PersonaRef | null) => void;   // null = "es mía"
  onCancelar: () => void;
}) {
  const [nueva, setNueva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const otros = personas.filter((p) => (p.email || p.nombre).toLowerCase() !== actual.toLowerCase());
  return (
    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>¿De quién es esta tarea?</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {!esMiaHoy && <button type="button" onClick={() => onElegir(null)} style={{ ...chip, borderColor: 'var(--primary)', color: 'var(--primary)' }}>Es mía</button>}
        {otros.map((p) => (
          <button key={p.email || p.nombre} type="button" onClick={() => onElegir(p)} style={chip} title={p.email || undefined}>{p.nombre || p.email}</button>
        ))}
        <button type="button" onClick={() => setNueva((v) => !v)} style={{ ...chip, borderStyle: 'dashed' }}>+ otra persona</button>
        <button type="button" onClick={onCancelar} style={{ ...chip, border: 'none', background: 'transparent' }}>cancelar</button>
      </div>
      {nueva && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre"
            style={{ flex: '1 1 120px', minWidth: 110, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', fontFamily: SANS }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (para poder mandársela)"
            style={{ flex: '2 1 170px', minWidth: 150, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', fontFamily: SANS }} />
          <button type="button" disabled={!nombre.trim() && !email.trim()}
            onClick={() => onElegir({ nombre: nombre.trim() || email.trim().split('@')[0], email: email.trim().toLowerCase() })}
            style={{ ...chip, borderColor: 'var(--primary)', color: 'var(--primary)', opacity: (!nombre.trim() && !email.trim()) ? 0.5 : 1 }}>Asignar</button>
        </div>
      )}
    </div>
  );
}

const KEY_SIN_DUEÑO = '__otros__';
/**
 * Identidad de la persona para agrupar. Si hay email, ese manda. Si no, el PRIMER
 * NOMBRE normalizado: el modelo escribe a la misma persona de dos formas según el
 * tramo ("Francisco Di Giorno" y "Francisco Hugo Di Giorno") y con el nombre completo
 * salían dos tabs de una tarea cada una. Juntar de más a dos personas con el mismo
 * primer nombre en una misma reunión es raro; partir a una en dos, pasa siempre.
 */
const personaDe = (f: FilaTarea): string => {
  const email = (f.dueñoEmail || '').trim().toLowerCase();
  if (email) return email;
  const nombre = (f.dueño || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return nombre ? nombre.split(/\s+/)[0] : KEY_SIN_DUEÑO;
};
// La tab es de PERSONA × REUNIÓN, no solo de persona: los botones "Enviar" y "Cargar
// en el plan de X" validan contra los participantes de UNA grabación, así que mezclar
// dos reuniones en la misma tab mandaría tareas bajo la reunión equivocada.
const claveDe = (f: FilaTarea, rid?: number): string => `${rid ?? f.reunion?.recordingId ?? 0}|${personaDe(f)}`;

/** Versión corta para la tab: "28 jul 22:58". Con dos reuniones el MISMO día, poner
 *  solo la fecha deja dos tabs con el mismo nombre — la hora es lo que las distingue. */
function cuandoCorto(iso?: string | null): string {
  const largo = cuandoFue(iso);
  return largo ? largo.replace(/^\S+\s/, '').replace(' · ', ' ') : '';
}

/** "mié 28 jul · 15:30" en la zona del que mira (su navegador, que es la correcta acá). */
function cuandoFue(iso?: string | null): string {
  if (!iso) return '';
  try {
    const p = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
    if (!g('day')) return '';
    return `${g('weekday').replace('.', '')} ${g('day')} ${g('month').replace('.', '')} · ${g('hour')}:${g('minute')}`;
  } catch { return ''; }
}

async function apiReunion(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok: boolean; error?: string }> {
  return fetch('/api/plan-reunion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

function descargarMd(nombre: string, filas: FilaTarea[], reunion: ReunionRefUI) {
  const md = [
    `# Tareas de la reunión${reunion.titulo ? ` — ${reunion.titulo}` : ''}`,
    nombre ? `\nPara: **${nombre}**` : '',
    '',
    ...filas.map((f) => `- [ ] **${f.titulo}**${f.detalle ? `\n  ${f.detalle}` : ''}`),
  ].filter((l) => l !== '').join('\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tareas-${(nombre || 'reunion').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Una tarea de esta reunión que YA está en el plan (se cargó en una pasada anterior). */
export type TareaYaCargada = { titulo: string; tareaId: string; minutos?: number[]; url?: string | null };

export function ReunionTareas({ filas, labels, reunion, onFila, cabecera, yaCargadas = [], onAbrirTarea, renderTaskCard, delTablero }: {
  filas: FilaTarea[];
  labels: Label[];
  /** reunión por defecto, para cuando las filas no traen la suya (extracción manual). */
  reunion: ReunionRefUI;
  onFila: (i: number, patch: Partial<FilaTarea>) => void;
  /** texto que va arriba de la lista de MIS tareas. */
  cabecera?: string;
  /** ya están en el plan: se muestran igual, pero como tarjeta real (no se re-cargan). */
  yaCargadas?: TareaYaCargada[];
  /** abrir el detalle de una tarea ya creada. */
  onAbrirTarea?: (id: string) => void;
  /**
   * La tarjeta REAL del board para una tarea ya creada. Es una render prop y no un
   * import de CardTile a propósito: esa tarjeta vive dentro del BoardShell y necesita
   * el `board` entero, que esta pantalla no tiene (la comparte con la extracción
   * manual, donde las tareas todavía no existen). Si devuelve null —tarea borrada—
   * cae a la fila de texto de siempre.
   */
  renderTaskCard?: (id: string) => ReactNode;
  /** Las tareas ABIERTAS del tablero. Habilitan «es otra tarea»: cuando el cruce acertó
   *  que es un duplicado pero erró la tarjeta, se re-apunta a la correcta en vez de
   *  crear una nueva (que es el duplicado que todo esto viene a evitar). */
  delTablero?: Array<{ id: string; titulo: string }>;
}) {
  // Índices originales, para que el patch vuelva a la fila correcta del padre.
  const conIdx = useMemo(() => filas.map((f, i) => ({ f, i, r: f.reunion ?? reunion })), [filas, reunion]);
  const mias = useMemo(() => conIdx.filter((x) => !x.f.esDeOtro), [conIdx]);

  // El borrador anota como «cargadas» las que creó, pero la tarjeta puede no estar:
  // la borraron a mano, o la creación falló DESPUÉS de que el borrador ya la anotara.
  // `renderTaskCard` devuelve null cuando el id no existe en el tablero, y eso es lo
  // único que sabe de verdad si está o no. Sin partirlas, esas huérfanas ofrecían
  // «ver la tarjeta →» y abrían un modal vacío que trababa la pantalla entera.
  const enElBoard = useMemo(
    () => (renderTaskCard ? yaCargadas.filter((y) => !!renderTaskCard(y.tareaId)) : yaCargadas),
    [yaCargadas, renderTaskCard],
  );
  // Las que el borrador da por cargadas y no están: llegan ya convertidas en filas
  // normales (las marca TareasRecibidasModal, que es quien tiene la lista del tablero),
  // así que acá solo se separan para ponerlas arriba.
  const faltantes = useMemo(() => mias.filter((x) => x.f.faltante), [mias]);
  // LAS QUE YA ESTÁN EN EL PLAN VAN ABAJO DE TODO, EN SU PROPIA SECCIÓN.
  //
  // Mezcladas entre las nuevas no se distinguían: la misma fila, el mismo alto, y la
  // única diferencia era un borde verde y un chip. Con veinte tareas eso no se ve, y lo
  // que el dueño necesita leer primero es lo que TIENE QUE DECIDIR — lo que ya está en
  // el plan no requiere ninguna decisión suya salvo desmarcarlo.
  //
  // El corte es el mismo `ampliando` que usa la fila: si tocás «no es la misma», la
  // tarea vuelve sola arriba, con las nuevas, que es donde pasó a pertenecer.
  const yaEnPlan = useMemo(() => mias.filter((x) => !x.f.faltante && !!x.f.enriquece && x.f.ampliar !== false), [mias]);
  const miasRestantes = useMemo(() => mias.filter((x) => !x.f.faltante && !(x.f.enriquece && x.f.ampliar !== false)), [mias]);
  // MIS tareas agrupadas por reunión (con varias esperando, saber de cuál salió cada
  // una es la mitad del sentido de la pantalla).
  // Las faltantes salen ARRIBA, en su propio bloque: acá se agrupa solo el resto.
  const miasPorReunion = useMemo(() => {
    const m = new Map<string, { r: ReunionRefUI; items: typeof mias }>();
    for (const x of miasRestantes) {
      const k = String(x.r.recordingId ?? x.r.titulo ?? '');
      const prev = m.get(k);
      if (prev) prev.items.push(x); else m.set(k, { r: x.r, items: [x] });
    }
    return [...m.values()];
  }, [miasRestantes]);
  const grupos = useMemo(() => {
    const m = new Map<string, { clave: string; nombre: string; email: string; r: ReunionRefUI; items: Array<{ f: FilaTarea; i: number }> }>();
    for (const x of conIdx) {
      if (!x.f.esDeOtro) continue;
      const clave = claveDe(x.f, x.r.recordingId);
      const prev = m.get(clave);
      if (prev) prev.items.push(x);
      else m.set(clave, { clave, nombre: (x.f.dueño || '').trim() || (x.f.dueñoEmail || '').trim() || 'Otra persona', email: (x.f.dueñoEmail || '').trim().toLowerCase(), r: x.r, items: [x] });
    }
    return [...m.values()];
  }, [conIdx]);

  // La tab elegida se DERIVA, no se sincroniza por efecto: si el grupo activo
  // desaparece (se re-extrajo la reunión), cae sola a "Mías" sin un render de más.
  // ¿La pantalla mezcla más de una reunión? Define si hace falta fechar cada bloque.
  const variasReuniones = useMemo(
    () => new Set(conIdx.map((x) => String(x.r.recordingId ?? x.r.titulo ?? ''))).size > 1,
    [conIdx],
  );

  const [tabSel, setTab] = useState<string>('mias');
  const activo = tabSel === 'mias' ? null : grupos.find((g) => g.clave === tabSel) ?? null;
  const tab = tabSel === 'mias' || activo ? tabSel : 'mias';

  // Quién es cada uno en la app (para saber si podemos mandarle o cargarle el plan).
  // Indexado por REUNIÓN: los participantes se validan por grabación, así que cada una
  // trae su propio mapa. Se piden solo cuando hay tareas de otros.
  const ridsConOtros = useMemo(() => [...new Set(conIdx.map((x) => x.r.recordingId).filter((x): x is number => !!x))].join(','), [conIdx]);
  const [dests, setDests] = useState<Record<number, Record<string, Destinatario>>>({});

  // El destinatario del grupo abierto. La extracción NO siempre trae el email del
  // dueño (hay borradores con `dueno` y sin `duenoEmail`), así que sin este fallback
  // por nombre el panel se quedaba sin destinatario y el botón de cargar en el plan
  // no se dibujaba nunca — que es el caso que reportó Martín con sus 17 tareas.
  const normNom = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const destDe = (g: { email?: string; nombre: string; r: { recordingId?: number | null } } | null) => {
    if (!g) return undefined;
    const m2 = dests[g.r.recordingId ?? 0] ?? {};
    if (g.email && m2[g.email]) return m2[g.email];
    const n = normNom(g.nombre);
    if (!n) return undefined;
    return Object.values(m2).find((d) => normNom(d.nombre) === n || normNom(d.nombre).split(/\s+/)[0] === n.split(/\s+/)[0]);
  };
  const [destsListos, setDestsListos] = useState(false);
  // POR QUÉ no se puede. El server ya redacta el motivo («No tengo los participantes de
  // esta reunión…») y acá se tiraba: el botón de mandar simplemente no se dibujaba y no
  // había ninguna explicación en pantalla. Un botón que falta sin decir nada es peor que
  // un botón deshabilitado con su motivo.
  const [destErr, setDestErr] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!ridsConOtros) return;
    const rids = ridsConOtros.split(',').map(Number);
    let vivo = true;
    void Promise.all(rids.map(async (rid) => {
      const j = await apiReunion({ action: 'destinatarios', recordingId: rid });
      const arr = (j.ok && Array.isArray(j.destinatarios) ? j.destinatarios : []) as Destinatario[];
      return [rid, Object.fromEntries(arr.map((d) => [d.email, d])), j.ok ? '' : (j.error || 'No pude resolver a quién mandárselas.')] as const;
    })).then((tri) => {
      if (!vivo) return;
      setDests(Object.fromEntries(tri.map(([rid, m]) => [rid, m])));
      setDestErr(Object.fromEntries(tri.map(([rid, , e]) => [rid, e]).filter(([, e]) => e)));
      setDestsListos(true);
    });
    return () => { vivo = false; };
  }, [ridsConOtros]);

  // A quién se le puede pasar una tarea: TODA la gente que aparece en la pantalla, sin
  // importar de qué reunión salió. Una tarea que se habló con Mauricio puede ser de
  // Francisco igual; limitar la lista a los invitados de ESA grabación obligaba a
  // cargar a mano a alguien que ya estaba ahí abajo, en la otra tab.
  const personasTodas = useMemo((): PersonaRef[] => {
    const m = new Map<string, PersonaRef>();
    for (const porReunion of Object.values(dests)) {
      for (const d of Object.values(porReunion)) m.set(d.email, { nombre: d.nombre, email: d.email });
    }
    for (const x of conIdx) {
      if (!x.f.esDeOtro) continue;
      const k = (x.f.dueñoEmail || x.f.dueño || '').toLowerCase();
      if (k && !m.has(k)) m.set(k, { nombre: x.f.dueño || x.f.dueñoEmail || '', email: x.f.dueñoEmail || '' });
    }
    return [...m.values()].filter((p) => p.nombre || p.email);
  }, [dests, conIdx]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* tabs: Mías + una por persona con tareas */}
      {grupos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          {/* Cuenta las que YA cargaste: si no, la tab dice "Mías 0" cuando adentro hay
              diez tuyas, ya en el plan. */}
          <TabBtn activo={tab === 'mias'} onClick={() => setTab('mias')} label={`Mías`} n={mias.length + yaCargadas.length} />
          {grupos.map((g) => (
            // Con varias reuniones la misma persona aparece una vez por reunión: se
            // aclara con la fecha para poder distinguirlas de un vistazo.
            <TabBtn key={g.clave} activo={tab === g.clave} onClick={() => setTab(g.clave)}
              label={(g.nombre.split(' ')[0] || 'Otros') + (variasReuniones && cuandoCorto(g.r.fecha) ? ` · ${cuandoCorto(g.r.fecha)}` : '')}
              n={g.items.length} />
          ))}
        </div>
      )}

      {tab === 'mias' ? (
        // ⚠️ EL ORDEN DE ESTOS CUATRO BLOQUES ES LA FUNCIONALIDAD, no maquetado.
        // Arriba lo que HAY QUE DECIDIR, abajo lo que ya está resuelto:
        //   1. faltantes  — el borrador las dio por cargadas y no están
        //   2. mias       — LAS NUEVAS: las candidatas que se van a crear
        //   3. yaEnPlan   — ya tienen tarjeta; solo se les suma contexto
        //   4. enElBoard  — ya las cargaste en esta misma sesión
        //
        // Ya se había acordado y se rompió igual: los comentarios de los bloques 3 y 4
        // decían «abajo de las nuevas» y «VA ABAJO», pero el JSX pintaba `yaEnPlan`
        // ANTES que `mias`. El dueño abría el modal y lo primero que leía era «Ya están
        // en tu plan (16)» — dieciséis tarjetas que no requieren ninguna decisión suya —
        // con las nuevas enterradas debajo. Un comentario que dice el orden no ordena
        // nada: el orden es este, el de los bloques.
        <>
          {cabecera && mias.length > 0 && <div style={{ fontSize: 13, color: 'var(--dim)' }}>{cabecera}</div>}
          {/* LAS QUE NO ESTÁN, arriba de todo. El borrador las da por cargadas pero en el
              tablero no hay ninguna tarjeta con ese id: o la borraron, o la creación
              falló después de que el borrador ya las anotara. Van con la MISMA fila que
              cualquier candidata —mismo alto, mismo checkbox, «no es mía» y «corregir
              contexto»— porque son eso: candidatas. Un contenedor propio las hacía ver
              como otra cosa y encima no dejaba corregirles nada. */}
          {faltantes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#C8870C' }}>
                {faltantes.length === 1 ? 'Aún no está en tu plan' : `Aún no están en tu plan (${faltantes.length})`}
              </div>
              {faltantes.map(({ f, i }) => (
                <FilaCandidata key={i} f={f} onFila={(p) => onFila(i, p)} url={reunion.url} personas={personasTodas} onAbrirTarea={onAbrirTarea} />
              ))}
            </div>
          )}
          {mias.length === 0
            ? (yaCargadas.length === 0 && <div style={{ padding: '26px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 13.5, lineHeight: 1.5 }}>
                De {miasPorReunion.length > 1 ? 'estas reuniones' : 'esta reunión'} no salió ninguna tarea tuya: todas quedaron del lado de las otras personas.
              </div>)
            : miasPorReunion.map((g, gi) => (
                <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Encabezado por reunión: solo si hay más de una en la pantalla. */}
                  {variasReuniones && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: gi ? 6 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{g.r.titulo || 'Reunión'}</span>
                      {cuandoFue(g.r.fecha) && <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>{cuandoFue(g.r.fecha)}</span>}
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>· {g.items.length}</span>
                      <LinkGrabacion url={g.r.url} />
                    </div>
                  )}
                  {g.items.map(({ f, i }) => (
                    <FilaCandidata key={i} f={f} onFila={(p) => onFila(i, p)} url={g.r.url} personas={personasTodas} onAbrirTarea={onAbrirTarea} />
                  ))}
                </div>
              ))}
          {/* YA ESTÁ EN EL PLAN: sección propia, abajo de las nuevas. Cada una muestra
              la TARJETA REAL del tablero —la misma que el dueño ya conoce del kanban—
              con el contexto que se le va a sumar arriba. Antes era una fila igual a las
              demás con un borde verde, y entre veinte no se distinguía. */}
          {yaEnPlan.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ok, #1E9E57)' }}>
                ⊕ {yaEnPlan.length === 1 ? 'Ya está en tu plan' : `Ya están en tu plan (${yaEnPlan.length})`}
              </div>
              {yaEnPlan.map(({ f, i }) => (
                <FilaYaEnPlan key={i} f={f} onFila={(p) => onFila(i, p)} url={(f.reunion ?? reunion).url}
                  onAbrirTarea={onAbrirTarea} renderTaskCard={renderTaskCard} delTablero={delTablero} />
              ))}
            </div>
          )}
          {/* Lo que ya cargaste de esta reunión. No se vuelve a ofrecer, pero sigue a la
              vista: el borrador quedó abierto por las tareas de los demás y sin esto
              parecía que las tuyas se habían perdido. Cada una abre su tarjeta real.
              VA ABAJO: arriba tiene que estar lo que falta hacer, no lo que ya está. */}
          {enElBoard.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--good)' }}>
                ✓ Cargaste {enElBoard.length} {enElBoard.length === 1 ? 'tarea' : 'tareas'} al plan
              </div>
              {/* Grilla de tarjetas REALES del board (misma medida que el kanban). Cuando
                  no hay con qué pintarlas —extracción manual, o la tarea se borró— cae a
                  la fila de texto de siempre. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 12, alignItems: 'start' }}>
                {enElBoard.map((y) => {
                  const card = renderTaskCard?.(y.tareaId);
                  return (
                    <div key={y.tareaId} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      {card ?? (
                        <div style={{ padding: '12px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.35 }}>
                          {y.titulo}
                          {onAbrirTarea && <button type="button" onClick={() => onAbrirTarea(y.tareaId)} style={{ ...btnChico, color: 'var(--primary)', marginLeft: 8 }}>ver la tarjeta →</button>}
                        </div>
                      )}
                      {/* El minuto de la reunión NO vive en la tarjeta del kanban: va abajo,
                          que es la única forma de volver al momento en que se dijo. */}
                      {(y.minutos ?? []).length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 2 }}>
                          {(y.minutos ?? []).map((seg) => {
                            const l = urlEnMinuto(y.url ?? reunion.url, seg);
                            return l
                              ? <a key={seg} href={l} target="_blank" rel="noreferrer" title="Escuchar este momento de la reunión"
                                  style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>▶ {relojDe(seg)}</a>
                              : <span key={seg} style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>▶ {relojDe(seg)}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : activo ? (
        <PanelPersona
          key={activo.clave}
          nombre={activo.nombre}
          dest={destDe(activo)}
          cargandoDest={!destsListos && !!activo.r.recordingId}
          motivoSinDest={destsListos ? (destErr[activo.r.recordingId ?? 0] || '') : ''}
          items={activo.items}
          labels={labels}
          reunion={activo.r}
          onFila={onFila}
          personas={personasTodas}
        />
      ) : null}
    </div>
  );
}

/** Link a la grabación de ESA reunión (el de cada bloque, no uno global). */
function LinkGrabacion({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>
      <SvcIcon k="fathom" size={11} box={16} radius={4} /> ver la grabación
    </a>
  );
}

function TabBtn({ activo, onClick, label, n }: { activo: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: activo ? 700 : 500, border: `1px solid ${activo ? 'var(--primary)' : 'var(--border-strong)'}`, background: activo ? 'var(--primary-bg)' : 'var(--surface)', color: activo ? 'var(--primary)' : 'var(--dim)' }}>
      {label}
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, opacity: 0.75 }}>{n}</span>
    </button>
  );
}

/**
 * Una tarea MÍA: se tilda/destilda y se le puede corregir el contexto.
 *
 * NO tiene prioridad ni selector de proyecto a propósito: las dos cosas las decide el
 * Perro cuando entran (mostrarlas acá era pedirle al usuario que adivine algo que la
 * app va a pisar dos segundos después). Lo que sí necesita mano humana es el DETALLE:
 * la IA escucha mal un número y queda escrito ("el grupal de $497" cuando son $1500).
 */
/**
 * «Ya está en tu plan»: el contexto que se le va a sumar, y debajo LA TARJETA REAL.
 *
 * Es otra pieza y no una variante de `FilaCandidata` porque no es la misma decisión.
 * Una candidata se tilda o se destilda; ésta ya tiene destino y lo único que se puede
 * hacer es discutir el match. Mostrarla con el mismo cuerpo —checkbox incluido— era
 * justamente lo que hacía que no se distinguieran.
 *
 * La tarjeta sale de `renderTaskCard`, la MISMA del kanban: el dueño reconoce de un
 * vistazo cuál es sin tener que abrir nada, que es lo que hace falta para darse cuenta
 * de que el cruce se equivocó. Si el id ya no existe en el tablero, la tarjeta devuelve
 * null y cae al nombre a secas.
 */
function FilaYaEnPlan({ f, onFila, url, onAbrirTarea, renderTaskCard, delTablero = [] }: {
  f: FilaTarea; onFila: (p: Partial<FilaTarea>) => void; url?: string | null;
  onAbrirTarea?: (id: string) => void; renderTaskCard?: (id: string) => ReactNode;
  /** Las tareas ABIERTAS del tablero, para poder re-apuntar el cruce a otra. */
  delTablero?: Array<{ id: string; titulo: string }>;
}) {
  const [editando, setEditando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [busca, setBusca] = useState('');
  const momentos = momentosDe(f);
  const card = f.enriquece?.id ? renderTaskCard?.(f.enriquece.id) : null;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const candidatas = useMemo(() => {
    const q = norm(busca.trim());
    const otras = delTablero.filter((t) => t.id !== f.enriquece?.id);
    if (!q) return otras.slice(0, 8);
    return otras.filter((t) => norm(t.titulo).includes(q)).slice(0, 12);
  }, [delTablero, busca, f.enriquece?.id]);
  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--ok, #1E9E57)', background: 'var(--surface)', overflow: 'hidden' }}>
      {/* Lo que trajo la reunión: el título y el contexto que se va a sumar. */}
      <div style={{ padding: '11px 13px', borderBottom: '1px dashed var(--border)' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>
          De la reunión
        </div>
        {editando ? (
          <>
            <input autoFocus value={f.titulo} onChange={(e) => onFila({ titulo: e.target.value })} placeholder="Título de la tarea"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, outline: 'none', fontFamily: SANS }} />
            <textarea value={f.detalle} onChange={(e) => onFila({ detalle: e.target.value })} rows={5} placeholder="Contexto: qué se dijo, para qué es"
              style={{ width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.5, outline: 'none', fontFamily: SANS, resize: 'vertical' }} />
          </>
        ) : (
          <>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
              {f.titulo}
              {momentos.map((seg) => {
                const l = urlEnMinuto(url, seg);
                return l
                  ? <a key={seg} href={l} target="_blank" rel="noreferrer" title="Escuchar este momento"
                      style={{ marginLeft: 8, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>▶ {relojDe(seg)}</a>
                  : <span key={seg} style={{ marginLeft: 8, fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>▶ {relojDe(seg)}</span>;
              })}
            </div>
            {/* DetalleDoc YA trae su propio «ver más»: el botón que había acá encima
                dejaba dos controles seguidos que decían lo mismo. */}
            {f.detalle && <div style={{ marginTop: 6 }}><DetalleDoc texto={f.detalle} /></div>}
          </>
        )}
      </div>
      {/* La tarea que YA está en el tablero, tal cual se ve en el kanban. */}
      <div style={{ padding: '11px 13px', background: 'var(--surface-2)' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>
          Se le suma a esta tarea
        </div>
        {/* Ancho completo: con `maxWidth: 320` la tarjeta quedaba pegada a la izquierda
            y media fila vacía a la derecha. */}
        <div>
          {card ?? (
            <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--dim)' }}>
              La tarea ya no está en el tablero.
            </div>
          )}
        </div>
        {/* Editar a la IZQUIERDA, decisiones a la DERECHA. Amontonados contra un borde
            se leen como una sola cosa y se tocan sin querer. Es el mismo reparto que la
            fila de una tarea nueva. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); setEditando((v) => !v); }}
            style={{ ...btnChico, ...(editando ? { color: 'var(--primary)' } : {}) }}>
            {editando ? '✓ listo' : '✎ corregir contexto'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {!!f.enriquece?.id && onAbrirTarea && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onAbrirTarea(f.enriquece!.id); }}
                style={{ ...btnChico, color: 'var(--primary)' }}>abrir la tarea</button>
            )}
            {/* DOS salidas, porque el cruce se equivoca de dos maneras: «no hay ninguna
                igual» y «hay una igual, pero es otra». */}
            <button type="button" onClick={(e) => { e.stopPropagation(); setEligiendo((v) => !v); }}
              style={{ ...btnChico, color: eligiendo ? 'var(--primary)' : undefined }}>↔ es otra tarea</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onFila({ ampliar: false, incluir: true }); }}
              style={{ ...btnChico, color: 'var(--warn)' }}>↗ crear como nueva tarea</button>
          </div>
        </div>
        {eligiendo && (
          <div style={{ marginTop: 9, padding: 10, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscá la tarea de tu plan…"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: SANS }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 7, maxHeight: 220, overflowY: 'auto' }}>
              {candidatas.map((t) => (
                <button key={t.id} type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEligiendo(false); setBusca('');
                    // Lo elige una persona mirando las dos: es lo más confiable que hay,
                    // así que va con confianza alta y sin tildar (se amplía, no se crea).
                    onFila({ enriquece: { id: t.id, razon: `ya está en tu plan como «${t.titulo}» — lo marcaste vos`, confianza: 'alta' }, ampliar: true, incluir: false });
                  }}
                  style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.35, cursor: 'pointer', fontFamily: SANS }}>
                  {t.titulo}
                </button>
              ))}
              {!candidatas.length && (
                <div style={{ fontSize: 12.5, color: 'var(--faint)', padding: '6px 2px' }}>
                  {busca.trim() ? 'Ninguna coincide.' : 'No hay otras tareas abiertas.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Exportada para que el wizard de /plan/revisar use LA MISMA fila que el modal de una
 *  reunión: mismo checkbox, mismo «corregir contexto», mismo alto. Son la misma
 *  decisión («¿esta tarea entra o no?») y el dueño ya la conoce de un lado. */
export function FilaCandidata({ f, onFila, url, personas, onAbrirTarea }: { f: FilaTarea; onFila: (p: Partial<FilaTarea>) => void; url?: string | null; personas: PersonaRef[]; onAbrirTarea?: (id: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [reasignando, setReasignando] = useState(false);
  const momentos = momentosDe(f);
  // Ya está en el plan y se va a AMPLIAR: no es una fila que se tilda, es una fila que
  // ya tiene destino. Se pinta distinto (verde, con ⊕) para que no se lea como una
  // tarea nueva a medio elegir, y su casilla no crea nada.
  const ampliando = !!f.enriquece && f.ampliar !== false;
  const activa = ampliando || f.incluir;
  return (
    <div style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 12, border: `1px solid ${f.descartada ? 'var(--border)' : ampliando ? 'var(--ok, #1E9E57)' : f.incluir ? 'var(--primary)' : 'var(--border)'}`, background: f.descartada ? 'var(--surface-2)' : ampliando ? 'var(--surface)' : f.incluir ? 'var(--primary-bg)' : 'var(--surface-2)', opacity: f.descartada ? 0.55 : activa ? 1 : 0.6, textDecoration: f.descartada ? 'line-through' : undefined }}>
      {ampliando ? (
        <span title="Ya está en el plan: se le suma este contexto a la tarjeta que existe"
          style={{ width: 20, height: 20, flex: 'none', marginTop: 1, borderRadius: 6, border: '1.5px solid var(--ok, #1E9E57)', background: 'var(--ok, #1E9E57)', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⊕</span>
      ) : (
        <button type="button" onClick={() => onFila({ incluir: !f.incluir })} aria-label="Incluir"
          style={{ width: 20, height: 20, flex: 'none', marginTop: 1, borderRadius: 6, border: `1.5px solid ${f.incluir ? 'var(--primary)' : 'var(--border-strong)'}`, background: f.incluir ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.incluir ? '✓' : ''}</button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* El minuto va PEGADO al título: es parte de "qué es esto", no una acción. */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
          {/* Mientras se edita, el título vive SOLO en el input: mostrarlo también acá
              lo dejaba escrito dos veces, una arriba de la otra. */}
          {!editando && f.titulo}
          {/* TODOS los momentos: una tarea que se habló tres veces trae sus tres marcas
              en vez de tres tarjetas casi iguales. */}
          {momentos.map((seg) => {
            const l = urlEnMinuto(url, seg);
            return l
              ? <a key={seg} href={l} target="_blank" rel="noreferrer" title="Escuchar este momento de la reunión"
                  style={{ marginLeft: 8, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>▶ {relojDe(seg)}</a>
              : <span key={seg} style={{ marginLeft: 8, fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>▶ {relojDe(seg)}</span>;
          })}
        </div>
        {/* Corregir incluye el TÍTULO: es lo que se lee en la tarjeta y en la vista de
            Prioridades, así que si la transcripción lo dejó torcido no alcanza con
            arreglar el detalle — la tarjeta sigue diciendo cualquier cosa. */}
        {editando
          ? <>
              <input autoFocus value={f.titulo} onChange={(e) => onFila({ titulo: e.target.value })} placeholder="Título de la tarea"
                style={{ width: '100%', marginTop: 5, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, lineHeight: 1.35, outline: 'none', fontFamily: SANS }} />
              <textarea value={f.detalle} onChange={(e) => onFila({ detalle: e.target.value })} rows={4} placeholder="Contexto: qué se dijo, para qué es"
                style={{ width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.5, outline: 'none', fontFamily: SANS, resize: 'vertical' }} />
            </>
          : f.detalle && <DetalleDoc texto={f.detalle} />}
        {/* Ya existe: se NOMBRA la tarjeta entera (antes se cortaba a los 50 caracteres,
            a mitad de palabra y con la comilla sin cerrar, así que no se sabía cuál era)
            y se ofrece abrirla. Y NO se puede volver a cargar: lo que se hace es sumarle
            este contexto a la que está. Cargar reuniones en serie sobre el mismo tema
            dejaba la misma tarea escrita tres veces con tres scores distintos.
            La salida de emergencia («no es la misma») sigue: el cruce se puede
            equivocar y ahí perder el compromiso es peor que tener una repetida. */}
        {f.enriquece && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: ampliando ? 'var(--ok, #1E9E57)' : 'var(--warn)', background: 'var(--surface)', border: `1px solid ${ampliando ? 'var(--ok, #1E9E57)' : 'var(--warn)'}`, borderRadius: 7, padding: '3px 9px', lineHeight: 1.45 }}>
              {ampliando ? '⊕ ' : '⚠ '}{f.enriquece.razon}
            </span>
            {!!f.enriquece.id && onAbrirTarea && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onAbrirTarea(f.enriquece!.id); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, padding: 0 }}>ver la tarjeta</button>
            )}
          </div>
        )}
        {/* Editar a la izquierda; reasignar a la derecha, separados: son dos gestos
            distintos y pegados se tocan sin querer. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setEditando((v) => !v)}
            style={{ ...btnChico, ...(editando ? { color: 'var(--primary)' } : {}) }}>
            {editando ? '✓ listo' : '✎ corregir contexto'}
          </button>
          {/* La salida de emergencia del cruce: va ACÁ ABAJO, alineada con las otras
              acciones y separada por el gap de la fila. Arriba, pegada al aviso, se leía
              como una sola frase corrida con la razón — no parecía un botón. El texto es
              corto a propósito: la explicación ya la da el chip de arriba. */}
          {f.enriquece && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onFila(ampliando ? { ampliar: false, incluir: true } : { ampliar: true, incluir: false }); }}
              style={{ ...btnChico, ...(ampliando ? {} : { color: 'var(--ok, #1E9E57)' }) }}
              title={ampliando ? 'Crear una tarea nueva en vez de sumarle el contexto a la que ya está' : 'Volver a sumarle el contexto a la tarjeta que ya está'}>
              {ampliando ? '↗ no es la misma' : '↺ deshacer'}
            </button>
          )}
          {/* La transcripción de Fathom etiqueta MAL a quien habla (mezcla dos voces en
              un bloque), así que la atribución falla y no hay prompt que lo arregle. Se
              corrige acá — pero PREGUNTANDO de quién es, no mandándola a ciegas. */}
          {/* Y SOLO si hay a quién dársela. Con la lista vacía el botón abre un
              selector sin opciones: un callejón sin salida. Pasa en el wizard del
              borrador, donde las tareas salen de las respuestas del propio dueño y
              «no es mía» no significa nada — ahí no tiene que estar. */}
          {personas.length > 0 && (
            <button type="button" onClick={() => setReasignando((v) => !v)} style={btnChico}>↪ no es mía</button>
          )}
        </div>
        {reasignando && (
          <ElegirDueño personas={personas} actual="" esMiaHoy
            onCancelar={() => setReasignando(false)}
            onElegir={(p) => {
              setReasignando(false);
              if (p) onFila({ esDeOtro: true, incluir: false, dueño: p.nombre, dueñoEmail: p.email || undefined });
            }} />
        )}
      </div>
    </div>
  );
}

/** Tab de una persona: sus tareas (solo lectura) + qué hacer con ellas. */
function PanelPersona({ nombre, dest, cargandoDest, motivoSinDest, items, labels, reunion, onFila, personas }: {
  nombre: string; dest?: Destinatario; cargandoDest: boolean;
  /** por qué NO se le puede mandar nada (lo redacta el server). '' = se puede. */
  motivoSinDest?: string;
  items: Array<{ f: FilaTarea; i: number }>; labels: Label[]; reunion: ReunionRefUI;
  onFila: (i: number, patch: Partial<FilaTarea>) => void;
  personas: PersonaRef[];
}) {
  const [reasignando, setReasignando] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  // El email que la IA le atribuyó, aunque esa persona no tenga cuenta en la app.
  const emailConocido = items.find((x) => x.f.dueñoEmail)?.f.dueñoEmail ?? '';
  const filas = items.map((x) => x.f);
  const [abrirEnvio, setAbrirEnvio] = useState(false);
  const [wa, setWa] = useState(true);
  const [mail, setMail] = useState(true);
  // El número que tenemos guardado se puede pisar a mano (null = todavía no lo tocó).
  const [telManual, setTelManual] = useState<string | null>(null);
  const telefono = telManual ?? dest?.telefono ?? '';
  // Idem el email: si no lo sabemos (persona sin cuenta, o cargada a mano), se pide.
  const [mailManual, setMailManual] = useState<string | null>(null);
  const emailDest = (mailManual ?? dest?.email ?? emailConocido ?? '').trim();
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [nota, setNota] = useState('');
  const [err, setErr] = useState('');
  const [linkPlan, setLinkPlan] = useState('');

  const proyectoNombre = (id: string | null) => labels.find((l) => l.id === id)?.name;
  // Si el proyecto todavía no existe, viaja el NOMBRE propuesto: el server crea la
  // categoría al aplicar. Antes se mandaba undefined y la tarea le llegaba suelta.
  // minuto/minutos viajan también: la tarjeta que le queda a la otra persona abre la
  // grabación justo donde ella asumió el compromiso, en vez de una frase sin contexto.
  const payload = filas.map((f) => ({ titulo: f.titulo, detalle: f.detalle, prioridad: f.prioridad, proyecto: proyectoNombre(f.proyectoId) ?? (f.proyectoNombre || undefined), minuto: f.minuto, minutos: f.minutos }));
  // Enviar SIEMPRE se puede abrir: si faltan datos, se piden adentro. Antes el botón
  // quedaba gris y mudo cuando la persona no tenía cuenta — que es justo cuando más
  // falta mandarle las tareas por mail.
  const puedeMandar = !!reunion.recordingId;

  const enviar = async () => {
    setEnviando(true); setErr(''); setNota('');
    const j = await apiReunion({
      action: 'enviar', recordingId: reunion.recordingId, email: emailDest, manual: !dest?.email, tareas: payload,
      reunion: { titulo: reunion.titulo, fecha: reunion.fecha, url: reunion.url },
      canales: { wa, email: mail }, telefono: telefono || undefined, link: linkPlan || undefined,
    });
    setEnviando(false);
    const detalleWa = (j.wa as { ok: boolean; error?: string } | undefined);
    const detalleMail = (j.email as { ok: boolean; error?: string } | undefined);
    if (j.ok) {
      setAbrirEnvio(false);
      setNota(`Le mandé sus tareas a ${nombre}${wa && mail ? ' por WhatsApp y mail' : wa ? ' por WhatsApp' : ' por mail'}.`);
    } else {
      setErr(j.error || [detalleWa?.ok === false ? `WhatsApp: ${detalleWa.error}` : '', detalleMail?.ok === false ? `Mail: ${detalleMail.error}` : ''].filter(Boolean).join(' · ') || 'No pude mandárselas.');
    }
  };

  const cargarEnSuPlan = async () => {
    setCargando(true); setErr(''); setNota('');
    const j = await apiReunion({
      action: 'cargar', recordingId: reunion.recordingId, email: dest!.email, tareas: payload,
      reunion: { titulo: reunion.titulo, fecha: reunion.fecha, url: reunion.url },
    });
    setCargando(false);
    if (j.ok) {
      setLinkPlan(String(j.link ?? ''));
      setNota(dest?.esVos ? 'Listo: te esperan en tu plan la próxima vez que entres.' : `Listo: ${nombre} va a ver estas tareas la próxima vez que entre a su plan.`);
    } else setErr(String(j.error ?? 'No pude cargárselas.'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
        Esto quedó del lado de <b style={{ color: 'var(--ink)' }}>{nombre}</b>{dest?.email ? ` (${dest.email})` : ''}
        {reunion.titulo ? <> en <b style={{ color: 'var(--ink)' }}>{reunion.titulo}</b></> : null}
        {cuandoFue(reunion.fecha) ? <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}> ({cuandoFue(reunion.fecha)})</span> : null}
        . No entra a tu plan: mandáselo. <LinkGrabacion url={reunion.url} />
      </div>

      {items.map(({ f, i: idx }, i) => (
        <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ flex: 'none', marginTop: 2, fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>{i + 1}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
              {/* Editando, el título vive solo en el input (si no, queda duplicado). */}
              {editando !== idx && f.titulo}
              {momentosDe(f).map((seg) => (
                <a key={seg} href={urlEnMinuto(reunion.url, seg) ?? '#'} target="_blank" rel="noreferrer" title="Escuchar este momento"
                  style={{ marginLeft: 8, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>▶ {relojDe(seg)}</a>
              ))}
            </div>
            {editando === idx
              ? <>
                  <input autoFocus value={f.titulo} onChange={(e) => onFila(idx, { titulo: e.target.value })} placeholder="Título de la tarea"
                    style={{ width: '100%', marginTop: 5, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, lineHeight: 1.35, outline: 'none', fontFamily: SANS }} />
                  <textarea value={f.detalle} onChange={(e) => onFila(idx, { detalle: e.target.value })} rows={4} placeholder="Contexto: qué se dijo, para qué es"
                    style={{ width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.5, outline: 'none', fontFamily: SANS, resize: 'vertical' }} />
                </>
              : f.detalle && <DetalleDoc texto={f.detalle} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 7, flexWrap: 'wrap' }}>
              {/* Corregir el contexto también acá: esta tarea se la vas a MANDAR a
                  alguien, así que con más razón tiene que estar bien escrita. */}
              <button type="button" onClick={() => setEditando(editando === idx ? null : idx)}
                style={{ ...btnChico, ...(editando === idx ? { color: 'var(--primary)' } : {}) }}>
                {editando === idx ? '✓ listo' : '✎ corregir contexto'}
              </button>
              {/* Si la transcripción se equivocó de hablante, se reasigna acá: a vos, a
                  otro de la reunión, o a alguien que cargás en el momento. */}
              <button type="button" onClick={() => setReasignando(reasignando === idx ? null : idx)} style={btnChico}>
                ↩ no es de {nombre.split(' ')[0]}
              </button>
            </div>
            {reasignando === idx && (
              <ElegirDueño personas={personas} actual={dest?.email || nombre} esMiaHoy={false}
                onCancelar={() => setReasignando(null)}
                onElegir={(p) => {
                  setReasignando(null);
                  if (p) onFila(idx, { dueño: p.nombre, dueñoEmail: p.email || undefined });
                  else onFila(idx, { esDeOtro: false, incluir: true, dueño: undefined, dueñoEmail: undefined });
                }} />
            )}
          </div>
        </div>
      ))}

      {nota && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--good)', background: 'var(--surface-2)', border: '1px solid var(--good)', borderRadius: 9, padding: '9px 12px' }}>✓ {nota}</div>}
      {err && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>{err}</div>}

      {/* confirmación de envío: se ve EXACTAMENTE a dónde va antes de mandar */}
      {abrirEnvio && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '12px 13px', borderRadius: 12, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>¿Se las mando a {nombre}?</div>
          <Check on={mail} set={setMail} label={emailDest ? `Mail a ${emailDest}` : 'Mail'} />
          {mail && !dest?.email && (
            <input value={emailDest} onChange={(e) => setMailManual(e.target.value)} placeholder="Su email"
              style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: SANS }} />
          )}
          <Check on={wa} set={setWa} label="WhatsApp" />
          {wa && (
            <input value={telefono} onChange={(e) => setTelManual(e.target.value)} placeholder="Número con código de país (ej. 5215512345678)"
              style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: SANS }} />
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAbrirEnvio(false)} style={ghost}>Cancelar</button>
            <button type="button" onClick={() => void enviar()} disabled={enviando || (!wa && !mail) || (wa && !telefono.trim()) || (mail && !emailDest.includes('@'))}
              style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: enviando ? 'default' : 'pointer', opacity: enviando || (!wa && !mail) || (wa && !telefono.trim()) || (mail && !emailDest.includes('@')) ? 0.55 : 1, fontFamily: SANS }}>
              {enviando ? 'Mandando…' : 'Mandar'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
        <button type="button" onClick={() => descargarMd(nombre, filas, reunion)} style={ghost}>⬇ Descargar (.md)</button>
        <button type="button" onClick={() => { setAbrirEnvio(true); setErr(''); setNota(''); }} disabled={!puedeMandar || abrirEnvio}
          title={puedeMandar ? 'Mandarle sus tareas por WhatsApp y mail' : 'No tengo el mail de esta persona en la reunión'}
          style={{ ...ghost, opacity: puedeMandar && !abrirEnvio ? 1 : 0.5, cursor: puedeMandar && !abrirEnvio ? 'pointer' : 'default' }}>
          ✉ Enviar
        </button>
        {cargandoDest && <span style={{ fontSize: 12, color: 'var(--faint)', alignSelf: 'center' }}>Buscando su cuenta…</span>}
        {/* SIN destinatario: se DICE por qué. Antes el botón «Cargar en el plan de X»
            simplemente no aparecía y no había forma de saber si era porque la persona
            no tiene cuenta, porque la reunión no trajo invitados o porque falló algo. */}
        {!cargandoDest && !dest && (
          <span style={{ fontSize: 12, color: 'var(--dim)', alignSelf: 'center', lineHeight: 1.45 }}>
            {motivoSinDest || `No encontré la cuenta de ${nombre.split(' ')[0]} en MaKo: puedo mandarle las tareas, pero no dejárselas en su plan.`}
          </span>
        )}
        {dest?.puedeCargarPlan && (
          <button type="button" onClick={() => void cargarEnSuPlan()} disabled={cargando || !!linkPlan}
            title={dest.esVos ? 'Te las dejo como borrador en TU plan para que las confirmes' : 'Le dejo estas tareas en su plan para que las confirme'}
            style={{ padding: '11px 18px', borderRadius: 11, border: 'none', background: linkPlan ? 'var(--border)' : 'var(--ink)', color: linkPlan ? 'var(--faint)' : 'var(--surface)', fontSize: 13.5, fontWeight: 700, cursor: cargando || linkPlan ? 'default' : 'pointer', fontFamily: SANS }}>
            {cargando ? 'Cargando…' : linkPlan ? (dest.esVos ? '✓ En tu plan' : '✓ En su plan') : dest.esVos ? 'Cargar en MI plan' : `Cargar en el plan de ${nombre.split(' ')[0]}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Check({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
      <button type="button" role="checkbox" aria-checked={on} onClick={() => set(!on)}
        style={{ width: 18, height: 18, flex: 'none', borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</button>
      {label}
    </label>
  );
}

const ghost: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
