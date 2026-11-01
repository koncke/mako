// =============================================================================
// Los retratos de los referentes: dibujados acá, trazo por trazo (1/11/2026)
// =============================================================================
// Martín: «caricaturas de los grandes referentes... son caricaturas, no fotos», y al ver la primera tanda: «no me gustan, que se vean
// más realistas». Por eso tienen proporciones de una cara de verdad, luz y sombra, iris, nariz, labios, y pelo y barba con textura.
// Los rasgos salen de mirar sus fotos públicas: pelo, barba, lentes y la ropa con la que se los reconoce. Sin logos de nadie.
//
// ⚠️ UN DIBUJO NUESTRO, NUNCA UNA FOTO PROCESADA. Viven al lado de Muneco.tsx con sus mismas reglas: SVG en 40×40, sin hooks y sin ids
//    (por eso nada de gradientes: la luz son capas con opacidad, y el círculo es un `clip-path` de CSS). Los ojos son `.mun-ojos`:
//    parpadean como los de cualquier criatura y dicen el estado del chat.

import type { CSSProperties } from 'react';
import type { IdAsesor } from '@/lib/asesores/catalogo';
import type { Animo } from './Muneco';

const CIRCULO: CSSProperties = { clipPath: 'circle(20px at 20px 20px)' };
const PARPADO = '#2A1E18';

type Piel = { base: string; sombra: string; luz: string; labio: string };

/** Un ojo: la forma de almendra, el iris con su pupila y su brillo, y el párpado de arriba. */
function Ojo({ cx, y, iris, animo }: { cx: number; y: number; iris: string; animo: Animo }) {
  const arriba = `M${cx - 1.75} ${y}C${cx - 0.9} ${y - 1.15} ${cx + 0.9} ${y - 1.15} ${cx + 1.75} ${y}`;
  const almendra = `${arriba}C${cx + 0.9} ${y + 0.75} ${cx - 0.9} ${y + 0.75} ${cx - 1.75} ${y}Z`;
  return (
    <g>
      <path d={almendra} fill="#F6F2ED" />
      <circle cx={cx} cy={y - 0.12} r="0.82" fill={iris} />
      <circle cx={cx} cy={y - 0.12} r="0.42" fill="#120D0A" />
      {animo !== 'cansado' && <circle cx={cx + 0.28} cy={y - 0.42} r="0.2" fill="#fff" />}
      <path d={arriba} fill="none" stroke={PARPADO} strokeWidth="0.42" strokeLinecap="round" />
    </g>
  );
}

function Ojos({ animo, iris, piel, y = 16.7 }: { animo: Animo; iris: string; piel: Piel; y?: number }) {
  if (animo === 'dormido') {
    return (
      <g fill="none" stroke={PARPADO} strokeWidth="0.45" strokeLinecap="round">
        <path d={`M14.6 ${y}q1.7 1 3.4 0`} /><path d={`M22 ${y}q1.7 1 3.4 0`} />
      </g>
    );
  }
  return (
    <g className="mun-ojos mun-ojos--parpadeo" style={{ transformOrigin: `20px ${y}px` }}>
      <Ojo cx={16.3} y={y} iris={iris} animo={animo} />
      <Ojo cx={23.7} y={y} iris={iris} animo={animo} />
      {animo === 'cansado' && <>
        <path d={`M14.4 ${y - 1.2}h3.8v1h-3.8Z`} fill={piel.base} />
        <path d={`M21.8 ${y - 1.2}h3.8v1h-3.8Z`} fill={piel.base} />
      </>}
    </g>
  );
}

/** La cara sin lo que distingue a cada uno: las orejas, el óvalo con su luz y su sombra, la nariz y el cuello. */
function Rostro({ piel }: { piel: Piel }) {
  return (
    <>
      <path d="M16 24.5V32.6C17.6 34 22.4 34 24 32.6V24.5Z" fill={piel.sombra} />
      <path d="M15.9 26.8C17.4 29.4 22.6 29.4 24.1 26.8V29.2C22.4 31 17.6 31 15.9 29.2Z" fill="#2A1A12" opacity=".2" />
      <ellipse cx="12.1" cy="17.8" rx="1.25" ry="2.3" fill={piel.sombra} />
      <ellipse cx="27.9" cy="17.8" rx="1.25" ry="2.3" fill={piel.sombra} />
      <path d="M12.3 14C12.3 8.6 15.6 5.8 20 5.8S27.7 8.6 27.7 14C27.7 17 27.6 20 26.8 22.6 25.8 26 23 29 20 29S14.2 26 13.2 22.6C12.4 20 12.3 17 12.3 14Z" fill={piel.base} />
      {/* La luz viene de arriba a la izquierda: la sombra cae sobre el lado derecho y debajo de los pómulos. */}
      <path d="M25.3 8.8C27 10.8 27.7 13 27.7 15 27.7 18 27.4 21 26.6 23 25.8 25.5 24 27.6 22 28.6 24.4 25 25.6 21 25.8 17 25.9 14 25.8 11 25.3 8.8Z" fill={piel.sombra} opacity=".6" />
      <ellipse cx="17.8" cy="11" rx="3.8" ry="1.9" fill={piel.luz} opacity=".55" />
      <ellipse cx="15.6" cy="20" rx="1.7" ry="1.1" fill={piel.luz} opacity=".45" />
      {/* La nariz: la sombra de un costado, la punta con luz y las dos fosas. */}
      <path d="M20.7 16.6C21 18.4 21.8 19.6 22 20.5 21.6 21.2 20.8 21.4 20 21.4 20.6 21 21 20.4 20.9 19.6 20.8 18.6 20.6 17.6 20.7 16.6Z" fill={piel.sombra} opacity=".75" />
      <ellipse cx="19.8" cy="20.2" rx=".75" ry=".55" fill={piel.luz} opacity=".6" />
      <path d="M18.5 20.9q.5.3 1 .1M20.6 21q.5.2 1-.1" fill="none" stroke="#5A3626" strokeWidth=".32" strokeLinecap="round" />
    </>
  );
}

function Cejas({ color, grosor = 0.8 }: { color: string; grosor?: number }) {
  return (
    <g fill={color}>
      <path d={`M14.2 14.7C15.3 13.8 16.9 13.6 18.4 14.2V${14.2 + grosor}C17 14.6 15.6 14.7 14.4 ${14.7 + grosor}Z`} />
      <path d={`M25.8 14.7C24.7 13.8 23.1 13.6 21.6 14.2V${14.2 + grosor}C23 14.6 24.4 14.7 25.6 ${14.7 + grosor}Z`} />
    </g>
  );
}

/** Una sonrisa abierta: los dientes, el labio de arriba finito y el de abajo con su sombra. */
function Sonrisa({ piel, y = 23.7 }: { piel: Piel; y?: number }) {
  return (
    <>
      <path d={`M16.9 ${y}C18.3 ${y + 0.7} 21.7 ${y + 0.7} 23.1 ${y}C22.7 ${y + 2} 21.4 ${y + 2.9} 20 ${y + 2.9}S17.3 ${y + 2} 16.9 ${y}Z`} fill="#F8F4EF" />
      <path d={`M16.7 ${y}C18.2 ${y - 0.2} 19.3 ${y - 0.5} 20 ${y - 0.2}C20.7 ${y - 0.5} 21.8 ${y - 0.2} 23.3 ${y}C21.8 ${y + 0.55} 18.2 ${y + 0.55} 16.7 ${y}Z`} fill={piel.labio} />
      <path d={`M17.4 ${y + 1.8}C18.4 ${y + 3.6} 21.6 ${y + 3.6} 22.6 ${y + 1.8}C21.6 ${y + 3} 18.4 ${y + 3} 17.4 ${y + 1.8}Z`} fill={piel.labio} />
    </>
  );
}

const PIEL_HORMOZI: Piel = { base: '#D8A782', sombra: '#BC8863', luz: '#EFCDAE', labio: '#A9655A' };
const PELO_HORMOZI = '#2B1F18';

/** Hormozi: el pelo largo y ondulado hasta los hombros, la barba larga y cerrada, la sonrisa grande y la camisa a cuadros abierta sobre una remera blanca. */
function Hormozi({ animo }: { animo: Animo }) {
  const piel = PIEL_HORMOZI;
  return (
    <g style={CIRCULO}>
      <rect width="40" height="40" fill="#C9CDD3" />
      {/* El pelo de atrás, que cae hasta los hombros. */}
      <path d="M9.8 10C6.4 16 5.4 25 6.4 33 8.2 35.6 11 34 13.2 30.2H26.8C29 34 31.8 35.6 33.6 33 34.6 25 33.6 16 30.2 10Z" fill={PELO_HORMOZI} />
      {/* La camisa a cuadros, abierta, y la remera. */}
      <path d="M15.2 40.5 16 31.6H24L24.8 40.5Z" fill="#F1ECE5" />
      <path d="M0 40.5C.4 35.4 5.6 32.8 12.6 31.2L16.4 31 15.2 40.5Z" fill="#7C2A2C" />
      <path d="M40 40.5C39.6 35.4 34.4 32.8 27.4 31.2L23.6 31 24.8 40.5Z" fill="#7C2A2C" />
      <g fill="none" stroke="#3F1619" strokeWidth=".7" opacity=".75">
        <path d="M4 40V35M8.2 40V33.6M12.2 40V32M2 37.4H15.4M6 34.6H16" /><path d="M36 40V35M31.8 40V33.6M27.8 40V32M38 37.4H24.6M34 34.6H24" />
      </g>
      <Rostro piel={piel} />
      {/* La barba larga, con la mandíbula entera, y su textura. */}
      <path d="M12.3 16.4C12.5 20 12.7 23.2 13.6 26.2 14.8 29.6 17.2 31.6 20 31.6S25.2 29.6 26.4 26.2C27.3 23.2 27.5 20 27.7 16.4 27 19 26.1 20.8 24.8 21.4 23.2 21.9 21.6 21.5 20 21.5S16.8 21.9 15.2 21.4C13.9 20.8 13 19 12.3 16.4Z" fill={PELO_HORMOZI} />
      <g fill="none" stroke="#54402F" strokeWidth=".3" strokeLinecap="round" opacity=".8">
        <path d="M14.6 23.6q.4 2.2 1.5 3.8M16.8 27.8q.7 1.4 1.7 2.4M23.2 27.8q-.7 1.4-1.7 2.4M25.4 23.6q-.4 2.2-1.5 3.8M20 28v2.8M18.3 28.2l.4 2.4M21.7 28.2l-.4 2.4" />
      </g>
      <Sonrisa piel={piel} />
      {/* El pelo de arriba: raya al medio, con volumen y mechones. */}
      <path d="M11 18.4C8.8 9.4 12.4 2.2 20.2 2S31.4 9.4 29 18.4C28.6 14 27.4 11 25.4 9.4 23.4 9.4 20.8 8.2 19.2 6.8 18 8 16 9 14.6 9.4 12.6 11 11.4 14 11 18.4Z" fill={PELO_HORMOZI} />
      <g fill="none" stroke="#5B4433" strokeWidth=".32" strokeLinecap="round" opacity=".8">
        <path d="M19.4 3.4C16.4 4.4 13.4 7 12.2 12M20.6 3.4C24 4.4 27 7 28 12.2M17 3.8C15 4.8 13.6 6.2 12.8 8M23 3.8C25 4.8 26.4 6.2 27.2 8" />
        <path d="M8.6 18q-1.2 5 .1 11M31.4 18q1.2 5-.1 11M10.6 23q-.5 4 .6 7M29.4 23q.5 4-.6 7M7.8 26q.1 3 .9 5.4M32.2 26q-.1 3-.9 5.4" />
      </g>
      <Cejas color={PELO_HORMOZI} grosor={0.9} />
      <Ojos animo={animo} iris="#4A3324" piel={piel} />
    </g>
  );
}

const PIEL_JUAN: Piel = { base: '#E2B793', sombra: '#C4966F', luz: '#F4D5BA', labio: '#B56F62' };

/** Juan ADS: el pelo corto y oscuro peinado hacia arriba, los lentes de marco fino, la barba de pocos días y la remera negra. */
function JuanAds({ animo }: { animo: Animo }) {
  const piel = PIEL_JUAN;
  return (
    <g style={CIRCULO}>
      <rect width="40" height="40" fill="#2F5FD0" />
      <path d="M0 40.5C.4 35.2 6 32.6 13 31.2 15.4 33.8 24.6 33.8 27 31.2 34 32.6 39.6 35.2 40 40.5Z" fill="#17181B" />
      <path d="M14.6 31C16.4 33.6 23.6 33.6 25.4 31" fill="none" stroke="#33353B" strokeWidth=".5" />
      <Rostro piel={piel} />
      {/* La barba de pocos días: una capa finita sobre la mandíbula y el bigote. */}
      <path d="M12.9 19C13.1 20.6 13.3 21.6 13.6 22.8 14.6 26 17.2 28.9 20 28.9S25.4 26 26.4 22.8C26.7 21.6 26.9 20.6 27.1 19 26.4 21.4 25.2 22.6 23.6 22.4 21.4 22 18.6 22 16.4 22.4 14.8 22.6 13.6 21.4 12.9 19Z" fill="#2A1D16" opacity=".42" />
      <path d="M17.4 22.8q2.6-.9 5.2 0" fill="none" stroke="#2A1D16" strokeWidth=".55" opacity=".45" strokeLinecap="round" />
      <Sonrisa piel={piel} y={23.9} />
      {/* El pelo corto, con el jopo hacia arriba y los costados rebajados. */}
      <path d="M12.1 13.6C11.3 9.4 12.6 5.6 16 4.2 19.8 2.4 25.8 2.8 27.4 6.6 28.3 8.8 28.4 11.4 27.9 13.6 27.4 11.4 26.6 10 25.2 9.2 21.8 9.8 17.4 9.4 14.8 9.8 13.4 10.6 12.6 11.8 12.1 13.6Z" fill="#191412" />
      <g fill="none" stroke="#463A33" strokeWidth=".3" strokeLinecap="round" opacity=".85">
        <path d="M15.4 8.6C16.6 6.6 19 5 22.4 4.6M18.2 8.8C19.4 7.2 21.4 6 24.6 5.8M21.4 8.8C22.4 7.8 24 7.2 26 7.4" />
      </g>
      <Cejas color="#191412" />
      <Ojos animo={animo} iris="#3A2A1E" piel={piel} />
      {/* Los lentes, encima de los ojos. */}
      <g fill="none" stroke="#17181B" strokeWidth=".42">
        <rect x="13.8" y="14.9" width="5" height="3.7" rx="1.5" /><rect x="21.2" y="14.9" width="5" height="3.7" rx="1.5" />
        <path d="M18.8 16.2q1.2-.7 2.4 0M13.8 16.2l-1.5-.3M26.2 16.2l1.5-.3" />
      </g>
    </g>
  );
}

const PIEL_JULIAN: Piel = { base: '#F0CDB1', sombra: '#D5A788', luz: '#FBE4D2', labio: '#C27F74' };
const PELO_JULIAN = '#6E4A2E';

/** Julián Otálora: el pelo castaño claro despeinado y con volumen, sin barba, la sonrisa ancha y el buzo crema. */
function JulianOtalora({ animo }: { animo: Animo }) {
  const piel = PIEL_JULIAN;
  return (
    <g style={CIRCULO}>
      <rect width="40" height="40" fill="#E4E7EC" />
      <path d="M0 40.5C.4 35.4 6 32.8 13.4 31.4 15.6 34 24.4 34 26.6 31.4 34 32.8 39.6 35.4 40 40.5Z" fill="#E9E1D3" />
      <path d="M13.8 30.8C15.6 34.2 24.4 34.2 26.2 30.8L27.4 31.6C25 36 15 36 12.6 31.6Z" fill="#D5CAB7" />
      <path d="M3 40c.6-2.4 1.8-4 3.6-5M37 40c-.6-2.4-1.8-4-3.6-5" fill="none" stroke="#CFC3AF" strokeWidth=".6" />
      <Rostro piel={piel} />
      <Sonrisa piel={piel} y={23.6} />
      {/* El pelo despeinado: mechones sueltos que caen sobre la frente. */}
      <path d="M11.8 15.4C10.6 10 11.8 5.4 15.4 3.8 18.6 2 24.4 2.2 26.8 4.8 29 7 29.2 11 28.2 15.4 27.8 12.8 27.2 11.2 26 10.2 25.2 11 24 11.2 23 10.6 22.2 11.6 20.8 11.8 19.8 11 18.6 12 17 12 16 11 15 11.6 14 11.4 13.4 10.8 12.6 12 12.1 13.4 11.8 15.4Z" fill={PELO_JULIAN} />
      <g fill="none" stroke="#9A7350" strokeWidth=".34" strokeLinecap="round" opacity=".85">
        <path d="M14.4 9.6C14.8 7.6 16.2 5.6 18.6 4.8M17.8 9.8C18.2 7.8 19.8 5.8 22.4 5.2M21.6 9.4C22.2 7.8 23.6 6.4 25.6 6.2M24.8 9.4C25.6 8.6 26.4 8.2 27.2 8.4" />
      </g>
      <Cejas color={PELO_JULIAN} grosor={0.65} />
      <Ojos animo={animo} iris="#5C4630" piel={piel} />
    </g>
  );
}

const PIEL_SOFIA: Piel = { base: '#E8BE9C', sombra: '#CB9A78', luz: '#F7DCC4', labio: '#B8525A' };
const PELO_SOFIA = '#1D1512';

/** Sofía Contreras: el pelo largo, lacio y muy oscuro, la sonrisa grande y el blazer sobre una blusa clara. */
function SofiaContreras({ animo }: { animo: Animo }) {
  const piel = PIEL_SOFIA;
  return (
    <g style={CIRCULO}>
      <rect width="40" height="40" fill="#D8CFE6" />
      <path d="M10.6 10C7.8 16 7 26 7.6 37 11 39 14.4 36 15.4 31H24.6C25.6 36 29 39 32.4 37 33 26 32.2 16 29.4 10Z" fill={PELO_SOFIA} />
      <path d="M2 40.5C2.6 36 7 33.6 13.4 32.2L16 36.6 20 40.5 24 36.6 26.6 32.2C33 33.6 37.4 36 38 40.5Z" fill="#2C2A33" />
      <path d="M16 32.2 20 40.5 24 32.2C22.4 33.4 17.6 33.4 16 32.2Z" fill="#F2EEE8" />
      <Rostro piel={piel} />
      <Sonrisa piel={piel} y={23.8} />
      <path d="M11.8 17.6C10.6 9.8 13.6 3.4 20.4 3.2S29.6 9.8 28.4 17.6C28 14 27 11.2 25.4 9.6 22.4 9.6 18.6 8.8 16.4 7.2 15.6 8.4 14.8 9.2 14.4 9.8 12.8 11.4 12.2 14.2 11.8 17.6Z" fill={PELO_SOFIA} />
      <g fill="none" stroke="#4B3A31" strokeWidth=".3" strokeLinecap="round" opacity=".85">
        <path d="M16.8 5.2C15 6.2 13.6 8.2 12.8 11.4M21 4.4C24.2 5 26.8 7.4 27.6 11.6M9.4 18q-1 7-.6 14M30.6 18q1 7 .6 14M11.2 22q-.6 5-.2 10M28.8 22q.6 5 .2 10" />
      </g>
      <Cejas color={PELO_SOFIA} grosor={0.55} />
      <Ojos animo={animo} iris="#3E2A1D" piel={piel} />
      <path d="M14.5 16.1l-.6-.5M18 16.1l.5-.5M22 16.1l-.5-.5M25.5 16.1l.6-.5" fill="none" stroke={PARPADO} strokeWidth=".35" strokeLinecap="round" />
    </g>
  );
}

const PIEL_MARCOS: Piel = { base: '#E0B390', sombra: '#C1906C', luz: '#F3D3B8', labio: '#AE6D60' };
const PELO_MARCOS = '#1B1411';

/** Marcos Razzetti: el pelo corto, oscuro y peinado al costado, sin barba, la mandíbula marcada y la camisa azul. */
function MarcosRazzetti({ animo }: { animo: Animo }) {
  const piel = PIEL_MARCOS;
  return (
    <g style={CIRCULO}>
      <rect width="40" height="40" fill="#17233D" />
      <path d="M0 40.5C.4 35.2 6 32.4 13.2 31 15.6 33 24.4 33 26.8 31 34 32.4 39.6 35.2 40 40.5Z" fill="#3E6EA8" />
      <path d="M15 30.8 20 36 25 30.8 26.8 32 21 38.4H19L13.2 32Z" fill="#2F5687" />
      <Rostro piel={piel} />
      <path d="M13.2 22.6C14.2 26 17 29 20 29S25.8 26 26.8 22.6C25.6 25 23 26.8 20 26.8S14.4 25 13.2 22.6Z" fill={piel.sombra} opacity=".55" />
      <Sonrisa piel={piel} y={23.7} />
      <path d="M12 14.4C11 9.4 12.8 4.8 17.2 3.8 21.4 2.6 26.6 3.4 27.8 7.4 28.5 9.6 28.5 12 28 14.4 27.6 12.2 26.8 10.6 25.4 9.6 22 9.8 18 8.4 16.4 7.4 15.8 9 14.6 10 13.8 10.6 12.8 11.6 12.3 13 12 14.4Z" fill={PELO_MARCOS} />
      <g fill="none" stroke="#463930" strokeWidth=".3" strokeLinecap="round" opacity=".85">
        <path d="M16.6 7C18.6 5.4 21.6 4.6 24.6 5.2M18.6 8.2C20.6 6.8 23.4 6.4 26 7.2M21.6 9C23 8.4 24.8 8.4 26.6 9.2" />
      </g>
      <Cejas color={PELO_MARCOS} grosor={0.75} />
      <Ojos animo={animo} iris="#3A2A1E" piel={piel} />
    </g>
  );
}

const PIEL_VICTOR: Piel = { base: '#DDAF8B', sombra: '#BC8B67', luz: '#F0CFB3', labio: '#A9695C' };
const PELO_VICTOR = '#17110E';

/** Víctor Heras: el jopo oscuro con los costados rebajados, la barba prolija y bien marcada, y la ropa oscura. */
function VictorHeras({ animo }: { animo: Animo }) {
  const piel = PIEL_VICTOR;
  return (
    <g style={CIRCULO}>
      <rect width="40" height="40" fill="#E2B33C" />
      <path d="M0 40.5C.4 35.2 6 32.4 13.2 31 15.8 34 24.2 34 26.8 31 34 32.4 39.6 35.2 40 40.5Z" fill="#141518" />
      <path d="M14.6 30.8C16.4 34.2 23.6 34.2 25.4 30.8L26.8 31.4C24.4 36 15.6 36 13.2 31.4Z" fill="#2A2C31" />
      <Rostro piel={piel} />
      {/* La barba prolija: corta, con el borde limpio sobre la mejilla. */}
      <path d="M12.6 17.4C12.8 20.4 13 22.4 13.5 24 14.6 27.2 17.2 29.6 20 29.6S25.4 27.2 26.5 24C27 22.4 27.2 20.4 27.4 17.4 26.8 19.8 25.8 21.6 24.2 22 22.8 22.2 21.4 21.7 20 21.7S17.2 22.2 15.8 22C14.2 21.6 13.2 19.8 12.6 17.4Z" fill={PELO_VICTOR} opacity=".92" />
      <g fill="none" stroke="#4A3B31" strokeWidth=".26" strokeLinecap="round" opacity=".7">
        <path d="M15 24.6q.5 1.6 1.5 2.6M23.5 27.2q1-1 1.5-2.6M18.4 27.4l.3 1.4M21.6 27.4l-.3 1.4" />
      </g>
      <Sonrisa piel={piel} y={23.8} />
      <path d="M12.3 13.2C11.8 10.4 12.2 8.4 13.6 7 14.4 4.2 18.4 2.2 22.4 2.6 25.8 2.8 28.4 5 28.2 8.2 28.2 10 28 11.6 27.7 13.2 27.3 11.4 26.6 10.2 25.4 9.6 21.6 10.4 17.4 10 14.8 9.8 13.6 10.4 12.8 11.6 12.3 13.2Z" fill={PELO_VICTOR} />
      <g fill="none" stroke="#4E413A" strokeWidth=".3" strokeLinecap="round" opacity=".85">
        <path d="M14.8 8.6C16 6 19 4.2 22.8 4.2M17.4 9C18.6 7 21 5.6 24.6 5.6M20.6 9.2C22 8 24 7.2 26.8 7.6" />
      </g>
      <Cejas color={PELO_VICTOR} grosor={0.85} />
      <Ojos animo={animo} iris="#33241A" piel={piel} />
    </g>
  );
}

// ── El resto, con una sola pieza: lo que cambia de uno a otro son sus datos ──────────────────────────────────────────────────

type Rasgos = {
  fondo: string;
  piel: Piel;
  iris: string;
  pelo: { color: string; brillo: string; frente: string; atras?: string; mechones: string };
  ropa: { color: string; cuello?: string; forma?: 'remera' | 'saco' | 'camisa' };
  barba?: 'dias' | 'corta';
  lentes?: string;
  gorra?: string;
  cejas?: number;
};

const CUERPO_REMERA = 'M0 40.5C.4 35.2 6 32.6 13.2 31.2 15.6 33.8 24.4 33.8 26.8 31.2 34 32.6 39.6 35.2 40 40.5Z';

function Retratito({ r, animo }: { r: Rasgos; animo: Animo }) {
  const { piel, pelo, ropa } = r;
  const forma = ropa.forma ?? 'remera';
  return (
    <g style={CIRCULO}>
      <rect width="40" height="40" fill={r.fondo} />
      {pelo.atras && <path d={pelo.atras} fill={pelo.color} />}
      <path d={CUERPO_REMERA} fill={ropa.color} />
      {forma === 'saco' && <>
        <path d="M15.6 31.4 20 40.5 24.4 31.4C22.6 33 17.4 33 15.6 31.4Z" fill={ropa.cuello ?? '#F2EEE8'} />
        <path d="M14.4 31 18 37 15 40.5M25.6 31 22 37 25 40.5" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".6" />
      </>}
      {forma === 'camisa' && <path d="M15.6 31.2 20 36.4 24.4 31.2C22.6 32.8 17.4 32.8 15.6 31.2Z" fill={piel.base} />}
      {forma === 'remera' && ropa.cuello && <path d="M14.8 31C16.4 34 23.6 34 25.2 31" fill="none" stroke={ropa.cuello} strokeWidth=".6" />}
      <Rostro piel={piel} />
      {r.barba === 'dias' && <>
        <path d="M12.9 19C13.1 20.6 13.3 21.6 13.6 22.8 14.6 26 17.2 28.9 20 28.9S25.4 26 26.4 22.8C26.7 21.6 26.9 20.6 27.1 19 26.4 21.4 25.2 22.6 23.6 22.4 21.4 22 18.6 22 16.4 22.4 14.8 22.6 13.6 21.4 12.9 19Z" fill={pelo.color} opacity=".36" />
        <path d="M17.4 22.8q2.6-.9 5.2 0" fill="none" stroke={pelo.color} strokeWidth=".55" opacity=".4" strokeLinecap="round" />
      </>}
      {r.barba === 'corta' && <path d="M12.6 17.4C12.8 20.4 13 22.4 13.5 24 14.6 27.2 17.2 29.6 20 29.6S25.4 27.2 26.5 24C27 22.4 27.2 20.4 27.4 17.4 26.8 19.8 25.8 21.6 24.2 22 22.8 22.2 21.4 21.7 20 21.7S17.2 22.2 15.8 22C14.2 21.6 13.2 19.8 12.6 17.4Z" fill={pelo.color} opacity=".94" />}
      <Sonrisa piel={piel} y={23.8} />
      <path d={pelo.frente} fill={pelo.color} />
      <path d={pelo.mechones} fill="none" stroke={pelo.brillo} strokeWidth=".3" strokeLinecap="round" opacity=".85" />
      {r.gorra && <>
        <path d="M11.8 12.6C11.4 7 15 3.4 20 3.4S28.6 7 28.2 12.6C24 11 16 11 11.8 12.6Z" fill={r.gorra} />
        <path d="M10.6 13.6C15 11 25 11 29.4 13.6 29.8 14.2 29.3 14.6 28.8 14.4 24.4 12.8 15.6 12.8 11.2 14.4 10.7 14.6 10.2 14.2 10.6 13.6Z" fill="#0B0C0E" />
      </>}
      <Cejas color={pelo.color} grosor={r.cejas ?? 0.75} />
      <Ojos animo={animo} iris={r.iris} piel={piel} />
      {r.lentes && (
        <g fill="none" stroke={r.lentes} strokeWidth=".5">
          <circle cx="16.3" cy="16.8" r="2.75" /><circle cx="23.7" cy="16.8" r="2.75" />
          <path d="M19 16.4q1-.6 2 0M13.6 16.4l-1.3-.3M26.4 16.4l1.3-.3" />
        </g>
      )}
    </g>
  );
}

const PIEL_CLARA: Piel = { base: '#EFCBAE', sombra: '#D3A584', luz: '#FBE2CE', labio: '#BE7C70' };
const PIEL_MEDIA: Piel = { base: '#E2B793', sombra: '#C4966F', luz: '#F4D5BA', labio: '#B16D60' };

/** Lo que sigue salió de mirar sus fotos públicas: el rasgo por el que se lo reconoce está en el comentario de cada uno. */
const RASGOS: Partial<Record<IdAsesor, Rasgos>> = {
  // Agustín Nievas: rubio oscuro, pelo largo y revuelto, sin barba, buzo negro.
  'agustin-nievas': {
    fondo: '#3B2A5C', piel: PIEL_CLARA, iris: '#4C5F4A', ropa: { color: '#141518' },
    pelo: {
      color: '#A67E4C', brillo: '#D9B98A',
      atras: 'M10.6 11C8.8 16 8.8 22 10.2 27.6 12 28 13 26.4 13.4 24.4H26.6C27 26.4 28 28 29.8 27.6 31.2 22 31.2 16 29.4 11Z',
      frente: 'M11.4 16.6C10 10.6 11.4 5.4 15 3.8 18.6 2 24.8 2.2 27.2 5 29.4 7.2 29.6 11.6 28.6 16.6 28.2 13.4 27.4 11.6 26.2 10.4 25.2 11.6 23.8 11.8 22.8 11 21.8 12.2 20.2 12.4 19.2 11.4 17.8 12.6 16.2 12.4 15.2 11.4 14 12 13 12.4 12.4 13 11.9 14 11.5 15.2 11.4 16.6Z',
      mechones: 'M14.2 10.4C14.6 8 16.2 5.6 19 4.8M17.8 10.6C18.4 8.2 20.2 6 23 5.4M21.8 10C22.6 8.2 24.2 6.6 26.4 6.6M10.8 18q-.6 4 .2 7.6M29.2 18q.6 4-.2 7.6',
    },
  },
  // Derek Chamizo: muy joven, pelo oscuro corto rebajado, barba de pocos días, buzo negro.
  'derek-chamizo': {
    fondo: '#C8232C', piel: PIEL_MEDIA, iris: '#3A2A1E', barba: 'dias', ropa: { color: '#141518', cuello: '#34363C' },
    pelo: {
      color: '#1E1714', brillo: '#4A3D35',
      frente: 'M12.4 12.8C12 9 13.4 5.8 16.6 4.8 20 3.6 25.4 4 27 7.2 27.8 9 27.9 11 27.6 12.8 27.2 11 26.4 9.8 25.2 9.4 21.6 8.6 17.6 9 14.8 9.6 13.6 10.2 12.9 11.2 12.4 12.8Z',
      mechones: 'M15.8 8.2C17.4 6.4 20 5.4 23 5.6M19 8C20.6 6.8 23 6.2 25.6 7',
    },
  },
  // David Turu: pelo oscuro ondulado, sin barba, remera negra.
  'david-turu': {
    fondo: '#E9DDC6', piel: PIEL_MEDIA, iris: '#3E2C20', ropa: { color: '#17181B', cuello: '#34363C' },
    pelo: {
      color: '#2C1F18', brillo: '#5F4A3C',
      frente: 'M12 14C11.2 10 12 6.4 14.8 5.2 15.6 3.2 18.4 2.6 20.4 3.4 22.6 2.4 25.6 3.4 26.4 5.4 28.4 6.8 28.8 10.4 28 14 27.6 11.8 27 10.6 26 10 24.8 10.8 23.4 10.4 22.4 9.6 21.4 10.6 19.8 10.6 18.8 9.8 17.6 10.8 16.2 10.8 15 10.2 13.6 10.8 12.6 12 12 14Z',
      mechones: 'M15 8.8q.6-2.6 3-3.4M19 8.6q.8-2.4 3-3M22.6 8.6q1-1.8 3-2M14 6.8q.8-.8 1.8-1',
    },
  },
  // Ximena Fukuda: pelo largo y ondulado color miel, sonrisa grande, vestido crema.
  'ximena-fukuda': {
    fondo: '#3A2E2A', piel: PIEL_CLARA, iris: '#4A3324', cejas: 0.55, ropa: { color: '#EFE6D6', forma: 'camisa' },
    pelo: {
      color: '#A5763F', brillo: '#DDB57E',
      atras: 'M10 10C7 16 5.6 26 6.6 36 9.6 38.6 13.6 36.6 15.2 31H24.8C26.4 36.6 30.4 38.6 33.4 36 34.4 26 33 16 30 10Z',
      frente: 'M11.8 17.6C10.6 9.8 13.6 3.4 20.4 3.2S29.6 9.8 28.4 17.6C28 14 27 11.2 25.4 9.6 22.4 9.6 18.6 8.8 16.4 7.2 15.6 8.4 14.8 9.2 14.4 9.8 12.8 11.4 12.2 14.2 11.8 17.6Z',
      mechones: 'M16.8 5.2C15 6.2 13.6 8.2 12.8 11.4M21 4.4C24.2 5 26.8 7.4 27.6 11.6M8.6 19q-1.4 4-.4 7t-.2 8M31.4 19q1.4 4 .4 7t.2 8M10.8 23q-.8 3 .2 6t.2 5M29.2 23q.8 3-.2 6t-.2 5',
    },
  },
  // Guille Collado: la gorra negra, sin logo acá, y la barba tupida.
  'guille-collado': {
    fondo: '#F29BC4', piel: PIEL_MEDIA, iris: '#3A2A1E', barba: 'corta', gorra: '#17181C', ropa: { color: '#17181C', cuello: '#34363C' },
    pelo: { color: '#21170F', brillo: '#4C3A2C', frente: 'M12.4 15C12 13.8 12 12.8 12.2 12H27.8C28 12.8 28 13.8 27.6 15 27.2 13.8 26.6 13.2 25.8 12.8H14.2C13.4 13.2 12.8 13.8 12.4 15Z', mechones: '' },
  },
  // Marc Verdú: pelo oscuro corto con jopo, barba de pocos días, remera gris.
  'marc-verdu': {
    fondo: '#123E3A', piel: PIEL_MEDIA, iris: '#3F4A52', barba: 'dias', ropa: { color: '#7D8691', cuello: '#646C76' },
    pelo: {
      color: '#2B2018', brillo: '#5A4638',
      frente: 'M12.3 13.4C11.8 10.2 12.4 7.8 14.2 6.4 15.8 3.8 20 2.6 23.6 3.4 26.8 4 28.6 6.4 28.2 9 28.1 10.6 27.9 12 27.7 13.4 27.3 11.6 26.6 10.2 25.4 9.6 21.6 10.2 17.6 9.8 14.8 9.8 13.6 10.4 12.8 11.8 12.3 13.4Z',
      mechones: 'M15.2 8.6C16.4 6.4 19.4 4.8 23 4.8M18 9C19.2 7.2 21.6 6 25 6.2',
    },
  },
  // Ramiro Cubria: pelo muy oscuro peinado hacia atrás, barba prolija, camisa negra abierta.
  'ramiro-cubria': {
    fondo: '#8FB6C9', piel: PIEL_MEDIA, iris: '#2F2218', barba: 'corta', ropa: { color: '#121316', forma: 'camisa' },
    pelo: {
      color: '#18110D', brillo: '#463A32',
      frente: 'M12.2 13C11.4 8.4 13.6 3.8 19.6 3.2 25.6 2.8 28.6 7.4 27.8 13 27.4 11 26.6 9.6 25.4 9 21.6 7.6 17.4 7.8 14.6 9 13.4 9.8 12.6 11.2 12.2 13Z',
      mechones: 'M15 7.4C17 5.4 20.6 4.6 24 5.4M16.6 8C18.6 6.6 21.6 6 25.2 7M13.8 9q1.4-3 4-4.4',
    },
  },
  // Iman Gadzhi: pelo castaño con raya al costado, lentes redondos, barba de pocos días y saco gris sobre remera blanca.
  'iman-gadzhi': {
    fondo: '#20304A', piel: PIEL_CLARA, iris: '#4A3324', barba: 'dias', lentes: '#5B3D22', ropa: { color: '#8B8F96', forma: 'saco' },
    pelo: {
      color: '#4A3222', brillo: '#7E5E46',
      frente: 'M12.2 14C11.4 9.4 13 4.6 17.6 3.6 22 2.4 27 3.6 28 7.6 28.6 9.6 28.4 12 27.8 14 27.4 12 26.6 10.4 25.2 9.6 22 9.8 18.4 8.8 16.8 7.4 16 9.2 14.8 10 13.9 10.8 13 11.6 12.5 12.6 12.2 14Z',
      mechones: 'M17 7C19 5.4 22 4.6 25 5.2M19 8.2C21 6.8 23.6 6.4 26.4 7.2',
    },
  },
};

export function Retrato({ id, animo }: { id: IdAsesor; animo: Animo }) {
  if (id === 'hormozi') return <Hormozi animo={animo} />;
  if (id === 'juan-ads') return <JuanAds animo={animo} />;
  if (id === 'sofia-contreras') return <SofiaContreras animo={animo} />;
  if (id === 'marcos-razzetti') return <MarcosRazzetti animo={animo} />;
  if (id === 'victor-heras') return <VictorHeras animo={animo} />;
  if (id === 'julian-otalora') return <JulianOtalora animo={animo} />;
  const r = RASGOS[id];
  return r ? <Retratito r={r} animo={animo} /> : null;
}
