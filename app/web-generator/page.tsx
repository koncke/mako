// =============================================================================
// /web-generator — el Panel del editor de landings copiado de Gamma
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
// con un tema `ws:<id>` y la galería) y las bases de las landings publicadas («Copiar enlace
// público» y el cruce de las analizadas que son nuestras, panel-reglas.ts; `basesLandings`,
// lib/app-url.ts: hola-mako.site desde la tanda 4).
//
// La derecha que pide la URL (`?diagnostico=<id>`, `?analizar=<url>`, `?vista=plantillas|temas|
// papelera|replicar`, `?paso=generar|pegar|importar`) se resuelve acá con `derechaDeQuery`
// (panel-reglas.ts, puro: un server component no puede importar un VALOR de un 'use client') y
// baja por props. /web-generator/analizar redirige acá con el Diagnóstico abierto.
//
// TANDA 6 (14/10/2026). Martín: «La sección de "Importar con IA" no debería ser otra ruta, todo
// siempre en la misma ruta». «Crear con IA» se abre A LA DERECHA (crear/CrearConIA.tsx, montado por
// Inicio.tsx) y /web-generator/crear redirige acá con su query (`destinoCrear`). El deep link
// del Landing Analyst (`?url=<landing analizada>`, también el que reenvía /landing-writer) ya no
// salta a otra ruta: abre «Generar» con esa landing de base, y la validación de que la URL sea
// una analizada del negocio la hace Crear contra su lista (`baseDelDeepLink`).
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
import { Pagina } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { basesLandings } from '@/lib/app-url';
import { listar, temas as leerTemasPropios } from '@/lib/editor-landing/server';
import { listarAnalizadas } from '@/lib/landing-analyst';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { TEMAS, temaPorId, urlFuentes } from '@/lib/editor-landing/temas';
import type { LandingResumen, TemaPropio } from '@/lib/editor-landing/api-tipos';
import { consultaDerecha, derechaDeQuery, esPanelPelado, type Analizada } from './panel-reglas';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { leerOutliersLandings } from '@/lib/landing-outliers-servidor';
import { OutliersLandings } from './OutliersLandings';
import { Inicio } from './Inicio';
import { FranjaPrueba } from '@/app/_ui/FranjaPrueba';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Query = Record<string, string | string[] | undefined>;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default async function LandingGeneratorPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireRolWs([], { nav: 'landing-writer' });
  const sp = await searchParams;

  // LA ENTRADA ES LA PORTADA DE OUTLIERS (11/11/2026, Martín: «lo mismo que venimos haciendo con el resto de tabs, de outliers»):
  // sin nada en la URL (o sólo el ?ws= de la pestaña), «Encuentra tu siguiente OUTLIER», como Video e Image; «Crear desde cero»
  // lleva al Panel (`?panel=1`) y «Replicar» a Replicar con esa página (`?replicar=`). Del 24/10 al 11/11 la pelada saltaba a la
  // última landing tocada; las tuyas siguen a un clic, en el Panel y en la lista del editor.
  if (esPanelPelado(sp)) {
    return (
      <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
        <OutliersLandings portada={await leerOutliersLandings()} />
      </Pagina>
    );
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
  else { errorLista = rLista.error; console.error('[web-generator] listar:', rLista.error); }

  // Igual con las analizadas: «no pude leerlas» no es «no analizaste ninguna».
  let analizadas: Analizada[] = [];
  let errorAnalizadas: string | null = null;
  if (rAnalizadas.ok) analizadas = rAnalizadas.analizadas;
  else { errorAnalizadas = rAnalizadas.error; console.error('[web-generator] analizadas:', rAnalizadas.error); }

  // El Panel sale con `?panel=1` («Crear desde cero», «Nueva landing», «Ver todo en el Panel») o con un pedido en la URL
  // (crear, analizar, diagnóstico, replicar).

  let propios: TemaPropio[] = [];
  let errorTemas: string | null = null;
  if (rTemas.ok) propios = rTemas.temas;
  else { errorTemas = rTemas.error; console.error('[web-generator] temas propios:', rTemas.error); }

  const fuentes = urlFuentes([...TEMAS, ...propios.map((p) => temaPorId('ws:' + p.id, propios))]);
  // Las bases de las landings las decide el SERVER (el navegador no sabe el entorno): la vigente
  // primero (hola-mako.site en producción, tanda 4) y la de antes (hola-mako.com/l).
  const bases = basesLandings();
  const derechaInicial = derechaDeQuery(consultaDerecha(sp), docs, bases);

  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENIDO }} />
      {fuentes && <link rel="stylesheet" href={fuentes} />}
      <FranjaPrueba cosas={['web.landings_publicadas']} style={{ margin: '12px 16px 0' }} />
      <Inicio
        docs={docs}
        errorLista={errorLista}
        analizadas={analizadas}
        errorAnalizadas={errorAnalizadas}
        propios={propios}
        errorTemas={errorTemas}
        bases={bases}
        ahora={Date.now()}
        derechaInicial={derechaInicial}
      />
    </Pagina>
  );
}
