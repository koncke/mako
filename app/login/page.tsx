// =============================================================================
// Login — cuatro caminos de entrada, un solo envoltorio
// =============================================================================
// El envoltorio (velo + marca + los dos paneles) vive en ./_ui/TarjetaLogin.tsx
// y lo comparten las tres pantallas de entrada: acá, /login/2fa y
// /login/restablecer. Antes estaba copiado a mano en las tres, con sus hexes.
//
// Desde el 15/11/2026 ese envoltorio es la pantalla ENTERA en dos paneles —el
// formulario a la izquierda, las animaciones de la portada en bucle a la derecha—
// porque Martín rechazó la tarjeta centrada: «está súper simple… quiero un
// rediseño completo del login». Esta página no sabe nada de eso: pone su
// contenido y lo hereda. Lo único que decide es si el panel derecho va mudo.
//
// El botón de Google vive en LoginForm (client, lee ?next= y ?error= con
// useSearchParams) y va envuelto en Suspense: el fallback es un hueco del alto
// del botón, así no salta la tarjeta.
//
// Con la sesión YA abierta no se muestra el formulario: eso le decía "Entrá al
// dashboard" a alguien que estaba adentro, y parecía que se había deslogueado.
// Se le avisa quién es y se lo lleva a /inicio, el repartidor por rol.
//
// Por eso la página dejó de ser estática: leer la cookie de sesión exige render
// dinámico. Es una pantalla de baja frecuencia, así que el costo es despreciable.
//
// ⚠️ LA JERARQUÍA ES LA DEL CAMINO REAL (14/11/2026). Google era un botón BLANCO
// secundario y «entrar con contraseña» el negro primario: la pantalla destacaba
// el camino de excepción —el que existe «para el día que Google no esté»— y
// escondía el de siempre detrás de un link gris de 13 px. Ahora Google es el
// primario y el correo el secundario; en la app de iPhone, donde Google no
// existe, el correo pasa a primario solo (ver ConCorreo en LoginForm.tsx).
// =============================================================================

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { YaLogueado } from './YaLogueado';
import { PedirLinkAlumno, BotonEntrarAlumno } from './EntrarAlumno';
import { TarjetaLogin, EncabezadoLogin } from './_ui/TarjetaLogin';
import { Alert } from '@/app/_ui/Estados';
import { getUsuarioActual } from '@/lib/auth';
import { hayAlumnoVigente } from '@/lib/alumno-acceso';
import { leerLinkAlumno, PARAM_LINK_ALUMNO } from '@/lib/alumno-sesion';
import { RUTA_ALUMNO } from '@/lib/rutas-publicas';
import { PARAM_APP } from '@/lib/app-escritorio-reglas';
import { previewDeDestino } from '@/lib/preview-links';
import { APP_BASE_URL } from '@/lib/app-url';
import { esAppIosDelPedido } from '@/lib/tienda-pedido';

export const dynamic = 'force-dynamic';

/**
 * LA TARJETA DE WHATSAPP SE DECIDE ACÁ, y no es un lugar raro: es donde el
 * crawler ATERRIZA. Sin sesión, `proxy.ts` corta cualquier ruta interna con un
 * 307 a `/login?next=<destino>`, así que la preview que se veía nunca fue la de
 * la pantalla — era el metadata raíz, idéntico para todo. Medido en producción:
 * un borrador, un resumen de lead, una integración y el plan devolvían los mismos
 * tres tags.
 *
 * El destino viaja en `next=`, que ya es público (está en el link que la persona
 * recibió), así que esto no le abre nada a nadie. Ver lib/preview-links.ts.
 */
export async function generateMetadata(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> },
): Promise<Metadata> {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const p = previewDeDestino(next);
  const imagen = `${APP_BASE_URL}/api/og?tipo=${encodeURIComponent(p.tipo)}`;
  return {
    title: p.titulo,
    description: p.descripcion,
    openGraph: {
      type: 'website', siteName: 'MaKo',
      title: p.titulo, description: p.descripcion,
      images: [{ url: imagen, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: p.titulo, description: p.descripcion, images: [imagen] },
  };
}

/**
 * Lo que dice /login sobre la entrada del ALUMNO con su email (07/10/2026), según cómo llegó:
 *   · `?entrar=<token>` (el link del mail) → el botón que termina de entrar, si la firma y el
 *     vencimiento valen; si no, «venció» y el pedido de otro abierto. Acá NO se mira la base ni se
 *     gasta nada: lo hace el POST del botón (un escáner de correo que abra el link no lo gasta).
 *   · `?alumno=<motivo>` (la vuelta de ese POST) → una frase, sin el porqué de fondo.
 */
const MOTIVO_ALUMNO: Record<string, string> = {
  vencido: 'El link venció o ya se usó. Pide otro.',
  intentos: 'Demasiados intentos. Prueba en unos minutos.',
  fallo: 'No pude abrir tu programa. Prueba de nuevo.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const tokenAlumno = uno(sp[PARAM_LINK_ALUMNO]).trim();
  // Sólo firma y vencimiento (puro, sin base): decide si se dibuja el botón o «venció».
  const linkValido = tokenAlumno ? leerLinkAlumno(tokenAlumno) != null : false;
  const motivoAlumno = tokenAlumno && !linkValido ? MOTIVO_ALUMNO.vencido : (MOTIVO_ALUMNO[uno(sp.alumno)] ?? null);
  const sesion = await getUsuarioActual();
  // El alumno de un curso (cookie `mako_alumno`, lib/alumno-sesion.ts) no tiene sesión de MaKo:
  // cualquier ruta interna lo rebota acá. En vez de mandarlo a un Google que no le abre nada
  // nuevo, se le ofrece volver a SU programa. La sesión de MaKo gana: si hay las dos, manda
  // YaLogueado.
  //
  // ⚠️ «Entrar con otra cuenta» NO es decorativo: sin él, quien tenga la cookie de alumno en un
  // navegador que también usa para MaKo (Martín o Mauricio probando una invitación) se queda en
  // esta pantalla sin forma de loguearse, porque el botón de Google no se dibuja. Va directo al
  // OAuth (GET), sin borrar la cookie: entrar como usuario no la necesita borrada.
  const alumno = sesion ? false : await hayAlumnoVigente();
  // LA APP DE ESCRITORIO PIDE EL LOGIN (25/10/2026, Martín: «jamás me pidió login... entró directo a la cuenta de Mauricio»):
  // con `?app=1` (app/_components/PuertaDeLaApp.tsx) se entra aunque el navegador tenga una sesión abierta, que puede ser de
  // otro. Sin esto, «Ya tienes la sesión abierta» llevaba adentro solo y la puerta volvía a mandar acá.
  const deLaApp = uno(sp[PARAM_APP]) === '1';
  // La app de iPhone entra con correo, contraseña y 2FA: Google prohíbe su OAuth en un WebView (T6, lib/tienda.ts).
  const sinGoogle = await esAppIosDelPedido();
  // ⚠️ ESTOS DOS CAMINOS NO LOS MIRA UN COMPRADOR DE MaKo (15/11/2026), y por eso el panel de las
  // animaciones se calla en ellos (`vitrina='muda'`). Es el cliente de OTRO negocio entrando a su curso, y la regla de esa audiencia
  // ya estaba escrita en ./EntrarAlumno.tsx: «LO LEE UN CLIENTE DE OTRO NEGOCIO: neutro con TÚ, corto,
  // y sin jerga de MaKo». La primera vuelta del rediseño del 15/11 le puso al lado «El mejor software
  // para vender High Ticket» en 904 px de 1440 (62,8 % de la pantalla, medido) a 34 px, contra los 20 px
  // del título que le habla a ella: lo más grande de su pantalla era un aviso nuestro; con las animaciones
  // sería un comercial nuestro en bucle. El panel NO se saca, se queda mudo. El logo tampoco: identidad
  // no es aviso.
  // Los tres motivos de MOTIVO_ALUMNO no entran acá a propósito: ésos caen en el login de MaKo, que sí
  // es nuestra puerta.
  const esDelAlumno = linkValido || alumno;
  return (
    <TarjetaLogin vitrina={esDelAlumno ? 'muda' : 'videos'}>
      {/* ⚠️ EL LINK DEL MAIL GANA SOBRE TODO LO DEMÁS: es una acción explícita que la persona
          acaba de pedir, y con la sesión de MaKo (o una cookie de alumno vieja) puesta no tendría
          dónde apretar. Entrar como alumno no toca la sesión de MaKo. */}
      {linkValido ? (
        <>
          <EncabezadoLogin titulo="Tu programa te espera" />
          <div className="lg-cuerpo">
            <BotonEntrarAlumno token={tokenAlumno} />
          </div>
        </>
      ) : sesion && !deLaApp ? (
        <YaLogueado nombre={sesion.nombre} email={sesion.email} />
      ) : alumno ? (
        <>
          <EncabezadoLogin titulo="Vuelve a tu programa" sub="Tienes el acceso guardado en este navegador." />
          <div className="lg-cuerpo">
            <a href={RUTA_ALUMNO} className="mk-btn mk-btn--primary mk-btn--lg mk-btn--full">
              Ir a tu programa
            </a>
            {!sinGoogle && (
              <a href="/api/auth/google?next=%2Finicio" className="lg-link">
                Entrar con otra cuenta
              </a>
            )}
          </div>
        </>
      ) : (
        <>
          <EncabezadoLogin
            titulo="Entra a tu cuenta"
            sub={deLaApp ? 'La app pide tu cuenta cada vez que se abre.' : undefined}
          />
          <div className="lg-cuerpo">
            {/* La vuelta del link del alumno (venció, intentos, fallo): arriba de todo. Es un
                <Alert>, que YA trae el role="alert" y «Reportar a Soporte» — el <div> de antes no
                tenía rol, así que un lector de pantalla nunca anunciaba que el link no servía. */}
            {motivoAlumno && <Alert tono="bad">{motivoAlumno}</Alert>}
            {/* ⚠️ EL HUECO VA EN `--fondo-columna` Y NO EN `--surface-2` (15/11/2026): ES EL ÚNICO
                BLOQUE DE LA PANTALLA QUE NO TIENE BORDE. Hasta el 14/11 el formulario vivía sobre
                una tarjeta `--surface`, y `--surface-2` sobre `--surface` se ve (1,111:1, medido).
                La primera vuelta del rediseño del 15/11 le sacaba el relleno al marco por debajo
                de 1024 px, así que el hueco quedaba sobre `--bg`: #f0f0ef sobre #efefed, 1,01:1 —
                INVISIBLE en el teléfono, y es el
                hueco donde va el botón de Google, o sea lo que se ve mientras carga en TODOS los
                caminos sin sesión. `--fondo-columna` es tinta translúcida (6 %), el token que la
                casa inventó justo para «que las columnas no sean invisibles»: mide 1,127:1 sobre
                `--bg` y 1,131:1 sobre `--surface` —lo mismo en los dos paneles— y se da vuelta en
                oscuro. Un color que existe PARA un fondo deja de servir cuando el fondo se va. */}
            <Suspense fallback={<div style={{ height: 'calc(var(--touch) + 8px)', borderRadius: 'var(--r-md)', background: 'var(--fondo-columna)' }} />}>
              <LoginForm sinGoogle={sinGoogle} />
            </Suspense>
            {/* «Soy alumno: entrar con mi email» (item 9): plegado, para no competir con el botón de
                Google de quien sí es usuario; abierto si se vuelve de un link que no abrió. */}
            <PedirLinkAlumno abierto={motivoAlumno != null} />
            {/* NO HAY REGISTRO, y conviene decirlo: sin esta línea la pantalla parece que le falta
                el «Crear cuenta» de cualquier login. Quien entra con una cuenta sin acceso recibe
                TEXTO_PEDIDO_REGISTRADO (lib/pedidos-ingreso-reglas.ts), que es lo mismo contado
                después del intento. */}
            <p className="lg-pie">El acceso a MaKo es por invitación.</p>
          </div>
        </>
      )}
    </TarjetaLogin>
  );
}
