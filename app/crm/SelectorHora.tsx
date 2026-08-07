'use client';

// =============================================================================
// SelectorHora — un desplegable de horarios, modelo Google Calendar
// =============================================================================
// Antes esto era una grilla de 21 botones. El dueño la rechazó de frente:
// «no deberían ser todos botones amontonados y debería poder ser más libre, qué
// pasa si se quiere agendar y cuarto… puedes replicar el modelo de Google
// Calendar, como un desplegable».
//
// Los tres problemas concretos de la grilla, y qué los reemplaza:
//
//  1. AMONTONADA. 21 chips de 88px en un modal de 560 son cinco filas de ruido
//     donde hay que BUSCAR con la vista. Ahora es UN campo: se abre, se scrollea
//     agrupado por franja del día, se elige. Y la lista pudo crecer a 07:00–22:00
//     con paso de 15 —el rango que pidió el dueño— justamente porque ya no tiene
//     que entrar entera en pantalla.
//  2. CERRADA. El "y cuarto" existía detrás de un botón "Otro horario" que abría
//     el <input type="time"> nativo… que es exactamente el control que este
//     componente se había escrito para NO usar. Ahora el campo del combobox ES el
//     campo libre: se escribe "6:15", "18:15", "6:15 pm" o "6 y cuarto" y se
//     entiende (parsearHora), con eco de lo entendido debajo para que no haya
//     ambigüedad posible.
//  3. LOS OCUPADOS ESTORBABAN. Estaban a la vista, tachados, y se elegían con dos
//     toques. «Las horas ocupadas directamente no las tomes en cuenta y que no
//     aparezca». Ahora no se listan; debajo queda una línea discreta que dice
//     CUÁNTOS se ocultaron, que es la diferencia entre filtrar y mentir por
//     omisión (por eso el server sigue mandando la grilla entera con su flag).
//
// -----------------------------------------------------------------------------
// LO QUE NO CAMBIA (y no se puede romper)
// -----------------------------------------------------------------------------
// · El componente es PURO: no hace fetch ni importa acciones. Quien lo usa
//   consulta la agenda y le pasa `slots` ya resueltos.
// · `slots: null` = NO SE PUDO VERIFICAR. Entonces NO se oculta absolutamente
//   nada (se ofrece el día entero) y se dice con todas las letras que no está
//   verificado. Un array VACÍO es otra cosa: ese día no tiene horarios, y también
//   se dice. Confundir los dos fue el bug caro que documenta horarios-respuesta.ts.
// · La agenda INFORMA, no prohíbe: una hora ocupada tipeada a mano se acepta —
//   con el aviso de con qué choca—, nunca se bloquea al usuario.
// · Las constantes de la grilla NO viven acá. Vienen de horarios-respuesta.ts, el
//   mismo módulo que usa el server: cuando el cliente tiene que dibujar la grilla
//   por su cuenta (agenda no verificada) el rango tiene que ser EL MISMO, o el
//   usuario ve 9–19 si Google falla y 7–22 si contesta.

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { hhmm, normalizarRango, type RangoGrilla } from './horarios-respuesta';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/**
 * Un horario de la lista con su estado real según la agenda.
 * `motivo` es opcional: si no viene, se explica con una frase genérica.
 */
export type SlotHora = {
  /** "HH:MM" — el mismo formato que emite el input nativo. */
  hora: string;
  /** false = hay algo en la agenda que se pisa con la reunión completa. */
  libre: boolean;
  /** Por qué está ocupado, si se sabe. Ej: "Llamada con Acme". */
  motivo?: string;
};

/** Dónde abre la lista cuando todavía no hay nada elegido y la fecha no es hoy. */
export const ANCLA_DEFECTO = '09:00';

/** "09:30" → "9:30 AM". La lista se lee como la lee una persona, no en 24h. */
export function horaLegible(hora: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora ?? '').trim());
  if (!m) return hora ?? '';
  const h = Number(m[1]);
  const sufijo = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${sufijo}`;
}

/** "HH:MM" → minutos desde medianoche. NaN si no es una hora. */
function minutosDe(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

// -----------------------------------------------------------------------------
// PARSEO TOLERANTE — lo que se escribe a mano
// -----------------------------------------------------------------------------
// Es lo que hace posible "más libre". Un input type=time obliga a acertarle a un
// spinner; acá se escribe como se habla. Casos que TIENEN que entrar, porque son
// los que el dueño nombró o los que salen solos al tipear rápido:
//
//   "6:15" · "615" · "18:15" · "1815" · "18.15" · "18h15" · "6:15 pm" · "6:15pm"
//   "6 y cuarto" · "seis y media" · "7 menos cuarto" · "6 en punto" · "mediodía"
//
// LA AMBIGÜEDAD DE LAS 6. "6:15" sin am/pm son dos horas distintas. Adivinar en
// silencio es lo peor que se puede hacer, así que se hacen dos cosas: se adivina
// con un criterio dicho en voz alta (1..7 sin sufijo = tarde, que es cuando se
// agenda; 8..12 = mañana) y se MUESTRA lo entendido debajo del campo. El usuario
// ve "Se entendió: 6:15 PM" y, si no era eso, escribe "6:15 am" y listo.
// Un cero adelante ("06:15") o cuatro dígitos ("0615") son 24h explícitas y
// nunca se tocan: quien escribe así ya dijo lo que quería.

const NUMERO_PALABRA: Record<string, number> = {
  cero: 0, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};
/** Fracciones de hora dichas en palabras ("y cuarto", "menos media"). */
const FRACCION_PALABRA: Record<string, number | undefined> = { cuarto: 15, media: 30, punto: 0 };

/** Minúsculas, sin tildes y con los espacios colapsados. */
function normalizarTexto(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
}

/**
 * Texto libre → "HH:MM", o null si no se entiende.
 *
 * Función PURA y exportada a propósito: es la única parte de este componente con
 * lógica que puede fallar en silencio, así que tiene que poder testearse sin
 * renderizar nada.
 */
export function parsearHora(entrada: string): string | null {
  let t = normalizarTexto(entrada);
  if (!t) return null;
  // "18 hs", "18 h", "a las 18"
  t = t.replace(/^a\s+las?\s+/, '').replace(/\bhs\b\.?/g, ' ').replace(/\s+/g, ' ').trim();

  if (t === 'mediodia' || t === 'medio dia') return '12:00';
  if (t === 'medianoche' || t === 'media noche') return '00:00';

  // El sufijo am/pm se saca ANTES de mirar los números, y conservando el carácter
  // que lo precedía: en "6pm" el "6" es parte del match y sin devolverlo se pierde.
  let meridiano: 'am' | 'pm' | null = null;
  const mMer = /(^|[\s\d])(a|p)\.?\s?m\.?\s*$|(\d)\s*(a|p)\s*$/.exec(t);
  if (mMer) {
    meridiano = (mMer[2] ?? mMer[4]) === 'p' ? 'pm' : 'am';
    t = (t.slice(0, mMer.index) + (mMer[1] ?? mMer[3] ?? '')).trim();
  }

  t = t.replace(/\s*en\s+punto\s*$/, '').trim();

  // "6 y cuarto" / "7 menos cuarto" / "6 y 20": se parte en base + corrimiento.
  let delta = 0;
  const mRel = /^(.+?)\s+(y|menos)\s+(.+)$/.exec(t);
  if (mRel) {
    const crudo = mRel[3].trim();
    const nm = /^(\d{1,2})$/.exec(crudo);
    const v = nm ? Number(nm[1]) : FRACCION_PALABRA[crudo];
    if (v == null || !Number.isFinite(v) || v > 59) return null;
    delta = (mRel[2] === 'menos' ? -1 : 1) * v;
    t = mRel[1].trim();
  }

  let base: number;
  let min = 0;
  // `explicito24` = el usuario ya dijo en qué mitad del día está y no hay nada que
  // adivinar (cero adelante o formato militar de 4 dígitos).
  let explicito24 = false;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})\s*[:.,h]\s*(\d{1,2})$/.exec(t))) {
    base = Number(m[1]); min = Number(m[2]); explicito24 = /^0\d/.test(m[1]);
  } else if ((m = /^(\d{3,4})$/.exec(t))) {
    // "1815" es militar; "615" es la abreviatura de 6:15 y sigue siendo ambigua.
    if (m[1].length === 4) { base = Number(m[1].slice(0, 2)); min = Number(m[1].slice(2)); explicito24 = true; }
    else { base = Number(m[1].slice(0, 1)); min = Number(m[1].slice(1)); }
  } else if ((m = /^(\d{1,2})$/.exec(t))) {
    base = Number(m[1]); explicito24 = /^0\d/.test(m[1]);
  } else if (t in NUMERO_PALABRA) {
    base = NUMERO_PALABRA[t];
  } else {
    return null;
  }
  if (!Number.isFinite(base) || base > 23 || min > 59) return null;

  let h = base;
  if (meridiano === 'pm') { if (h < 12) h += 12; }
  else if (meridiano === 'am') { if (h === 12) h = 0; }
  // Sin sufijo: 1..7 son de tarde (nadie agenda una reunión a las 3 AM), 8..12 de
  // mañana. Se dice en el eco, así que adivinar mal cuesta una tecla, no un error.
  else if (!explicito24 && base >= 1 && base <= 7) h = base + 12;

  const total = ((h * 60 + min + delta) % 1440 + 1440) % 1440;
  return hhmm(total);
}

// -----------------------------------------------------------------------------
// CHOQUE CON LA AGENDA — qué se puede AFIRMAR de una hora tipeada
// -----------------------------------------------------------------------------
// La grilla dice, por cada horario S, si una reunión que empieza en S entra
// entera. De una hora T que NO está en la grilla (las 18:07) no hay dato directo,
// y de ahí sale la única inferencia que es lógicamente válida:
//
//   si el horario anterior P y el siguiente N están LIBRES y el hueco entre ellos
//   no supera la duración, entonces [T, T+dur) ⊆ [P, P+dur) ∪ [N, N+dur), o sea
//   que T también está libre. Con cualquier vecino ocupado NO se puede afirmar
//   nada: se avisa "puede pisarse", que es honesto, en vez de inventar un ✓.

type Choque =
  | { tipo: 'sin-verificar' }
  | { tipo: 'libre' }
  | { tipo: 'ocupado'; motivo?: string }
  /** `con` = el horario ocupado más cercano ('' si simplemente no alcanza el dato). */
  | { tipo: 'dudoso'; con: string }
  | { tipo: 'fuera' };

function evaluarChoque(hora: string, slots: SlotHora[] | null, duracionMin: number): Choque {
  if (!Array.isArray(slots)) return { tipo: 'sin-verificar' };
  const exacto = slots.find((s) => s.hora === hora);
  if (exacto) return exacto.libre ? { tipo: 'libre' } : { tipo: 'ocupado', motivo: exacto.motivo };
  const t = minutosDe(hora);
  if (!Number.isFinite(t) || slots.length === 0) return { tipo: 'fuera' };
  let prev: SlotHora | null = null;
  let next: SlotHora | null = null;
  for (const s of slots) {
    const m = minutosDe(s.hora);
    if (!Number.isFinite(m)) continue;
    if (m < t && (!prev || m > minutosDe(prev.hora))) prev = s;
    if (m > t && (!next || m < minutosDe(next.hora))) next = s;
  }
  // Fuera de la franja verificada: no hay vecino de un lado, así que la reunión
  // se mete en horas de las que nunca se preguntó.
  if (!prev || !next) return { tipo: 'fuera' };
  if (!prev.libre) return { tipo: 'dudoso', con: prev.hora };
  if (!next.libre) return { tipo: 'dudoso', con: next.hora };
  const hueco = minutosDe(next.hora) - minutosDe(prev.hora);
  return hueco <= duracionMin ? { tipo: 'libre' } : { tipo: 'dudoso', con: '' };
}

/** La franja del día a la que pertenece un horario (agrupa la lista). */
function franjaDe(hora: string): string {
  const m = minutosDe(hora);
  if (!Number.isFinite(m)) return 'Horarios';
  if (m < 6 * 60) return 'Madrugada';
  if (m < 12 * 60) return 'Mañana';
  if (m < 18 * 60) return 'Tarde';
  return 'Noche';
}

/** Los horarios que ofrece un rango, en "HH:MM". Solo para el modo NO verificado. */
function grillaDeRango(r: RangoGrilla): string[] {
  const out: string[] = [];
  for (let m = r.desdeMin; m <= r.hastaMin; m += r.pasoMin) out.push(hhmm(m));
  return out;
}

type Posicion = { top?: number; bottom?: number; left: number; width: number };

/** Índice donde ABRE la lista: lo ya elegido, o el primer horario desde el ancla. */
export function indiceDeAncla(items: readonly string[], value: string, ancla: string): number {
  if (items.length === 0) return -1;
  const iVal = value ? items.indexOf(value) : -1;
  if (iVal >= 0) return iVal;
  const corte = minutosDe(ancla);
  if (Number.isFinite(corte)) {
    const i = items.findIndex((h) => minutosDe(h) >= corte);
    if (i >= 0) return i;
  }
  return 0;
}

/**
 * QUÉ OPCIÓN ESTÁ ACTIVA — la función que decide qué guarda Enter.
 *
 * Pura y exportada porque acá vivía un bug que no daba ningún síntoma visible más
 * que el resultado equivocado. El filtro de la lista es por SUBSTRING y no sabe
 * nada de `parsearHora`: tipear "6:15" deja visibles 16:15 (el texto "16:15"
 * CONTIENE "6:15") y 18:15 (la hora entendida). Con el activo fijado en 0 al
 * tipear, la fila resaltada era 16:15 y Enter guardaba 16:15 mientras el eco decía
 * "Se entendió: 6:15 PM" — y Tab o el click afuera, que pasan por `comprometer()`,
 * guardaban 18:15. Tres caminos de commit, tres resultados para el mismo texto.
 *
 * La regla: si el usuario NO movió el puntero a mano, manda la hora ENTENDIDA.
 *
 * @param activo puntero explícito del usuario (flechas/Home/End/hover); -1 = ninguno.
 */
export function indiceActivo(p: {
  activo: number;
  abierto: boolean;
  items: readonly string[];
  /** Lo que entendió parsearHora de lo tipeado, o null. */
  tipeada: string | null;
  /** El texto tipeado ya trimeado ('' = no se está filtrando). */
  consulta: string;
  value: string;
  ancla: string;
}): number {
  if (p.activo >= 0) return Math.min(p.activo, p.items.length - 1);
  if (!p.abierto || p.items.length === 0) return -1;
  if (p.tipeada) {
    const i = p.items.indexOf(p.tipeada);
    if (i >= 0) return i;
  }
  return p.consulta ? 0 : indiceDeAncla(p.items, p.value, p.ancla);
}

export function SelectorHora({
  value,
  onChange,
  ariaLabel = 'Hora',
  slots = null,
  cargando = false,
  nota = null,
  rango,
  ancla = ANCLA_DEFECTO,
}: {
  /** "HH:MM" o '' si todavía no se eligió. */
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  /**
   * La grilla con su disponibilidad. `null` / `undefined` = NO SE PUDO VERIFICAR:
   * se ofrece el día entero del `rango` y no se oculta un solo horario. Un array
   * VACÍO = ese día no tiene ni uno, y se dice; no se inventa una grilla.
   */
  slots?: SlotHora[] | null;
  /** true mientras se consulta la agenda: el campo queda apagado. */
  cargando?: boolean;
  /** Aviso extra debajo del campo (zona horaria, motivo del server). */
  nota?: ReactNode;
  /**
   * Con qué números se armó la grilla, tal como los devolvió el server
   * (`leerRespuestaHorarios().rango`). De acá salen la jornada y la duración de la
   * reunión, que es la que decide si una hora tipeada se pisa con algo.
   */
  rango?: RangoGrilla;
  /**
   * "HH:MM" donde ABRE la lista cuando no hay nada elegido. Si la fecha es hoy,
   * quien usa el componente manda la hora siguiente; si no, la mañana. Sin esto la
   * lista de un día completo abre en la madrugada, que no le sirve a nadie.
   */
  ancla?: string;
}) {
  const uid = useId();
  const listaId = `${uid}-lista`;
  const optId = (h: string) => `${uid}-op-${h.replace(':', '')}`;

  const r = useMemo(() => normalizarRango(rango), [rango]);
  const verificada = Array.isArray(slots);
  const sinHorarios = verificada && slots!.length === 0;

  /** Los horarios ELEGIBLES de la lista: sin verificar, el día entero; verificada, solo los libres. */
  const disponibles = useMemo(() => {
    if (!verificada) return grillaDeRango(r);
    // Ordenados sí o sí: las franjas del día se arman recorriendo la lista en
    // orden, y un slot fuera de lugar partiría "Tarde" en dos secciones.
    return slots!.filter((s) => s.libre).map((s) => s.hora).sort();
  }, [verificada, slots, r]);
  const ocultos = verificada ? slots!.filter((s) => !s.libre).length : 0;
  const listaOcultos = verificada
    ? slots!.filter((s) => !s.libre).map((s) => horaLegible(s.hora)).join(' · ')
    : '';

  const [abierto, setAbierto] = useState(false);
  /** Lo tipeado mientras se edita. `null` = no se está editando (se muestra el valor elegido). */
  const [texto, setTexto] = useState<string | null>(null);
  /**
   * Puntero EXPLÍCITO del usuario (flechas, Home/End, hover). -1 = no movió nada
   * todavía y el activo lo decide `activoIdx` de abajo. Nunca se lee directo:
   * ver el porqué en el comentario de `activoIdx`.
   */
  const [activo, setActivo] = useState(-1);
  const [pos, setPos] = useState<Posicion | null>(null);
  const cajaRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const consulta = (texto ?? '').trim();
  const tipeadaHora = consulta ? parsearHora(consulta) : null;

  // Filtro: se compara contra las CUATRO formas de escribir el mismo horario, así
  // "6:15", "615", "18:15" y "1815" encuentran todos la misma opción.
  const visibles = useMemo(() => {
    if (!consulta) return disponibles;
    const q = normalizarTexto(consulta).replace(/[\s.]/g, '');
    return disponibles.filter((h) => {
      const leg = normalizarTexto(horaLegible(h)).replace(/[\s.]/g, '');
      return h.includes(q) || h.replace(':', '').includes(q) || leg.includes(q) || h === tipeadaHora;
    });
  }, [consulta, disponibles, tipeadaHora]);

  /** La fila "usar lo que escribiste": solo cuando entendí algo que NO está en la lista. */
  const extra = tipeadaHora && !visibles.includes(tipeadaHora) ? tipeadaHora : null;
  /** El orden real de navegación con las flechas (la fila extra va primero). */
  const items = useMemo(() => (extra ? [extra, ...visibles] : visibles), [extra, visibles]);

  const choqueDe = (h: string) => evaluarChoque(h, slots ?? null, r.duracionMin);
  const choqueValor = value ? choqueDe(value) : null;

  // Posición del menú en coordenadas de viewport: vive en un PORTAL con
  // position:fixed porque el cuerpo del WizardShell scrollea y tiene overflow —
  // un menú absoluto ahí adentro se recorta contra el borde de la tarjeta.
  const medir = () => {
    const el = cajaRef.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const abajo = window.innerHeight - b.bottom;
    const arriba = abajo < 260 && b.top > abajo;
    setPos({
      left: b.left,
      width: b.width,
      ...(arriba ? { bottom: window.innerHeight - b.top + 6 } : { top: b.bottom + 6 }),
    });
  };

  /** Índice donde tiene que abrir la lista: lo elegido, o el ancla razonable. */
  const indiceAncla = (): number => indiceDeAncla(items, value, ancla);

  /** Qué opción está activa AHORA. La regla, y el bug que arregla, en indiceActivo(). */
  const activoIdx = indiceActivo({ activo, abierto, items, tipeada: tipeadaHora, consulta, value, ancla });

  const verOpcion = (i: number, block: ScrollLogicalPosition = 'nearest') => {
    const h = items[i];
    if (!h) return;
    requestAnimationFrame(() => document.getElementById(optId(h))?.scrollIntoView({ block }));
  };

  const abrir = () => {
    if (cargando || abierto) return;
    medir();
    setAbierto(true);
  };
  const cerrar = () => { setAbierto(false); setActivo(-1); };

  const elegir = (h: string) => {
    setTexto(null);
    cerrar();
    if (h !== value) onChange(h);
    inputRef.current?.focus();
  };

  /**
   * Confirma lo tipeado al salir del campo. Lo que NO se entiende no se guarda: se
   * vuelve a mostrar la hora que ya estaba. Vaciar el campo tampoco borra la
   * elección — en este paso la hora es obligatoria y quedarse sin nada por hacer
   * click afuera es perder trabajo, no una decisión.
   */
  const comprometer = () => {
    if (texto == null) return;
    const p = consulta ? parsearHora(consulta) : null;
    if (p && p !== value) onChange(p);
    setTexto(null);
  };

  // Al abrir, la lista se posiciona en el ancla en vez de arrancar en el primer
  // horario del día: con 07:00–22:00 cada 15' son 61 opciones y abrir en la
  // madrugada obliga a scrollear siempre.
  useEffect(() => {
    if (!abierto) return;
    const i = indiceAncla();
    setActivo(i);
    verOpcion(i, 'center');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Mientras se tipea, la fila activa la elige `activoIdx` y puede estar fuera de
  // la ventana visible de la lista (el eco dice 6:15 PM y la fila resaltada quedó
  // dos pantallas abajo). Se la trae a la vista con cada cambio del texto.
  useEffect(() => {
    if (!abierto || activo >= 0) return;
    verOpcion(activoIdx, 'nearest');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, abierto]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (cajaRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      cerrar();
    };
    // El menú es fixed: si la pantalla scrollea o cambia de tamaño hay que
    // RECALCULAR, no cerrar — el usuario puede estar tipeando en el campo.
    const recolocar = (e?: Event) => {
      if (e && e.type === 'scroll' && e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      medir();
    };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('scroll', recolocar, true);
    window.addEventListener('resize', recolocar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      window.removeEventListener('scroll', recolocar, true);
      window.removeEventListener('resize', recolocar);
    };
  }, [abierto]);

  const mover = (delta: number) => {
    if (items.length === 0) return;
    if (!abierto) { abrir(); return; }
    // Se parte de `activoIdx`, no de `activo`: con texto tipeado el punto de
    // partida es la hora entendida, que es la que el usuario está viendo resaltada.
    const j = Math.min(items.length - 1, Math.max(0, (activoIdx < 0 ? indiceAncla() : activoIdx) + delta));
    setActivo(j);
    verOpcion(j);
  };

  const onTecla = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); mover(1); break;
      case 'ArrowUp': e.preventDefault(); mover(-1); break;
      // Con paso de 15' una "página" es una hora: bajar de a uno son 4 teclas.
      case 'PageDown': e.preventDefault(); mover(4); break;
      case 'PageUp': e.preventDefault(); mover(-4); break;
      case 'Home': if (abierto) { e.preventDefault(); setActivo(0); verOpcion(0); } break;
      case 'End': if (abierto) { e.preventDefault(); const j = items.length - 1; setActivo(j); verOpcion(j); } break;
      case 'Enter':
        e.preventDefault();
        if (abierto && activoIdx >= 0 && items[activoIdx]) { elegir(items[activoIdx]); break; }
        // Sin opción activa manda lo tipeado: escribir "6:15" y dar Enter tiene
        // que funcionar aunque las 6:15 no existan en la lista.
        if (tipeadaHora) { elegir(tipeadaHora); break; }
        cerrar();
        break;
      case 'Escape':
        // Escape cierra la lista; si ya estaba cerrada, descarta lo tipeado.
        if (abierto) { e.preventDefault(); e.stopPropagation(); cerrar(); }
        else if (texto != null) { e.preventDefault(); e.stopPropagation(); setTexto(null); }
        break;
      case 'Tab':
        comprometer();
        cerrar();
        break;
    }
  };

  // ── Estilos ────────────────────────────────────────────────────────────────
  const campo: CSSProperties = {
    flex: 1, minWidth: 0, padding: '12px 15px', borderRadius: 11,
    border: 'none', background: 'transparent', color: 'var(--ink)',
    fontFamily: SANS, fontSize: 15, fontWeight: 600, outline: 'none', textAlign: 'left',
  };
  const caja: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    borderRadius: 11, background: 'var(--surface-2)',
    border: '1px solid ' + (abierto ? 'var(--primary)' : 'var(--border-strong)'),
    boxShadow: abierto ? '0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent)' : 'none',
    opacity: cargando ? 0.55 : 1, transition: 'border-color .15s, box-shadow .15s',
  };
  const filaOpcion = (act: boolean, sel: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '8px 11px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: act ? 'var(--surface-2)' : 'transparent',
    color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5,
    fontWeight: sel ? 700 : 500,
  });

  // ── Secciones de la lista (una por franja del día) ─────────────────────────
  const secciones = useMemo(() => {
    const out: Array<{ titulo: string; horas: string[] }> = [];
    for (const h of visibles) {
      const f = franjaDe(h);
      const ult = out[out.length - 1];
      if (ult && ult.titulo === f) ult.horas.push(h);
      else out.push({ titulo: f, horas: [h] });
    }
    return out;
  }, [visibles]);

  // Función que DEVUELVE el elemento, no un componente anidado: declarar un
  // componente adentro del render le cambia la identidad de tipo en cada pasada,
  // React desmonta y vuelve a montar las 61 filas con cada tecla, y el scroll de
  // la lista se va al principio justo mientras se navega con las flechas.
  const renderOpcion = (h: string, extraFila = false) => {
    const i = items.indexOf(h);
    const act = i >= 0 && i === activoIdx;
    const sel = h === value;
    const c = extraFila ? choqueDe(h) : null;
    return (
      <button
        key={h} type="button" role="option" id={optId(h)} aria-selected={sel}
        // mousedown por defecto saca el foco del input y dispara su blur (que
        // cierra la lista): sin este preventDefault el click nunca llega.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => elegir(h)}
        onMouseEnter={() => { if (i >= 0) setActivo(i); }}
        style={filaOpcion(act, sel)}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', flex: 'none', width: 42 }}>{h}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block' }}>{extraFila ? `Usar ${horaLegible(h)}` : horaLegible(h)}</span>
          {c && c.tipo === 'ocupado' && (
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--warn)', marginTop: 1 }}>ocupado — se puede elegir igual</span>
          )}
          {c && c.tipo === 'dudoso' && (
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--warn)', marginTop: 1 }}>
              {c.con ? `puede pisarse con las ${horaLegible(c.con)}` : 'no lo pude verificar'}
            </span>
          )}
          {c && c.tipo === 'fuera' && (
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--dim)', marginTop: 1 }}>fuera de la franja verificada</span>
          )}
        </span>
        {sel && <span style={{ flex: 'none', color: 'var(--primary)', fontSize: 13 }}>✓</span>}
      </button>
    );
  };

  // ── La línea de estado: UN solo lugar donde se explica qué pasa ────────────
  // Antes el aviso de error y el dato informativo ("Horarios en America/Tijuana")
  // se pintaban idénticos, en 12.5px gris. Ahora lo que reclama atención va en
  // --warn con un punto, y el dato de contexto queda en --dim.
  const estado: { texto: string; tono: 'warn' | 'dim' } | null = (() => {
    if (cargando) return null;
    if (texto != null && consulta && !tipeadaHora) {
      return { texto: `No entiendo «${consulta}». Probá 6:15, 18:15, 6:15 pm o «6 y cuarto».`, tono: 'warn' };
    }
    // El ECO de lo entendido, con el choque incluido: la ambigüedad de "6:15" y el
    // "ese horario ya está tomado" se resuelven en la misma línea, mientras se
    // escribe, y no después de confirmar.
    if (texto != null && tipeadaHora) {
      const c = choqueDe(tipeadaHora);
      const aviso =
        c.tipo === 'ocupado' ? ' Está ocupado: se puede elegir igual.'
        : c.tipo === 'dudoso' ? (c.con ? ` Puede pisarse con las ${horaLegible(c.con)}.` : ' No puedo asegurar que esté libre.')
        : c.tipo === 'fuera' ? ' Queda fuera de la franja que verifiqué.'
        : '';
      return { texto: `Se entendió: ${horaLegible(tipeadaHora)}.${aviso}`, tono: aviso ? 'warn' : 'dim' };
    }
    if (!choqueValor) return null;
    switch (choqueValor.tipo) {
      case 'ocupado':
        return { texto: `${horaLegible(value)} está ocupado: ${choqueValor.motivo?.trim() || 'ya hay algo agendado ahí'}. Se guarda igual si confirmás.`, tono: 'warn' };
      case 'dudoso':
        return choqueValor.con
          ? { texto: `${horaLegible(value)} puede pisarse con lo que tenés a las ${horaLegible(choqueValor.con)} (la reunión dura ${r.duracionMin} min).`, tono: 'warn' }
          : { texto: `${horaLegible(value)} cae entre los horarios que verifiqué: no puedo asegurar que esté libre.`, tono: 'warn' };
      case 'fuera':
        return { texto: `${horaLegible(value)} queda fuera de la franja que verifiqué (${horaLegible(hhmm(r.desdeMin))} a ${horaLegible(hhmm(r.hastaMin))}).`, tono: 'warn' };
      default:
        return null;
    }
  })();

  const mostrado = texto ?? (value ? horaLegible(value) : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300, margin: '0 auto', width: '100%' }}>
      <div ref={cajaRef} style={caja}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={abierto && activoIdx >= 0 && items[activoIdx] ? optId(items[activoIdx]) : undefined}
          aria-busy={cargando || undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={cargando}
          placeholder={cargando ? 'Leyendo tu agenda…' : 'Elegí o escribí la hora'}
          value={mostrado}
          // -1 y no 0: al tipear se SUELTA el puntero explícito para que vuelva a
          // mandar la hora entendida (ver `activoIdx`). Fijarlo en 0 era lo que
          // hacía que Enter guardara la primera coincidencia de texto.
          onChange={(e) => { setTexto(e.target.value); setActivo(-1); if (!abierto) abrir(); }}
          onFocus={(e) => { abrir(); e.currentTarget.select(); }}
          onBlur={() => { comprometer(); cerrar(); }}
          onKeyDown={onTecla}
          style={campo}
        />
        <button
          type="button" tabIndex={-1} aria-hidden="true" disabled={cargando}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { if (abierto) cerrar(); else { abrir(); inputRef.current?.focus(); } }}
          style={{ flex: 'none', width: 34, height: 34, marginRight: 5, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 11, cursor: cargando ? 'default' : 'pointer', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        >
          ▾
        </button>
      </div>

      {/* Un solo canal, y se ANUNCIA: el color no le llega a un lector de pantalla. */}
      <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }}>
        {cargando && (
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', letterSpacing: '.02em' }}>Leyendo tu agenda…</span>
        )}
        {estado && (
          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: estado.tono === 'warn' ? 'var(--warn)' : 'var(--dim)' }}>
            {estado.tono === 'warn' && <span aria-hidden style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', marginRight: 6, verticalAlign: 'middle' }} />}
            {estado.texto}
          </span>
        )}
        {!cargando && !verificada && (
          <span style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.45 }}>
            Agenda sin verificar: no se oculta ningún horario.
          </span>
        )}
        {/* La línea que evita mentir por omisión: se filtró, y se dice cuánto. */}
        {!cargando && verificada && ocultos > 0 && (
          <span title={listaOcultos} style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.45 }}>
            {ocultos === 1 ? '1 horario ocupado no se muestra' : `${ocultos} horarios ocupados no se muestran`}
          </span>
        )}
        {!cargando && sinHorarios && (
          <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>
            Ese día no tiene horarios libres: elegí otro día o escribí la hora igual.
          </span>
        )}
        {!cargando && nota ? <span style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45 }}>{nota}</span> : null}
      </div>

      {abierto && pos && createPortal(
        <div
          ref={menuRef} id={listaId} role="listbox" aria-label={ariaLabel}
          style={{
            position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: Math.max(pos.width, 220),
            zIndex: 1000, maxHeight: 300, overflowY: 'auto',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 16px 40px rgba(18,21,27,.22)', padding: 6,
          }}
        >
          {extra && (
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 4 }}>
              {renderOpcion(extra, true)}
            </div>
          )}
          {secciones.map((s) => (
            <div key={s.titulo} role="group" aria-label={s.titulo}>
              <div aria-hidden style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', padding: '8px 11px 4px' }}>
                {s.titulo}
              </div>
              {s.horas.map((h) => renderOpcion(h))}
            </div>
          ))}
          {/* "No coincide nada" y "no hay horarios" son cosas distintas: confundirlas
              hace pensar que el día está vacío cuando en realidad sobra el filtro. */}
          {visibles.length === 0 && (
            <div style={{ padding: '10px 11px', fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>
              {consulta
                ? `Ningún horario libre coincide con «${consulta}».`
                : verificada
                  ? 'Ese día no tiene horarios libres. Escribí la hora igual.'
                  : 'No hay horarios para ofrecer.'}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
