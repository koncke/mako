// =============================================================================
// /landing-generator — el Panel del editor de landings copiado de Gamma
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D9).
//
// El server trae lo que la pantalla (Inicio.tsx) no puede pedir sola en el primer
// pintado: las landings del negocio (`listar`, lib/editor-landing/server.ts, paginado),
// sus temas propios (para las miniaturas con un tema `ws:<id>` y la galería), el nombre
// con el que el server firma lo que crea esta persona («Creadas por mí») y la URL base
// del sitio público («Copiar enlace público»).
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
import { getUsuarioActual } from '@/lib/auth';
import { APP_BASE_URL } from '@/lib/app-url';
import { listar, temas as leerTemasPropios } from '@/lib/editor-landing/server';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { TEMAS, temaPorId, urlFuentes } from '@/lib/editor-landing/temas';
import type { LandingResumen, TemaPropio } from '@/lib/editor-landing/api-tipos';
import { Inicio } from './Inicio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Query = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined): string | null => (typeof v === 'string' ? v : Array.isArray(v) ? v[0] ?? null : null);

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

  const [rLista, rTemas, sesion] = await Promise.all([
    listar().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) })),
    leerTemasPropios().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) })),
    getUsuarioActual().catch(() => null),
  ]);

  // Una lista que no se pudo leer NO es «no tienes landings»: la pantalla lo dice y reintenta.
  let docs: LandingResumen[] = [];
  let errorLista: string | null = null;
  if (rLista.ok) docs = rLista.docs;
  else { errorLista = rLista.error; console.error('[landing-generator] listar:', rLista.error); }

  let propios: TemaPropio[] = [];
  let errorTemas: string | null = null;
  if (rTemas.ok) propios = rTemas.temas;
  else { errorTemas = rTemas.error; console.error('[landing-generator] temas propios:', rTemas.error); }

  // El mismo nombre con el que server.ts firma `creado_por_nombre` (quienSoy: nombre || email).
  const yo = (sesion?.nombre || sesion?.email || '').trim();
  const fuentes = urlFuentes([...TEMAS, ...propios.map((p) => temaPorId('ws:' + p.id, propios))]);

  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENIDO }} />
      {fuentes && <link rel="stylesheet" href={fuentes} />}
      <Inicio
        docs={docs}
        errorLista={errorLista}
        propios={propios}
        errorTemas={errorTemas}
        yo={yo}
        base={APP_BASE_URL}
        ahora={Date.now()}
        vistaInicial={uno(sp.vista)}
      />
    </Pagina>
  );
}
