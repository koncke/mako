'use client';

// =============================================================================
// ExportarCerebro — «me llevo esto», con el MISMO control que el mapa
// =============================================================================
// Antes eran dos sistemas para la misma idea. El mapa filtraba por carpeta, sección y
// autoría con un desplegable de drill-down; el exportador preguntaba con diez casillas
// de área. Nada más que el nombre de una de las tres dimensiones coincidía, así que
// para bajar «lo que dedujo MaKo en Oferta» había que traducirlo a mano — y no se
// podía, porque la autoría no existía acá.
//
// Ahora la pregunta la contesta `FiltroMapa`, el mismo componente de la barra del
// lienzo, sobre el mismo `EstadoFiltro` y con el mismo predicado (`pasaFiltro`, en
// lib/cerebro-filtro.ts). El que aprendió a filtrar el mapa ya sabe exportar.
//
// TRES DECISIONES QUE NO SON OBVIAS:
//
// 1. EL FILTRO ES UNA COPIA, no el del mapa. Se siembra con el del mapa —abrir el modal
//    con el mapa filtrado propone bajar eso— pero tocarlo acá no mueve el lienzo de
//    atrás. Un modal que reescribe la pantalla que lo abrió deja al usuario en un lugar
//    distinto del que dejó al cancelar.
// 2. LA LISTA DE ARCHIVOS SE VE. Un filtro dice qué NO entra; en una descarga lo que
//    importa es qué SÍ. Con las casillas de área uno confiaba en un número; ahora se ve
//    el árbol de carpetas que va a salir, que es literalmente lo que se abre después.
// 3. NO HAY PREGUNTA DE FORMATO. Sigue valiendo el criterio viejo: un paso cuya
//    respuesta es siempre la misma es un paso que sobra.
// =============================================================================

import { useMemo, useState } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { AREAS, type AreaId, type Cerebro, type NodoCerebro } from '@/lib/cerebro-modelo';
import { clonarFiltro, cuentaFiltros, filtroVacio, pasaFiltro, type EstadoFiltro } from '@/lib/cerebro-filtro';
import { carpetaDe, esArchivo } from '@/lib/vault-modelo';
import { MONO } from '@/app/_ui/tokens';
import { FiltroMapa, type PanelAbierto } from './FiltroMapa';

export function ExportarCerebro({ cerebro, filtroMapa, onClose }: {
  cerebro: Cerebro;
  /** El filtro que tiene puesto el mapa ahora mismo. Solo se usa para SEMBRAR. */
  filtroMapa: EstadoFiltro;
  onClose: () => void;
}) {
  const [filtro, setFiltro] = useState<EstadoFiltro>(() => clonarFiltro(filtroMapa));
  const [abierto, setAbierto] = useState<PanelAbierto>(null);
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState('');

  /** Los nodos que van a salir. `esArchivo` es la misma condición que usa el armador del
   *  ZIP y `pasaFiltro` la misma que dibuja el mapa: acá no hay una tercera regla. */
  const entran = useMemo(
    () => cerebro.nodos.filter((n: NodoCerebro) => esArchivo(n) && pasaFiltro(n, filtro)),
    [cerebro.nodos, filtro],
  );

  /** El árbol que va a tener el ZIP, para mostrarlo antes de bajarlo. */
  const arbol = useMemo(() => {
    const porArea = new Map<AreaId, number>();
    for (const n of entran) porArea.set(n.area, (porArea.get(n.area) ?? 0) + 1);
    const porCarpeta = new Map<string, Array<{ nombre: string; n: number }>>();
    for (const a of AREAS) {
      const n = porArea.get(a.id) ?? 0;
      if (!n) continue;
      const madre = carpetaDe(a.id).split('/')[0];
      const lista = porCarpeta.get(madre) ?? [];
      lista.push({ nombre: a.nombre, n });
      porCarpeta.set(madre, lista);
    }
    return [...porCarpeta.entries()];
  }, [entran]);

  /** Los conteos por sección, para que el desplegable diga cuánto hay detrás de cada
   *  opción. Sale del mismo `esArchivo` que el ZIP, así que el número del menú y el
   *  número del README no pueden discrepar. */
  const conteoArea = useMemo(() => {
    const c: Partial<Record<AreaId, number>> = {};
    for (const n of cerebro.nodos) if (esArchivo(n)) c[n.area] = (c[n.area] ?? 0) + 1;
    return c;
  }, [cerebro.nodos]);

  const conteoAutoria = useMemo(() => {
    let mako = 0; let usuario = 0; let falta = 0;
    for (const n of cerebro.nodos) {
      if (n.id === 'raiz' || n.id.startsWith('area:') || n.id.startsWith('n1:')) continue;
      if (n.autoria === 'pendiente') falta += 1;
      else if (n.autoria === 'usuario') usuario += 1;
      else mako += 1;
    }
    return { mako, usuario, falta };
  }, [cerebro.nodos]);

  const archivos = entran.length;
  const hayAlgo = archivos > 0;
  const recortado = cuentaFiltros(filtro) > 0;

  async function bajar() {
    setBajando(true);
    setError('');
    try {
      const r = await fetch('/api/second-brain/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Se manda el RESULTADO (los ids) y no los criterios: el servidor no tiene que
        // volver a interpretar el filtro, y así no hay dos lecturas de lo mismo.
        // `areas` va igual porque es lo que arma las carpetas del ZIP.
        body: JSON.stringify({
          areas: [...new Set(entran.map((n) => n.area))],
          ids: recortado ? entran.map((n) => n.id) : undefined,
        }),
      });
      if (!r.ok) throw new Error(`el servidor devolvió ${r.status}`);
      const blob = await r.blob();
      // El nombre lo pone el servidor en el Content-Disposition: es el único que sabe
      // cómo se llama el negocio.
      const cd = r.headers.get('content-disposition') ?? '';
      const nombre = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'segundo-cerebro.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Diferido: revocar en la misma vuelta cancela la descarga en Safari.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBajando(false);
    }
  }

  const resumen = `${archivos} ${archivos === 1 ? 'archivo' : 'archivos'}`;

  return (
    <WizardShell
      titulo="Exportar tu segundo cerebro"
      pasos={['Qué te llevas']}
      pasoActual="Qué te llevas"
      pregunta="¿Qué te llevas?"
      ancho={760}
      puedeAvanzar={hayAlgo}
      enUltimo
      confirmLabel={bajando ? 'Armando el ZIP…' : hayAlgo ? `Descargar ${resumen} ↓` : 'No hay nada para bajar'}
      atrasLabel="Cancelar"
      onAtras={onClose}
      onSiguiente={() => {}}
      onConfirmar={() => { if (hayAlgo && !bajando) void bajar(); }}
      onClose={onClose}
      extraFooter={
        <span style={{ fontFamily: MONO, fontSize: 11, color: error ? 'var(--bad)' : 'var(--faint)' }}>
          {error ? `No se pudo: ${error}` : `${resumen} + README`}
        </span>
      }
    >
      {/* `textAlign: left` explícito: `WizardShell` centra su contenido, que está bien
          para una pregunta y mal para un árbol de carpetas y un párrafo de ayuda. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <FiltroMapa
            filtro={filtro}
            onFiltro={setFiltro}
            abierto={abierto}
            onAbrir={setAbierto}
            conteoArea={conteoArea}
            conteoAutoria={conteoAutoria}
          />
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            {recortado
              ? <>Te llevas <b style={{ color: 'var(--ink)' }}>{resumen}</b> de los {Object.values(conteoArea).reduce((a, b) => a + (b ?? 0), 0)}.</>
              : <>Te llevas <b style={{ color: 'var(--ink)' }}>tu cerebro entero</b>: {resumen}.</>}
          </span>
        </div>

        {/* ── LO QUE VA A SALIR ────────────────────────────────────────────────
            El árbol real del ZIP, con sus dos niveles de carpeta. Un filtro dice qué NO
            entra; en una descarga lo que importa es qué SÍ, y esto es literalmente lo
            que se abre después. */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: '12px 14px', maxHeight: 260, overflowY: 'auto' }}>
          {arbol.length === 0 ? (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--warn)' }}>
              Con este recorte no queda ningún archivo. Saca alguna condición del filtro.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {arbol.map(([madre, hijas]) => (
                <div key={madre}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>{madre}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {hijas.map((h) => (
                      <div key={h.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.nombre}</span>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{h.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {recortado && (
          <button
            type="button"
            onClick={() => setFiltro(filtroVacio())}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--primary)' }}
          >
            Llevarme todo
          </button>
        )}

        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--faint)', lineHeight: 1.55 }}>
          Se descarga como un ZIP con dos niveles de carpeta —la carpeta madre y adentro cada
          sección— y un archivo de texto por dato, más un README con el índice. Cada archivo dice
          de dónde salió y con qué está conectado. Si lo abres con Obsidian vas a ver el mismo mapa
          que aquí.
        </p>
      </div>
    </WizardShell>
  );
}
