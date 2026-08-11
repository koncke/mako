# Sprint de Servicio · Mauricio Bustos (Customer Success)

**Qué es este documento.** El mapa de lo que Mauricio compró de verdad, contra lo que MaKo
tiene hoy, y el plan de las semanas que quedan. No es un changelog: es lo que hay que saber
**antes** de escribir una línea para este encargo, porque la mitad de las trampas son de
encuadre, no de código.

Se lee antes que `hallazgos-*.md` cuando el trabajo es del Sprint. Contexto de arranque,
como [embudo-y-high-ticket.md](embudo-y-high-ticket.md).

Escrito el **2026-08-11** sobre dos corridas: `wf_bf78bf97-f34` (6 agentes mapeando el
código) y `wf_92bf7d0a-363` (7 agentes leyendo las **7 reuniones Mau ↔ Martín del 4/7 al
6/8**, ~965 minutos de transcript).

---

## Lo que más muerde acá

- **Las reuniones con Mauricio NO están en el Fathom del conector MCP.** Están en la cuenta
  de Martín, cuya key vive en `.env.local` como `FATHOM_API_KEY_MARTIN` →
  [Dónde están las reuniones](#dónde-están-las-reuniones-y-por-qué-cuesta-encontrarlas).
- **Los 5 pasos existen, los dictó Martín el 31/7, y nadie los volvió a abrir.** Son el
  único activo metodológico de estas 8 semanas y unifican tres de los cuatro frentes →
  [Los 5 pasos](#los-5-pasos-el-31-de-julio-034644).
- **El frente 04 no tiene materia prima.** Al 29/7, textual: *«no tengo ningún cliente que
  todavía ha llegado a las juntas o a la implementación de los tableros»* →
  [Frente 04](#frente-04--graduación-y-5-casos-de-éxito).
- **Desarrollar MaKo sobre la cuenta de Claude de Mauricio le costó tres días de trabajo con
  un cliente.** Es el argumento con el que puede no renovar → [El consumo de IA](#el-consumo-de-ia-es-un-riesgo-de-relación-no-un-tema-de-costos).
- **«No se construye dentro de MaKo» es más chico de lo que parece y cambió de objeto** →
  [Lo que contradice el documento del Sprint](#lo-que-las-reuniones-contradicen-del-documento-del-sprint).

---

## Dónde están las reuniones (y por qué cuesta encontrarlas)

Hay **dos cuentas de Fathom** y el repo ya lo tenía escrito en
[conectores.md](conectores.md) — pero se descubre tarde si uno arranca por el conector MCP:

| Cuenta | Key | Qué tiene |
|---|---|---|
| **Mauricio** | `FATHOM_API_KEY` (catálogo, `lib/metodo-catalogo.ts`) | Lo que consume el PRODUCTO: Closing Analyst, reuniones R1/R2, el webhook |
| **Martín** | `FATHOM_API_KEY_MARTIN` (`.env.local`, **fuera** de `ENVS_METODO` a propósito) | **Las reuniones «Mau ↔ Martín»** y las de Leila |

⚠️ **El conector MCP de Fathom apunta a una tercera cuenta** (`tejadomartin@gmail.com`, 188
reuniones): ahí las weeklies con Mauricio **no existen**, y `find_person "Mauricio"` devuelve
«no encontrado». El síntoma —«no tengo esas reuniones»— apunta al lugar equivocado. La
respuesta correcta es la key del `.env.local`.

⚠️ **La key de Martín empieza con un guion.** Sin comillas en el `.env` devuelve 503.

⚠️ **La diarización de Fathom está rota en tramos largos de las 7 reuniones**: bloques
duplicados con hablantes invertidos, y tramos traducidos al inglés. Se resuelve por dialecto
(rioplatense «vos/tenés» = Martín; mexicano «órale/nomás/a lo mejor» = Mauricio). Los
timestamps sí son fieles. **Cualquier cita de un transcript de Fathom hay que atribuirla por
contenido, no por la etiqueta.**

Las 7 reuniones, por si hay que volver:

| Fecha | min | `recording_id` | Qué pasó |
|---|---|---|---|
| 2026-07-04 | 136 | 160772829 | Martín propone MaKo CS, todo adentro de MaKo. **Sin precio** |
| 2026-07-08 | 137 | 161649752 | CS estaba en la agenda y **no se trató**. Auditoría de ads |
| 2026-07-08 | 114 | 162031617 | **La bisagra.** US$9.000 pedidos y rechazados. Se cierra el sprint |
| 2026-07-16 | 105 | 164601311 | Única sesión que trabajó el sprint de punta a punta |
| 2026-07-29 | 118 | 168137957 | Sprint invisible. ~50 min subiendo creativos a Meta |
| 2026-07-31 | **256** | 169318702 | **Los 5 pasos.** Manda sus dos cuestionarios maestros |
| 2026-08-06 | 99 | 171027974 | Re-impone «no desarrollar». Propiedad del código. Cuota impaga |

---

## Los 5 pasos (el 31 de julio, `[03:46:44]`)

Los enuncia **Martín**; Mauricio valida (`[03:33:26]` *«Me late, me hace sentido»*;
`[03:48:51]` *«Y así con todo, es como un bucle»*). No son «5 pasos para reducir la carga» en
abstracto: son **el bucle operativo del servicio de Mauricio**, y su efecto declarado es
justamente ese — que el cliente haga el trabajo y que el programa baje de 4-5 meses a 3.

1. **Antes de la reunión, el cliente ve el video del bloque.**
   *Resuelve:* que Mauricio no explique la metodología en vivo, cliente por cliente, cada vez.
   El 16/7 `[01:28:04]`: *«lo que te está haciendo falta son los tutoriales… tú le intentas
   enviar lo que sea al cliente y te dice "no lo entiendo". Entonces, al final, por eso es que
   decides terminar haciéndolo tú.»*

2. **El cliente hace la tarea ANTES de la llamada, y la llamada se agenda cuando la termina.**
   Textual `[03:47:12]`: *«obligatorio que tu cliente se termine la tarea para avanzar en el
   proceso, si no se terminó la tarea está en su cancha el problema.»*
   *Resuelve:* el cuello de botella que él mismo nombró el 29/7 `[01:55:37]` — *«invertirle
   mucho tiempo en estar con los clientes para que ellos me den y yo llenar el formato de
   Excel»*. Y mata la reunión de calendario fijo: la llamada se gana.

3. **En la llamada revisan la tarea, debaten y la perfeccionan.**
   *Resuelve:* la llamada deja de ser extracción de datos y pasa a ser criterio. Es lo único
   que Mauricio dijo que NO delega (`[03:22:56]` *«No voy a dejar de tener las sesiones»*).

4. **La IA lee el Fathom de esa reunión y reescribe las respuestas del cliente.**
   *Resuelve:* el «peinado» manual que hoy hace él (16/7 `[01:16:15]` *«Siempre lo redacto yo
   como una hipótesis y luego en la junta lo vamos peinando»*).
   ⚠️ **Dependencia dura: sin Fathom no hay paso 4**, y Fathom ya falló dos veces
   documentadas (16/7 `[00:01:15]`, 31/7 `[03:50:09]` *«no jaló la IA, no hubo de Esquer»*).

5. **El cliente entra a la plataforma, revisa lo que hizo la IA, lo pule y lo aprueba.**
   Mauricio completa `[03:48:31]`: *«o corregir algo que vea que no se entendió»*.
   *Resuelve:* la propiedad. Y le da el efecto que él más valora (`[03:33:35]`): *«antes de
   generar el tablero… los empresarios empiezan a tener una claridad que no tenían… ya andan
   ching y ching con esa persona para que haga la tarea.»*

**Y vuelve a empezar** (`[03:48:37]`): ver el video → completar la tarea → llamada →
perfeccionar → la IA carga → el cliente aprueba.

### La OTRA lista de cinco (la que se buscaba el 6/8 y nadie recordaba)

El 6/8 `[01:10:26]` Martín dice *«eran cinco en total, me acuerdo. Si no, ahí yo reviso la
grabación»* y entre los dos recuperaron tres. **No son los 5 pasos: son los 5 entregables que
Mauricio le debe a Martín** para poder estandarizar el servicio, y están en la misma reunión
del 31/7 (`[03:45:05]`–`[03:46:30]` + `[03:27:30]`). Son las cinco dimensiones de cada
**bloque** del programa:

1. **Timing** — cuánto tarda el bloque.
2. **Esfuerzo/dificultad para el cliente** — cuáles son fáciles y cuáles piden cinco iteraciones.
3. **Cuántas llamadas** requiere cada bloque / cómo se reparten los bloques por llamada.
4. **Qué hace Mauricio a mano hoy** (investigación de mercado, competencia, prompts, el
   dashboard) para decidir qué se automatiza y qué pasa a la cancha del cliente.
5. **Qué puntos le cuestan más entender al cliente** → esos son los videos a grabar.

**No hace falta revisar ninguna grabación: están completos acá.** Mauricio dijo el 6/8
`[01:09:37]` *«Ya los tengo, ya te lo envío hoy mismo… Los hice con ChatGTP mientras no tenía
cloud»*; no hay confirmación de recepción.

---

## El encuadre: lo que compró no es lo que le presenté

| | Propuesta original | Lo que compró |
|---|---|---|
| Dónde vive | `/vsl/mako-cs` (`public/vsl-assets/mako-cs.html`, rewrite en `next.config.ts:47`) | Acuerdo verbal del **8/7**, documentado el 10/7 en un Google Doc |
| Qué es | 12 módulos, 52 features, **todo adentro de MaKo** | 4 frentes acotados |
| Plata | US$9.000 (6 × US$1.500) | **US$500/mes EXTRA** sobre el acuerdo de mentoría vigente |

### Por qué rechazó MaKo Customer Success (8/7, sus siete objeciones textuales)

1. **Pago doble.** `[00:31:00]` *«mi concern va a ser que yo esté pagando doble por algo que
   ya teníamos un acuerdo de los segundos tres meses de nuestro deal.»*
2. **Con 14 clientes no lo necesito.** `[00:31:27]` *«mi lógica me dice que no.»*
3. **«Yo nunca pedí un Customer Success.»** `[00:36:46]` — y acá está el pedido real,
   literal: *«Yo planteé alguien que me ayude a quitar los tiempos donde yo dedico más tiempo,
   que son la de codificación, de estarle dando enter al cloud cuando hay un prompt ya
   establecido, y que me ayude a generar la plataforma donde pueda el cliente ver videos en
   lugar de que los vea en Google Drive.»*
4. **MaKo te está desenfocando a VOS (la más dura).** `[00:38:45]` *«tu tiempo… ha estado
   mucho más enfocado en crear Maco… es nice, es cool, es wow, pero no es el core.»*
5. **Es timing, no precio.** `[01:08:16]` *«9 mil dólares van a ser una ganga… pero es el
   timing.»*
6. **Validar antes de escalar.** `[00:52:50]` *«no creo que esté en un nivel todavía de
   escalar, sino de clarificar»* · `[00:56:30]` *«diseñada para catorce, quince almas, no
   para cincuenta almas.»*
7. **Abrumación.** `[00:43:00]` *«Y me abruma que me muestres todo eso.»*

Y la frase que resume la relación entera:

> `[00:49:54]` *«en lugar de que tú me lleves a tu modelo de escalamiento supersónico, wow,
> high class, yo te quiero traer a mi humilde producto mínimo viable.»*

**No lo mató: lo aplazó con gatillo** — `[00:59:31]` *«Si yo tengo eso para 15 y podemos
empezar a tener testimonios de 5, a lo mejor ya estamos listos para escalar»* + `[01:00:00]`
*«Incluso hasta me vas a querer cobrar más.»*

---

## Lo que las reuniones contradicen del documento del Sprint

Esto es lo que más ahorra después. **Gana lo posterior y gana lo dicho en la reunión.**

| El documento dice | Las reuniones dicen |
|---|---|
| Se firmó el 10/7 | **Se cerró verbalmente el 8/7** (`[01:28:42]` *«Cerramos ahora ya… 500 dólares extra»*). El 10/7 es la fecha del **primer pago** |
| «US$500 adicionales por mes» | US$500 **extra sobre lo que ya cobra**, no un contrato aparte |
| «10 de julio → 10 de septiembre» | **El 10 de septiembre NO se dijo nunca en ninguna reunión.** `[01:06:59]` *«no es un tema como de tiempo tan fijo»*. El disparador es de resultado: sistema andando + 5 casos |
| «No se construye el módulo dentro de la app» | Lo prohibido fue el **módulo grande de CS**. Un tablero simple adentro quedó explícitamente aceptado (`[01:18:03]` *«Tal vez incluso configurar dentro de Maco algo que sea simple… O sea, lo hacemos»*), y del 16/7 en adelante **es Mauricio quien pide que el seguimiento viva adentro de MaKo** |
| «MaKo tiene que ser más doer y menos thinker» como feedback de Mauricio | **La frase la dijo MARTÍN** (8/7). Mauricio dio el diagnóstico con sus palabras: `[01:09:47]` *«Maco está diseñado para ver feedback del dato del mercado… pero ¿qué pasa con tu cliente que tiene que hacer algo?»* |
| «15 clientes» | Al 29/7, recuento nominal de Mauricio: **~7 activos**. Su propia aritmética de la meta usa 10. **Un sistema dimensionado para 15 está sobredimensionado 2×** |
| «Circle, Thinkific y alternativas» | Solo se nombran el 4/7 y el 8/7, **del lado de Martín**. Del 16/7 en adelante no aparecen. **La plataforma sigue sin elegir** |

**Lo que sí se endureció**, y es del frente 02: el 6/8 `[01:10:44]` Mauricio *«estamos claros
que no queremos desarrollar… queremos pagar un service, un software as a service que ya está
ahí, que se adecúa más o menos»*, y Martín acota su propio alcance a `[01:11:00]` *«no vamos
a desarrollarlo dentro de Maco… lo que sí voy a hacer es la conexión de API»*.

---

## El estado real del sprint al 11/8

**No hubo NI UNA revisión de sprint en cinco semanas.** Ni el 16/7, ni el 29/7, ni el 31/7,
ni el 6/8 se nombraron los cuatro frentes, ni la fecha de cierre, ni el avance. El
**roadmap del sprint que Martín prometió para el mismo 8/7** (`[01:28:52]`) no aparece en
ninguna reunión posterior.

### Frente 01 — Prompt maestro de tableros
**Acordado (8/7):** `[01:18:59]` *«un prompt maestro que sea mucho más robusto… y que sea un
skill»*, alimentado desde Fathom, con Martín aportando los patrones comunes de sus tableros.
**Hecho por Martín: nada.** Cero menciones el 29/7 y el 6/8.
**Hecho por Mauricio, solo: bastante** — 31/7 `[00:15:01]` *«instalé Visual Studio… he estado
trabajando con skills y con formatos y cada vez es menos tiempo… estoy empezando a aprender a
trabajar por loops»*; 29/7 `[01:54:05]` *«Yo ya hice la tarea para hacer como los
cuestionarios para hacer los tableros.»*
**Y ya existe el esquema, dictado por él el 31/7 `[03:37:16]`:** la ficha de palanca —nombre,
dueño, qué mide, frecuencia, hora de corte, unidad, umbrales verde/amarillo/rojo— con su
principio de diseño: `[03:38:14]` ***«La inteligencia artificial no funciona por procesos,
funciona por estándares.»***

### Frente 02 — Plataforma de contenido
**El único frente en movimiento, y está bloqueado.**
Hecho: el contenido está definido (los 5 pasos, los bloques, los tutoriales), los dos
cuestionarios maestros entregados el 31/7, y el anti-requisito fijado — 16/7 `[01:42:12]`
*«La de Notion, porque ellos no lo van a hacer ahí jamás.»*
No hecho: **la plataforma no está elegida** y la comparativa de 3-4 opciones que Martín
prometió el 8/7 nunca se entregó.
Bloqueo declarado el 6/8 `[01:10:34]`: *«con eso yo ya voy a poder empezar»* — espera los 5
entregables de Mauricio.

### Frente 03 — Seguimiento de clientes
**Se mudó adentro de MaKo, y lo pidió Mauricio.** 16/7 `[00:50:15]` (filtro por cliente en
`/plan`), 29/7 `[01:46:08]` (*«el dashboard principal es cómo va mi capacidad instalada»*),
31/7 `[00:12:37]` (*«hacernos una checklist de las cosas que le tenemos que meter adentro de
Maco»*).
**Hecho:** `/plan` + el Perro Guardián, y los usa de verdad — 6/8 `[01:15:35]` *«ya la
primera ya la estoy atendiendo… sé que sí, está ahí, me lo vas a recordar.»*
**No hecho:** el filtro por cliente, la capacidad instalada, facturación vs meta en lugar de
«13 de 14 cierres», el No-Show automático, y las alertas.

### Frente 04 — Graduación y 5 casos de éxito
**Hecho: nada. Y peor: no hay materia prima.**
- 29/7 `[00:24:28]`: *«No tengo ningún cliente que todavía ha llegado a las juntas o a la
  implementación de los tableros con las juntas, no tengo ninguno todavía.»*
- 31/7 `[00:07:00]`: *«no tengo nada de casos de éxito documentados, ni mostrados en landing,
  ni nada»* → Martín: *«Sí, eso tenemos que hacerlo»* → no se volvió a tocar en 4 horas.
- 29/7 `[01:57:00]`: *«lo de los cuatro meses fue una declaración, no hay una evidencia.»*

**Y hay reloj:** 8/7 `[01:20:25]` *«en octubre y noviembre van a empezar a vencerse ya.
Entonces, ¿qué les voy a ofrecer? No está claro.»*

---

## El consumo de IA es un riesgo de relación, no un tema de costos

El 6/8 `[00:04:02]`: *«tuve como tres días sin poder trabajar y tuve que pedir disculpas a mi
cliente.»* Desarrollar MaKo sobre la cuenta de Claude de Mauricio se comió los créditos con
los que él arma los tableros de sus clientes — **o sea, el frente 01 se bloqueó a sí mismo**.

El reproche que vino con eso es el de fondo de toda la relación: `[00:04:45]` *«siento que a
lo mejor estás desarrollando, pero no sé si estás compartiendo también como esa restricción
de lograr objetivos»* y `[00:38:00]` *«yo veo en ti alguien que normalmente no está pensando
en la limitación de los presupuestos.»* Es la misma objeción con la que rechazó los US$9.000.

**Acuerdo ya cerrado y sin ejecutar** (`[00:07:15]`): Martín contrata su propio plan de US$200
y se auto-limita a un porcentaje del Cloud de Mauricio. Causa raíz encontrada en vivo: los
micro-cobros venían de la **API de la consola de Anthropic con recarga automática activada**,
no de la suscripción.

Y un tema nuevo que no está en ningún documento: **la propiedad del código**, 25 minutos el
6/8. Cerrado así: Martín nunca le cobra MaKo, el repo/Supabase/Vercel quedan accesibles para
Mauricio, y la única contraprestación es no compartirlo con terceros (`[00:36:53]`,
`[00:37:16]`). Confesado en vivo: todo corre sobre la infra de Mauricio y **hoy la usan
también Leila y Leandro** (`[00:24:07]`).

---

## Lo que Mauricio pide, en sus palabras

El material más valioso. No es lo que creemos que necesita: es lo que dijo.

- `[8/7]` *«alguien que me ayude a crear los tableros… alguien que me ayude a construir la
  plataforma donde vivan mis clientes y algo que me ayude a… mejorar mi seguimiento que está
  en Excel… que me manda mensajes de alertas.»*
- `[8/7]` *«El core es que me digas: a ver, cabrón, necesito que mañana me hagas cinco
  creativos de estos… y que le bajes aquí al presupuesto y que ya lo hagas.»*
- `[8/7]` *«tú vas a revisar tres o cuatro opciones de plataformas… y nos vamos a pelear y
  discutir y eso me va a ayudar a tomar una mejor decisión.»*
- `[29/7]` *«si yo puedo tener una plataforma donde ponga más a trabajar al cliente y me quite
  tareas, eso va a poder aumentar mi capacidad instalada para poder generar los 20 mil.»*
- `[8/7]` *«¿Para qué? Para dedicar más tiempo a generar muchos más videos, a generar la parte
  de la marca… Tengo meses que no subo un video ni historia ni nada.»*

**El pedido de producto más fuerte de las 7 reuniones** (31/7), y es la bajada literal de
«doer»:

> `[02:09:00]` *«no solamente es la parte del resultado, sino que **si Mauricio Bustos no
> subió con evidencia los siete videos a la semana, no va a ocurrir**. Si se atora su tarjeta
> y no paga los cincuenta y cinco dólares diarios, no va a ocurrir.»*
> `[02:12:04]` *«¿qué es lo que me va a dar el valor de que la herramienta sea mi brújula y mi
> dashboard verdadero operativo? Creo que ahí es donde está el toque, **porque obligas a la
> gente**.»*
> `[03:08:00]` *«si no hay 7 videos, no hay 3 ventas… ay cabrón, la motivación es diferente.»*

Es **su propia metodología —palanca con dueño, umbral y evidencia— aplicada a él mismo.**

**Y lo que NO quiere:**
- `[31/7]` *«no quiero automatizar algo que todavía no está estandarizado.»*
- `[31/7]` *«Acuérdate que son empresarios que todos tienen TDAH… la mayoría no creas que le
  sabe la computadora.»*
- `[16/7]` *«si yo pongo todo de un jalón mareo a mi cliente.»*
- `[29/7]` *«yo no estoy usando el CRM puesto que está muy complejo, o no me es ágil.»*
- `[8/7]` *«mi recomendación contigo sería que vayas haciendo módulos de productos mínimos
  viables, porque lo vimos con MaKo al principio: se convirtió tan complejo que ni siquiera
  puedo… el CRM todavía no me siento confiado.»*

---

## Lo que ya existe en MaKo (verificado contra el código)

- **Mauricio es `ws1`, y `OWNER_WS = 1`** (`lib/workspace.ts:264-267`). Cada `?? OWNER_WS`
  escrito a mano cae en su workspace: lo favorece hoy y esconde que a los otros cinco les
  devuelve vacío en silencio (`app/api/notificaciones/route.ts:18`).
- **Sus clientes ya son proyectos de su tablero.** Seis, con el prefijo canónico
  (`lib/todo-proyectos-catalogo.ts` → `PREFIJO_CLIENTE`), renombrados en
  `scripts/reordenar-boards-clientes.ts:52-59`: Grupo Esquer · Baja Teriyaki · Vértice
  Industrial · Aspro · TEXX · Macario Romero (HMO). Son los mismos del `Análisis de fases`.
- **Sus reuniones ya caen en el cliente correcto.** `lib/reunion-cliente.ts:88-115` resuelve
  por tres caminos con nivel de confianza y **devuelve `null` en vez de inventar**. El barrido
  de agosto movió 37 tareas (commit `2742a8e`) respetando las 12 que él reasignó a mano.
- **El molde de la pantalla cross-workspace** ya existe y fue auditado:
  `app/admin/agente/page.tsx:49-66`.
- **El cron que recorre workspaces y avisa una ausencia**: `tracking-vigilante/route.ts:82`.
  El que emite un aviso agrupado por día: `tareas-verificar/route.ts:48-73`.

**Lo que NO existe** (grepeado): `MCI` · objetivo LAG por área · métrica ↔ responsable ·
carta de expectativas · junta recurrente como entidad · **alerta de compromiso vencido**
(`grep -rn "deadline" app/api/cron/` → cero) · NPS/churn · testimonio como entidad ·
graduación · etapa posterior a `ganado` (`lib/pipeline.ts:46-59`).

**`/cs-analyst` no es esto.** Es un `ComingSoon` de 6 líneas y su alcance previsto
(`docs/dev-tabs-mapa.md:379-381`) es *retención de los leads del cliente*.

---

## El plan revisado

Lo que cambia respecto del documento del Sprint, ahora que se leyeron las reuniones.

### 1. Reencuadrar: el entregable no son 4 frentes sueltos, es el bucle de 5 pasos andando para UN cliente
Los frentes 01, 02 y 03 son **tres piezas del mismo bucle**: paso 1 = plataforma con los
videos, pasos 2 y 5 = los formularios, paso 4 = la IA sobre Fathom, y el tablero es la salida
del paso 5. Eso da criterio de terminado, que hoy no existe. **Escribir los 5 pasos y los 5
entregables y mandárselos es lo primero**: están enterrados en un transcript de 4 horas que
nadie volvió a abrir, y la prueba es que el 6/8 ninguno de los dos se acordaba de la lista.

### 2. Frente 02: dejar de evaluar y comprar
El 6/8 Mauricio ya dio permiso y sacó trabajo de encima: SaaS existente *«que se adecúa más o
menos»*. Ese «más o menos» es la licencia para no optimizar. Es lo único que bloquea todo lo
demás y lleva prometido desde el 8/7. Restricciones no negociables, dichas por él: nada de
Notion, y **empresarios con TDAH que no manejan la computadora**.

### 3. Frente 04: renegociarlo AHORA, no el 10/9
No hay materia prima y no la va a haber en 4 semanas. Dos salidas honestas: (a) convertirlo en
**protocolo de outboarding escrito + 2 casos parciales narrados**; o (b) cambiarlo por lo que
sí tiene reloj — **la oferta de renovación de octubre/noviembre**, que además ya está como
prioridad del Perro en su board. Recomendada: la (b), y decírselo esta semana.

### 4. Frente 03: no es un tablero de clientes, es el semáforo de palancas — sobre él
Su pedido real del 31/7 no es «ver mis clientes»: es que MaKo **lo obligue a él**. Palanca con
dueño, umbral y evidencia, aplicada a Mauricio. Eso lo convierte en feature para todos los
workspaces —no en trabajo a medida— y es la bajada concreta del «doer». Y cierra el bug de
negocio del 6/8: el aviso de WhatsApp existía pero se perdió entre el ruido y **le costó media
reunión** (`[00:54:30]`).

### 5. Poner el consumo de IA bajo control antes de tocar nada más
El acuerdo ya está cerrado; falta ejecutarlo y hacerlo visible. **Cada hora de MaKo que no
salga del bucle de 5 pasos le da la razón a la objeción del 8/7** —*«es nice, es cool, es wow,
pero no es el core»*— que es exactamente el argumento con el que rechazó los US$9.000 y con el
que puede no renovar.

### Compromisos vencidos de Martín, por urgencia
1. **La comparativa de 3-4 plataformas** (prometida el 8/7). Bloquea el frente 02 entero.
2. **El roadmap del sprint** (prometido para el mismo 8/7). No existe.
3. **Recibir y usar los 5 entregables** de Mauricio (prometidos por él el 6/8).
4. **Agendar la sesión del flujo de audios a leads viejos** — el 6/8 él lo puso como lo más
   urgente: *«está la fábrica de los carros y hay muchos carros, pero ninguno anda»*. Se cortó
   la llamada y nunca se agendó.
5. **Verificar el pago de la segunda cuota** — vencía el 10/8, quedó impaga el 6/8 con promesa
   de pago ese día, en medio de un problema de caja declarado.
6. Creativos a campaña existente (vencía 30/7) · las 3 secuencias (vencía 2/8) · el documento
   de feedback de VSL/landing (vencía 6/8) · automatizar el audio post-agenda.

### Bugs abiertos que él reportó
Vista móvil rota (*«la mayoría andamos en el celular o la tablet»*) · fricción para agendar la
Junta 2 desde adentro de la llamada · mapa CDMX = 0 (ver [hallazgos-ads.md](hallazgos-ads.md))
· «Pregúntale a MaKo» no funciona · histórico que mezcla meses · crear proyecto por WhatsApp ·
audio de WhatsApp que no se transcribe · la IA que mete tareas en el proyecto equivocado ·
filtro de fecha en costos de IA · el saldo de Claude que hay que actualizar a mano.

---

## Decisiones abiertas

1. **¿Los clientes de sus clientes son workspaces?** **No.** No existe un tier «consultor»
   (`lib/auth-session.ts:16-22`) y `listarWorkspaces()` no filtra por dueño, así que darle un
   workspace por cliente le daría visibilidad de los clientes de Martín. Son filas adentro de
   ws1. **Esta regla va a `AGENTS.md` cuando se escriba la primera línea.**
2. **¿Dos MCIs o uno?** El sistema impone uno (`lib/mako-guardian.ts:786`). Recomendado:
   modelar dos, mostrarle uno al Perro.
3. **¿Los umbrales los fija un humano o los infiere el LLM?** **Humano, con default sugerido.**
   Su cuestionario dice que los pone el líder del área, y su principio es *«la IA no funciona
   por procesos, funciona por estándares»*.
4. **¿Tablas o `app_settings`?** **Tablas.** `app_settings` es last-write-wins sin CAS. La
   fase ya pagó ese costo: al vivir como JSON, «cumplí el hito» no tiene dónde guardarse.
5. **El nombre.** La metodología trae fases 0-4 del encargo, y en el repo ya hay **tres**
   `FASES` que compilan sin conflicto (`lib/fase-diagnostico.ts:80`, `lib/mako-fases.ts:12`,
   `app/admin/dev/pricing/modelo.ts`). Sugerido: `ETAPAS_ENCARGO`.
6. **¿La ficha de palanca tiene 9 campos o 10?** El cuestionario dice «nueve» y la tabla del
   Bloque 4 lista diez (la 10 es «catálogo o formato que hace falta»). La que él dictó el 31/7
   `[03:37:16]` tiene siete. Aclararlo antes de modelar.

---

## Lo que quedó sin verificar

- Si Mauricio mandó los 5 entregables el 6/8 (dijo que sí; no hay confirmación posterior).
- Si pagó la segunda cuota del 10/8.
- Si la tabla `notificaciones` está aplicada en producción. La migración `0048` existe; lo que
  sí está verificado es que **no tiene `workspace_id`** y **no está en `TENANT_TABLES`**.
- Los nombres exactos de región que devuelve Meta con `breakdowns:'region'` para México.

---

*Corridas `wf_bf78bf97-f34` (código) y `wf_92bf7d0a-363` (7 reuniones, ~965 min) · 2026-08-11.
Los transcripts crudos se bajaron con `FATHOM_API_KEY_MARTIN`; no se versionan.*
