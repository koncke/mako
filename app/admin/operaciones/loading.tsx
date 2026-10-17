import './centro.css';
import { Pagina } from '@/app/_ui';

// =============================================================================
// /admin/operaciones mientras carga: la MISMA forma de la pantalla, vacía
// =============================================================================
// Martín (15/10/2026) se quejó de una pantalla que «tarda mucho en aparecer». La lectura que más pesaba (Vercel)
// ya no se espera (page.tsx), y lo que queda —la cola, los carteros y las bitácoras— se muestra con esta forma
// mientras llega: la barra con sus filas y la caja de escribir en su lugar, para que nada salte al aparecer.
//
// ⚠️ Un loading.tsx ES un Suspense: sólo en segmentos privados, y en la lista de tests/layout-sin-suspense.test.ts.
// /admin es privado entero (el proxy lo corta sin sesión).

const FILAS = [62, 48, 70, 55, 40, 66, 52, 44];

export default function Cargando() {
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="co" aria-busy="true" aria-label="Cargando Ops Center">
        <aside className="co-barra">
          <div className="co-barra__arriba">
            <div className="co-buscar"><span className="co-esq" style={{ width: 90, height: 10 }} /></div>
            <div className="co-acceso"><span className="co-esq" style={{ width: 70, height: 10 }} /></div>
            <div className="co-acceso"><span className="co-esq" style={{ width: 60, height: 10 }} /></div>
          </div>
          <div className="co-lista">
            {FILAS.map((w, i) => (
              <div key={i} className="co-fila" style={{ cursor: 'default' }}>
                <span className="co-punto co-punto--viejo" />
                <span className="co-fila__cuerpo">
                  <span className="co-esq" style={{ width: `${w}%`, height: 10, marginTop: 3 }} />
                  <span className="co-esq" style={{ width: `${w + 18}%`, height: 8, marginTop: 6 }} />
                </span>
              </div>
            ))}
          </div>
        </aside>
        <section className="co-panel">
          <div className="co-cab"><span className="co-esq" style={{ width: 180, height: 12 }} /></div>
          <div className="co-hilo" />
          <div className="co-caja-wrap"><div className="co-caja" style={{ height: 88 }} /></div>
        </section>
      </div>
    </Pagina>
  );
}
