'use client';

// =============================================================================
// MakoConfirmGate — «A revisar»: los datos sin marcar del CRM, SIN interrumpir
// =============================================================================
// ⚠️ DESDE EL 13/10/2026 ACÁ SÓLO VAN LOS DATOS SIN MARCAR. Martín: «solo deberían
// aparecer los datos sin marcar del CRM, no las notificaciones de "MaKo movió 6 leads",
// eso lo vamos a eliminar completamente... quiero que ahora todo eso pase a AUTOMATIONS».
// El motor que mueve leads (lib/crm-auto.ts) sigue corriendo hasta que Automations tenga
// sus plantillas (se le pidió al chat de Automations); sus confirmaciones ya no se piden
// acá. Y «elimina la foto de perfil que dice "Mk"»: el panel no habla en nombre de MaKo,
// dice qué falta.
//
// Lo de abajo es la historia de cuando también listaba los cambios de MaKo (fuente:
// mako_confirmaciones); queda porque explica por qué es una tarjeta plegada.
//
// ⚠️ ESTO ERA UN MODAL BLOQUEANTE Y NO CERRABLE (25/09). Tapaba el CRM entero al
// entrar y no dejaba pasar hasta resolver todo. Mauricio: «me meto al CRM y me
// pregunta un chorro de cosas… quiero nomás cambiar este… y ya lo abandono».
// Pedido, textual: «no significa que desaparezca, pero no quiero que interrumpa».
//
// Ahora es una tarjeta anclada abajo a la derecha, PLEGADA por defecto: se ve el
// número, no tapa nada y se abre cuando él quiere. No se puede esconder del todo
// —el contador queda—, porque son cambios que alguien tiene que revisar.
//
// ⚠️ Y LISTA LO DEL PRODUCTO QUE SE ESTÁ MIRANDO, no lo del workspace. Hasta el
// 30/09/2026 filtraba sólo por `estado = 'pendiente'`, así que los cambios de un producto
// se veían parado en cualquier otro: «me sigue apareciendo el mensaje de "MaKo movió 3
// leads" por más que estoy parado en otro funnel/producto». El corte vive en el SERVER
// (mako-confirm-actions → listPendientes), y acá sólo se decide QUÉ pedir: ver alcanceDe.
//
// Y menos texto. Antes cada ítem traía cuatro líneas: la regla interna («T1»),
// «MaKo ya lo aplicó — confirma o deshaz» (que repetía lo que dicen los botones)
// y la descripción de la automatización escrita para quien la programó («R2 del
// 2026-09-23 sin marcar → buscar grabación en Fathom: si aparece asistió →
// Facturando…»). Queda lo que hace falta para decidir: QUÉ lead, QUÉ cambió y los
// dos botones. El porqué sigue estando, a un toque, para cuando algo no cierre.

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { esVistaSinChrome } from './PublicRouteGate';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/**
 * La ficha del lead, encima de la página (la misma que abre el tablero). Se carga RECIÉN al
 * abrirla: este panel lo monta `app/layout.tsx` en cada página, y la ficha arrastra el CRM entero.
 */
const LeadEditModal = dynamic(() => import('@/app/crm/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

type SinMarcarItem = { lead_id: number; lead_nombre: string; mensaje: string };

function Tarjeta() {
  const pathname = usePathname();
  // Sólo para que «Ver todos» vuelva al mismo tablero (ver irAPendientes).
  const funnelParam = useSearchParams().get('funnel');
  const router = useRouter();
  // El resumen del lead vive bajo /crm pero se abre desde WhatsApp, en el
  // celular y con la reunión por empezar: no es lugar para esto. Ver esVistaSinChrome.
  const enCrm = (pathname?.startsWith('/crm') ?? false) && !esVistaSinChrome(pathname);
  const [cargado, setCargado] = useState(false);
  // Plegada por defecto: entrar al CRM no puede empezar con una lista de deberes.
  const [abierta, setAbierta] = useState(false);
  // «Sin marcar»: los leads con datos que faltan. Vivía como un chip al lado del
  // toggle de vistas y Martín lo mudó acá el 05/10 — la barra de arriba contesta
  // «¿cómo miro esto?» y este panel «¿qué me falta revisar?».
  //
  // ⚠️ SE PIDE POR FETCH Y NO POR PROPS, y no es una preferencia: este componente lo
  // monta `app/layout.tsx`, que no sabe nada del CRM. Ésa era exactamente la razón
  // por la que la mudanza había quedado a medias. El endpoint ya existía y ya lo
  // consume el Sidebar, así que no hay una segunda definición de «sin marcar».
  const [sinMarcar, setSinMarcar] = useState(0);
  const [sinMarcarLista, setSinMarcarLista] = useState<SinMarcarItem[]>([]);
  const [ficha, setFicha] = useState<{ id: number; nombre: string } | null>(null);
  // Sube cuando se cierra una ficha: lo que se arregló adentro sale de la lista.
  const [releer, setReleer] = useState(0);

  // Se vuelve a pedir al cambiar de pantalla dentro del CRM y al cerrar una ficha: lo que se
  // completó adentro sale de la lista.
  useEffect(() => {
    if (!enCrm) return;
    let vivo = true;
    // El contador NO se corta por producto: `getPendientesDeMarcar` es del workspace
    // y la vista que abre tampoco filtra por embudo. Mostrarlo recortado acá diría un
    // número que la pantalla de destino contradice al abrirse.
    fetch('/api/datos-sin-marcar-count?lista=1')
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        setSinMarcar(Number(d?.total) || 0);
        setSinMarcarLista(Array.isArray(d?.items) ? (d.items as SinMarcarItem[]) : []);
        setCargado(true);
      })
      .catch(() => { /* sin contador no se dibuja la fila: no hay nada que afirmar */ });
    return () => { vivo = false; };
  }, [enCrm, pathname, releer]);

  /**
   * La puerta a la cola. Conserva el `?funnel=` que esté puesto: la vista de datos sin
   * marcar vive dentro del CRM y salir de ella tiene que devolver al mismo producto.
   * El `?ws=` lo pone solo el router de `app/_ui/Link` — es una de las cuatro formas de
   * navegar de esta casa y la única que no pierde al cliente que se está mirando.
   */
  const irAPendientes = useCallback(() => {
    const qs = new URLSearchParams();
    if (funnelParam) qs.set('funnel', funnelParam);
    qs.set('pendientes', '1');
    router.push(`/crm?${qs.toString()}`);
  }, [router, funnelParam]);

  if (!enCrm || !cargado || sinMarcar === 0) return null;

  const total = sinMarcar;
  // ⚠️ YA NO ES `fixed` (06/10/2026): la esquina es un contenedor compartido
  // (app/_components/EsquinaAvisos.tsx) que la apila con «Actualiza el Pixel». Dos
  // piezas fijas en la misma esquina se pisan; en columna, cuando ésta se abre, la
  // de arriba sube con ella.
  const marco: CSSProperties = {
    position: 'relative', pointerEvents: 'auto', fontFamily: SANS,
    width: abierta ? 'min(380px, calc(100vw - 32px))' : 'auto',
    background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14,
    boxShadow: '0 14px 40px rgba(18,21,27,.22)', overflow: 'hidden',
  };

  // Plegada: solo el número. Es un aviso, no una tarea que empieza sola.
  if (!abierta) {
    return (
      <button type="button" aria-expanded={false} onClick={() => setAbierta(true)}
        style={{ ...marco, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>A revisar</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontFamily: MONO, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{total}</span>
      </button>
    );
  }

  return (
    <section aria-label={`A revisar: ${total}`} style={{ ...marco, display: 'flex', flexDirection: 'column', maxHeight: 'min(520px, calc(100vh - 40px))', flex: '0 1 auto', minHeight: 0 }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>A revisar</span>
        <button type="button" onClick={() => setAbierta(false)} aria-label="Plegar"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, padding: 4 }}>Después</button>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 15px 15px' }}>
        {/* ⚠️ LOS DATOS QUE FALTAN SE RESUELVEN ACÁ, SIN IR A OTRA TAB (tercer feedback del
            12/10/2026, punto 4: «A revisar» sin ir a otra tab). Hasta entonces era una fila que
            llevaba a la cola (`?pendientes=1`). Ahora lista los primeros y cada uno abre SU
            ficha encima de la página; la cola entera sigue a un clic («Ver todos»). Desaparece
            en cero: un renglón que dice «0» es ruido fijo. */}
        {sinMarcar > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13, marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontFamily: MONO, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Sin marcar</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: 'var(--warn)', color: '#fff', fontFamily: MONO, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{sinMarcar}</span>
              <button type="button" onClick={() => { setAbierta(false); irAPendientes(); }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 2, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>Ver todos</button>
            </div>
            {sinMarcarLista.map((p) => (
              <button key={p.lead_id} type="button" onClick={() => setFicha({ id: p.lead_id, nombre: p.lead_nombre })}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginTop: 6, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: SANS, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{p.lead_nombre}</span>
                <span style={{ fontSize: 12.5, color: 'var(--dim)', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.mensaje}</span>
              </button>
            ))}
          </>
        )}
      </div>
      {ficha && (
        <LeadEditModal leadId={ficha.id} seed={{ nombre: ficha.nombre }}
          onClose={() => { setFicha(null); setReleer((n) => n + 1); router.refresh(); }} />
      )}
    </section>
  );
}

/**
 * El `<Suspense>` es por `useSearchParams()`: sin un boundary, Next corta el prerender de
 * cualquier ruta estática con «useSearchParams() should be wrapped in a suspense boundary».
 * Hoy ninguna ruta es estática (el layout lee la sesión en cada request), así que no hace
 * falta para el build; se queda porque eso es una propiedad de DONDE está montado y no de
 * este archivo. Y el layout ya NO envuelve la app en un Suspense desde el 10/10/2026 (ver
 * app/layout.tsx): este boundary es el único que tiene. `fallback={null}` porque la
 * tarjeta plegada no reserva lugar.
 */
export function MakoConfirmGate() {
  return (
    <Suspense fallback={null}>
      <Tarjeta />
    </Suspense>
  );
}
