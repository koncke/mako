# El Funnel Coach, el Offer Coach y qué hay para copiar (31/10/2026)

**Esto es una decisión de producto de Martín, tomada en el chat del Cerebro el 31/10 a la noche, más el
relevamiento de qué existe para copiar.** Se escribe acá porque una conversación de chat se pierde y esto
define una tab entera. **Lo construido y lo que falta, en §10.**

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

---

## 8. Cómo se construye — el brief, con lo medido el 31/10 a la noche

**Esto lo decide y lo escribe el Cerebro para que quien lo construya no arranque adivinando.** Las tres
cosas de abajo son las que, si se asumen mal, cuestan el día entero.

### 8.1 La pregunta abierta, cerrada

**¿El Funnel Coach aparece para todos, o sólo cuando el Offer Coach terminó? Aparece para TODOS.** Lo
**sugiere** el Ops Center cuando el Offer Coach dejó una oferta guardada, y no antes; pero está siempre
visible y se puede entrar a mano. Dos razones, las dos ya escritas acá arriba: la regla de Martín es
*«que el Funnel Coach se SUGIERA, no se imponga»* (§4), y hay gente que entra sin presupuesto. Esconderlo
hasta que el Offer Coach termine convierte tres coaches en un pasillo, que es justo lo que él prohibió.
Lo que sí cambia según la oferta es con qué ARRANCA el chat: con oferta guardada abre por el presupuesto;
sin ella, abre preguntando qué vende (y eso es un Offer Coach disfrazado, así que ahí conviene derivar).

### 8.2 Lo que hay que MEDIR antes de escribir una línea

1. **Dónde se registran los chats del Ops Center DE UN CLIENTE.** `lib/centro-chats.ts` (1.864 líneas)
   **no es eso**: su encabezado lo dice —es el Centro del super admin y refleja las sesiones de Claude
   Code de Martín, con cartero, cuenta y `sesion`. Sumar ahí un «Funnel Coach» sería sumarlo a la lista de
   sesiones de Martín. La memoria dice que para el cliente el Ops Center es el MISMO que el del super
   admin: eso puede querer decir *la misma pantalla* o *la misma tabla*, y la diferencia es toda la tarea.
   **Medirlo, no deducirlo.**
2. **La tab a renombrar es `app/ads-manager/`**, no una `app/media-buyer/`: no existe. El arranque vive en
   `app/ads-manager/ArranqueMediaBuyer.tsx`. Renombrar una ruta es romper enlaces: están los `bitacora.ts`
   de `app/admin/dev/ads-manager/`, y el botón «Analizar mi oferta» del onboarding apunta a `/offer` (§7).
3. **El presupuesto de 12.000 caracteres del registro de la API** (`PRESUPUESTO_REGISTRO_CHARS` en
   `lib/doer-herramientas.ts`). Hoy ya descarta operaciones en silencio y lo avisa por `console.warn` en
   `lib/api-mako/registro.ts:226`. Cada herramienta que se le cuelgue al coach le compite el lugar a las
   demás, y el orden lo decide `ordenarPorRelevancia` (título e id valen doble). **Hay un test que mide el
   margen y lo imprime** (`tests/ops-center-bateria.test.ts`, prueba 4): sumarle una línea por cada chat
   nuevo, o el recorte vuelve a ser invisible.

### 8.3 Las skills copiadas: dos permisos, y la atribución es parte del código

Los cuatro repos de §5 son MIT y Apache-2.0, verificado por API. **MIT y Apache-2.0 obligan a conservar el
aviso de copyright y la licencia**: el texto copiado va con su `LICENSE` al lado, no pegado anónimo dentro
de un prompt. Y la licencia habilita el TEXTO, no las APIs de las 12 plataformas que `claude-ads` nombra.

### 8.4 El orden de construcción

1. **El objeto guardado primero** (oferta y plan del funnel), porque es lo que obliga el botón de
   previsualización (§3) y lo que el CRM y el Dashboard van a leer. Sin eso, todo lo demás es un chat lindo.
2. **El Offer Coach, con el onboarding como su primera mitad** (§4), no como un chat «onboarding» aparte.
3. **El Funnel Coach con las fases 1 y 2** (elegir el funnel, planear con el presupuesto), cargado con las
   skills copiadas.
4. **La fase 3 — ejecutar — al final y de a una funcionalidad**: Meta, la landing, Competitors Spy, el
   dashboard. Es la mitad que no está en ningún repo (§6) y la única que no se puede copiar.

**Y la regla que ya costó una tab hoy** (AGENTS.md, «NINGUNA pantalla se diseña de cero»): si Martín mandó
una referencia, los VALORES son el pedido. No se interpreta la referencia: se mide y se copia.

---

## 9. Fastlane (usefastlane.ai): el producto que ya hace lo que el Funnel Coach quiere hacer (01/11/2026)

**De dónde sale:** ticket #38. Martín mandó el link al grupo a las 05:05 UTC —«Podemos copiar esto
para el Media Buyer… Tal vez encuentra otras cosas que podrian estar interesantes»— y **el ticket
no se llevó el link**: lo pescamos en `mako_doer_conv`, un minuto antes del ticket. Leído con el
navegador el 01/11; si no coincide dentro de un mes, se vuelve a leer, no se adivina.

### El bucle, que es LO que hay que copiar (no la estética)

1. **Aprende la marca de UN link.** Le das la URL y saca producto, paleta y tono de voz, y **escanea
   todos los anuncios que esa marca ya corrió** para decirte qué está funcionando. (Ejemplo de su
   propia página: 1.032 anuncios escaneados, 528 días el anuncio más viejo, 48 % con descuento.)
2. **Estudia a los competidores Y a los clientes.** Lee los anuncios y las publicaciones orgánicas
   de la competencia **y miles de reseñas en Reddit y Amazon**, y de ahí saca **las audiencias que
   nadie está atendiendo**. No devuelve «datos del competidor»: devuelve un hueco de mercado.
3. **Crea los anuncios** — decenas de conceptos nuevos por campaña, de un **catálogo de ~28 formatos
   con nombre**: CHALKBOARD, CLAYMATION, BABY PODCAST, NETFLIX DOC, COMPETITOR REMIX, MEME, NOTES
   APP, MISSING POSTER, MS PAINT… Vos aprobás, él los hace.
4. **Lanza pago Y orgánico** desde un solo calendario: los anuncios al Ads Manager, y creadores de IA
   publicando a diario en Instagram, TikTok y Shorts.
5. **Lee el resultado y redobla.** Thumbstop, hold rate, CPA y ROAS **por creativo y contra el
   promedio de la cuenta** («41 % thumbstop vs 25 % de promedio · 5,4× ROAS vs 2,1× de la cuenta»).
6. **Los ganadores van a MEMORIA** y se convierten en variaciones; los perdedores se cortan. Cada
   vuelta alimenta a la siguiente.

### Las cinco cosas que nos faltan, y son las que valen

- **«Aprende tu marca de un link» es nuestra regla de «nada debe tener onboarding», resuelta.** Pegás
  una URL y el producto se configura solo. Es la misma idea que Martín pidió el 01/11, con la forma
  ya encontrada.
- **Una MEMORIA de lo que funcionó.** Hoy MaKo no la tiene: cada campaña arranca de cero. El ganador
  guardado que genera las variaciones de la próxima tanda es el mecanismo que hace que el producto
  mejore con el uso en vez de sólo producir.
- **Un CATÁLOGO DE FORMATOS con nombre**, en vez de «escribime un anuncio». Veintiocho opciones
  concretas convierten una hoja en blanco en una elección.
- **Métricas por creativo CONTRA el promedio de la cuenta.** «5,4× ROAS» no dice nada; «5,4× contra
  2,1× de tu cuenta» decide. Es una especificación de tablero, no una idea.
- **«Radar»: el contenido pago y orgánico de cada marca en UNA biblioteca**, «para ver qué funciona
  antes de hacer nada». Ésa es la forma madura de Competitors Spy: una biblioteca, no una ficha.

### Lo que NO hay que copiar, y por qué

- **Las cuentas de TikTok e Instagram «calentadas» y administradas por su equipo** (US$100/mes por
  cuenta + US$1,50 por publicación). Es un SERVICIO con gente, no software, y además camina por el
  borde de los términos de las dos plataformas.
- **Los influencers de IA propios y las bibliotecas de 1.000 creadores de IA y 2.000 de humanos
  licenciados.** Es un activo que se compra o se produce, no una funcionalidad.

### Su precio, para calibrar el nuestro

Desde **US$29/mes**, con **créditos como único medidor** (un estático 5, un video de 5 segundos 80),
prueba de 7 días con 50 créditos. Su tabla se compara contra generadores de anuncios de IA (US$100-300),
agencias (US$5.000-20.000) y «ChatGPT/Claude» (US$20 por puesto), y su columna fuerte es
**«tiempo hasta la primera campaña lanzada: minutos»** contra 3-4 semanas de una agencia.

---

## 10. Lo construido el 1/11/2026, y lo que falta

**Medido, contra §8.2:** el Ops Center del cliente y el del super admin son LA MISMA PANTALLA con listas distintas
(`app/second-brain/ChatSecondBrain.tsx`); la del cliente sale de `listaDelCliente`, no de `lib/centro-chats.ts`. Un chat con hilo
propio ya existía como patrón (`TABS_CON_CHAT_PROPIO`, el del Video Generator): el Funnel Coach es uno más.

**Está:**
- Arriba de la lista, fijos y en ese orden: **Ops Center** (`NOMBRE_JEFE`), **Funnel Coach** y **Offer Coach** con Hormozi al frente.
  Las conversaciones de Offer van debajo del Offer Coach, y la del onboarding entre ellas (§4).
- **Funnel Coach** (`app/second-brain/ChatDelCoach.tsx`): su contexto es `lib/asesores/contexto.ts`, la calculadora es la herramienta
  `calcular_presupuesto_anuncios`, y arranca distinto con o sin oferta (§8.1).
- **El plan guardado** (§3): `guardar_plan_funnel` y `ver_plan_funnel` (`lib/funnel-plan.ts`, en app_settings) y el botón «Ver el plan».
- **Los referentes:** `lib/asesores/`, catorce, los que tienen curso con transcripción. Tocar la criatura del coach abre la galería (`ElegirReferente.tsx`).

**Sin hacer:**
- **El chat del super admin sigue diciendo «Cerebro»** en su lista de Claude Code: es el nombre de una sesión real, de la que cuelgan el
  cartero y `esCerebro` (`lib/centro-chats.ts`). Renombrar sólo el dibujo es un cambio aparte.
- **`/ads-manager` no se renombró ni perdió nada.** La calculadora sigue también como modal ahí, y `ArranqueMediaBuyer.tsx` sigue siendo
  su arranque. El Funnel Coach llega a la fase 3 sólo por lo que las herramientas del turno ya hacen (§6): falta ejecutar de verdad.
- **Las skills copiadas de §5 no se cargaron.** Su material es otro permiso y otro trabajo (§8.3); el coach arranca con las fichas.
- **El Offer Coach en el teléfono y en la lista del súper admin** abre lo mismo, pero `app/m/second-brain/ChatClienteM.tsx` todavía no tiene
  las filas fijas.
- **El contenido de YouTube de los referentes**, ver docs/hallazgos-chat.md.
