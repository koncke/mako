// =============================================================================
// /landing-generator — el Panel del editor de landings copiado de Gamma
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D9, y
// T1-T2 de la tanda 2: la barra lateral de DOCUMENTOS y el Diagnóstico a la derecha).
//
// El server trae lo que la pantalla (Inicio.tsx) no puede pedir sola en el primer
// pintado: las landings y presentaciones del negocio (`listar`, lib/editor-landing/server.ts,
// paginado), las landings de afuera ya analizadas (`listarAnalizadas`, lib/landing-analyst.ts:
// la barra lateral las lista con su host como nombre), sus temas propios (para las miniaturas
// con un tema `ws:<id>` y la galería) y la URL base del sitio público («Copiar enlace público»
// y el cruce de las analizadas que son nuestras, panel-reglas.ts).
//
// La derecha que pide la URL (`?diagnostico=<id>`, `?analizar=<url>`, `?vista=plantillas|temas|
// papelera`) se resuelve acá con `derechaDeQuery` (panel-reglas.ts, puro: un server component no
// puede importar un VALOR de un 'use client') y baja por props. /landing-generator/analizar
// redirige acá con el Diagnóstico abierto.
//
// El deep link del Landing Analyst (`?url=<landing analizada>`, también el que reenvía
// /landing-writer) abre «Crear» con esa landing de base: se redirige con `rutaConWs`
// (la tercera forma de navegar: sin el `?ws=`, el super admin que mira a un cliente
// terminaría en su propia cuenta). La validación de que la URL sea una analizada del
// negocio la hace Crear contra su lista.
//
// La puerta es la de la tab: admin del workspace + `landing-writer` en su capa (la key
// del nav no cambió con el editor: contrato en la base). Página privada y sin Suspense:
// la query se lee acá y baja por props.
//
// La hoja del contenido (`CSS_CONTENIDO`) y las fuentes de los temas van una sola vez en
// la página: las miniaturas son el render público (`htmlDeTarjeta`), y como string del
// server no suman ~94 KB al bundle del navegador.
// =============================================================================

import './gamma.css';
import { redirect } from 'next/navigation';
import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';
import { APP_BASE_URL } from '@/lib/app-url';
import { listar, temas as leerTemasPropios } from '@/lib/editor-landing/server';
import { listarAnalizadas } from '@/lib/landing-analyst';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { TEMAS, temaPorId, urlFuentes } from '@/lib/editor-landing/temas';
import type { LandingResumen, TemaPropio } from '@/lib/editor-landing/api-tipos';
import { derechaDeQuery, type Analizada } from './panel-reglas';
import { Inicio } from './Inicio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Query = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined): string | null => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] ?? null : null);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default async function LandingGeneratorPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireRolWs([], { nav: 'landing-writer' });
  const sp = await searchParams;

  const url = uno(sp.url);
  if (url) {
    const q = new URLSearchParams({ url });
    const objetivo = uno(sp.objetivo);
    if (objetivo) q.set('objetivo', objetivo);
    redirect(await rutaConWs(`/landing-generator/crear?${q.toString()}`));
  }

  const [rLista, rTemas, rAnalizadas] = await Promise.all([
    listar().catch((e: unknown) => ({ ok: false as const, error: msg(e) })),
    leerTemasPropios().catch((e: unknown) => ({ ok: false as const, error: msg(e) })),
    listarAnalizadas().then((a) => ({ ok: true as const, analizadas: a }), (e: unknown) => ({ ok: false as const, error: msg(e) })),
  ]);

  // Una lista que no se pudo leer NO es «no tienes landings»: la pantalla lo dice y reintenta.
  let docs: LandingResumen[] = [];
  let errorLista: string | null = null;
  if (rLista.ok) docs = rLista.docs;
  else { errorLista = rLista.error; console.error('[landing-generator] listar:', rLista.error); }

  // Igual con las analizadas: «no pude leerlas» no es «no analizaste ninguna».
  let analizadas: Analizada[] = [];
  let errorAnalizadas: string | null = null;
  if (rAnalizadas.ok) analizadas = rAnalizadas.analizadas;
  else { errorAnalizadas = rAnalizadas.error; console.error('[landing-generator] analizadas:', rAnalizadas.error); }

  let propios: TemaPropio[] = [];
  let errorTemas: string | null = null;
  if (rTemas.ok) propios = rTemas.temas;
  else { errorTemas = rTemas.error; console.error('[landing-generator] temas propios:', rTemas.error); }

  const fuentes = urlFuentes([...TEMAS, ...propios.map((p) => temaPorId('ws:' + p.id, propios))]);
  const derechaInicial = derechaDeQuery({ vista: uno(sp.vista), diagnostico: uno(sp.diagnostico), analizar: uno(sp.analizar) }, docs, APP_BASE_URL);

  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENIDO }} />
      {fuentes && <link rel="stylesheet" href={fuentes} />}
      <Inicio
        docs={docs}
        errorLista={errorLista}
        analizadas={analizadas}
        errorAnalizadas={errorAnalizadas}
        propios={propios}
        errorTemas={errorTemas}
        base={APP_BASE_URL}
        ahora={Date.now()}
        derechaInicial={derechaInicial}
      />
    </Pagina>
  );
}
