'use client';

// =============================================================================
// InicioImagenM — «Image» en el teléfono: tus diseños y «Nuevo diseño»
// =============================================================================
// Ver ./page.tsx. Un diseño se toca para abrirlo; su «⋯» abre una hoja con «Abrir el diseño» y «Borrar el diseño»
// (el «Eliminar» de escritorio pide confirmar: acá la confirmación es la hoja misma). El «+» es «Nuevo diseño»: abre
// «¿Qué vas a crear hoy?» con las MISMAS plantillas que la computadora (app/image-editor/plantillas-crear.ts); tocar una
// crea el diseño por la MISMA acción (app/image-editor/actions.ts) y abre el editor.
// =============================================================================

import { useMemo, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import Link, { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import type { ResumenDiseno } from '@/lib/image-editor/tipos';
import { PieM, SeccionM, SheetM, VacioM, useConexion, useToastM } from '@/app/m/_ui';
import { BotonFlotanteM, HuecoFlotanteM } from '@/app/m/_ui/BotonFlotanteM';
import { marcoDe } from '@/app/_crear/reglas';
import { crearDisenoNuevoAction } from '@/app/image-editor/actions';
import { PLANTILLAS_NUEVO_DISENO, type PlantillaNuevoDiseno } from '@/app/image-editor/plantillas-crear';
import { MiniaturaCarrusel } from '@/app/image-editor/carruseles/MiniaturaCarrusel';
import { MiniaturaTarjetaDiseno } from '@/app/image-editor/MiniaturaDiseno';
import { plantillaImagen, type DocumentoDoory } from '@/lib/image-editor/plantillas-reales';
import { documentoDeCarrusel } from '@/lib/carruseles/documento';
import { tipoCarrusel } from '@/lib/carruseles/tipos';
import { ErrorLineaM } from '../_creacion/escritor';
import { borrarDisenoMAction } from './actions';

const rutaDiseno = (id: string) => `/m/image-editor/${encodeURIComponent(id)}`;

function hace(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); } catch { return ''; }
}

let idMini = 0;
const idLocal = () => `mm${++idMini}`;

export function InicioImagenM({ disenos: iniciales, negocio = null }: { disenos: ResumenDiseno[]; negocio?: string | null }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [disenos, setDisenos] = useState(iniciales);
  const [buscar, setBuscar] = useState('');
  const [hoja, setHoja] = useState<'nuevo' | 'diseno' | null>(null);
  // El diseño de la hoja queda puesto mientras la hoja se va (LEEME.md).
  const [elegido, setElegido] = useState<ResumenDiseno | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Los carruseles por tipo se ven como lo que se va a crear (el mismo documento de la acción), no como un marco vacío.
  const docsCarrusel = useMemo(() => {
    const marca = { nombre: negocio?.trim() || 'Tu negocio', usuario: null };
    const out = new Map<string, Record<string, unknown>>();
    for (const p of PLANTILLAS_NUEVO_DISENO) {
      const t = p.carrusel ? tipoCarrusel(p.carrusel) : null;
      if (t) out.set(p.id, documentoDeCarrusel({ laminas: t.estructura(t.laminas.def), estilo: t.estilo, marca, nuevoId: idLocal }));
    }
    return out;
  }, [negocio]);

  // Las plantillas reales (6/11/2026) se ven con su ESTRUCTURA dibujada: lo mismo que crea la acción.
  const docsReales = useMemo(() => {
    const out = new Map<string, DocumentoDoory>();
    for (const p of PLANTILLAS_NUEVO_DISENO) {
      const real = p.real ? plantillaImagen(p.real) : null;
      if (real) out.set(p.id, real.estructura(idLocal));
    }
    return out;
  }, []);

  const visibles = useMemo(() => {
    const aguja = buscar.trim().toLocaleLowerCase('es');
    return aguja ? disenos.filter((d) => d.titulo.toLocaleLowerCase('es').includes(aguja)) : disenos;
  }, [disenos, buscar]);

  const crear = async (p: PlantillaNuevoDiseno) => {
    if (trabajando) return;
    setTrabajando(p.id); setError('');
    try {
      const r = await crearDisenoNuevoAction(p.id);
      if (!r.ok) { setError(r.error); setTrabajando(null); return; }
      // `trabajando` queda prendido: la pantalla se va, y un segundo toque no crea otro (como escritorio).
      router.push(rutaDiseno(r.id));
    } catch {
      setError('No se pudo crear el diseño. Revisa tu conexión y vuelve a intentar.');
      setTrabajando(null);
    }
  };

  const borrar = async (d: ResumenDiseno) => {
    if (trabajando) return;
    setTrabajando(d.id); setError('');
    try {
      const r = await borrarDisenoMAction(d.id);
      if (!r.ok) { setError(r.error); return; }
      setDisenos((xs) => xs.filter((x) => x.id !== d.id));
      setHoja(null);
      toast('Diseño borrado');
    } catch {
      setError('No se pudo borrar el diseño. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setTrabajando(null);
    }
  };

  return (
    <>
      {disenos.length > 0 && (
        <label className="m-image-editor-buscar">
          <Icon name="search" size={18} />
          <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Busca en tus diseños" aria-label="Busca en tus diseños" />
        </label>
      )}

      {/* Los carruseles que funcionan de las cuentas que sigue (4/11/2026): la misma vista de la computadora. */}
      <Link href="/m/image-editor?ver=carruseles" className="m-image-editor-carruseles">
        <span>Carruseles que funcionan</span><span aria-hidden>›</span>
      </Link>

      {disenos.length === 0 ? (
        // Sin botón propio: el «+» de abajo es el que crea (dos botones para lo mismo, no).
        <VacioM frase="Todavía no tienes diseños." />
      ) : visibles.length === 0 ? (
        <VacioM frase="Ningún diseño con ese nombre." />
      ) : (
        <SeccionM titulo="Diseños recientes">
          <div className="m-image-editor-grilla">
            {visibles.map((d) => (
              <div key={d.id} className="m-image-editor-tarjeta">
                <Link href={rutaDiseno(d.id)} className="m-image-editor-tarjeta__abre" aria-label={`Abrir ${d.titulo}`}>
                  <span className="m-image-editor-mini">
                    {d.miniatura
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={d.miniatura} alt="" loading="lazy" />
                      : <span className="m-image-editor-mini__vacia" style={{ aspectRatio: `${d.ancho} / ${d.alto}` }} />}
                  </span>
                  <span className="m-image-editor-tarjeta__t">{d.titulo}</span>
                  <span className="m-image-editor-tarjeta__c">{`${d.ancho} × ${d.alto} px · ${hace(d.actualizado)}`}</span>
                </Link>
                <button type="button" className="m-image-editor-tarjeta__mas" aria-label={`Más opciones de ${d.titulo}`}
                  onClick={() => { setError(''); setElegido(d); setHoja('diseno'); }}>
                  <Icon name="mas" size={20} />
                </button>
              </div>
            ))}
          </div>
        </SeccionM>
      )}
      <HuecoFlotanteM />

      <BotonFlotanteM etiqueta="Nuevo diseño" deshabilitado={!enLinea} onClick={() => { setError(''); setHoja('nuevo'); }} />

      {/* «¿Qué vas a crear hoy?» (el título de la caja de escritorio, TITULO_CAJA de app/web-generator/CajaPedido.tsx) con
          las plantillas de la computadora: las en blanco con su marco y su medida, las que traen diseño con su miniatura. */}
      <SheetM
        id="nuevo-diseno"
        abierto={hoja === 'nuevo'}
        onCerrar={() => setHoja(null)}
        titulo="¿Qué vas a crear hoy?"
        snap="alto"
        ocupado={trabajando != null}
        rotuloCerrar="Cerrar"
      >
        <div className="m-image-editor-plantillas" role="list" aria-label="Plantillas">
          {PLANTILLAS_NUEVO_DISENO.map((p) => (
            <div key={p.id} role="listitem">
              <button type="button" className="m-image-editor-plantilla" aria-label={`Usar la plantilla ${p.nombre}`}
                aria-busy={trabajando === p.id || undefined} disabled={!enLinea || (trabajando != null && trabajando !== p.id)}
                onClick={() => void crear(p)}>
                <span className="m-image-editor-plantilla__mini">
                  {docsCarrusel.has(p.id)
                    ? <MiniaturaCarrusel doc={docsCarrusel.get(p.id)!} nombre={p.nombre} />
                    : docsReales.has(p.id)
                    ? <MiniaturaTarjetaDiseno doc={docsReales.get(p.id)!} nombre={p.nombre} />
                    : p.imagen
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.imagen} alt="" loading="lazy" />
                    : <span className="m-image-editor-plantilla__marco" style={marcoDe(p.formato)} />}
                  {!p.imagen && !docsCarrusel.has(p.id) && !docsReales.has(p.id) && p.rotulo ? <span className="m-image-editor-plantilla__rotulo">{p.rotulo}</span> : null}
                  {trabajando === p.id ? <span className="m-image-editor-plantilla__creando">Creando…</span> : null}
                </span>
                <span className="m-image-editor-plantilla__nombre">{p.nombre}</span>
              </button>
            </div>
          ))}
        </div>
        {error && hoja === 'nuevo' && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>

      <SheetM
        id="diseno"
        abierto={hoja === 'diseno' && elegido != null}
        onCerrar={() => setHoja(null)}
        titulo={elegido?.titulo ?? 'Diseño'}
        ocupado={trabajando != null}
        rotuloCerrar="Cerrar"
        pie={elegido ? (
          <PieM consecuencia="Borrarlo lo saca para todo el negocio.">
            <Button variant="primary" size="lg" full onClick={() => router.push(rutaDiseno(elegido.id))}>Abrir el diseño</Button>
            <Button variant="danger" size="lg" full loading={trabajando === elegido.id} disabled={!enLinea}
              icon={<Icon name="trash" size={18} />} onClick={() => void borrar(elegido)}>
              Borrar el diseño
            </Button>
          </PieM>
        ) : undefined}
      >
        {elegido && (
          <div className="m-image-editor-detalle">
            {elegido.miniatura
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={elegido.miniatura} alt="" />
              : <span className="m-image-editor-mini__vacia" style={{ aspectRatio: `${elegido.ancho} / ${elegido.alto}` }} />}
            <p>{`${elegido.ancho} × ${elegido.alto} px · ${elegido.paginas} ${elegido.paginas === 1 ? 'página' : 'páginas'}`}</p>
          </div>
        )}
        {error && hoja === 'diseno' && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>
    </>
  );
}
