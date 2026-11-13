'use client';

// =============================================================================
// Las plantillas de Web Generator en la portada, AL LADO de los outliers (11/11/2026)
// =============================================================================
// Martín, 11/11/2026 (por el Cerebro): «Además de los outliers, también deberían estar los templates». La regla ya existía (memoria
// «Create: orden y outliers»: «las plantillas con estructura se quedan al lado de los outliers»). Son los MISMOS diseños de la
// galería del Panel (`plantillasDe('landing')`, crear/tipo.ts), dibujados con la MISMA miniatura (`MiniaturaLanding`, el render
// público de su primera sección). Tocar uno abre el Panel con su pregunta del objetivo (`?vista=plantillas&diseno=<id>`, Inicio.tsx
// `disenoInicial`): el mismo paso que tocarlo en la galería, sin uno nuevo.
// Las muestras se arman después de montar, como en la galería: `contenido()` crea ids nuevos, y el HTML del server no coincidiría.
// =============================================================================

import { useEffect, useState } from 'react';
import Link from '@/app/_ui/Link';
import { tarjetasDe, type JsonNodo } from '@/lib/editor-landing/doc';
import { temaPorId } from '@/lib/editor-landing/temas';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { plantillasDe } from './crear/tipo';
import { CSS_GP, MiniaturaLanding } from './MiniaturaLanding';
import { RUTA_PLANTILLAS, rutaDiseno } from './portada-reglas';
import l from './outliers-landings.module.css';

const DISENOS = plantillasDe('landing');

export function PlantillasPortada() {
  const [muestras, setMuestras] = useState<Record<string, JsonNodo | null> | null>(null);
  useEffect(() => {
    setMuestras(Object.fromEntries(DISENOS.map((p) => {
      const pagina = p.contenido().paginas[0];
      return [p.id, pagina ? tarjetasDe(pagina)[0] ?? null : null];
    })));
  }, []);
  return (
    <section className={l.plantillas} aria-labelledby="wg-plantillas">
      <style dangerouslySetInnerHTML={{ __html: CSS_GP }} />
      {/* La hoja del contenido, recién cuando hay miniaturas (después de montar): así no viaja en el HTML ni en los datos de cada
          visita, sino una vez en el código, que el navegador guarda (13/11/2026). La misma `href` que el editor: React la pone una vez. */}
      {muestras ? <style href="gm-contenido" precedence="medium">{CSS_CONTENIDO}</style> : null}
      <div className={l.plantillasCabeza}>
        <h2 id="wg-plantillas">Plantillas</h2>
        <Link href={RUTA_PLANTILLAS} className={l.verTodas}>Ver todas</Link>
      </div>
      <ul className={l.fila}>
        {DISENOS.map((p) => (
          <li key={p.id}>
            <Link href={rutaDiseno(p.id)} className={l.plantilla} title={p.descripcion}>
              <span className={`gp ${l.plantillaMini}`}>
                {muestras ? <MiniaturaLanding tarjeta={muestras[p.id] ?? null} tema={temaPorId(p.tema)} /> : <span className={l.brillo} />}
              </span>
              <span className={l.plantillaNombre}>{p.nombre}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
