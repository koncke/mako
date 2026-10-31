# El Funnel Coach, el Offer Coach y qué hay para copiar (31/10/2026)

**Esto es una decisión de producto de Martín, tomada en el chat del Cerebro el 31/10 a la noche, más el
relevamiento de qué existe para copiar.** No está construido. Se escribe acá porque una conversación de
chat se pierde y esto define una tab entera.

---

## 1. Qué pidió, con sus palabras

> «Media buyer debería ahora llamarse de otra manera… quiero que esta tab sea un chat de MaKo cargado con
> mucha inteligencia y que tenga varias fases.»

**Fase 1 — elegir el funnel.** MaKo ofrece muchos: anuncios, orgánico, YouTube, anuncios a WhatsApp,
anuncios a VSL, scraping y prospección en frío. El coach ayuda a decidir **haciéndole las preguntas
correctas** («¿cuánto tenés para invertir?»), con mucho contexto cargado —incluido el de los cursos— y
**sin estar limitado**.

**Fase 2 — planear la ejecución.** Elegido el funnel (digamos anuncios): con ese presupuesto, cuántos
creativos, cuántos ángulos contra avatares y razones de compra, una landing o prueba A/B de landings. Y
el equivalente para cada uno de los otros funnels.

**Fase 3 — ejecutar y administrar.** Toma el plan y lo corre: administra Meta, las campañas, cómo
rinden. *«Si tiene que hacer un dashboard en la tab de dashboard, que lo haga. Si tiene que hacer una
landing, que la haga. O si te tiene que buscar a través de Competitors Spy alguna referencia para
sugerirte creativo»* — **es la conexión entre todas las funcionalidades de MaKo.**

## 2. Dónde vive: el Ops Center aloja varios chats

Martín evaluó meterlo adentro del Ops Center y **resolvió algo mejor**: el Ops Center pasa a ser la casa
de varios chats especializados.

- **Ops Center** (el chat central, antes «Cerebro»): recibe lo que no sabe a dónde va y delega.
- **Funnel Coach**: Media Buyer renombrada. Él eligió este nombre sobre «High Ticket Coach».
- **Offer Coach**: la tab de Offer, mudada acá. *«la tab de offer es un chat de MaKo, entonces podría
  estar dentro de OpsCenter»*.

**⚠️ Esto resuelve el presupuesto de 12.000 caracteres, que era la objeción fuerte.** Un solo chat con
las herramientas de anuncios + landings + Spy + Dashboard + CRM no entra: hoy el registro ya descarta 57
operaciones en silencio (`lib/api-mako/registro.ts:226`). **Varios chats, cada uno con SUS herramientas,
entran.** La arquitectura que eligió es la que hace posible el alcance que quiere.

**Y no choca con «sin mensajes entre chats»** (memoria del 22/10): esa regla prohíbe DIBUJAR la
coordinación entre chats en el Ops Center, no prohíbe rutear. Lo que no se ve es la cocina.

**⚠️ Lo que SÍ rompe:** la regla de «un chat jefe por tab». El Ops Center pasa a alojar varios. Hay que
reescribirla, no ignorarla.

## 3. El botón de previsualización, que es lo más importante y no parece

> «por el tema de la previsualización del PDF o del resultado que te va dando, puede ser simplemente
> apretando un botón y arriba a la izquierda que deje de verse el chat y que se vea la oferta que va
> armando o el análisis»

**Un chat puede fingir que te armó una oferta escribiéndola en un mensaje. No puede fingir un botón que
la muestra.** Ese botón obliga a que la oferta —y el plan del funnel— sean un OBJETO GUARDADO, no el
resumen de una charla. Y un objeto guardado es lo que el CRM puede leer, el Dashboard puede graficar y
la persona puede retomar en tres semanas.

Es una decisión de diseño que fuerza la decisión técnica correcta. Si el plan vive en el texto del chat,
el coach es un asistente simpático que no administra nada.

## 4. El orden del primer ingreso — YA ESTABA DECIDIDO

Martín, 29/10 ~22:20, textual: bienvenida → **«lo primero que te recomiendo es que cargues tu oferta»** →
**«¿qué funnel te gustaría? ¿o quieres que te recomiende uno?»** (según presupuesto, lo que ya hace y sus
resultados). El 31/10 lo volvió a proponer igual. **Ops Center → Offer Coach → Funnel Coach.**

**La corrección que se le hizo, y la aceptó como pregunta abierta:** él propuso que la conversación del
onboarding se guarde como *un chat llamado «onboarding»*. **No conviene.** Un chat aparte queda muerto
—nadie vuelve a un transcript— y, peor, el Offer Coach arrancaría en frío preguntando lo que la persona
acaba de contar. El onboarding ya recoge exactamente lo que el Offer Coach necesita (qué es, para quién,
qué resuelve, qué logra, precio): **no es contexto de otro chat, es su primera mitad.**

**La regla que hace que esto no sea un cuestionario con cara de chat:** cada paso termina en algo que el
siguiente SE COME. Offer Coach → qué vendés, a quién y a cuánto → es la entrada del Funnel Coach para
preguntar el presupuesto. Funnel Coach → funnel + presupuesto + plan → es lo que ejecutan los anuncios y
las landings. Si un paso no produce la entrada del siguiente, es un formulario.

**El riesgo, y es regla suya:** *«NO quiero que sea un onboarding eterno»*. Tres coaches seguidos antes
de ver algo es un pasillo. La cura es el botón de previsualización: que el Offer Coach produzca algo
mirable rápido. Y que el Funnel Coach se SUGIERA, no se imponga — depende del presupuesto, y hay gente
que entra sin tener uno.

## 5. Qué hay para copiar — licencias verificadas por API, no por la etiqueta

Encontrados en `github.com/topics/marketing-automation`. ⚠️ **No se busca en Google**: lo aprendimos hoy
con Competitors Spy — los repos de nicho no salen ahí, salen en las páginas de topics.

| Repo | Licencia | ★ | Último cambio | Qué trae |
|---|---|---|---|---|
| `coreyhaines31/marketingskills` | **MIT** | 57.700 | 31/10/2026 | CRO, copywriting, SEO, analítica, growth |
| `AgriciDaniel/claude-ads` | **MIT** | 10.600 | 17/10/2026 | Medios pagos en **12 plataformas** (Google, Meta, YouTube…) |
| `AgriciDaniel/claude-seo` | MIT | 24.900 | 22/10/2026 | 26 sub-skills + 19 sub-agentes |
| `aaron-he-zhu/aaron-marketing-skills` | Apache-2.0 | 3.000 | 31/10/2026 | 120 skills como «staff de marketing», 7 disciplinas |

**El hallazgo: no son apps que haya que imitar, son SKILLS DE CLAUDE** — la forma que MaKo ya usa. La
inteligencia del coach no se escribe: se carga. Y `claude-ads` es casi literalmente la fase de anuncios,
con un alcance (12 plataformas) muy superior al nuestro, que hoy es sólo Meta.

**⚠️ Descartado: `zubair-trabzada/ai-marketing-claude`** (2.800★, MIT). Creado el 2/3/2026 y **sin un
solo cambio desde ese mismo día**. Un repo que nació con sus estrellas y nunca se tocó es la forma exacta
del malware que apareció hoy en la familia de Instagram (un ladrón de cookies con 446★). Las estrellas no
son calidad en este vecindario.

**Y la regla que ya costó una tab entera hoy: son DOS permisos, no uno.** La licencia habilita a copiar
el código; los términos del PROVEEDOR de datos son otra cosa. `claude-ads` siendo MIT no autoriza a usar
la API de ninguna de esas 12 plataformas fuera de sus términos.

## 6. Lo que NO está en ningún repo, y es lo único que hay que construir de cero

**Que el coach EJECUTE.** Ninguno de los cuatro administra campañas, arma una landing ni crea un
dashboard. Todos aconsejan. La conexión con el resto de MaKo —que el plan se convierta en campañas
corriendo, landings publicadas y un tablero— es nuestra, y es la mitad que vale.

## 7. Abierto

- **¿El Funnel Coach aparece para todos, o sólo cuando el Offer Coach terminó?** Lo primero es más
  libre; lo segundo garantiza que el coach tenga con qué trabajar. Preguntado, sin respuesta.
- El nombre del chat central («Ops Center» en lugar de «Cerebro») y si eso cambia algo del ruteo actual.
- Qué pasa con la ruta `/offer` al mudar la tab: **el onboarding tiene un botón «Analizar mi oferta» que
  apunta ahí** (decisión del 16/10). Si Offer se muda, el botón se muda o el onboarding queda llevando a
  una ruta muerta.
- La calculadora de presupuesto (ya integrada, `e41e70070`) **pasa a ser una funcionalidad de adentro del
  Funnel Coach**, no una pantalla suelta.
