// =============================================================================
// VitrinaPlanes — lo que DIBUJA /planes: los tres bloques, la comparación y el link a MaKo Partners (24/10/2026)
// =============================================================================
// Sin datos ni red: la página (./page.tsx) lee las ofertas y el origen de la URL y se los pasa. Aparte para que la vitrina
// se pueda mirar sin levantar la app (que en local escribe en la base de producción): un render estático con los planes
// de hoy (lib/planes-mako.ts) es la MISMA pantalla.
// =============================================================================

import Link from 'next/link';
import { bajadaDePlanes, botonDelPlan } from '@/lib/compra-plan-reglas';
import { PROGRAMA_ACELERADOR, type PlanMako } from '@/lib/planes-mako';
import { filasDeComparacion, type Celda, type FilaComparacion } from '@/lib/planes-comparacion';
import { CSS_PLANES } from './estilo';

export function VitrinaPlanes({ ofertas, sufijo }: {
  ofertas: ReadonlyArray<{ plan: PlanMako; cobrable: boolean }>;
  /** Lo que la URL trae y pasa tal cual al plan elegido (el origen y el código de partner). */
  sufijo: string;
}) {
  // LOS TRES BLOQUES (24/10/2026, Martín: «quiero ver los 3 bloques de pricing típicos que tiene toda app»): los dos planes
  // de software y, a la derecha, el programa con Martín, que nunca pasa por la pasarela: se pide, como el «hablar con
  // ventas» de cualquier SaaS (lib/planes-mako.ts, `PROGRAMA_ACELERADOR`). El ANUAL no se muestra: el checkout cobra por mes, y la vitrina no
  // dice un precio que no se puede comprar (lo que se ve, se compra así).
  const programa = PROGRAMA_ACELERADOR;
  const cuota = Math.round(programa.precioUsd / programa.cuotas);
  const filas = filasDeComparacion();
  const precio = (n: number) => n.toLocaleString('es-AR');
  return (
    <main className="planes-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES }} />
      <div className="planes-wrap planes-ancho">
        <div className="planes-marca">MaKo</div>
        <h1>Elige tu plan</h1>
        <p className="planes-sub">{bajadaDePlanes(ofertas.some((o) => o.cobrable))}</p>
        <div className="planes-grilla planes-tres">
          {ofertas.map(({ plan: p, cobrable }) => {
            const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable, sufijo });
            return (
              <section key={p.id} className={`planes-card${p.destacado ? ' destacado' : ''}`}>
                {p.destacado && <span className="planes-insignia">Recomendado</span>}
                <h2>{p.nombre}</h2>
                <div className="planes-precio">US$ {precio(p.precioUsd)} <small>/ mes</small></div>
                {p.resumen && <p>{p.resumen}</p>}
                {p.incluye.length > 0 && <ul>{p.incluye.map((x) => <li key={x}>{x}</li>)}</ul>}
                <Link className="planes-btn" href={boton.href}>{boton.texto}</Link>
              </section>
            );
          })}
          <section className="planes-card planes-programa">
            <h2>{programa.nombre}</h2>
            <div className="planes-precio">US$ {precio(programa.precioUsd)}</div>
            <div className="planes-cuotas">en {programa.cuotas} cuotas de US$ {precio(cuota)}</div>
            <p>{programa.resumen}</p>
            <ul>{programa.incluye.map((x) => <li key={x}>{x}</li>)}</ul>
            <p className="planes-despues">Después, si quieres seguir: {programa.despues.nombre}, US$ {precio(programa.despues.precioUsd)} por mes.</p>
            <Link className="planes-btn planes-btn-borde" href={`/planes/${programa.id}${sufijo}`}>Quiero el Acelerador</Link>
          </section>
        </div>

        <section className="planes-compara" aria-labelledby="planes-compara-titulo">
          <h2 id="planes-compara-titulo">Compara los planes</h2>
          <div className="planes-tabla-wrap">
            <table className="planes-tabla">
              <thead>
                <tr>
                  <th scope="col"><span className="planes-oculto">Qué incluye</span></th>
                  {ofertas.map(({ plan: p }) => <th key={p.id} scope="col" className={p.destacado ? 'destacado' : undefined}><NombreColumna nombre={p.nombre} /></th>)}
                  <th scope="col"><NombreColumna nombre={programa.nombre} /></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.que}>
                    <th scope="row">{f.que}</th>
                    {ofertas.map(({ plan: p }) => <td key={p.id}><CeldaPlan v={celdaDe(f, p.capa)} /></td>)}
                    <td><CeldaPlan v={f.acelerador} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="planes-pie">¿Ya tienes MaKo? Recomiéndalo y gana meses gratis: <Link href="/mako-partners">MaKo Partners</Link></p>
      </div>
    </main>
  );
}

/**
 * La columna de un plan en la tabla, por su CAPA y no por su id: los números salen de los topes de la capa
 * (lib/planes-comparacion.ts), así que un plan del setting `planes.mako` con otro id dice lo que su capa le da. Una capa
 * sin columna (pm), vacía: no se inventa.
 */
function celdaDe(f: FilaComparacion, capa: string): Celda | null {
  return capa === 'completo' ? f.esencial : capa === 'agencia' ? f.pro : null;
}

/**
 * El encabezado de una columna. En el teléfono va sin «MaKo» delante: con el nombre entero la tabla no entraba y sólo se
 * veía la columna de Esencial (había que deslizar, sin saberlo, para descubrir Pro y el Acelerador).
 */
function NombreColumna({ nombre }: { nombre: string }) {
  const corto = nombre.replace(/^MaKo\s+/, '');
  return corto === nombre ? <>{nombre}</> : <><span className="planes-largo">{nombre}</span><span className="planes-corto">{corto}</span></>;
}

function CeldaPlan({ v }: { v: Celda | null }) {
  if (v === true) return <span className="planes-si" aria-label="Incluido">✓</span>;
  if (v === false) return <span className="planes-no" aria-label="No incluido">—</span>;
  return <>{v ?? ''}</>;
}
