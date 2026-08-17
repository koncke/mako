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
  {
    fecha: '9 ago', hora: '01:30', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '«De dónde sacaste que mi CAC será de 666? eso NO tiene sentido»',
    pedido: 'Mi CAC será muchísimo menor, yo NO vendo por llamadas de ventas. […] No me interesa tanto lo que se haya gastado HOY en MaKo, esa no es un punto de referencia fuerte. Me interesa lo que se va a gastar cuando esté todo implementado. […] Debería dividir el análisis entre el sistema BYOK que no consume tokens de MaKo y el sistema de Tokens de MaKo. […] Hiciste toooda la proyección basándote en las IA de hoy en día cuando podríamos investigar otras alternativas ultra baratas. […] Tampoco está bien definido que SI y que NO en cada plan. […] Tampoco tuviste en cuenta pago mensual vs pago anual.',
    puntos: [
      '**El US$666 estaba doblemente mal y es la lección del capítulo.** Es el costo de una reunión agendada por un SDR en un equipo OUTBOUND — un modelo que MaKo no usa — y encima venía de blogs de agencias de lead-gen que el propio agente había marcado «sin muestra publicada». Puesto como cifra del veredicto se leía «este es tu CAC». Lo que sí se sostiene es el **techo**: cuánto se puede gastar sin destruir valor. Es un límite, no un costo incurrido.',
      '**El mismo error se repitió con un número del curso propio.** El material de AVATARHYPE enseña a comprar Sora en Kie.ai a US$0,15 por 15 segundos. Verificado el 9/8: **Kie ya no vende Sora**, y US$0,01/seg es 10× por debajo de la API oficial. El único Sora comprable es APImart a **US$1,20 por 15s: ocho veces más**. Un número de una fuente propia no está más verificado que uno de un blog.',
      '**Regla que queda:** un precio sacado de un curso, un blog o un benchmark no entra a una proyección sin abrir la página del fabricante ESE día. Está en AGENTS.md.',
    ],
  },
  {
    fecha: '9 ago', hora: '02:40', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'investigacion',
    titulo: 'Con el producto completo, el costo deja de ser el texto y pasa a ser el video',
    puntos: [
      '**El texto se derrumba con el ruteo elegido.** Extraer una reunión de 2 h pasa de US$0,93 a US$0,0021 — **436×** — y no por un modelo más barato: Qwen3.7-Flash tiene 1M de contexto y la reunión **entra entera**, así que desaparecen las 4-5 llamadas del troceo. Otras cuatro acciones caen a cero con GLM-4.7-Flash.',
      '**Y aparece el que importa.** De las 22 acciones nuevas, las 16 de texto suman US$0,23 y las 6 de medios US$3,22. Costo mensual con el producto completo: Free US$0,02 · Pro US$1,87 · **Growth US$27,40, con los medios en el 90%**. Un solo Reel de 15 s con 3 intentos cuesta US$2,45 — más que TODO el texto del Pro en un mes.',
      '**BYOK de MEDIOS está prohibido**, textual, por los dos únicos proveedores aptos para un SaaS: fal.ai y Replicate («You may not share or permit others to use your individual account credentials»). Al BYOK le queda US$2,82 de US$27,40. Va en el Growth, sin bajar el precio, y solo para texto.',
      '**No hay 4º plan.** Las tres premisas que lo empujaban se caen: el techo del 75% de margen es un supuesto de la era SaaS (la mediana de un producto de IA es 50%, n=230); la banda de retención de ChartMogul es atributo de la EMPRESA, no del cliente; y el efecto señuelo **no replica** (91 intentos, 11 confiables). Lo que arregla el video es un TOPE — el que quema US$49 dentro del Growth de US$97 no se muda a uno de US$297.',
      '⚠️ **Y cuatro cosas que este mismo análisis daba por ciertas y no lo son:** el ruteo del paso 1 **no está en el código**; parte de «el texto dejó de costar» es «dejó de medirse» (los ws de clientes tienen 1.005 llamadas y 7,5M de tokens en **US$0,04**, porque `costFor` devuelve 0 por estar el proveedor en una lista); el volumen de medios es un supuesto sin derivar **porque la feature no existe**; y no hay máquina de cobro — el único hit de Stripe en el repo es un regex que tapa claves en los logs.',
    ],
    archivos: [
      'docs/costos-ia-y-planes.md — el producto completo, las dos economías y las 8 correcciones',
      'docs/hallazgos-ia.md — «Comprar modelos»: términos de reventa, el precio del revendedor y el ruteo que no existe',
      'AGENTS.md — la regla de verificar precio y términos antes de sumar un proveedor',
    ],
  },

  // Cosecha retroactiva (17 ago): tandas que se trabajaron y no habian dejado
  // hito. Salieron de cruzar el git log del area contra este mismo archivo.
  {
    fecha: "9 ago", hora: "21:00", chat: "—", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Los 30 del mes 1 no salen: salen 11,1, y las 19 que faltan NO se compran",
    puntos: [
      "El dueño puso el plan concreto sobre la mesa: 30 usuarios el mes 1, US$1.000 de pauta, prospectar sus 1.000 contactos de la agencia y vender high ticket siempre. Corrida de 12 agentes (2,36M tokens, 38 fallas auditadas, 14 cambiaban el signo) para contestarlo. Salió que los 30 no salen —salen 11,1— y que las 19 restantes no se compran: comprarlas cuesta US$4.686 de pauta y deja el cliente en US$311,60, el 171% del techo más permisivo del modelo. Se construyen: el alta pública cierra 10 de las 19 y no cuesta un dólar de medios. A 24 meses el plan cierra igual (160 clientes, US$7.823 de MRR, US$69.150 de caja, ningún mes en rojo, cero capital) pero pide 56,4 h el mes 1 y 46-55 sostenidas. En el mismo commit se corrigió código vivo: el anual del Growth de US$1.067 a US$970 (2 meses gratis, 16,7%) y nació docs/embudo-y-high-ticket.md.",
      "Tres cosas que no están en ningún otro lado. (1) El mes 1 tira 199 de 210 interesados a la basura: el callback de Google devuelve no-autorizado salvo que el email esté cargado a mano desde /admin, así que la pauta trae gente que no tiene dónde entrar — esos 199 valen más que los US$1.000 que los trajeron. (2) El Pro cuesta US$10,90/mes de IA y no los US$2,52 proyectados, porque ese número asume un ruteo que SALVEDADES declara sin una sola línea ejecutable; arreglarlo vale US$15.018 — la corrección más cara del análisis es de ingeniería, no de marketing. (3) El límite del descuento anual está DERIVADO, no elegido: a 19,5% exacto el techo de medios toca el CAC del carrito y el único canal escalable deja de cerrar, así que a «hacelo más atractivo» se responde agregando, nunca bajando el precio. Y el bug hermano del de la barra al 1468%: `Status` es una PÍLDORA y no envuelve — 180 caracteres adentro midieron 1.893 px en una caja de 1.134 y se llevaron el scroll horizontal de toda la página.",
    ],
    commits: [
      { sha: "6db42103", msg: "pricing: la parte 5 — el plan mes a mes, el programa de US$4.000 y la oferta anual", lineas: 869, archivos: 3 },
    ],
  },
  {
    fecha: "10 ago", hora: "12:31", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El CAC son dos monedas que nunca se suman, y el veredicto se dio vuelta",
    puntos: [
      "`cacUsd` sumaba la plata con las horas del dueño valuadas a US$100/h, y de esa suma salía «el único canal que entra es referidos» — absurdo para alguien que tiene tiempo y no tiene capital. Se partió en dos monedas sin ningún campo que las junte (un test lo impide), `entraEn` chequea cada una por separado y `horasDe` hace que terminar una feature baje las horas del canal que habilita. Al partirlas entran TRES de los cinco canales, no uno, y hubo que dar vuelta el título, el Titular y la Nota, que seguían diciendo lo del CAC mezclado. Además: el tope de clientes de high ticket pasó a ser SALIDA (el residual de 338 h después del piso de adquisición), los 1.000 contactos quedaron como evento de arranque fuera de CAC_CANALES —meterlos adentro los hacía contarse dos veces con `prospeccion`— y `FASES`/`Fase` se renombró a `FASES_TIEMPO`/`FaseTiempo`.",
      "Cuatro trampas, todas verificadas. (1) El test nuevo encontró que la cadena de los 1.000 contactos no cerraba: 1.000 × 20% × 3,5% × 85% da 5,95 altas y la tabla declaraba 8,5 — dos corridas conviviendo en una constante, con el 2,55 del «mes 2» como doble conteo que llegó a la pantalla del dueño como titular. Lo que lo hizo invisible es una coincidencia numérica: 8,5 × 0,7 = 5,95, así que el mes 1 «cerraba» contra la cuenta correcta y nadie miraba el total. (2) Hay TRES `FASES` distintos en el repo (lib/fase-diagnostico.ts, lib/mako-fases.ts, modelo.ts) y un comentario citaba el `noHacer` del array ajeno para justificar un número: el archivo se contradecía solo. (3) Un script de reemplazo por bloque sobre modelo.ts se comió 76.309 bytes con exit 0 y mensaje de éxito, porque buscaba `'\\n];\\n'` en un archivo CRLF: un indexOf que no encuentra devuelve -1 y eso se chequea siempre, uno que encuentra el lugar EQUIVOCADO devuelve un número válido. (4) Queda vivo: las 26 h del orgánico (`CAC_CANALES.organico.horas`) siguen heredadas del modelo roto (US$2.601,60 ÷ US$100/h) y esperan una pregunta al dueño; ninguna conclusión se apoya en ese número a propósito.",
    ],
    commits: [
      { sha: "f1cff74c", msg: "pricing: las 338 h del mes y los topes que salen del residual", lineas: 51, archivos: 1 },
      { sha: "6df988ef", msg: "pricing: el CAC se parte en dos monedas que nunca se suman", lineas: 184, archivos: 3 },
      { sha: "a3612e43", msg: "pricing: los 1.000 contactos son un evento de arranque, no un canal", lineas: 38, archivos: 2 },
      { sha: "de01a282", msg: "pricing: el veredicto de un canal es por fase, y cada moneda va por su lado", lineas: 99, archivos: 2 },
      { sha: "489d66d8", msg: "pricing: dos gráficos, uno por moneda, y el veredicto al derecho", lineas: 161, archivos: 3 },
    ],
  },
  {
    fecha: "10 ago", hora: "14:31", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "«No se entiende» no era exceso de texto: cada gráfico se ordenaba solo",
    puntos: [
      "El dueño pidió revisar de a UNA parte —«con las cinco a la vista el feedback sale sobre el volumen y nunca llega al contenido»— y sacar la palabra «techo» del texto de pantalla. Salió `PARTES_VISIBLES` (el índice sigue listando las cinco y dice cuál se está leyendo), cada parte pasó a abrir diciendo qué CONCLUYE en vez de de qué habla, y la conclusión general se derivó de las cinco partes en vez de ser el veredicto de la parte 1 disfrazado de veredicto del documento. Los porcentajes de la prosa se derivan ahora de `CAC_CANALES` en vez de vivir escritos a mano, con tests que fallan si la frase contradice al dato de al lado o si dos capas resumen lo mismo palabra por palabra (guarda de 40 caracteres). Y las dos monedas pasaron de dos gráficos apilados a UNO: un renglón por canal, dos carriles con su propia escala y la línea que parte la lista donde dejan de entrar.",
      "El diagnóstico obvio era el equivocado y ese es el valor del hito: el dueño reportó «no se entiende» y el texto estaba bien — lo roto era que cada gráfico venía ordenado por SU propio valor, así que un canal estaba en el renglón 1 arriba y en el 4 abajo, y la RELACIÓN entre plata y horas, que era todo lo que la sección tenía para decir, era justo lo único que no se podía seguir con el ojo. Corolario: small multiples sin eje de categorías compartido no son small multiples, son dos gráficos sueltos. Dos trampas más de método: un guard de texto NO puede grepear el fuente (/techo/i engancha `techoIa` y `a.techo`, que son nombres de código y no palabras en pantalla) y la mitad del texto de esta pantalla no vive en Pricing.tsx sino en strings de modelo.ts que el .tsx pinta con {X.que}. Y el gris recesivo de las barras estaba a 1,23:1 —invisible— lo que tapaba que el tono destacado estaba a 1,78:1: lo recesivo se veía MÁS que lo destacado, y la jerarquía se sostenía de casualidad. La regla del orden y el gris ya se cosecharon a AGENTS.md y hallazgos-ui.md; lo que no quedó escrito en ningún lado es el pedido del dueño y el porqué de PARTES_VISIBLES.",
    ],
    commits: [
      { sha: "a31db2cd", msg: "pricing: cada parte abre diciendo qué concluye, no de qué habla", lineas: 75, archivos: 3 },
      { sha: "cf56a8dc", msg: "pricing: sacar «techo» del texto, con un test que lo impide volver", lineas: 102, archivos: 3 },
      { sha: "d4ce03d2", msg: "pricing: la conclusión general, derivada de las cinco partes", lineas: 132, archivos: 3 },
      { sha: "501b542b", msg: "pricing: la parte 3 sola, y las dos monedas en un gráfico que se lee", lineas: 489, archivos: 4 },
      { sha: "49db00eb", msg: "La regla del orden compartido, y el gris de de-énfasis que no se veía", lineas: 79, archivos: 3 },
    ],
  },
];

export const PARTES: Parte[] = [
  { titulo: 'El costo real, medido', detalle: 'Costo por acción, por proveedor y por día, leído en vivo de `anthropic_usage` con filtro de mes y sin el truncado de 1000 filas', estado: 'hecha' },
  { titulo: 'Los 5 bloqueantes del medidor', detalle: 'Atribución de Claude por workspace, los 3 puntos ciegos, el registro fire-and-forget, la falta de primitiva de denegación y el modelo por plan', estado: 'hecha' },
  { titulo: 'Costo de las features que NO existen todavía', detalle: 'Las 22 acciones nuevas de las 38 áreas por construir, con el precio verificado contra el fabricante. El resultado: los medios son el 90% del costo del Growth y el texto ya no importa', estado: 'hecha' },
  { titulo: 'Unit economics: CAC, churn y payback', detalle: 'Los dos canales reales, self-serve: CTWA da CAC ~US$83 y entra en el techo del Pro; el carrito frío da US$76-179 y NO cierra a US$47. Más el impuesto invisible del cobro en LATAM, que pega en adquisición y otra vez en cada rebill', estado: 'hecha' },
  { titulo: 'BYOK vs MaKo Tokens como dos economías', detalle: 'BYOK es gobernanza, no palanca de precio: Growth, sin bajar el precio, solo texto. En medios está prohibido por contrato. Y no hay 4º plan', estado: 'hecha' },
  { titulo: 'El filtro de fecha en /integraciones', detalle: 'Cableado en la card «Costo de MaKo». `?meses=1` puebla el selector y hace de sonda de permiso; las gráficas por proceso siguen al período y los tiles de saldo NO, porque son estado de hoy', estado: 'hecha' },
  { titulo: 'El diseño real de los planes', detalle: 'Qué entra y qué no en cada uno, mensual vs anual, el precio NETO después de comisiones e IVA, el cupo de MaKo Tokens y qué se hace con los 4 clientes que ya están adentro', estado: 'sigue' },
  { titulo: 'La pantalla de Pricing del producto', detalle: 'Las 3 columnas con el desglose de qué incluye y qué no. Va DESPUÉS de los bloqueantes: prometer un cupo que no se puede medir es peor que no tener planes', estado: 'cola' },
];
