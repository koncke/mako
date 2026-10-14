// =============================================================================
// GTM: Oferta y precios — el registro de construcción del área
// =============================================================================
// Alcance: QUÉ vende MaKo y A CUÁNTO. La escalera high-ticket (1a1 US$4.000 /
// Grupal US$1.500, ticket promedio US$2.000), los dos motores de adquisición,
// el modelo económico del embudo (LTV con ascenso, techo de CAC por plan, CAC
// por canal), los planes de software Free/Pro 47/Growth 97 con cupo de MaKo
// Tokens, y la única superficie pública de precio: el bloque «Precio de
// fundador» de la landing, que no da cifra.
// Vive en: app/admin/estrategia/ (desde el 10/10/2026; /vsl/estrategia redirige ahí), app/admin/dev/pricing/ (modelo.ts, Piezas.tsx),
// docs/embudo-y-high-ticket.md, docs/costos-ia-y-planes.md, app/vsl/landing-html.ts.
//
// ⚠️ EL ÁREA ESTÁ PARTIDA EN DOS Y COMPARTE ARCHIVOS CON OTRO REGISTRO. La
// mitad de COSTO —cuánto sale la IA, qué plan la aguanta, los bloqueantes del
// medidor— tiene su propia bitácora en `app/admin/dev/pricing/bitacora.ts` y
// NO se repite acá. Este registro guarda las decisiones de OFERTA y de PRECIO:
// qué se vende, a quién, por qué canal y por cuánto. Cuando una tanda produjo
// las dos cosas (la corrida del 9 de agosto), acá va el lado del negocio y se
// dice explícitamente qué se fue al otro registro.
//
// De dónde salió esto: fecha, hora, commits y líneas de `git log` sobre esas
// rutas; el porqué, de los mensajes de commit, que en este repo son largos a
// propósito; el nombre del chat, resuelto por fecha contra docs/chats.md; la
// cuenta, del trailer `Claude-Cuenta:` (los de julio no lo tienen y son
// anteriores al 8 de agosto, así que van `claude1`).
//
// NO es un changelog. Lo que git ya guarda no se repite: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El documento de oferta (/vsl/estrategia)', detalle: 'Escalera de 3 niveles, canales con estado, embudo por canal y proyección · público sin login y noindex, para mandarlo por link a un mentor', estado: 'hecha' },
  { titulo: 'La escalera y el mix', detalle: '1a1 US$4.000 · Grupal US$1.500 · ticket promedio ~US$2.000 · el mix de 5 ventas que da US$10.000 brutos y US$9.000 netos', estado: 'hecha' },
  { titulo: 'Los dos motores de adquisición', detalle: 'Prospección manual a costo cero y campaña de mensajes a WhatsApp · el webinar pago bajó de motor a canal futuro', estado: 'hecha' },
  { titulo: 'El modelo económico del embudo', detalle: 'LTV con el ascenso adentro, UN techo de CAC por plan con su regla al lado, y el CAC por canal en dos monedas que nunca se suman', estado: 'hecha' },
  { titulo: 'Anual vs mensual', detalle: 'La única palanca que le da vuelta el signo al negocio (62× a 24 meses) · el descuento está topeado al 19,5% por derivación, no por gusto', estado: 'sigue' },
  { titulo: 'Qué entra y qué no en cada plan', detalle: 'Free / Pro US$47 / Growth US$97 con cupo de MaKo Tokens · el diseño fino y todo el lado del costo viven en el registro de `pricing`', estado: 'sigue' },
  { titulo: 'El alta pública', detalle: 'Hoy el email se carga a mano desde /admin: la pauta trae gente que no tiene dónde entrar, y el mes 1 tira 199 de 210 interesados', estado: 'cola' },
  { titulo: 'La superficie pública de precio', detalle: '«Precio de fundador» sin cifra y CTA a la llamada · no hay pantalla de planes, ni carrito, ni pasarela de cobro', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── julio: el documento de oferta ──────────────────────────────────────────
  {
    fecha: '19 jul', hora: '03:20', chat: 'Landing /vsl: copys, pop-ups y landing por feature', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La oferta deja de estar en la cabeza y pasa a ser una página',
    puntos: [
      'El área nace por una necesidad concreta: **había que presentarle la estrategia a un consultor**, y para eso la oferta tenía que existir en algún lado. De ahí sale `/vsl/estrategia`: escalera de 3 niveles, los dos webinars con su matemática, 5 canales de adquisición, el guion de la llamada y las decisiones abiertas, con etiquetas Decidido / Recomendado / Abierto.',
      '⚠️ **Es un documento interno servido en una URL pública.** Vive bajo `/vsl/*`, que `proxy.ts` deja pasar sin login para poder compartir el link, y se tapa con `noindex`. O sea: la matemática del negocio, los precios y los márgenes están a un link de distancia de cualquiera que lo tenga. Se eligió a sabiendas (el pie dice «No distribuir.»), pero es una decisión que hay que volver a mirar el día que la landing tenga tráfico.',
      'En la misma sesión el dueño lo recortó a la mitad y ahí se decidieron dos cosas de oferta que siguen vivas: **MaKo Solo pasa a pago único, sin cuotas**, y los dos niveles de arriba suman el **onboarding 1a1 de regalo** — el primer lugar donde la hora del dueño entra a la oferta sin estar contada como costo, que es exactamente lo que en agosto se terminó midiendo.',
      'El canal «Sociedad con el aliado» se volvió **«Asociarse con Infoproductores», con la propuesta concreta a Jan escrita debajo (qué gana él / qué gano yo)**. Un canal sin la propuesta escrita no es un canal, es una intención.',
      '⚠️ Y una que se pagó después: se borró la sección **«Lo que falta definir»**. Las decisiones abiertas salieron del único documento que existía para decidirlas, así que en agosto hubo que redescubrirlas midiendo.',
    ],
    commits: [
      { sha: 'cd9a2ead', msg: 'Agrega /vsl/estrategia: doc interno de oferta + marketing', lineas: 969, archivos: 2 },
      { sha: 'bb139820', msg: '/vsl/estrategia: recorte y reenfoque (feedback de Martín)', lineas: 45, archivos: 1 },
      { sha: '262621ee', msg: '/vsl/estrategia: quita "Lo que falta definir" y la línea de fuente del pie', lineas: 1, archivos: 1 },
    ],
    archivos: [
      'app/vsl/estrategia/Estrategia.tsx — el documento entero, autocontenido (capa fixed, sin sidebar)',
      'lib/rutas-publicas.ts — `/vsl` está en PUBLICOS: es lo que hace que la página se pueda mandar por link',
    ],
  },

  // ── julio: la consultoría del 27 ───────────────────────────────────────────
  {
    fecha: '28 jul', hora: '11:53', chat: 'Estrategia de venta de MaKo', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El webinar era el motor del plan, y la consultoría lo dio de baja',
    puntos: [
      '**Un canal se mató por función duplicada, no por rendimiento.** El webinar pago de agosto era el eje del documento; el razonamiento que lo bajó es de una línea: *existía para nutrir, y la prospección con diagnóstico ya nutre*. Antes de defender un canal por sus números, hay que preguntar qué trabajo hace y si algo más ya lo está haciendo.',
      'En su lugar entran los dos que sobrevivieron: **prospección manual (agosto, costo cero)** y **campaña de mensajes a WhatsApp (septiembre, desde US$300)**. Cada uno de los seis canales pasó a llevar su **estado** — motor ahora / septiembre / diferido —, que es lo que impide que una lista de canales se lea como si todos estuvieran andando.',
      '**El ICP se amplió: dejó de exigir facturar US$10-20k.** Achicar el filtro de entrada con dos motores que todavía no probaron nada era optimizar el embudo por el lado equivocado.',
      'Entraron secciones que el consultor necesitaba para poder aconsejar (números reales de caja, prueba social, reparto de la semana, riesgos y decisiones abiertas) y **el dueño las borró casi todas en la revisión siguiente**: el documento es para VENDER la estrategia, no para exponer la contabilidad.',
    ],
    commits: [
      { sha: 'faa5cd78', msg: '/vsl/estrategia: reescritura tras la consultoria del 27-jul', lineas: 585, archivos: 2 },
    ],
  },
  {
    fecha: '28 jul', hora: '12:08', chat: 'Estrategia de venta de MaKo', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Dos motores, y la proyección se calcula HACIA ATRÁS desde US$10.000',
    puntos: [
      '**La proyección no se estima: se deriva de la meta.** Se fija el objetivo (US$10.000) y se resuelve para atrás — qué mix de ventas lo da, qué embudo produce ese mix, cuánta plata y cuántas conversaciones hacen falta. El mix que quedó: **1 × US$4.000 + 4 × US$1.500 = US$10.000 brutos, US$9.000 netos**, sin contar MaKo Solo.',
      '**El orden del documento pasó a ser el orden del razonamiento:** producto → oferta → cómo consigo gente → con qué la engancho → por qué agenda → qué pasa en la llamada → cuánto da → qué viene después. «Cómo se corre la escalera» y «Por qué te agenda» estaban ANTES de la adquisición, o sea que el documento contestaba cómo se cierra a alguien que todavía no había explicado de dónde sale.',
      'Se eliminaron las **etiquetas de estatus** (Decidido / Recomendado) y toda la jerga interna: la matriz 3x3 y las «celdas» se reescribieron en criollo por lo que el prospecto se lleva. Un documento de oferta que necesita glosario no vende.',
      'El embudo por canal vivía adentro de «Proyección financiera», donde nadie lo iba a buscar: se mudó a «Estrategia de adquisición». **Un dato mal ubicado se lee como que no existe.**',
    ],
    commits: [
      { sha: '3127706d', msg: '/vsl/estrategia: dos motores de adquisicion y funcionalidades faltantes', lineas: 220, archivos: 2 },
      { sha: '11db623d', msg: '/vsl/estrategia: proyeccion a $10k, lenguaje llano y lead magnets', lineas: 363, archivos: 1 },
      { sha: '24fcd1fa', msg: '/vsl/estrategia: reordena secciones y rehace la ingenieria de llamadas', lineas: 272, archivos: 1 },
    ],
  },
  {
    fecha: '28 jul', hora: '13:28', chat: 'Estrategia de venta de MaKo', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Quién abre la conversación cambia la tasa, y el gancho baja a UN anuncio',
    puntos: [
      '**La tasa de respuesta no es una propiedad del canal: es de quién abrió.** Prospección **20%** (escribo yo) contra campaña **70%** (escribieron ellos). Con esa corrección el embudo se dio vuelta: la campaña paga aporta **más** llamadas que la prospección en frío, con menos conversaciones. Antes se comparaban dos canales con la misma tasa y la conclusión era la contraria.',
      '**El lead magnet se achicó a propósito:** de «diagnóstico del funnel» a **diagnóstico de UN anuncio**. Más fácil de vender en frío, se entrega en minutos y deja servido el puente a la llamada. Y lo entrega un **setter de IA** que pregunta en el chat, no un PDF.',
      '**La regla QUÉ vs CÓMO, que es la que protege la oferta:** el diagnóstico dice qué está mal; el cómo arreglarlo es lo que se compra. Sin eso la llamada se convierte en un diagnóstico gratis y el prospecto se va con el entregable.',
      '⚠️ **La duda estaba mal nombrada, y nombrarla bien la cerró.** Se planteó como «¿conviene el setter de IA?» — pero el setter hace falta igual para llevar la conversación a la llamada. Lo que de verdad está en duda es la **personalización**: un diagnóstico por anuncio y un video por lead no se reutilizan (≈200 Looms son ≈40 horas), contra mandar el mismo mensaje a todos. Quedó abierta y a resolver **partiendo el presupuesto de la fase 1 y midiendo**, no discutiéndola.',
    ],
    commits: [
      { sha: '90c8ffd5', msg: '/vsl/estrategia: tasas por canal, diagnostico del ad y analisis de la llamada', lineas: 134, archivos: 1 },
      { sha: 'c00107bd', msg: '/vsl/estrategia: setter de IA, la duda de la maquinaria y el cierre de venta', lineas: 120, archivos: 1 },
      { sha: '53bb615f', msg: '/vsl/estrategia: la duda es el gancho, no el setter', lineas: 28, archivos: 1 },
      { sha: 'bb9b40de', msg: '/vsl/estrategia: la duda se plantea sobre la personalizacion', lineas: 11, archivos: 1 },
    ],
  },

  // ── agosto: el precio ──────────────────────────────────────────────────────
  {
    fecha: '9 ago', hora: '00:24', chat: 'Cobros y planes · análisis de costos', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El número que decide el precio no es el costo: es la banda de retención',
    puntos: [
      '**El hallazgo que más pesa del análisis no es de costos, es de PRECIO.** ChartMogul mide retención bruta anual de **23% en productos AI-native de menos de US$50/mes**, 45% entre 50 y 249 y 70% arriba de 250. El Pro a US$47 cae en la peor banda **por dos dólares**. Ningún ahorro de infraestructura compensa eso: la palanca está del lado del precio, no del gasto.',
      '⚠️ **Y la cifra que había que sacar: el CAC de US$666.** Es el costo de una reunión agendada por un SDR en un equipo **outbound**, un modelo que MaKo no usa, y venía de blogs de lead-gen sin muestra publicada. Puesta entre las tres cifras del veredicto se leía «este es tu CAC». En su lugar va el **techo** de CAC (US$53-104 en el Pro): cuánto se puede gastar sin destruir valor. **Un límite derivado no es un costo incurrido**, y confundirlos es la forma más barata de hacerle tomar una decisión equivocada al dueño.',
      '**«Es muy confusa, mucho texto, no creo que se presenten así las investigaciones»** — y tenía razón, pero no sobraba contenido: faltaba jerarquía. Eran nueve tarjetas de prosa del mismo peso y el dato que decide el negocio estaba en el séptimo párrafo de la séptima sección. Forma nueva: **el veredicto en tres cifras sin scrollear, dos gráficos que lo sostienen, y todo el respaldo plegado a un clic** para quien quiera auditarlo. Cada métrica va contra su benchmark: «margen 30%» no dice nada; «30% contra un objetivo de 75%» decide una conversación.',
      '⚠️ **El área se había perdido en el refactor de las 121 áreas:** `areaDe(\'pricing\')` devolvía null y la pantalla daba 404, mientras las notas del refactor la daban por existente. Es la baja típica de dos sesiones tocando `areas.ts` a la vez. Se repuso y las sub-tabs pasaron a abrir por URL (`?tab=analisis`) — no es cosmética: sin eso el panel **no se puede verificar desde afuera**, porque con la pane del navegador oculta un clic sintético no llega al onClick de React.',
      'Todo el lado del COSTO de esta misma corrida (el margen del Pro, los free tiers, los bloqueantes del medidor) está en el registro de **`pricing`**, no acá.',
    ],
    commits: [
      { sha: '43e53483', msg: 'Tab de Pricing: el costo de la IA medido, y lo que decide si el negocio cierra', lineas: 890, archivos: 8 },
      { sha: 'bcaa6d87', msg: 'Pricing: la conclusión arriba y el respaldo plegado, en vez de nueve muros de texto', lineas: 395, archivos: 3 },
      { sha: '9af57984', msg: 'El área pricing se había perdido en el refactor de las 121 áreas', lineas: 24, archivos: 3 },
      { sha: '2825ccc6', msg: 'Saco el CAC de US$666 del veredicto: era de un modelo de venta que MaKo no usa', lineas: 10, archivos: 1 },
    ],
    archivos: [
      'app/admin/dev/pricing/modelo.ts — los números, cada uno con su origen: medido / publicado / supuesto. Uno queda marcado «no usar»',
      'app/admin/dev/pricing/Pricing.tsx — el veredicto arriba, el respaldo plegado',
    ],
  },
  {
    fecha: '9 ago', hora: '00:36', chat: 'Cobros y planes · análisis de costos', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'De la competencia no se copia el precio: se copia qué pasa cuando se acaba el cupo',
    puntos: [
      '**El molde es HubSpot y no por su tarifa.** Deja **elegir** el comportamiento del cupo agotado —pausar (default para cuentas nuevas), auto-upgrade, o pay-as-you-go a US$0,010 el crédito— y publica cuántas acciones reales entran en cada plan. La regla que queda para MaKo Tokens: **el cupo agotado no puede degradar la calidad en silencio ni cobrar sin avisar. Frena y ofrece.**',
      'El crédito de HubSpot vale US$0,01; el **MaKo Token vale US$0,001**, diez veces más granular. No es un detalle de vanidad: hace falta esa granularidad para poder cotizar acciones que cuestan centavos, que es la mayoría de las de texto.',
      '**BYOK como beneficio del plan anual tiene el punto de equilibrio a favor:** recién compensa arriba de ~200 salidas de IA por mes, y debajo de 50 gana el cupo administrado. O sea que en el Free solo agregaría fricción sin ahorrar nada — va **arriba**, donde el volumen lo justifica. Con eso deja de haber tensión entre BYOK y MaKo Tokens: no son dos modelos rivales, son dos escalones del mismo.',
      '⚠️ Método: la investigación se hizo **inline y no con agentes en background**, porque las corridas anteriores se perdieron **cuatro veces** al cerrarse la app. Una corrida larga en background sin nada escrito en disco es trabajo apostado.',
    ],
    commits: [
      { sha: 'bbeb040b', msg: 'Competencia: lo que hay que copiar no es el precio, es qué pasa cuando se acaba', lineas: 44, archivos: 2 },
    ],
  },

  // ── agosto: el modelo económico del embudo ─────────────────────────────────
  {
    fecha: '9 ago', hora: '12:02', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El SaaS no es el negocio: es el filtro de una oferta de US$4.000',
    puntos: [
      '**El reencuadre que ordena el área entera:** el plan de US$47/97 deja de ser el producto y pasa a ser el **calificador** de una oferta de US$4.000. El que paga se identifica solo, y la llamada regalada es el mecanismo de traspaso.',
      '⚠️ **Pero el reencuadre optimista era el equivocado, y lo escribió el mismo que lo corrigió.** «Con el ascenso adentro el techo de CAC sube mucho» es verdad a medias: **la llamada se le regala a TODOS los que compran, asciendan o no**, así que entra como **costo por comprador**, del lado negativo. Debajo de **4,2% de ascenso la llamada DESTRUYE valor** — a 1%, el LTV del Pro es *menor* con llamada que sin ella.',
      '**El recurso escaso deja de ser la plata y pasa a ser la agenda.** El ascenso está topeado por el calendario; los canales de volumen no. De ahí la regla que gobierna cada canal: los que se topean (referidos, WhatsApp con guion) se miden contra el techo **con ascenso**; los que escalan (carrito, cualquier cosa con presupuesto de medios) contra el techo de **solo suscripción**, porque su comprador marginal nunca ve la llamada.',
      '**El modo de falla no es el fracaso: es el éxito.** Cuanto mejor funciona el ascenso, antes satura la agenda. El escenario bueno rompe el diseño actual antes que el malo — y por eso no se puede validar el modelo mirando solamente el escenario pesimista.',
      '⚠️ **La prospección en frío no es «riesgosa»: está PROHIBIDA.** Messaging Policy de Meta §1(b): solo se puede contactar a quien dio su número **y** dio opt-in, y Meta excluye explícitamente el consentimiento «assumed… from a purchase», así que reactivar una lista comprada tampoco es el salvavidas. Un canal ilegal no se pondera con los otros: se saca de la tabla.',
      '⚠️ **US$150 de llamada son 3,6 meses de contribución de un Pro.** El que cancela en el mes 4 pagó la llamada y nada más, y hoy no hay nada que lo impida.',
    ],
    commits: [
      { sha: 'ed527f0c', msg: 'docs: el embudo real — el SaaS es el filtro, no el negocio', lineas: 449, archivos: 2 },
    ],
    archivos: [
      'docs/embudo-y-high-ticket.md — el modelo completo: la fórmula del LTV, las dos vistas (caja vs capacidad) y qué estatus tiene cada parámetro',
      '⚠️ Ahí está escrito que las dos vistas NO son dos escenarios sino dos fórmulas: en CAJA `c_llamada = 0` y por lo tanto no existe break-even. Toda cifra tiene que decir con cuál está hablando',
    ],
  },
  {
    fecha: '9 ago', hora: '14:52', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El ascenso al high ticket no compra techo, y seis techos convivían sin derivación',
    puntos: [
      '**La llamada 1a1 regalada BAJA el techo de CAC en US$6,57 por comprador.** Vale US$143,43 de ascenso esperado y cuesta US$150 de calendario — **2,0 h y no 1,5, porque el guion promete el análisis POR ESCRITO y ese informe no estaba contado en ninguna hora**. El break-even queda en 7,47% contra una base de 7%. Con eso se cae la columna «con ascenso» entera y queda **un techo por plan**.',
      '**El calendario vende los mismos ~1,3 programas de US$4.000 en 24 meses tenga 50 clientes o 4.011.** El high ticket pasa del 64% de la caja en el escenario pesimista al **0,4%** en el optimista. La conclusión que hay que no perder: **el SaaS y el 1a1 no compiten por clientes, compiten por la misma hora.** En el escenario base se sirven 24 de 869 llamadas pedidas.',
      '⚠️ **Convivían SEIS techos de CAC distintos** —US$104, US$53, US$49-97, US$55-70, US$194-381 y los ocho «con y sin ascenso»— y **ninguno tenía derivación escrita**. Un número sin derivación no se puede corregir ni multiplicar: se hereda. Quedó uno por plan con la regla que lo gobierna al lado (3:1 o payback ≤3 meses, la más estricta de las dos).',
      '⚠️ **El costo de un Free tenía TRES valores incompatibles vivos a la vez** (US$0,30 por única vez, US$7,20 a 12 meses, US$0,60/mes) y el «punto de quiebre #1» decía US$68,41/mes, que en realidad era **la factura de cinco workspaces**, uno de ellos ws1 con los crons de Fathom. Es US$4,00 de por vida, y pesa el 37,8% del CAC del CTWA — o sea que **el Free es lo que saca del techo al único canal escalable**.',
      '⚠️ **Dos errores de significado, no de código, en lo recién generado:** referidos —el ÚNICO canal que entra— salía pintado de rojo porque el gráfico usaba `tono="bad"`, que afirma lo contrario que el dato; y una barra por encima del `max` se dibujó con `width: 1468%`, que **no desborda la barra: desborda la PÁGINA** (el documento pasó de 1.440 a 7.656 px). Las dos se cosecharon a AGENTS.md.',
    ],
    commits: [
      { sha: 'c0ea54ef', msg: 'pricing: la parte 3 — el CAC por canal, y el ascenso al high ticket no compra techo', lineas: 684, archivos: 3 },
      { sha: 'ce081287', msg: 'docs: la cosecha de la corrida del modelo económico', lineas: 172, archivos: 3 },
    ],
    archivos: [
      'app/admin/dev/pricing/Piezas.tsx — `Barras` (recorte al 100%, punta a filo) y `DosMonedas`',
      'docs/embudo-y-high-ticket.md — las 5 conclusiones, las 16 correcciones y las 10 decisiones que son del dueño y ningún modelo puede tomar por él',
    ],
  },
  {
    fecha: '9 ago', hora: '21:00', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Lo único que cambia el signo es QUÉ se vende: anual, no mensual',
    puntos: [
      '**Misma máquina, mismo embudo, mismo gasto: el escenario base vendiendo Pro mensual deja US$3.073 de caja a 24 meses, y vendiendo ANUAL deja US$189.877. 62×.** En los otros tres escenarios el mensual termina en cero o en rojo. Ninguna optimización de canal, de costo ni de conversión mueve el negocio como esa sola decisión de oferta.',
      '**Corrección a código vivo: el anual del Growth pasó de US$1.067 a US$970** («2 meses gratis · 16,7%»). El 8,3% anterior quedaba debajo del mínimo medido en 16 páginas reales y creaba una **escalera perversa** — el plan que más conviene retener tenía la peor oferta anual, con las dos cards pegadas. Dos comparables independientes aterrizan en el mismo número: GoHighLevel y ClickFunnels.',
      '⚠️ **El límite del descuento anual está DERIVADO, no elegido:** a **19,5% exacto** el techo de medios toca el CAC del carrito y el único canal escalable deja de cerrar. Por eso a «hacelo más atractivo» **se responde agregando, nunca bajando el precio**. Es el tipo de número que hay que dejar escrito con su derivación al lado, o dentro de un mes alguien lo baja «un poquito más».',
      '**El cuello dejó de ser el calendario, pero por el motivo opuesto al que parecía.** Se sirven 26,6 de 26,6 llamadas pedidas con 5,5 h/mes de sobra, así que el closer no se contrata nunca — no porque el tiempo alcance, sino porque **el embudo produce 1,3 llamadas calificadas por mes**. La palanca del high ticket es volumen de anuales, no capacidad de atención.',
      '⚠️ **El mes 1 tira 199 de 210 interesados a la basura**, y no es un problema de marketing: el callback de Google devuelve no-autorizado salvo que el email esté cargado a mano desde `/admin`. La pauta trae gente que **no tiene por dónde entrar**. Esos 199 valen más que los US$1.000 que los trajeron, y el alta pública cierra 10 de las 19 altas que faltan sin gastar un dólar de medios.',
      'La otra mitad de esta corrida —los 30 usuarios del mes 1 que en realidad son 11,1, y el Pro que cuesta US$10,90 de IA y no US$2,52— está en el registro de **`pricing`**.',
    ],
    commits: [
      { sha: '6db42103', msg: 'pricing: la parte 5 — el plan mes a mes, el programa de US$4.000 y la oferta anual', lineas: 869, archivos: 3 },
    ],
    archivos: [
      'app/admin/dev/pricing/modelo.ts — `PRECIOS` (mensual y anual) y la derivación del tope del descuento',
      'app/vsl/landing-html.ts — «Precio de fundador»: la ÚNICA superficie pública de precio, y no da cifra. El CTA es «Agenda tu diagnóstico», o sea que hoy todo el precio se dice en la llamada',
    ],
  },
  {
    fecha: '4 oct', hora: '22:18', chat: 'Tareas de llamada con Mauricio', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Bajar a tierra el audio del plan contra el runway, y qué perfiles no están mapeados',
    pedido: 'Baja a tierra esto para agregarlo a mi proyección de los próximos días, ten muy presente esto: https://hola-mako.com/admin/runway\n\nY también quiero evaluar si me faltan cosas que no mapeé, por ejemplo, si van a entrar personas que venden productos... O cosas que me estan faltando',
    puntos: [
      'Vino con una nota de voz de WhatsApp de 7.579 caracteres transcritos, con DOS voces: la que propone y hace lo técnico, y Lean, que refuta («en una tarde lo tenés», «no te pongas deadlines pajeros»). Lo que agrega el audio: pasarela de pago (Mercado Pago contra Stripe), bajar la oferta a un documento, el 50% del primer mes, que el tráfico frío entre comprando la app barata y después se le suba al grupal, niveles de acceso por plan, el mail de invitación automático al comprar, y mover el cierre técnico del 14 al domingo 18/10 para arrancar prospección el lunes 19.',
      'La segunda mitad del pedido —«si van a entrar personas que venden productos»— es la que no se contesta leyendo el audio: es un relevo de qué supuesto del producto rompe cada perfil que entre por un plan barato.',
    ],
  },
  {
    fecha: '4 oct', hora: '22:33', chat: 'Tareas de llamada con Mauricio', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'La cuenta del runway no estaba rota: estaba medida contra el otro producto',
    puntos: [
      '⚠️ **El diagnóstico obvio era el equivocado, y es lo que más se ganó.** Al leer el audio di por hecho que la cuenta de `/admin/runway` (2.000 ÷ 100 por agenda × 50% = 10 clientes = 15.000) describía el embudo viejo. Es al revés: esos 15.000 son 10 × 1.500 del **grupal** (`ASCENSO_PROGRAMAS.grupal`, caja 1.290,33), y contra esa caja el CAC medido del carrito (136,22) entra con 7× de margen. La cuenta cierra. Lo que NO cierra con ese CAC es la app de 47, cuyo techo está medido en 105,27 — o sea que el producto que el audio pone adelante es el que no se puede llenar con pauta. Los dos números estaban a tres líneas uno del otro.',
      '**La pregunta que ordena todo lo demás, y que sigue sin contestar:** qué se cobra primero en la ventana del 1/11 al 15/12. No es orden — el merchant of record **prohíbe «coaching» por escrito**, así que el grupal va por Stripe propio y los planes por el MoR: son dos checkouts, y el rail del grupal es justo el que arranca el reloj de 30 días del RFC mexicano.',
      '⚠️ **El reloj que no se acelera trabajando más, y que ninguna de las dos voces del audio nombra:** el MoR aprueba el negocio «días o semanas ANTES del primer cobro» y pide `/reembolsos`, que no existe. Arranca hoy y en paralelo, porque no lo hace el mismo recurso que lo técnico. Y son 30 días con plata (1/11 al 30/11), no 45: una semana de atraso baja las 20 agendas a ~15.',
      '**Lean tiene razón en casi todo lo que dio por construido**, y eso es lo que más tiempo ahorra: los niveles de acceso cortan en el server (64 páginas), el mail de acceso y el alta completa existen encadenados con el orden ya pagado, la firma de webhook también. El webhook de pago es extraer el alta a lib y envolverla: una jornada.',
      '⚠️ **Lo que NO es una tarde es el cartel de «no está en tu plan»:** `requireCapa` devuelve `Promise<void>` con el `redirect()` adentro, así que son 56 call-sites — y el componente que lo diría existe desde agosto con cero emisores.',
      '⚠️ **El argumento de que «el 47 con Video Generator no es rentable» tiene la premisa al revés:** el video lo pagan los créditos de Flow del cliente. Lo que sí lo hace insostenible está medido en el propio modelo: `IA_POR_PRO` dice literal que reemplaza al 2,52, y con ese número un Pro a 47 sobre el único workspace real medido es **caja negativa**.',
      '**Lo que no estaba mapeado:** el que vende productos tiene el embudo pero no la entrada (cero integraciones de ecommerce en todo el repo), y la más cara es invisible hasta que pasa — **el login es sólo Google**, así que quien pague con un mail que no sea de Gmail no puede entrar nunca.',
      'El relevo completo, en `docs/proyeccion-04oct.md`. Las trampas de código, en `docs/hallazgos-planes-y-cobro.md`, que es un área nueva.',
    ],
    commits: [
      { sha: '892713b0', msg: 'Baja a tierra el audio del plan contra el runway, y cosecha lo que midio la corrida', lineas: 592, archivos: 5 },
      { sha: '0cf4fba2', msg: 'El «no agendaste» al que pago mide CERO: se reescribe como lo que es', lineas: 50, archivos: 2 },
      { sha: '09d9182e', msg: 'La importacion SI asigna embudo: mi grep midio el archivo que no escribe', lineas: 13, archivos: 1 },
    ],
    archivos: [
      'docs/proyeccion-04oct.md — el entregable: la decisión que reordena todo, el reloj externo, lo que ya está construido y los perfiles que rompen un supuesto',
      'docs/hallazgos-planes-y-cobro.md — área nueva: `capaDef` es fail-open, el corte por capa es de pantalla y no de API (5 de 251 rutas), los términos publicados afirman que no se cobra',
      'AGENTS.md — `app/vsl/landing-html.ts` es GENERADO y no se edita a mano: la sección nueva se monta desde `Landing.tsx`',
    ],
  },
  {
    fecha: '10 oct', hora: '16:15', chat: 'Estrategia de ventas MaKo', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Bajar a tierra un programa de referidos atractivo y rentable',
    pedido: 'Teniendo en cuenta todo esto\n\nhttps://hola-mako.com/admin/runway\nhttps://hola-mako.com/vsl/estrategia\nY el proyecto de "Referidos" en el Plan...\nY sobre todo, lo último que habiamos quedado, todo el contexto...\n\nQuiero que me ayudes a bajar a tierra el sistema de referidos que sea atractivo realmente y que me salga rentable... Estoy medio perdido como escucharás en el audios... Tal vez si investigas también como lo hacen otras apps',
    puntos: [
      'Vino con un audio de WhatsApp (transcripto con Groq). Después, en el chat: «quién preferiría $10 antes que $47» (se descartó el «modo cuenta»), «lo más fácil es descontar su suscripción si trae a 2 de 47, o 1 de 97», «300 por grupal está bien» y la agencia dentro del 97.',
    ],
  },
  {
    fecha: '10 oct', hora: '17:37', chat: 'Estrategia de ventas MaKo', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El programa de referidos decidido, con su costo contra el techo de cada plan',
    puntos: [
      'Cada cliente nuevo descuenta su primer mes de la suscripción del que lo refirió, una vez (2 × 47 o 1 × 97 = su mes de 97 gratis), y cuenta cuando ya pagó 2 meses. El grupal paga US$300 en efectivo (20% de cada cuota, sin comisión si hay reembolso). La agencia vive dentro del 97.',
      'Costo esperado contra techo: el referido del 47 cuesta 78,23 (techo 81,50); el del revendedor pagado en efectivo, 80,56; el del 97, 130,46 (techo 158,07).',
      'Descartado, con su porqué en `docs/referidos.md`: el «modo cuenta», «gratis mientras sigan activos» (−US$33,13 por mes por referidor) y el plan de agencia de 200.',
    ],
    commits: [
      { sha: '72dac4fb', msg: 'Referidos: la propuesta bajada a tierra, y lo que vuelve a morder al diseñar un premio', lineas: 401, archivos: 4 },
      { sha: '72272c6d', msg: 'Referidos: un solo número para todos (Martín descartó el «modo cuenta»)', lineas: 69, archivos: 2 },
      { sha: '29a3ef18', msg: 'Referidos: el programa decidido (cada cliente nuevo descuenta un mes, agencia dentro del 97)', lineas: 61, archivos: 2 },
    ],
    archivos: ['docs/referidos.md — «EL PROGRAMA DECIDIDO», la tabla de costos y la síntesis de cómo lo hacen otras apps'],
  },
  {
    fecha: '10 oct', hora: '17:46', chat: 'Estrategia de ventas MaKo', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Juntar la estrategia, el runway y los costos en UNA tab de super admin',
    pedido: 'Lo que pienso es... Gratis el primer mes para el que llega, solo el plan de 47, en el de 97 de última 50% de descuento, sino, no es rentable.\nY para los revendedores, primero se descuenta de su suscripción y luego recién se comienza a pagarles.\n\nAntes de la pagina para los revendedores me gustaría unificar toda esta info... Todo en una sola tab de MaKo... En la de estrategia me gustaría...\nPorque tenemos runway, tenemos una de análisis de costos, y mucha info desparramada.\n\nRecuerda que al diseñarlo, siempre que se vea grafico, simple, no tanto texto. Como está la de estrategia.\n\nY haz privada solo para superadmin esa tab.\n\n(a mitad del trabajo) Haz los graficos de torta... Y en general utiliza graficos cuando veas necesario.\n\nTodo que sea bien visual',
    puntos: [],
  },
  {
    fecha: '10 oct', hora: '18:59', chat: 'Estrategia de ventas MaKo', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab Strategy: estrategia, runway, costos y referidos en una sola pantalla',
    puntos: [
      '`/admin/estrategia`, sólo super admin (`getSesionAdmin`), con los números IMPORTADOS del runway y de `modelo.ts`. Tres tortas (47, 97 y grupal 1.500) que suman al centavo. `/vsl/estrategia` redirige ahí.',
      'Lo que no coincidía entre las fuentes al juntarlas, en `docs/hallazgos-planes-y-cobro.md`: el objetivo de 10.000 salía de un 1 a 1 que ya no está en la oferta (5 ventas son 7.500), la pauta de noviembre dice 1.000 en la estrategia y 2.000 en el runway, y `CAC_CANALES` mide el 47 con usuarios Free que hoy no existen.',
    ],
    commits: [
      { sha: '9862c146', msg: 'Strategy: la estrategia, el runway, los costos y los referidos en UNA tab de super admin', lineas: 3052, archivos: 16 },
    ],
    archivos: [
      'app/admin/estrategia/datos.ts — toda cuenta de la tab, al lado de su porqué',
      'tests/estrategia-tab.test.ts — las tortas al centavo, las decisiones del 10/10 y el guard de super admin',
    ],
  },
  {
    fecha: '10 oct', hora: '19:47', chat: 'Estrategia de ventas MaKo', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Devolver la intro y el cliente ideal, y partir la tab en desplegables',
    pedido: 'Eliminaste cosas de la antigua tab de estrategia que estaban buenas... Como la intro, que decía el avatar, etc...\nY utiliza mas desplegables, que se separen bien las secciones, no se entiende son muchas cosas todas juntas. Quiero tener claridad de que estoy leyendo en todo momento.',
    puntos: [],
  },
  {
    fecha: '10 oct', hora: '20:08', chat: 'Estrategia de ventas MaKo', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Doce secciones en desplegables, y lo que estaba en un hover, a la vista',
    puntos: [
      'Vuelven arriba la intro («Cómo vamos a vender MaKo») y el cliente ideal. Cada sección es un `<details>` numerado con la pregunta que contesta, en tres grupos; la abierta deja su renglón pegado arriba al scrollear.',
      '⚠️ **El atajo de la primera versión era esconder, no acortar:** los seis ejes de la llamada, el Loom y los canales a futuro estaban en un `title`, que no se ve en el celular ni sin el mouse. Ahora se ven, y el test busca el texto en la página dibujada SIN los `title`.',
      'La propuesta a Jan vuelve con los tres puntos que chocan con los referidos MARCADOS, no corregidos: qué se le ofrece lo decide Martín.',
    ],
    commits: [
      { sha: 'c7796466', msg: 'Strategy: vuelven la intro y el cliente ideal, y cada sección es un desplegable', lineas: 952, archivos: 6 },
    ],
    archivos: [
      'app/admin/estrategia/Estrategia.tsx — `Seccion` (el desplegable), `Grupo`, `Intro`, `Producto`, `ColJan`',
      'app/admin/estrategia/datos.ts — `JAN_GANA` / `JAN_GANO`, con `choca` en lo que no coincide con el programa decidido',
    ],
  },
  {
    fecha: '10 oct', hora: '21:37', chat: 'MaKo Pricing', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Las cuatro decisiones de la tab: la ventana, el objetivo, el 1 a 1, Jan y los costos',
    pedido: '¿El 1 a 1 de US$4.000 sigue existiendo? → Podríamos plantear una oferta 1 a 1... Pero que salga 10k y debería realmente valer mucho la pena...\n¿La pauta de noviembre es de US$1.000 o de US$2.000? → No lo mediría en mes... Lo mediría el total que son 2k repartido de inicio a fin en las fechas donde dijimos que ibamos a correr los ads\n¿Hacemos privada /vsl/costos? → Privada\n¿Qué le ofrecemos a Jan? → Reescribirla\n¿El objetivo de US$10.000 también pasa a ser el total de la ventana? → El objetivo no debe ser 10k... Debería ser 15k, que son vender 10 tickets de 1500 o muchos de 47 o 97, o la combinación de ambos.\n¿La prospección, cómo la cuento en la ventana de 45 días? → Proporcional (~1.500)\n¿Qué incluye el 1 a 1 de US$10.000? → La defino yo',
    puntos: [],
  },
  {
    fecha: '10 oct', hora: '21:37', chat: 'MaKo Pricing', cuenta: 'claude3',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La proyección se cuenta en la ventana, contra 15.000; el 1 a 1 vuelve a 10.000 y Jan se reescribe',
    puntos: [
      'Toda la proyección pasa del mes a la **ventana de los anuncios** (1/11 al 15/12, 45 días del runway), con **US$2.000 de pauta en total**. Con las tasas que Martín aprobó: 26 agendas → 8 grupales → US$12.000 vendidos contra un objetivo de **US$15.000**; faltan 32 agendas en vez de 26.',
      'El **1 a 1 vuelve a US$10.000** con la tarjeta punteada y «Contenido a definir»: lo define Martín, y no entra en la proyección porque no hay embudo que lo venda.',
      '⚠️ **La propuesta a Jan chocaba en cinco filas y la tab marcaba tres.** Las dos sin marcar —«acceso de por vida» y «recurrencia sin mover un dedo»— chocaban con las reglas comunes del programa, no con la tabla de premios, y se leían como favores. Ahora dice lo mismo que cualquier revendedor más lo que no tiene precio.',
      '`/vsl/costos` queda sólo para el super admin, con el guard en la página: `/vsl` es pública por la landing y el proxy no la cierra.',
    ],
    commits: [
      { sha: 'a5cf1407', msg: 'Strategy: la ventana en vez del mes, objetivo 15.000, el 1 a 1 a 10.000, Jan reescrito y /vsl/costos privada', lineas: 355, archivos: 7 },
    ],
    archivos: [
      'app/admin/estrategia/datos.ts — `DIAS_VENTANA`, `PAUTA_TOTAL`, `OBJETIVO_USD`, `PRECIO_1A1`, los dos embudos calculados con sus tasas, `JAN_GANA` / `JAN_GANO`',
      'app/vsl/costos/page.tsx — el guard `getSesionAdmin`',
      'tests/estrategia-tab.test.ts — la proyección de la ventana, el 1 a 1, Jan sin las cinco promesas y el guard de los costos',
    ],
  },
  {
    fecha: '10 oct', hora: '22:39', chat: 'MaKo Pricing', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Sacar de Strategy las tabs que merecen la suya, funcionales y con datos reales',
    pedido: 'Dentro de la tab de estrategia, hay muchas tabs que podrían tener su propia tab, pero bien diseñada y funcionales... Y entonces consumimos la info como lo que dice: ¿Qué es MaKo?...\n\nBueno, ahí dentro de MaKo, me imagino que están los precios, con las tipicas columnas de precio de apps.\nMe imagino otra tab del Sistema de Referidos, que lo puedan ver todos los usuarios...\nOtra tab de "Objetivos" que ya tenemos un proyecto de una tab así... Para ponernos objetivos de dinero y tiempo...\nOtra que podría estar en "Graphics" para ver los graficos más importantes, como ese gráfico de torta, pero con datos reales de cuanto es el % que se va en cada cosa... (Esto es un proyecto aparte, que justamente quiero poder personalizar los graficos para todos los usuarios, que tengan una herramienta de selector de gráficos para elegir los que quieran)\nIdentifica que otras tabs más, importante que sean funcionales, reales...',
    puntos: [],
  },
  {
    fecha: '10 oct', hora: '22:39', chat: 'MaKo Pricing', cuenta: 'claude3',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Once tabs propuestas, y el bloqueo no es de pantallas: el CRM de MaKo está vacío',
    puntos: [
      'Corrida `wf_01c22b1b-91a` (10 agentes, sólo lectura, contra el código y la base). **Las pantallas que harían reales las secciones de Strategy ya existen** (`/comercial`, `/analisis` con tasas medidas, `/general`); lo que falta son los datos de MaKo en su propio workspace: 3 ganados sin monto, 0 pagos, 0 pauta, 0 visitas, 0 agendas y la línea de WhatsApp sin conectar.',
      'Ahora: **Números de MaKo** (Graphics y Análisis en ws9, sin tab nueva), **¿Qué es MaKo?** (la 01 y la 02 con la grilla de columnas, para el super admin) y el **Runway** en la barra, con las fechas del tablero. Después: Objetivos (es `/general`, con un rango «del … al …»), Referidos, el selector de gráficos y el margen por oferta. No: el experimento del Loom, «Mi plan» del cliente y los precios públicos.',
      '⚠️ **El diseñador volvió a preguntar precios que se habían decidido ese mismo día**; lo cazaron los refutadores leyendo esta bitácora. Y «clientes por plan» no sale de la capa: la capa es acceso, no lo que se paga.',
    ],
    archivos: [
      'docs/propuesta-tabs-strategy.md — la propuesta entera, con lo que tiene que decidir Martín',
      'docs/hallazgos-planes-y-cobro.md — «Partir Strategy en tabs»; y una entrada en objectives, ads, landing, crm y ui',
    ],
  },
  {
    fecha: '14 oct', hora: '16:38', chat: 'Estrategia de ventas MaKo', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Runway pasa a ser el tablero donde contesta las decisiones de todos los chats',
    pedido: 'quiero que rediseñes esa tab para que se lea muy simple. Quiero texto grande, menos texto, tarjetas, etc... Quiero leerlo simple.',
    puntos: ['Llegó por el chat «Estrategia 3 cuentas», que junta las preguntas de todos los chats: una decisión por tarjeta, con el chat, la pregunta en una línea, las opciones, qué destraba y si está contestada; en la compu y en el teléfono.'],
  },
  {
    fecha: '14 oct', hora: '16:44', chat: 'Estrategia de ventas MaKo', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El tablero de decisiones: 55 tarjetas publicadas, se contestan con un toque',
    puntos: [
      '`/admin/runway` muestra una tarjeta por decisión, agrupadas en «Frenan a un chat», «Cuestan dinero o clientes», «Criterio, sin apuro» y «Para saber»; la recomendada va marcada y siempre se puede escribir otra respuesta. Las contestadas bajan plegadas, con «Nueva» hasta que el chat la recoge.',
      'En el teléfono es la misma pantalla (`/admin/runway` ↔ `/m/decisiones`); la foto vieja del lanzamiento se mudó a `/admin/runway/foto`.',
      'Los chats publican y leen con `scripts/decisiones.ts` (todo o nada: si una no valida, no se publica ninguna). La tabla (mig 0277) es de plataforma, sin workspace.',
      '⚠️ **Lo encontró mirarlo dibujado, no los tests:** la marca «Recomendada» al costado de la opción le comía el ancho y una opción de cinco palabras salía en cuatro renglones; y el porqué iba antes de la pregunta. Los 9 tests dibujaban la tarjeta y daban verde.',
    ],
    commits: [
      { sha: '86e0078a', msg: 'Runway: el tablero de decisiones de Martín (una por tarjeta, en compu y teléfono)', lineas: 2503, archivos: 14 },
      { sha: '8057e855', msg: 'Runway: la pregunta primero y la «Recomendada» arriba de la opción', lineas: 20, archivos: 2 },
    ],
    archivos: [
      'app/admin/runway/decisiones.ts — el modelo y el saneo de lo que se publica (rechaza con motivo, nunca recorta; link de afuera sólo claude.ai, por origin)',
      'app/admin/runway/Tablero.tsx, TarjetaDecision.tsx, decisiones.css — la pantalla',
      'lib/admin-decisiones.ts, app/admin/runway/acciones.ts — leer y contestar, con el guard del super admin',
      'scripts/decisiones.ts — publicar / contestadas / recoger / retirar / listar',
    ],
  },
  {
    fecha: '14 oct', hora: '19:09', chat: 'Estrategia de ventas MaKo', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Las decisiones como Tinder: deslizar para aprobar o dejar para después',
    pedido: 'quiero que diseñes esto como si fuera "tinder" en donde hay tarjetas y yo puedo ir desplazando a la derecha o la izquierda para aprobar o ignorar. Y que en el medio cargue mi respuesta... Y claro pueda ver el detalle. Hazlo y ponlo en una nueva ruta de la Ticketera de MaKo',
    puntos: ['Llegó por el chat «Estrategia 3 cuentas». «La Ticketera» se leyó como /tickets (la tab «Reportar problema»): no hay nada más con ese nombre en el repo.'],
  },
  {
    fecha: '14 oct', hora: '19:09', chat: 'Estrategia de ventas MaKo', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El mazo en /tickets/decisiones: nace en el teléfono, misma fuente que el tablero',
    puntos: [
      'Una tarjeta a la vez con la siguiente asomando. **Derecha manda la respuesta marcada, izquierda la deja para después** (no contesta: vuelve cuando se termina el mazo). En el medio se marca A/B/C u «Otra respuesta»; «Ver detalle» abre el porqué, qué destraba y el link. ✕ y ✓ abajo, y ← → en la compu.',
      '⚠️ **«Derecha = la recomendada» habría dejado el gesto muerto en 37 de las 55 primeras:** no traían recomendada. Por eso la derecha manda lo MARCADO, que de entrada es la recomendada (o la única opción), y tocar una opción marca, no manda.',
      'Contesta con la misma acción que /admin/runway, así que lo de un lado aparece contestado en el otro. En el teléfono la misma URL sirve app/m/tickets/decisiones como pantalla de trabajo (sin la barra de abajo). Sólo el super admin; para el resto, 404.',
      '⚠️ **`Mazo.tsx` y `mazo.ts` en la misma carpeta se pisan en Windows:** importar `./Mazo` resolvía al `.ts` (que no distingue mayúsculas) y el componente llegaba `undefined`. La lógica se llama `reglas.ts`.',
    ],
    archivos: [
      'app/tickets/decisiones/reglas.ts — la cola, lo marcado de entrada y cuándo cuenta un deslizamiento (con test)',
      'app/tickets/decisiones/Mazo.tsx, mazo.css — el gesto (pointer events sobre un ref) y el dibujo',
      'app/tickets/decisiones/page.tsx, app/m/tickets/decisiones/page.tsx — compu y teléfono, mismo mazo',
      'lib/movil-rutas.ts, app/m/_ui/cabecera.ts, lib/titulo-tab.ts — la ruta del teléfono, pantalla de trabajo y el título de la pestaña',
    ],
  },
];
