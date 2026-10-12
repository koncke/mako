'use client';

/**
 * LA PESTAÑA «DISEÑOS» DEL SELECTOR DE PORTADAS (app/_components/PortadaPicker.tsx), para la portada
 * de un módulo. Pedido de Martín (07/10/2026, item 5): que las láminas diseñadas aparezcan en el
 * selector —«cambio la portada de 1, y luego ya no aparecen»—, que el texto debajo del número se
 * pueda editar (por default, el nombre), varios diseños con la misma lógica, colores editables y un
 * límite de caracteres.
 *
 * Arriba la grilla de diseños DIBUJADOS con el número y el texto de ESTE módulo (se elige mirando,
 * como el resto del selector); abajo el texto, con su contador y su tope, y los dos colores del
 * diseño elegido. Todo se aplica en el acto, como el resto del selector, con dos salvedades que son
 * la misma: lo que se TIPEA (el texto, el color libre de la rueda) espera a que se deje de tipear,
 * para no mandar un guardado por tecla; y lo que quedó esperando se manda igual al cerrar.
 *
 * ⚠️ EL CUADERNO CON LOS COLORES DEL ACENTO Y SIN TEXTO PROPIO SE GUARDA COMO `null` (volver al
 *    default): es lo que dibuja una tarjeta sin portada, y una copia guardada dejaría de seguir al
 *    acento el día que cambie (`valorElegido`, index.tsx).
 * ⚠️ VA EN SU PROPIO ARCHIVO Y SE CARGA PEREZOSO desde el selector: el selector lo usan también el
 *    tablero y la ficha del cliente, que no tienen láminas, y no tienen por qué bajar los dibujos.
 */

import { useEffect, useRef, useState } from 'react';
import { ACENTOS } from '@/lib/curso-estilo';
import { RUEDA_COLOR } from '@/app/_ui/rueda-color';
import { DISENO_DEFAULT, disenoLamina, leerLamina, textoLamina, type DisenoLamina, type ValorLamina } from '@/lib/laminas';
import { LAMINAS, Lamina, coloresDeLamina, valorElegido } from './index';

/** Lo que se espera después de la última tecla antes de guardar el texto o el color libre. */
const ESPERA_MS = 450;

const inicial = (valor: string | null | undefined, acento: string | null | undefined): ValorLamina =>
  leerLamina(valor) ?? { diseno: DISENO_DEFAULT, ...coloresDeLamina(DISENO_DEFAULT, acento), texto: '' };

export function SelectorLaminas({ valor, acento, n, rotulo, titulo, quitadas = 0, onElegir }: {
  /** La portada guardada hoy (cualquier forma: una lámina, una foto, un degradado o nada). */
  valor: string | null | undefined;
  /** El acento del curso: los colores con los que nace el cuaderno. */
  acento: string | null | undefined;
  n: number;
  rotulo: string;
  /** El nombre del módulo: lo que va debajo del número mientras no haya texto propio. */
  titulo: string;
  /**
   * Cuántas veces se apretó «Sin portada» (lo cuenta el selector de arriba). Cada vez descarta lo
   * que se estaba tipeando, aunque la portada ya estuviera vacía (ver abajo).
   */
  quitadas?: number;
  onElegir: (v: string | null) => void;
}) {
  const [sel, setSel] = useState<ValorLamina>(() => inicial(valor, acento));
  /** Hay un cambio tipeado que todavía no se mandó. */
  const [sucio, setSucio] = useState(false);
  /** Lo último que se mandó: lo que vuelve por `valor` y NO tiene que pisar lo que se está tipeando. */
  const [emitido, setEmitido] = useState<string | null | undefined>(undefined);
  /** El `valor` con el que se dibujó por última vez (para notar cuándo cambia de afuera). */
  const [visto, setVisto] = useState(valor);
  /** Los colores que se le dieron a cada diseño en esta apertura: volver a uno no los pierde. */
  const [memoria, setMemoria] = useState<Record<string, { a: string; b: string }>>({});
  /** El `quitadas` con el que se dibujó por última vez (lo mismo que `visto`, para «Sin portada»). */
  const [vistas, setVistas] = useState(quitadas);

  /**
   * ⚠️ SI LA PORTADA CAMBIA DE AFUERA (el «Sin portada» de arriba, o un guardado que falló y volvió
   *    atrás), lo que se está editando se rehace desde ella y lo pendiente se descarta: si no, la
   *    espera mandaba igual la lámina vieja y deshacía el «Sin portada». Lo que vuelve por `valor`
   *    después de mandarlo uno mismo no cuenta como «de afuera». Se ajusta durante el render (el
   *    patrón de React para «un estado que sigue a una prop»), no en un efecto.
   * ⚠️ Y «SIN PORTADA» SE AVISA APARTE (`quitadas`), NO SE DEDUCE DE `valor`. Si la portada ya estaba
   *    vacía (todo módulo nuevo) o lo último que se mandó fue el cuaderno de siempre, «Sin portada»
   *    manda `null` sobre `null`: `valor` no cambia, acá no se nota nada, y medio segundo después la
   *    espera mandaba lo tipeado igual. Medido en la revisión del 08/10/2026 con un arnés en Chrome:
   *    salían `null` y DESPUÉS la lámina con el texto, o sea que ganaba lo tipeado.
   */
  if (visto !== valor || vistas !== quitadas) {
    const quito = vistas !== quitadas;
    setVisto(valor);
    setVistas(quitadas);
    if (quito || valor !== emitido) {
      setSel(inicial(quito ? null : valor, acento));
      setSucio(false);
    }
  }

  const elegir = useRef(onElegir);
  useEffect(() => { elegir.current = onElegir; });

  const mandar = (l: ValorLamina) => {
    const v = valorElegido(l, acento);
    setSel(l);
    setSucio(false);
    setEmitido(v);
    elegir.current(v);
  };

  // Lo tipeado se manda cuando se deja de tipear. El `clearTimeout` de la limpieza es lo que cancela
  // la espera si llega otra tecla o si la portada cambió de afuera (`sucio` vuelve a false).
  useEffect(() => {
    if (!sucio) return;
    const t = window.setTimeout(() => {
      const v = valorElegido(sel, acento);
      setSucio(false);
      setEmitido(v);
      elegir.current(v);
    }, ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [sel, sucio, acento]);

  // ⚠️ Y LO QUE QUEDÓ ESPERANDO SE MANDA AL CERRAR (click afuera, Escape, cambiar de pestaña): sin esto
  //    el texto tipeado en el último medio segundo se perdía sin que nada lo dijera.
  const pendiente = useRef<{ v: string | null } | null>(null);
  useEffect(() => { pendiente.current = sucio ? { v: valorElegido(sel, acento) } : null; }, [sel, sucio, acento]);
  useEffect(() => () => { if (pendiente.current) elegir.current(pendiente.current.v); }, []);

  const d = disenoLamina(sel.diseno) as DisenoLamina;
  const def = coloresDeLamina(sel.diseno, acento);
  const actual = leerLamina(valor);

  const elegirDiseno = (id: string) => {
    const nuevo = disenoLamina(id);
    if (!nuevo) return;
    const colores = id === sel.diseno ? { a: sel.a, b: sel.b } : (memoria[id] ?? coloresDeLamina(id, acento));
    // El texto viaja de un diseño a otro, recortado al tope del nuevo (los topes son parecidos, no iguales).
    mandar({ diseno: id, ...colores, texto: textoLamina(sel.texto, nuevo.tope) });
  };

  const color = (cual: 'a' | 'b', hex: string, enElActo: boolean) => {
    const l = { ...sel, [cual]: hex.toUpperCase() };
    setMemoria((m) => ({ ...m, [l.diseno]: { a: l.a, b: l.b } }));
    if (enElActo) mandar(l);
    else { setSel(l); setSucio(true); }
  };

  const largo = Array.from(sel.texto).length;

  return (
    <>
      <ul className="pp-grid pp-grid-lam">
        {LAMINAS.map((x) => {
          const on = actual ? actual.diseno === x.id : !valor && x.id === DISENO_DEFAULT;
          const c = x.id === sel.diseno ? sel : (memoria[x.id] ?? coloresDeLamina(x.id, acento));
          return (
            <li key={x.id}>
              <button type="button" className={`pp-op pp-lam${on ? ' on' : ''}`} onClick={() => elegirDiseno(x.id)}
                title={x.nombre} aria-label={x.nombre} aria-pressed={on}>
                {/* `instancia`: la tarjeta de atrás dibuja la MISMA lámina, y sus ids no se pueden pisar. */}
                <Lamina diseno={x.id} n={n} rotulo={rotulo} texto={sel.texto} nombre={titulo} a={c.a} b={c.b} instancia={`pp-${x.id}`} />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="pp-seccion pp-seccion-2">Texto</p>
      <label className="pp-lam-texto">
        <input value={sel.texto} maxLength={d.tope} placeholder={titulo} aria-label="Texto debajo del número"
          onChange={(e) => { setSel({ ...sel, texto: Array.from(e.target.value).slice(0, d.tope).join('') }); setSucio(true); }} />
        <span className="pp-lam-cuenta">{largo}/{d.tope}</span>
      </label>
      {/* «Usar el nombre» a secas: este selector es también el de la portada de una CLASE, y ahí
          «del módulo» decía otra cosa que lo que el botón hace (pone el título de la clase). */}
      <button type="button" className="pp-lam-nombre" disabled={!sel.texto} onClick={() => mandar({ ...sel, texto: '' })}>
        Usar el nombre
      </button>

      <p className="pp-seccion pp-seccion-2">{d.colorA}</p>
      <FilaColor actual={sel.a} delDiseno={def.a} onElegir={(h) => color('a', h, true)} onProbar={(h) => color('a', h, false)} />
      <p className="pp-seccion pp-seccion-2">{d.colorB}</p>
      <FilaColor actual={sel.b} delDiseno={def.b} onElegir={(h) => color('b', h, true)} onProbar={(h) => color('b', h, false)} />
    </>
  );
}

/**
 * Los colores de un lado: el del diseño primero (para poder volver), los acentos de la casa
 * (lib/curso-estilo.ts, `ACENTOS`) y la rueda para cualquier otro. Las muestras van sin rótulo, como
 * el resto del selector: el nombre viaja en el `title`.
 */
function FilaColor({ actual, delDiseno, onElegir, onProbar }: {
  actual: string; delDiseno: string; onElegir: (hex: string) => void; onProbar: (hex: string) => void;
}) {
  const muestras = [{ nombre: 'El del diseño', hex: delDiseno }, ...ACENTOS.filter((x) => x.hex.toUpperCase() !== delDiseno.toUpperCase())];
  const rueda = RUEDA_COLOR;
  const enMuestras = muestras.some((m) => m.hex.toUpperCase() === actual.toUpperCase());
  return (
    <div className="pp-colores">
      {muestras.map((m) => (
        <button key={m.hex} type="button" title={m.nombre} aria-label={m.nombre} aria-pressed={m.hex.toUpperCase() === actual.toUpperCase()}
          className={`pp-color${m.hex.toUpperCase() === actual.toUpperCase() ? ' on' : ''}`}
          style={{ background: m.hex }} onClick={() => onElegir(m.hex)} />
      ))}
      <label className={`pp-color pp-color-mas${enMuestras ? '' : ' on'}`} title="Otro color" style={{ background: rueda }}>
        <span>{'\uFF0B'}</span>
        <input type="color" value={actual.toLowerCase()} aria-label="Otro color" onChange={(e) => onProbar(e.target.value)} />
      </label>
    </div>
  );
}
