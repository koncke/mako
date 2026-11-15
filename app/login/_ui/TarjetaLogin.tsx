// =============================================================================
// TarjetaLogin — el envoltorio de las TRES pantallas de entrada
// =============================================================================
// /login, /login/2fa y /login/restablecer son la misma pantalla con distinto
// contenido. Hasta el 14/11/2026 eso estaba COPIADO A MANO tres veces: el
// overlay, la tarjeta, el logo (un `✦` dentro de un cuadrado `#facc15`) y los
// mismos hexes clavados en cada una. El resultado medible: tres radios, tres
// anchos (380/400/400), tres paddings y un logo que no era el logo.
//
// Acá vive una sola vez. Si la pantalla de entrada cambia, cambia en un lugar.
//
// ⚠️ Y ESO ES LO QUE HIZO POSIBLE EL REDISEÑO DEL 15/11/2026 en un solo archivo.
// Martín: «tampoco me gusta el rediseño que hiciste del login. O sea, está súper
// simple. Yo quiero que sea un muy buen rediseño. Cópialo de otra aplicación o
// algo, pero quiero un rediseño completo del login». La tarjeta de 400 px
// centrada se fue; ahora son DOS PANELES copiados de Attio —el formulario a la
// izquierda, la marca a la derecha— y las tres pantallas lo heredan sin tocarlas.
// El porqué de Attio y sus números medidos están en ./login.css y en
// docs/diseno/login-attio.md.
//
// Y LA SEGUNDA VUELTA, el mismo 15/11, mirándolo en un artefacto: a pantalla
// completa (sin el contorno redondeado), el logo arriba a la izquierda del panel
// del formulario, el botón de sol y luna arriba a la derecha, y en el panel
// derecho las animaciones de la portada en bucle en vez de la frase.
//
// NO es 'use client' a propósito: las tres páginas son Server Components, y lo
// del cliente que arrastra (<MakoLogo/>, <InterruptorModo/>, <VitrinaVideos/>)
// ya lo es por su cuenta. La lista de clips se arma ACÁ, en el servidor, para que
// el bundle del login no se lleve los datos enteros de la portada.
//
// ⚠️ EL LOGO ES <MakoLogo/>, el de app/_components/MakoBrand.tsx. El `#facc15`
// de antes era un cuarto dorado inventado para una marca que tiene UNO
// (`--mako`, #F2B01E), y encima no dibujaba la chispa del logo sino el carácter
// `✦` de la tipografía del sistema. El wordmark va en `--ink` y no con el
// barrido de <MakoWord/>: un destello permanente deja de significar «MaKo está
// haciendo algo» (la regla está en MakoBrand.tsx y en app/_ui/LEEME.md).

import type { ReactNode } from 'react';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { InterruptorModo } from '@/app/_components/InterruptorModo';
import { TARJETAS_PORTADA } from '@/app/vsl/_sitio/datos';
import { VitrinaVideos, type ClipVitrina } from './VitrinaVideos';
import './login.css';

/**
 * HASTA DÓNDE SE MUESTRA CADA GRABACIÓN, en segundos: el último momento con contenido, ANTES de que vuelva a su arranque.
 *
 * ⚠️ LAS GRABACIONES DE LA PORTADA TERMINAN VOLVIENDO A SU PRIMER CUADRO, Y ACÁ ESO SE VE COMO UN ERROR (15/11/2026). En la
 * portada cada una se repite sola, así que están hechas para que el final empalme con el principio sin corte. En el login
 * pasan una detrás de otra, y esa vuelta se veía como que «por un segundo se reinicia la animación original… debería pasar
 * a la siguiente» (Martín). Medido: las 11 terminan en un cuadro casi idéntico al primero, y en algunas la vuelta dura
 * segundos — «referentes» ya está de nuevo en la grilla de caras a los 7 de sus 10 s; «automations», «carruseles» y
 * «crm-ficha» tienen colas de 2 a 5 s.
 *
 * ⚠️ Y EL CORTE SE ELIGIÓ MIRANDO, NO CON UNA FÓRMULA. La cuenta automática («el último pico de diferencia con el primer
 * cuadro») acertaba en los clips de un solo paso y se comía contenido de verdad en los de varios: en «video» cortaba en el
 * segundo 11 de 23 y se perdía la reproducción con los subtítulos, que es lo mejor del clip; en «crm-ficha» se perdía la
 * lista de actividad. Cómo se mide uno nuevo: `ffmpeg -i <clip>.webm -vf "fps=1,scale=192:-1,tile=6x4" -frames:v 1 tira.png`
 * y se anota el segundo del último cuadro antes de que vuelva el arranque. Un clip sin medir se ve ENTERO (con la vuelta);
 * tests/login-vitrina-animaciones.test.ts avisa cuando la portada suma uno.
 */
const HASTA_DONDE: Readonly<Record<string, number>> = {
  '/vsl-assets/sitio/referentes.webm': 6.9,
  '/vsl-assets/sitio/spy.webm': 20.1,
  '/vsl-assets/sitio/copywriting.webm': 10.4,
  '/vsl-assets/sitio/carruseles.webm': 10.0,
  '/vsl-assets/sitio/video.webm': 18.0,
  '/vsl-assets/sitio/copilot.webm': 12.6,
  '/vsl-assets/sitio/replicar.webm': 11.9,
  '/vsl-assets/sitio/crm-ficha.webm': 15.9,
  '/vsl-assets/sitio/automations.webm': 13.0,
  '/vsl-assets/sitio/chats.webm': 13.6,
  '/vsl-assets/sitio/comunidad.webm': 21.9,
};

/**
 * LAS ANIMACIONES DE LA PORTADA, en el orden de la portada: cada fila que muestra la app grabada (`visual.video`).
 * Las que no tienen video (el hero, los gurús, el Second Brain vivo, un recuadro de «falta») no entran.
 *
 * Reemplaza a la frase «El mejor software para vender High Ticket» que iba sola en este panel (15/11/2026). Martín: «en
 * lugar de poner el mejor software para vender High Ticket, ahí yo pondría los videos que hicimos de las animaciones…
 * en bucle de todas las cosas que hace MaKo».
 */
export const CLIPS_VITRINA: readonly ClipVitrina[] = TARJETAS_PORTADA.flatMap((t) =>
  typeof t.visual === 'object' && 'video' in t.visual
    ? [{ video: t.visual.video, poster: t.visual.poster, titulo: t.titulo, hasta: HASTA_DONDE[t.visual.video] ?? null }]
    : [],
);


/**
 * La pantalla de entrada ENTERA: el formulario a la izquierda, las animaciones a la derecha, sin marco alrededor.
 *
 * Martín, 15/11/2026, mirando la primera versión (dos paneles dentro de un contorno redondeado, el logo centrado arriba):
 * «el logo de MaKo debería estar arriba de entrar a tu cuenta… arriba a la izquierda del todo. Y evidentemente el login
 * debería ser completo, o sea, no estar en un bloque en el centro». Y «falta el botoncito de la luna y el sol».
 *
 * ⚠️ EL PANEL DE LAS ANIMACIONES VA DESPUÉS DEL FORMULARIO EN EL DOM, y no es casual: en un lector de pantalla y con el
 * tabulador se llega primero a lo que hay que hacer. Que se dibuje a la derecha lo decide el CSS, no el orden.
 */
export function TarjetaLogin({ children, pie, vitrina = 'videos' }: {
  children: ReactNode;
  /** Un renglón DEBAJO del formulario: de quién es la sesión, o por qué no hay registro. */
  pie?: ReactNode;
  /**
   * Qué muestra el panel derecho. `'muda'`: se pinta (el degradado y las rayas) y no muestra NADA de MaKo.
   *
   * ⚠️ EXISTE POR EL ALUMNO (15/11/2026). Hay dos caminos de /login que no los mira un comprador de MaKo sino el
   * cliente de OTRO negocio entrando a su curso (el link del mail y la cookie de alumno vigente). La regla de esa
   * audiencia está en app/login/EntrarAlumno.tsx: «LO LEE UN CLIENTE DE OTRO NEGOCIO: neutro con TÚ, corto, y sin jerga
   * de MaKo». Con la frase de antes, lo más grande de su pantalla era un aviso nuestro (904 px de 1440, a 34 px contra
   * los 20 del título que le hablaba a esa persona); con las animaciones sería un comercial nuestro en bucle. El logo y
   * el botón de sol y luna se quedan: quién sirve la pantalla y cómo se ve no son avisos.
   */
  vitrina?: 'videos' | 'muda';
}) {
  return (
    <div className="lg-velo">
      <div className="lg-panel">
        <div className="lg-marca">
          <MakoLogo size={30} />
          <span className="lg-marca__texto">MaKo</span>
        </div>
        <div className="lg-panel__centro">
          {children}
          {pie != null && <p className="lg-pie">{pie}</p>}
        </div>
      </div>
      <div className="lg-vitrina">
        {vitrina === 'videos' && <VitrinaVideos clips={CLIPS_VITRINA} />}
      </div>
      <div className="lg-modo"><InterruptorModo variante="sitio" /></div>
    </div>
  );
}

/**
 * El título de la tarjeta y su línea de propósito. Es un <h1>: antes el encabezado
 * de la pantalla era un `<div>` con un `fontSize` a mano, así que /login no tenía
 * encabezado para un lector de pantalla.
 *
 * `sub` dice QUÉ pasa acá, no adorna. Si se deduce del título, va vacía (regla de
 * la casa, app/_ui/LEEME.md).
 */
export function EncabezadoLogin({ titulo, sub }: { titulo: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h1 className="lg-titulo">{titulo}</h1>
      {sub != null && <p className="lg-sub">{sub}</p>}
    </div>
  );
}
