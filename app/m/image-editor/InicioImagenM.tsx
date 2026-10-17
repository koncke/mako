'use client';

// =============================================================================
// InicioImagenM — el inicio del Image Editor en el teléfono, como el de la app de Canva
// =============================================================================
// Ver ./page.tsx. Un diseño se toca para abrirlo; su «⋯» abre una hoja con «Abrir el diseño» y «Borrar el diseño»
// (el tacho de escritorio pide confirmar: acá la confirmación es la hoja misma). El «+» abre «Crear un diseño»:
// tocar un tamaño crea el diseño en blanco y abre el editor.
// =============================================================================

import { useMemo, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import Link, { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import type { ResumenDiseno } from '@/lib/image-editor/tipos';
import { FilaM, ListaM, PieM, SeccionM, SheetM, VacioM, useConexion, useToastM } from '@/app/m/_ui';
import { BotonFlotanteM, HuecoFlotanteM } from '@/app/m/_ui/BotonFlotanteM';
import { ErrorLineaM } from '../_creacion/escritor';
import { borrarDisenoMAction, crearDisenoMAction } from './actions';

export type TamanoM = { id: string; nombre: string; ancho: number; alto: number };

const rutaDiseno = (id: string) => `/m/image-editor/${encodeURIComponent(id)}`;

/** El rectángulo del tamaño, con su proporción real, en una caja de 26 px. */
const forma = (t: TamanoM) => {
  const lado = 26;
  return t.ancho >= t.alto
    ? { width: lado, height: Math.max(6, Math.round((lado * t.alto) / t.ancho)) }
    : { width: Math.max(6, Math.round((lado * t.ancho) / t.alto)), height: lado };
};

function hace(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); } catch { return ''; }
}

export function InicioImagenM({ disenos: iniciales, tamanos }: { disenos: ResumenDiseno[]; tamanos: TamanoM[] }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [disenos, setDisenos] = useState(iniciales);
  const [buscar, setBuscar] = useState('');
  const [hoja, setHoja] = useState<'crear' | 'diseno' | null>(null);
  // El diseño de la hoja queda puesto mientras la hoja se va (LEEME.md).
  const [elegido, setElegido] = useState<ResumenDiseno | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState('');

  const visibles = useMemo(() => {
    const aguja = buscar.trim().toLocaleLowerCase('es');
    return aguja ? disenos.filter((d) => d.titulo.toLocaleLowerCase('es').includes(aguja)) : disenos;
  }, [disenos, buscar]);

  const crear = async (t: TamanoM) => {
    if (trabajando) return;
    setTrabajando(t.id); setError('');
    try {
      const r = await crearDisenoMAction(t.id);
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

      <BotonFlotanteM etiqueta="Crear un diseño" deshabilitado={!enLinea} onClick={() => { setError(''); setHoja('crear'); }} />

      <SheetM
        id="crear-diseno"
        abierto={hoja === 'crear'}
        onCerrar={() => setHoja(null)}
        titulo="Crear un diseño"
        snap="alto"
        ocupado={trabajando != null}
        rotuloCerrar="Cerrar"
      >
        <ListaM etiqueta="Tamaños">
          {tamanos.map((t) => (
            <FilaM
              key={t.id}
              leading={<span className="m-image-editor-forma" aria-hidden><i style={forma(t)} /></span>}
              titulo={t.nombre}
              segunda={`${t.ancho} × ${t.alto} px`}
              enCurso={trabajando === t.id}
              deshabilitada={!enLinea || (trabajando != null && trabajando !== t.id)}
              onClick={() => void crear(t)}
            />
          ))}
        </ListaM>
        {error && hoja === 'crear' && <ErrorLineaM>{error}</ErrorLineaM>}
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
