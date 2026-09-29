// =============================================================================
// Los íconos que comparten las piezas del CRM
// =============================================================================
// Vive acá y no adentro de un componente porque el lápiz lo dibujan DOS: el
// desplegable de productos (para abrir el pop-up de un embudo) y la fila de la
// etapa de entrada (para abrir por dónde entra la gente). Un SVG copiado en dos
// archivos es un SVG que va a divergir, y la única pregunta es cuándo.
//
// Los cuatro salen del mismo molde —14 px, trazo 2— porque comparten fila y dos de
// ellos se REEMPLAZAN entre sí: el lápiz se vuelve ✕ cuando el panel está abierto.

/** El molde: 14 px adentro de un botón de 28, trazo 2. Los cuatro íconos de una fila
 *  tienen que pesar lo mismo, o al cambiar uno por otro el botón parpadea. */
const MOLDE = {
  width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

/** El lápiz de «editar esto». 14 px: va adentro de un botón de 28. */
export function LapizIcon() {
  return (
    <svg {...MOLDE} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * La ✕ de «cerrar esto». Es el MISMO botón que el lápiz, con el ícono cambiado: «si le doy
 * al lapiz, debería aparecer una X de cerrar, y si cierro ahí nuevamente el lapiz».
 *
 * ⚠️ NO se importa `x` del catálogo (`app/_components/icons.tsx`): `Icon` dibuja con `size`
 * 20 y `strokeWidth` 1.85, así que sin pasarle `size={14}` la cruz sale más grande y más
 * fina que el lápiz de la fila de al lado — y además ese módulo arrastra el catálogo entero
 * (~60 íconos) al bundle del navegador por dos trazos.
 */
export function CerrarIcon() {
  return (
    <svg {...MOLDE} aria-hidden>
      <path d="M6.5 6.5l11 11" />
      <path d="M17.5 6.5l-11 11" />
    </svg>
  );
}

/**
 * Las flechas de mover una etapa de lugar. Eran los caracteres `↑` / `↓` como texto: el
 * glifo lo elige la fuente, así que pesaban distinto que el lápiz de la fila de al lado y
 * cambiaban de forma con la tipografía que llegara.
 *
 * Con asta y no un chevron pelado: en esta misma lista «desplegar» ya lo dice otro control
 * —el lápiz de la fila de entrada, que abre cómo entra la gente— y un chevron se leería igual.
 */
export function FlechaArribaIcon() {
  return (
    <svg {...MOLDE} aria-hidden>
      <path d="M12 19.5V5" />
      <path d="M5.5 11.5 12 5l6.5 6.5" />
    </svg>
  );
}

export function FlechaAbajoIcon() {
  return (
    <svg {...MOLDE} aria-hidden>
      <path d="M12 4.5V19" />
      <path d="M5.5 12.5 12 19l6.5-6.5" />
    </svg>
  );
}

/**
 * Las mismas, acostadas: en el TABLERO las etapas son columnas y se mueven de lado.
 *
 * ⚠️ Son cuatro íconos y no dos rotados con `transform`. Un `rotate(90deg)` sobre un SVG
 * con `strokeLinecap: round` corre el trazo medio píxel y la flecha queda con una punta
 * más gruesa que la otra — se ve al lado de su gemela, que es justo donde vive ésta.
 */
export function FlechaIzquierdaIcon() {
  return (
    <svg {...MOLDE} aria-hidden>
      <path d="M19.5 12H5" />
      <path d="M11.5 5.5 5 12l6.5 6.5" />
    </svg>
  );
}

export function FlechaDerechaIcon() {
  return (
    <svg {...MOLDE} aria-hidden>
      <path d="M4.5 12H19" />
      <path d="M12.5 5.5 19 12l-6.5 6.5" />
    </svg>
  );
}
