'use client';

// =============================================================================
// KanbanM — el tablero de MaKo en el teléfono: una columna por pantalla (v3, 14/10/2026)
// =============================================================================
// Martín (14/10/2026): «quiero que TODOS los kanban que hay en MaKo se vean en mobile», y «en el
// celular todo se ve SIMILAR al escritorio, pero con menos texto». Así que el tablero es el MISMO
// (las mismas columnas, en el mismo orden) y lo que cambia es el ancho: una columna ocupa la
// pantalla y la siguiente asoma a la derecha. Lo usan el CRM, Clientes (la entrega) y el Plan
// (Tareas y Proyectos). El prototipo aprobado: docs/prototipos/mako-mobile-tableros.html.
//
//   · Arriba, la BARRA DE ETAPAS: una rayita por columna con su conteo, la actual en azul.
//     Tocar una lleva a esa columna (44 de toque aunque la rayita mida 5).
//   · Las columnas: scroll horizontal NATIVO con scroll-snap (la física del sistema, no un
//     resorte propio), y cada columna scrollea sola hacia abajo.
//   · Tocar una tarjeta: su `href` (la ficha) o `onTocar` (un sheet de la pantalla).
//   · MANTENER PRESIONADA (450 ms sin moverse 8 px): un tic, la tarjeta se levanta y abre
//     «Mover a…» con las columnas a las que PUEDE ir (`moverA`). Elegir una la mueve en el
//     acto (optimista), late el conteo de la columna de destino y sale el toast con
//     «Deshacer». Si el servidor dice que no, vuelve a su lugar y el toast dice por qué.
//     El gesto no es el único camino: cada pantalla deja cambiar la etapa también desde lo
//     que abre el toque (la ficha, el sheet), porque un gesto sin señal es para expertos.
//
// ⚠️ offsetWidth y no getBoundingClientRect para la cuenta de columnas: el ancho de diseño, no
// el dibujado (en el prototipo el teléfono está escalado; acá, un zoom del navegador).
// ⚠️ Las columnas llevan `data-m-scroll`: PantallaM no arranca el pull-to-refresh si el dedo
// cae en una columna que no está arriba de todo (sería tirar de la página y de la lista a la vez).
// =============================================================================

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { Icon } from '@/app/_components/icons';
import { useToastM } from './contexto';
import { SheetM } from './SheetM';
import { ListaM } from './Piezas';

export type ColumnaKanban = {
  key: string;
  titulo: string;
  /** A la derecha del título: la suma de la columna («$4.200»), corta. */
  total?: ReactNode;
  /**
   * Cuántas hay DE VERDAD, si al teléfono viajan menos (un tope por columna). El conteo dice
   * este número y el pie de la columna, cuántas más hay en la computadora.
   */
  cuantos?: number;
};

export type TarjetaKanban = {
  id: string;
  /** La `key` de su columna. */
  col: string;
  /** Lo que se dibuja adentro (las clases `m-kb-tj__*` de m.css). */
  contenido: ReactNode;
  /** El nombre accesible y el subtítulo de «Mover a…» (el nombre del lead, de la tarea). */
  etiqueta: string;
  /** Tocar navega acá (la ficha). Sin href, tocar llama a `onTocar`. */
  href?: string;
};

/** Lo que devuelve mover: si salió, y cómo deshacerlo (si se puede). */
export type ResultadoMover =
  | { ok: true; deshacer?: () => Promise<boolean> }
  | { ok: false; error: string };

export type KanbanMProps = {
  /** El nombre del tablero para el lector de pantalla («Etapas del CRM»). */
  etiqueta: string;
  columnas: ColumnaKanban[];
  tarjetas: TarjetaKanban[];
  /** «leads», «tareas»: la columna vacía dice «Sin leads». */
  unidades: string;
  /** Arriba de la barra de etapas: el selector de funnel, de producto. */
  arriba?: ReactNode;
  onTocar?: (id: string) => void;
  /** A qué columnas puede ir esta tarjeta desde el teléfono. Vacío o sin la función: no se mueve. */
  moverA?: (id: string) => string[];
  onMover?: (id: string, destino: string) => Promise<ResultadoMover>;
  /** El título del sheet: «Mover a…» (CRM, Clientes) o «Prioridad» (Plan). */
  tituloMover?: string;
  /** El toast al mover: «Pasó a Agendado» / «Ahora en Alta». */
  fraseMovida?: (columna: string) => string;
  /** La columna en la que abre (la key). Por defecto, la primera con algo. */
  inicial?: string;
};

const ESPACIO = 10; // el gap entre columnas (m.css, .m-kb__pista)
const LARGO_MS = 450;
const TOLERANCIA = 8;

function sinMovimiento(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function KanbanM(p: KanbanMProps) {
  const toast = useToastM();
  const pista = useRef<HTMLDivElement>(null);
  // Lo movido en el teléfono que el servidor todavía no devolvió: id → columna. Se limpia
  // cuando llegan datos nuevos (un refresh ya los trae en su lugar).
  const [movidas, setMovidas] = useState<Record<string, string>>({});
  const [arribaDeTodo, setArribaDeTodo] = useState<string[]>([]);
  const [actual, setActual] = useState(0);
  const [late, setLate] = useState<{ col: string; n: number } | null>(null);
  const [seVa, setSeVa] = useState<string | null>(null);
  const [llego, setLlego] = useState<string | null>(null);
  const [agarrada, setAgarrada] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const presion = useRef<{ id: string; x: number; y: number; t: ReturnType<typeof setTimeout>; largo: boolean } | null>(null);
  // Las tarjetas con un mover (o un deshacer) en vuelo: no se vuelven a mover hasta que el server
  // conteste. Sin esto, mover dos veces la misma antes de que vuelva la primera dejaba al Deshacer
  // de la segunda con un «antes» que el server ya había pisado (verificado el 14/10/2026).
  const enVuelo = useRef(new Set<string>());

  // Por la FIRMA (id:columna de cada una) y no por la identidad del array: una pantalla que arma
  // las tarjetas en cada render no tiene que acordarse de memorizarlas para que mover no rebote.
  const firma = p.tarjetas.map((t) => `${t.id}:${t.col}`).join('|');
  useEffect(() => { setMovidas({}); setArribaDeTodo([]); }, [firma]);

  const tarjetas = useMemo(() => {
    const conLugar = p.tarjetas.map((t) => (movidas[t.id] ? { ...t, col: movidas[t.id] } : t));
    if (!arribaDeTodo.length) return conLugar;
    const rango = (id: string) => { const i = arribaDeTodo.indexOf(id); return i < 0 ? Infinity : i; };
    return [...conLugar].sort((a, b) => rango(a.id) - rango(b.id));
  }, [p.tarjetas, movidas, arribaDeTodo]);

  // Lo que trajo el server por columna (sin lo movido acá): la base de `cuantos`.
  const base = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of p.tarjetas) m.set(t.col, (m.get(t.col) ?? 0) + 1);
    return m;
  }, [p.tarjetas]);
  /** El conteo de una columna: el real (`cuantos`) más lo que entró o salió en el teléfono. */
  const cuenta = (c: ColumnaKanban, enLista: number) => (c.cuantos ?? (base.get(c.key) ?? 0)) + enLista - (base.get(c.key) ?? 0);

  const porColumna = useMemo(() => {
    const m = new Map<string, TarjetaKanban[]>(p.columnas.map((c) => [c.key, []]));
    for (const t of tarjetas) m.get(t.col)?.push(t);
    return m;
  }, [tarjetas, p.columnas]);

  const anchoCol = () => {
    const c = pista.current?.querySelector<HTMLElement>('.m-kb__col');
    return c && c.offsetWidth ? c.offsetWidth + ESPACIO : 1;
  };
  const marcar = () => {
    const el = pista.current;
    if (!el) return;
    setActual(Math.max(0, Math.min(p.columnas.length - 1, Math.round(el.scrollLeft / anchoCol()))));
  };
  const irA = (i: number, suave = true) => {
    const el = pista.current;
    if (!el) return;
    el.scrollTo({ left: i * anchoCol(), behavior: suave && !sinMovimiento() ? 'smooth' : 'auto' });
    setActual(i);
  };

  // Abre en la columna pedida o en la primera que tiene algo (un tablero que abre en una
  // columna vacía parece un tablero vacío). Sólo al montar: después manda el dedo.
  useEffect(() => {
    const i = p.inicial ? p.columnas.findIndex((c) => c.key === p.inicial) : p.columnas.findIndex((c) => (porColumna.get(c.key)?.length ?? 0) > 0);
    if (i > 0) irA(i, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tarjetaMovida = moviendo ? tarjetas.find((t) => t.id === moviendo) ?? null : null;
  const destinos = tarjetaMovida && p.moverA ? new Set(p.moverA(tarjetaMovida.id)) : new Set<string>();

  // ── El gesto: tocar abre; mantener presionado abre «Mover a…» ─────────────
  const puedeMover = (id: string) => !!p.onMover && !!p.moverA && !enVuelo.current.has(id) && p.moverA(id).length > 0;
  const abajo = (e: PointerEvent, id: string) => {
    if (e.button > 0 || !puedeMover(id)) return;
    const x = e.clientX, y = e.clientY;
    const t = setTimeout(() => {
      if (!presion.current || presion.current.id !== id) return;
      presion.current.largo = true;
      haptico('medium');
      setAgarrada(id);
      setTimeout(() => { setAgarrada(null); setMoviendo(id); }, 160);
    }, LARGO_MS);
    presion.current = { id, x, y, t, largo: false };
  };
  const mueve = (e: PointerEvent) => {
    const pr = presion.current;
    if (!pr || pr.largo) return;
    if (Math.abs(e.clientX - pr.x) > TOLERANCIA || Math.abs(e.clientY - pr.y) > TOLERANCIA) { clearTimeout(pr.t); presion.current = null; }
  };
  const suelta = () => { const pr = presion.current; if (pr && !pr.largo) { clearTimeout(pr.t); presion.current = null; } };
  const toca = (e: MouseEvent, t: TarjetaKanban) => {
    const fueLargo = presion.current?.largo && presion.current.id === t.id;
    presion.current = null;
    if (fueLargo) { e.preventDefault(); return; }
    if (!t.href) p.onTocar?.(t.id);
  };

  // ── Mover: optimista, con «Deshacer» ───────────────────────────────────────
  const latir = (col: string) => setLate((l) => ({ col, n: (l?.n ?? 0) + 1 }));
  const ponerEn = (id: string, col: string) => {
    setMovidas((m) => ({ ...m, [id]: col }));
    setArribaDeTodo((a) => [id, ...a.filter((x) => x !== id)]);
  };
  const tituloDe = (key: string) => p.columnas.find((c) => c.key === key)?.titulo ?? key;

  const mover = async (id: string, destino: string) => {
    const antes = tarjetas.find((t) => t.id === id)?.col;
    if (!antes || antes === destino || !p.onMover || enVuelo.current.has(id)) return;
    setMoviendo(null);
    enVuelo.current.add(id);
    // ⚠️ EL TIMER DE LA SALIDA SE CANCELA SI MOVER FALLA. Sin red, la action rechaza en el acto:
    // la rama de error devolvía la tarjeta y 220 ms después el timer la volvía a poner en el
    // destino, para siempre (un refresh trae la misma firma y no limpia nada). Medido el 14/10/2026.
    let salida: ReturnType<typeof setTimeout> | null = null;
    const aplicar = () => { salida = null; setSeVa(null); ponerEn(id, destino); latir(destino); };
    if (sinMovimiento()) aplicar();
    else { setSeVa(id); salida = setTimeout(aplicar, 220); }
    let r: ResultadoMover;
    try { r = await p.onMover(id, destino); } catch { r = { ok: false, error: 'No se pudo mover' }; }
    if (!r.ok) {
      if (salida) { clearTimeout(salida); salida = null; }
      setSeVa(null);
      ponerEn(id, antes); latir(antes); setLlego(id);
      enVuelo.current.delete(id);
      haptico('error');
      toast(r.error);
      return;
    }
    enVuelo.current.delete(id);
    haptico('success');
    const deshacer = r.deshacer;
    toast(p.fraseMovida ? p.fraseMovida(tituloDe(destino)) : `Pasó a ${tituloDe(destino)}`, deshacer ? {
      deshacer: () => {
        if (enVuelo.current.has(id)) return;
        enVuelo.current.add(id);
        if (salida) { clearTimeout(salida); salida = null; setSeVa(null); }
        ponerEn(id, antes); latir(antes); setLlego(id);
        void deshacer().catch(() => false).then((ok) => {
          enVuelo.current.delete(id);
          if (ok) { toast('Volvió'); return; }
          ponerEn(id, destino); latir(destino);
          toast('No se pudo deshacer');
        });
      },
    } : undefined);
  };

  useEffect(() => {
    if (!llego) return;
    const t = setTimeout(() => setLlego(null), 1400);
    return () => clearTimeout(t);
  }, [llego]);

  const cols = p.columnas;
  return (
    <div className="m-kb" aria-label={p.etiqueta} role="region">
      {p.arriba && <div className="m-kb__arriba">{p.arriba}</div>}

      <div className="m-kb__etapas" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }} aria-label="Ir a una columna">
        {cols.map((c, i) => {
          const n = cuenta(c, porColumna.get(c.key)?.length ?? 0);
          return (
            <button
              key={c.key}
              type="button"
              className="m-kb__etapa"
              data-vacia={n === 0 || undefined}
              aria-current={i === actual ? 'true' : undefined}
              aria-label={`${c.titulo}: ${n}`}
              onClick={() => irA(i)}
            >
              <i />
              <b key={late?.col === c.key ? `l${late.n}` : 'q'} data-late={late?.col === c.key || undefined}>{n}</b>
            </button>
          );
        })}
      </div>

      <div
        ref={pista}
        className="m-kb__pista"
        tabIndex={0}
        aria-label="Columnas"
        onScroll={() => requestAnimationFrame(marcar)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          irA(Math.max(0, Math.min(cols.length - 1, actual + (e.key === 'ArrowRight' ? 1 : -1))));
        }}
      >
        {cols.map((c) => {
          const lista = porColumna.get(c.key) ?? [];
          const n = cuenta(c, lista.length);
          const fuera = c.cuantos != null ? c.cuantos - (base.get(c.key) ?? 0) : 0;
          return (
            <section key={c.key} className="m-kb__col" aria-label={`${c.titulo}: ${n}`}>
              <header className="m-kb__col-cab">
                <h3>{c.titulo}</h3>
                <span className="m-kb__cuenta">{n}</span>
                {c.total != null && <span className="m-kb__total">{c.total}</span>}
              </header>
              <div className="m-kb__lista" data-m-scroll>
                {lista.length === 0 && <p className="m-kb__vacia">Sin {p.unidades}</p>}
                {lista.map((t) => {
                  const attrs = {
                    className: 'm-kb-tj',
                    'data-agarrada': agarrada === t.id || undefined,
                    'data-se-va': seVa === t.id || undefined,
                    'data-llego': llego === t.id || undefined,
                    'aria-label': t.etiqueta,
                    onPointerDown: (e: PointerEvent) => abajo(e, t.id),
                    onPointerMove: mueve,
                    onPointerUp: suelta,
                    onPointerCancel: () => { const pr = presion.current; if (pr) clearTimeout(pr.t); presion.current = null; },
                    onContextMenu: (e: MouseEvent) => { if (puedeMover(t.id)) e.preventDefault(); },
                  };
                  return t.href
                    ? <Link key={t.id} href={t.href} {...attrs} onClick={(e: MouseEvent) => toca(e, t)}>{t.contenido}</Link>
                    : <button key={t.id} type="button" {...attrs} onClick={(e) => toca(e, t)}>{t.contenido}</button>;
                })}
                {fuera > 0 && <p className="m-kb__vacia">{fuera === 1 ? '1 más' : `${fuera} más`}, en la computadora</p>}
              </div>
            </section>
          );
        })}
      </div>

      <SheetM
        abierto={!!tarjetaMovida}
        onCerrar={() => setMoviendo(null)}
        titulo={p.tituloMover ?? 'Mover a…'}
        id="mover"
      >
        {tarjetaMovida && (
          <>
            <p className="m-kb__sub">{tarjetaMovida.etiqueta}</p>
            <ListaM>
              {cols.filter((c) => c.key === tarjetaMovida.col || destinos.has(c.key)).map((c) => {
                const aca = c.key === tarjetaMovida.col;
                return (
                  <button
                    key={c.key}
                    type="button"
                    className="m-kb__destino"
                    aria-disabled={aca || undefined}
                    aria-current={aca ? 'true' : undefined}
                    onClick={() => { if (!aca) void mover(tarjetaMovida.id, c.key); }}
                  >
                    <span className="m-kb__destino-n">{c.titulo}</span>
                    {aca
                      ? <span className="m-kb__aca">Aquí <Icon name="check" size={18} /></span>
                      : <span className="m-kb__destino-r">{cuenta(c, porColumna.get(c.key)?.length ?? 0)}</span>}
                  </button>
                );
              })}
            </ListaM>
          </>
        )}
      </SheetM>
    </div>
  );
}
