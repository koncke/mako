// =============================================================================
// copywriter/referencias — lo que se citó con «@», leído en el server (server-only)
// =============================================================================
// Lo que manda el navegador es un id: lo de verdad se lee ACÁ, del negocio de la pestaña (un id de otro negocio no
// existe y se dice). Lo leído va a la IA como DATOS, recortado:
//   · un guion → su texto con las etiquetas (lib/copywriter/doc.ts, `textoDelDoc`);
//   · «La oferta» → lo que el Second Brain sabe de lo que vende el negocio (./contexto.ts, sólo esos nodos);
//   · un archivo de El Archivero → lo que El Archivero ya sacó de él (su resumen y sus campos). Sin leer el archivo de
//     nuevo: eso costaría IA del negocio en cada mensaje.
// Nunca tira: lo que no se pudo leer vuelve en `noLeidas` y la respuesta lo dice.
// =============================================================================

import 'server-only';
import { abrir } from './server';
import { textoDelDoc } from './doc';
import { contextoDelNegocio } from './contexto';
import { getFile } from '../archivero';
import type { Referencia } from './referencias-reglas';
import { originalParaMaKo } from './outliers-servidor';
import { NOMBRE_DEL_ORIGINAL } from './outliers';

const TOPE_POR_REFERENCIA = 6_000;

export async function leerReferencias(refs: readonly Referencia[]): Promise<{ textos: Array<{ nombre: string; texto: string }>; noLeidas: string[] }> {
  const textos: Array<{ nombre: string; texto: string }> = [];
  const noLeidas: string[] = [];
  await Promise.all(refs.map(async (r) => {
    try {
      if (r.tipo === 'guion') {
        const a = await abrir(r.id);
        if (!a.ok) { noLeidas.push(r.nombre || 'un guion'); return; }
        textos.push({ nombre: `Guion «${a.pagina.titulo}»`, texto: textoDelDoc(a.doc.contenido).slice(0, TOPE_POR_REFERENCIA) || '(vacío)' });
        return;
      }
      if (r.tipo === 'outlier') {
        // El original que replica la página (D18): lo que se sabe de él y su texto, con la regla de copiar sólo la estructura.
        const t = await originalParaMaKo(r.id);
        if (!t) { noLeidas.push('el original que replicas'); return; }
        textos.push({ nombre: NOMBRE_DEL_ORIGINAL, texto: t.slice(0, TOPE_POR_REFERENCIA + 600) });
        return;
      }
      if (r.tipo === 'oferta') {
        const t = await contextoDelNegocio('oferta producto precio promesa garantía bonos lo que vende');
        if (!t) { noLeidas.push('La oferta'); return; }
        textos.push({ nombre: 'La oferta', texto: t.slice(0, TOPE_POR_REFERENCIA) });
        return;
      }
      const f = await getFile(r.id);
      if (!f) { noLeidas.push(r.nombre || 'un archivo'); return; }
      const campos = Object.entries(f.campos ?? {}).filter(([, v]) => String(v ?? '').trim()).map(([k, v]) => `${k}: ${v}`).join('\n');
      textos.push({ nombre: `Archivo «${f.nombre}»`, texto: [f.razonamiento ?? '', campos].filter(Boolean).join('\n').slice(0, TOPE_POR_REFERENCIA) || '(El Archivero no sacó nada de este archivo)' });
    } catch {
      noLeidas.push(r.nombre || r.tipo);
    }
  }));
  return { textos, noLeidas };
}
