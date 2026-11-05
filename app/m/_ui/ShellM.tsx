'use client';

// =============================================================================
// ShellM — el cromo de MaKo Mobile: encabezado, título grande, barra, toasts y la vida de la app
// =============================================================================
// Lo monta app/m/layout.tsx UNA vez, con la barra del rol, los badges y el cliente ya
// resueltos en el server (nada de un fetch a /api/auth/me ni de un flash de la barra
// equivocada). Las páginas no lo tocan: le hablan por el contexto (./contexto.tsx).
//
// v2 (docs/diseno-mako-mobile-v2.md): el cromo es CLARO. El encabezado es `--bg` (sin blur,
// sin translúcido) con a lo sumo un control por lado; debajo, en el contenido, el TÍTULO
// GRANDE (--m-titulo). Al hacer scroll el grande se va con el contenido y el nombre chico
// aparece centrado en la barra con un filete (IntersectionObserver). La barra de abajo es
// `--surface` con filete arriba. El logo real de MaKo va sólo en Today, arriba a la izquierda.
//
// Lo que hace además de dibujar, y por qué vive acá y no en cada página:
//   · el TEMA sigue la preferencia que ya existía (`mako.modo`): claro por defecto, oscuro
//     SÓLO si la persona lo eligió. Y la meta `theme-color` sigue al --bg del tema (la barra
//     del sistema es del color del encabezado, que ahora cambia con el tema);
//   · registra el service worker (/sw.js, scope '/', sin caché de HTML): si el archivo
//     todavía no existe, el registro falla y se ignora;
//   · captura temprano el aviso de instalación de Chrome (lib/movil-instalar.ts);
//   · la cinta «Sin conexión» y el refresco solo al volver al frente (> 60 s);
//   · ir hacia ADENTRO desliza la pantalla desde la derecha (320 ms, --ease-drawer); volver
//     es instantáneo y cambiar de tab NO anima: se usa decenas de veces por día.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { useRutaInterna } from '@/app/_components/VistaMovil';
import { Icon } from '@/app/_components/icons';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { Criatura } from '@/app/_components/Criatura';
// La entrada va en el PRIMER HTML (22/10/2026): import de frente, nunca `dynamic(..., { ssr: false })`, que la dejaba para
// después de hidratar. No importa ningún .css (los tests de node importan el índice de app/m/_ui; cayó el run 182).
import { EntradaApp } from './EntradaApp';
import { ATTR_MODO, LS_MODO } from '@/lib/temas-candidatos';
import { CLAVE_ENTRADA_MOVIL } from './entrada';
import { HOME_MOVIL, destinoActivo, type IdBarra, type ItemBarra } from '@/lib/movil-rutas';
import { iniciarCapturaInstalacion } from '@/lib/movil-instalar';
import { asegurarRegistro } from '@/lib/push-cliente';
import { cabeceraPorRuta, nivel, rotuloVolver, RUTA_CONFIGURAR, RUTA_CUENTA, TITULO_CUENTA } from './cabecera';
import { ShellCtx, type CabeceraPisada, type ConexionM, type OpcionesToast } from './contexto';
import { PermisoIaM } from './PermisoIaM';
import { horaCorta } from './formato';
import { MARCA_TEMA_M } from './tema';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { MedidorDeUso } from '@/app/_components/MedidorDeUso';
import { esperarPausa, useDeslizarParaCerrar } from '@/app/_ui/descartar';
import { esTextoDeError } from '@/lib/soporte-reporte';

/** Un lugar de la barra (lib/movil-rutas.ts → `barraMovil`). */
export type DestinoBarra = ItemBarra;

type Toast = { id: number; mensaje: string; deshacer?: () => void; saliendo?: boolean; error?: boolean };

let secuenciaToast = 0;

/** La entrada de MaKo ya salió en esta apertura de la app (sessionStorage: dura lo que la pestaña o la app instalada). La
 *  misma clave la pone el final del onboarding, que ya la mostró (./entrada.ts). */
const LS_ENTRADA = CLAVE_ENTRADA_MOVIL;
/** Adónde vuela la entrada al tocarla: la criatura del Ops Center en la barra de abajo. */
const DESTINO_ENTRADA = 'data-mako-foto-barra';

function reducido(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function limpia(p: string): string {
  return p.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

/** La meta `theme-color` = el --bg del tema que se ve (la barra del sistema es del color del encabezado). */
function pintarBarraDelSistema() {
  try {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (!bg) return;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      if (m.getAttribute('content') !== bg) m.setAttribute('content', bg);
    });
  } catch { /* sin estilos todavía: queda el themeColor del layout */ }
}

export function ShellM({
  barra, badges, usuario, cliente, appIos = false, children,
}: {
  /** Es la app de iPhone de las tiendas (lib/tienda.ts). Lo lee el layout en el server: el dibujo nace sin relleno. */
  appIos?: boolean;
  /** Los lugares de la barra de este rol y esta capa (`barraMovil`), More siempre al final. */
  barra: DestinoBarra[];
  /** Un número por lugar, sólo lo que bloquea (app/m/badges.ts). */
  badges: Partial<Record<IdBarra, number>>;
  /** Las iniciales y, si la subió, la FOTO de Información personal (17/10/2026 noche: antes sólo iniciales). */
  usuario: { iniciales: string; foto?: string | null } | null;
  /** Viendo la cuenta de un cliente (super admin o agencia): su nombre. */
  cliente: { nombre: string } | null;
  children: ReactNode;
}) {
  // La ruta INTERNA (/m/crm/12), no la URL: con LAS MISMAS RUTAS (13/10/2026) el navegador dice
  // /crm/12 y la cabecera, la barra y el nivel de la animación hablan en rutas /m.
  const pathname = useRutaInterna();
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

  // ── La entrada de MaKo al abrir la app (21/10 → 22/10/2026) ──────────────
  // La criatura de MaKo desde que se toca el ícono hasta que la app está lista (./EntradaApp.tsx), una vez por APERTURA
  // (sessionStorage: volver del fondo no la repite) y, al irse, vuela al Ops Center de la barra. No sale en el onboarding
  // pendiente (/m/configurar tiene la suya) ni mirando la cuenta de un cliente.
  // ⚠️ NACE PRENDIDA, en el server (22/10/2026, Martín: «entre medio, se ve el ops center por unos segundos y luego viene la
  // animación de la criatura»). Hasta ese día nacía apagada y la prendía un efecto: existía recién después de hidratar, y
  // hasta ahí se veía el Centro sin hidratar. Si ya salió en esta apertura, el script de antes de pintar del layout
  // (ARRANQUE_ANTES_DE_PINTAR) la apaga por CSS antes del primer cuadro y EntradaApp avisa el fin al montarse.
  // ⚠️ La marca se pone cuando la entrada TERMINÓ (`finEntrada`), no al montarla (21/10/2026, 22:54, Martín: «Aún no
  // veo la animación»). Puesta al montar, la gastaba un documento que se iba enseguida: la app abría /second-brain, que
  // redirigía al Centro con una navegación dura, y el Centro ya la encontraba marcada (lib/movil-desvio.ts → `entradaMovil`).
  // Sólo al montar el shell: navegar no la vuelve a pedir (el estado inicial no se recalcula).
  const [entrada, setEntrada] = useState(() => !cliente && limpia(pathname) !== RUTA_CONFIGURAR);
  const finEntrada = useCallback(() => {
    try { sessionStorage.setItem(LS_ENTRADA, '1'); } catch { /* sin almacenamiento: no se repite en esta pantalla igual */ }
    setEntrada(false);
  }, []);

  // ── Toasts ───────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<Toast | null>(null);
  const mostrarToast = useCallback((mensaje: string, opciones?: OpcionesToast) => {
    secuenciaToast += 1;
    setToast({ id: secuenciaToast, mensaje, deshacer: opciones?.deshacer, error: opciones?.error ?? esTextoDeError(mensaje) });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    // Con «Deshacer» manda la ventana para revertir; sin él, es sólo un acuse. Un error se queda más: da tiempo a leerlo y a
    // tocar «Reportar a Soporte».
    const espera = toast.saliendo ? 200 : toast.error ? 8000 : toast.deshacer ? 5000 : 3200;
    // Mientras el dedo lo sostiene (o se lo arrastra), no se va (24/10/2026, app/_ui/descartar.tsx).
    const t = setTimeout(esperarPausa(() => {
      setToast((x) => (x && x.id === id ? (x.saliendo ? null : { ...x, saliendo: true }) : x));
    }), espera);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Tema: claro por defecto; oscuro SÓLO si la persona lo eligió ─────────
  useEffect(() => {
    const d = document.documentElement;
    const aplicar = () => {
      // Claro por defecto: oscuro SÓLO si la persona lo eligió (Martín, 11/10/2026: «por defecto es
      // white mode»). modoPreferido() sigue al sistema cuando no hay elección, y eso es del escritorio.
      let oscuro = false;
      try { oscuro = localStorage.getItem(LS_MODO) === 'oscuro'; } catch { /* incógnito: claro */ }
      const puesto = d.getAttribute(ATTR_MODO) === 'oscuro';
      if (oscuro) {
        if (!puesto) d.setAttribute(ATTR_MODO, 'oscuro');
        if (d.getAttribute(MARCA_TEMA_M) !== '1') d.setAttribute(MARCA_TEMA_M, '1');
      } else {
        if (puesto) d.removeAttribute(ATTR_MODO);
        if (d.hasAttribute(MARCA_TEMA_M)) d.removeAttribute(MARCA_TEMA_M);
      }
      // El encabezado es --bg, que cambia con el tema: la barra del sistema lo sigue. Una meta
      // no lee un var(), así que se le escribe el valor resuelto (mobile-native, punto 10).
      pintarBarraDelSistema();
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
      // (La meta theme-color no se toca: la ruta nueva trae la suya y React la pone.)
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

  // ── Ir hacia ADENTRO desliza desde la derecha; volver y cambiar de tab, no ─
  // ⚠️ SE ANIMA `left`, NO `transform`: un transform en un ancestro convierte a ese ancestro en
  // el contenedor de todo lo `position: fixed` de adentro, y el composer del chat o un pie fijo
  // saltarían a la mitad de la página durante 320 ms. `left` sobre un `position: relative` no
  // crea ese contenedor (el desborde lateral lo corta `overflow-x: clip` en .m-contenido).
  const columnaRef = useRef<HTMLDivElement>(null);
  const rutaAnterior = useRef(pathname);
  useLayoutEffect(() => {
    const antes = rutaAnterior.current;
    rutaAnterior.current = pathname;
    if (antes === pathname) return;
    marcarCarga();
    if (nivel(pathname, barra) <= nivel(antes, barra)) return;
    const el = columnaRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (reducido()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'linear' }); return; }
    const curva = getComputedStyle(el).getPropertyValue('--ease-drawer').trim() || 'cubic-bezier(.32, .72, 0, 1)';
    el.animate([{ left: '100%' }, { left: '0px' }], { duration: 320, easing: curva });
  }, [pathname, marcarCarga, barra]);

  // ── Lo que se dibuja ─────────────────────────────────────────────────────
  const ruta = limpia(pathname);
  const porDefecto = cabeceraPorRuta(ruta, barra);
  const titulo = pisada?.titulo ?? porDefecto.titulo;
  const padre = pisada && pisada.padre !== undefined ? pisada.padre : porDefecto.padre;
  const trabajo = pisada?.trabajo ?? porDefecto.trabajo;
  const esRaiz = barra.some((b) => b.href === ruta);
  // Una raíz de la barra nunca la esconde (sin ella no hay salida); /m/configurar sí.
  const conBarra = ruta !== RUTA_CONFIGURAR && (esRaiz || !trabajo);
  const grande = !trabajo && pisada?.grande !== false && titulo.trim() !== '';
  const enHoy = ruta === HOME_MOVIL;
  const enCuenta = ruta === RUTA_CUENTA;
  const accionDefecto = enHoy && !cliente && usuario
    ? (
      <Link href={RUTA_CUENTA} className="m-cabecera__accion" aria-label={TITULO_CUENTA}>
        {usuario.foto
          // eslint-disable-next-line @next/next/no-img-element -- una URL de Storage, como la barra de escritorio
          ? <img className="m-avatar m-avatar--sm m-avatar--foto" src={usuario.foto} alt="" aria-hidden />
          : <span className="m-avatar m-avatar--sm" aria-hidden>{usuario.iniciales}</span>}
      </Link>
    )
    : null;
  const accion = pisada && pisada.accion !== undefined ? pisada.accion : accionDefecto;
  const activo = destinoActivo(ruta, barra);
  const hora = !conexion.enLinea && conexion.datosDe ? horaCorta(conexion.datosDe) : '';

  // ── El nombre chico de la barra: aparece cuando el grande se fue ─────────
  // Se observa el elemento marcado `data-m-titulo-grande`: el título grande del shell o el
  // encabezado propio de una página (`grande: false`). Sin ninguno, el chico está siempre.
  const cabeceraRef = useRef<HTMLElement>(null);
  const [fuera, setFuera] = useState(!grande);
  useEffect(() => {
    const col = columnaRef.current;
    const cab = cabeceraRef.current;
    const el = col?.querySelector('[data-m-titulo-grande]');
    if (!col || !cab || !el) { setFuera(true); return; }
    setFuera(false);
    if (typeof IntersectionObserver === 'undefined') return;
    // Cuenta como «fuera» cuando quedó entero DEBAJO del encabezado (fijo), no de la ventana.
    // Los costados se agrandan un ancho entero: mientras la pantalla entra deslizando desde la
    // derecha, el título está fuera de la ventana POR EL COSTADO, y eso no es haber scrolleado
    // (sin esto, el nombre chico parpadeaba durante los 320 ms de la entrada).
    const tope = Math.max(0, Math.round(cab.getBoundingClientRect().bottom));
    const io = new IntersectionObserver(
      (entradas) => { const e = entradas[entradas.length - 1]; if (e) setFuera(!e.isIntersecting); },
      { rootMargin: `-${tope}px 100% 0px 100%`, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ruta, pisada, grande, titulo, children]);

  const subirAlTope = () => {
    window.scrollTo({ top: 0, behavior: reducido() ? 'auto' : 'smooth' });
  };

  const valor = useMemo(() => ({
    dentro: true, appIos, setCabecera, conexion, marcarCarga, toast: mostrarToast,
  }), [appIos, setCabecera, conexion, marcarCarga, mostrarToast]);

  return (
    <ShellCtx.Provider value={valor}>
      <div
        className="m-shell"
        data-offline={conexion.enLinea ? undefined : ''}
        data-sin-barra={conBarra ? undefined : ''}
        data-trabajo={trabajo ? '' : undefined}
      >
        {/* La entrada de MaKo va PRIMERA en el HTML (revisión del 22/10/2026): Chrome puede pintar mientras todavía lee el
            documento, y si la capa venía al final —detrás del Centro entero— el primer cuadro podía ser el Centro. Primera,
            lo primero que tiene para pintar es la capa. Arriba de todo la pone su z-index, no el orden. */}
        {entrada && <EntradaApp destino={`[${DESTINO_ENTRADA}]`} onFin={finEntrada} />}
        {/* La app de iPhone pregunta una vez antes de mandarle algo a una IA de terceros (Apple 5.1.2(i)). */}
        {usuario && <PermisoIaM />}

        <header className="m-cabecera" ref={cabeceraRef} data-fuera={fuera ? '' : undefined}>
          <div className="m-cabecera__fila">
            <div className="m-cabecera__lado">
              {padre ? (
                <Link href={padre.href} className="m-cabecera__volver" aria-label={`Volver a ${padre.label}`}>
                  <Icon name="chevron" size={22} />
                  <span>{rotuloVolver(padre.label)}</span>
                </Link>
              ) : enHoy ? (
                <span className="m-cabecera__logo"><MakoLogo size={28} animate={false} /></span>
              ) : null}
            </div>
            {/* El h1 de la pantalla es UNO: el título grande, el encabezado propio de la página
                (`grande: false`) o, si no hay ninguno de los dos, éste. */}
            {grande || pisada?.grande === false
              ? <div className="m-cabecera__titulo" aria-hidden>{titulo}</div>
              : <h1 className="m-cabecera__titulo">{titulo}</h1>}
            <div className="m-cabecera__lado m-cabecera__lado--der">
              {cliente && !enCuenta && (
                <Link href={RUTA_CUENTA} className="m-cabecera__cliente" aria-label={`Viendo a ${cliente.nombre}. Abrir ${TITULO_CUENTA}`}>
                  <span>{cliente.nombre}</span>
                </Link>
              )}
              {accion}
            </div>
          </div>
        </header>
        {/* Admin › Activity (5/11/2026): las pantallas y acciones del teléfono cuentan igual que las de la computadora. */}
        <MedidorDeUso />

        {!conexion.enLinea && (
          <div className="m-cinta" role="status">
            <span className="m-cinta__punto" aria-hidden />
            {hora ? `Sin conexión · datos de las ${hora}` : 'Sin conexión'}
          </div>
        )}

        <main className="m-contenido">
          <div className="m-columna" ref={columnaRef}>
            {grande && <h1 className="m-titulo-grande" data-m-titulo-grande="">{titulo}</h1>}
            {children}
          </div>
        </main>

        {/* El pie fijo de una pantalla (<PieFijoM>) se monta acá: fuera de la columna, que se
            mueve al navegar y al tirar para refrescar. */}
        <div id="m-pie" />

        {conBarra && barra.length > 0 && (
          <nav className="m-barra" aria-label="Secciones">
            <ul className="m-barra__lista">
              {barra.map((d) => {
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
                      onClick={(e) => { if (es && ruta === d.href) { e.preventDefault(); subirAlTope(); } }}
                    >
                      <span className="m-barra__ico">
                        {/* El Ops Center es la criatura de MaKo, que flota y parpadea (21/10/2026), como en la sidebar y en More. */}
                        {d.criatura
                          ? <span {...{ [DESTINO_ENTRADA]: '' }} style={{ display: 'inline-flex' }}><Criatura nombre={d.label} estrella size={24} /></span>
                          : <Icon name={d.icon} size={26} />}
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
            mueve al navegar y al tirar para refrescar. */}
        <div id="m-capas" />

        <div className="m-toast-capa" aria-live="polite">
          {toast && (
            <AvisoM key={toast.id} toast={toast} onCerrar={() => setToast(null)}>
              {toast.deshacer && (
                <button
                  type="button"
                  className="m-toast__deshacer"
                  onClick={() => { const f = toast.deshacer; setToast(null); f?.(); }}
                >
                  Deshacer
                </button>
              )}
            </AvisoM>
          )}
        </div>
      </div>
    </ShellCtx.Provider>
  );
}

/**
 * El aviso del teléfono (24/10/2026, Martín: «deberían tener un botón X para cerrarlas o si las desplazo se van, porque estoy editando
 * algo y aparecen y tengo que esperar a que se vayan para apretar el botón de atrás»): la ✕ a la derecha, deslizarlo de costado lo
 * descarta, y mientras el dedo lo sostiene no se va solo (app/_ui/descartar.tsx).
 */
function AvisoM({ toast, onCerrar, children }: { toast: Toast; onCerrar: () => void; children?: ReactNode }) {
  const desliza = useDeslizarParaCerrar(onCerrar);
  return (
    <div className="m-toast" role={toast.error ? 'alert' : 'status'} data-saliendo={toast.saliendo ? '' : undefined} {...desliza.props} style={desliza.estilo}>
      <span className="m-toast__msg">{toast.mensaje}</span>
      {/* Un error lleva «Reportar a Soporte» (23/10/2026); con `role="status"` el botón no se dibuja. */}
      <ReportarASoporte />
      {children}
      <button type="button" className="m-toast__cerrar" onClick={onCerrar} aria-label="Cerrar aviso"><Icon name="x" size={16} /></button>
    </div>
  );
}
