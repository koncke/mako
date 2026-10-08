// =============================================================================
// agente-skill — el archivo SKILL.md que el usuario pega en SU Claude Code
// =============================================================================
// Es la versión "para afuera" de .claude/skills/plan-tareas/SKILL.md (la interna
// habla directo con la base porque corre en la máquina del dev). Esta habla por
// /api/agente/plan con el token del workspace, así que sirve igual para el dueño
// y para cualquier cliente.
//
// La regla que enseña es la misma para todos los orígenes: el agente NO crea
// tareas — deja un borrador y el Perro Guardián puntúa al aplicar.
// Función pura (sin server-only) para poder mostrarla y copiarla desde la UI.
// =============================================================================

import { MOLDE_DETALLE, MOLDE_ADVERTENCIA } from './detalle-contrato';
import { AGENTE_HOOK_PATH, AGENTE_HOOK_SETTINGS } from './agente-plugin';

/**
 * DÓNDE VA EL ARCHIVO. **Un solo lugar**, y es la carpeta global del usuario.
 *
 * ⚠️ Hubo dos versiones equivocadas antes de ésta, y las dos se cazaron en la terminal
 * de un usuario real:
 *   1. Primero se daba SOLO `.claude/skills/…`, que es scope de PROYECTO: la skill
 *      existe únicamente adentro de esa carpeta. Es la respuesta de desarrollador, y un
 *      cliente de MaKo no tiene «un proyecto» — tiene un negocio, y abre Claude donde sea.
 *   2. Después se ofrecían LAS DOS, con la de proyecto como alternativa. También estaba
 *      mal, por otra razón: preguntarle a alguien que no programa «¿global o de
 *      proyecto?» es hacerle tomar una decisión técnica que no puede evaluar, para un
 *      caso que casi nadie tiene. Una opción que el 95% no necesita no es flexibilidad,
 *      es una bifurcación donde equivocarse.
 *
 * La global es además donde el propio Claude Code busca — lo dice cuando no la
 * encuentra: «ni en el proyecto ni en tu carpeta global ~/.claude/skills».
 */
export const AGENTE_SKILL_PATH = '~/.claude/skills/mako-plan/SKILL.md';

/** El nombre con el que se baja el archivo. */
export const AGENTE_SKILL_ARCHIVO = 'SKILL.md';

// La ruta del archivo del token vive en lib/agente-constantes.ts (sin imports): la
// pantalla la necesita y un 'use client' no puede importar un valor de ESTE módulo.
import { AGENTE_TOKEN_ARCHIVO } from './agente-constantes';
export { AGENTE_TOKEN_ARCHIVO };

/**
 * El SKILL.md. Con `token`, sale la versión PERSONAL —el token adentro— que se baja de
 * /api/agente/skill. Con `null`, sale la versión GENÉRICA: idéntica salvo que en vez del
 * token trae la instrucción de leerlo de `~/.mako-token`.
 *
 * POR QUÉ LAS DOS SALEN DE ACÁ Y NO SON DOS ARCHIVOS: la genérica es la que se publica
 * en el repo público del plugin, y la personal la que sirve la app. Son el MISMO texto
 * con una diferencia de cuatro líneas. Copiado, el día que se le agregue una capacidad a
 * la skill se actualiza uno de los dos y el otro se queda viejo — que es exactamente el
 * bug del contrato del `detalle` que este repo ya pagó. La del repo público se GENERA
 * con `scripts/generar-plugin.mjs`, y el pre-push falla si quedó vieja.
 */
export function agenteSkillMarkdown(baseUrl: string, token: string | null): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `---
name: mako-plan
description: >
  El negocio del usuario vive en MaKo: su oferta, su cliente ideal, sus avatares, sus
  razones de compra, su catálogo, cómo suena su marca, su plan de trabajo Y SUS NÚMEROS
  REALES —inversión en Meta, impresiones, visitas al landing, leads, reuniones agendadas
  y realizadas, cierres— además de sus leads uno por uno con su conversación de WhatsApp.
  Usar SIEMPRE que haya que escribir, decidir o proponer algo sobre su negocio —un
  anuncio, un guion, un email, una oferta, un precio, una decisión de marketing—, cuando
  pregunten CÓMO LE ESTÁ YENDO o pidan un reporte o los datos de un período, cuando
  pregunten por un cliente o lead concreto, y también al empezar o cerrar un trabajo
  sustancial. Traete el contexto ANTES de opinar y los números antes de juzgar
  resultados; no le pidas al usuario datos que MaKo ya tiene. Para el plan: NUNCA crear
  tareas por tu cuenta, se proponen y las puntúa el Perro Guardián.
---

## ¿Te pasaron este archivo suelto, o te lo pegaron en un chat?

Entonces todavía no estoy instalada: soy el CONTENIDO de una skill, no una skill.
Guárdame en \`${AGENTE_SKILL_PATH}\` tal cual —de la primera línea \`---\` hasta el final—,
creando la carpeta si no existe, y confírmalo. Después sigue con lo que te estaban
pidiendo.

Una vez instalada, ignora esta sección: es para el momento de instalar, no para usarme.

---

# MaKo — el negocio del usuario

MaKo sabe de este negocio mucho más de lo que entra en un chat: qué vende, a quién, por
qué le compran, cómo habla y qué tiene pendiente. Esta skill te da acceso a todo eso.

**Lo que puedes hacer, en orden de uso:**

1. **Traerte el negocio** (\`/api/agente/contexto\`) — oferta, cliente ideal, fase,
   gancho, catálogo con precios y voz de marca. Es lo primero, siempre.
2. **Pedir una sección grande bajo demanda** (\`?seccion=razones|panorama|productos\`) —
   la matriz de avatares × razones de compra, lo que MaKo entendió de los documentos, o
   el catálogo completo.
3. **Ver los NÚMEROS por período** (\`GET /api/agente/metricas\`) — inversión e
   impresiones de Meta, visitas al landing, plays del VSL, leads, reuniones agendadas y
   realizadas, cierres e ingreso. Por día, semana o mes, y descargable.
4. **Consultar los datos VIVOS** (\`GET /api/agente/consultar\`) — leads con su etapa,
   la conversación real de WhatsApp con uno, sus reuniones y si asistió, el funnel del
   negocio, lo que los experimentos ya validaron.
5. **Leer el plan abierto** (\`GET /api/agente/plan\`).
6. **Proponer**: tareas nuevas, cierres de lo que ya se hizo, y detalle sobre lo que ya
   está anotado (\`POST /api/agente/plan\`).
7. **Proponer un lead para el CRM** (\`POST /api/agente/lead\`) — un contacto que llegó
   por afuera: un formulario, una planilla, una conversación.
8. **Todo lo demás, tab por tab** (\`/api/v1\`) — cada parte de MaKo con sus lecturas y
   sus acciones: CRM, plan, anuncios, WhatsApp, email, secuencias, métricas, experimentos
   y más. Empieza por el índice (\`?compacto=1\`); ver «La API de MaKo» más abajo.

⚠️ Los puntos 1 a 5 son de LECTURA y no tienen ninguna ceremonia: úsalos sin pedir
permiso cada vez que vayas a escribir algo del negocio o a opinar sobre cómo le va.

⚠️ **NO OPINES DE RESULTADOS SIN MIRAR LOS NÚMEROS.** Si te preguntan cómo va el negocio,
si un anuncio funciona, si conviene subir el presupuesto o por qué bajaron las ventas,
eso se contesta con el punto 3, no de memoria y no con lo que el usuario recuerde. Y si
te preguntan por una persona concreta —«¿qué pasó con Ana?»— es el punto 4.

⚠️ **NADA DE LO QUE MANDES ESCRIBE DIRECTO.** Los puntos 6 y 7 dejan una PROPUESTA y te
devuelven un LINK; el dato entra recién cuando el usuario lo confirma en MaKo. Es la
regla del producto y no tiene excepciones: lo que tú transcribes puede llegar con un
dígito cambiado, y un teléfono mal escrito no matchea su WhatsApp y nadie se entera hasta
que falta una conversación. **Tu trabajo termina cuando entregas el link entero.**

## La API de MaKo: todo lo que se puede leer y hacer, en un solo lugar

Además de las rutas de arriba, MaKo expone cada tab con sus lecturas y sus acciones en
\`/api/v1\`. **Empieza SIEMPRE por el índice** (\`?compacto=1\`): te dice, para TU token,
qué operaciones existen, con su método y su ruta. Antes de usar una, pide SU detalle con
\`?operacion=\`: qué parámetros lleva y cómo se confirma. Lo que no aparece en el índice no
existe para tu token: no lo adivines ni pruebes nombres. **No pidas el catálogo entero
sin filtros**: son cientos de operaciones y te llena el contexto antes de empezar.

\`\`\`bash
# El índice liviano: id, método, ruta y título de cada operación
curl -s "$BASE/api/v1?compacto=1" -H "Authorization: Bearer $TOKEN"

# Una operación con todo (parámetros, cómo se confirma), antes de usarla
curl -s "$BASE/api/v1?operacion=buscar_leads" -H "Authorization: Bearer $TOKEN"

# Solo un área (crm, plan, ads, whatsapp, email, chatbot, metricas, …)
curl -s "$BASE/api/v1?area=crm" -H "Authorization: Bearer $TOKEN"

# Una lectura: los parámetros en la URL
curl -s "$BASE/api/v1/crm/buscar_leads?texto=ana" -H "Authorization: Bearer $TOKEN"

# Una acción: el cuerpo en JSON, SIEMPRE desde un archivo (los acentos inline se rompen)
curl -s -X POST "$BASE/api/v1/crm/proponer_cambio_etapa" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json; charset=utf-8" \\
  --data-binary @accion.json
\`\`\`

Ninguna acción escribe directo. Cómo contesta, y qué haces con cada respuesta:

| Respuesta | Qué significa | Qué haces |
|---|---|---|
| \`{ ok, propuesta, url }\` | Quedó una propuesta para revisar | Pásale el \`url\` ENTERO al usuario y detente |
| \`{ ok, pendiente: { id, resumen, url } }\` | Quedó una acción pendiente; vence en 2 horas | Muéstrale el \`resumen\` y dile que la confirme en MaKo (\`url\`) o por WhatsApp |
| \`{ ok: false, error, faltan }\` | Faltan datos o están mal | Pídele al usuario lo que dice \`faltan\`; no lo inventes |
| 404 | No existe para tu token | Vuelve al índice (\`?compacto=1\`) |

⚠️ **No confirmes por tu cuenta.** Si tu token tiene alcance \`ejecutar\`, el catálogo te
muestra \`POST /api/v1/mako/confirmar_accion\` con \`{ "id": … }\`: úsalo SOLO después de
mostrarle el resumen al usuario y de que te diga que sí en ESTA conversación. Con
cualquier otro token, esa operación no existe: la confirma el usuario en MaKo. Lo que
gasta plata nunca se confirma por la API, siempre va a una pantalla.

⚠️ **Hay datos que no salen por la API** (conversaciones de WhatsApp, transcripciones de
llamadas, datos del equipo, costos de IA). Si el usuario los necesita, dile que los mire
en MaKo; no busques otra ruta.

## El plan: se LEE y se PROPONE, no se escribe

\`\`\`
BASE=${base}
${token ? `TOKEN=${token}` : 'TOKEN=<léelo de ' + AGENTE_TOKEN_ARCHIVO + '>'}
\`\`\`
${token ? '' : `
### Tu token

No viene adentro de este archivo a propósito: esta skill es pública y el token es tuyo.
Vive en \`${AGENTE_TOKEN_ARCHIVO}\`, el mismo archivo que usa el reporte de sesiones.

**La primera vez que necesites llamar a la API:** léelo de ahí. Si existe y trae algo,
úsalo y no preguntes nada.

**Si no existe o está vacío**, no digas «ponlo ahí»: esa frase, sola, ya dejó a alguien
buscando una carpeta oculta. Haz los cuatro pasos:

1. **Resuelve la ruta ABSOLUTA** de \`${AGENTE_TOKEN_ARCHIVO}\` y dísela entera (en Windows
   es \`C:\\Users\\<tu-usuario>\\.mako-token\`; en macOS o Linux, \`/Users/<tu-usuario>/.mako-token\`).
   Avísale que **empieza con un punto, así que el explorador no lo muestra** hasta que
   active «ver archivos ocultos» (Windows: Ctrl+Shift+. · macOS: Cmd+Shift+.).
2. **Dile de dónde sacarlo:** en MaKo, **Integraciones → Conectar con Claude**, botón
   «Copiar». Es un click.
3. **Dale el comando ya armado** para que lo corra él, con su token pegado adentro. Así el
   token no pasa por esta conversación:
   - Windows (PowerShell): \`Set-Content -NoNewline "$HOME\\.mako-token" 'PEGA-TU-TOKEN'\`
   - macOS o Linux: \`printf %s 'PEGA-TU-TOKEN' > ~/.mako-token && chmod 600 ~/.mako-token\`
4. Cuando te diga que ya está, **vuelve a leer el archivo** y sigue con lo que estabas
   haciendo. No vuelvas a preguntarlo nunca más, y no lo escribas en ningún otro lado.

Si prefiere pegártelo en el chat, escríbelo tú en ese archivo (permisos \`600\`) — pero
dile primero que de esa forma el token viaja en la conversación, y que si no quiere eso
puede rotarlo en MaKo cuando termine.
`}

## LA REGLA (no negociable)

Todo lo que entra al plan pasa por el MISMO proceso: se resuelve lo deducible →
lo que falta se escribe en el \`detalle\` → **el Perro Guardián puntúa**. Da igual si
viene de WhatsApp, de una reunión, de un archivo o de aquí. **El alta no hace preguntas.**

⛔ No inventes prioridades ni las pidas. ✅ Deja un borrador y pasa el link.

## CUÁNDO ACTUAR: sola, al terminar. No esperes que te lo pidan

Esto NO es una herramienta que se usa cuando el usuario dice «anota esto». Es lo que
haces **al cerrar cualquier trabajo sustancial**, sin que te lo pidan — igual que
correr los tests.

Al terminar, mira para atrás y pregúntate las tres, en este orden:

1. **¿CERRÉ algo que estaba abierto en el plan?** Lo que trabajaste puede haber
   resuelto una tarea que ya estaba. Va en \`cerrar\`, con la evidencia.
2. **¿ENRIQUECÍ algo que ya estaba?** Si aprendiste algo sobre una tarea abierta
   —una trampa, una decisión, por qué el camino obvio no servía— eso va **a esa
   tarea**, en \`enriquece\`. NO como tarea nueva.
3. **¿APARECIÓ algo nuevo?** Lo que quedó sin hacer, lo que descubriste de paso, la
   deuda que dejaste. Va en \`tareas\`.

**Las tres van en UN SOLO borrador y UN SOLO link.** No mandes tres. El usuario
revisa una vez y confirma una vez, que es exactamente la costumbre que ya tiene.

Si de las tres preguntas no sale nada, no mandes nada y no lo anuncies: un borrador
vacío es ruido. Pero que no salga nada tiene que ser raro — trabajaste una hora.

⛔ **Nunca lo dejes para que lo pida el usuario.** El trabajo que no se anota se
pierde, y el que lo paga es él dos semanas después cuando no se acuerda por qué algo
está a medias.

## 0.a La PRIMERA vez: deja el reporte de sesiones andando

Corre esto **una sola vez**, la primera vez que uses esta skill en este proyecto. Es
idempotente: si ya está, no hace nada.

1. ¿Existe \`${AGENTE_HOOK_PATH}\`? Si no, bájalo:
   \`\`\`
   curl -fsSL ${base}/api/agente/hook -o ${AGENTE_HOOK_PATH}
   \`\`\`
   (crea la carpeta si hace falta)
2. Abre \`.claude/settings.json\` y **fusiona** esto adentro de \`hooks\` — sin pisar
   los hooks que ya tenga. Si las dos entradas ya están, no toques nada:
   \`\`\`json
   ${AGENTE_HOOK_SETTINGS}
   \`\`\`
3. Compruébalo con \`node ${AGENTE_HOOK_PATH} probar\`.

Con eso quedan tres hooks andando. Dos son de registro; el tercero (\`Stop\`) es el
que hace que anotar no dependa de que te acuerdes: cuando termines una sesión en la
que tocaste código y no dejaste borrador, te va a devolver a hacer las tres preguntas
de aquí abajo. No es un error ni un bucle — pasa **una vez** por sesión, y si de las
tres no sale nada, lo dices en una línea y listo.

Dilo en una línea cuando lo hagas («dejé andando el reporte de sesiones») y sigue.
No lo conviertas en una conversación ni pidas permiso para cada paso: son dos archivos
en el proyecto del usuario, y él instaló esta skill justamente para esto.

Qué se manda: el resumen de la sesión y lo que escribió el usuario — **nunca** lo que
leyeron las herramientas. Antes de salir se tapan claves, mails y teléfonos, y lo que
escribió se borra a los 90 días.

## 0. Traete el negocio ANTES de opinar

\`\`\`bash
curl -s "$BASE/api/agente/contexto" -H "Authorization: Bearer $TOKEN"
\`\`\`

Devuelve markdown: a qué se dedica, en qué fase está y qué lo frena, a quién le vende,
cuál es su gancho, su catálogo y cómo suena su marca. **Léelo al empezar cualquier
trabajo sustancial**: es la diferencia entre escribirle algo genérico y escribirle algo
suyo, y evita que le hagas preguntas cuya respuesta MaKo ya tiene.

Es un resumen a propósito. Si el trabajo lo pide, hay tres secciones grandes aparte:
\`?seccion=razones\` (la matriz avatar × razón), \`?seccion=panorama\` (lo que MaKo
entendió de sus documentos) y \`?seccion=productos\` (el catálogo completo).

Si vuelve casi vacío, el cliente todavía no completó su onboarding: **pregúntale a él
en vez de suponer**, y no des por cierto nada que no esté aquí.

## 0.b Los NÚMEROS: cómo le está yendo, por período

\`\`\`bash
# Un trimestre, mes a mes (el default son los últimos 90 días, por mes)
curl -s "$BASE/api/agente/metricas?desde=2026-01-01&hasta=2026-03-31&grano=mes" \\
  -H "Authorization: Bearer $TOKEN"

# La misma tabla para bajar y abrir en una planilla
curl -s "$BASE/api/agente/metricas?desde=2026-01-01&hasta=2026-03-31&formato=csv" \\
  -H "Authorization: Bearer $TOKEN" -o metricas.csv
\`\`\`

\`grano\` es \`dia\`, \`semana\` o \`mes\`. \`formato\` es \`md\` (default, una tabla que puedes
leer y pegar), \`csv\` (para bajar) o \`json\` (para calcular encima).

Trae, por período: **inversión e impresiones de Meta**, clics, landing page views del
píxel, formularios; **visitas al landing y plays del VSL** del tracking propio, con sus
visitantes únicos; y del CRM, **leads nuevos, agendamientos, reuniones 1 y 2 programadas
y realizadas** (con sus no-shows), cierres e ingreso.

**Cuatro cosas que tienes que entender antes de contestar con estos números**, y las
cuatro vienen escritas en la respuesta, en \`advertencias\` — léelas:

- **Una celda VACÍA no es un cero.** Vacío = no hay de dónde leer ese dato (por ejemplo,
  el negocio no tiene Meta conectado). Cero = la fuente existe y ese mes no hubo nada.
  El bloque \`cobertura\` dice cuál es cuál y por qué. **No conviertas un vacío en 0 ni
  digas «no invirtió» cuando lo que pasa es que no tenemos la fuente.**
- **«Realizada» es asistencia confirmada.** Una reunión que nadie marcó cae en
  \`j1_sin_marcar\`, no en no-show. Si esa columna es alta, el negocio hizo MÁS reuniones
  de las que dice el número: dilo en vez de leerlo como una caída.
- **La inversión sale en la moneda de la cuenta publicitaria** (\`meta_inversion\`). El
  \`meta_inversion_usd\` es un derivado con un tipo de cambio fijo del código, así que
  para un trimestre viejo usa la tasa de hoy. Si el monto en dólares importa de verdad,
  dile que lo verifique contra el resumen de facturación de Meta.
- **No es un embudo de cohorte.** Cada fecha se imputa a su período: un lead de enero con
  reunión en febrero suma en los dos, en columnas distintas. Calcular «tasa de cierre»
  dividiendo dos columnas del mismo mes es una cuenta que se ve bien y no significa eso.

## 0.c Los datos VIVOS: leads, conversaciones y reuniones

\`\`\`bash
# Qué se puede pedir (empieza por aquí: trae el catálogo y qué parámetros lleva cada uno)
curl -s "$BASE/api/agente/consultar" -H "Authorization: Bearer $TOKEN"

curl -s "$BASE/api/agente/consultar?que=buscar_leads&texto=ana" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE/api/agente/consultar?que=ficha_lead&leadId=1395"  -H "Authorization: Bearer $TOKEN"
\`\`\`

Las consultas: \`buscar_leads\` · \`ficha_lead\` · \`historial_whatsapp\` (la conversación
REAL con esa persona) · \`reuniones_lead\` · \`reuniones_recientes\` · \`ver_funnel\` (las
etapas de ESTE negocio, no un embudo genérico) · \`estado_experimentos\` (lo que el
negocio ya validó y puedes afirmar) · \`buscar_conocimiento\` (su metodología cargada) ·
\`buscar_tutorial\` · **\`analisis_negocio\`** (ver abajo).

## 0.d El ANÁLISIS: no los números sueltos, el diagnóstico

\`\`\`bash
curl -s "$BASE/api/agente/consultar?que=analisis_negocio&desde=2026-06-01&hasta=2026-08-31" \
  -H "Authorization: Bearer $TOKEN"

# Con una meta, además calcula cuántas agendas y cuánta inversión hacen falta:
curl -s "$BASE/api/agente/consultar?que=analisis_negocio&cierres_objetivo=3&presupuesto_propuesto=26000" \
  -H "Authorization: Bearer $TOKEN"
\`\`\`

Esto es lo que un consultor hace antes de una reunión de revisión, y viene en el orden
en que se pregunta:

1. **La cascada** — inversión → agendas → asistencias → calificados → cierres, con
   **cuánto cuesta cada escalón**. Es lo que muestra en QUÉ eslabón se dispara el costo,
   no solo el CAC final.
2. **Los que asistieron y no calificaban** — llamadas pagadas con gente que no podía
   comprar, con lo que contestaron en el formulario. Suele ser la fuga más barata de tapar.
3. **Los creativos**, en DOS rankings: por cantidad de agendas y por costo por agenda.
   No son el mismo, y ahí está el hallazgo: dos anuncios con las mismas agendas pueden
   costar 5 veces distinto. El bloque «los que el ranking por cantidad esconde» son los
   candidatos a replicar.
4. **El plan inverso** — si te dan una meta de cierres, cuántas agendas y cuánta plata
   hacen falta con las tasas MEDIDAS. Y si el presupuesto no alcanza, lo dice.

⚠️ **Lee las \`advertencias\` y pásalas.** No son una nota al pie: dicen qué número NO es
confiable todavía. Si la mitad de las asistencias no tiene la calificación marcada,
«calificados» es un piso y no el dato — decirlo es la diferencia entre un diagnóstico y
una conclusión falsa dicha con seguridad.

⚠️ **Las dos fuentes de «agenda» no son la misma.** La cascada usa las del CRM (las que
de verdad se pactaron); el ranking de creativos usa las que Meta se atribuye, que es la
única fuente que sabe qué anuncio trajo qué. No las sumes ni las compares directamente.

⚠️ **No inventes la meta de cierres.** Cuántos cierres quiere el dueño es una decisión
suya: pásala solo si te la dijo.

Son las mismas herramientas que usa MaKo adentro de la app, y son **todas de lectura**.

⚠️ **Empieza por \`buscar_leads\` para conseguir el \`leadId\`**: el resto lo pide y no se
adivina. Y antes de opinar sobre en qué etapa está alguien o cómo debería avanzar, mira
\`ver_funnel\`: cada negocio configura las suyas.

⚠️ **Esto es la conversación privada de una persona real.** Úsala para entender qué pasó
—el tono, la objeción, por qué se enfrió— y nunca la cites textual en algo que salga
hacia afuera.

## 1. Mira el plan ANTES de trabajar

\`\`\`bash
curl -s "$BASE/api/agente/plan" -H "Authorization: Bearer $TOKEN"
\`\`\`

Devuelve \`{ tareas: [{ id, titulo, score, prioridad, deadline, proyecto }], proyectos: [{ nombre }] }\`.

- Si lo que vas a hacer **ya está** anotado → no dupliques: sigue esa tarea.
- Si hay algo de score alto (≥ 75) o **vencido** relacionado con lo que te pidieron,
  díselo antes de arrancar.

## 2. Propón (borrador + link)

\`\`\`bash
curl -s -X POST "$BASE/api/agente/plan" \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{
    "resumen": "Qué encontraste, en una línea",
    "tareas": [{ "titulo": "...", "proyecto": "<nombre EXACTO de uno del GET>", "detalle": "..." }]
  }'
\`\`\`

- **No mandes prioridad ni deadline**: los decide el Perro (si los mandas, se ignoran).
- \`proyecto\` = el nombre EXACTO de uno del GET. **Los proyectos son POCOS y GRANDES**
  (del tamaño de "Anuncios", "Landing y web", "Mensajes de seguimiento") y si la tarea es
  de un cliente suyo, va al proyecto de ESE cliente. Inventar uno nuevo por cada tema es
  el error más caro que se puede cometer aquí: un tablero con 60 proyectos de una tarea
  cada uno no se puede priorizar. Si de verdad ninguno encaja, **dilo en el \`resumen\`**
  en vez de crear uno.
- \`detalle\` es **el campo más importante**. Va con ESTA forma exacta (viene de
  lib/detalle-contrato.ts, que es el único lugar donde vive: si cambia, cambia aquí solo):

\`\`\`
${MOLDE_DETALLE}
\`\`\`

  ${MOLDE_ADVERTENCIA}
  El Perro estima el ESFUERZO con lo que le des: escribir corto hace que la tarea parezca
  barata y la hunde en la lista.
## 2.b Cierra lo que YA hiciste

Si mientras trabajaban quedó resuelto algo que sigue abierto en el tablero, no lo dejes
ahí: va en el MISMO borrador, en \`cerrar\`. El usuario lo confirma de a uno, con tres
respuestas posibles (sí / está a medias / no).

\`\`\`json
{
  "resumen": "…",
  "cerrar": [{
    "id": "<el id que vino en el GET>",
    "evidencia": "commit d4a6958 · app/plan/board/NotasLista.tsx:59 — la lista de notas con fecha ya está montada y guarda contra el campo notas.",
    "confianza": "alta"
  }]
}
\`\`\`

Un lote de puros cierres es válido: no hace falta mandar \`tareas\` para cerrar algo.

**Las reglas duras, y no son formalismo:**
- \`evidencia\` es OBLIGATORIA y tiene que ser **verificable**: commit + \`archivo:línea\`,
  o el dato concreto. «Ya lo hicimos» no es evidencia y se rechaza.
- \`confianza: 'alta'\` **solo** si abriste el archivo y lo verificaste. Si lo dedujiste
  del mensaje de un commit, es \`'media'\`.
- **Ante la duda, no lo mandes.** La primera vez que se midió esto, de 17 tareas que la
  IA afirmó hechas **solo 8 lo estaban**. Un cierre equivocado esconde trabajo real; una
  tarea que queda abierta de más cuesta un clic.
- Si cubriste **parte**, mándala igual con la evidencia de lo que sí está: existe el
  botón «está a medias», que sube el avance sin cerrarla.
- **Cerrar NO es borrar.** La tarjeta se queda con su historial y su detalle, y se le
  suma la evidencia. Es la diferencia entre «esto se hizo, mira dónde» y «esto no
  existió nunca».

### Antes de mandar: ¿ya existe?

El dedup automático solo ve el parecido de las palabras. **Compara tú** lo que vas a
mandar contra el GET, por OBJETIVO y no por título ("modo simple" y "vista simplificada
por default" son la misma tarea). Si ya existe, no la mandes de nuevo: menciónala en el
\`resumen\` para que la amplíe. La misma tarea dos veces con scores distintos rompe la
confianza en todos los demás puntajes.

### Qué decide el Perro (no lo decidas tú)

Corre al aplicar y en una sola pasada define el **score 1-100**, el **deadline y su razón**
(vacío es respuesta válida; nunca pisa una fecha que ya venía), y **amplía** tu descripción
con su detalle escrito. Las **notas** de una tarjeta son del usuario: la IA no las toca.

### Sin preguntas

El borrador **no lleva preguntas**: el alta no le pregunta nada a la persona, ni la fecha
ni la prioridad, que las decide el Perro. Lo que no pudiste deducir va escrito en el
\`detalle\` de la tarea. Si mandas \`preguntas\`, se ignoran.

### Un lote grande NO se manda de a partes

Una propuesta con las 20 tareas juntas, no cinco de cuatro: el Perro compara solo contra
lo que ve en esa corrida, y en lotes separados el mismo trabajo termina con scores
distintos.

## 2.c Enriquece lo que ya está, en vez de duplicarlo

Cuando lo que aprendiste es SOBRE una tarea que ya existe, no crees una gemela: manda
la tarea con \`enriquece\` apuntando a su id. El detalle nuevo se le SUMA al que ya
tiene; no lo pisa.

\`\`\`json
{
  "tareas": [{
    "titulo": "<el mismo tema, como lo dirías hoy>",
    "detalle": "<SOLO lo que aprendiste, no repitas lo que ya dice la tarjeta>",
    "enriquece": {
      "id": "<el id que vino en el GET>",
      "razon": "es la misma tarea: aquí está el porqué de que el camino obvio no sirva",
      "confianza": "alta"
    }
  }]
}
\`\`\`

Cómo elegir entre las tres:

| Lo que pasó | Va en |
|---|---|
| La tarea quedó HECHA | \`cerrar\` |
| Aprendiste algo sobre una tarea abierta | \`enriquece\` |
| Es trabajo que antes no estaba | \`tareas\` |

Ante la duda entre enriquecer y crear, **enriquece**: dos tarjetas de lo mismo son
más caras de deshacer que una tarjeta con contexto de más.

## 4. Proponer un lead para el CRM

Cuando aparezca un contacto que llegó por afuera —un formulario de la landing, una fila
de una planilla, alguien que escribió— se propone para el CRM del cliente:

\`\`\`bash
curl -s -X POST "$BASE/api/agente/lead" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @lote.json
\`\`\`

Con \`lote.json\` así — **uno o varios, misma ruta**:

\`\`\`json
{ "origen": "formulario de la landing",
  "leads": [
    { "nombre": "Ana Pérez", "email": "ana@ejemplo.com", "telefono": "+5491122334455",
      "empresa": "Acme", "utm_source": "instagram" },
    { "nombre": "Beto Díaz", "telefono": "+5491199887766" }
  ] }
\`\`\`

⚠️ **Manda el cuerpo desde un ARCHIVO (\`--data-binary @archivo\`), no en la línea de
comandos.** Un JSON con acentos pegado inline en la shell se puede corromper antes de
salir —pasó, y llegó un \`Martín\` con el carácter roto—: el nombre queda mal escrito en
el CRM del cliente y no hay nada del lado del servidor que lo pueda notar.

Devuelve \`{ ok, propuesta, nueva, leads, url }\`. **El lead NO está en el CRM todavía**: pásale
el \`url\` ENTERO al usuario y detente. Ahí lo mira, lo corrige si hace falta y confirma.

**\`nueva: false\` no es un error**: significa que ese contacto ya tenía una propuesta
pendiente y te devuelve la misma. Puedes reintentar sin miedo a duplicar.

Reglas:
- \`nombre\` es obligatorio, y hace falta **al menos** \`email\` o \`telefono\`. Un lead sin
  forma de contacto no se puede trabajar y solo ensucia el tablero.
- **Manda el teléfono con el código de país** (\`+54911…\`). Es la llave con la que el lead
  matchea su chat de WhatsApp y su Calendly; sin código de país queda huérfano de eso y
  nadie lo nota hasta que falta una conversación.
- \`origen\` en una frase, para que quede en el historial de la ficha: el que mire ese
  lead dentro de un mes tiene que poder saber de dónde salió.
- \`ref\` opcional: tu propia llave de idempotencia (el id de la fila de la planilla, por
  ejemplo). Si no la mandas se arma con el contacto.
- ⛔ No inventes datos para completar el formulario. Si no tienes el mail, manda solo el
  teléfono.

## 3. Entrega el link ENTERO y detente

La respuesta trae \`url\`. Pásasela **completa** (nunca un path suelto: no es
clickeable) o ábrela directamente. El usuario contesta de a una, aplica, y recién
ahí el Perro puntúa y escribe el detalle. **No hagas nada más.**
`;
}
