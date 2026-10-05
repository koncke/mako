// =============================================================================
// Local Dev Environment — el registro de construcción del área
// =============================================================================
// Alcance: la máquina donde se escribe esta app. El `.env.local` que apunta a la
// base de PRODUCCIÓN y el boot que le escribe, el `next dev` de este clon, la
// puerta de verificación local (`/api/auth/dev-login`), el clon compartido por
// DOS cuentas de Claude a la vez, y —la mitad que nadie declara como código— la
// superficie que usan los propios agentes: `AGENTS.md`, `.claude/skills/`, los
// generadores que mantienen vivas las copias, y las herramientas con las que un
// agente lee y verifica.
//
// De dónde salió esto: los mensajes de commit de este repo son largos y explican
// el porqué — de ahí salen la fecha, la hora, el `Claude-Cuenta:` y los números
// de cada commit, nunca del recuerdo. El detalle técnico con las mediciones vive
// en docs/hallazgos-infra.md → «Tests y entorno local», «Sesiones paralelas y las
// dos cuentas» y «El equipo: cuando se cierra Claude Code y no es Claude Code»;
// el protocolo entre cuentas, en docs/dos-cuentas.md; las reglas que gobiernan
// código nuevo, en AGENTS.md. El `chat` va en «—» a propósito: docs/chats.md
// llega hasta el 8 de agosto y estas tandas son posteriores — no se inventa.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.
//
// ⚠️ El hilo que atraviesa TODA el área: **lo que ves en local no es lo que
// corre**. El middleware no corre, el dev server no hidrata, la búsqueda te
// devuelve otra cosa que la que dice el archivo, y el clon lo está editando
// alguien más. Cada uno de esos cuatro produjo, por lo menos una vez, un
// diagnóstico entero construido sobre evidencia falsa.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El clon compartido por dos cuentas', detalle: 'Nunca `add -A`, y ni siquiera por ruta alcanza: se mira el HUNK · el `--amend` que reescribe el commit ajeno · staging por plumbing y worktrees para no tocarle el árbol a nadie', estado: 'hecha' },
  { titulo: 'Verificar sin navegador', detalle: '`curl` + cookie jar contra /api/auth/dev-login · en producción esa ruta es 404 a propósito: ahí se firma la cookie a mano con el mismo secret, no se abre una puerta nueva', estado: 'hecha' },
  { titulo: 'El entorno del agente: AGENTS.md y las skills', detalle: 'Lo único que comparten las dos cuentas es lo versionado — las memorias viven dentro del config dir y no viajan · el canal de traspaso son estos documentos', estado: 'hecha' },
  { titulo: 'Las copias que se generan, no se escriben', detalle: 'Las skills son .md y no pueden importar: `sync-contrato-detalle`, `sync-gramatica-doc` y `generar-plugin` las escriben desde el módulo vivo, y el pre-push falla si quedaron viejas', estado: 'hecha' },
  { titulo: 'Las trampas de la herramienta de búsqueda', detalle: 'Reescribe `/` como `\\` en el contenido que devuelve, y declara BINARIO cualquier archivo con un byte NUL · las dos ya produjeron un diagnóstico entero sobre texto que no existe', estado: 'hecha' },
  { titulo: 'Probar una interacción de verdad', detalle: '`next dev` NO hidrata en este proyecto; `next build` + `next start` sí · la receta está escrita, la causa raíz no · y la URL es `localhost`, nunca `127.0.0.1`', estado: 'sigue' },
  { titulo: 'La máquina: Claude Code se cierra solo', detalle: 'Bug de la app con ~10 issues abiertos, disparado por el navegador embebido (7 de 7 a menos de 41 s) · no hay cura, solo el paliativo de no abrirlo', estado: 'sigue' },
  { titulo: 'Un entorno que no sea producción', detalle: 'El `.env.local` apunta a la base real y el boot le ESCRIBE la hidratación env→base · no hay staging ni base de desarrollo: toda prueba que salga hacia afuera va al mail y al teléfono del dueño', estado: 'cola' },
  { titulo: 'El pre-push no se versiona', detalle: 'Vive en `.git/hooks`, así que un reclon lo borra en silencio y el único chequeo de tipos desaparece sin avisar · y no corre `npm test`, que hay que acordarse a mano', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 9 de agosto: la máquina y el dev server ────────────────────────────────
  {
    fecha: '9 ago', hora: '01:04', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'La sesión se cerraba sola cada 4 minutos, con la PC andando',
    puntos: [
      'Cuatro corridas con subagentes perdidas en una noche. El proceso GPU de Electron muere (`GPU process gone`, `exitCode 101457950`) y se lleva la app puesta **sin `onQuitCleanup`**: no se despide, así que desde adentro no hay nada que avise ni que guarde.',
      '**Los tres diagnósticos obvios estaban equivocados, y los tres salieron de mirar el sistema antes que el log de la app** —que tenía la línea exacta desde el primer minuto—: memoria (había 3,8 GB libres), «Windows cierra la sesión» (pasó una vez, y fue el reinicio del instalador de drivers) y drivers viejos (se actualizaron y crasheó cuatro minutos después).',
      'La regla del método: **un crash del proceso GPU no deja atribución en ningún log**. No se deduce, se reproduce y se mide — acá con tres cargas distintas, la última seis agentes concurrentes con navegador, que es la que antes lo mataba.',
      '⚠️ Esta entrada envejeció mal a propósito y se dejó escrita al revés en `docs/hallazgos-infra.md`, con el título tachado: la causa que se concluyó acá (la gráfica híbrida) es falsa. Ver el 13 de agosto.',
    ],
    commits: [
      { sha: '114817c0', msg: 'Cuando Claude Code se cierra solo y no es Claude Code', lineas: 67, archivos: 1 },
    ],
    archivos: ['docs/hallazgos-infra.md → «El equipo: cuando se cierra Claude Code y no es Claude Code»'],
  },
  {
    fecha: '9 ago', hora: '03:54', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Un solo `next dev` para dos sesiones, y el que arranca no hidrata',
    puntos: [
      '**El preview muere en silencio y las dos pistas obvias mienten.** `preview_start` contesta «Server started successfully» y un segundo después ese `serverId` ya no existe. La causa es que Next 16 detecta otro dev server sobre el MISMO directorio y se apaga solo; el mensaje existe pero se lo come la herramienta. No parece «puerto ocupado» —el 3000 está libre, el ajeno está en el 3100— ni «se cayó», porque la herramienta dijo que arrancó bien. La salida es correr `node_modules/.bin/next dev` una vez a mano para LEER el error, nunca reintentar.',
      '**Y al server ajeno no se lo mata: sirve el mismo working tree**, así que tus ediciones ya están adentro por HMR y se verifica contra su puerto. Si la ruta está gateada, alcanza `curl` con un cookie jar contra `/api/auth/dev-login`.',
      '**El hallazgo grande del día, que costó descartar cuatro cosas:** `next dev` **no hidrata en este proyecto** y `next build` + `next start` sí. Se descartó en este orden el server de la otra sesión, un worktree limpio con su propio `npm ci`, las páginas que nadie tocó (`/inicio`, `/plan`, `/vsl`) y producción. O sea que el worktree —que parecía la salida— sobra para probar una interacción: alcanza con levantar el build de producción en otro puerto.',
      '`dev-login` devuelve **404 en producción a propósito** y esa guarda no se toca: contra el build local se firma la cookie a mano con el mismo secret (`crearToken`) y se la inyecta. Es exactamente lo que hace el dev-login, sin abrir una puerta nueva.',
      'El chequeo de una línea que distingue «el DOM cambió» de «el handler de React corrió», y que evita creerle a una verificación que no vale: `Object.keys(el).filter(k => k.startsWith(\'__react\')).length` — si da 0, lo que midas ahí no prueba nada.',
    ],
    commits: [
      { sha: '6c0e5a6c', msg: 'docs: el preview muere en silencio si la otra sesión ya tiene un next dev', lineas: 36, archivos: 1 },
      { sha: '97690156', msg: 'Cosecha: el clic SÍ se pudo verificar, y la causa quedó acotada', lineas: 46, archivos: 3 },
    ],
    archivos: [
      '.claude/launch.json — la entrada del preview, que arranca en 3000 igual aunque la apuntes a otro puerto',
      'app/api/auth/dev-login/route.ts — la puerta de verificación local; 404 fuera de dev',
    ],
  },
  {
    fecha: '9 ago', hora: '19:55', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La sesión que cierra deja escrito, y la skill lo hace sola',
    puntos: [
      'El motivo es del entorno, no de la feature: **hay varias sesiones trabajando este repo en paralelo**, tocando cosas que ya están en el plan y descubriendo otras nuevas. Si cada una espera a que le pidan anotar, el tablero miente — tareas cerradas que figuran abiertas y trabajo nuevo que solo existe en un chat que nadie va a releer.',
      'Las dos skills pasan de «usame cuando te lo pidan» a **«esto es lo que hacés al cerrar cualquier trabajo sustancial, igual que correr los tests»**, con tres preguntas en orden: ¿cerré algo que estaba abierto? ¿aprendí algo sobre una que ya está? ¿apareció trabajo nuevo? Y las tres en UN borrador y UN link, para que el dueño revise una vez.',
      '**Un paso manual en un tutorial es un paso que no se hace.** El reporte de sesiones eran cuatro gestos (bajar un archivo, ponerlo en su carpeta, fusionar un JSON en `settings.json`, correr un comando) y el pedido fue textual: «¿no puede estar directamente dentro de la skill? en lugar de que los usuarios tengan que hacer todo eso». Puede: la skill corre EN el proyecto y tiene acceso a los archivos, así que se instala el hook ella misma, idempotente y sin pedir permiso paso por paso.',
    ],
    commits: [
      { sha: '9af34f0f', msg: 'La skill actúa sola al cerrar, y se instala el hook ella misma', lineas: 167, archivos: 4 },
    ],
    archivos: ['.claude/skills/plan-tareas/SKILL.md — la interna; la del cliente sale de lib/agente-skill.ts'],
  },

  // ── 10 de agosto: el árbol compartido y lo que miente en local ─────────────
  {
    fecha: '10 ago', hora: '16:32', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El push rebota por trabajo ajeno, y tres formas nuevas de pisarse',
    puntos: [
      '**El `pre-push` mira el ÁRBOL DE TRABAJO, no lo que subís**, y eso ya estaba escrito — pero siempre en la dirección del falso VERDE. La contraria desorienta mucho más: **tu commit está impecable y el push se cae igual**, con un error que nombra archivos que ese commit no toca (la otra sesión había agregado un quinto canal a `CanalId` sin actualizar dos `Record`). Se reconoce en un segundo: los archivos del error **no** están en `git show --stat HEAD` y **sí** están en `git status`.',
      'Cómo saber de quién es la rotura sin tocarle los archivos a nadie: un worktree suelto en tu commit con `node_modules` por junction (no pide admin, tarda un segundo) y el typecheck ahí. Y como el hook corre en el directorio desde el que pushás, **pushear desde el worktree valida exactamente lo que sube** — no es saltearse el hook, es correrlo contra el árbol correcto. `--no-verify` no.',
      '⚠️ **El falso verde ya dejó rastro en `main`**: comprobado con un checkout pelado de `origin/main`, sin nada local, la copia de la skill estaba DESINCRONIZADA. Alguien pusheó con un `skills-lock.json` sin commitear que hacía pasar el chequeo local. Un clon limpio no se puede pushear hasta correr el sync y commitear el resultado.',
      '**Y las tres formas nuevas de pisarse, las tres el mismo día:** (a) commitear «por rutas explícitas» no alcanza cuando el archivo lo tocaron las dos — se mira el HUNK, o el commit queda sin compilar; (b) un `--amend` después de que la otra sesión commitea **reescribe SU commit con tu mensaje** (se recupera con `reset --soft`, se evita con un `git log -1`); (c) un `export` a medias en un client component rompe el bundle ENTERO y la app deja de hidratar — se ve perfecta y no responde ningún botón, así que antes de culpar a tu cambio probá otra ruta cualquiera.',
    ],
    commits: [
      { sha: '47257a82', msg: 'El pre-push que te bloquea por trabajo ajeno, y el main desincronizado', lineas: 40, archivos: 1 },
      { sha: 'bb04d9f4', msg: 'AGENTS: las tres formas nuevas de pisarse entre sesiones', lineas: 16, archivos: 1 },
    ],
    archivos: [
      'docs/hallazgos-infra.md → «Sesiones paralelas y las dos cuentas» — con el staging por plumbing, que mueve referencias sin tocarle el worktree a nadie',
      'docs/dos-cuentas.md — el protocolo completo y las tres cosas que hay que recrear a mano en un worktree',
    ],
  },
  {
    fecha: '10 ago', hora: '16:43', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'En local el middleware es no-op: meses de desarrollo por el único camino que no la ejercitaba',
    puntos: [
      'Una clienta instaló la skill y su Claude Code reportó «puede ser que el endpoint necesite un header adicional, o que el token sea de otro entorno». Ninguna de las dos: `/api/agente/*` no estaba en la lista de rutas públicas, así que `proxy.ts` cortaba con un 401 **antes** de que la ruta mirara el bearer. El token estaba bien; la puerta estaba cerrada.',
      '**Por qué vivió meses sin que nadie lo viera, y es la trampa central de esta área: sin `AUTH_SECRET`, `gateConfigurado()` es false y el middleware hace no-op.** Contra `localhost` la integración anda perfecta y falla solo en producción — o sea que **todo el desarrollo pasó por el único camino que no la ejercitaba**. Todo lo que corre en el middleware es invisible en local: si lo que estás construyendo depende de él, en local no lo probaste.',
      'La pista que sirve para cualquier ruta con auth propia: pegarle con una credencial inválida y **leer el TEXTO del 401**. «no autenticado» lo dice el middleware (la ruta ni corrió); el error propio lo dice la ruta. Los dos son 401 y desde afuera se ven iguales — sin distinguirlos se buscan headers y entornos que no tienen nada que ver, que es literalmente lo que propuso el agente de la clienta.',
      'El segundo bug del mismo commit, con la forma clásica del entorno: **una env var con un nombre inventado**. `NEXT_PUBLIC_BASE_URL` no existe en ningún lado; en un lado caía al origin del request (correcto, sin síntoma) y en el otro salía vacía y la skill le pedía la URL al cliente. El error estaba en los dos lados y solo uno dolía.',
    ],
    commits: [
      { sha: '4465e37f', msg: 'La integración con Claude nunca funcionó en producción: el proxy la cortaba', lineas: 266, archivos: 9 },
    ],
    archivos: ['docs/hallazgos-infra.md → «La integración con Claude nunca funcionó desde afuera» y «Una env var con un nombre inventado entrega un artefacto roto»'],
  },
  {
    fecha: '10 ago', hora: '17:20', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Lo que un .md copia se queda viejo: el generador y la guarda del pre-push',
    puntos: [
      '**Las skills son `.md` y no pueden importar nada**, así que la regla de «una cosa, un lugar» ahí no se cumple sola: el módulo se copia con un script y **el pre-push falla si la copia quedó vieja**. Esa guarda es lo único que impide que el problema vuelva, y el mismo día se probó a sí misma — un cambio en `MOLDE_ADVERTENCIA` dejó la copia desfasada y el hook lo atajó antes de pushear.',
      'La copia PÚBLICA de la skill (`plugin/`) existe porque `/plugin marketplace add` exige un repo público, y eso era imposible mientras la skill llevara el token del cliente adentro. Las dos variantes salen de la **misma función**: son el mismo texto con cuatro líneas de diferencia, y copiadas se separan el día que la skill aprenda algo nuevo.',
      '⚠️ **La guarda del generador va EN POSITIVO: se busca el patrón de una credencial** (`mkoag_`, `sk-ant-`, un JWT, un localhost) y se niega a escribir si encuentra algo. No se confía en que la función haga lo correcto, porque **un token en un repo público queda en el historial de git para siempre y rotarlo no lo borra**.',
    ],
    commits: [
      { sha: 'cbfee521', msg: 'Sincronizar la skill con el molde actualizado', lineas: 1, archivos: 1 },
      { sha: 'da749122', msg: 'El plugin público de MaKo, y los títulos del mapa clicables', lineas: 657, archivos: 9 },
    ],
    archivos: [
      'scripts/generar-plugin.mjs — genera plugin/ desde lib/agente-skill.ts, con el escaneo de credenciales',
      'scripts/sync-contrato-detalle.mjs — copia DOS cosas a las skills (el molde del `detalle` y la regla del nombre de proyecto); si agregás una skill que repite una regla, sumala a `DESTINOS`',
      'skills-lock.json — lo que el pre-push compara; pushear con esto sin commitear es cómo `main` quedó desincronizado',
    ],
  },

  // ── 11 al 13 de agosto: los documentos y la máquina ────────────────────────
  {
    fecha: '11 ago', hora: '21:09', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El documento se desfasó del código EN LA MISMA SESIÓN en que se escribió',
    puntos: [
      '**No tardó ni una hora.** El manual de marca se escribió a mano; una corrida de agentes sobre las fuentes reales encontró que la tabla de la gramática **ya** decía «el impacto» donde el módulo dice «el impacto esperado», y «decisión» con tilde donde el tipo vale `decision`. Nadie había tocado nada en el medio.',
      'La consecuencia para esta área: **la regla de «una cosa, un lugar» vale para cualquier `.md` del repo que documente un catálogo**, no solo para las skills. Si un documento que los agentes leen repite un catálogo del código, se genera entre marcadores y el pre-push lo custodia.',
      '⚠️ **Y si el módulo se puede importar, se importa**: acá su única dependencia es un `import type`, que tsx borra en runtime. **Parsear objetos anidados con regex es cómo se cuelan los desfases que el script viene a evitar** — es la diferencia con `sync-contrato-detalle`, que sí tiene que copiar texto.',
      'Detalle de método que se paga barato: la guarda se probó **ensuciando el documento a propósito** para ver que `--check` devuelve 1. Un chequeo que solo se corrió contra el dato bueno demuestra que pasa, no que atrapa.',
    ],
    commits: [
      { sha: '005233e6', msg: 'El manual de marca, ahora derivado del código en vez de copiado', lineas: 691, archivos: 7 },
    ],
    archivos: ['scripts/sync-gramatica-doc.mjs — escribe docs/branding-mako.md desde lib/mako-gramatica.ts, entre marcadores'],
  },
  {
    fecha: '12 ago', hora: '22:39', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'cosecha',
    titulo: '`127.0.0.1` no es `localhost`, y tus propias reglas te confirman lo falso',
    puntos: [
      'La página se ve entera: HTTP 200, el HTML completo, la consola sin un error, todas las requests en 200. Y **ningún click hace nada**. La causa es que Next 16 bloquea el acceso *cross-origin* a sus recursos de desarrollo: el server se anuncia en `localhost` y pedirle desde `127.0.0.1` es **otro origen**, así que los chunks se sirven y el arranque se corta.',
      '**Lo que lo hace caro es que las dos explicaciones que ya tenés escritas en AGENTS.md parecen confirmarse**: «lo rompí yo» y «la otra sesión dejó un `export` a medias». Probar otra ruta **refuerza** la conclusión falsa, porque tampoco hidrata. Tres causas distintas dan exactamente el mismo síntoma, así que se descartan por causa y nunca por parecido.',
      '**La única evidencia está en el stdout del dev server, no en el navegador.** La regla que generaliza: cuando la página se ve pero no reacciona, ahí es el primer lugar donde mirar — ese error no llega al cliente.',
      'Gemelo del mismo entorno, medido esos días: **Turbopack cachea en disco un error de parseo que ya no existe**. Guardar el archivo arreglado no lo despierta, tocar el `mtime` tampoco (el hash es del contenido) y reiniciar el server tampoco, porque hereda el mismo `.next`. Lo único que lo arregla es borrar `.next`. La pista real es que **la línea que cita el error no se corresponde con lo que hay ahí**.',
    ],
    commits: [
      { sha: '4286e307', msg: 'Cosecha: 127.0.0.1 no es localhost para el dev server', lineas: 45, archivos: 1 },
    ],
    archivos: ['docs/hallazgos-infra.md → «Tests y entorno local» — con el atajo de Playwright desde la caché de npx, que fue como se verificó sin panel'],
  },
  {
    fecha: '13 ago', hora: '01:40', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Cuatro días midiendo la notebook, y la respuesta estaba en el bug tracker',
    puntos: [
      '**El arreglo del 9 de agosto no era la cura: aguantó cuatro días y volvió.** Y los cuatro días limpios no los produjo el pin a la gráfica integrada, sino no haber abierto el navegador embebido — se atribuyó la mejora al cambio hecho **sin controlar la variable que decidía**.',
      '**El `exitCode` es una cadena de búsqueda, y eso va ANTES de instrumentar el hardware.** `101457950` es `0x060C201E` y tiene ~10 issues abiertos en el repo de la app, uno reproducido en una RTX 2080 de escritorio SIN gráfica Intel y otro en un ARM64 con GPU Adreno: eso falsa de una sola vez las dos hipótesis que sostenían todo (la híbrida y el driver). Es una regresión de la app, no de esta máquina.',
      '⚠️ **Un monitor que hay que acordarse de arrancar mide una vez.** El que se escribió el 9 para cazar el próximo crash tenía el CSV vacío cuando el crash llegó. Va como tarea programada o no mide.',
      '⚠️ **Un sensor congelado es peor que uno ausente: el ausente se nota, el congelado se cita.** La temperatura salía de la fuente que exige admin, que en este equipo devuelve 398 lecturas idénticas en tres horas — el veredicto «no fue térmico» iba a salir de un número que no medía nada.',
      '⚠️ **En un evento que MATA al proceso, el estado que lo describe es el del tick ANTERIOR.** La fila del crash decía «carga 2%, RAM 5,3 GB, 0 procesos» y se leía como que había crasheado en reposo: los tres números eran correctos y tomados 20 s tarde, con la app ya muerta. El tick previo decía 80%, 2,2 GB y 18 procesos.',
      'Lo que sí se sostuvo es la medición local: el disparador es el navegador embebido — **7 de 7 crashes dentro de los 41 s de un «Created browser preview»**. Nada de esto se borró del documento: la hipótesis equivocada queda escrita al lado de su refutación, que es lo que impide volver a recorrerla.',
    ],
    commits: [
      { sha: 'e53a70eb', msg: 'El pin a la Intel no cerró el caso, y el sensor que exigía admin estaba congelado', lineas: 92, archivos: 1 },
      { sha: 'eca4b201', msg: 'Lo que mata a Claude es el navegador embebido: 7 de 7, a menos de 41 segundos', lineas: 87, archivos: 1 },
      { sha: '4469fc94', msg: 'No era el hardware: el crash es un bug conocido de la app, con 10 issues abiertos', lineas: 65, archivos: 1 },
    ],
  },

  // ── 14 al 17 de agosto: la herramienta con la que el agente lee ────────────
  {
    fecha: '14 ago', hora: '23:15', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La búsqueda devuelve otra cosa que la que dice el archivo: un bug vivo que nunca existió',
    puntos: [
      'Se reportó como **bug vivo en producción** que una línea del webhook tenía barras invertidas. El archivo siempre tuvo barras normales — `git log -L 175,175` muestra que nació así y nunca cambió de forma. La causa real: **la herramienta de búsqueda reescribe `/` como `\\` en el CONTENIDO que devuelve**. Un `//` que vuelve como `\\` es la firma, y solo pasa en los resultados cuyo path viene acortado a relativo, así que en el mismo bloque hay líneas sanas y líneas mangleadas.',
      '**«Lo verifiqué ejecutándolo» no verifica nada si lo que ejecutás es tu transcripción.** Se pegó en node el string que había devuelto la búsqueda y node confirmó, con toda razón, la cadena mangleada. Una verificación que no vuelve a la FUENTE es una tautología — y vale igual para lo que devuelve un subagente: es prosa, no evidencia.',
      'Las dos reglas que quedan: **`Grep` sirve para ENCONTRAR, no para CITAR** —antes de reportar un bug que depende de un carácter, releé la línea con `Read`—, y **antes de escribir «bug vivo en producción», `git log -L`**: si la línea nunca tuvo esa forma, el bug es del diagnóstico.',
      'El mismo commit trae la contracara sana: el otro arreglo pedido **sí** era real (el webhook no miraba de qué canal venía el mensaje). De dos reportes del dueño, uno existía y el otro nunca; distinguirlos costó volver al archivo.',
    ],
    commits: [
      { sha: '375768d7', msg: 'Chatwoot: filtrar por canal, y la autopsia del bug que no existía', lineas: 560, archivos: 7 },
    ],
    archivos: ['docs/hallazgos-comunicacion.md — la autopsia completa; la regla, en AGENTS.md → «Lo que devuelve la búsqueda NO es el archivo»'],
  },
  {
    fecha: '16 ago', hora: '10:12', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Cinco archivos que la búsqueda declaraba binarios, y AGENTS.md se infectó escribiendo la regla',
    puntos: [
      '**Un solo byte NUL (0x00) hace que ripgrep conteste «Binary file matches» y no devuelva ni una línea.** Es peor que la trampa del `\\`: ahí queda una firma rara que delata el problema, acá **contesta vacío y el vacío parece una respuesta**. En una búsqueda de un archivo se nota; en una de veinte, el archivo se lee igual que si no tuviera lo que buscabas. Se descubrió buscando `extraFooter` en un componente y obteniendo cero líneas.',
      'Eran cinco, todos con el byte crudo donde el código quería el escape (un separador, un centinela, dos clases de regex, un comentario). Todos pasan a `\\u0000`, **que significa exactamente lo mismo en una string, en una clase de regex y en un comentario** — no hay razón para escribir el byte.',
      '⚠️ **Y la confirmación más literal posible: al escribir la regla en AGENTS.md, el ejemplo quedó con un NUL de verdad adentro.** El documento que explica que un archivo con NUL es invisible para la búsqueda pasó a ser invisible para la búsqueda. Lo delató `git commit`, anunciándolo como «Binary file AGENTS.md matches». Confirma lo que la regla dice: **no hay síntoma** — el archivo se ve y se lee perfecto, y lo único raro es que grep contesta vacío. Por eso la regla pide `file <ruta>` cuando una búsqueda no encuentra algo que jurabas que estaba.',
      '**Sacar un NUL genera un diff de archivo entero y no se puede evitar**: con el byte adentro git guardaba el blob como binario (verbatim, sin normalizar) y al sacarlo pasa a texto, con lo cual `core.autocrlf` lo lleva a LF de una. El `git blame` de esos archivos queda apuntando a ese commit — vale la pena igual, pero va en un commit propio y avisado.',
    ],
    commits: [
      { sha: 'f2ff187b', msg: 'Cinco archivos que la búsqueda no podía leer: un byte NUL crudo', lineas: 354, archivos: 5 },
      { sha: '7f7e3cf2', msg: 'Le metí un byte NUL a AGENTS.md escribiendo la regla del byte NUL', lineas: 852, archivos: 1 },
    ],
  },
  {
    fecha: '17 ago', hora: '20:39', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Una ruta escrita a mano que apunta a la nada, y el punto ciego que la tapaba',
    puntos: [
      '**Las rutas escritas a mano son el enganche de todo el sistema que leen los agentes** —el `Vive en:` de cada hallazgo, el `vive[]` de cada área, el `archivos[]` de cada hito— y **ninguna la mira el compilador**. Cuando una queda vieja no falla: **desaparece en silencio**, y se lleva con ella todo lo que colgaba de ahí.',
      'Dos casos medidos. La regla de que **la sidebar no scrollea** estaba escrita y se violó igual, porque su `Vive en:` apuntaba a un archivo que no existe desde el rediseño: grepear la ruta real —el método que la casa manda usar— no devolvía nada, así que para cada sesión nueva esa regla no existía. Y el `vive[]` de Conocimientos omitía `public/` y los scripts del pipeline: su panel veía **11 de 68 commits**, y un barrido que preguntaba «qué se trabajó y no quedó anotado» declaró tranquila al área más movida del mes.',
      '⚠️ **El punto ciego de la propia cosecha**, que es la parte que más vale: el cruce solo miró las 9 áreas que YA tenían bitácora, así que declaró tranquilas a las otras 113. Medido después: **29 áreas con 8 o más commits en 10 días y CERO registro, 696 commits en total**. Un inventario que solo recorre lo que ya está inventariado no encuentra nunca lo que falta.',
      '`tests/dev-areas.test.ts` chequea contra el disco que cada ruta declarada exista, y cazó 30 rutas plausibles pero inexistentes. **Lo que NO puede chequear es la OMISIÓN:** una ruta que falta no da error, da un punto ciego. Por eso al declarar un área el `vive[]` tiene que cubrir dónde cae el trabajo de verdad —incluidos `public/`, `scripts/`, `docs/` y las migraciones—, no solo los componentes de la pantalla.',
      'Y la contracara, la razón de existir de este archivo: **lo que aprende un subagente no vuelve solo.** Lo único que llega es el texto que devuelve; las transcripciones quedan en disco y nadie las abre. Lo que no se escribe en el repo, se pierde.',
    ],
    commits: [
      { sha: '5e45e545', msg: 'Los 33 hitos que faltaban, y el punto ciego que los tapaba', lineas: 585, archivos: 9 },
    ],
    archivos: [
      'app/admin/dev/areas.ts — el `vive[]` de las 121 áreas; el de ESTA se amplió el 17/08 porque declaraba 5 rutas y el trabajo caía en docs/ y scripts/',
      'tests/dev-areas.test.ts — la red que chequea existencia, y que no puede ver lo que falta',
    ],
  },
  {
    fecha: '25 ago', hora: '16:50', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: '¿De verdad no podés saber en qué cuenta estamos?',
    pedido: 'El useremail no es ese, realmente no tienes acceso a saber en que cuenta estamos?\n\n[y después] No quiero decirtelo, lo debes saber... En que email estoy logeado? No lo sabes?\n\n[y después] No tienes que buscar en ningún archivo ni nada de eso... Solo revisar en que cuenta esta logueado esta sesión de claude, con que email.',
    puntos: [
      'Yo había contestado «claude2» con confianza apoyándome en el `userEmail` del contexto. **Daba el resultado correcto por el camino equivocado**, y Martín lo detectó en un mensaje.',
      '⚠️ **El `userEmail` que el harness inyecta ES `~/.claude.json` → `oauthAccount.emailAddress`.** No es una lectura viva de la sesión: es ese archivo, y se escribe al *loguearse*, no al abrir sesión. La memoria decía lo contrario —que el `userEmail` era la fuente confiable **y el archivo el que mentía**— cuando son la misma cosa.',
      'Las cuatro señales, medidas: el `userEmail` decía `mbustos@elevate.com.mx` (la cuenta 1) con la sesión corriendo en la 2; `.credentials.json` tenía mtime del 21 de julio **y su refresh token venció el 17 de agosto**, o sea muerto hace 8 días; `~/.claude-martin` nunca tuvo credenciales; y el Local Storage de la app de escritorio trae un solo email desde julio de 2025, así que no discrimina.',
      'Callejón ya recorrido, para que nadie lo repita: buscando emails en `%APPDATA%\\Claude` aparece `evan.exe@gmail.com` 33 veces. Es Evan Wallace, el de esbuild, dentro de un `rootfs.vhdx` con metadata de npm.',
      'Y el intento de mirar la pantalla está **prohibido por diseño**: no se puede dar control de la ventana de Claude a Claude. No es una limitación de hoy, es permanente.',
      'De paso explicó un corte: las cuatro sesiones del día murieron entre 15:44 y 16:38 con «Your organization has disabled Claude subscription access for Claude Code». Esa organización es la de `mbustos@elevate.com.mx` — la cuenta 1 — y de ahí el pase a la 2.',
    ],
    commits: [
      { sha: '502b4494', msg: 'cosecha: no hay forma de saber del disco en qué cuenta corre la sesión', lineas: 35, archivos: 1 },
    ],
    archivos: ['docs/dos-cuentas.md — las cuatro señales medidas y por qué ninguna sirve'],
  },
  {
    fecha: '25 ago', hora: '17:11', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La cuenta se declara en un archivo, y un hook la lee al abrir',
    puntos: [
      'Como ninguna señal de la máquina sirve, la fuente de verdad pasa a ser **declarada**: `~/.claude/cuenta-activa.txt` con una línea, y un hook `SessionStart` que la inyecta al contexto **con la fecha en que se anotó**, para que se note cuando quedó vieja.',
      'Probado en tres pasos, porque el escapeo del comando adentro del JSON es donde esto se rompe en silencio: el comando suelto devuelve JSON válido, el `settings.json` conserva sus seis claves, y el comando **releído desde el JSON** produce la misma salida.',
      '⚠️ El hook dispara **fuera del turno que lo escribe**, así que eso no se puede verificar en la misma sesión. Se confirma recién al abrir la siguiente.',
    ],
    commits: [
      { sha: 'f5448137', msg: 'La cuenta activa se declara en un archivo y la lee un hook', lineas: 20, archivos: 1 },
    ],
    archivos: [
      '~/.claude/cuenta-activa.txt — la fuente de verdad, la declara Martín',
      '~/.claude/settings.json — el hook SessionStart',
    ],
  },
  {
    fecha: '25 ago', hora: '17:20', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Quién es cada cuenta es fijo, y no se deduce del email',
    pedido: 'La cuenta 1 SIEMPRE es de Mauricio y la cuenta 2 SIEMPRE es de Leandro...\n\n[y después, cuando dije que no tenía el email de Leandro] Si tienes el email de leandro, me lo haz dicho antes...',
    puntos: [
      'Lo que faltaba no era un dato suelto sino **la regla de titularidad**: `claude1` = Mauricio Bustos, `claude2` = Leandro Tejado, y no cambia. No es una ventana de cuota ni un rótulo de cliente.',
      '⚠️ Yo tenía el email de Leandro delante —`tejadomartin@gmail.com`— y lo descarté **por una memoria equivocada**: `quien-es-quien` afirmaba que ese email y `martinkoncke@gmail.com` «son la misma persona». Con esa línea encima, cada vez que veía el mail de Leandro lo leía como el de Martín. Le contesté a Martín su propio mail personal cuando preguntaba por la cuenta de Claude.',
      '**La regla general, que es lo que queda:** el nombre adentro de un email no dice de quién es la cuenta. `tejadomartin@` se leía como «Martín» y es de **Tejado**; `mbustos@` es de Mauricio Bustos, que no es quien desarrolla. El titular se pregunta, no se infiere del string.',
      'Se destraba algo de atrás: la sesión del 18/08 corría con `tejadomartin@gmail.com`, o sea que **era la cuenta 2**. Ese día firmé un commit `claude2`, Martín dijo que estaba mal y lo di por error mío. Estaba bien; lo que estaba mal era la tabla que consulté después.',
    ],
  },
  {
    fecha: '25 ago', hora: '17:23', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Si armamos un mecanismo para anotar todo, ¿cómo no tenés el contexto?',
    pedido: 'Pero como es posible que no tengas el contexto si justamente armamos contigo y con la otra cuenta un mecanismo para ir anotando tooodo lo que haciamos...',
    puntos: [
      'La objeción era correcta y el error mío. Yo había leído **los deltas de las últimas 48 horas** —los commits y lo que se le agregó a los `hallazgos-*` esos dos días— y había declarado huecos. Leí **lo que cambió**, no **lo que sabemos**: son cosas distintas.',
      'El corpus son 42 documentos y 2,6 MB. Se leyeron enteros con 19 lectores en paralelo y salió `docs/estado-del-arte.md`.',
      '**Lo que ningún documento por área podía dar, porque solo aparece al cruzarlos: los 8 modos de falla que mordieron en MÁS DE UN área.** Un modo de falla que se repite en dos lados es una propiedad del sistema, no una anécdota. El primero: el fallback a `OWNER_WS` es la fuga estructural del producto —29 `?? OWNER_WS` a mano en 19 libs— y el agravante es que **`OWNER_WS = 1` no es la plataforma, es Mauricio, un cliente**; la plataforma es el ws9.',
      '⚠️ El documento se marca a sí mismo como **material de segunda mano**: sale del corpus, que a su vez sale de 261 corridas multi-agente, no de releer el árbol de hoy. Antes de actuar sobre cualquier agujero de seguridad de ahí, verificar contra el código.',
    ],
    commits: [
      { sha: '4cc733ad', msg: 'Estado del arte: el corpus leído entero, y los 8 modos de falla que se repiten', lineas: 329, archivos: 2 },
    ],
    archivos: ['docs/estado-del-arte.md — 67 KB, con su fila en docs/hallazgos.md'],
  },
  {
    fecha: '25 ago', hora: '17:41', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Había otra sesión trabajando al mismo tiempo, y ninguna lo sabía',
    puntos: [
      'Al commitear aparecieron **~160 archivos sin commitear que no estaban una hora antes**. Primero sospeché de mis propios agentes: se descartó revisando sus transcripts —cero escrituras a esas rutas, cero comandos `node`—.',
      'Era **otra sesión de Claude corriendo en paralelo** sobre el mismo clon, abierta 25 minutos antes, a la que Martín le había pedido terminar la bajada del curso que yo acababa de reportar como pendiente.',
      '⚠️ **El corpus documenta bien el pasado; nadie documenta el presente concurrente.** Por eso «¿tengo todo el contexto?» no tiene respuesta estable: cambia mientras se contesta. Mi reporte de «quedó a mitad» era cierto a las 16:38 y falso a las 17:41.',
      'No hubo daño porque commiteé **por ruta explícita**. Con `git add -A` me habría llevado sus 160 archivos a medio hacer adentro de mi commit.',
      '⚠️ Y una corrección al modelo mental: las dos sesiones **comparten el mismo clon**, no dos copias. Mismo `.git`, mismo índice.',
    ],
  },
  {
    fecha: '25 ago', hora: '18:50', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que se guarde todo, y en el sistema que ya existe',
    pedido: 'Bueno, asegurate de guardar bien la info desde a partir de ahora, independientemente de la cuenta en la que esté\n\n[y después] Y es importante que se vayan guardando todos MIS prompts y el resumen de las cosas realizadas... Para eso ya teniemos todo el sistema en SuperAdmin en la sección de "dev"',
    puntos: [
      'El disparador fue una pregunta que no se pudo contestar: «¿desde qué fecha a qué fecha estuve en la cuenta 2?».',
      '⚠️ **Los trailers `Claude-Cuenta` anteriores al 25/08 no son confiables.** Al graficarlos, la firma alterna entre `claude1` y `claude2` **cada dos o cuatro minutos** sobre trabajo continuo, y los commits del medio son features normales, no otra clase de tarea. Nadie cambia de cuenta cuatro veces en media hora: el trailer registraba **la adivinanza**, no la cuenta. Y no existe antes del 11/08 16:38 — hay 39 commits sin firma.',
      'Los bloques **largos** sí son creíbles, porque cientos de commits seguidos no se explican por ruido: 97 commits del 16 al 17/08, 68 del 13 al 14, 39 del 15 al 16.',
      'La segunda mitad del pedido es la que importa más: **no construir nada nuevo**, usar el registro de `/admin/dev` que ya existía y ya tenía el campo `pedido` para el texto literal.',
    ],
  },
  {
    fecha: '25 ago', hora: '18:55', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La cuenta y la sesión se registran solas, en vez de adivinarse',
    puntos: [
      'Tres archivos, todos **fuera del repo** porque tienen que sobrevivir a re-clonar: `cuenta-activa.txt` (la declara Martín), `bitacora-sesion.sh` (el script, comentado con el porqué) y `bitacora-sesiones.tsv` (fecha, acción, cuenta e id, por cada apertura y cierre). Ese TSV es lo que contesta «desde qué fecha a qué fecha».',
      'Dos hooks: `SessionStart` inyecta la cuenta con su titular y **avisa si hay otra sesión viva**; `SessionEnd` registra el cierre.',
      '⚠️ **Detectar la sesión paralela por `mtime` da falsos: dio 3 donde había 1.** Un reindexado de Claude Code tocó nueve transcripts a la vez y todos quedaron con la misma hora. Lo que no miente es el último `timestamp` escrito ADENTRO del `.jsonl`. Leer la cola de todos tardaba 4,9 s en el arranque; con el `mtime` de prefiltro baja a 1,1 s.',
      '⚠️ Y me tropecé con una trampa **ya documentada**: escribí un script por heredoc, el bash se comió las barras, `\\b` entró como byte de control 0x08 y quedó incrustado en un archivo de memoria. La memoria `heredoc-come-backslash` decía exactamente esto. Se detectó escaneando bytes de control y se reparó con Write. **Que la trampa esté escrita no impide pisarla — los scripts van con Write, nunca por heredoc.**',
    ],
    commits: [
      { sha: '35625add', msg: 'La cuenta y la sesión se registran solas, en vez de adivinarse', lineas: 58, archivos: 2 },
    ],
    archivos: [
      '~/.claude/bitacora-sesion.sh — el script que leen los dos hooks',
      '~/.claude/bitacora-sesiones.tsv — una línea por apertura y por cierre',
      'AGENTS.md — la regla: la cuenta no se deduce, y mirá si hay otra sesión antes de tocar git',
      'docs/dos-cuentas.md — las tres piezas y por qué el mtime no alcanza',
    ],
  },
  {
    fecha: '27 sep', hora: '10:36', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Volví después de 16 días: ¿tenés el contexto?',
    pedido: 'Estuve trabajando en la otra cuenta. Le pedí a los ultimos chats que se aseguraran de guardar el contexto y lo ultimo que trabajamos. ¿Lo tienes?',
    puntos: [
      '**Sí, y esta vez el mecanismo contestó solo la parte que en agosto no se podía contestar:** la cuenta 1 estuvo del **11/09 15:55 al 27/09 10:13**, exacto, leído de `~/.claude/bitacora-sesiones.tsv`. En agosto la misma pregunta no tenía respuesta porque el único dato eran los trailers, que se firmaban adivinando.',
      'Y las 4 sesiones de esa mañana **sí cumplieron el handoff**: Martín les mandó el mismo mensaje literal a las 10:13, las cuatro cosecharon antes de cerrar y ninguna quedó cortada a mitad de una edición.',
      '⚠️ **Pero el pedido del 25/08 —que se guardaran los prompts de Martín— no se cumplió en 16 días.** 152 commits, 19 de cosecha, 25 documentos de contexto tocados… y **CERO hitos** en las 39 bitácoras de `/admin/dev`. La cosecha se cumplió a rajatabla y el registro no se tocó.',
      '**La causa no fue desidia sino dónde vivía cada regla:** la de los hallazgos estaba en `AGENTS.md`, que es lo que se lee antes de commitear; la del registro vivía en un comentario de `_registro/tipos.ts` y en una memoria. **Una regla que no está en `AGENTS.md` no existe para una sesión nueva**, y el modo de falla es silencioso: el trabajo sale igual y lo único que falta es el rastro de quién lo pidió.',
    ],
  },
  {
    fecha: '27 sep', hora: '11:45', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'El relevo se escribe, y dos agujeros del mecanismo de cuentas',
    puntos: [
      'Sale `docs/relevo.md`: 12 agentes sobre los 16 días —los diffs de cada documento, las 45 tandas de `AGENTS.md`, los 152 commits por hilo y los transcripts de las 4 sesiones—. **Se pisa en cada relevo** y las versiones viejas quedan en el historial de git, para no acumular archivos con fecha que nadie reabre.',
      '⚠️ **El trailer `Claude-Cuenta` nunca se parseó.** Git sólo trata como trailers el último bloque contiguo, y la línea en blanco antes de `Co-Authored-By` lo dejaba afuera. `%(trailers:key=Claude-Cuenta)` devuelve vacío en 6 de los 7 commits medidos. A ojo el mensaje se ve perfecto — por eso nadie lo notó — y toda herramienta que cuente por cuenta lee **0**. Arreglado: el bloque va pegado.',
      '⚠️ **El contexto del hook es una FOTO del arranque.** Tres sesiones leyeron `claude1` a las 10:12-10:13, Martín cambió de cuenta y reescribió el marcador **10:14:43**, y dos commits posteriores (`cbb6fcd2`, `72aa1109`) salieron firmados `claude1` con el marcador ya en `claude2`. Queda la regla de releer el marcador antes de firmar, en `AGENTS.md` y en el propio mensaje del hook.',
      'Detalle que vale para leer la bitácora: una sesión con `inicio claude1` y `fin claude2` **no está corrupta** — es el registro correcto de una cuenta que cambió a mitad.',
      'Y la sección «La cosecha» de `AGENTS.md` gana su tercer destino: `app/admin/dev/<área>/bitacora.ts`, con `tipo: \'prompt\'` y el texto literal en `pedido`. Esta entrada es la primera que lo cumple.',
    ],
    commits: [
      { sha: 'f17770d2', msg: 'El relevo entre cuentas se escribe, y dos agujeros del propio mecanismo', lineas: 446, archivos: 3 },
    ],
    archivos: [
      'docs/relevo.md — el último traspaso, reescrito en cada relevo',
      'AGENTS.md — el trailer pegado, releer el marcador, y el registro como tercer destino de la cosecha',
      '~/.claude/bitacora-sesion.sh — el hook ahora avisa que su contexto es una foto',
    ],
  },
  {
    fecha: '5 oct', hora: '10:36', chat: 'Estrategia 2 CUENTAS', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Se acaba la cuota: que los cuatro chats guarden bien el contexto',
    pedido: 'Estoy cercano a acabar la cuota mensual y me pasaré a la otra cuenta... Asegurate de que todos los chats estén guardando bien el contexto para seguir en la otra cuenta',
    puntos: [
      'El riesgo real no era el cambio de cuenta sino lo que había en el árbol: **60+ archivos sin commitear de TRES sesiones a la vez**, dos migraciones nuevas y la feature `replay` entera. Si alguna hacía `git add -A` se llevaba el trabajo a medio hacer de las otras dos adentro de su commit.',
      'Se les mandó a los cuatro el mismo checklist por `send_message`, con la lista de qué archivos parecía de cada uno y la instrucción de no tocar lo dudoso. Los cuatro cerraron: árbol verde, typecheck 0, suite 3410/0 y producción Ready.',
      '⚠️ Y apareció un bloqueo que no es de nadie en particular: **el `pre-push` typechequea el árbol ENTERO**, así que un refactor a medio hacer de una sesión le frena el push a las otras tres.',
    ],
  },
  {
    fecha: '5 oct', hora: '11:10', chat: 'Estrategia 2 CUENTAS', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: '¿Y los audios y llamadas que son el Norte del negocio?',
    pedido: 'Seguro que esta guardado todo el contexto para la otra cuenta? Incluido los audios y llamadas que estuvimos analizando como «Norte» del negocio',
    puntos: [
      'La pregunta encontró el hueco que yo no había mirado. Los **análisis** estaban commiteados; las **fuentes** no, y medido con grep sobre `docs/` y `AGENTS.md`: `llamada-leila-01oct-transcripcion.txt` lo nombraban 3 documentos, y **`audio-mau-04oct.txt` y `audios-22-sep-transcripcion.md` no los nombraba NADIE**.',
      '⚠️ Y `audio-mau-04oct.txt` es la fuente de `docs/proyeccion-04oct.md`, que es lo primero del traspaso.',
      'Es el modo de falla de «una ruta que apunta a la nada» **dado vuelta**: no una ruta sin archivo, sino un archivo sin ruta que lo nombre. Una sesión nueva no puede buscar lo que no sabe que existe. Ya había mordido el 16/09 con `entrega-martin.md`: estaba en Descargas, se dio por perdido y se bloquearon cuatro tareas por nada.',
      '⏳ Lo que no espera a nadie: **los audios de WhatsApp caducan a los ~30 días** y los `.ogg` de Descargas son la última copia. El más viejo que queda es del 21/08. Sale `docs/fuentes-fuera-del-repo.md`.',
    ],
  },
  {
    fecha: '5 oct', hora: '11:40', chat: 'Estrategia 2 CUENTAS', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que el chat orquestador sepa dónde quedaron los otros tres',
    pedido: 'Ahora los otros 3 chats terminaron. Voy a dejarlo acá y pasarme a la otra cuenta. Quiero que te ASEGURES de que la otra cuenta tiene absolutamente todo el contexto. Mis prompts, lo ultimo que trabajé... Quiero iniciar en la otra cuenta y en el chat de «Estrategia e cuentas» preguntarle como seguimos y que sepa que estoy trabajando en los ultimos 3 chats y en que quedaron',
    puntos: [
      'Lo que faltaba era el briefing del **propio chat orquestador**: los otros cuatro tenían el suyo y éste no. Sale `docs/relevo/estrategia-2-cuentas.md`, pensado para contestar «¿cómo seguimos?» sin que Martín cuente nada.',
      'Lo que lleva, y es lo que no sale de ningún commit: **las cuatro decisiones que lo esperan a él** — el «por tiempo» de una secuencia que el Chatbot decidió solo, las secuencias de la entrega (el motor espera un EMBUDO y esto tiene un PRODUCTO), dónde vive el programa de Mauricio, y si se carga o no `proyeccion-04oct.md`.',
      '⚠️ Más los límites medidos para que nadie los redescubra: no se puede abrir un chat nuevo desde una sesión, la lista de chats está partida por cuenta aunque los transcripts sean compartidos, y el id de la app no es el del transcript.',
    ],
  },
  {
    fecha: '5 oct', hora: '11:45', chat: 'Estrategia 2 CUENTAS', cuenta: 'claude2',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Las cuatro trampas del clon compartido, y dos errores míos',
    puntos: [
      '⚠️ **`/tmp` está compartido entre las sesiones.** Chatbot corrió `/tmp/probe.mjs` y le volvió la salida del script de OTRO chat. Customer Success encontró la mitad cara: **`git commit -F /tmp/msg.txt`** commitea el mensaje de otra sesión con tu diff y tu trailer, y sale bien, así que nadie lo audita.',
      '⚠️ **El número de migración es un recurso compartido:** CRM y Chatbot eligieron `0190` a la vez. Lo resolvió que uno le avisara al otro, no una herramienta.',
      '⚠️ **`git add <ruta>` NO acota el commit** — se commitea todo el índice. Me llevé una baja de 430 líneas de la sesión del CRM adentro de un commit mío, justo después de advertírselo a los cuatro. Para acotar de verdad: `git commit <ruta>`.',
      '⚠️ **Un reporte a otra sesión sin hora es una acusación.** Le dije a Customer Success que su edición bloqueaba el push del repo; la cronología mostró que el árbol ya estaba verde desde 14 minutos antes. Gastó un turno de cuota defendiéndose. «Leí esto a las 11:08» envejece solo; «tu edición bloquea el repo» obliga a defenderse.',
      'Y una de medición: grepear `fecha: \'5 oct\'` con comillas simples da CERO sobre un archivo que usa dobles. Reporté un cero falso. El patrón que asume una convención mide la convención, no el dato.',
    ],
    archivos: [
      'docs/relevo/estrategia-2-cuentas.md — el briefing del chat orquestador',
      'docs/fuentes-fuera-del-repo.md — los audios y llamadas que no están versionados',
      'AGENTS.md — las cuatro trampas del clon compartido',
    ],
  },
];
