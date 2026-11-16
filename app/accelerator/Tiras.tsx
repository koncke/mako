// =============================================================================
// Las tiras de logos que se deslizan entre las secciones de /accelerator (16/11/2026)
// =============================================================================
// Martín, 16/11/2026: «tal vez faltan los carruseles de las cositas que tenemos en MaKo para separar las secciones. Sobre todo, la
// sección de donde se terminan los testimonios, que el último es de Social Media Lab, y luego la sección donde se terminan los
// entregables». Son las tiras de la portada de MaKo (app/vsl/_sitio/Portada.tsx), con su CSS (`CSS_REEMPLAZA`,
// app/vsl/_sitio/estilos.ts, que la landing suma a su hoja):
//   · después de los casos, «Funciona con las apps que ya usas»: `TiraSitio`, la de debajo del héroe de la portada, la MISMA;
//   · después de los entregables, «MaKo reemplaza las apps que ya estás pagando»: la de app/vsl/_sitio/LoQuePagas.tsx.
// ⚠️ LA SEGUNDA NO ES UN COMPONENTE ALLÁ: va adentro de `SeccionReemplaza`, junto al titular y la cuenta de lo que pagas, que acá no
//    van (serían un segundo precio, el de MaKo Pro, justo antes de «La inversión»). Mientras nadie la separe en LoQuePagas.tsx,
//    `TiraReemplaza` dibuja lo mismo con lo mismo (`appsDeLaTira`, su rótulo y sus clases), y tests/acelerador-landing.test.ts la
//    compara con la que dibuja `SeccionReemplaza`: si una cambia y la otra no, se pone rojo. El día que LoQuePagas.tsx exporte su
//    tira, `TiraReemplaza` se borra y va ésa.
// CADA UNA EN UNA CAJA `.s-sitio`, como el pie del sitio de esta página (`PieGlobal`): ahí valen las reglas del sitio (su letra, y los
// logos casi negros sobre su cuadro blanco, `LOGOS_SOBRE_BLANCO`). Lo que es de una página entera, el fondo azul noche y el alto de
// pantalla, se lo saca `CSS_TIRAS` (./estilo.ts): la tira va sobre el fondo de esta página, que es sólo oscura.
// Server component, sin JavaScript: se deslizan con CSS, y con prefers-reduced-motion se quedan quietas (`CSS_REEMPLAZA`).
// =============================================================================

import { TiraSitio } from '../vsl/_sitio/Portada';
import { appsDeLaTira } from '../vsl/_sitio/reemplaza';

/** El rótulo de la tira de las apps que MaKo reemplaza: el de `SeccionReemplaza` (el test los compara). */
export const ROTULO_REEMPLAZA = 'MaKo reemplaza las apps que ya estás pagando';

/** La tira de `SeccionReemplaza` (app/vsl/_sitio/LoQuePagas.tsx), sin el titular ni la cuenta: la lista va dos veces, sin corte. */
export function TiraReemplaza() {
  const apps = appsDeLaTira();
  if (!apps.length) return null;
  const lista = (oculta: boolean) => (
    <ul className="s-tira-l" aria-hidden={oculta || undefined}>
      {apps.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <li key={a.logo} className="s-tira-i s-tira-app"><img src={a.logo} alt="" width={30} height={30} />{a.nombre}</li>
      ))}
    </ul>
  );
  return (
    <section className="s-tira s-tira-reemplaza" aria-label="Apps que MaKo reemplaza">
      <p className="s-tira-r">{ROTULO_REEMPLAZA}</p>
      <div className="s-tira-v">
        <div className="s-tira-p">{lista(false)}{lista(true)}</div>
      </div>
    </section>
  );
}

/** Una tira entre dos secciones: `conecta`, la de las apps con las que se conecta; `reemplaza`, la de las que reemplaza. */
export function TiraEntreSecciones({ cual }: { cual: 'conecta' | 'reemplaza' }) {
  return <div className="s-sitio acl-tira">{cual === 'conecta' ? <TiraSitio /> : <TiraReemplaza />}</div>;
}
