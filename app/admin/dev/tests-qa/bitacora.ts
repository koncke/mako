// =============================================================================
// Tests & QA — el registro de construcción del área
// =============================================================================
// Alcance: los 96 archivos de `tests/*.test.ts` que corre `npm test`
// (`node --import tsx --test`), el hook `.git/hooks/pre-push` —que es la ÚNICA
// red de tipos que queda, porque `next.config.ts` tiene
// `typescript.ignoreBuildErrors: true`— y los scripts que ese hook usa para que
// lo copiado a las skills y a los docs no se quede viejo.
//
// De dónde salió esto: fecha, hora, sha y tamaño salen de `git log` sobre las
// rutas del área; el porqué de cada tanda, del CUERPO de los mensajes de commit,
// que en este repo son largos y explican la decisión; las trampas del runner y
// las reglas de verificación, de docs/hallazgos-infra.md → «Tests y entorno
// local» y «Build, deploy y entrega». La `cuenta` sale del trailer
// `Claude-Cuenta:`; donde no está, se aplicó la convención del repo (antes del
// 8/8, claude1).
//
// NO es un changelog. «Se agregó el test X» ya está en el commit. Acá va por qué
// existe esa guarda, qué la hizo falta, y —sobre todo— las veces que el verde no
// estaba probando nada.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'El runner', detalle: '`node --test` + tsx sobre funciones puras · sin DOM, sin mocks, sin base · 96 archivos', estado: 'hecha' },
  { titulo: 'El pre-push como única red', detalle: 'Cuatro chequeos: tipos + contrato del detalle + gramática de marca + plugin público', estado: 'hecha' },
  { titulo: 'Guardas de contrato', detalle: 'Lo que el compilador no ve: TENANT_TABLES↔columnas, rutas públicas, el veto de Claude, el `vive[]` contra el disco', estado: 'hecha' },
  { titulo: 'Guardas de TEXTO', detalle: 'Lo que el cliente lee en pantalla · string literals y JSX suelto, nunca el fuente entero · se verifican por mutación', estado: 'hecha' },
  { titulo: 'Ensayos de punta a punta', detalle: 'scripts/ensayo-bucle-cs.ts corre los 5 pasos contra prod y LEE LA BASE después de cada uno · hoy hay uno solo', estado: 'sigue' },
  { titulo: '`npm test` adentro del pre-push', detalle: 'Hoy NO corre: un renombre pasa el typecheck en verde y rompe una aserción en main. Son ~9 s por push y la decisión sigue abierta', estado: 'cola' },
  { titulo: 'Ejecutar un route handler', detalle: 'Hoy el «test» de una ruta es LEER su fuente como texto y afirmar sobre ella. Caza el drift, no el comportamiento', estado: 'cola' },
  { titulo: 'El hook versionado', detalle: 'Vive en `.git/hooks`: un reclon se lo lleva en silencio y hay que recrearlo a mano desde AGENTS.md', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── julio: los cimientos ───────────────────────────────────────────────────
  {
    fecha: '5 jul', hora: '03:03', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El runner nace probando funciones puras, no pantallas',
    puntos: [
      'La decisión que definió todo lo que vino después: `node --test` + tsx sobre **funciones puras**, sin DOM, sin mocks y sin base. Lo primero que se blindó fue el pipeline del funnel contra funnels **custom** —venta directa sin reunión, VSL+Webinar—, que es exactamente donde un CRM por-cliente se rompe y donde nadie prueba a mano.',
      'Ocho días después llegó la forma que hoy es la marca del área: el **test de contrato**. `tenant-tables-contract` valida por TEXTO que cada tabla del Set `TENANT_TABLES` tenga su columna `workspace_id` en las migraciones, porque `lib/workspace.ts` es `server-only` y el Set ni siquiera se exporta. Es el drift que TypeScript no puede ver: agregar la tabla al Set y olvidar la columna revienta recién en runtime, con un error de Postgres.',
      'Y la dirección inversa es la que más vale: una tabla con `workspace_id` que **no** está en el Set es una fuga silenciosa. Ese chequeo habría cazado el leak de `v_cohortes` **antes** de la migración 0084.',
      '⚠️ La trampa que hereda todo el área: **si el módulo tiene `server-only`, ningún test lo puede importar.** De ahí sale la regla de la casa de sacar la condición que gobierna algo peligroso a un módulo sin `server-only` (`exigirClienteDePrueba`, `lib/model-catalogo.ts`, `lib/cron-ronda.ts`) — si vive adentro del que hace el trabajo sucio, queda sin red justo donde más duele.',
    ],
    commits: [
      { sha: '5d74cb93', msg: 'test(funnel): tests de las funciones puras del pipeline (node --test + tsx)', lineas: 105, archivos: 2 },
      { sha: '7dbef04e', msg: 'test: contrato TENANT_TABLES↔columnas + buildJourney + formatters', lineas: 174, archivos: 3 },
    ],
    archivos: [
      'package.json — `"test": "node --import tsx --test tests/*.test.ts"`, el único comando del área',
      'tests/tenant-tables-contract.test.ts — el primer test de contrato: lee el fuente como texto porque el módulo es server-only',
    ],
  },
  {
    fecha: '23 jul', hora: '21:34', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El typecheck sale del build, y la única red pasa a vivir en `.git`',
    puntos: [
      'El chequeo de tipos eran ~65 de los ~99 segundos de cada compilación, así que se apagó en el build (`typescript.ignoreBuildErrors: true`) y se movió a `.git/hooks/pre-push`, que corre `npm run typecheck` y **bloquea el push**. Al vivir en `.git` aplica a cualquier sesión que pushee desde este clon sin que ninguna tenga que acordarse — que es el punto, porque hay varias en paralelo.',
      '⚠️ **Y es la fragilidad estructural del área: los hooks de git NO se versionan.** Si se reclona el repo, la red desaparece **en silencio** y un error de tipos vuelve a llegar a producción. Por eso el contenido para recrearlo está escrito entero en AGENTS.md: es lo único que sobrevive a un clon nuevo.',
      '⚠️ **El porqué original era el diagnóstico equivocado**, y tardó tres semanas en descubrirse (ver 13 de agosto). Se hizo para bajar la factura de Build CPU y no podía bajarla. El cambio se dejó igual —vale por velocidad—, pero el comentario que afirmaba «el 95 % del gasto variable» era falso.',
      'La otra mitad, la que se olvida: **el hook NO corre `npm test`.** Son ~9 segundos más por push y la mayoría de los cambios no los necesita, pero eso significa que un renombre pasa el typecheck perfecto y deja una aserción rota en `main`. Ya pasó: al renombrar la tab «Guiones» a «Ads Writer» el push salió verde, se desplegó, y el test del título quedó roto en producción.',
    ],
    commits: [
      { sha: '3fe463a3', msg: 'Sacar el typecheck del build y moverlo a un hook de pre-push', lineas: 65, archivos: 4 },
    ],
    archivos: [
      '.git/hooks/pre-push — hoy son CUATRO chequeos: tipos, contrato del detalle, gramática de marca y plugin público',
      'next.config.ts — `typescript.ignoreBuildErrors: true`, con el comentario ya corregido',
      'AGENTS.md — el contenido del hook, para recrearlo cuando un reclon se lo lleve',
    ],
  },

  // ── agosto: las guardas ────────────────────────────────────────────────────
  {
    fecha: '9 ago', hora: '01:15', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tres guardas sobre cosas que ningún compilador mira',
    puntos: [
      '**Un test que custodia PLATA.** El reclamo era «el Perro sigue usando Claude para tareas simples» y el Perro no tenía nada que ver: lo que cobraba era `plan-fathom`, que nunca tuvo override y caía en su `def: SONNET`. Queda la regla con sus dos capas —el `def` de una feature es un proveedor gratis, y si cobra, `pagoPorque` dice qué se compra— y `tests/model-registry.test.ts` **falla si falta**. Para que ese test pudiera existir hubo que sacar el catálogo a `lib/model-catalogo.ts` **sin `server-only`**: la guarda del gasto no puede vivir donde ningún test la alcanza.',
      '**Un test que custodia RUTAS ESCRITAS A MANO.** Al declarar las 121 áreas de `/admin/dev`, `tests/dev-areas.test.ts` chequea contra el DISCO que exista cada ruta del `vive[]`. Cazó **30 al primer intento** —anotaciones pegadas al path, globs sin resolver, expansiones `{a,b}` partidas al medio— que ningún compilador ve y que habrían mandado al próximo agente a leer un archivo inexistente.',
      '**Y una guarda que descartaba lo bueno**, el mismo día, con el dueño mirando: pidió cargar tareas y recibió «falló la IA (HTTP 404)». En el loop de proveedores se miró `.ok` a secas, y `!ok` cubre DOS razones — una dura (`molde-volcado`) y una blanda (`sin-borrador`, que existe solo para loguear, porque hay turnos que legítimamente no crean nada). Con eso, una respuesta **corta y correcta** descartaba proveedor tras proveedor hasta agotar los cinco, y salía el error del último que había reventado.',
      'La regla que dejó: **cuando un control junta dos razones distintas en un `!ok`, la más débil se lleva puesta a la buena.** En el choke point estaban distinguidas; en el loop se colapsaron en un booleano. El test que quedó falla si vuelven a colapsarse — es «cada pregunta, su campo» de AGENTS.md, mirada desde el lado de la guarda.',
    ],
    commits: [
      { sha: 'd7d27bf7', msg: 'Un default que cobra es un cobro silencioso', lineas: 216, archivos: 3 },
      { sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 },
      { sha: '32432274', msg: 'Mi guarda descartaba lo bueno, que es peor que no tener guarda', lineas: 72, archivos: 4 },
    ],
    archivos: [
      'tests/model-registry.test.ts — falla si una feature cobra sin decir qué compra',
      'tests/dev-areas.test.ts — cada ruta de `vive[]` tiene que existir en el disco',
    ],
  },
  {
    fecha: '10 ago', hora: '15:00', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Guardar el TEXTO de una pantalla, y el verde que no probaba nada',
    puntos: [
      '**Una guarda `/palabra/i` sobre el fuente engancha identificadores.** `techoIa` (una función) y `a.techo` (un campo) no se ven en pantalla y no había que renombrarlos. La que sirve mira **string literals y texto suelto de JSX**, en los dos casos **sin las llaves**, porque adentro de `{}` hay expresiones y no texto.',
      '**Y la guarda sobre el componente cubre la mitad: el texto vive en los DATOS.** 14 strings de `modelo.ts` que el `.tsx` pinta con `{X.que}` decían la palabra prohibida. La segunda guarda recorre los valores de los MISMOS exports que la pantalla importa —la lista sale del import, así que no se queda vieja.',
      '⚠️ **La regla más cara del área: un test que nunca viste fallar no sabés si sirve.** La guarda que iba a proteger el conteo «tres de los cinco canales» chequeaba `includes(\'3\')`, y la misma frase contiene «0,03%». Estaba escrita, corrida y **en verde**, y habría pasado con cualquier conteo, incluido el equivocado que venía a cazar. Un test corrido solo contra el dato bueno demuestra que **pasa**, no que **atrapa**.',
      '**Toda guarda sobre texto se verifica por MUTACIÓN**: se rompe el dato a propósito, se corre, se confirma que falla *y que el mensaje dice qué falta*, y recién ahí se revierte. De ahí salió además que el conteo se escriba **en letras** (`\'tres de los cinco canales\'`), que no tiene subcadenas por accidente. Sobre números no hace falta: `assert.equal(x, 5.95)` no puede pasar de rebote.',
      '⚠️ Y una trampa del entorno que da falsos positivos: en Windows **los guards de texto leen de más** si no se normaliza CRLF — sin eso, el corte por el fin de función no encuentra dónde termina y la aserción mira código de más abajo.',
    ],
    commits: [
      { sha: 'cf56a8dc', msg: 'pricing: sacar «techo» del texto, con un test que lo impide volver', lineas: 102, archivos: 3 },
      { sha: 'd7802e01', msg: 'docs: cuatro guardas de texto, cosechadas en hallazgos-ui.md', lineas: 90, archivos: 2 },
    ],
    archivos: ['tests/pricing-modelo.test.ts — las dos guardas de texto que pasaron por la verificación por mutación'],
  },
  {
    fecha: '10 ago', hora: '16:32', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El hook chequea TU ÁRBOL, no lo que subís: el falso rojo y el falso verde',
    puntos: [
      '**El falso ROJO desorienta más que el falso verde.** Un push rebotó dos veces con un commit impecable: el error nombraba archivos que ese commit no tocaba, porque la otra sesión había agregado un quinto canal a `CanalId` sin actualizar dos Records. **Se reconoce en un segundo:** los archivos del error no están en `git show --stat HEAD` y sí están en `git status`.',
      'La forma de saber de quién es la rotura sin tocarle los archivos a nadie: **worktree suelto en tu commit**, `node_modules` por junction (no pide admin), typecheck ahí. Y como el hook corre en el directorio desde el que pushás, **pushear desde el worktree valida exactamente lo que sube** — que no es saltearse el hook, es correrlo contra el árbol correcto.',
      '⚠️ **El falso VERDE ya dejó rastro en `main`.** Comprobado con un checkout pelado de `origin/main`, sin nada local: `.claude/skills/plan-tareas/SKILL.md` estaba DESINCRONIZADO. Alguien pusheó con un `skills-lock.json` **sin commitear** que hacía pasar el chequeo local, o sea que la guarda del contrato dio verde contra un archivo que no existía en el remoto. Un clon limpio de main no se podía pushear hasta correr el script y commitear el resultado.',
      'Las dos direcciones se ven distintas y tienen una sola causa: **un chequeo que mira estado LOCAL en vez del artefacto que se publica está afirmando sobre otra cosa.** Es la misma familia que el `?ws=` leído de la URL o que medir una propiedad del DOM en vez de mirar la pantalla.',
    ],
    commits: [
      { sha: '47257a82', msg: 'El pre-push que te bloquea por trabajo ajeno, y el main desincronizado', lineas: 40, archivos: 1 },
    ],
  },
  {
    fecha: '10 ago', hora: '16:43', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El único camino que el desarrollo no ejercita es el de producción',
    puntos: [
      'Una clienta instaló la skill y su Claude Code no autenticaba nunca. La causa: `/api/agente/*` no estaba en la lista de rutas públicas, así que `proxy.ts` cortaba el request con un 401 **antes** de que la ruta mirara el bearer. **Por qué vivió meses:** en local `gateConfigurado()` es false y el middleware hace **no-op**, así que contra `localhost` la integración anda perfecta y falla solo en producción — todo el desarrollo pasó por el único camino que no la ejercitaba.',
      '**La pista de diagnóstico, que sirve para cualquier ruta con auth propia:** pegarle con una credencial inválida y leer el TEXTO del 401. «no autenticado» lo contesta el middleware (la ruta ni corrió); el error propio de la ruta significa que sí corrió. Los dos son 401 y desde afuera se ven iguales; sin distinguirlos se buscan headers y entornos que no tienen nada que ver.',
      'La lista salió del middleware a `lib/rutas-publicas.ts` **sin `server-only`** por la razón de siempre: **a un middleware no lo importa ningún test, y por eso esa lista pudo dejar una integración entera afuera en silencio.** El test es **de dos filos** —que las tres rutas del bearer estén, y que `/api/agente/token` y `/hook` NO— porque la solución obvia (un prefijo `/api/agente` suelto) habría abierto la acuñación del token.',
      'El mismo día el hook ganó su cuarto chequeo: `scripts/generar-plugin.mjs --check`, que bloquea si la copia PÚBLICA de la skill quedó vieja respecto de la viva. Y el generador **busca el patrón de una credencial** (`mkoag_`, `sk-ant-`, un JWT, un localhost) y se niega a escribir si lo encuentra: en positivo, sin confiar en que la función haga lo correcto. Un token en un repo público queda en el historial de git para siempre, y rotarlo no lo borra.',
    ],
    commits: [
      { sha: '4465e37f', msg: 'La integración con Claude nunca funcionó en producción: el proxy la cortaba', lineas: 266, archivos: 9 },
      { sha: 'da749122', msg: 'El plugin público de MaKo, y los títulos del mapa clicables', lineas: 657, archivos: 9 },
    ],
    archivos: [
      'tests/rutas-publicas.test.ts — el test de dos filos: qué tiene que estar y qué NO',
      'scripts/generar-plugin.mjs — el cuarto chequeo del pre-push',
    ],
  },
  {
    fecha: '11 ago', hora: '17:32', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un ensayo que LEE LA BASE, y dos verdes que no probaron nada',
    puntos: [
      '`scripts/ensayo-bucle-cs.ts` corre los cinco pasos como los vive un cliente —el webhook avisa, el cliente contesta por su link, se hace la junta, MaKo reescribe, el cliente aprueba— y **después de cada uno lee la base**. La regla en una línea: **un paso que «no rompe» no es un paso que funciona**; se chequea el ESTADO, no la ausencia de error. 17 chequeos contra producción, con firma real y una llamada real al modelo, colgados de un lead de ensayo que se borra en `finally` — un ensayo que falla a la mitad no puede dejar un cliente inventado en la cartera de nadie.',
      '⚠️ **El chequeo pasó primero por el motivo equivocado.** «El bloque del que la junta no habló no se inventó» daba verde con `motivo=sin-respuesta`: el bloque estaba vacío, así que el código cortaba **antes** de preguntarle al modelo. Verde sin haber probado nada, que es la peor clase de verde. Al contestar primero para forzar que llegara al modelo, falló — y el bug que escondía era real.',
      '⚠️ **Y el pre-push verde no significa que un script corra.** `curso-transcribir.ts` explotaba con «Top-level await is currently not supported with the cjs output format»: es un error de **transform** de esbuild, no de tipos, y `tsc --noEmit` lo da por bueno. **Los scripts no se ejecutan en el typecheck; se prueban corriéndolos.**',
      'El caso hermano del mismo commit vale como forma general: un polling reportaba «20/20 clases con videoId» con CERO archivos subidos, porque confundía «¿hay id?» con «¿ya subió?». **Un fallo que se presenta como éxito es el modo más caro, porque un 20/20 nadie lo revisa.** Y el casi-accidente: la guarda de `--liberar` no borró 2,2 GB por UNA sola de sus cuatro condiciones. **Cada condición se escribe explícita, aunque parezca redundante.**',
    ],
    commits: [
      { sha: 'dbeb07c1', msg: 'Un ensayo del bucle entero, y el bug que el chequeo débil escondía', lineas: 246, archivos: 2 },
      { sha: 'c03c7d7c', msg: 'Dos fallas que pasaron el typecheck en verde y fallaron al ejecutar', lineas: 93, archivos: 3 },
    ],
    archivos: ['scripts/ensayo-bucle-cs.ts — el único ensayo de punta a punta que hay hoy'],
  },
  {
    fecha: '13 ago', hora: '13:28', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El porqué de sacar el typecheck del build era falso, y un push que no desplegaba',
    puntos: [
      '⚠️ **El diagnóstico obvio era el equivocado, y estaba escrito en AGENTS.md y en `next.config.ts` desde julio.** Vercel no factura duración: factura **`ceil(minutos) × vCPU`**. Bajar el build de 99 s a 27 s solo mueve de `ceil(2)` a `ceil(1)` — un 2x como techo, nunca el 95 % que afirmaba el comentario. Lo que gobierna la factura es el **tamaño de la máquina**: los 14 proyectos estaban en `turbo` con elastic encendido (~30 vCPU), o sea 30 CPU-min planos por deploy, dure lo que dure.',
      'La corrección es la parte interesante: **se corrigió el comentario y NO se revirtió el cambio.** Un cambio puede seguir valiendo por otra razón que la que lo motivó; lo que no puede quedar es la razón falsa escrita en el archivo, porque el próximo que la lea va a decidir con ella.',
      '**Y pushear no es desplegar.** Un cambio de rol del token de Vercel (a `VIEWER_FOR_PLUS`) cortó los deploys por git push: el commit quedó en GitHub **sin generar deployment** y nada avisó. Se probó con un commit **VACÍO** —el único experimento que aísla la variable— para verificar que con rol `DEVELOPER` sí dispara el build. La regla operativa: después de pushear se verifica el deploy, no el push.',
    ],
    commits: [
      { sha: '01d2209a', msg: 'La factura de builds no mide tiempo: mide ceil(minutos) x vCPU', lineas: 122, archivos: 2 },
      { sha: '7e2366f5', msg: 'Prueba: verificar que un push despliega con el rol DEVELOPER', lineas: 0, archivos: 0 },
    ],
  },
  {
    fecha: '14 ago', hora: '22:10', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Un test que falla con el paso del tiempo, y otro que lista lo que se le escapa',
    puntos: [
      'El veto de Claude tiene tres piezas para no apagarse solo, y **dos son tests**. La primera es de diseño: la lista blanca vive en CÓDIGO y no en `app_settings`, así que bloquear es instantáneo y desbloquear necesita commit, pre-push y deploy. **Un veto que se apaga con la misma palanca que gobierna se apaga solo.**',
      '**Los permisos VENCEN, y el test avisa 14 días antes.** Es la forma rara y valiosa: un test que hoy está verde y va a fallar **por el calendario**, sin que nadie toque una línea. Sin fecha, una excepción de hoy es una excepción para siempre y nadie la vuelve a mirar.',
      '**Y el test encontró tres scripts que le pegan a Anthropic por afuera.** No se vetan —corren a mano con la key del dueño— pero quedan **LISTADOS**, así que un script nuevo que copie ese `fetch` ahora **aparece en el diff**. Cuando algo no se puede prohibir, se hace visible; es la misma idea que «el bloqueo se REGISTRA, no se loguea».',
      'El porqué de que el control viva en el `fetch` y no en el catálogo de modelos es una lección de cobertura pura: había **cinco** caminos a Anthropic y **cerrar cuatro deja la quinta**. Ya había pasado — un `fallback: []` tapó dos y las otras tres siguieron cobrando US$12,79. Los cinco terminan en el mismo `fetch`; ahí va el control y en ningún otro lado.',
    ],
    commits: [
      { sha: 'e951aba5', msg: 'Claude vetado: no había una puerta, había cinco', lineas: 497, archivos: 6 },
    ],
    archivos: [
      'tests/veto-claude.test.ts — el vencimiento de los permisos y la lista de fetch por afuera',
      'tests/sin-datos-del-dueno-en-bundle.test.ts (13/8, `80b6af39`) — la gemela: recorre `app/` y falla si un módulo `use client` trae una agenda personal del dueño, con la excepción por ruta EXACTA y su porqué escrito al lado',
    ],
  },
  {
    fecha: '14 ago', hora: '22:31', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El script dijo «ok» y no había escrito un solo archivo',
    puntos: [
      'Reportado por el dueño: «te dije explícitamente lo de "Probar que el código funciona" y aún no está». Tenía razón. El script de reemplazos del commit anterior **aborta al primer patrón que no encuentra**, y falló en un archivo **antes** de escribir. O sea que **ninguno** de los cinco renombres de esa pantalla se aplicó —incluido el que se había pedido textual— y el commit salió diciendo que sí.',
      '⚠️ **La lección: un script de reemplazos que escribe al final convierte un fallo parcial en CERO cambios, y el log dice «ok» para los archivos que sí pasaron.** Lo que se lee es el resumen, no lo que quedó en disco. Verificar contra la salida del propio script no verifica nada.',
      'Lo que quedó es la guarda: un test que recorre los 5 archivos vivos y **falla si vuelve a aparecer el nombre viejo en algo que ve el cliente**. Y un detalle que define el género: **saca los comentarios antes de mirar**, porque ahí el nombre viejo es historia y borrarlo perdería el porqué de cada decisión. Una guarda que se dispara con la prosa que explica el bug es una guarda que se aprende a ignorar.',
      'Es exactamente la clase de cambio en que AGENTS.md obliga a correr `npm test` a mano: toca nombres que los tests miran por su NOMBRE, y el pre-push no los corre.',
    ],
    commits: [
      { sha: '3490e7d7', msg: 'Pixel de MaKo: los renombres que NO se habían aplicado, y el test que lo cuida', lineas: 40, archivos: 4 },
    ],
  },
  {
    fecha: '16 ago', hora: '01:22', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El exit code que se comió un pipe, y cinco archivos que la búsqueda no leía',
    puntos: [
      '⚠️ **El control existía, estaba bien hecho, y falló el que lo llamaba.** Dos cursos devolvieron los mismos 888 registros de un curso ajeno. Los dos diagnósticos obvios eran falsos: no era una respuesta vieja en el buffer (la captura era coherente consigo misma, todo decía el mismo curso equivocado) y la herramienta tampoco fallaba en silencio (avisaba y salía con código 3). La causa: el lote hacía `curso-abrir.mjs | grep`, y **en un pipeline sobrevive el código del ÚLTIMO comando** — el `grep` devolvía 0 y el lote siguió como si hubiera navegado. **Un exit 3 que nadie mira no sirve más que un `console.warn`.**',
      'La guarda nueva verifica la **intención** (`--esperado <fragmento>` contra la URL de la pestaña) porque el dato correcto —qué curso se quería abrir— no está en ningún lado de la captura. Cuando lo medible no incluye lo que se quería, la guarda tiene que recibir lo que se quería como parámetro.',
      '⚠️ **Y el modo de falla más sucio del entorno: un solo byte NUL vuelve un archivo invisible para la búsqueda.** ripgrep contesta «Binary file matches» y **no devuelve ni una línea**; en una búsqueda de veinte archivos eso se lee igual que «esa función no existe». Eran cinco archivos con el byte crudo donde el código quería el escape. La prueba de que el cambio era inerte fueron el typecheck y **982 tests** en verde, más que cada archivo creciera exactamente 5 bytes por NUL.',
      'La confirmación en carne propia, una hora después: **al escribir la regla en AGENTS.md, el ejemplo quedó con un NUL de verdad adentro** — el documento que explica que un archivo con NUL es invisible para la búsqueda pasó a ser invisible para la búsqueda. Lo delató `git commit`, que lo anunció como «Binary file AGENTS.md matches». Si una búsqueda contesta vacío donde jurabas que estaba, `file <ruta>` antes de concluir que no está.',
    ],
    commits: [
      { sha: '36e00e25', msg: 'Guarda --esperado: un pipe se comió el exit code y el lote capturó otro curso', lineas: 98, archivos: 2 },
      { sha: 'f2ff187b', msg: 'Cinco archivos que la búsqueda no podía leer: un byte NUL crudo', lineas: 354, archivos: 5 },
      { sha: '7f7e3cf2', msg: 'Le metí un byte NUL a AGENTS.md escribiendo la regla del byte NUL', lineas: 852, archivos: 1 },
    ],
  },
  {
    fecha: '17 ago', hora: '20:39', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Lo que el test de rutas NO puede chequear es la omisión',
    puntos: [
      'La cosecha retroactiva cruzó el `git log` de cada área contra su `bitacora.ts`: **33 tandas de trabajo se habían hecho sin dejar hito**, en 8 de las 9 áreas con registro. Pero el hallazgo está en la vuelta siguiente: **ese cruce solo miró las 9 áreas que YA tenían bitácora, así que declaró tranquilas a las otras 113.** Medido después: **29 áreas con 8 o más commits en 10 días y CERO registro, 696 commits en total.**',
      '⚠️ **La lección para este área: `tests/dev-areas.test.ts` chequea que cada ruta de `vive[]` EXISTA, y eso es todo lo que puede chequear.** Una ruta que **falta** no da error: da un punto ciego. El caso medido es Conocimientos, que figuraba con 11 commits teniendo 68, porque su `vive[]` listaba cinco archivos de `app/conocimientos/` y omitía `public/cono-tx`, `public/cono-ugc` y los scripts del pipeline. La guarda en verde y el dato falso.',
      '**Es la misma forma que el falso verde del `includes(\'3\')` y que el chequeo que cortaba antes de llamar al modelo:** una guarda que solo puede afirmar sobre lo que se le declaró no dice nada sobre lo que nadie declaró. Cuando una guarda mira una lista escrita a mano, **la lista ES la cobertura** — y no hay test que la audite.',
      'De acá sale la regla nueva de AGENTS.md, «Una ruta que apunta a la nada no rompe nada, y por eso es cara»: al mover o renombrar un archivo se grepea su ruta vieja en `docs/`, en `app/admin/dev/areas.ts` y en los `bitacora.ts` antes de cerrar.',
    ],
    commits: [
      { sha: '5e45e545', msg: 'Los 33 hitos que faltaban, y el punto ciego que los tapaba', lineas: 585, archivos: 9 },
    ],
    archivos: [
      'docs/hallazgos-infra.md → «Tests y entorno local» — las cuatro trampas del runner (tsx no resuelve `@/`, `server-only` revienta al importar, un proceso por archivo, CRLF en Windows) y la verificación por mutación',
      '⚠️ Sin cerrar: `npm test` sigue fuera del pre-push, y **ningún test EJECUTA un route handler** — los que nombran `app/api/**` leen su fuente como TEXTO y afirman sobre ella',
    ],
  },
];
