import type { Metadata, Viewport } from 'next';
import { Suspense, type CSSProperties } from 'react';
import './globals.css';
import { Sidebar } from './_components/Sidebar';
import { AparicionDeTab } from './_components/AparicionDeTab';
import { NotificationsProvider } from './_components/NotificationsProvider';
import { ImpersonationBanner } from './_components/ImpersonationBanner';
import { AlertaVozMaKo } from './_components/AlertaVozMaKo';
import { MakoConfirmGate } from './_components/MakoConfirmGate';
import { AvisoPixelViejo } from './_components/AvisoPixelViejo';
import { AvisoExtensionVieja } from './_components/AvisoExtensionVieja';
import { AvisoMoraPlan } from './_components/AvisoMoraPlan';
import { GrabacionEnCurso } from './_components/grabar/GrabacionEnCurso';
import { CartelPagoCliente } from './_components/CartelPagoCliente';
import { EsquinaAvisos } from './_components/EsquinaAvisos';
import { FueraDeLoPublico, HideOnPublicLanding } from './_components/PublicRouteGate';
import { CentinelaArranque } from './_components/CentinelaArranque';
import { PuenteNativo } from './_components/PuenteNativo';
import { CopiaSinConexion } from './_components/CopiaSinConexion';
import { PedirAvisos } from './_components/PedirAvisos';
import { SeccionesTab } from './_components/SeccionesTab';
import { TituloTab } from './_components/TituloTab';
import { WsFetch } from './_components/WsFetch';
import { PuertaDeLaApp } from './_components/PuertaDeLaApp';
import { TemaCandidato } from './_components/TemaCandidato';
import { ModoArranque } from './_components/ModoArranque';
import { ModoDelUsuario } from './_components/ModoDelUsuario';
import { PuenteEnlace } from './video-generator/PuenteEnlace';
import { ZonaDelNegocio } from './_components/ZonaDelNegocio';
import { ReportadorDeErrores } from './_components/ReportarErrores';
import { VeloGuia } from './_ui/guia/VeloGuia';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { APP_BASE_URL } from '@/lib/app-url';
import { WsProvider } from './_ui/Link';
import { DesvioMovil } from './_components/DesvioMovil';
import { TelefonoProvider } from './_components/VistaMovil';
import { prefiereMovil, vistaEscritorioEnTelefono } from '@/lib/movil-guard';
import { VueltaAlTelefono } from './_components/VueltaAlTelefono';
import { MOVIL_ACTIVO, seDesvia } from '@/lib/movil-desvio';
import { getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { vistaDeOtro } from '@/lib/vista-de-otro';

// Título por defecto de las pantallas internas — es lo que se lee en la pestaña
// del navegador, al lado del favicon. El producto es MaKo: acá decía "Marketing
// OS — Mauricio Bustos", branding viejo de cuando era el dashboard interno de una
// sola cuenta. La landing (app/page.tsx) pisa esto con su propio título.
//
// Este es el título de ARRANQUE. Ya en el navegador, <TituloTab /> le agrega la
// sección donde estás parado ("MaKo - CRM"), para poder distinguir una pestaña de
// otra sin entrar a cada una.
export const metadata: Metadata = {
  title: 'MaKo',
  description: 'Marketing, CRM y ventas en una sola app.',
  // ⚠️ SIN `metadataBase` una imagen de OpenGraph declarada como ruta relativa NO SE
  // MANDA: Next necesita un origen para volverla absoluta, y sin él la deja afuera del
  // <head> con un warning en el build que nadie mira. Sale de APP_BASE_URL, que es la
  // única fuente del dominio (lib/app-url.ts) — un literal acá se queda viejo el día de
  // la próxima mudanza y las tarjetas apuntan a un host muerto.
  metadataBase: new URL(APP_BASE_URL),
  // La tarjeta que se ve al pegar un link de MaKo en un chat. No existía NINGUNA: no
  // había un solo `openGraph` en todo app/, así que cualquier link —la landing incluida—
  // se previsualizaba como texto pelado. Las pantallas que tienen algo mejor que mostrar
  // (un curso compartido) pisan esto con su propio `generateMetadata`.
  openGraph: {
    type: 'website',
    siteName: 'MaKo',
    title: 'MaKo',
    description: 'Marketing, CRM y ventas en una sola app.',
    images: [{ url: '/og-mako.jpg', width: 1200, height: 630, alt: 'MaKo' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-mako.jpg'] },
  // Agregada a la pantalla de inicio del celular tiene que verse como una app, no
  // como un marcador: sin esto el sistema pone la inicial del título en un cuadrado
  // gris. `apple-web-app` además la abre SIN la barra del navegador en iOS.
  // `default` (texto oscuro): MaKo Mobile v2 es CLARO (docs/diseno-mako-mobile-v2.md, «El
  // encabezado»). Con `black-translucent` iOS pintaba el reloj en BLANCO sobre el encabezado
  // claro. ⚠️ Instalada, iOS pinta su propia franja con `default`: si en un iPhone real se
  // nota contra --bg, el encabezado de /m pasa a --surface (se mide en el teléfono).
  appleWebApp: { capable: true, title: 'MaKo', statusBarStyle: 'default' },
};

// El color de la barra del sistema cuando la app corre desde la pantalla de inicio:
// el mismo fondo del badge, así no aparece una franja blanca arriba del contenido.
export const viewport: Viewport = { themeColor: '#171511' };

// Contenedor raíz: sidebar fijo + el <main> que aporta cada pantalla.
//
// ⚠️ `alignItems: 'stretch'` (el default), NUNCA `flex-start`. Acá NACE la cadena de
// altos de toda la app: con `flex-start` la columna que envuelve al <main> se queda del
// alto de SU contenido, así que ningún descendiente tiene un alto definido contra el que
// resolver un `1fr`, un `100%` o un `flex-basis: 0%`. Chrome igual les da un alto usable;
// Safari viejo devuelve CERO — y ahí un `overflow` cualquiera recorta la pantalla entera.
// Es la causa raíz de «el plan está vacío» reportado tres veces desde una Mac.
//
// Venía de la «réplica del rootStyle del prototipo», o sea copiado de un HTML suelto
// donde no había ninguna pantalla que tuviera que llenar el alto.
//
// ⚠️ EL ALTO MÍNIMO DESCUENTA LA BARRA DE ARRIBA (22/10/2026): con la barra de «Estás viendo el dashboard de…» o la alerta de
// la voz caída, `body` gana su padding-top, y un `100vh` a secas dejaba el documento 50 px más alto que la ventana (medido en
// el CRM: 860 de 811). app/globals.css lo corrige también para todo `min-height: 100vh` en línea.
const rootStyle: CSSProperties = {
  minHeight: 'calc(100vh - var(--barra-agencia, 0px))',
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontFamily: "'Geist', system-ui, sans-serif",
  display: 'flex',
  alignItems: 'stretch',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ⚠️ EL TALLER DE PALETAS SOLO EXISTE PARA EL SUPER-ADMIN, y esto es un GUARD, no una
  // preferencia. `<TemaCandidato>` mete un <script> que corre antes del primer pintado y
  // aplica el tema guardado en el localStorage del navegador — sin preguntar quién es.
  //
  // Lo que eso produjo, con un cliente mirando: la app ENTERA ilegible. Los temas
  // candidatos incluyen paletas CLARAS (`true-north` pone `--ink: #2E3440`), así que
  // sobre el lienzo oscuro quedó todo pintado del color del fondo — tarjetas, botones y
  // texto dibujados y borrados a la vez. Se reportó como «no están sus tareas y están
  // todos los botones mal»: no faltaba nada, no se veía nada.
  //
  // Y falla EN SILENCIO por diseño: el mismo bloque CSS le pone una transición de color
  // a todos los elementos, así que ni siquiera parpadea al aplicarse.
  //
  // El guard va en el SERVER y en positivo —solo admin— porque el localStorage lo
  // escribe el navegador y no sabe de sesiones: cualquier cliente que abra la app en un
  // browser donde alguien probó paletas se lleva el tema puesto.
  const esAdmin = !!(await getSesionAdmin());
  // La sesión (cacheada por request: `getSesionAdmin` ya la pidió) decide si se monta la detección de la zona del
  // negocio. La vieja compartida no es una persona: no detecta nada.
  const sesion = await getUsuarioActual();
  // MaKo Mobile: un TELÉFONO no ve el escritorio (lib/movil-desvio.ts). Lo decide el server
  // (UA + la cookie de «Versión completa»). Lo que tiene versión del teléfono lo sirve el PROXY en
  // la misma URL (LAS MISMAS RUTAS, proxy.ts); <DesvioMovil> sólo tapa, desde el primer pintado, lo
  // que se usa en la computadora.
  // ⚠️ El admin global SIN cliente también va a /m, a SU negocio (`wsPropioMovil`, el workspace de
  // plataforma): hasta el 12/10 se lo dejaba en el escritorio y era Martín (lib/movil-desvio.ts →
  // `seDesvia`). El workspace sólo se pregunta en un teléfono: la computadora no paga esa lectura.
  const esTelefono = MOVIL_ACTIVO && (await prefiereMovil());
  // Un TELÉFONO en la versión de computadora (la cookie de vista): lleva «Volver al teléfono» (20/10/2026).
  const enEscritorioDesdeTelefono = MOVIL_ACTIVO && sesion && !esTelefono ? await vistaEscritorioEnTelefono() : null;
  const telefono = seDesvia({ activo: MOVIL_ACTIVO, telefono: esTelefono });
  const wsPropioMovil = telefono && esAdmin && (await getWorkspaceActual()) == null ? await wsSuperAdmin() : null;
  // #881: a quién se está mirando, para que el PRIMER cuadro ya sea del cliente inspeccionado. Sin esto el
  // Sidebar nacía con «Mauricio Bustos» y la barra aparecía tarde, corriendo la pantalla. El atributo en <html>
  // abre el hueco de la barra desde el HTML del server (después lo maneja ImpersonationBanner).
  // ⚠️ Con una agencia adentro de un cliente, una ruta pública (/vsl, /compartido) cargada en duro queda con ese
  // hueco y sin barra: la barra no se monta ahí para sacarlo. Es raro y sólo es espacio; está en hallazgos-ui.
  const vista = sesion ? await vistaDeOtro() : null;
  return (
    <html lang="es" className="h-full antialiased" {...(vista ? { 'data-barra-agencia': '1' } : {})}>
      <body>
        {/* «Geist» es Urbanist desde el 31/10/2026 (el @font-face de app/globals.css), por eso de acá sólo sale la mono. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Notificaciones de WhatsApp a nivel app: badge del sidebar + sonido +
            pop-up, corriendo en cualquier sección. */}
        {/* El nombre de la sección en la pestaña del navegador va más abajo, adentro de
            <TelefonoProvider>: en el teléfono, /general se llama «Today». */}
        {/* No pinta nada: importarlo acá es lo que aplica el parche de fetch que
            le pega el `?ws=` de la pestaña a todas las llamadas a /api. Va lo más
            arriba posible del árbol para que el chunk cargue antes que nadie. */}
        <WsFetch />
        {/* LA APP DE ESCRITORIO PIDE EL LOGIN (25/10/2026, Martín: «jamás me pidió login... entró directo a la cuenta de
            Mauricio»): cada ventana nueva de la app instalada, o del acceso «MaKo», pasa por el login de la persona. Fuera de
            la app no hace nada. Va arriba: su tapa tiene que estar antes de que se vea la cuenta del perfil. */}
        <PuertaDeLaApp />
        {/* ⚠️ EL ENLACE DEL PUENTE VA EN EL LAYOUT, y no adentro de
            /video-generator. Su alcance tiene que ser el MISMO que el del content
            script que le habla, y ése está declarado en el manifest de la
            extensión: `https://hola-mako.com/*`, o sea TODA la app.

            Vivía adentro del return del catálogo de /video-generator, detrás de
            tres early returns. Con eso:
            · en el wizard —que es DONDE SE FILMA, el único lugar donde el puente
              importa— no había nadie escuchando;
            · y si la persona tenía otra pestaña de MaKo abierta en cualquier otra
              tab, la extensión le pedía el token A ÉSA, que tampoco escuchaba.
            En los dos casos el pedido moría por timeout, y el timeout se reportaba
            como «Inicia sesión en MaKo» a alguien que estaba logueada y mirando su
            propio tablero.

            No pinta nada y no corre nada hasta que le piden un token. */}
        <PuenteEnlace />
        {/* El tema candidato del rebrand, si hay uno puesto desde
            /admin/ui?tab=temas. Va acá arriba a propósito: su <script> tiene
            que correr ANTES del primer pintado o la app parpadea del tema viejo
            al nuevo en cada navegación. No pinta nada cuando no hay tema. */}
        {/* El claro/oscuro de cada persona (17/10/2026, tarjeta #883): claro por defecto, oscuro sólo si lo eligió en el
            interruptor de la barra. Va ANTES del taller de paletas: el script tiene que correr antes del primer pintado.
            Sólo con sesión: una página pública no se pinta con la preferencia de nadie. */}
        {sesion && <ModoArranque />}
        {/* La app de iPhone: guardar y compartir, los links universales y el toque en un aviso. Sin sesión también: los códigos
            de recuperación se bajan en /login/2fa. Afuera de la app no hace nada (lib/nativo.ts). */}
        <PuenteNativo />
        {/* Si la app muere arriba de app/global-error.tsx (la pantalla «This page couldn't load» de Next), avisa el error
            real y recarga UNA vez (21/10/2026, Martín en su Android: «siempre que entro me sale el reload»). Sin React. */}
        {sesion && <CentinelaArranque />}
        {/* MaKo sin conexión (28/10/2026, docs/diseno-mako-desktop-sin-conexion.md): renueva la copia cifrada del CRM y del Plan
            en un navegador donde la persona lo activó. No pinta nada; sin activar, no hace nada. Sólo en la computadora y
            nunca mirando la cuenta de otro (lo de un cliente no se guarda en la PC de quien lo inspecciona). */}
        {sesion?.email && !telefono && !vista && <CopiaSinConexion email={sesion.email} />}
        {sesion && <ModoDelUsuario />}
        {esAdmin && <TemaCandidato />}
        {/* La zona del negocio sale de la ubicación de SUS admins (decisión 4 de la décima, 11/10/2026). No pinta
            nada; quién cuenta como admin propio lo decide el server (app/_components/zona-actions.ts). */}
        {sesion && !sesion.legacy && <ZonaDelNegocio />}
        {/* El `?ws=` de la pestaña, leído UNA vez acá y repartido por contexto: es
            lo que hace que <Link> y router.push no te saquen del cliente que estás
            mirando.

            ⚠️ SIN <Suspense> ALREDEDOR, y es a propósito (10/10/2026). Acá había un
            `<Suspense fallback={null}>` que envolvía la app ENTERA «por el
            useSearchParams del WsProvider», y React escribe aparte —en un
            `<div hidden id="S:0">`, visible sólo cuando corre JavaScript— todo bloque
            de Suspense de más de 500 bytes una vez que lo ya escrito pasa los ~12.800
            (la cuenta es ACUMULATIVA), aunque el bloque ya esté listo. O sea que toda
            pantalla grande llegaba VACÍA a quien no ejecuta JS: Meta rechazó dos veces
            la verificación del negocio por la portada, y /privacidad (la política que
            revisa Google para la verificación de la agenda) mostraba 19 caracteres.

            El Suspense no protegía nada: `useSearchParams` sólo lo exige en una ruta
            que se prerenderiza ESTÁTICA, y acá ninguna lo es — el `await
            getSesionAdmin()` de arriba lee las cookies en cada request, y esa línea es
            la que hace dinámicas a las 61 páginas que no lo declaran. Si se mueve, el
            build se cae con «useSearchParams() should be wrapped in a suspense
            boundary». Lo que no se ve tiene su propio Suspense chico (el Sidebar, el
            título, el banner), y /crm su `loading.tsx`. Lo fija
            tests/layout-sin-suspense.test.ts, que también frena un `loading.tsx` nuevo
            que no esté en su lista: envuelve la página en un Suspense y la vuelve a
            esconder. */}
        <WsProvider>
        {/* Con LAS MISMAS RUTAS (13/10/2026) el teléfono ve /m en la URL /crm: lo que se apagaba
            con `esRutaMovil(pathname)` pregunta además si esto es un teléfono (app/_components/VistaMovil.tsx). */}
        <TelefonoProvider telefono={telefono}>
        {/* Nombre de la sección en la pestaña del navegador. */}
        <Suspense fallback={null}>
          <TituloTab />
        </Suspense>
        <DesvioMovil telefono={telefono} wsPropio={wsPropioMovil} />
        {enEscritorioDesdeTelefono && <VueltaAlTelefono global={enEscritorioDesdeTelefono.global} />}
        <NotificationsProvider>
          <div style={rootStyle}>
            {/* Sidebar usa useSearchParams (propaga el filtro de fecha). Su Suspense
                ya no lo exige el build (ninguna ruta es estática): se queda porque deja
                la barra —18 KB— fuera de lo que se lee sin JavaScript en las páginas
                que la dibujan, como /privacidad.
                Va DENTRO del gate: a alguien de afuera con un link compartido no
                se le muestran los nombres de las tabs internas. /vsl lo escondía
                por CSS desde la landing; ahora no hace falta el hack. */}
            <HideOnPublicLanding>
              <Suspense fallback={null}>
                <Sidebar inicial={{ nombre: sesion?.nombre ?? '', rol: sesion?.rol ?? '', clienteNombre: vista?.clienteNombre ?? null }} />
              </Suspense>
            </HideOnPublicLanding>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Chrome interno oculto en la landing pública /vsl (ver PublicRouteGate). */}
              <HideOnPublicLanding>
                <Suspense fallback={null}>
                  <ImpersonationBanner inicial={vista} />
                </Suspense>
                {/* La voz de MaKo caída, arriba de TODAS las pantallas de admin: un panel que
                    hay que abrir no avisa (ver AlertaVozMaKo). */}
                {esAdmin && <AlertaVozMaKo />}
              </HideOnPublicLanding>
              {/* Los cambios del CRM automático que esperan que alguien los confirme.
                  ⚠️ NO es un modal y NO bloquea: es una tarjeta plegada abajo a la derecha
                  («no significa que desaparezca, pero no quiero que interrumpa»). Y desde el
                  30/09 lee `useSearchParams` —el producto viaja en `?funnel=`, no en el
                  pathname— así que va envuelto en el Suspense que Next exige. */}
              {/* ⚠️ La esquina de abajo a la derecha es UN contenedor (06/10/2026): «A
                  revisar» y «Actualiza el Pixel» van apilados ahí adentro para no
                  pisarse. Ver app/_components/EsquinaAvisos.tsx. */}
              <EsquinaAvisos>
                <AvisoPixelViejo />
                {/* La extensión de MaKo instalada y vieja, en cualquier pantalla (27/10/2026: Leila en la 0.70 con la 0.74). */}
                {sesion && <AvisoExtensionVieja />}
                {/* La renovación del plan de MaKo que no entró: cuánto, cuándo se pausa, y a pagar (23/10/2026). */}
                {sesion && <AvisoMoraPlan />}
                {/* La llamada que se está grabando (04/11/2026): el reloj y «Cortar» desde cualquier pantalla, aunque se haya cerrado
                    la ficha. Sin grabación no dibuja nada (app/_components/grabar/GrabarLlamada.tsx). */}
                {sesion && <GrabacionEnCurso />}
                {/* LOS AVISOS SIN WHATSAPP (13/11/2026, el número de MaKo baneado): al entrar, en la computadora y en el teléfono, se pide el push en ESTE
                    dispositivo hasta que esté. Sólo con sesión propia y nunca mirando la cuenta de otro: el permiso es de cada persona. */}
                {sesion && !sesion.legacy && !vista && <PedirAvisos />}
                <MakoConfirmGate />
              </EsquinaAvisos>
              {/* Las secciones de las tabs unificadas (Video, Image, Copywriting): una barra, acá, para
                  todas sus pantallas. Ver app/_components/SeccionesTab.tsx. */}
              <HideOnPublicLanding><SeccionesTab /></HideOnPublicLanding>
              {/* Los errores sueltos de la ventana van solos a la Ticketera (17/10/2026): sólo con sesión, nunca en lo público.
                  ⚠️ Y TAMBIÉN EN EL TELÉFONO (21/10/2026): adentro de <HideOnPublicLanding>, que apaga el cromo de escritorio en
                  un teléfono, no se montaba nunca ahí, y la Ticketera no tenía ni un error de MaKo Mobile. */}
              {sesion && <FueraDeLoPublico><ReportadorDeErrores /></FueraDeLoPublico>}
              {/* La guía de cada pestaña (29/10/2026, «MaKo te enseña señalando»): el velo con sus huecos, UNA vez para toda la
                  app. Sin una tab que registre su guía (app/_ui/guia/useGuiaDeLaTab.ts) no dibuja nada. */}
              {sesion && <VeloGuia />}
              {/* El pago de un cliente de agencia que paga su propia cuenta, al terminar su onboarding (Agency Dashboard,
                  25/10/2026). Encima de todo y también en el teléfono: el primer mes no se cierra. */}
              {sesion && <CartelPagoCliente />}
              <AparicionDeTab />
              {children}
              {/* Toast global: avisa CADA operación de IA que gasta tokens y
                  linkea al detalle en Integraciones › Costo de MaKo. */}
              <HideOnPublicLanding>
{/* Acá vivía <IaUsageToast>: el cartel negro con los dólares de cada
    operación de IA, fijo abajo a la derecha. Se fue el 27/09/2026 (tanda 3
    de la fricción del CRM): compartía esquina con la tarjeta de MaKo y se le
    ponía encima justo cuando aparecía una confirmación nueva, o sea que el
    aviso de un costo de US$0,003 tapaba la decisión que había que tomar.

    El gasto NO se pierde: vive en /integraciones#saldo-ia con el historial
    de operaciones, que es donde se mira cuando se lo quiere mirar. Un toast
    por operación es un registro, y un registro no va en un cartel de 5s. */}              </HideOnPublicLanding>
            </div>
          </div>
        </NotificationsProvider>
        </TelefonoProvider>
        </WsProvider>
      </body>
    </html>
  );
}
