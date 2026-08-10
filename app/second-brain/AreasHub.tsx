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
// 2. NO SON TABS, Y YA TAMPOCO SON TARJETAS. Primero eran ONCE tabs (más dos
//    sub-toggles y un cuarto nivel de pastillas en el modal de la Matriz: hasta cuatro
//    barras de navegación apiladas). Pasaron a ser once TARJETAS, y el problema de
//    fondo seguía intacto: once cajas del mismo tamaño repitiendo lo que el mapa ya
//    dibuja, puestas justo debajo del mapa, le compiten por ser la navegación de la
//    pantalla. La navegación es UNA y es el grafo — la lista de áreas vive ahora en la
//    columna de la derecha del mapa (`.cbg-nav-*` en Grafo.tsx), donde se ve MIENTRAS
//    se mira el mapa en vez de después. Acá abajo solo queda lo que se abre.
//
// 3. LA TAXONOMÍA ES LA DEL GRAFO. Antes el mapa decía «Lead Magnet» y la tab de abajo
//    decía otra cosa, el mapa decía «Avatares» y abajo «Segmentos», arriba «Norte» y
//    abajo «Diagnóstico». Eran LOS MISMOS DATOS con dos vocabularios. Ahora la grilla
//    ITERA `AREAS` de lib/cerebro-modelo.ts —la misma lista que colorea el mapa y que
//    nombra las carpetas del ZIP—, así que no hay una segunda lista que se quede vieja.
//
// En reposo esta mitad mide CERO: sin nada abierto no dibuja nada. Ese es el espacio
// que el grafo necesitaba para ser protagonista.
// =============================================================================

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { AREAS, type AreaId } from '@/lib/cerebro-modelo';
import { Section, Button } from '@/app/_ui';
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
const vistasDe = (funnelPanel: ReactNode): Record<AreaId, Array<{ nombre: string; vista: ReactNode }>> => ({
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
  // El funnel dejó de ser una sección suelta al final de la página y pasó a ser UNA
  // TARJETA MÁS: es un área del cerebro como cualquier otra, con sus nodos en el mapa y
  // su carpeta en el ZIP. Antes vivía aparte y desplegado duplicaba el alto de la página.
  funnel: [{ nombre: 'El funnel', vista: funnelPanel }],
});

export function AreasHub({ abierta, onAbrir, funnelPanel }: {
  abierta: AreaId | null;
  onAbrir: (a: AreaId | null) => void;
  funnelPanel: ReactNode;
}) {
  const [sub, setSub] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Al abrir un área, el panel se trae a la vista. Sin esto, tocar «Abrir» en la columna
  // del mapa abre algo que está fuera de pantalla y parece que el botón no hizo nada.
  //
  // ⚠️ Depende de `abierta` y NADA MÁS, a propósito. Cuando además existían las tarjetas,
  // pasar el cursor por una prendía un estado en el padre que re-renderizaba este árbol,
  // y con él volvía a correr este scroll: la página se movía sola de arriba abajo cada
  // vez que el mouse rozaba una tarjeta. La causa no estaba en el grafo aunque el
  // síntoma se viera ahí.
  useEffect(() => {
    if (!abierta) return;
    setSub(0);
    panelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [abierta]);

  const areaAbierta = abierta ? AREAS.find((a) => a.id === abierta) ?? null : null;
  const vistas = abierta ? vistasDe(funnelPanel)[abierta] : [];

  return (
    <>
      {/* ⚠️ El montaje de `BrandDefs` es OBLIGATORIO y es fácil de perder: lo traía el
          marco del wizard, que acá se sacó. Sin él las tarjetas de servicio no fallan
          con un error — se pintan como un cuadrado de color liso, en silencio. */}
      <BrandDefs />

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


    </>
  );
}
