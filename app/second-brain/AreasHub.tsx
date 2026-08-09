'use client';

// =============================================================================
// AreasHub — la data del negocio, con la MISMA taxonomía que el grafo y el ZIP
// =============================================================================
// Reemplaza al hub de tabs del wizard (`OnboardingTabs`) dentro de /second-brain.
// Tres cosas cambian, y las tres tienen motivo:
//
// 1. SE VA EL MARCO DEL WIZARD (el panel negro al costado). Ese molde existe para
//    ACOMPAÑAR a alguien que está entrando por primera vez: son slides que explican
//    qué es cada cosa mientras la completa. Acá el usuario ya sabe qué es —viene de
//    mirar su propio mapa— y el panel le come la mitad del ancho a una grilla que lo
//    necesita. En /onboarding el marco se queda intacto: ahí sí hace falta.
//
// 2. NO SON TABS. Eran ONCE (más dos sub-toggles escondidos adentro y un cuarto nivel
//    de pastillas en el modal de la Matriz: hasta cuatro barras de navegación
//    apiladas). El propio primitive avisa que pasadas seis «probablemente falte una
//    decisión de arquitectura, no una tab más». Y una barra permanente de once
//    etiquetas justo debajo del lienzo se lee como una segunda navegación: le compite
//    al grafo, que es exactamente lo que había que evitar.
//
// 3. LA TAXONOMÍA ES LA DEL GRAFO. Antes el mapa decía «Lead Magnet» y la tab de abajo
//    decía otra cosa, el mapa decía «Avatares» y abajo «Segmentos», arriba «Norte» y
//    abajo «Diagnóstico». Eran LOS MISMOS DATOS con dos vocabularios. Ahora la grilla
//    ITERA `AREAS` de lib/cerebro-modelo.ts —la misma lista que colorea el mapa y que
//    nombra las carpetas del ZIP—, así que no hay una segunda lista que se quede vieja.
//
// En reposo la grilla mide ~236 px contra los ~780 px del bloque anterior. Esa
// diferencia es literalmente el espacio que el grafo necesitaba para ser protagonista.
// =============================================================================

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { AREAS, type AreaId } from '@/lib/cerebro-modelo';
import { Section, Button, Status } from '@/app/_ui';
import { BrandDefs } from '../_components/ServicioVisual';
import { Archivero } from '../onboarding/Archivero';
import { MatrizView } from '../onboarding/MatrizView';
import { DiagnosticoView } from '../onboarding/DiagnosticoView';
import { CamposNegocio } from '../onboarding/CamposNegocio';
import { EntregableView } from '../onboarding/EntregableView';
import { PersonaView } from '../onboarding/PersonaView';
import { PersonalidadView } from '../onboarding/PersonalidadView';
import { AvataresView } from '../onboarding/AvataresView';
import { RazonesView } from '../onboarding/RazonesView';
import { FormatosView } from '../onboarding/FormatosView';
import { ProductosView } from '../onboarding/ProductosView';
import { ResumenView } from '../onboarding/ResumenView';

/** Qué se abre al tocar cada área. Es el ÚNICO dato nuevo de este archivo: la lista de
 *  áreas, sus nombres y sus descripciones salen de `AREAS`.
 *
 *  Algunas áreas tienen más de una vista (Razones son las razones y los ángulos; Voz
 *  son la personalidad y la persona). Van como sub-pestañas ADENTRO del panel abierto,
 *  no como áreas nuevas: el color y la carpeta del ZIP son por área. */
const VISTAS: Record<AreaId, Array<{ nombre: string; vista: ReactNode }>> = {
  norte: [{ nombre: 'Diagnóstico', vista: <DiagnosticoView /> }],
  documentos: [{ nombre: 'El Archivero', vista: <Archivero /> }],
  panorama: [{ nombre: 'Panorama', vista: <ResumenView /> }],
  oferta: [{ nombre: 'Oferta', vista: <CamposNegocio titulo="Tu oferta" subtitulo="Lo que MaKo entendió de tu negocio y tu oferta. Toca cualquier dato para corregirlo." keys={['negocio_que_hace']} prefijos={['oferta_']} /> }],
  cliente: [{ nombre: 'Cliente', vista: <CamposNegocio titulo="Tu cliente" subtitulo="A quién le vendes. Toca cualquier dato para corregirlo." keys={[]} prefijos={['avatar_']} /> }],
  productos: [{ nombre: 'Productos', vista: <ProductosView /> }],
  entregables: [{ nombre: 'Lead Magnet', vista: <EntregableView /> }],
  avatares: [{ nombre: 'Avatares', vista: <AvataresView /> }],
  razones: [
    { nombre: 'Matriz', vista: <MatrizView /> },
    { nombre: 'Razones', vista: <RazonesView /> },
    { nombre: 'Ángulos', vista: <FormatosView /> },
  ],
  voz: [
    { nombre: 'Personalidad', vista: <PersonalidadView /> },
    { nombre: 'Persona', vista: <PersonaView /> },
  ],
};

export function AreasHub({ conteo, abierta, onAbrir, onResaltar, funnelPanel }: {
  /** Cuántos datos tiene cada área. Sale de `conteoPorArea(cerebro)`: el MISMO número
   *  que el modal de exportación pone al lado de cada opción. */
  conteo: Record<string, number>;
  abierta: AreaId | null;
  onAbrir: (a: AreaId | null) => void;
  /** Resalta el área en el mapa mientras el cursor está sobre su tarjeta. */
  onResaltar: (a: AreaId | null) => void;
  funnelPanel: ReactNode;
}) {
  const [sub, setSub] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Al abrir un área, el panel se trae a la vista. Sin esto, tocar «Abrir Razones»
  // desde la tarjeta del grafo abre algo que está fuera de pantalla y parece que el
  // botón no hizo nada.
  useEffect(() => {
    if (!abierta) return;
    setSub(0);
    panelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [abierta]);

  const areaAbierta = abierta ? AREAS.find((a) => a.id === abierta) ?? null : null;
  const vistas = abierta ? VISTAS[abierta] : [];

  return (
    <>
      {/* ⚠️ El montaje de `BrandDefs` es OBLIGATORIO y es fácil de perder: lo traía el
          marco del wizard, que acá se sacó. Sin él las tarjetas de servicio no fallan
          con un error — se pintan como un cuadrado de color liso, en silencio. */}
      <BrandDefs />

      <style>{`
        .sb-areas { display: grid; gap: 12px; grid-template-columns: repeat(5, minmax(0,1fr)); }
        @media (max-width: 1180px) { .sb-areas { grid-template-columns: repeat(4, minmax(0,1fr)); } }
        @media (max-width: 940px)  { .sb-areas { grid-template-columns: repeat(3, minmax(0,1fr)); } }
        @media (max-width: 700px)  { .sb-areas { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        .sb-area {
          display: flex; flex-direction: column; gap: 6; align-items: flex-start;
          text-align: left; background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 13px 14px; cursor: pointer; min-height: 112px;
          font: inherit; color: inherit;
        }
        .sb-area:hover { border-color: var(--border-strong); }
        .sb-area[aria-expanded="true"] { border-color: var(--mako); }
        .sb-area:focus-visible { outline: 2px solid var(--mako); outline-offset: 2px; }
        .sb-area .sb-que {
          margin: 4px 0 0; font-size: var(--fs-meta); color: var(--dim); line-height: 1.45;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
      `}</style>

      <Section titulo="Áreas" nota="Toca una para abrirla">
        <div className="sb-areas">
          {AREAS.map((a) => {
            const n = conteo[a.id] ?? 0;
            return (
              <button
                key={a.id}
                type="button"
                className="sb-area"
                aria-expanded={abierta === a.id}
                onClick={() => onAbrir(abierta === a.id ? null : a.id)}
                onMouseEnter={() => onResaltar(a.id)}
                onMouseLeave={() => onResaltar(null)}
                onFocus={() => onResaltar(a.id)}
                onBlur={() => onResaltar(null)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.color, flex: 'none' }} />
                  {a.nombre}
                </span>
                <span className="sb-que">{a.que}</span>
                <span style={{ marginTop: 'auto', paddingTop: 8 }}>
                  {/* `Status` y no `Badge`: el Badge de la casa es un CONTADOR y su
                      tono por defecto es rojo — un «7 datos» en rojo diría que hay
                      siete problemas. Acá el número es información, no alarma. */}
                  {n > 0
                    ? <Status tono="info">{n} {n === 1 ? 'dato' : 'datos'}</Status>
                    : <Status tono="neutral">Vacía</Status>}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <div ref={panelRef}>
        {areaAbierta && (
          <Section
            titulo={areaAbierta.nombre}
            nota={areaAbierta.que}
            accion={<Button variant="tertiary" onClick={() => onAbrir(null)}>Cerrar</Button>}
          >
            {vistas.length > 1 && (
              <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, marginBottom: 18, flexWrap: 'wrap' }}>
                {vistas.map((v, i) => (
                  <button
                    key={v.nombre}
                    type="button"
                    onClick={() => setSub(i)}
                    style={{
                      border: 'none', background: sub === i ? 'var(--surface)' : 'transparent',
                      color: sub === i ? 'var(--ink)' : 'var(--dim)', fontWeight: sub === i ? 600 : 500,
                      fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer',
                      boxShadow: sub === i ? '0 1px 2px rgba(18,21,27,.08)' : 'none',
                    }}
                  >{v.nombre}</button>
                ))}
              </div>
            )}
            {vistas[sub]?.vista ?? vistas[0]?.vista}
          </Section>
        )}
      </div>

      {/* El funnel no es un área del cerebro —no tiene color, ni carpeta en el ZIP, ni
          nodos en el mapa— pero es data del negocio y vivía en este hub. Se queda como
          su propia sección en vez de forzar una tarjeta número once que rompería la
          grilla de 5×2 y obligaría a inventarle un color. */}
      <Section titulo="El funnel" nota="Por dónde pasa cada lead">
        {funnelPanel}
      </Section>
    </>
  );
}
