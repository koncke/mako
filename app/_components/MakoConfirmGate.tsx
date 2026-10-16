'use client';

// =============================================================================
// MakoConfirmGate — «A revisar»: los datos sin marcar del CRM, SIN interrumpir
// =============================================================================
// ⚠️ DESDE EL 14/10/2026 ES UNA FILA POR LEAD. Martín, textual: «El desplegable de "A revisar" si
// toco otra cosa, se debería cerrar. No pongas muchas filas del mismo lead, en todo caso un número
// de cuantos datos sin revisar tiene... No pongas subtitulos, pon antes del nombre la foto de perfil.
// Que el botón de revisar sea azul y con una flecha, no un lapiz. Y el botón de ignorar que sea una
// X. No pongas para cerrarlo un botón que dice "después", pon una X.» Cada fila: la cara, el nombre,
// cuántos datos le faltan, la ✕ que ignora todos los que se pueden ignorar y la flecha azul que abre
// la ficha en el primero. Se cierra con su ✕, tocando afuera y con Escape.
//
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

import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { esVistaSinChrome } from './PublicRouteGate';
import { useVistaMovil } from './VistaMovil';
import { Marca } from './Marca';
import { colorDe } from './TarjetaEntidad';
import { profundidadModales } from './pila-modales';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { useCaraDelLead } from '@/app/crm/lead-view/CaraDelLead';
import { ignorarDatosDelLeadAction } from '@/app/crm/datos-sin-marcar-actions';
import { NO_IGNORABLES } from '@/lib/datos-aviso';
import type { StepId } from '@/lib/stage-requirements';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/**
 * La ficha del lead, encima de la página (la misma que abre el tablero). Se carga RECIÉN al
 * abrirla: este panel lo monta `app/layout.tsx` en cada página, y la ficha arrastra el CRM entero.
 */
const LeadEditModal = dynamic(() => import('@/app/crm/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

/** El modal de «de qué datos te avisa MaKo», cargado recién al abrirlo (por lo mismo que la ficha). */
const AvisosDatosModal = dynamic(() => import('@/app/crm/lead-view/AvisosDatosModal').then((m) => m.AvisosDatosModal), { ssr: false });

type Paso = { id: StepId; label: string };
/** Lo que la ruta lee para la cara (ver `ponerCaras` en /api/datos-sin-marcar-count). */
type Cara = { icono: string | null; avatarUrl: string | null; avatarY: number | null; fotoGuardada: string | null; fotoEmail: string | null };
/**
 * Una fila: UN LEAD con sus datos sin marcar (14/10/2026; hasta el 13/10 era una fila por dato).
 * `pasos` vacío es el lead que está por otra cosa (una nutrición manual vencida, una reunión pasada
 * sin desenlace): sólo se abre la ficha. Lo arma /api/datos-sin-marcar-count, y los ignorados
 * llegan con la misma forma. `porOtraCosa`: ese mismo lead CON datos; ignorarlos no lo saca.
 */
type LeadARevisar = { lead_id: number; lead_nombre: string; pasos: Paso[]; cara?: Cara | null; porOtraCosa?: boolean };

/** Los datos de la fila que la ✕ puede ignorar: la asistencia a una reunión pasada sigue avisando. */
const ignorablesDe = (l: LeadARevisar): StepId[] => l.pasos.filter((p) => !NO_IGNORABLES.has(p.id)).map((p) => p.id);

/**
 * ¿El toque cae en un menú o un diálogo portaleado? Un desplegable de la casa se dibuja en
 * `document.body`, afuera del panel en el DOM: sin esto, elegir una opción cerraría el panel.
 */
const enCapaFlotante = (t: EventTarget | null): boolean => {
  const el = t instanceof Element ? t : t instanceof Node ? t.parentElement : null;
  return Boolean(el?.closest('[role=menu],[role=listbox],[role=dialog]'));
};

const iconoBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flex: 'none',
  borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', padding: 0,
};

/** Revisar: AZUL y con la flecha («Que el botón de revisar sea azul y con una flecha, no un lapiz»). */
const revisarBtn: CSSProperties = { ...iconoBtn, border: 'none', background: 'var(--primary)', color: '#fff' };

/** Ignorar: un BASURERO ROJO («El icono de "X" debería ser un basurero color rojo», Martín, 16/10/2026). */
const ignorarBtn: CSSProperties = { ...iconoBtn, color: 'var(--bad)', borderColor: 'color-mix(in srgb, var(--bad) 40%, var(--border))' };

/**
 * La cara del lead, con la cadena de la cabecera de su ficha (`useCaraDelLead`): lo elegido → la
 * foto guardada → Gravatar → iniciales.
 *
 * ⚠️ SIN TELÉFONO, A PROPÓSITO. Con el teléfono, la cadena le pide a Evolution la foto de WhatsApp
 * en vivo (`/api/whatsapp/evolution/mensajes?avatarimg=`), y acá serían hasta 24 pedidos de una vez
 * al proxy, que con la línea colgada tarda (app/_components/foto-contacto.ts). La copia que guarda
 * el cron (`foto_auto_url`) ya es esa misma foto.
 */
function CaraFila({ nombre, cara }: { nombre: string; cara?: Cara | null }) {
  const { icono, foto } = useCaraDelLead({
    telefono: null,
    fotoEmail: cara?.fotoEmail ?? null, fotoGuardada: cara?.fotoGuardada ?? null,
    icono: cara?.icono ?? null, avatarUrl: cara?.avatarUrl ?? null,
  });
  return <Marca icono={icono} foto={foto} nombre={nombre} tam={28} y={cara?.avatarY ?? null} color={colorDe(nombre)} />;
}

function Tarjeta() {
  const pathname = usePathname();
  const router = useRouter();
  // El resumen del lead vive bajo /crm pero se abre desde WhatsApp, en el
  // celular y con la reunión por empezar: no es lugar para esto. Ver esVistaSinChrome.
  // Y en el teléfono /crm es la página de /m (LAS MISMAS RUTAS): tampoco (`useVistaMovil`).
  const movil = useVistaMovil();
  const enCrm = (pathname?.startsWith('/crm') ?? false) && !movil && !esVistaSinChrome(pathname);
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
  const [filas, setFilas] = useState<LeadARevisar[]>([]);
  const [ignorados, setIgnorados] = useState<LeadARevisar[]>([]);
  const [verMas, setVerMas] = useState(false);
  const [config, setConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `ver`: la ficha abre con el «Ver» de los datos sin marcar YA desplegado («Cuando le doy click a revisar en el
  // desplegable del CRM, me debe abrir el detail del lead con el desplegable de "Ver" abierto», Martín, 16/10/2026).
  const [ficha, setFicha] = useState<{ id: number; nombre: string; ver: true } | null>(null);
  // Sube cuando se cierra una ficha: lo que se arregló adentro sale de la lista.
  const [releer, setReleer] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);

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
        setFilas(Array.isArray(d?.items) ? (d.items as LeadARevisar[]) : []);
        setIgnorados(Array.isArray(d?.ignorados) ? (d.ignorados as LeadARevisar[]) : []);
        setCargado(true);
      })
      .catch(() => { /* sin contador no se dibuja la fila: no hay nada que afirmar */ });
    return () => { vivo = false; };
  }, [enCrm, pathname, releer]);

  // «Si toco otra cosa, se debería cerrar» (14/10/2026): un toque afuera o Escape la pliegan.
  //
  // ⚠️ NO MIENTRAS HAY ALGO ENCIMA. La ficha y el modal de avisos se montan ADENTRO de este panel:
  // plegarlo los desmonta, así que un clic adentro de la ficha (que en el DOM queda afuera del
  // panel) la cerraría con lo que se estuviera escribiendo. Por eso el efecto ni se registra con
  // `ficha` o `config` abiertos —la ficha no se anota en la pila, y mientras se descarga tampoco
  // hay nada en la pila—, y con cualquier otro modal de la casa encima (`profundidadModales()`)
  // el toque y la tecla son de ése.
  useEffect(() => {
    if (!abierta || ficha || config) return;
    const alTocar = (e: PointerEvent) => {
      if (profundidadModales() > 0) return;
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      if (enCapaFlotante(e.target)) return;
      setAbierta(false);
    };
    // El Escape dentro de un menú abierto (el foco está en él) es para cerrar ese menú.
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing || profundidadModales() > 0) return;
      if (enCapaFlotante(document.activeElement)) return;
      setAbierta(false);
    };
    document.addEventListener('pointerdown', alTocar, true);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alTocar, true);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierta, ficha, config]);


  /**
   * Ignorar (la ✕) o volver a avisar los datos de UN lead, de una vez. La lista se arregla al toque
   * y se relee después: el número de arriba es el del server, no una resta de la pantalla. Un lead
   * con la asistencia de una reunión pasada se queda, con lo que no se puede ignorar.
   */
  const ignorarLead = useCallback((l: LeadARevisar, si: boolean) => {
    const ids = si ? ignorablesDe(l) : l.pasos.map((p) => p.id);
    if (!ids.length) return;
    setError(null);
    if (si) {
      setFilas((xs) => xs.flatMap((x) => {
        if (x.lead_id !== l.lead_id) return [x];
        const quedan = x.pasos.filter((p) => NO_IGNORABLES.has(p.id));
        return quedan.length || x.porOtraCosa ? [{ ...x, pasos: quedan }] : [];
      }));
    } else {
      setIgnorados((xs) => xs.filter((x) => x.lead_id !== l.lead_id));
    }
    void ignorarDatosDelLeadAction(l.lead_id, ids, si)
      .then((r) => { if (!r.ok) setError(r.error); setReleer((n) => n + 1); })
      .catch(() => { setError(`No se pudo guardar (${l.lead_nombre}).`); setReleer((n) => n + 1); });
  }, []);

  /**
   * «Ignorar todos» (16/10/2026, en lugar de «Ver todos», que llevaba a la cola de /crm?pendientes=1): ignora los
   * ignorables de cada lead de la lista, de una vez, y relee una sola vez. Lo ignorado vuelve con «Ver más» →
   * «Volver a avisar», lead por lead. La asistencia de una reunión pasada no se ignora (NO_IGNORABLES).
   */
  const ignorarTodos = useCallback(() => {
    const leads = filas.filter((l) => ignorablesDe(l).length > 0);
    if (!leads.length) return;
    setError(null);
    const ids = new Set(leads.map((l) => l.lead_id));
    setFilas((xs) => xs.flatMap((x) => {
      if (!ids.has(x.lead_id)) return [x];
      const quedan = x.pasos.filter((p) => NO_IGNORABLES.has(p.id));
      return quedan.length || x.porOtraCosa ? [{ ...x, pasos: quedan }] : [];
    }));
    void Promise.all(leads.map((l) => ignorarDatosDelLeadAction(l.lead_id, ignorablesDe(l), true)
      .then((r) => (r.ok ? null : r.error))
      .catch(() => `No se pudo guardar (${l.lead_nombre}).`)))
      .then((errores) => { const e = errores.find(Boolean); if (e) setError(e); setReleer((n) => n + 1); });
  }, [filas]);

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

  /** Una fila: la cara, el nombre (sin bajada) y cuántos datos le faltan. */
  // ⚠️ LA PRIMERA FILA VA SIN RAYA: la cabecera ya tiene la suya abajo y dos rayas juntas se leen como un hueco
  // (Martín, 16/10/2026). Y el número va PEGADO AL NOMBRE, no a la derecha: el nombre cede y un espacio empuja los
  // botones.
  const fila = (key: string, l: LeadARevisar, acciones: ReactNode, primera = false) => {
    const nombre = l.lead_nombre?.trim() || 'Sin nombre';
    const n = l.pasos.length;
    return (
      <li key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderTop: primera ? 'none' : '1px solid var(--border)' }}>
        <CaraFila nombre={nombre} cara={l.cara} />
        <span style={{ flex: '0 1 auto', minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
        {n > 0 && (
          <span aria-label={`${n} ${n === 1 ? 'dato' : 'datos'}`} title={l.pasos.map((p) => p.label).join(' · ')}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 6px', flex: 'none', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)', fontFamily: MONO, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{n}</span>
        )}
        <span aria-hidden style={{ flex: 1 }} />
        {acciones}
      </li>
    );
  };

  return (
    <section ref={panelRef} aria-label={`A revisar: ${total}`} style={{ ...marco, display: 'flex', flexDirection: 'column', maxHeight: 'min(520px, calc(100vh - 40px))', flex: '0 1 auto', minHeight: 0 }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>A revisar</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: 'var(--warn)', color: '#fff', fontFamily: MONO, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{total}</span>
        {/* El engranaje: de qué datos avisa MaKo (13/10/2026: «en el título del desplegable»). */}
        <button type="button" onClick={() => setConfig(true)} title="Elegir de qué datos te avisa MaKo" aria-label="Elegir de qué datos te avisa MaKo"
          style={{ ...iconoBtn, border: 'none', background: 'none', marginLeft: 'auto' }}>
          <IconoMenu nombre="configurar" size={16} />
        </button>
        {/* Cerrar es una ✕ (14/10/2026: «No pongas para cerrarlo un botón que dice "después"»). */}
        <button type="button" onClick={() => setAbierta(false)} title="Cerrar" aria-label="Cerrar"
          style={{ ...iconoBtn, border: 'none', background: 'none' }}>
          <IconoMenu nombre="cerrar" size={16} />
        </button>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '4px 15px 12px' }}>
        {/* ⚠️ UNA FILA POR LEAD (14/10/2026), con la ✕ que ignora y la flecha azul que revisa.
            Revisar abre la ficha encima de la página con el «Ver» de sus datos sin marcar abierto (16/10/2026);
            «Ignorar todos» ignora la lista de una vez. Lo ignorado se esconde detrás de «Ver más». */}
        {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--bad)', fontWeight: 600 }}>{error}</p>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {filas.map((p, i) => fila(`${p.lead_id}`, p, (
            <>
              {ignorablesDe(p).length > 0 && (
                <button type="button" style={ignorarBtn} onClick={() => ignorarLead(p, true)}
                  title="Ignorar" aria-label={`Ignorar los datos de ${p.lead_nombre}`}>
                  <IconoMenu nombre="borrar" size={15} />
                </button>
              )}
              <button type="button" style={revisarBtn} onClick={() => setFicha({ id: p.lead_id, nombre: p.lead_nombre, ver: true })}
                title="Revisar" aria-label={`Revisar a ${p.lead_nombre}`}>
                <IconoMenu nombre="mover" size={15} />
              </button>
            </>
          ), i === 0))}
          {verMas && ignorados.length > 0 && (
            <li style={{ padding: '10px 0 2px', borderTop: filas.length ? '1px solid var(--border)' : 'none', fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)' }}>Ignorados</li>
          )}
          {verMas && ignorados.map((x) => fila(`ign:${x.lead_id}`, x, (
            <button type="button" style={iconoBtn} onClick={() => ignorarLead(x, false)}
              title="Volver a avisar" aria-label={`Volver a avisar de ${x.lead_nombre}`}>
              <IconoMenu nombre="avisar" size={15} />
            </button>
          )))}
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
          {!verMas && ignorados.length > 0 && (
            <button type="button" onClick={() => setVerMas(true)}
              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>Ver más</button>
          )}
          {filas.some((l) => ignorablesDe(l).length > 0) && (
            <button type="button" onClick={ignorarTodos}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 2, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>Ignorar todos</button>
          )}
        </div>
      </div>
      {ficha && (
        <LeadEditModal leadId={ficha.id} seed={{ nombre: ficha.nombre }} verDatos={ficha.ver}
          onClose={() => { setFicha(null); setReleer((n) => n + 1); router.refresh(); }} />
      )}
      {config && <AvisosDatosModal onCerrar={() => setConfig(false)} onGuardado={() => setReleer((n) => n + 1)} />}
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
