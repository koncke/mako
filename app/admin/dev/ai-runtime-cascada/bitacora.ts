// =============================================================================
// AI Runtime & Cascada — el registro de construcción del área
// =============================================================================
// Alcance: el motor que ejecuta TODA llamada de IA. `chatClaude` y el loop de
// tool-use, la cascada de proveedores gratis que se recorre entera antes de
// pagar, la rotación en tres ejes (proveedor · cuenta · modelo), el catálogo de
// qué modelo usa cada feature y el veto que gobierna la única puerta a Claude.
// Vive en: lib/anthropic.ts, lib/ai-cheap.ts, lib/veto-claude.ts,
// lib/model-catalogo.ts, lib/model-registry.ts, lib/ia-keys*.ts,
// lib/ia-mensajes.ts, app/modelos-ia/.
//
// De dónde salió esto: los `pedido` son textuales, citados dentro de los mensajes
// de commit del propio repo (`git show -s`); fecha, hora, sha y tamaño salen de
// `git log` sobre las rutas del área; las trampas y lo que quedó sin hacer, de
// docs/hallazgos-ia.md (secciones «La capa barata» y el gasto); el nombre de la
// sesión, de docs/chats.md — que hoy llega hasta el 8/8, así que de ahí en
// adelante va «—» en vez de un nombre inventado.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado. Esta área
// los tiene a montones, y casi siempre con la misma forma: el número era cierto
// y la conclusión falsa.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La cascada gratis, entera antes de pagar', detalle: 'chatCheapCascade recorre los cinco proveedores libres · Claude es el ÚLTIMO recurso, nunca el segundo', estado: 'hecha' },
  { titulo: 'Rotación en TRES ejes', detalle: 'Proveedor · cuenta (el free tier se agota por key) · modelo (MODELOS_RESPALDO, solo alias -latest)', estado: 'hecha' },
  { titulo: 'El veto de Claude, en el `fetch`', detalle: 'Cinco puertas terminaban en la misma llamada · lista blanca en código, con vencimiento, y el bloqueo se registra', estado: 'hecha' },
  { titulo: 'El catálogo de modelos por feature', detalle: 'lib/model-catalogo.ts sin `server-only` para que el test lo importe · el `def` es un proveedor GRATIS y `pagoPorque` explica lo que cobra', estado: 'hecha' },
  { titulo: 'Lo que el usuario lee cuando falla', detalle: 'motivoDeErroresCascada y esErrorDeIA en lib/ia-mensajes.ts, puros y testeables · saturación no es cuota, y la salida va pegada al error', estado: 'hecha' },
  { titulo: 'El override de /modelos-ia', detalle: 'Aplica SOLO si el caller no pasó `model`: cualquier chatClaude(..., { model }) se saltea el registro entero y la tab sigue diciendo otra cosa', estado: 'sigue' },
  { titulo: 'Un techo de gasto que corte de verdad', detalle: 'Nada en lib/ frena una llamada por dinero: ordenarPorCuota reordena y nunca saca, y todos los recordUsage son POSTERIORES. El chequeo hay que escribirlo pre-flight', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 12 de agosto: el día que se midió la degradación ───────────────────────
  {
    fecha: '12 ago', hora: '18:16', chat: 'Customer Success', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El segundo eje: el free tier se agota por CUENTA, no por proveedor',
    puntos: [
      'La app sabía guardar UNA key por proveedor, así que a alguien sin cuota le ofrecía como única salida **pegar de nuevo la key que ya estaba agotada**. Ahora hay hasta tres cuentas por proveedor gratis con claves derivadas (`GEMINI_API_KEY` / `_2` / `_3`), sin migración: para la tabla `credenciales` son filas más, con el mismo cifrado y la misma auditoría.',
      '⚠️ **Un eje nuevo no sirve si un solo camino no lo recorre.** «Claude es el último recurso» estaba cerrado en `chatClaude` y **abierto en `chatCheapTools`**: el tool-use probaba UN proveedor y se iba derecho a Sonnet. Lo mismo con cinco `chatCheap` sueltos que no rotaban, dos de ellos cayendo a Claude por no poder escribir un título. Cuando le agregues una dimensión a la cascada, la pregunta no es «¿anda?» sino **«¿cuántas funciones entran a este motor, y las toqué a todas?»**.',
      'Y el corte propio del tool-use: la cascada **no reintenta si el proveedor que falló ya ejecutó una herramienta**. Reintentar después de una escritura la duplicaría — el reintento es barato solo mientras la llamada sea pura.',
      '`lib/ia-keys.ts` nace **sin `server-only` a propósito**, que es el mismo criterio de todo lo que gobierna gasto en este repo: si la regla vive adentro del módulo que hace el trabajo sucio, ningún test la puede importar.',
    ],
    commits: [
      { sha: 'bee24ad4', msg: 'IA: rotar tambien entre CUENTAS del mismo proveedor, y cerrar los caminos sin cascada', lineas: 805, archivos: 20 },
    ],
    archivos: [
      'lib/ia-keys.ts — las claves derivadas por cuenta, sin server-only',
      'lib/ai-cheap.ts — `provsDe()` devuelve una instancia por cuenta cargada, y los cuatro caminos (chat, tool-use, STT y visión) iteran sobre eso',
    ],
  },
  {
    fecha: '12 ago', hora: '20:13', chat: 'Customer Success', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'No era el prompt: la misma llamada corrió en dos modelos y nadie lo eligió',
    puntos: [
      '**El hallazgo que define el área, y está MEDIDO.** La misma reunión, leída por dos workspaces con 65 segundos de diferencia: `ws1` corrió sus 7 partes en `gemini-flash-latest` → **74 % de precisión y 2 tareas inventadas**; `ws9` las suyas en `mistral-small-latest` → **46 % y 12 inventadas**. Mismo prompt, mismo transcript, misma versión del código. La tab /modelos-ia decía «Gemini» y **decía la verdad sobre la configuración**; lo que corrió fue otra cosa, y no había ninguna forma de enterarse.',
      '**El disparador era UNA línea:** `Promise.all(partes.map(...))` mandaba las 7 partes de ~19k tokens simultáneas contra una sola key. Un 429 así es inevitable, y **un 429 en la cascada barata no se reintenta: se degrada de proveedor.** La regla que queda: si troceás un input y mandás las partes en paralelo, **estás eligiendo el modelo peor sin saberlo**. Ahora van de a dos — ~70 s en vez de ~20 s, en un cron de madrugada donde el tiempo no lo paga nadie.',
      'De ahí sale `fallback?: ProvCascada[]` en el catálogo, y el criterio **no** es «esta feature es importante» sino **qué forma tiene su error**: si un modelo peor **rompe** (JSON inválido, una tool que no se llama), degradar es gratis porque se ve al toque y se reintenta; si **contesta mal** (un juicio, una clasificación, una extracción), la respuesta floja se ve exactamente igual que la buena, nadie la revisa, y el daño aparece semanas después como «esto funciona mal y no sé por qué».',
      'El mismo 429 explicó otro síntoma que se venía investigando por separado: `mako-guardian` del ws9 corrió sus 6 llamadas en mistral-small en esa misma ventana. **Un solo 429 degradó la lectura de la reunión Y el cruce que decide qué se esconde** — dos reportes distintos, un solo hecho.',
    ],
    commits: [
      { sha: '7af634be', msg: 'No era el prompt: la extracción corrió en mistral-small y la tab decía Gemini', lineas: 180, archivos: 7 },
    ],
  },
  {
    fecha: '12 ago', hora: '22:33', chat: 'Customer Success', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«No degrades» no era «pagá»',
    pedido: 'No utilices Claude, eso ya lo habíamos hablado!!!',
    puntos: [
      'Tenía razón, y la regla era vieja. `fallback: []` se había puesto tres horas antes para que `plan-fathom` y `mako-guardian` no se degradaran a mistral-small — y hacía caer a **Sonnet**. Corrido en plena tanda de 429 de Gemini, «no degrades» se convirtió en llamadas pagas **que encima fallaron por saldo**: costó plata y no leyó nada.',
      '**El error que dispara la cascada es casi siempre un 429**, o sea la cuota del minuto: el error más transitorio y más previsible que existe. La respuesta correcta no es cambiar de modelo NI abrir la billetera — es **esperar**. Ahora `fallback: []` **falla la llamada**, y fallar es barato porque el camino de reintento ya existe: la parte queda sin leer, el borrador no se cachea, la reunión no se cierra, y el próximo cron la lee con la cuota repuesta. Cero degradación, cero pesos, y el trabajo se hace igual.',
      '⚠️ **El corte se guarda en una variable y se lanza AFUERA del try.** Ese catch existe para «no hay registro → usá el default», y adentro se habría comido el throw: la llamada terminaba en Opus, que es **peor** que el Sonnet que se quería evitar. Un throw nuevo dentro de un catch viejo hereda una política que no es la suya.',
      'La otra mitad de la misma noche: Martín cargó tres cuentas de Cerebras y tres de OpenRouter para tener más cuota gratis y **las seis estaban muertas** — los ids de modelo hardcodeados habían caducado (`llama-3.3-70b` → 404; el de OpenRouter ya no era gratis). **Cargar una key que no sirve no da ninguna señal: la cascada la saltea y sigue de largo.** Dos proveedores enteros muertos sin que nada lo dijera. Los ids nuevos salieron de pedirle a cada API su catálogo real, no de adivinar, y se eligieron **por latencia medida**: un modelo de 120b que tarda 25 s en devolver UN token no es un respaldo, es otra forma de fallar.',
    ],
    commits: [
      { sha: '6f6138ab', msg: '«No degrades» no es «pagá»: un 429 se espera, no se compra', lineas: 213, archivos: 3 },
      { sha: '3435c9a3', msg: 'Seis de las keys nuevas estaban muertas: los ids de modelo habían caducado', lineas: 21, archivos: 1 },
    ],
    archivos: ['lib/ai-cheap.ts — el catálogo de ids por proveedor. ⚠️ Cerebras hoy NO suma nada: aun con el id correcto sus tres cuentas dan 402, no tienen tier gratis. El id queda para el día que alguna lo tenga'],
  },

  // ── 13 de agosto: el medidor mentía ────────────────────────────────────────
  {
    fecha: '13 ago', hora: '19:48', chat: 'Integraciones', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Tres cuentas no son un tanque de 750k: son tres tanques de 250k',
    puntos: [
      'Una clienta con TRES cuentas de Gemini veía «No hay IA para generar las razones» y, al lado, un panel que le decía **240,6k / 750,0k** — o sea que le sobraba el 68 % del día. Las dos cifras eran ciertas. Medido sobre sus datos: `cuenta 1: 241k tok → 96 %, SIN CUOTA · cuenta 2: 0 % · cuenta 3: 0 %`. Y como la cascada arranca siempre por la primera y solo salta cuando la anterior FALLA, todo el uso se apila en una sola.',
      '**La regla general, que de acá salió a AGENTS.md: un total solo se puede sumar si el recurso se puede MOVER DE LUGAR.** Plata en dos cuentas del mismo dueño, sí. Cuota diaria de dos API keys, horas de dos personas, espacio en dos discos que no están en RAID: no. Cuando no se puede mover, el total sirve para «cuánto consumí» y **nunca** para «cuánto me queda»: el estado sale del PEOR componente y el reparto se muestra.',
      'Y el corolario que se paga aparte: **rotar solo por error es pagar un peaje por llamada.** Si la primera cuenta está muerta, cada llamada gasta un 429 antes de llegar a la que tiene nafta — por eso `ordenarCuentas` arranca por la que sí tiene.',
      '⚠️ **La segunda mitad: el mensaje mentía, y en 2 de 4 lugares.** `avatares` y `entregable` ya distinguían «no hay key» de «hay key y falló»; la corrección se había aplicado **a mano**, así que quedaron afuera `generarRazones` (justo la pantalla del reporte) y `angulos-formatos`. El texto pasó a vivir SOLO en `lib/ia-mensajes.ts`, y ahora incluye **qué contestó cada cuenta** — eso existía únicamente en un `console.warn`, o sea en los logs de Vercel, que nadie lee y a los 60 minutos no existen.',
      'Descartado con evidencia, para que nadie lo vuelva a suponer: las 3 keys **no** comparten proyecto de Google (pingueadas una por una: 200 / 503 transitorio / 200). El diagnóstico obvio era el equivocado, y lo que hacía indiagnosticable el caso era el mensaje, no el motor.',
    ],
    commits: [
      { sha: 'c3e583e6', msg: 'IA: la cuota se mide POR CUENTA, y el error dice qué contestó cada una', lineas: 611, archivos: 16 },
    ],
    archivos: [
      'lib/ia-mensajes.ts — el único lugar donde se escribe lo que el usuario lee cuando la cascada falla',
      'tests/ia-mensajes.test.ts — falla si el literal vuelve a aparecer suelto en una pantalla, o si alguien arma un `error:` con el string vacío de la cascada sin pedir erroresOut',
    ],
  },
  {
    fecha: '13 ago', hora: '21:37', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El tope de cuentas pasa a 10, y por qué NO se puede sacar del todo',
    puntos: [
      'Pedido del dueño con el contexto de por qué: el free tier de Gemini son 250k tokens/día **por cuenta** y el ws1 consume ~860k, o sea entre 86 y 110 cortes por día medidos en la base. Subir el tope fue **una línea**, y el botón «Agregar otra cuenta» ya existía: el pedido no era crearlo, era que no se quedara sin campos en la tercera.',
      '⛔ **Y queda escrito en el código por qué no se puede quitar del todo.** La cadena `MAX_KEYS → clavesDe → CLAVES_EXTRA → ENVS_METODO` **ES la whitelist** que decide qué claves se pueden guardar. Reemplazarla por un patrón tipo `/_API_KEY(_\\d+)?$/` «para que no tenga tope» abre un agujero grave: `guardarCredencial` termina en `process.env[clave] = valor` y `cfgDe()` relee `CHEAP_BASE_URL` en CADA llamada — **una clave de más aceptada es todo el tráfico de IA de todos los inquilinos saliendo a otro host, con los Bearer adentro.**',
      '**El precio de subir el tope hay que pagarlo en la misma pasada.** `provsDe`/`cuentasDe` resolvían las cuentas con un `credWs` POR SLOT: con 3 eran 3 SELECT por proveedor, con 10 son 10 (hasta 50 por generación y otros 50 en cada pintada del gauge), casi todos para descubrir que la key no existe. De ahí `lib/ia-keys-ws.ts`: UNA query por workspace, cacheada **por request** con `cache()` de React — **nunca `unstable_cache`**, que es cross-request, y cachear qué credenciales tiene cada inquilino es una fuga esperando a pasar.',
      'El email de cada cuenta es **manual, y no por vagancia**: verificado ese día en los cinco proveedores, **ninguno expone el dueño de una key** (Gemini lo dice por escrito, porque la key cuelga de un PROYECTO y no de una persona). Prometer un autocompletado que no existe era peor que pedir que se escriba una vez.',
      'En la misma tanda, `closing` bajó de Opus a Sonnet por decisión del dueño (~60 % menos) — **y lo que hacía el cambio invisible**: la fila de `closing_analyses` guardaba `model: ANALYSIS_MODEL`, una constante hardcodeada. La tabla iba a seguir diciendo `claude-opus-4-8` para siempre aunque corriera Sonnet, y **cualquier degradación futura —un override mal puesto, la cascada cayendo— quedaba indetectable en los datos**. Ahora viaja el modelo REAL, leído del callback de uso de la llamada.',
    ],
    commits: [
      { sha: '0a4deddb', msg: 'El analisis de llamadas baja de Opus a Sonnet (decision del dueño)', lineas: 27, archivos: 2 },
      { sha: '85a020b8', msg: 'Cuentas de IA: el tope pasa a 10 y cada key dice de que email es', lineas: 190, archivos: 8 },
    ],
    archivos: ['lib/ia-keys-ws.ts — una query por workspace, cacheada por REQUEST; si la lectura falla cae al catálogo entero, o sea degrada al comportamiento viejo'],
  },

  // ── 14 de agosto: el veto ──────────────────────────────────────────────────
  {
    fecha: '14 ago', hora: '22:10', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Claude vetado: no había una puerta, había cinco',
    puntos: [
      'El pedido, textual (Martín, 13/8): **«Que ya no se pueda gastar con Claude directamente, que se prohíba.»** Lo difícil no era prohibir: era que **cerrar cuatro puertas deja la quinta**, y eso ya había pasado — el `fallback: []` del día anterior tapó dos y las otras tres siguieron cobrando US$12,79.',
      'Las cinco: el `def` pago del catálogo · el fallback pago de `chatClaude` · el de `chatClaudeTools` (que ni consultaba `fallbackDeFeature`) · un `opts.model` explícito (US$8,67, saltea el registro entero) · y el `MODEL` del módulo cuando la feature no estaba registrada. **La quinta es la peor y explica la forma de la solución:** escribir `chatClaude` sin registrar la feature era el camino de MENOS esfuerzo y el MÁS caro (Opus), y en el diff se leía bien.',
      '**Las cinco terminan en el mismo `fetch`. El veto vive ahí y en ningún otro lado.** `lib/anthropic.ts` se queda SIN `MODEL` y SIN `ENDPOINT`: la URL sale de `permiso.endpoint`, así que **un fetch a Claude escrito por afuera del veto no tipa**, y no hay modelo por default — si no se resuelve, la salida honesta es fallar, no elegir el caro.',
      'Tres cosas para que el veto no se apague solo: **(a)** la lista blanca vive en CÓDIGO, no en `app_settings` — la asimetría es el diseño, bloquear es instantáneo y desbloquear necesita commit, pre-push y deploy, mientras que en `app_settings` se desarmaba con un script de tres líneas; **(b)** los permisos **vencen**, y el test avisa 14 días antes, porque una excepción sin fecha es una excepción para siempre que nadie vuelve a mirar; **(c)** el bloqueo se **registra**, no se loguea: una fila de US$0 y 0 tokens en el mismo gráfico que mira el dueño, con el motivo escrito, porque **un veto que funciona y un veto que nadie disparó se ven iguales**.',
      '`experimentos` y `lead_insights` **no** entraron a la lista, y no fue un olvido: las dos tenían `pagoPorque` escrito y ninguna corría desde julio. **Una autorización que nadie usa es una que nadie revisa** — el día que alguien la prenda paga Opus sin que nadie lo haya decidido. Bajaron a Gemini.',
      'Y el interruptor de pánico (`mako.claude.pausa`) va en UNA sola dirección: puede apagar, nunca encender. Si Supabase se cae el resultado es «no pausado», y eso no abre nada porque **lo que autoriza es la lista de código**. Un store que puede fallar solo tiene permitido hacer las cosas más restrictivas.',
      '⚠️ El test encontró **tres scripts que le pegan a Anthropic por afuera**. Corren a mano con la key del dueño, así que no se vetan — pero quedan LISTADOS, para que un script nuevo que copie ese `fetch` aparezca en el diff en vez de pasar callado.',
    ],
    commits: [
      { sha: 'e951aba5', msg: 'Claude vetado: no había una puerta, había cinco', lineas: 497, archivos: 6 },
    ],
    archivos: [
      'lib/veto-claude.ts — la única puerta; `CLAUDE_PERMITIDO` con modelo, fecha de vencimiento y quién lo pidió',
      'tests/veto-claude.test.ts — caza el casteo a propósito y avisa 14 días antes de cada vencimiento',
    ],
  },

  // ── 16 de agosto: el tercer eje ────────────────────────────────────────────
  {
    fecha: '16 ago', hora: '19:38', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La rotación tenía dos ejes y faltaba el tercero: Google tenía caído el modelo que fijamos',
    puntos: [
      'Con un cliente esperando: sube 4 documentos al Archivero y «No se pudo procesar nada de lo que subiste». Uno de los cuatro avisos decía «Se quedó sin cuota». **Falso, y el diagnóstico obvio estuvo equivocado dos veces.** La key era nueva, recién creada. Medido con la key REAL y el mismo payload de 24k caracteres: `gemini-flash-latest` (el que fija `MODELO_DOCS`) → **503 «high demand», persistente**; `gemini-2.5-flash` → 404 «no longer available to new users»; `gemini-flash-lite-latest` → **200, perfecto**.',
      'O sea: Google tenía caído el alias que la app fija y **al lado, en la MISMA cuenta, había un modelo sano**. Los dos ejes que existían —cuenta y proveedor— no sirven para esto: probaban las N cuentas contra el mismo modelo muerto y se rendían con el resto del catálogo del proveedor intacto. Con **un solo proveedor cargado**, que es el estado normal de un cliente recién dado de alta, eso es **quedarse sin IA teniendo IA**.',
      '⚠️ **La trampa de medición que casi lo tapa:** se probó la key con un `"di ok"` y dio 200 tres veces seguidas. Un request chico pasa; uno de 9.400 tokens no. Se midió la KEY cuando el que fallaba era el MODELO. **Si vas a descartar «es la key», el request de prueba tiene que tener el TAMAÑO del real.**',
      'De ahí `MODELOS_RESPALDO`, con dos detalles que no son adorno: **un 404 no se reintenta ni un segundo** (un modelo retirado no vuelve, se salta derecho al siguiente, que es para lo que existe la lista), y **en la lista no van ids con número de versión** — Google los retira solos, así que solo alias `-latest`, que no envejecen. Que el respaldo sea más flojo es correcto y deliberado: solo entra cuando el bueno no está, y ahí la alternativa no es una respuesta peor sino NINGUNA.',
      '**El mensaje mandaba a arreglar lo que no estaba roto.** `motivoDeErroresCascada` no tenía caso para 503: los tres primeros documentos caían al genérico y el cuarto matcheaba `\\b429\\b` por un rate-limit suelto de la misma tanda → «sin cuota». La diferencia es accionable y **opuesta**: la cuota se arregla cargando otra key o pagando, **la saturación se arregla esperando**. Mandar a alguien a comprar créditos por un bache del proveedor es el peor consejo posible. Y esa función —pura, la que decide qué lee la persona— vivía adentro de `lib/ai-cheap.ts`, que tiene `server-only`: **lo único sin red era justo lo que le habla al usuario**. El test viejo hasta tenía el bug congelado.',
      '**Cuánto insistir depende de si hay a dónde caer.** Con otra cuenta o proveedor esperando, un reintento y a otra cosa: seguir golpeando al que falla es tiempo que el usuario mira una pantalla quieta. Cuando es el ÚLTIMO recurso, tres con espera creciente (1,5 s · 4 s · 9 s).',
      'El cierre del día vino de un pedido del dueño —«no puede ser que se exceda la quota durante el onboarding, y en dicho caso debería ahí mismo saltar la opción de dejarle otra key, como ya tenemos configurado»— y **estaba configurado**: `ConectarIA` vivía enchufado en una sola pantalla. ⚠️ Y aunque hubiera estado puesto en las tres, **no se habría dibujado nunca**: el detector era un regex suelto que buscaba «cuota» y lo que Google manda es **«quota»**. Dos fallas encadenadas que se tapaban entre sí. Al leer por fin el error completo apareció el diagnóstico de fondo: `limit: 20, model: gemini-3.7-flash` — el free tier de ese modelo son **veinte** requests, y un onboarding con 6 documentos y varias fotos se lo come solo. **No es un cliente que usa de más: es el modelo equivocado para el trabajo.**',
    ],
    commits: [
      { sha: '2601639b', msg: 'No era la cuota: era Gemini saturado, y el mensaje mandó a buscar lo que no existía', lineas: 96, archivos: 3 },
      { sha: 'd2081f2b', msg: 'Rotar el MODELO, no solo la cuenta: Google tenía caído el que la app fija', lineas: 49, archivos: 1 },
      { sha: '740bc35f', msg: 'La salida para cargar otra key estaba configurada. En UNA sola pantalla', lineas: 349, archivos: 7 },
    ],
    archivos: [
      'lib/ai-cheap.ts — `MODELOS_RESPALDO`, `modelosAProbar`, y la rotación de modelo extendida al camino de VISIÓN (`leerDocumentoIA`), que es el que falló acá porque la cara de marca son fotos',
      'lib/ia-mensajes.ts — `motivoDeErroresCascada` y `esErrorDeIA`, puros, con el error TEXTUAL que vio el cliente como test',
      'app/_components/ErrorIA.tsx — error y salida juntos; hay guarda que falla si alguna de las tres pantallas deja de importarla',
    ],
  },
  {
    fecha: '7 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Otra nota de voz perdida: «esto tiene que funcionar bien»',
    pedido: 'Envié esto por el grupo y otra vez el problema de la API... Realmente tenemos que solucionarlo, no puede ser que sea tan limitado. Si hay que eliminar Gemini o hacer cambios radicales, dime, pero esto tiene que funcionar bien...',
    puntos: [
      'Con la captura del grupo de Código Inmobiliario: «Me llegó tu audio pero no lo pude escuchar… Tienes una sola API key cargada… Carga una segunda (son gratis)».',
    ],
  },
  {
    fecha: '7 oct', hora: '19:26', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El audio no tenía el tercer eje ni la red: Google saturado era una nota de voz perdida',
    puntos: [
      '⚠️ **El diagnóstico que daba el propio mensaje era el equivocado.** No era «una sola key»: los logs dicen `HTTP 503: This model is currently experiencing high demand`, Google sin capacidad para `gemini-flash-latest`. Otra key de Gemini le pega al mismo Google; otro MODELO no — medido esa noche, `gemini-flash-lite-latest` contestaba en 560 ms.',
      '⚠️ **Y ya había pasado el 16/8 con los documentos**, que es de donde nació `MODELOS_RESPALDO`. La rotación por modelo existía; el audio tiene su propio loop de proveedores y nunca la recibió. Una resiliencia escrita en un camino no protege a los que no pasan por él.',
      '**La red de plataforma, también para el audio**: si las keys del negocio no pudieron, escucha con las gratis de la agencia, Groq primero (otro servicio). Verificado de punta a punta en el ws3: «escuchó con la RED DE PLATAFORMA (groq)».',
      '**Y el mensaje ya no pide la key equivocada**: un proveedor saturado es «no es nada tuyo». Los errores de la red viajan separados de los del cliente.',
      '**A «¿hay que eliminar Gemini?»: no.** Es la key gratis que carga cada cliente; el problema era depender de un modelo de un proveedor sin red.',
    ],
    commits: [
      { sha: 'c67ca07c', msg: 'Notas de voz: si Gemini está saturado, otro modelo; si no alcanza, la red de la agencia', lineas: 271, archivos: 5 },
      { sha: 'f082860e', msg: 'Notas de voz: los modelos de respaldo salen de MODELOS_RESPALDO, no de una lista propia', lineas: 24, archivos: 2 },
    ],
    archivos: [
      'lib/ai-cheap.ts — `transcribirAudio` con las tres redes y `escucharCon`',
      'lib/fallo-ia-texto.ts — `esSaturacion`: un saturado no pide otra key',
      'tests/stt-red.test.ts — doce roturas probadas',
    ],
  },
  {
    fecha: '7 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El grupo de Brigitte: sin cuota a la segunda pregunta',
    pedido: 'Revisa el grupo de brigitte, sigue con el problema de los token de IA apenas haciendo 1 consulta... Eso es muy molesto, realmente tenemos que solucionarlo, ya creo que habré enviado como 10 prompts intentando iterar esto... Por favor solucionalo, proponme una solución definitiva...',
    puntos: [
      'En el grupo (una sola key, la de Gemini): MaKo contestó la primera pregunta y a la segunda dijo «Te quedaste sin cuota de IA… Tu API key llegó al tope».',
    ],
  },
  {
    fecha: '7 oct', hora: '22:41', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El 429 era el del MINUTO, y se tiraba el turno con seis pasos hechos',
    puntos: [
      '**Medido:** una pregunta con herramientas son 6 a 8 pedidos de ~15.000 tokens (el loop re-manda la conversación en cada paso). La segunda hizo 6 en 13 s y el séptimo volvió 429; 57 minutos después la misma key contestaba 200. No era el cupo del día.',
      '⚠️ **Lo que tiraba el turno era una regla de agosto, «nunca reintentar después de una tool».** Vale para RE-ARRANCAR el turno con otro proveedor, que vuelve a correr las tools; repetir el pedido que falló no ejecuta nada. Por eso el séptimo paso descartaba los seis anteriores, y el modelo de respaldo —con su propio cupo— no se probaba nunca en este camino.',
      '**Cada pedido que falla decide en `crearRotacion`**: otro modelo de la misma key, y si no queda, la espera que dice Google (hasta 30 s, una vez, sólo en la última cuenta del cliente). Verificado contra Google: un modelo inexistente rotó solo a `flash-lite`, usó la herramienta y contestó en 3,8 s.',
      '⚠️ **Gemini manda el error en un ARRAY** y se leía `data.error`: todo llegaba como «HTTP 429» pelado. Y **Groq gratis no puede con el doer en ningún modelo** (8.000 tokens por minuto contra pedidos de 13-16 mil): la red de la agencia para el doer es sólo Gemini.',
      'Quedan para decidir: bajar los tokens por pregunta (la palanca grande), que la red de la agencia no re-arranque de cero, que el mensaje pida una key «de otra cuenta de Google» y un último recurso pago.',
    ],
    commits: [
      { sha: 'af3530c2', msg: 'MaKo con una sola key: un 429 a mitad de la pregunta se cubre con el otro modelo, no tira el turno', lineas: 541, archivos: 5 },
    ],
    archivos: [
      'lib/ia-rotacion-modelo.ts — `crearRotacion`, `leerErrorProveedor`, `tipoDeFallo` (puro, con test)',
      'lib/ai-cheap.ts — `chatCheapTools` rota de modelo en cada paso y el `fetch` va adentro del `try`',
      'lib/mako-doer-in.ts — la última cuenta del cliente espera la cuota del minuto',
      'tests/ia-rotacion-modelo.test.ts — ocho roturas probadas',
    ],
  },
];
