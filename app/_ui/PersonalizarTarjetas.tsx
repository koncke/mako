'use client';

// =============================================================================
// PersonalizarTarjetas — el pop-up de «Personalizar tarjetas» de TODOS los tableros (21/10/2026)
// =============================================================================
// Martín, 21/10/2026: «el pop-up debe ser mucho más grueso y poder ver TEMPLATES de estilos de tarjeta, no solo info,
// sino que otros estilos también, como las que tenemos en CLIENTES y puedes crear otras más… piensa en varios diseños»
// y «la personalización de las tarjetas en clientes, plan, etc.».
//   · A LA IZQUIERDA, LA GALERÍA: cada plantilla dibujada con la tarjeta DE VERDAD (la misma función que el tablero:
//     `vistaPrevia`), no con un dibujo aparte que pueda prometer algo que el tablero no hace. Tocar una la pone.
//     Debajo, las propias de la persona, y «Guardar como plantilla» para sumar la que está armando.
//   · A LA DERECHA, «Así queda» en grande y los DATOS, en su orden: se arrastran por el asa (y con ↑ ↓ para el
//     teclado); la casilla los saca; abajo, los que no van.
//   · En una pantalla angosta (el teléfono, un escritorio chico) las dos columnas se apilan.
// Cada cambio se ve en el acto (también en el tablero de atrás) y se guarda para quien mira. Qué se guarda y dónde lo
// decide cada tablero (`guardar`); acá, la forma de elegirlo. Lo puro de las plantillas: lib/plantillas-tarjeta.ts.
// Era app/crm/CamposTarjetaModal.tsx (13/10 y 20/10), de 460 px y con tres diseños en botones de texto.
// =============================================================================

import { useCallback, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Modal } from './Modal';
import { IconoMenu } from './iconos-menu';
import {
  MAX_NOMBRE_PLANTILLA, MAX_PLANTILLAS_PROPIAS, esPropia, guardarPlantillaPropia, idPlantillaNueva, plantillaPuesta,
  type PlantillaTarjeta,
} from '@/lib/plantillas-tarjeta';

export type ResultadoGuardarTarjeta = { ok: true } | { ok: false; error: string };

export function PersonalizarTarjetas<F extends string, C extends string>({
  titulo = 'Personalizar tarjetas', fabrica, propias, forma, campos, catalogo, nombreCampo, guardable, guardar, onCambio, onCerrar,
  vistaPrevia, sinMuestra, ayudaDatos, ordenFijo = false,
}: {
  titulo?: string;
  /** Las de la casa, la de siempre primero. */
  fabrica: readonly PlantillaTarjeta<F, C>[];
  /** Las de la persona. */
  propias: readonly PlantillaTarjeta<F, C>[];
  forma: F;
  campos: readonly C[];
  /** Todos los datos que la tarjeta sabe mostrar, en el orden de «Más info». */
  catalogo: readonly C[];
  nombreCampo: Readonly<Record<C, string>>;
  /** Sin fila propia (la sesión compartida vieja) se ve igual, pero no se guarda: se dice. */
  guardable: boolean;
  /** Guarda lo elegido; `propias` sólo viaja cuando cambiaron. */
  guardar: (forma: F, campos: C[], propias?: PlantillaTarjeta<F, C>[]) => Promise<ResultadoGuardarTarjeta>;
  /** El tablero de atrás cambia en el acto (y vuelve atrás si no se pudo guardar). */
  onCambio: (forma: F, campos: C[], propias: PlantillaTarjeta<F, C>[]) => void;
  onCerrar: () => void;
  /** La tarjeta de verdad con esa forma y esos datos; null = el tablero está vacío. */
  vistaPrevia: ((forma: F, campos: readonly C[]) => ReactNode) | null;
  /** Lo que dice la vista previa sin nada que mostrar: «Carga un lead para ver cómo queda». */
  sinMuestra: string;
  /** Una línea debajo de «Datos, en su orden»: «El nombre va siempre». */
  ayudaDatos?: string;
  /**
   * Cada dato tiene SU lugar en la tarjeta y el orden no cambia nada (Clientes, 21/10/2026: la cara, la empresa, la
   * barra y el chip van donde van). Sin arrastre ni ↑ ↓, y lo que se suma entra en el orden del catálogo: un orden que
   * no se ve sólo haría que «Completa» dejara de reconocerse. El porqué, en lib/tarjeta-clientes.ts.
   */
  ordenFijo?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [arrastrado, setArrastrado] = useState<number | null>(null);
  const [nombreNueva, setNombreNueva] = useState('');
  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  const todas = [...fabrica, ...propias];
  const puesta = plantillaPuesta(todas, forma, campos);

  const aplicar = async (f: F, cs: C[], ps?: PlantillaTarjeta<F, C>[]) => {
    const antes = { f: forma, cs: [...campos], ps: [...propias] };
    onCambio(f, cs, ps ?? [...propias]);
    setError(null);
    if (!guardable) return;
    setGuardando(true);
    const r = await guardar(f, cs, ps).catch((): ResultadoGuardarTarjeta => ({ ok: false, error: 'Sin conexión.' }));
    setGuardando(false);
    if (!r.ok) { onCambio(antes.f, antes.cs, antes.ps); setError(r.error); }
  };
  const elegir = (p: PlantillaTarjeta<F, C>) => { if (!guardando && p.id !== puesta?.id) void aplicar(p.forma, [...p.campos]); };
  const quitarCampo = (c: C) => void aplicar(forma, campos.filter((x) => x !== c));
  const sumarCampo = (c: C) => void aplicar(forma, ordenFijo ? catalogo.filter((x) => x === c || campos.includes(x)) : [...campos, c]);
  const moverCampo = (de: number, a: number) => {
    if (a < 0 || a >= campos.length || de === a) return;
    const cs = [...campos];
    const [x] = cs.splice(de, 1);
    cs.splice(a, 0, x);
    void aplicar(forma, cs);
  };
  const guardarComoPlantilla = () => {
    const r = guardarPlantillaPropia(propias, nombreNueva, forma, campos, idPlantillaNueva());
    if (!r.ok) { setError(r.error === 'lleno' ? `Ya tienes ${MAX_PLANTILLAS_PROPIAS} plantillas: borra una para guardar otra.` : 'Ponle un nombre.'); return; }
    setNombreNueva('');
    void aplicar(forma, [...campos], r.propias);
  };
  const borrarPlantilla = (p: PlantillaTarjeta<F, C>) => void aplicar(forma, [...campos], propias.filter((x) => x.id !== p.id));
  const fuera = catalogo.filter((c) => !campos.includes(c));

  const rotulo: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 8px' };
  const flecha: CSSProperties = { border: 'none', background: 'none', padding: '0 4px', color: 'var(--dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1 };

  const miniatura = (p: PlantillaTarjeta<F, C>) => {
    const activa = p.id === puesta?.id;
    const alTeclado = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(p); } };
    return (
      // ⚠️ UN `div` CON ROL Y NO UN `<button>`: adentro va la tarjeta de verdad, que trae su píldora «Ver info» (un
      // botón), y un botón adentro de otro no es HTML válido. La tarjeta va `inert`: se mira, no se toca.
      <div key={p.id} role="radio" aria-checked={activa} tabIndex={0} aria-label={p.nombre} data-plantilla={p.id}
        onClick={() => elegir(p)} onKeyDown={alTeclado} className="pt-mini"
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 18, cursor: guardando ? 'default' : 'pointer', minWidth: 0,
          border: `1.5px solid ${activa ? 'var(--primary)' : 'var(--border)'}`, background: activa ? 'var(--primary-bg)' : 'var(--fondo-columna)' }}>
        <div inert style={{ pointerEvents: 'none', minWidth: 0 }}>
          {vistaPrevia ? vistaPrevia(p.forma, p.campos) : <div style={{ height: 64, borderRadius: 16, background: 'var(--surface)' }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {activa ? <IconoMenu nombre="check" size={14} style={{ color: 'var(--primary)' }} /> : null}
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 650, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</span>
          {esPropia(p) && (
            <button type="button" aria-label={`Borrar la plantilla ${p.nombre}`} title="Borrar la plantilla" disabled={guardando}
              onClick={(e) => { e.stopPropagation(); borrarPlantilla(p); }} onKeyDown={(e) => e.stopPropagation()}
              style={{ display: 'inline-flex', border: 'none', background: 'none', padding: 2, cursor: 'pointer' }}>
              <IconoMenu nombre="borrar" size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal titulo={titulo} ancho={1060} onCerrar={cerrar}>
      <style href="mk-personalizar-tarjetas" precedence="medium">{CSS}</style>
      <div className="pt-grid">
        <section aria-label="Plantillas" style={{ minWidth: 0 }}>
          <h4 style={rotulo}>Plantillas</h4>
          <div role="radiogroup" aria-label="Plantillas de la tarjeta" className="pt-galeria">{fabrica.map(miniatura)}</div>
          {propias.length > 0 && (
            <>
              <h4 style={{ ...rotulo, marginTop: 18 }}>Tus plantillas</h4>
              <div role="radiogroup" aria-label="Tus plantillas" className="pt-galeria">{propias.map(miniatura)}</div>
            </>
          )}
          {/* GUARDAR LA QUE ESTÁ ARMANDO: «puedes crear otras más». Con el mismo nombre, la reemplaza. */}
          <form onSubmit={(e) => { e.preventDefault(); guardarComoPlantilla(); }}
            style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <input value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} maxLength={MAX_NOMBRE_PLANTILLA}
              placeholder={puesta ? 'Nombre de tu plantilla' : 'Nombre de esta plantilla'} aria-label="Nombre de la plantilla nueva" disabled={guardando}
              style={{ flex: '1 1 200px', minWidth: 0, height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14 }} />
            <button type="submit" disabled={guardando || !nombreNueva.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 650, cursor: 'pointer', opacity: guardando || !nombreNueva.trim() ? 0.5 : 1 }}>
              <IconoMenu nombre="agregar" size={15} /> Guardar como plantilla
            </button>
          </form>
        </section>

        <section aria-label="Así queda" style={{ minWidth: 0 }}>
          <h4 style={rotulo}>Así queda{puesta ? ` · ${puesta.nombre}` : ' · Personalizada'}</h4>
          <div aria-label="Así queda la tarjeta" style={{ background: 'var(--fondo-columna)', borderRadius: 20, padding: 12, marginBottom: 16 }}>
            {vistaPrevia ? vistaPrevia(forma, campos) : <p style={{ margin: 6, fontSize: 13, color: 'var(--dim)' }}>{sinMuestra}</p>}
          </div>

          <h4 style={{ ...rotulo, marginBottom: 4 }}>{ordenFijo ? 'Datos' : 'Datos, en su orden'}</h4>
          {ayudaDatos ? <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--dim)' }}>{ayudaDatos}</p> : null}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Los datos que muestra la tarjeta">
            {campos.map((c, i) => (
              <li key={c} draggable={!guardando && !ordenFijo} data-campo-tarjeta={c}
                onDragStart={(e) => { setArrastrado(i); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { if (arrastrado != null) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (arrastrado != null) moverCampo(arrastrado, i); setArrastrado(null); }}
                onDragEnd={() => setArrastrado(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 10, marginBottom: 2,
                  background: arrastrado === i ? 'var(--surface-2)' : 'transparent', cursor: guardando || ordenFijo ? 'default' : 'grab' }}>
                <span aria-hidden style={{ color: 'var(--faint)', fontSize: 14, width: 14, textAlign: 'center', userSelect: 'none' }}>{ordenFijo ? '' : '⋮⋮'}</span>
                <input type="checkbox" checked onChange={() => quitarCampo(c)} disabled={guardando} aria-label={`Sacar ${nombreCampo[c]}`}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer', flex: 'none' }} />
                <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)' }}>{nombreCampo[c]}</span>
                {!ordenFijo && (
                  <>
                    <button type="button" style={flecha} disabled={guardando || i === 0} onClick={() => moverCampo(i, i - 1)} aria-label={`Subir ${nombreCampo[c]}`}>↑</button>
                    <button type="button" style={flecha} disabled={guardando || i === campos.length - 1} onClick={() => moverCampo(i, i + 1)} aria-label={`Bajar ${nombreCampo[c]}`}>↓</button>
                  </>
                )}
              </li>
            ))}
          </ol>
          {fuera.length > 0 && (
            <>
              <h4 style={{ ...rotulo, margin: '12px 0 4px' }}>Más info</h4>
              {fuera.map((c) => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 28px', cursor: 'pointer', fontSize: 14, color: 'var(--ink)' }}>
                  <input type="checkbox" checked={false} onChange={() => sumarCampo(c)} disabled={guardando}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer', flex: 'none' }} />
                  {nombreCampo[c]}
                </label>
              ))}
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <button type="button" disabled={guardando} onClick={() => elegir(fabrica[0])}
              style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Volver a lo de siempre
            </button>
            <span style={{ flex: 1 }} />
            {!guardable && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Sin guardar: vale en esta pestaña.</span>}
          </div>
          {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bad)' }}>{error}</p>}
        </section>
      </div>
    </Modal>
  );
}

// Las dos columnas y la galería. En una pantalla angosta se apilan: la galería arriba (es a lo que se viene), de a dos.
const CSS = `
.pt-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, 1fr); gap: 26px; align-items: start; }
.pt-galeria { display: grid; grid-template-columns: repeat(auto-fill, minmax(214px, 1fr)); gap: 12px; align-items: start; }
.pt-mini:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
@media (max-width: 860px) { .pt-grid { grid-template-columns: minmax(0, 1fr); gap: 18px; } }
@media (max-width: 520px) { .pt-galeria { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } }
`;
