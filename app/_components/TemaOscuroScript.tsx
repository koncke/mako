// =============================================================================
// El interruptor del tema oscuro que corre ANTES del primer pintado
// =============================================================================
// ⚠️ SIN `'use client'`, Y ES TODO EL PUNTO.
//
// Este `<script>` vivía adentro de `TemaOscuro`, que es un componente cliente. Y
// React lo rechaza, con este error en la consola en CADA render:
//
//   «Encountered a script tag while rendering React component. Scripts inside
//    React components are never executed when rendering on the client.»
//
// Tiene razón: en el pase de cliente el script no se ejecuta. En el HTML del
// servidor sí, que es donde de verdad hacía falta —el flash blanco sólo existe
// en la carga completa— pero el error salía igual, en todos los renders.
//
// Y eso no es sólo ruido: el protocolo de depuración de este repo dice que ante
// un problema lo primero es mirar la consola de quien lo está viendo. **Un error
// falso y permanente enseña a ignorarla**, y el día que aparezca uno de verdad va
// a estar abajo de éste.
//
// Renderizado desde una Server Component, el script entra en el HTML y se ejecuta
// mientras el navegador parsea el `<head>`, antes de pintar nada — que es
// exactamente lo que se buscaba— y React no tiene un pase de cliente sobre el que
// quejarse.
//
// La otra mitad sigue en `TemaOscuro`: el `useEffect` cubre lo que el script no
// puede, que es volver a esta ruta por navegación de cliente, donde no hay
// documento nuevo que parsear. Y el cleanup, que saca el atributo al salir.

const MARCA = 'data-tema';
const VALOR = 'oscuro';
/**
 * ⚠️ LA MARCA QUE HACE QUE EL CLEANUP PUEDA EXISTIR, y es la mitad que faltaba.
 *
 * `TemaOscuro` decide si sacar el atributo al salir mirando si YA estaba puesto al
 * montarse — para no apagarle el oscuro a quien lo eligió para toda la app. Correcto, y
 * el script lo rompía: cuando corre, el atributo SIEMPRE está para cuando el efecto
 * monta, así que `yaEstaba` daba true y el cleanup no sacaba nada NUNCA.
 *
 * El resultado es una fuga: entrar a una pantalla oscura y volver al sidebar —que es
 * navegación de cliente, sin documento nuevo— dejaba la app entera en oscuro, incluido
 * el cliente que había elegido claro. Es la misma familia del incidente del laboratorio
 * de paletas: una pantalla que le cambia el tema a toda la app sin decirlo.
 *
 * Con esta marca las dos mitades pueden distinguir «se lo prestó el script» de «el
 * usuario ya lo tenía», que era la pregunta que ninguna de las dos podía contestar sola.
 */
const PRESTADO = 'data-tema-prestado';

/**
 * Va en el `page.tsx` (server) de toda pantalla que se pinte oscura, JUNTO con
 * `<TemaOscuro />` del lado del cliente. Las dos, siempre: el script evita el fogonazo
 * blanco del primer pintado y el componente devuelve el tema al salir.
 */
export function TemaOscuroScript() {
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html:
          `(function(){var d=document.documentElement;` +
          `if(d.getAttribute('${MARCA}')!=='${VALOR}'){` +
          `d.setAttribute('${PRESTADO}','1');d.setAttribute('${MARCA}','${VALOR}');}})()`,
      }}
    />
  );
}
