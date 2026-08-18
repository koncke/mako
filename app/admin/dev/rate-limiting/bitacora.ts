// =============================================================================
// Rate Limiting — el registro de construcción del área
// =============================================================================
// Alcance: el limitador en memoria (`lib/rate-limit.ts`), best-effort y por
// instancia serverless, y la única ruta de toda la app que lo usa: el beacon
// público del VSL (`app/api/track/vsl/route.ts`), con dos cubetas —
// `vsl:<ip>` 300/min y `vslstamp:<ip>` 15/min. Ningún otro endpoint tiene techo.
//
// ⚠️ Leído entero, este registro cuenta una sola cosa, y no es lo que se hizo:
// **el limitador no cambió desde el 2 de julio, y lo que limita cambió mucho.**
// Los topes que SÍ se escribieron en agosto viven en el emisor —el snippet de
// `lib/landing-token.ts`— y no en el limitador. Por eso el área declara ese
// archivo: si no, su panel de historial no vería ni uno de los commits en los
// que el área realmente se movió.
//
// De dónde salió esto: fecha, hora, sha y tamaño de `git log` sobre las rutas del
// área (`git log -L` sobre la línea del `rateLimit` para saber cuándo se tocó por
// última vez); el `pedido` es textual y está citado dentro de un script del repo
// (scripts/consolidar-borradores.ts, «el riesgo que nombró Martín textual»); el
// nombre de la sesión, de docs/chats.md — que hoy llega hasta el 8/8, así que de
// ahí en adelante va «—» en vez de un nombre inventado.
//
// NO es un changelog: va el motivo, la trampa y lo que quedó sin hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El limitador en memoria', detalle: 'Ventana fija por clave, limpieza perezosa a los 10.000 buckets · el propio módulo avisa que es best-effort y muere en cada cold start', estado: 'hecha' },
  { titulo: 'Las dos cubetas del beacon', detalle: '`vsl:<ip>` 300/min contra el flood, `vslstamp:<ip>` 15/min contra el secuestro de atribución · responde 200 ok:false para no dar señal ni romper la landing del cliente', estado: 'hecha' },
  { titulo: 'Los topes del EMISOR', detalle: '40 clicks por carga y 10 idas y vueltas por sesión, escritos en el snippet · son los únicos límites nuevos de agosto, y no pasan por el limitador', estado: 'hecha' },
  { titulo: 'Techo en las rutas que gastan IA', detalle: 'La propuesta está escrita (clave por workspace y usuario, no por IP; un helper único en vez de copiar la llamada seis veces) y ninguna ruta lo tiene todavía', estado: 'cola' },
  { titulo: 'Tope de body por ruta', detalle: 'next.config.ts sube el global a 20 MB por los adjuntos de WhatsApp, así que el tope va POR RUTA · hoy /api/ads-writer acepta cualquier tamaño y lo manda a un modelo', estado: 'cola' },
  { titulo: 'Un store compartido (Upstash/Redis)', detalle: 'Sin esto no hay tope duro: el estado no se comparte entre instancias de Vercel y se pierde en el cold start', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── julio: el limitador nace, y nace en dos rutas ──────────────────────────
  {
    fecha: '2 jul', hora: '05:07', chat: 'Auditoría de seguridad y performance con gstack', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Nace el limitador, y nace enchufado en DOS rutas',
    puntos: [
      'Salió de una auditoría, no de un incidente, y las dos cubetas del beacon contestan riesgos distintos: `vsl:<ip>` a 300/min es **anti-flood** (que nadie engorde `vsl_events` ni envenene las métricas de un cliente), y `vslstamp:<ip>` a 15/min es **más duro a propósito** porque el stamp cose un `visitor_id` a un lead — ahí el abuso no ensucia un número, **secuestra una atribución**.',
      'La decisión de forma que sigue viva: cuando el limitador corta, **el beacon responde `200 { ok:false }`**, no un 429. Es una ruta pública embebida en la página de un cliente: un error visible da señal al que prueba y, peor, puede romperle la landing a alguien que no tiene nada que ver.',
      '⚠️ **El módulo dice de entrada lo que NO es**, y hay que leerlo antes de apoyarse en él: el estado es un `Map` en memoria, **no se comparte entre instancias de Vercel y se pierde en cada cold start**. Alcanza para cortar un flood trivial desde una misma IP; para un tope duro hace falta un store compartido. Un limitador best-effort que se cita como si fuera una defensa es exactamente cómo se firma un control que no controla.',
      'La otra ruta que nació con límite fue el login por contraseña, contra fuerza bruta — y ahí empieza la parte que nadie decidió (ver el hito de abajo).',
    ],
    commits: [
      { sha: '7ee06bb1', msg: 'fix(seguridad+perf): remedia hallazgos medium/low de la auditoría + gaps transversales', lineas: 373, archivos: 22 },
    ],
    archivos: [
      'lib/rate-limit.ts — 40 líneas: `rateLimit(key, max, windowMs)` y `clientIp(req)` leyendo el x-forwarded-for del proxy de Vercel',
      'app/api/track/vsl/route.ts — las dos cubetas, arriba de todo, antes de parsear el body',
    ],
  },
  {
    fecha: '17 jul', hora: '00:02', chat: 'Tab de Integraciones con BYOK', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'De dos rutas limitadas a una, y nadie tomó esa decisión',
    puntos: [
      '**El área se encogió a la mitad como efecto secundario de otro cambio.** El login pasó a ser solo Google y con él se borró `app/api/auth/login/route.ts`, que traía `rateLimit(\'login:\' + clientIp(req), 10, 60_000)`. El limitador no se sacó: **desapareció la ruta que lo usaba**. Desde ese día hay un solo `import` de `lib/rate-limit.ts` en todo el repo.',
      '**La regla que queda, y vale para cualquier control transversal:** cuando borrás una ruta, mirá qué guardas se van con ella. Un control aplicado en N lugares no tiene dueño; lo único que dice cuántos quedan es un `grep`, y ningún test se pone rojo cuando el número baja.',
      'Que en este caso el saldo neto sea aceptable —el login por Google no se ataca por fuerza bruta y `/login` es la única excepción del sistema de sesión— es una conclusión que hay que **sacar mirando**, no una que el cambio haya afirmado. Sigue estando bien porque alguien lo revisó después, no porque estuviera decidido.',
    ],
    commits: [
      { sha: '0a949f64', msg: 'Login: solo Google. Se van la cookie compartida, la contraseña maestra y la rama v1 del cifrado', lineas: 178, archivos: 12 },
    ],
  },

  // ── agosto: el pedido, y los topes que se escribieron en otro lado ─────────
  {
    fecha: '5 ago', hora: '19:34', chat: '—', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El riesgo, dicho por el dueño, y lo que quedó como propuesta',
    pedido: 'que entre un hacker y comience a mandar muchísimas cosas y rompa toda la app',
    puntos: [
      'Quedó escrito en dos tarjetas del board (`scripts/consolidar-borradores.ts` y `scripts/proponer-seguridad-legal.ts`), y las dos siguen **sin código**. Son la parte «cola» del área, con el alcance ya decidido para no volver a discutirlo.',
      '**La clave del límite va por workspace y usuario, NO por IP.** El login está cerrado por allowlist, así que esto no es internet abierto: el escenario real no es un atacante anónimo, es **una sola sesión comprometida** (un setter de un cliente, una cookie robada) disparando llamadas a Claude sin techo contra la key de la agencia. Limitar por IP no contesta esa pregunta.',
      'El orden propuesto de rutas —`ads-writer`, `mako-doer`, `campaign-suggest`, `closing/analyze`, `ads-analyst/analyze`, `plan-fathom`— con **un helper único** (`lib/ia-guard.ts`), para no copiar la llamada seis veces: seis copias garantizan que la séptima nazca sin límite.',
      'Y la mitad que suele olvidarse: **un tope de pedidos no protege del pedido GRANDE.** `/api/ads-writer` hace `await req.json()` sin límite y manda el texto a `chatClaude` con `thinking:true` y `maxTokens:12000`. Un solo request con 5 MB de texto no es un error: es una factura. El tope de body va **por ruta**, porque `next.config.ts` sube el global a 20 MB por los adjuntos de WhatsApp.',
      '⚠️ Límite conocido y aceptado de antemano: aunque se escriba todo esto, el limitador de hoy sigue siendo **por instancia**. Corta una ráfaga; el tope duro de gasto es otra tarea, la del presupuesto pre-flight (ver el área `ai-spend-cuotas`).',
    ],
    commits: [
      { sha: '55370d2f', msg: 'Al ruteador nunca le llegaba el detalle: veía cinco títulos sueltos', lineas: 522, archivos: 9 },
    ],
    archivos: [
      'scripts/proponer-seguridad-legal.ts — «Límite de pedidos por minuto en las rutas que llaman a la IA» y «Tope de tamaño en todo lo que entra a un prompt»',
      'scripts/consolidar-borradores.ts — «Límite de pedidos y tope de body en la puerta del agente», con la cita textual',
    ],
  },
  {
    fecha: '14 ago', hora: '14:39', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El primer tope nuevo en un año se escribió en el emisor, no en el limitador',
    puntos: [
      'El Pixel v6 empezó a medir clicks, y con eso llegó un tope: **40 por carga de página**, porque un carrusel manda cientos y el ruido tapa lo que importa. **Ese tope no pasa por `lib/rate-limit.ts`: vive adentro del snippet**, o sea en el HTML de la página del cliente.',
      '**Y está bien que viva ahí, por una razón que conviene tener escrita:** el limitador corta por IP y en el servidor, o sea después de pagar la request; el tope del emisor corta antes de que el evento exista. Para telemetría de alto volumen, **el lugar barato de limitar es el que produce, no el que recibe**. El limitador queda para lo que el emisor no controla: el que manda al beacon sin pasar por el snippet.',
      '⚠️ **El costado que sí es del área, y que nadie revisó:** la lista blanca de tipos de evento del beacon pasó de cinco (`play`, `exit`, `pNN`, `sNN` y el pageview) a **diez** entre la v6 y la v14 — click, pausa, retoma, fin, agendó, salió, volvió, cierre. Los dos números de las cubetas —300 y 15— **son los del 2 de julio y nunca cambiaron**: un `git log -S` sobre esas dos líneas devuelve un solo commit, y el único posterior que las toca las reescribió de tres renglones a uno. El número no está mal por sí solo, pero **es un umbral y hoy es un umbral sin medir**: nadie contó cuántos eventos genera una visita real con la v14 puesta. Y AGENTS.md ya tiene escrito qué se hace con eso — un umbral se corre contra los datos que ya tenés y se cuentan los falsos positivos.',
      'De la misma tanda, la trampa de contrato: el beacon tenía la lista blanca y **sumar el tipo nuevo ahí es obligatorio** — sin eso el evento entra como `desconocido` y se pierde con un nombre que no dice nada. Antes de eso caía a `play` en silencio, e infló los plays sin dejar rastro.',
    ],
    commits: [
      { sha: '663b32e7', msg: 'landing v6: se miden los clicks — el CTA y el link de WhatsApp eran invisibles', lineas: 131, archivos: 5 },
    ],
    archivos: [
      'lib/landing-token.ts — el snippet; `var CLICKS = 0` con el corte en 40, y la lista `CONOCIDOS` del lado del receptor en app/api/track/vsl/route.ts',
    ],
  },
  {
    fecha: '16 ago', hora: '10:34', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Diez idas y vueltas: un tope que existe por la LECTURA, no por el abuso',
    puntos: [
      'El Pixel v14 separó tres eventos que estaban confundidos —`salio`, `volvio` y `cierre`— y le puso un tope de **10 idas y vueltas por sesión**. El motivo está escrito al lado y no es defensivo: alguien que trabaja con muchas pestañas genera decenas por sesión, y **a partir de ahí el dato no agrega nada y tapa el resto de la lista**.',
      '**Es la distinción que ordena el área: hay topes que protegen el sistema y topes que protegen la LECTURA, y no se diseñan igual.** Uno se calibra contra lo que aguanta la infraestructura y corta con un error; el otro se calibra contra lo que una persona puede leer y corta **en silencio**, quedándose con lo primero. Meterlos en la misma pieza es cómo se termina cortando datos buenos para ahorrar CPU que sobraba.',
      '⚠️ Y la trampa del navegador que hay detrás: **al cerrar una pestaña llegan LOS DOS eventos** — primero `visibilitychange` y después `pagehide`. No se puede saber de antemano cuál va a pasar, así que **no se adivina**: se manda lo que ocurrió y la lectura ordena (un `salio` sin `volvio` seguido de `cierre` es un cierre; un `salio` con `volvio` es una interrupción). Un limitador que hubiera descartado el segundo evento por «duplicado» habría borrado justo la señal.',
      'Estado del área al cerrar la tanda: `lib/rate-limit.ts` sigue igual que el 2 de julio, con **un solo `import` en todo el repo**, y las tres partes en cola siguen en cola.',
    ],
    commits: [
      { sha: '6d2c4e96', msg: 'pixel v14: salir de la pagina, volver y cerrar son tres eventos distintos', lineas: 93, archivos: 4 },
    ],
    archivos: [
      'lib/landing-token.ts — `var CAMBIOS = 0` con el corte en 10, y el porqué escrito arriba',
      'app/api/track/vsl/route.ts — las dos cubetas, con los mismos números del 2/7',
    ],
  },
];
