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
import { CLIPS_VITRINA } from '@/app/_components/clips-portada';
import { VitrinaVideos } from './VitrinaVideos';
import './login.css';

// Los clips (y el corte de cada uno, «HASTA DÓNDE») viven en app/_components/clips-portada.ts desde el 15/11/2026: los usa
// también /planes, y desde acá venían pegados a ./login.css, que se cargaba en cualquier página que los importara.
export { CLIPS_VITRINA } from '@/app/_components/clips-portada';


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
