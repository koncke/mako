'use client';

// =============================================================================
// La cuenta en la barra del sitio: la foto de perfil y su desplegable (15/11/2026)
// =============================================================================
// Martín, 15/11/2026, textual: «si yo ya tengo iniciada la sesión, en lugar de decirme iniciar sesión, debería ahí estar mi
// imagen de perfil, mi foto de perfil. Y si le doy clic, que me salte el desplegable, ya sea para ir al dashboard o para ir
// a la pestaña dentro de Maco, no? O para cerrar sesión». Hasta hoy la barra decía «Iniciar sesión» en sus DOS lugares (la
// de la computadora y el pie del menú del teléfono) también a quien ya estaba adentro, que es justo lo que /login dejó de
// hacer el día que se escribió app/login/YaLogueado.tsx: «parecía que se había deslogueado».
//
// ⚠️ LA SESIÓN SE PREGUNTA DESDE EL NAVEGADOR, NO SE LEE EN EL SERVER — Y LA RAZÓN NO ES LA QUE PARECÍA (medido el
// 15/11/2026). Esta nota decía antes que las páginas de esta barra «no llevan `dynamic` ni `revalidate`, o sea estáticas» y
// que leer la cookie acá «las vuelve dinámicas a veinte páginas públicas». NO ES CIERTO: ya se arman en cada visita, y el
// dato que lo tira abajo está una capa más arriba. app/layout.tsx —el layout RAÍZ, que envuelve TODAS las rutas— hace
// `await getSesionAdmin()` y `await getUsuarioActual()` en el cuerpo del componente, y eso es `await cookies()`
// (lib/auth.ts). En el Next de este repo (16.2.6, sin `ppr` ni `cacheComponents` en next.config.ts) `cookies()` cae en el
// modo `prerender-legacy` y llama a `throwToInterruptStaticGeneration`: «Route … couldn't be rendered statically because it
// used `cookies`», y de paso pone `revalidate = 0`. Son 25 las páginas que montan esta barra —las 19 landings,
// /vsl/comparaciones, /vsl/comparaciones/<slug>, /vsl/funnels/<funnel>, la PORTADA `/` y /vsl/<slug> (sus `revalidate = 300`
// tampoco corren) y /planes (ya era `force-dynamic`)— y NINGUNA es estática. No había nada estático que romper. Cualquier
// cuenta de costo que arranque en «son estáticas» está apoyada en nada.
//
// LA RAZÓN DE VERDAD, que sí hay que cuidar: esta barra se dibuja TAMBIÉN FUERA DE UN PEDIDO. La arman con
// `renderToStaticMarkup` tests/vsl-landings-competencia.test.ts, tests/vsl-landings-dicen-el-plan.test.ts,
// tests/planes-tres-bloques.test.ts y tests/barra-cuenta-sesion.test.ts, y lo mismo hace scripts/visor-landings/. Ahí no hay
// request store y `cookies()` no devuelve null: REVIENTA (`throwForMissingRequestStore`). Un `getUsuarioActual()` en la
// Barra deja esos cuatro tests en rojo y apaga el visor. Y mantiene lib/auth —con todo lo que arrastra— fuera de la cadena
// de la barra. El HTML igual para todos («Iniciar sesión») es además lo correcto para el buscador y para quien no tiene
// JavaScript. Lo que esto SÍ cuesta —un viaje más por carga, que antes no existía— está medido abajo, en «UNA PREGUNTA POR
// CARGA, NO DOS»; el server, en cambio, la tiene gratis (`getUsuarioActual` está memoizada por pedido con `cache()` y el
// layout raíz ya la pidió en ese mismo pedido). Si algún día hay que sacar ese viaje, el camino es pasar la sesión por prop
// desde el layout o la página —no leerla acá— y antes hay que arreglar esos cuatro `renderToStaticMarkup` y el visor.
//
// Y ES UN COMPONENTE, NO UN <script> SUELTO: app/vsl/_sitio/Interactivos.tsx (13/11/2026) ya pagó ese precio — «EN
// PRODUCCIÓN REACT SÍ TOMA LA PÁGINA (el error #418 de TemaSitio lo dejó a la vista)». Un script que mete nodos en la barra
// antes de que React termine rompía TODAS las páginas del sitio.
//
// LA FOTO VIENE EN DOS PASOS, y no por gusto. La sesión firmada NO la lleva (lib/auth-session.ts → `Sesion` tiene email,
// nombre y rol; la foto de Google sólo viaja en el paso intermedio del login, `Preauth.foto`) y `/api/auth/me` tampoco la
// devuelve. Ponerla ahí costaría otra lectura de la tabla `usuarios` en una ruta que corre en CADA carga de pantalla de la
// app —su propia nota la mide en 4,5 s con la función caliente—: sería pagarlo en toda la app para adornar el sitio.
// Entonces las iniciales se dibujan con el nombre que `/api/auth/me` ya trae, y la foto se pide aparte a `/api/perfil`, la
// misma puerta que usa el Sidebar (app/_components/Sidebar.tsx) y cuyo GET está abierto a todos los roles justamente
// «para que el Sidebar lea el nombre y la foto», y SÓLO cuando hay sesión. Si no hay foto guardada (`usuarios.foto_url` la
// llena Google al entrar, así que hasta entonces es NULL) o la imagen no carga, quedan las iniciales sobre el azul de
// marca: es lo que hacen Linear, Notion y Vercel, y no inventa un dato que no existe.
//
// ⚠️ `data-tema-fijo` EN LO QUE NACE DESPUÉS DE ABRIR LA PÁGINA. El sol y la luna del sitio
// (app/vsl/_competencia/TemaSitio.tsx) lee los colores calculados UNA vez al abrir y arma su plan; el botón de la cara
// aparece cuando contesta la red y el desplegable nace en el clic, así que no están en ese plan y, al cambiar de modo,
// quedarían del modo anterior. Con `data-tema-fijo` el script no los toca y los dos modos los declara el CSS con
// `html[data-sitio-modo]`, igual que `.s-mk-ico` en ./estilos.ts. Lo que SÍ está desde el principio —el link «Iniciar
// sesión»— se queda como hoy, mapeado por el script.
// =============================================================================

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as KeyboardEventReact } from 'react';
import { iniciales } from '@/lib/unicode-seguro';

/**
 * EL REPARTIDOR DE LA APP (app/inicio/page.tsx), no una tab: manda a cada uno a su casa —el super admin a su Ops Center, el
 * cliente y su equipo al de su negocio, un teléfono a /m, el onboarding pendiente al wizard—. Es el destino que ya usa
 * app/login/YaLogueado.tsx («Ir a mi tablero»), y por eso ese reparto no se copia acá: si mañana cambia, cambia en un lugar.
 *
 * ⚠️ PARA UN CLIENTE, ESTE RENGLÓN Y EL DE ABAJO CAEN EN EL MISMO LUGAR: en la computadora el repartidor lo manda al Ops
 * Center de su negocio (`casaEnLaComputadora`, lib/ops-center-ruta.ts), que ES la tab MaKo. Se diferencian para el super
 * admin (va a /admin/operaciones), en el teléfono (va a /m) y con el onboarding a medias (va al wizard). Si Martín los
 * quiere siempre distintos, el de arriba pasa a ser la tab Dashboard (`/dashboard`, app/_components/nav.ts, key `graphics`).
 */
const RUTA_TABLERO = '/inicio';
/**
 * La tab MaKo: el Ops Center del negocio (app/_components/nav.ts, la fila con key `mako`). `/mako` redirige acá.
 * Escrita a mano y no importada de `RUTA_OPS_CENTER_NEGOCIO` (lib/ops-center-ruta.ts) porque ese módulo arrastra
 * lib/capas.ts —el catálogo entero de los planes— al paquete de veinte páginas públicas para traer un string. Que las dos
 * digan lo mismo lo fija tests/barra-cuenta-sesion.test.ts, igual que tests/inicio-ops-center.test.ts ata esa constante al
 * `href` de la fila de la barra.
 */
const RUTA_MAKO = '/second-brain';

/** Los íconos del desplegable, del mismo set de trazo que los de los menús de la barra (24 × 24). */
const ICO = {
  tablero: ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 20l14 0'],
  mako: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  salir: ['M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2', 'M9 12h12l-3 -3', 'M18 15l3 -3'],
} as const;

function Ico({ d }: { d: readonly string[] }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}

/** Quién está adentro. `foto` vacía = sus iniciales (el caso normal hasta que Google la trae). */
type Quien = { nombre: string; email: string; foto: string };

/** Lo que se muestra de alguien: su nombre, y si no tiene, su correo (como app/login/YaLogueado.tsx). */
const comoSeLlama = (q: Quien): string => q.nombre || q.email;

/** La cara: la foto, o las iniciales sobre el azul de marca. */
function Cara({ q, tamano, onFalla }: { q: Quien; tamano: number; onFalla: () => void }) {
  return (
    <span className="s-cuenta-cara" style={{ width: tamano, height: tamano, fontSize: Math.round(tamano * 0.4) }} data-tema-fijo>
      {q.foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- la foto de perfil, servida por Google (lh3) o por el storage
        // del negocio: no pasa por el optimizador. `no-referrer` porque lh3 contesta 403 cuando le llega un referrer de otro
        // dominio, y la foto se caía a las iniciales sin motivo (lo mismo hace app/_ui/Avatar.tsx).
        <img src={q.foto} alt="" width={tamano} height={tamano} referrerPolicy="no-referrer" onError={onFalla} />
      ) : (
        <span aria-hidden="true">{iniciales(comoSeLlama(q))}</span>
      )}
    </span>
  );
}

// =============================================================================
// UNA PREGUNTA POR CARGA, NO DOS (15/11/2026)
// =============================================================================
// `<MenuCuenta>` está DOS veces en la misma página (./Barra.tsx: la barra de la computadora y el pie del menú del teléfono).
// Las dos MONTAN siempre —a una la esconde el CSS (`.s-solo-pc`) y la otra vive dentro de un `<details>` cerrado—, así que un
// fetch adentro del `useEffect` se dispara dos veces por carga. MEDIDO el 15/11/2026 montando `<Barra>` en un DOM de prueba:
// 2 pedidos a `/api/auth/me` sin sesión, y 4 con sesión (2 de `/api/auth/me` + 2 de `/api/perfil`).
//
// Y no es un pedido barato: `/api/auth/me` hace siete lecturas a la vez más la marca de «la última vez que entró»
// (app/api/auth/me/route.ts, su propia nota: «4,5 s medidos con la función caliente»), `/api/perfil` otras tres, y los pide
// CADA visita de las 25 páginas públicas que montan esta barra, también la que no tiene sesión, que son casi todas. Y es un
// viaje que antes NO existía: sus tres clientes de siempre (Sidebar, ImpersonationBanner, SeccionesTab) cuelgan de
// <HideOnPublicLanding>, que en lo público devuelve null (app/_components/PublicRouteGate.tsx), así que una landing no pedía
// /api/auth/me ni una vez. Pagar el doble por el mismo dato es, encima, pagarlo dos veces de más — y ojo con el motivo que
// se le ponga: NO es «las dejamos estáticas», porque estáticas no son (ver la nota de arriba y el layout raíz).
//
// Compartida, además, los dos lugares NO PUEDEN CONTRADECIRSE: hoy cada instancia tiene su propia suerte, y si un pedido
// contesta y el otro se cae, la barra de arriba muestra la cara y el pie del teléfono sigue diciendo «Iniciar sesión».
//
// Vive en el módulo y no en un estado de React a propósito: el módulo nace con el documento y muere con él, y dentro de una
// misma página la sesión sólo cambia al cerrarla, que recarga (`salir`). No es una caché que haya que invalidar.
// =============================================================================
let hayQuien: Promise<Quien | null> | null = null;
let hayFoto: Promise<string> | null = null;

/** Quién entró, o null si no hay nadie. `/api/auth/me` es la única puerta de sesión pública (lib/rutas-publicas.ts). */
async function preguntarQuien(): Promise<Quien | null> {
  const r = await fetch('/api/auth/me', { cache: 'no-store' });
  const j = (await r.json()) as { ok?: boolean; autenticado?: boolean; nombre?: string; email?: string };
  if (!j?.ok || !j.autenticado) return null;
  return { nombre: (j.nombre ?? '').trim(), email: (j.email ?? '').trim(), foto: '' };
}

/** La foto guardada (`usuarios.foto_url`, que /api/perfil sirve como `perfil.avatarUrl`), o vacía: quedan las iniciales. */
async function preguntarFoto(): Promise<string> {
  const p = await fetch('/api/perfil', { cache: 'no-store' });
  const jp = (await p.json()) as { ok?: boolean; perfil?: { avatarUrl?: string } };
  return jp?.ok ? (jp.perfil?.avatarUrl ?? '').trim() : '';
}

/**
 * «Iniciar sesión» mientras no se sabe de nadie; la cara con su desplegable en cuanto `/api/auth/me` dice que sí.
 *
 * `enElPie`: el pie del menú del teléfono. Ahí el botón lleva además el nombre (hay ancho, y el pie es una fila de botones
 * rotulados, no una barra de íconos) y el desplegable abre PARA ARRIBA, porque el pie está pegado al borde de abajo.
 *
 * El `<div>` de afuera está siempre, con sesión y sin ella, a propósito: TemaSitio mete el sol y la luna como hermano
 * dentro de `.s-barra-der`, y cambiar acá el tipo del nodo de más arriba obliga a React a reemplazarlo. Con un envoltorio
 * fijo, lo que cambia es siempre lo de ADENTRO y el botón del tema no se entera.
 */
export function MenuCuenta({ entrar, enElPie = false }: { entrar: string; enElPie?: boolean }) {
  const [quien, setQuien] = useState<Quien | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  /** Se abrió con el teclado: recién entonces el foco entra solo al primer renglón. */
  const conTeclado = useRef(false);
  const id = useId();

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const q = await (hayQuien ??= preguntarQuien());
        if (!vivo || !q) return;
        setQuien(q);
        // La foto, después y por su cuenta: si tarda o falla, las iniciales ya están puestas y no se ve ningún hueco.
        const url = await (hayFoto ??= preguntarFoto());
        if (vivo && url) setQuien((x) => (x ? { ...x, foto: url } : x));
      } catch {
        // Sin sesión, sin red o con la base caída: queda «Iniciar sesión», que es la verdad que se puede sostener. La
        // promesa rechazada queda guardada a propósito: las dos instancias se cuelgan de la MISMA caída, en vez de pedir
        // cada una su reintento que nadie pidió (el efecto corre una sola vez, igual que antes).
      }
    })();
    return () => { vivo = false; };
  }, []);

  const cerrar = useCallback((alBoton: boolean) => {
    setAbierto(false);
    if (alBoton) boton.current?.focus();
  }, []);

  // Un clic afuera y el Escape lo cierran; el Escape además devuelve el foco al botón, que es de donde salió.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: Event) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') cerrar(true); };
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar]);

  useEffect(() => {
    if (!abierto || !conTeclado.current) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [abierto]);

  /** Las flechas recorren los renglones, Inicio y Fin van a las puntas. */
  const porTeclas = (e: KeyboardEventReact<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const ultimo = items.length - 1;
    let j: number;
    if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = ultimo;
    else if (i < 0) j = e.key === 'ArrowUp' ? ultimo : 0;
    else j = e.key === 'ArrowDown' ? (i + 1) % items.length : (i + ultimo) % items.length;
    items[j]?.focus();
  };

  const salir = async () => {
    setSaliendo(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // La cookie se borra en el server; si el pedido no llegó, la recarga lo deja a la vista y se vuelve a intentar.
    }
    // SE RECARGA ESTA PÁGINA, no se va a /login como el Sidebar (app/_components/Sidebar.tsx): ahí abajo no queda nada que
    // mirar sin sesión, pero esto es el sitio público y se sigue leyendo igual. Mandar a /login a quien acaba de cerrar
    // sesión se lee como un botón que hace lo contrario de lo que dice. `location`, no el router: la cookie se relee del
    // server (lo mismo que anota app/login/YaLogueado.tsx).
    window.location.reload();
  };

  const clase = `s-cuenta${enElPie ? ' s-cuenta-pie' : ' s-solo-pc'}`;
  if (!quien) {
    return (
      <div className={clase} ref={caja}>
        <a className={enElPie ? 's-nb s-mv-entrar' : 's-nav-a'} href={entrar}>Iniciar sesión</a>
      </div>
    );
  }

  const quienEs = comoSeLlama(quien);
  const sinFoto = () => setQuien((q) => (q ? { ...q, foto: '' } : q));
  return (
    <div className={clase} ref={caja} data-arriba={enElPie ? '' : undefined}>
      {/* El nombre del botón NO cambia al abrir: si está abierto o cerrado ya lo dice `aria-expanded`, y un botón que se
          renombra al apretarlo se lee dos veces y se entiende una. */}
      <button
        type="button" ref={boton} className="s-cuenta-b" data-tema-fijo
        aria-expanded={abierto} aria-haspopup="menu" aria-controls={abierto ? id : undefined}
        aria-label={`Tu cuenta: ${quienEs}`}
        onClick={(e) => { conTeclado.current = e.detail === 0; setAbierto((v) => !v); }}
      >
        <Cara q={quien} tamano={32} onFalla={sinFoto} />
        {enElPie ? <span className="s-cuenta-n">{quienEs}</span> : null}
      </button>
      {abierto ? (
        <div className="s-cuenta-m" id={id} role="menu" aria-label="Tu cuenta" ref={menu} onKeyDown={porTeclas} data-tema-fijo>
          <div className="s-cuenta-quien">
            <Cara q={quien} tamano={40} onFalla={sinFoto} />
            <span className="s-cuenta-t">
              <b>{quienEs}</b>
              {quien.email && quien.email !== quienEs ? <span>{quien.email}</span> : null}
            </span>
          </div>
          <div className="s-cuenta-sep" />
          <a className="s-cuenta-f" role="menuitem" href={RUTA_TABLERO}><Ico d={ICO.tablero} />Ir a mi tablero</a>
          <a className="s-cuenta-f" role="menuitem" href={RUTA_MAKO}><Ico d={ICO.mako} />Abrir MaKo</a>
          <div className="s-cuenta-sep" />
          <button type="button" className="s-cuenta-f s-cuenta-salir" role="menuitem" onClick={salir} disabled={saliendo}>
            <Ico d={ICO.salir} />{saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
