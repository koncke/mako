// =============================================================================
// /landing-generator/crear — «Crear con IA» (el generador de Gamma)
// =============================================================================
// La pantalla (crear/CrearConIA.tsx) recibe del server lo que no puede pedir sola: las
// landings que ya pasaron por el Diagnóstico (/landing-generator/analizar) (para «Sobre cuál» y para validar el
// deep link `?url=`), los temas propios del negocio y la query cruda. Diseño:
// docs/diseno-editor-landing.md (D5, D9).
//
// La puerta es la misma de la tab: `requireRolWs([], { nav: 'landing-writer' })` (la key
// del nav no cambió con el editor nuevo: contrato en la base). Página privada: no lleva
// Suspense, porque la query se lee acá (searchParams del server) y baja por props.
//
// La hoja del CONTENIDO (`CSS_CONTENIDO`) y las fuentes de los temas van una sola vez en
// la página: las secciones que aparecen en vivo son el render público (`htmlDeTarjeta`) y
// sin la hoja se verían como HTML crudo. Va como string en un <style> del server para no
// meter los ~94 KB en el bundle del navegador.
// =============================================================================

import '../gamma.css';
import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { listarAnalizadas } from '@/lib/landing-analyst';
import { temas as leerTemasPropios } from '@/lib/editor-landing/server';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { TEMAS, temaPorId, urlFuentes } from '@/lib/editor-landing/temas';
import type { TemaPropio } from '@/lib/editor-landing/api-tipos';
import { CrearConIA, type LandingAnalizada } from './CrearConIA';

export const dynamic = 'force-dynamic';

type Query = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined): string | null => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] ?? null : null);

export default async function CrearLandingPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireRolWs([], { nav: 'landing-writer' });
  const sp = await searchParams;

  const [rAnalizadas, rTemas] = await Promise.allSettled([listarAnalizadas(), leerTemasPropios()]);

  // Una lectura que falla no es «no hay»: la pantalla dice que no pudo leerlas.
  let analizadas: LandingAnalizada[] = [];
  let errorAnalizadas: string | null = null;
  if (rAnalizadas.status === 'fulfilled') analizadas = rAnalizadas.value;
  else {
    errorAnalizadas = rAnalizadas.reason instanceof Error ? rAnalizadas.reason.message : String(rAnalizadas.reason);
    console.error('[landing-generator/crear] analizadas:', errorAnalizadas);
  }

  // Los temas propios sólo suman opciones: si no se leen, el selector ofrece el catálogo
  // (queda en el log; la galería del Panel es la que lo dice en pantalla).
  let propios: TemaPropio[] = [];
  if (rTemas.status === 'fulfilled' && rTemas.value.ok) propios = rTemas.value.temas;
  else console.error('[landing-generator/crear] temas propios:', rTemas.status === 'fulfilled' ? (rTemas.value.ok ? '' : rTemas.value.error) : rTemas.reason);

  const fuentes = urlFuentes([...TEMAS, ...propios.map((p) => temaPorId('ws:' + p.id, propios))]);
  const modo = uno(sp.modo);

  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENIDO }} />
      {fuentes && <link rel="stylesheet" href={fuentes} />}
      <CrearConIA
        analizadas={analizadas}
        errorAnalizadas={errorAnalizadas}
        propios={propios}
        url={uno(sp.url)}
        objetivo={uno(sp.objetivo)}
        paso={uno(sp.paso)}
        desdeCaja={uno(sp.desde) === 'caja'}
        modoCaja={modo === 'express' ? 'express' : 'plan'}
        promptUrl={uno(sp.prompt)}
      />
    </Pagina>
  );
}
