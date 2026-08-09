// =============================================================================
// Pricing — registro de construcción
// =============================================================================
// Qué va acá y qué no es lo mismo que en el resto: el motivo y la trampa, no el
// changelog. Los tipos están en ../_registro/tipos.ts.
//
// Este registro nace con el análisis ya hecho, así que la primera entrada NO es
// «se creó la tab» sino lo que el análisis encontró y que no se deduce del
// código: que el plan que pierde plata es el Pro, no el Free.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Cobros y planes · análisis de costos';

export const BITACORA: Hito[] = [
  {
    fecha: '8 ago', hora: '18:41', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '«Comienza con el análisis de costos de todo»',
    pedido: 'Quiero desarrollar toda la feature de "Cobros y planes" del plan. […] Quisiera ver la sección de "Pricing" con lo típico de cualquier SaaS, las 3 columnas de "Free" - "Pro" - "Growth". Pro a $47usd y Growth a $97 usd… Y claro, para ello, como es una app de IA, que mi idea es poner el modelo de "MaKo Tokens", tengo que limitar el uso, sobre todo del plan FREE, que me puede traer problemas de costos y no lo limito bien… pero para ello lo primero es hacer un ANÁLISIS Y PROYECCIÓN DE COSTOS tal como dice el plan.',
    puntos: [
      'El pedido ya estaba escrito en el plan como la tarea **#338** («Calcular el costo de tokens e infraestructura por usuario Free»), con checklist. Y a su alrededor **#313** (límites y recarga), **#391** (freemium) y **#312** (BYOK como beneficio del plan anual).',
      '**#312 resuelve una tensión que parecía de fondo:** BYOK («cada cliente trae su Gemini», decidido en julio) y MaKo Tokens (MaKo pone la IA y la mide) parecían modelos incompatibles. No lo son si BYOK es el *perk* del plan anual en vez del default.',
    ],
  },
  {
    fecha: '8 ago', hora: '19:05', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'investigacion',
    titulo: 'El plan que pierde plata es el Pro, no el Free',
    puntos: [
      '**El análisis se hizo contra producción, no estimando.** `anthropic_usage` guarda una fila por llamada con tokens y costo: 2.249 llamadas, 23,4M tokens, US$93,50, del 29/06 al 08/08. Un workspace intensivo = **~US$68/mes de IA** → margen **−45%** a US$47. El Growth a US$97 da 30%. Los dos insuficientes.',
      '**La mitad del costo está tapada por free tiers que no escalan.** Son límites por key y por día (Gemini: 250 pedidos/día). El mismo consumo pasa de US$67 a US$99/mes cuando se agotan, y baja a US$12 con disciplina de ruteo: **el ruteo vale 8×**, más que cualquier límite.',
      '⚠️ **El 99,9% del costo «en ws1» NO es una medición.** `lib/anthropic-usage.ts:22-25` escribe TODA fila de Anthropic con `workspace_id = 1`, a propósito (mundo pre-BYOK, key única de agencia). Para las filas de Claude el workspace es una CONSTANTE. El agregado es sólido; el reparto por cliente, no. Es el bloqueante #1 del medidor.',
      '**Lo que hoy contiene el gasto es un accidente, no un techo.** `credWs` solo cae al env si el workspace es el 1 → un cliente sin key propia no gasta, la llamada EXPLOTA. MaKo Tokens implica servirle la key de la plataforma a todos, y ahí seis caminos automáticos (crons + webhooks de Fathom/Evolution) empiezan a facturar de golpe. El webhook de Fathom solo proyecta US$52/mes contra un plan de US$47.',
      '**Tres módulos gastan sin registrar y siempre contra la key de la agencia** (`embeddings`, `transcribe`, `analyze-creatives`): 0 llamadas a `recordUsage` y resuelven la key con `envCred` en vez de `credWs`. Uno corre en CADA búsqueda del RAG. Los US$93,50 son un **piso**, no un total.',
    ],
    archivos: [
      'docs/costos-ia-y-planes.md — el análisis completo, con el orden de trabajo de 8 pasos',
      'docs/hallazgos-ia.md — los 4 gotchas de código, con su `Vive en:`',
    ],
  },
  {
    fecha: '8 ago', hora: '20:12', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '«El análisis de costos que hiciste es MUY pobre»',
    pedido: 'No entiendo de donde sacas el monto de US$93,50 cuando en el panel de Mauricio me dice "este mes $56.33" […] Sería bueno que incluyas un filtro de fecha y poder ver el gasto de otros meses también, en integracions.\nEl análisis de costos que hiciste es MUY pobre... Solo te basaste en los gastos actuales, no te basaste en todas las implementaciones que queremos traer, como la generación de vídeo o imagen... Tampoco incluiste la proyección de CAC... Tienes que hacerlo mucho mucho mejor esto, por favor profundiza.\nDejame todo el análisis en una tab de superadmin. Dentro de "dev" en una tab que se llame "pricing".',
    puntos: [
      '**Los dos números eran el mismo, en ventanas distintas.** Los US$93,50 son los 41 días medidos, que cruzan TRES meses (jun US$2,00 + jul US$35,13 + ago US$56,37). El panel dice «este mes» y muestra agosto solo. No había contradicción — había una ventana sin declarar de mi lado.',
      '**Pero el reparo de fondo era correcto:** ese gasto NO es de Mauricio. Es todo el Claude de todos los workspaces, forzado a ws1 por el bloqueante #1. Y lo generaron procesos automáticos, no clics: `plan-fathom` US$33,08 en 6 días (148 llamadas, el cron de reuniones), `mako-guardian` US$10,81 (la re-priorización manda las **438 tareas abiertas** del board en UN prompt, ~US$0,32 por corrida) y `closing` US$9,59. Dos días —5 y 6 de agosto— son el 61% del mes.',
      '**El filtro de fecha necesitaba módulo nuevo, no un parámetro.** `getUsageSummary` lee con `.limit(20000)`, que **no sube el techo de 1000 filas de PostgREST**: agosto ya tenía 997 filas no-Anthropic contra ese techo. Por eso `lib/costos-ia.ts` lee paginado con `leerTodo`, y expone `filas` para que el truncado se vea en pantalla en vez de esconderse.',
    ],
    archivos: [
      'lib/costos-ia.ts — gasto por período, paginado; marca `atribuible:false` cuando hay filas de Anthropic',
      'app/api/costos-ia/route.ts — GET ?periodo=YYYY-MM, gateado a super-admin',
      'app/admin/dev/pricing/modelo.ts — los números de la proyección, cada uno con su origen (medido/publicado/supuesto)',
    ],
  },
];

export const PARTES: Parte[] = [
  { titulo: 'El costo real, medido', detalle: 'Costo por acción, por proveedor y por día, leído en vivo de `anthropic_usage` con filtro de mes y sin el truncado de 1000 filas', estado: 'hecha' },
  { titulo: 'Los 5 bloqueantes del medidor', detalle: 'Atribución de Claude por workspace, los 3 puntos ciegos, el registro fire-and-forget, la falta de primitiva de denegación y el modelo por plan', estado: 'hecha' },
  { titulo: 'Costo de las features que NO existen todavía', detalle: 'Generación de video e imagen, voz y agentes autónomos: precios publicados por proveedor y qué le suman al cupo de cada plan', estado: 'sigue' },
  { titulo: 'Unit economics: CAC, churn y payback', detalle: 'Hoy la venta es con llamada, que encarece el CAC muchísimo vs self-serve. Sin eso, el margen bruto solo no dice si el negocio cierra', estado: 'sigue' },
  { titulo: 'El filtro de fecha en /integraciones', detalle: 'El endpoint ya está (`/api/costos-ia`); falta cablearlo en la card «Costo de MaKo» del board', estado: 'cola' },
  { titulo: 'La pantalla de Pricing del producto', detalle: 'Las 3 columnas con el desglose de qué incluye y qué no. Va DESPUÉS de los bloqueantes: prometer un cupo que no se puede medir es peor que no tener planes', estado: 'cola' },
];
