'use client';

// =============================================================================
// ShellM — el cromo de MaKo Mobile: header, barra inferior, toasts y la vida de la app
// =============================================================================
// Lo monta app/m/layout.tsx UNA vez, con rol, capa y cliente ya resueltos en el
// server (nada de un fetch a /api/auth/me ni de un flash de la barra equivocada).
// Las páginas no lo tocan: le hablan por el contexto (./contexto.tsx).
//
// Lo que hace además de dibujar, y por qué vive acá y no en cada página:
//   · el TEMA del contenido sigue la preferencia que ya existía (`mako.modo` o la
//     del sistema). El cromo es --sidebar en los dos modos.
//   · registra el service worker (/sw.js, scope '/', sin caché de HTML): si el
//     archivo todavía no existe, el registro falla y se ignora.
//   · captura temprano el aviso de instalación de Chrome (lib/movil-instalar.ts).
//   · la cinta «Sin conexión» y el refresco solo al volver al frente (> 60 s).
//   · la animación de «ir hacia adelante» (fade + 24 px); volver es instantáneo y
//     cambiar de pestaña NO anima: se usa decenas de veces por día.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link, { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { modoPreferido } from '@/app/_components/InterruptorModo';
import { ATTR_MODO, LS_MODO } from '@/lib/temas-candidatos';
import { HOME_MOVIL, destinoActivo, type DestinoMovil } from '@/lib/movil-rutas';
import { iniciarCapturaInstalacion } from '@/lib/movil-instalar';
import { asegurarRegistro } from '@/lib/push-cliente';
import { cabeceraPorRuta, llevaBarra, profundidad, RUTA_CUENTA, TITULO_CUENTA } from './cabecera';
import { ShellCtx, type CabeceraPisada, type ConexionM, type OpcionesToast } from './contexto';
import { horaCorta } from './formato';
import { MARCA_TEMA_M } from './tema';

export type DestinoBarra = { id: DestinoMovil; label: string; href: string; icon: string };

type Toast = { id: number; mensaje: string; deshacer?: () => void; saliendo?: boolean };

let secuenciaToast = 0;

function reducido(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function ShellM({
  destinos, badges, usuario, cliente, children,
}: {
  /** Los destinos de la barra que este rol y esta capa ven (`destinosVisibles`). */
  destinos: DestinoBarra[];
  /** Un número por destino, sólo lo que bloquea (app/m/badges.ts). */
  badges: Partial<Record<DestinoMovil, number>>;
  usuario: { iniciales: string } | null;
  /** Viendo la cuenta de un cliente (super admin o agencia): su nombre. */
  cliente: { nombre: string } | null;
  children: ReactNode;
}) {
  const pathname = usePathname() || '';
  const router = useRouter();

  // ── La cabecera: lo de siempre para la ruta, o lo que pise la página ─────
  const [pisada, setPisada] = useState<CabeceraPisada | null>(null);
  const setCabecera = useCallback((c: CabeceraPisada | null) => setPisada(c), []);

  // ── Conexión y frescura de los datos ─────────────────────────────────────
  const [conexion, setConexion] = useState<ConexionM>({ enLinea: true, datosDe: null });
  const marcarCarga = useCallback(() => {
    const ahora = Date.now();
    setConexion((c) => (c.enLinea ? { enLinea: true, datosDe: ahora } : c));
  }, []);

  useEffect(() => {
    setConexion({ enLinea: navigator.onLine, datosDe: Date.now() });
    const caer = () => setConexion((c) => ({ ...c, enLinea: false }));
    // Al volver la red, los datos de pantalla son viejos: se piden de nuevo.
    const volver = () => {
      setConexion({ enLinea: true, datosDe: Date.now() });
      router.refresh();
    };
    window.addEventListener('offline', caer);
    window.addEventListener('online', volver);
    return () => {
      window.removeEventListener('offline', caer);
      window.removeEventListener('online', volver);
    };
  }, [router]);

  // Volver al frente después de más de un minuto: el estado vivo importa más
  // que el gesto, así que se refresca solo.
  useEffect(() => {
    let oculta: number | null = null;
    const cambio = () => {
      if (document.visibilityState === 'hidden') { oculta = Date.now(); return; }
      if (oculta != null && Date.now() - oculta > 60_000 && navigator.onLine) {
        router.refresh();
        marcarCarga();
      }
      oculta = null;
    };
    document.addEventListener('visibilitychange', cambio);
    return () => document.removeEventListener('visibilitychange', cambio);
  }, [router, marcarCarga]);

  // ── Toasts ───────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<Toast | null>(null);
  const mostrarToast = useCallback((mensaje: string, opciones?: OpcionesToast) => {
    secuenciaToast += 1;
    setToast({ id: secuenciaToast, mensaje, deshacer: opciones?.deshacer });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    // Con «Deshacer» manda la ventana para revertir; sin él, es sólo un acuse.
    const espera = toast.saliendo ? 200 : toast.deshacer ? 5000 : 3200;
    const t = setTimeout(() => {
      setToast((x) => (x && x.id === id ? (x.saliendo ? null : { ...x, saliendo: true }) : x));
    }, espera);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Tema: el contenido sigue la preferencia; el cromo es oscuro siempre ──
  useEffect(() => {
    const d = document.documentElement;
    const aplicar = () => {
      const oscuro = modoPreferido();
      const puesto = d.getAttribute(ATTR_MODO) === 'oscuro';
      if (oscuro) {
        if (!puesto) d.setAttribute(ATTR_MODO, 'oscuro');
        if (d.getAttribute(MARCA_TEMA_M) !== '1') d.setAttribute(MARCA_TEMA_M, '1');
      } else {
        if (puesto) d.removeAttribute(ATTR_MODO);
        if (d.hasAttribute(MARCA_TEMA_M)) d.removeAttribute(MARCA_TEMA_M);
      }
    };
    aplicar();
    // ⚠️ El taller de paletas (TemaCandidato, sólo admin) saca `data-tema` en cada
    // render fuera del Cliente de Diseño — y un `router.refresh()` lo vuelve a
    // renderizar. Sin este observador, al super admin se le aclaraba la app sola
    // después del pull-to-refresh.
    const obs = new MutationObserver(aplicar);
    obs.observe(d, { attributes: true, attributeFilter: [ATTR_MODO] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', aplicar);
    const alGuardar = (e: StorageEvent) => { if (e.key === LS_MODO) aplicar(); };
    window.addEventListener('mako-modo', aplicar);
    window.addEventListener('storage', alGuardar);
    return () => {
      obs.disconnect();
      mq.removeEventListener?.('change', aplicar);
      window.removeEventListener('mako-modo', aplicar);
      window.removeEventListener('storage', alGuardar);
      // Al salir de /m (a una pantalla de escritorio), el oscuro que puso /m se
      // va con él: el escritorio no aplica esta preferencia, y dejarlo puesto es
      // una pantalla que le cambia el tema a la app entera sin decirlo.
      if (d.getAttribute(MARCA_TEMA_M) === '1') {
        d.removeAttribute(ATTR_MODO);
        d.removeAttribute(MARCA_TEMA_M);
      }
    };
  }, []);

  // ── Service worker e instalación ─────────────────────────────────────────
  useEffect(() => {
    iniciarCapturaInstalacion();
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    // Sin `fetch` handler: el SW es sólo push + click. Un caché de HTML podría
    // servirle la cuenta de una persona a otra en el mismo teléfono.
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => { /* /sw.js todavía no existe o el navegador no lo permite: sin push, sin ruido */ })
      // ⚠️ Y LA SUSCRIPCIÓN QUE YA TIENE ESTE TELÉFONO SE ATA A QUIEN ESTÁ LOGUEADO AHORA
      // (`asegurarRegistro`, upsert por endpoint a la PERSONA, sin pedir permiso). Estaba escrita
      // y sin ningún call site (revisión del 11/10/2026): si en este teléfono se había activado
      // otra cuenta, la fila seguía siendo de ESA persona —le llegaban a este teléfono SUS
      // avisos, de SU negocio— y /m/cuenta le decía «activo» a la nueva, que mira sólo el
      // navegador. Va DESPUÉS del registro (comparte el SW) y no tira: es best-effort.
      .then(() => asegurarRegistro())
      .catch(() => { /* sin red o sin sesión: se reintenta en la próxima carga */ });
  }, []);

  // ── Ir hacia adelante anima; volver y cambiar de pestaña, no ─────────────
  const columnaRef = useRef<HTMLDivElement>(null);
  const rutaAnterior = useRef(pathname);
  useLayoutEffect(() => {
    const antes = rutaAnterior.current;
    rutaAnterior.current = pathname;
    if (antes === pathname) return;
    marcarCarga();
    if (profundidad(pathname) <= profundidad(antes)) return;
    const el = columnaRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const curva = getComputedStyle(el).getPropertyValue('--ease-out').trim() || 'ease-out';
    if (reducido()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'linear' });
    else el.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: curva });
  }, [pathname, marcarCarga]);

  // ── Lo que se dibuja ─────────────────────────────────────────────────────
  const porDefecto = cabeceraPorRuta(pathname);
  const titulo = pisada?.titulo ?? porDefecto.titulo;
  const padre = pisada && pisada.padre !== undefined ? pisada.padre : porDefecto.padre;
  const enHoy = pathname === HOME_MOVIL;
  const enCuenta = pathname === RUTA_CUENTA;
  const accionDefecto = enHoy && !cliente && usuario
    ? (
      <Link href={RUTA_CUENTA} className="m-cabecera__accion" aria-label={TITULO_CUENTA} title={TITULO_CUENTA}>
        <span className="m-cabecera__avatar" aria-hidden>{usuario.iniciales}</span>
      </Link>
    )
    : null;
  const accion = pisada && pisada.accion !== undefined ? pisada.accion : accionDefecto;
  const conBarra = llevaBarra(pathname);
  const activo = destinoActivo(pathname);
  const hora = !conexion.enLinea && conexion.datosDe ? horaCorta(conexion.datosDe) : '';

  const subirAlTope = () => {
    window.scrollTo({ top: 0, behavior: reducido() ? 'auto' : 'smooth' });
  };

  const valor = useMemo(() => ({
    dentro: true, setCabecera, conexion, marcarCarga, toast: mostrarToast,
  }), [setCabecera, conexion, marcarCarga, mostrarToast]);

  return (
    <ShellCtx.Provider value={valor}>
      <div className="m-shell" data-offline={conexion.enLinea ? undefined : ''} data-sin-barra={conBarra ? undefined : ''}>
        <header className="m-cabecera">
          <div className="m-cabecera__fila">
            {padre ? (
              <Link href={padre.href} className="m-cabecera__volver" aria-label={`Volver a ${padre.label}`}>
                <Icon name="chevron" size={20} />
                <span>{padre.label}</span>
              </Link>
            ) : (
              <h1 className="m-cabecera__titulo">{titulo}</h1>
            )}
            <span className="m-cabecera__espacio" />
            {cliente && !enCuenta && (
              <Link href={RUTA_CUENTA} className="m-cabecera__cliente" aria-label={`Viendo a ${cliente.nombre}. Abrir ${TITULO_CUENTA}`}>
                <span>{cliente.nombre}</span>
              </Link>
            )}
            {accion}
          </div>
        </header>

        {!conexion.enLinea && (
          <div className="m-cinta" role="status">
            <span className="m-cinta__punto" aria-hidden />
            {hora ? `Sin conexión · datos de las ${hora}` : 'Sin conexión'}
          </div>
        )}

        <main className="m-contenido">
          <div className="m-columna" ref={columnaRef}>{children}</div>
        </main>

        {conBarra && destinos.length > 0 && (
          <nav className="m-barra" aria-label="Secciones">
            <ul className="m-barra__lista">
              {destinos.map((d) => {
                const es = activo === d.id;
                const n = badges[d.id];
                return (
                  <li key={d.id}>
                    <Link
                      href={d.href}
                      className="m-barra__item"
                      aria-current={es ? 'page' : undefined}
                      // Tocar el destino en el que ya estás vuelve a su raíz (eso lo
                      // hace el link) y, si ya estás en la raíz, sube al tope.
                      onClick={(e) => { if (es && pathname === d.href) { e.preventDefault(); subirAlTope(); } }}
                    >
                      <span className={d.id === 'mako' ? 'm-barra__ico m-barra__ico--marca' : 'm-barra__ico'}>
                        <Icon name={d.icon} size={24} />
                        {n ? <span className="m-barra__badge" aria-hidden>{n > 99 ? '99+' : n}</span> : null}
                      </span>
                      <span className="m-barra__rotulo">{d.label}</span>
                      {n ? <span className="m-sr">{`, ${n} por resolver`}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {/* Los sheets se montan acá (portal): fuera del contenido, que se
            transforma al navegar y al tirar para refrescar, y un transform en un
            ancestro descoloca todo lo `position: fixed` de adentro. */}
        <div id="m-capas" />

        <div className="m-toast-capa" aria-live="polite">
          {toast && (
            <div key={toast.id} className="m-toast" role="status" data-saliendo={toast.saliendo ? '' : undefined}>
              <span className="m-toast__msg">{toast.mensaje}</span>
              {toast.deshacer && (
                <button
                  type="button"
                  className="m-toast__deshacer"
                  onClick={() => { const f = toast.deshacer; setToast(null); f?.(); }}
                >
                  Deshacer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </ShellCtx.Provider>
  );
}
