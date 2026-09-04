/**
 * Dónde está la pieza de rompecabezas y dónde el alfiler.
 *
 * ⚠️ ESTE PASO NO SE PUEDE ESCRIBIR, HAY QUE MOSTRARLO.
 *
 * El instructivo dice «toca el ícono de pieza de rompecabezas y, al lado de MaKo,
 * el alfiler». Son dos controles de Chrome que la mayoría de la gente no miró
 * nunca: viven en un rincón de la barra que se usa solo, y el segundo aparece
 * recién al abrir el primero. Nombrarlos no alcanza — quien no sabe cuál es la
 * pieza tampoco sabe que hay que abrirla para ver el alfiler.
 *
 * Y es el paso del que depende todo lo demás: sin anclar, el ícono de MaKo NO
 * está en la barra, así que los cuatro pasos siguientes mandan a tocar algo que
 * no se ve. Se lee como una instalación fallida.
 *
 * Va dibujado y no como captura de pantalla por dos razones: una captura de
 * Chrome envejece con cada rediseño de Chrome y nadie se entera, y además trae
 * las extensiones y los marcadores de quien la sacó — o sea, ruido y datos de una
 * máquina que no es la del que mira. Acá lo único que hay es lo que hay que
 * tocar.
 */
export function FiguraAnclar() {
  return (
    <svg
      viewBox="0 0 320 152"
      role="img"
      aria-label="La pieza de rompecabezas está a la derecha de la barra de Chrome; al abrirla, el alfiler está a la derecha de la fila de MaKo."
      style={{ width: '100%', maxWidth: 340, height: 'auto', display: 'block' }}
    >
      {/* La barra de Chrome, recortada al rincón que importa. */}
      <rect x="2" y="4" width="316" height="36" rx="8" fill="var(--surface-2)" stroke="var(--border)" />
      <rect x="16" y="15" width="196" height="14" rx="7" fill="var(--border)" />

      {/* El aro es la mitad del dibujo: dice CUÁL de los íconos de ese rincón. */}
      <circle cx="252" cy="22" r="15" fill="none" stroke="var(--primary)" strokeWidth="2" />
      <g transform="translate(242 12) scale(0.83)" fill="var(--ink)">
        <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
      </g>
      {/* Los tres puntos, sin aro: están para que se lea que ése es el rincón de
          siempre y no un dibujo abstracto. */}
      <g fill="var(--faint)">
        <circle cx="292" cy="16" r="1.7" />
        <circle cx="292" cy="22" r="1.7" />
        <circle cx="292" cy="28" r="1.7" />
      </g>

      {/* Que el panel SALE de ahí: sin la línea son dos dibujos sueltos. */}
      <path d="M252 41 v13" stroke="var(--primary)" strokeWidth="2" strokeDasharray="3 3" fill="none" />

      {/* El desplegable que aparece al tocarla. */}
      <rect x="122" y="56" width="194" height="92" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="138" y="76" fontSize="10" fontFamily="inherit" fill="var(--faint)" letterSpacing="0.6">
        EXTENSIONES
      </text>
      <line x1="122" y1="84" x2="316" y2="84" stroke="var(--border)" />

      {/* La fila de MaKo, con su alfiler. El alfiler lleva el mismo aro que la
          pieza: es el segundo —y último— lugar donde hay que tocar.
          ⚠️ El logo va como CUADRADO redondeado y no como círculo: un círculo lleno
          al principio de una fila con texto al lado se lee como un radio button, o
          sea como algo que hay que elegir — y acá no hay nada que elegir. */}
      <rect x="138" y="98" width="18" height="18" rx="5" fill="var(--primary)" />
      <text x="166" y="112" fontSize="12" fontFamily="inherit" fontWeight="600" fill="var(--ink)">
        MaKo
      </text>
      <circle cx="288" cy="107" r="13" fill="none" stroke="var(--primary)" strokeWidth="2" />
      <g transform="translate(280 99) scale(0.68)" fill="var(--ink)">
        <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
      </g>

      {/* Una segunda fila, gris y sin nombre: es lo que dice que MaKo va a estar en
          una LISTA y hay que encontrarlo, no solo en un panel con una sola fila. */}
      <rect x="138" y="128" width="18" height="18" rx="5" fill="var(--border)" />
      <rect x="166" y="133" width="54" height="8" rx="4" fill="var(--border)" />
    </svg>
  );
}
