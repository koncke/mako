// =============================================================================
// Build & Deploy — el registro de construcción del área
// =============================================================================
// Alcance: cómo se compila esta app y cómo llega a producción. El build de Next
// (`next.config.ts`, el escaneo de Tailwind en `app/globals.css`), la única red
// de tipos que queda (`.git/hooks/pre-push` y los tres scripts de sync que
// corre), el enganche de GitHub → Vercel, los roles y permisos que autorizan un
// deploy, y la factura que todo eso genera.
//
// De dónde salió esto: los mensajes de commit de este repo son largos y explican
// el porqué — son la fuente principal, y de ahí salen la fecha, la hora, la
// cuenta (trailer `Claude-Cuenta:`) y los números de cada commit. El detalle
// técnico con las mediciones vive en docs/hallazgos-infra.md → «Build, deploy y
// entrega»; las reglas que gobiernan código nuevo, en AGENTS.md.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado. Y en esta
// área eso pasó dos veces seguidas, de las caras: se optimizó el build por
// segundos cuando la factura se cobra por vCPU, y se buscaron tres veces bugs de
// código que ya estaban arreglados porque el deploy nunca había existido.
//
// ⚠️ El hilo que atraviesa TODA el área: **un push exitoso no prueba nada**. Hay
// tres formas distintas de que producción se quede en la versión vieja sin que
// nada falle, y las tres se ven, desde afuera, igual que un arreglo que no anda.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El typecheck fuera del build', detalle: '`ignoreBuildErrors: true` en next.config.ts · el mismo chequeo corre local en ~7 s y gratis · el ahorro real fue un 2x, no el 95 % que afirmaba el comentario', estado: 'hecha' },
  { titulo: 'El pre-push, la única red que queda', detalle: 'Cuatro chequeos: tipos, contrato del `detalle`, gramática de MaKo y el plugin público · vive en .git/hooks, así que un reclon lo borra en silencio', estado: 'sigue' },
  { titulo: 'Los tres modos de «pushear no es desplegar»', detalle: 'El build que falla · el build que nunca arranca · el push que no genera build · los tres escritos, con cómo distinguirlos en un comando', estado: 'hecha' },
  { titulo: 'Quién autoriza un deploy', detalle: 'El rol del que pushea (DEVELOPER, no VIEWER_FOR_PLUS) y el EMAIL del autor del commit, que tiene que ser del equipo de Vercel', estado: 'hecha' },
  { titulo: 'La factura de builds, medida y no deducida', detalle: '`ceil(minutos) × vCPU`: la palanca es el tamaño de la máquina, nunca la duración · migrar de plataforma quedó descartado con evidencia', estado: 'hecha' },
  { titulo: 'Bajar la máquina de build a Standard', detalle: 'Standard + on-demand apagado = US$0 de build · se fija a nivel EQUIPO, y Vercel ya cambió el default dos veces en 2026', estado: 'sigue' },
  { titulo: 'Un vigía que pregunte «¿producción sirve MI byte?»', detalle: 'Hoy es un `curl` a mano contra el archivo que cambiaste · `vercel ls` no sirve: contesta «Ready» por el deploy de otro commit', estado: 'cola' },
  { titulo: 'Versionado de la app', detalle: 'Que la pestaña abierta se entere de que hay build nuevo y se refresque sola · pedido del 16/07 · cero código (área app-versioning)', estado: 'cola' },
  { titulo: 'La landing de Mauricio, de Lovable a Vercel', detalle: 'Plan auditado, DNS recién en el paso 11 · migrar no elimina el paso de publicar: mueve el botón, y cada merge saldría al aire sobre los anuncios', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── agosto: los dos modos de «pushear no es desplegar» ─────────────────────
  {
    fecha: '7 ago', hora: '02:26', chat: 'CRM: funnel, validaciones y ficha del lead', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Producción llevaba 3 horas sirviendo código viejo, y el dueño lo vio antes que nosotros',
    puntos: [
      '**El síntoma no fue un error: fue una feature que «no estaba».** El dueño abrió el CRM y vio la versión vieja de algo que se le había reportado terminado **dos veces**. Vercel no revierte ni avisa: cuando un build falla, deja el deploy anterior en pie y el sitio anda perfecto — con el código de hace tres horas.',
      '⚠️ **La causa raíz es de las dos cuentas, no del build.** Commitear archivo por archivo (obligatorio con otra sesión en el mismo árbol) y dejarse afuera el archivo que DEFINE lo que el commiteado importa. Local compilaba porque el archivo estaba ahí sin commitear.',
      '**Y las tres redes de seguridad del repo miran el ÁRBOL DE TRABAJO, no lo que se sube:** el build local, los tests y el hook de pre-push. Un archivo sin commitear las pasa las tres en verde. Es la primera vez que se escribe la regla que después se repitió todo el mes: **verificá el DEPLOY, no el push.**',
    ],
    commits: [
      { sha: '33c030ea', msg: 'FIX BUILD: faltaba lib/etapa-historial.ts, prod estaba caido hace 3 horas', lineas: 846, archivos: 23 },
      { sha: 'b648ad38', msg: 'hallazgos-infra: "pushear no es desplegar"', lineas: 57, archivos: 1 },
    ],
    archivos: ['docs/hallazgos-infra.md → «Pushear no es desplegar», con el comando de verificación y el chequeo de símbolos huérfanos'],
  },
  {
    fecha: '7 ago', hora: '16:10', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El otro modo, y es peor: el build que NUNCA arranca',
    puntos: [
      '**Modo de falla nuevo, distinto del de la madrugada.** El documentado era «el build corre y falla». Este es «el build no existe»: el enganche de GitHub dejó de disparar en silencio, con el commit en `origin/main`, el pre-push en verde y **cero deploys fallados**. No hay nada rojo que mirar.',
      '**Se distinguen por la EDAD del deploy más nuevo, no por su estado.** «Ready» de hace dos horas con un push de hace diez minutos es éste; «Error» es el otro. Lo destraba un commit vacío, que vuelve a pedirle el webhook a Vercel.',
      '⚠️ **Y no sirve pedirle una ruta nueva a producción para ver si tu código llegó:** `proxy.ts` gatea antes de rutear, así que una ruta real y una inventada devuelven las dos 307 a `/login`. La prueba definitiva de que lo desplegado es lo tuyo es el commit del log de clonado del deploy.',
    ],
    commits: [
      { sha: 'ed5c587f', msg: 'Redisparar el deploy: el push de 8533292 no construyo', lineas: 0, archivos: 0 },
      { sha: '8b07b2c8', msg: 'Cosecha: el build que nunca arranca', lineas: 36, archivos: 1 },
    ],
  },

  // ── agosto: el build propio ────────────────────────────────────────────────
  {
    fecha: '8 ago', hora: '10:06', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Subir 49 transcripciones a docs/ rompió el build, sin tocar una línea de CSS',
    puntos: [
      '**Tailwind 4 detecta sus fuentes SOLO** y escanea el repo entero buscando clases, `docs/` incluido. Con ~9 MB de markdown adentro, su escáner escupe `Invalid code point 1941695` — un code point **fuera del rango de Unicode** (máx `0x10FFFF`), o sea que no sale de ningún archivo: **lo inventa el escáner**.',
      '⚠️ **El error miente dos veces, y el diagnóstico obvio era el equivocado.** Apunta a `globals.css:1:1`, que es `@import "tailwindcss"` y está intacta; y tiene toda la pinta de ser caché de Turbopack sobre OneDrive, que es un gotcha real de este repo — se perdió tiempo ahí primero. **Lo que lo descarta es que Vercel da el MISMO error desde un clon limpio:** si falla en un clon limpio, no es tu caché.',
      'El fix es una línea, `@source not "../docs"`, y la regla que deja es más general: **cualquier carpeta de texto que crezca sin control es una entrada del build aunque no sea código.** En `docs/` no hay una sola clase de Tailwind, así que no se pierde nada; con las 49 transcripciones presentes compila en 37 s.',
    ],
    commits: [
      { sha: 'c977153c', msg: 'Arreglar el build: Tailwind escaneaba docs/ y se ahogaba', lineas: 53, archivos: 2 },
    ],
    archivos: ['app/globals.css:13 — el `@source not`, con el porqué escrito al lado'],
  },
  {
    fecha: '10 ago', hora: '16:32', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El pre-push te bloquea por trabajo ajeno, y main ya estaba desincronizado',
    puntos: [
      '**Que el hook mire el árbol de trabajo y no lo que subís ya estaba escrito, pero siempre en la dirección del falso VERDE. La contraria desorienta más:** el commit está impecable y el push se cae igual, con un error que nombra archivos que ese commit no toca. La otra sesión había agregado un quinto canal a `CanalId` sin actualizar dos `Record`s.',
      '**Se reconoce en un segundo:** los archivos del error **no** están en `git show --stat HEAD` y **sí** están en `git status`.',
      'La salida sin tocarle los archivos a nadie: worktree suelto en tu commit + `node_modules` por junction (no pide admin) y typecheck ahí. Como el hook corre en el directorio desde el que pushás, **pushear desde el worktree valida exactamente lo que sube** — no es saltearse el hook, es correrlo contra el árbol correcto.',
      '⚠️ **Y el falso verde ya había dejado rastro en producción del repo:** con un checkout pelado de `origin/main`, `.claude/skills/plan-tareas/SKILL.md` estaba DESINCRONIZADO. Alguien pusheó con un `skills-lock.json` sin commitear que hacía pasar el chequeo local. Un clon limpio de main no se podía pushear hasta correr `scripts/sync-contrato-detalle.mjs` y commitear el resultado.',
    ],
    commits: [
      { sha: '47257a82', msg: 'El pre-push que te bloquea por trabajo ajeno, y el main desincronizado', lineas: 40, archivos: 1 },
    ],
    archivos: ['.git/hooks/pre-push — los cuatro chequeos; el contenido para recrearlo está en AGENTS.md porque los hooks no se versionan'],
  },
  {
    fecha: '11 ago', hora: '19:36', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El pre-push verde no significa que un script corra',
    puntos: [
      '`curso-transcribir.ts` explotaba con «Top-level await is currently not supported with the cjs output format». **Es un error de TRANSFORM de esbuild, no de tipos:** `tsc --noEmit` lo da por bueno y falla recién al ejecutar. El cuerpo pasó a `async function main()`, que es el patrón que ya usaba `scripts/backfill-transcripts.ts`.',
      '**La lección que queda para el área: los scripts no se ejecutan en el typecheck.** La única red del repo valida tipos del árbol de trabajo; todo lo que vive en `scripts/` se prueba corriéndolo, o no se prueba.',
      'El gemelo del mismo commit, del lado de los datos: `curso-a-drive.mjs` reportaba «20/20 clases con videoId» con **cero** archivos subidos, porque el polling confundía «¿hay id?» con «¿ya subió?». **El fallo se presentaba como éxito — el modo más caro, porque un 20/20 nadie lo revisa.**',
    ],
    commits: [
      { sha: 'c03c7d7c', msg: 'Dos fallas que pasaron el typecheck en verde y fallaron al ejecutar', lineas: 93, archivos: 3 },
    ],
  },

  // ── agosto: la plata ───────────────────────────────────────────────────────
  {
    fecha: '13 ago', hora: '13:28', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'La factura no mide TIEMPO: mide ceil(minutos) × vCPU, y por eso acortar el build no ahorró nada',
    puntos: [
      '**La anomalía: 1.064 CPU-min facturados por día contra ~25 minutos de reloj. Un factor 40x.** Se buscó doble build, cola facturada y proyectos duplicados: ninguna de las tres. La causa es la fórmula — Vercel **redondea el build al minuto** y lo multiplica por los vCPU de la máquina, y los 14 proyectos del equipo estaban en `turbo` con elastic encendido (~30 vCPU). Son **30 CPU-min planos por deploy, dure lo que dure**.',
      '⚠️ **El diagnóstico de julio era el equivocado, y estaba escrito en el código.** Sacar el typecheck del build (99 s → 27 s) se hizo para bajar la factura; con redondeo al minuto eso solo mueve de `ceil(2)` a `ceil(1)` — **un 2x como techo**, contra el «95 % del gasto variable» que afirmaba el comentario de `next.config.ts`. Se corrigió el comentario y **no se revirtió el cambio**: sigue valiendo por velocidad.',
      '**La regla: antes de optimizar un costo, leé cómo se metrea.** Y su corolario, que es el que más cuesta aceptar: cuando un fix medido en la unidad técnica (segundos) no mueve la unidad económica (dólares), **la unidad económica no era la que pensabas**.',
      'Del mismo hilo, el gemelo con Supabase: se había **deducido** de la factura que el compute era Medium. Medido contra la base (`shared_buffers` 256 MB, `max_connections` 60), es el perfil de **Micro**, o sea el piso — no había nada que bajar. **El tamaño de una instancia se LEE, no se deduce del monto de la factura**, porque deducirlo invita a «bajá el compute» sobre algo que ya está abajo y a no buscar el gasto donde está.',
      'Queda escrito lo que se evaluó y se **descartó**, para no volver a investigarlo: Cloudflare no compila (Next 16 renombró `middleware` a `proxy.ts`), un VPS ahorra ~US$0-10/mes contra la factura ya arreglada, Neon no sirve porque el cron `doer-flush` corre cada minuto, y salir de Supabase son 748 call-sites `.from()`.',
    ],
    commits: [
      { sha: '01d2209a', msg: 'La factura de builds no mide tiempo: mide ceil(minutos) x vCPU', lineas: 122, archivos: 2 },
      { sha: '77719b78', msg: 'Supabase ya esta en el compute mas chico: el gasto no esta en este proyecto', lineas: 56, archivos: 1 },
    ],
    archivos: [
      'next.config.ts — el comentario corregido: el porqué del `ignoreBuildErrors` no es el ahorro que decía',
      'AGENTS.md → «El typecheck NO corre en el build» — la advertencia, para que nadie repita el número viejo',
      '⚠️ Sin hacer: bajar la máquina a Standard con on-demand apagado (US$0 de build). Se fija a nivel EQUIPO, no proyecto',
    ],
  },
  {
    fecha: '13 ago', hora: '15:09', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Un VIEWER no despliega por git push, y el push sale verde igual',
    puntos: [
      '**Se afirmó —en un commit y en el mensaje al dueño— que «los deploys por git push no dependen del rol, los dispara la integración de GitHub». Es falso, y se probó en producción:** con Martín en `VIEWER_FOR_PLUS`, el commit `a4628543` se pusheó con éxito (el remoto lo tenía, el pre-push pasó los cuatro chequeos, git imprimió el rango de siempre) y Vercel **nunca creó el deployment**.',
      '**Es «pushear no es desplegar» un escalón más arriba.** Ahí el build fallaba y quedaba registro; acá el build **ni se encola**, y producción se queda en la versión vieja indefinidamente. No hay 403, no hay nada que mirar.',
      '**La regla que queda: después de tocar roles, permisos o integraciones, el push de prueba no alcanza — hay que verificar que apareció el DEPLOYMENT.** Un `git push` exitoso solo prueba que GitHub recibió el commit.',
      'La salida verificada es el rol **DEVELOPER** (probado con un commit vacío: build READY en 66 s). Y una trampa de la API que se paga sola: **el rol gratis del plan Pro no se llama `VIEWER`**, se llama `VIEWER_FOR_PLUS`; los reales son MEMBER, OWNER, VIEWER_FOR_PLUS, DEVELOPER y BILLING. Como un viewer no puede escribir por API, el `VERCEL_API_TOKEN` se reemplazó **antes** de degradar al usuario.',
      '⚠️ Quedó SIN verificar si DEVELOPER consume asiento pago: eso se lee en el renglón «Additional Team Seats» de la factura, no en la doc.',
    ],
    commits: [
      { sha: 'a4628543', msg: 'Los US$55 de Supabase eran otros proyectos, y el rol gratis de Vercel no se llama VIEWER', lineas: 56, archivos: 1 },
      { sha: '7e2366f5', msg: 'Prueba: verificar que un push despliega con el rol DEVELOPER', lineas: 0, archivos: 0 },
      { sha: '36a94028', msg: 'Un VIEWER no despliega por git push, y el push sale verde igual', lineas: 33, archivos: 1 },
    ],
  },

  // ── agosto: lo que el deploy deja río abajo ────────────────────────────────
  {
    fecha: '14 ago', hora: '14:04', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Cada deploy emite una URL, y eso ensucia lo que las colecciona',
    puntos: [
      '**El síntoma («se guardan URLs iguales con números adelante») apuntaba al guardado, y el guardado estaba bien** — no se guardaba ninguna de más. Lo roto era **contarlas como distintas**, con un `new Set` sobre el texto crudo.',
      '**Cualquier hosting moderno emite una URL por deploy**, así que ese patrón muestra N copias de todo lo que se publique seguido. La regla que queda: **una lista de «lo que observamos» se deduplica por identidad canónica, nunca por el string.**',
      'Y queda escrito por qué el colapso es **angosto a propósito** (20+ hex): la próxima sesión va a querer ampliarlo sin saber que con eso fundiría los deploys **por rama**, que sí son cosas distintas.',
    ],
    commits: [
      { sha: '37ec8683', msg: 'landing: editar/borrar en cada renglon, y las 7 URLs iguales eran previews de deploy', lineas: 187, archivos: 6 },
      { sha: '09ca9299', msg: 'cosecha: los previews de deploy y la coleccion que hay que mantener', lineas: 57, archivos: 1 },
    ],
    archivos: ['docs/hallazgos-landing.md — el hallazgo vive donde vive el código, aunque la causa sea del hosting'],
  },
  {
    fecha: '15 ago', hora: '22:32', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Auditoría de traer la landing de Mauricio a Vercel: la premisa era falsa',
    puntos: [
      '⚠️ **La lección más cara del documento es que se arrancó de una premisa falsa.** Se creyó que Lovable inyectaba metadatos y píxeles al publicar, porque el HTML servido pesa ~36 KB y el del repo ~25,7 KB. **No los inyecta:** el bundle es byte-idéntico al que produce `vite build` (mismo md5 en JS, CSS y los 10 assets) y todo lo que mide plata vive inline en el `index.html` del repo. **Una diferencia de tamaño no es un diagnóstico.**',
      '**Lo bloqueante, que no era obvio:** Vercel **no presenta certificado ante un SNI que no emitió**, así que sin pre-generar por DNS-01 el corte es `ERR_SSL_PROTOCOL_ERROR` para *todo* el tráfico — y el HSTS a un año mata el escape por http. Y el preset Vite de Vercel **no trae fallback SPA** (verificado en el código de `@vercel/frameworks`, 73 presets): sin rewrites, cualquier ruta que no sea `/` da el 404 de Vercel.',
      '**Y la parte incómoda, que es una decisión de producto y no técnica: migrar NO elimina el paso de publicar, elimina el CONTROL.** Hoy push y publicación son cosas distintas; con Vercel enganchado a `main`, cada merge sale al aire sobre los anuncios corriendo. El botón no desaparece, se mueve.',
      'El plan toca DNS recién en el paso 11, con checklist y rollback de ~10 minutos. **Sigue en cola: no se ejecutó.**',
    ],
    commits: [
      { sha: '39b4d29b', msg: 'docs: auditoria de migrar la landing de Mauricio de Lovable a Vercel', lineas: 216, archivos: 2 },
    ],
  },

  // ── agosto: el tercer modo, y por fin la causa ─────────────────────────────
  {
    fecha: '17 ago', hora: '11:54', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El push que no genera build era Vercel rechazando el EMAIL del autor',
    puntos: [
      '**Tres pushes seguidos a `main` sin deploy: ni «Ready», ni «Error», ni siquiera «Building».** Producción seguía sirviendo el `ugc.css` viejo —75 KB contra 330— así que la pantalla salía en blanco con el arreglo ya pusheado. **Un push que no dispara build deja exactamente el mismo síntoma que un arreglo que no funciona**, y se pierde el tiempo depurando código que ya estaba bien.',
      '⚠️ **`vercel ls` NO lo detecta.** Su primera fila decía «● Ready» todo el tiempo, porque era el deploy de OTRO commit. **La pregunta correcta no es «¿el último deploy está listo?» sino «¿producción sirve MI byte?»**, y se contesta con un `curl` al archivo que cambiaste comparado contra `git show origin/main:<archivo>`.',
      '**La causa real, encontrada al final: Vercel bloqueaba los deploys por el AUTOR de git.** Su API lo dice — el autor tiene que tener acceso al equipo para poder crear deployments, y `noreply@anthropic.com` no es ninguno de los dos miembros. Los tres commits quedaron en estado **BLOCKED**, que el CLI muestra como `UNKNOWN` y que **desde afuera se ve idéntico a un push que no dispara build**.',
      '**No era el plan ni GitHub**, que fue donde se buscó primero: la cuenta está en Pro sin bloqueos, y los commits llegaban bien. Lo que confunde es que **la regla empezó a aplicarse a mitad de la sesión**: los mismos commits, con el mismo autor, habían desplegado bien una hora antes. Se firma con un email del equipo; el nombre del autor sigue siendo Claude y el trailer `Claude-Cuenta` sigue ahí, así que la autoría no se pierde.',
      '⚠️ **Y no se puede forzar desde esta máquina:** `vercel deploy --prod` responde «You don\'t have permission to create a Production Deployment». Un preview sí se puede, y sirve para separar «¿mi arreglo funciona?» de «¿por qué no despliega?». Si alguna vez hay que desplegar por CLI, va **desde un clon limpio de `origin/main`**, nunca desde el working tree: son dos sesiones sobre este repo.',
    ],
    commits: [
      { sha: '3ca53d6c', msg: 'Re-disparar el deploy: el push anterior no generó build', lineas: 0, archivos: 0 },
      { sha: 'd3aa7fdd', msg: 'Cosecha: replicar una pantalla ajena, y el push que no genera build', lineas: 90, archivos: 2 },
      { sha: '82e54a1b', msg: 'Firmar los commits con un email del equipo de Vercel', lineas: 0, archivos: 0 },
    ],
    archivos: [
      'docs/hallazgos-infra.md → «El push que NO GENERA BUILD, y el CLI que no puede forzarlo» — con el comando que lo distingue',
      '⚠️ Sin hacer: nada verifica solo que producción sirva el commit de `origin/main`. Hoy son tres pasos a mano y hay que acordarse',
    ],
  },
];
