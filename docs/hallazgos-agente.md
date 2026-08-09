# Hallazgos — el agente del cliente (skill, hook y telemetría)

Todo lo que vive en `lib/agente-*.ts`, `app/api/agente/**` y el tutorial de
`app/integraciones/IntegracionesBoard.tsx`: la skill que el cliente instala en SU Claude
Code, el hook que reporta sus sesiones, y lo que MaKo hace con eso.

---

## La telemetría no puede vivir en la skill, y no es una cuestión de estilo

**Vive en:** `lib/agente-plugin.ts`

La regla de AGENTS.md —«una regla en un prompt no es una regla»— acá tiene una
consecuencia concreta que conviene tener escrita, porque la alternativa es tentadora:
sale mucho más barato agregarle a la skill «al terminar, mandale el resumen a MaKo» que
construir un hook.

El problema no es que se cumpla el 90% de las veces. Es **cuáles** son ese 10%. Una
sesión reporta si el modelo llega al final y se acuerda; o sea que reportan las sesiones
**que terminaron bien**. Las que se cortan a la mitad, las que el usuario abandona
enojado, las que se quedan sin cuota —exactamente las que dicen dónde falla el
producto— no reportarían nunca. El dato no llegaría incompleto: llegaría **sesgado
justo en contra de para qué se lo junta**.

Por eso son dos piezas separadas y se presentan como dos pasos distintos en el tutorial:
la skill (paso 2) la lee el modelo, el hook (paso 3) lo corre el runtime. Juntarlos en un
solo paso hace que el usuario instale la skill y asuma que ya reporta.

---

## Cómo se evita que la redacción tenga una copia: se genera, no se copia

**Vive en:** `lib/agente-plugin.ts` + `lib/agente-redaccion.ts`

El tapado de credenciales tiene que correr **en la máquina del cliente**, antes de que el
texto salga por la red. El proyecto del cliente no puede importar `@/lib`, así que el
camino obvio es copiar la tabla de expresiones al script — y esa copia se queda vieja,
que es la cicatriz del contrato del `detalle` que documenta AGENTS.md.

Acá no hay copia y **tampoco hay un `scripts/sync-*.mjs`**: el script se arma en el
momento de pedirlo, y se generan las dos cosas:

- **la tabla**, serializando cada `RegExp` por su `.source` y sus `.flags`;
- **el algoritmo**, con `redactarCon.toString()`.

De ahí salen dos restricciones que hay que respetar al tocar `redactarCon`:

1. **Tiene que ser autocontenida.** Si usa cualquier cosa del módulo (una constante, otra
   función, un import), el script generado la referencia sin tenerla: **rompe en la
   máquina del cliente y no acá**. Por eso `MARCA` se declara adentro.
2. **Las reglas entran por PARÁMETRO, no por nombre.** Un bundler que minifique renombra
   las variables de módulo y la referencia deja de resolver; un parámetro se renombra de
   forma consistente adentro de la propia función.

La segunda no se puede verificar leyendo: hay que correr el script generado. Para eso
existe el modo `autoprueba` y el test «el script del cliente tapa EXACTAMENTE igual que
el servidor», que lo corre **en otro proceso** y compara contra la redacción del
servidor sobre el mismo corpus.

---

## Dos reglas de redacción que se pisan: el texto sale roto y la alarma se infla

**Vive en:** `lib/agente-redaccion.ts` · **Encontrado:** probando el hook de punta a
punta contra un servidor de mentira, no leyendo el código ni con los tests que ya había.

**Síntoma.** Con el texto `mi ANTHROPIC_API_KEY=sk-ant-api03-…`, lo que salía era:

```
ANTHROPIC_API_KEY=«tapado» de Anthropic tapada»
```

**Causa.** Las reglas se aplicaban una atrás de otra sobre el texto ya modificado. La
regla de Anthropic corría primero y dejaba `ANTHROPIC_API_KEY=«clave de Anthropic
tapada»`; después la regla de `.env` matcheaba `ANTHROPIC_API_KEY\s*[=:]\s*\S+`, y ese
`\S+` **agarra solo hasta el primer espacio** — o sea la palabra `«clave` — dejando el
resto del reemplazo colgando afuera.

**Por qué importa aunque el secreto quedara tapado.** No era un agujero: la clave no se
escapaba. Eran dos cosas:

- un texto roto que después alguien tiene que leer en SuperAdmin, y
- **el contador de `redacciones` contando 4 donde hubo 3**. Ese contador no es
  cosmético: es la alarma que avisa si el filtro de «solo turnos humanos» está dejando
  pasar salidas de herramientas. Una alarma que cuenta de más no se puede mirar, y una
  que no se mira es una que no existe.

**Arreglo.** Cada regla deja un **marcador temporal** —un NUL, el número, otro NUL— en vez de su
texto final, y recién al terminar se cambian todos por el texto de verdad. Y cuando una
regla se come marcadores de otra, esos se **descuentan** del contador: ese secreto ya se
contó y desaparece adentro del reemplazo nuevo.

El NUL no es capricho: el marcador tiene que ser algo que **no pueda aparecer en un texto
tipeado por una persona**. Con espacios o guiones, «hay 3 cosas» se comería el reemplazo
de otra regla. Hay un test que fija exactamente eso.

**La regla que queda:** en una cadena de reemplazos por expresión regular, **el
reemplazo de una regla es entrada de la siguiente**. Si los reemplazos son texto legible
—y acá lo son a propósito, «clave de Anthropic tapada» es más útil que `[REDACTED]`—
hay que sacarlos del camino mientras corre el resto.

---

## Lo que no se pudo verificar desde acá, y cómo se compensó

**Vive en:** `lib/agente-plugin.ts`

El nombre exacto de los campos que Claude Code le pasa a un hook por stdin no se puede
confirmar desde este repo. Un hook que espera `prompt` y recibe otra cosa **no reporta
nada y no avisa** — el peor modo de falla posible para telemetría, porque se ve idéntico
a «el cliente no lo instaló».

Tres cosas compensan eso, y si alguien toca el script conviene no sacarlas:

1. **Plan B por transcript.** Si no viene `prompt`, el script busca el último turno
   humano en el `transcript_path`.
2. **Modo `probar`.** `node .claude/hooks/mako-telemetria.mjs probar` manda una sesión de
   prueba y dice si llegó. El cliente lo comprueba el día uno en vez de descubrirlo en un
   mes.
3. **El buffer no se borra si el POST falla.** El próximo cierre reintenta, y el endpoint
   hace upsert por `(workspace, sesión)`, así que no duplica.

Y una decisión de la que depende que nadie se enoje: **el hook siempre sale con 0**
(salvo en `probar`). Una sesión del cliente no se rompe nunca porque la telemetría no
pudo salir.

---

## Lo que quedó sin hacer

- **Nada postea todavía desde una instalación real.** Todo lo verificado es contra un
  servidor de mentira y con los tests; falta un cliente con el hook puesto de verdad.
  Los nombres de los eventos (`UserPromptSubmit`, `SessionEnd`) y los campos del stdin
  son la parte a confirmar. Vive en `lib/agente-plugin.ts` (`AGENTE_HOOK_SETTINGS`).
- **El acta no dice de qué se trató la sesión**, solo lo que se puede contar: turnos,
  minutos, herramientas usadas, proyecto. El tema hay que sacarlo de los turnos, y hoy
  eso no lo hace nadie. Vive en `app/admin/agente/page.tsx`, que a propósito no llama a
  ninguna IA.
- **La purga de turnos a los 90 días** se apoya en `purgar_despues` y **no hay nada que
  la corra**. Vive en `supabase/migrations/0124_agente_telemetria.sql`. Hoy la columna
  está escrita y los turnos no se borran solos.
