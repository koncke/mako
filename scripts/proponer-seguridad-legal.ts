// =============================================================================
// proponer-seguridad-legal — el borrador con lo que salió de la auditoría
// =============================================================================
// NO inserta tareas: crea un borrador y devuelve el link. El ruteo y la puntuación
// los hace el pipeline (skill plan-tareas).
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/proponer-seguridad-legal.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { crearPropuesta } from '../lib/plan-propuesta';
import { getSupabaseServer } from '../lib/supabase';
import { APP_BASE_URL } from '../lib/app-url';

const TAREAS = [
  {
    titulo: 'Sacar el curso AVATARHYPE del JavaScript que baja el navegador',
    proyecto: 'Conocimientos',
    detalle: `**Qué hay que hacer**
Que el contenido del curso deje de viajar en un archivo público de JS y pase a bajar por el servidor, autenticado.

**Por qué**
\`app/conocimientos/curso.ts\` pesa 1.650.339 bytes —transcripciones, prompts de los GPTs y la metodología entera— y lo importa \`Conocimientos.tsx\`, que es \`'use client'\`. Todo lo que entra a un componente de cliente termina en \`.next/static/chunks/\`, y el matcher del gate de sesión (\`proxy.ts:244\`) excluye \`_next/static\` a propósito: esos chunks se sirven SIN sesión, a cualquiera que tenga la URL. Hoy son 1,59 MB de tu formación descargables sin login.

**Detalles concretos**
El patrón que hay que copiar ya funciona acá: \`app/compartido/[token]/page.tsx:18\` importa los cursos en un server component y le pasa el elegido como PROP al componente de cliente. Hacer lo mismo: mover el import de \`./curso\` de \`Conocimientos.tsx\` a \`app/conocimientos/page.tsx\` —que ya gatea con \`getSesionAdmin\`— y pasar los cursos por props.
OJO: no romper \`/compartido/<token>\`, que ya está del lado del servidor.

**Listo cuando**
Después de un build limpio, \`grep -rl "AVATARHYPE" .next/static\` no devuelve ningún archivo; /conocimientos funciona igual y un link /compartido sigue mostrando el portal completo.`,
  },
  {
    titulo: 'Regla: ningún dato del negocio adentro de un componente de cliente',
    proyecto: 'Seguridad y multi-inquilino',
    detalle: `**Qué hay que hacer**
Escribir la regla en AGENTS.md y poner un centinela que la haga cumplir antes de cada push.

**Por qué**
El curso no fue un descuido aislado: \`app/plan/PlanBoard.tsx:86\` tiene el roadmap completo con scores, razones del Perro y el detalle de los agujeros de seguridad, dentro de un \`'use client'\` — y se encontró literalmente en un chunk público. La regla que falta es una sola línea, y sin centinela se vuelve a romper la próxima vez que alguien importe algo grande desde el lado equivocado.

**Detalles concretos**
El centinela NO puede grepear \`.next/static\`: el hook \`.git/hooks/pre-push\` corre solo \`npm run typecheck\`, no hace build, así que grepear ahí daría verde falso contra un \`.next\` viejo. Tiene que trabajar sobre el FUENTE: un \`scripts/check-client-leaks.mjs\` que, para cada archivo con \`'use client'\`, resuelva sus imports relativos transitivos y falle si alguno está en una lista negra (hoy: \`app/conocimientos/curso.ts\`, \`curso-vsl.ts\`, \`PlanBoard.tsx\`). Corre en segundos y se engancha al pre-push junto al typecheck.
Contexto que NO hay que rehacer: \`app/plan/page.tsx:34\` ya redirige a /plan/agencia justamente para que el chunk del roadmap no entre al bundle de los clientes.

**Listo cuando**
El script existe, corre en pre-push, falla a propósito si se le agrega un import prohibido a un \`'use client'\`, y la regla está en AGENTS.md junto a la advertencia de que el hook no se versiona.`,
  },
  {
    titulo: 'Límite de pedidos por minuto en las rutas que llaman a la IA',
    proyecto: 'Seguridad y multi-inquilino',
    detalle: `**Qué hay que hacer**
Ponerle un tope de pedidos por minuto a las rutas que gastan IA, con la clave por workspace y usuario, no por IP.

**Por qué**
El limitador ya existe (\`lib/rate-limit.ts:18\`) y se usa en UNA sola ruta de toda la app: el beacon del VSL. Todo lo demás no tiene ninguno. El login está cerrado por allowlist, así que esto no es internet abierto — pero una sola sesión comprometida (un setter de un cliente, una cookie robada) dispara llamadas a Claude sin techo contra la key de la agencia.

**Detalles concretos**
Rutas por orden: \`ads-writer\`, \`mako-doer\`, \`ads-manager/campaign-suggest\`, \`closing/analyze\`, \`ads-analyst/analyze\`, \`plan-fathom\`. Conviene un helper único (\`lib/ia-guard.ts\`) para no copiar la llamada seis veces.
Límite conocido y aceptado: el propio \`lib/rate-limit.ts:4-8\` avisa que el estado es por instancia y no se comparte entre ellas. Alcanza para cortar una ráfaga; el tope duro de gasto es la otra tarea, la del presupuesto diario.

**Listo cuando**
100 pedidos seguidos a /api/ads-writer desde una sesión de cliente devuelven 429 antes del número 20.`,
  },
  {
    titulo: 'Tope de tamaño en todo lo que entra a un prompt',
    proyecto: 'Seguridad y multi-inquilino',
    detalle: `**Qué hay que hacer**
Que ningún texto que venga de afuera llegue a un modelo sin un largo máximo, y que ninguna ruta acepte un body sin tope.

**Por qué**
\`app/api/ads-writer/route.ts:18\` hace \`await req.json()\` sin límite y la línea 21 toma \`body.prompt\` sin recortarlo, con \`maxDuration = 120\`. Ese texto va directo a \`chatClaude\` con \`thinking:true\`, \`effort:'high'\` y \`maxTokens:12000\` contra la key de la agencia. Un solo pedido con 5 MB de texto no es un error: es una factura.

**Detalles concretos**
El choke point natural es \`contenidoNoConfiable()\` (\`lib/prompt-render-pure.ts:28\`): hoy neutraliza la inyección de plantilla y el cierre de etiqueta, pero NO recorta — no tiene parámetro de largo. Agregarle un \`maxChars\` con default sano.
Precedentes del repo para copiar el criterio: \`lib/fathom-api.ts:232\` (\`transcriptToText(..., maxChars = 16000)\`) y \`lib/onboarding.ts:103\`.
OJO: \`next.config.ts:29\` sube \`proxyClientMaxBodySize\` a 20mb por los adjuntos de WhatsApp, así que el tope de body va POR RUTA, nunca global.

**Listo cuando**
Un pedido de 5 MB a /api/ads-writer se corta con 413 antes de llamar al modelo.`,
  },
  {
    titulo: 'Evolution: sacar el secreto de la URL y comparar en tiempo constante',
    proyecto: 'Seguridad y multi-inquilino',
    detalle: `**Qué hay que hacer**
Mover el secreto del webhook de WhatsApp de la query string a un header, y compararlo con \`timingSafeEqual\` como ya hacen los otros webhooks.

**Por qué**
\`app/api/webhooks/evolution/route.ts:72\` lo lee de \`?secret=\` y lo compara con \`!==\`. Un secreto en la query queda en los logs de Vercel, en proxies y en historiales. Los otros cinco webhooks ya lo hacen bien: chatwoot y meta-leads usan \`crypto.timingSafeEqual\`, calendly y resend verifican HMAC/Svix.

**Detalles concretos**
Esto NO es cambiar una línea del route: la URL con el secreto la genera el CÓDIGO (\`webhookUrl()\` en \`lib/evolution.ts:70\` y \`setWebhook()\` en :89), y la salud del canal depende de esa URL (\`pingReceiver()\` postea con el secreto en query y \`estadoWebhook()\` lee el 401 como señal). Cambiar solo el route deja a TODOS los workspaces reportando WhatsApp roto.
Orden: (1) verificar PRIMERO si el Evolution en uso (contrato v2.3.7) acepta \`headers\` en el body de \`/webhook/set\`; si no lo acepta, el plan pasa a rotar el secreto + timingSafeEqual y documentar el límite del proveedor. (2) Extraer un helper \`comparaSecreto(a,b)\` en tiempo constante, que además reemplaza siete copias ad-hoc y \`lib/cron-auth.ts:15\`, que es el mismo problema para los 14 crons. (3) Ventana de migración aceptando header O query, con log cuando llega por query. (4) Recién con ese log en cero por 48 h, borrar la rama vieja.
Ya mitigado, no rehacer: \`lib/evolution.ts\` recorta la URL antes de devolverla a la UI, así que un admin de workspace ya no se lleva el secreto por la API de salud.

**Listo cuando**
La salud de WhatsApp sigue en 'ok' para todos los workspaces después del cambio, el log de "llegó por query" está en cero 48 h, y evolution y cron-auth comparten el mismo helper.`,
  },
  {
    titulo: 'Presupuesto diario de IA por cliente, con aviso y corte',
    proyecto: 'Cobros y planes',
    detalle: `**Qué hay que hacer**
Un tope de gasto en dólares por workspace por día: aviso al 80% y corte al 100%.

**Por qué**
Hoy no hay ningún techo de gasto. \`lib/ia-cuotas.ts\` mide contra el free tier de cada proveedor, que es otra cosa: dice si te queda cuota gratis, no si te estás fundiendo. Sin esto, un bug en un loop o una sesión comprometida gastan hasta que alguien mire la factura.

**Detalles concretos**
La mitad ya está: \`lib/anthropic-usage.ts:94\` (\`recordUsage\`) graba una fila por llamada con su \`cost_usd\`, y \`costFor()\` calcula por modelo y proveedor. Falta \`presupuestoRestanteHoy(ws)\` en \`lib/ia-cuotas.ts\`, un setting por workspace, el chequeo antes de llamar en \`lib/anthropic.ts\` y \`lib/ai-cheap.ts\`, y el aviso por el motor de avisos.
Regla del repo: cuando corta, deja rastro en el historial («MaKo frenó porque se llegó al tope del día»), y el error que ve el usuario explica qué pasó — no es un 500.

**Listo cuando**
Bajando el tope a un centavo en el Cliente de Prueba (ws 3), la llamada devuelve un error entendible en la UI en vez de gastar.`,
  },
  {
    titulo: 'Guards de rol en las rutas de API que faltan',
    proyecto: 'Seguridad y multi-inquilino',
    detalle: `**Qué hay que hacer**
Fijar un criterio escrito de qué cuenta como «ruta guardada», contar contra ese criterio, y ponerle guard explícito a las que gastan IA cara.

**Por qué**
Hay 189 route handlers y muchos se apoyan enteros en el proxy: cualquier sesión válida los dispara. No todos son un problema —\`getTenantDb\` ya aísla los datos— pero los que gastan IA o escriben en Meta tienen que pedir el rol a mano.

**Detalles concretos**
El lote de «plata en Meta» YA ESTÁ HECHO, no rehacerlo: \`app/api/meta-write/route.ts:18\` y \`ads-manager/campaign-create/route.ts:24\` usan \`esDuenoAdmin()\`, y \`ad-edit\` usa \`guardAdsDueno()\` de \`lib/ads-guard.ts:18\`. Cualquier barrido que no incluya \`guardAdsDueno\`, \`requireRolWs\` y \`guardTab\` en su heurística va a producir falsos positivos: una primera pasada contó 77 rutas «sin guard» y tres de las que nombró SÍ estaban guardadas.
Confirmadas sin guard de rol: \`app/api/ads-writer/route.ts\` y \`app/api/mako-doer/route.ts\`. Empezar por esas dos.
El repo tiene la skill \`audit-route-cross-tenant\` para el barrido.

**Listo cuando**
Existe la lista priorizada con el criterio escrito y el guard que le toca a cada ruta, y las dos rutas de IA cara ya lo tienen.`,
  },
  {
    titulo: 'Términos de Servicio y contrato de licencia de uso',
    proyecto: 'Legal y fiscal',
    detalle: `**Qué hay que hacer**
Escribir, revisar con abogado y publicar los Términos de Servicio, que son el contrato de licencia de uso de MaKo.

**Por qué**
Es lo que más protege y lo que no existe. El derecho de autor sobre el código ya lo tenés automáticamente por el Convenio de Berna, pero protege la EXPRESIÓN, no la idea: no impide que alguien mire MaKo, entienda el flujo y lo reimplemente desde cero. Lo que sí se puede prohibir por contrato es la ingeniería inversa, el scraping y usar el producto para construir un competidor.
Aclaración importante para no perder tiempo: BUSL, SSPL y Elastic License NO aplican. Existen para empresas que PUBLICAN su código y quieren impedir que un hyperscaler lo revenda; se disparan por distribución o por hosting de terceros, y MaKo nunca entrega código — se sirve desde Vercel. Ponerle BUSL a un repo privado no le agrega una obligación a nadie.

**Detalles concretos**
Cláusulas mínimas: titularidad de la plataforma (tuya) y de los datos del cliente (suyos); licencia de uso no exclusiva e intransferible; prohibición de ingeniería inversa, scraping, acceso automatizado y uso para construir un competidor; prohibición de compartir cuentas; condiciones sobre la salida de la IA; límite de responsabilidad; terminación y destino de los datos; y ley aplicable más foro — sin eso podés terminar litigando bajo derecho del consumidor mexicano.
Se publican en hola-mako.com con link desde el footer de la landing, y el wizard de onboarding suma una casilla de aceptación con fecha.

**Listo cuando**
Revisados por abogado, publicados, y ningún cliente nuevo llega al dashboard sin aceptarlos con fecha registrada.`,
  },
  {
    titulo: 'Cesión de derechos y NDA de todos los que escribieron código',
    proyecto: 'Legal y fiscal',
    detalle: `**Qué hay que hacer**
Juntar la lista de todas las personas que escribieron código, diseño, copy o prompts de MaKo, y firmar con cada una una cesión de derechos patrimoniales y un acuerdo de confidencialidad.

**Por qué**
Es lo que más retorno da de toda la lista y lo que más se olvida. Sin cesión expresa y escrita, quien escribió una parte del código puede conservar derechos sobre ella. Un contrato de servicios que no lo dice explícitamente no alcanza.

**Detalles concretos**
La lista sale del historial de git más quien tocó diseño, copy o prompts sin commitear. Cada acuerdo tiene que cubrir: cesión de todos los derechos patrimoniales incluido lo anterior a la firma, tratamiento del derecho moral (irrenunciable en varios supuestos en Uruguay, Argentina y México — que lo resuelva el abogado local), confidencialidad que sobrevive al fin de la relación, y devolución de material.
NO usar el marco «work for hire»: es de la ley de Estados Unidos y no aplica acá. La conclusión práctica es la misma —hace falta cesión expresa y escrita— y alcanza como justificación.

**Listo cuando**
Hay una carpeta con un acuerdo firmado por cada nombre, la lista está cerrada contra git, y queda el modelo guardado para los que vengan.`,
  },
  {
    titulo: 'Registrar la marca MaKo, empezando por México',
    proyecto: 'Legal y fiscal',
    detalle: `**Qué hay que hacer**
Buscar antecedentes y presentar el registro de la marca en México primero, después Uruguay y Argentina.

**Por qué**
La marca es lo que impide que otro venda un producto llamado igual, y es lo único de esta lista que da un derecho exclusivo y oponible sin discutir. México va primero porque ahí están los clientes.

**Detalles concretos**
Oficinas: IMPI (México), DNPI (Uruguay), INPI (Argentina). La búsqueda de antecedentes va ANTES de presentar: presentar sobre una marca ya registrada es tirar la tasa.
Para el abogado: qué clases corresponden (lo típico para software y SaaS es 9 y 42) y si conviene la vía nacional o el Protocolo de Madrid.
La prueba de uso ya existe: hola-mako.com, más Instagram y YouTube.

**Listo cuando**
La búsqueda está hecha en los tres países y México está presentado con número de expediente.`,
  },
  {
    titulo: 'Registrar el código para tener fecha cierta',
    proyecto: 'Legal y fiscal',
    detalle: `**Qué hay que hacer**
Depositar el código en el registro de derecho de autor para tener una prueba con fecha de que en tal día era tuyo.

**Por qué**
El derecho ya existe sin registrar nada (Convenio de Berna). El registro NO crea el derecho: da la prueba. En un juicio contra un ex-freelancer o contra un clon, esa fecha es la diferencia entre afirmarlo y demostrarlo.

**Detalles concretos**
Argentina: DNDA. México: INDAUTOR. Uruguay: CONFIRMAR con el abogado si el registro de software pasó de la Biblioteca Nacional a la DNPI — es el dato más flojo de toda la investigación y no hay que darlo por cierto.
Preguntar también si se puede depositar una porción representativa en vez del repo entero. La fuente a depositar es el repo sin \`node_modules\`, sin \`.next\` y sin \`.env\`.

**Listo cuando**
La constancia con fecha y número está guardada junto a los contratos, y hay un recordatorio anual para repetirlo.`,
  },
  {
    titulo: 'Aviso de privacidad y contrato de encargado para los clientes de México',
    proyecto: 'Legal y fiscal',
    detalle: `**Qué hay que hacer**
Publicar el aviso de privacidad y firmar con cada cliente mexicano el contrato que regula qué hacés vos con los datos de SUS leads.

**Por qué**
Es la exposición legal más grande, y no es sobre tus datos: son teléfonos, conversaciones de WhatsApp y transcripciones de llamadas de los leads de tus clientes. Salen de México hacia Vercel y Supabase, o sea que hay transferencia internacional de datos personales. Frente a la ley mexicana el responsable es tu cliente y vos sos el encargado, y esa relación tiene que estar por escrito.

**Detalles concretos**
Cláusulas: finalidad limitada a las instrucciones del responsable, confidencialidad que subsiste, notificación inmediata de brechas, prohibición de subcontratar sin consentimiento, y devolver o eliminar los datos al terminar.
DEPENDENCIA TÉCNICA REAL: esa última cláusula exige un «exportar y borrar todo lo de este workspace» que hoy no existe en la app. Puede arrancar manual, pero tiene que estar documentado paso a paso.
Para el abogado: confirmar las fechas de la ley nueva y el estado del INAI — vienen de fuentes secundarias.

**Listo cuando**
El aviso está publicado, el contrato firmado por cada cliente mexicano activo, y el procedimiento de exportar y borrar está escrito.`,
  },
  {
    titulo: 'Inventario de secretos y accesos',
    proyecto: 'Legal y fiscal',
    detalle: `**Qué hay que hacer**
Un documento con tres columnas —qué es, dónde vive, quién accede hoy y con qué se protege— de todo lo que es secreto comercial de MaKo.

**Por qué**
El secreto comercial es la única figura que protege la LÓGICA y no el código: los prompts, el criterio del Perro, la metodología de las fases. Pero solo existe legalmente si podés demostrar que tomaste medidas razonables para mantenerlo secreto. El documento no es burocracia: ES la medida.

**Detalles concretos**
Arrancar por: los prompts del sistema (\`lib/prompt-registry.ts\`, que es \`server-only\`), el Perro (\`lib/mako-guardian.ts\`), los catálogos de ángulos y estructuras de guion, la metodología de fases (\`lib/fase-diagnostico.ts\`) y las credenciales.
Nombrar las medidas que YA existen, porque cuentan: el cifrado de credenciales, el aislamiento por workspace (\`getTenantDb\` + \`TENANT_TABLES\`), la migración 0118 que cerró las tablas al rol anónimo, y el cierre de los prompts a super-admin.
Sumar quién tiene acceso al repo y a Vercel.

**Listo cuando**
El documento tiene las tres columnas, cada persona de la lista de accesos firmó su NDA, y hay una revisión a 6 meses agendada.`,
  },
];

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number };
  const id = await runWithWorkspace(ws.id, () => crearPropuesta({
    tareas: TAREAS,
    resumen: 'Auditoría: ciberseguridad, fugas del bundle y los papeles del negocio',
    origen: 'claude-code',
  }));
  console.log(`\n${TAREAS.length} tareas → ${APP_BASE_URL}/plan/revisar/${id}\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
