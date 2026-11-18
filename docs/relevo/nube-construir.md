# Relevo — «Lo que falta construir» de los pendientes verificados (18/11/2026, sesión en la nube)

Lo escribió la sesión de la nube `cli_f48f3c88-a96a-5f72-9e4b-57d3461c2c45` (firma `Claude-Cuenta: claude2`). La fuente del
estado es [docs/pendientes-verificados-17-11.md](../pendientes-verificados-17-11.md) → «Lo que falta construir»: ahí está cada
ítem con su estado del 18/11 y su evidencia. Esto es lo que hace falta para seguir.

## Lo pedido

Martín, 18/11: «continúes con absolutamente todos los pendientes». El encargo de esta sesión, textual:

> Trabaja la sección «Lo que falta construir (125 abiertos)» de `docs/pendientes-verificados-17-11.md` (en main).
> Agrúpalos por área: dónde vive el código. Para cada ítem, ANTES de tocar nada, refuta: busca en main si ya está hecho; si
> lo está, táchalo con la evidencia. Lo que siga abierto, constrúyelo con su test, en una punta por área. Si un ítem necesita
> una decisión de Martín o una escritura en producción, NO lo adivines: anótalo en el relevo con su explicación (qué es, para
> qué, qué pasa si sí y si no). No toques el onboarding, el reto de 7 días ni los tutoriales de las pestañas: los están
> construyendo hoy otros chats. Done = cada ítem con su estado y su evidencia, lo construido verde en GitHub y tachado en el
> documento.

## Cómo se trabajó

- Los 125 se repartieron por **dónde vive el código** en 20 lotes, cada uno con un agente en su worktree y un brief común
  (refutar primero contra `origin/main`, test que ejecuta el código y probado rompiéndolo, nada de producción, nada del
  onboarding, el reto ni los tutoriales). Una punta por lote: `punta/nube-construir-<área>`.
- Lo que un agente dio por construido lo revisó **otro agente** con la consigna de encontrar qué faltaba (la regla del 17/11:
  un «ya está» de una sola lectura no alcanza). Lo que tenía un resto quedó «a medias», no tachado.
- Con Node 24 (el de Actions) y el tsc acotado con `--heap=6144`. Los agentes subieron con `MAKO_SIN_FILTRO=1` después de
  correr el filtro con Node 24 (ver «Trampas»): el pre-push igual corrió sus guardas.

## El resultado

| | Ítems |
|---|---:|
| ✅ Hechos (tachados en el documento) | **28** |
| 🟠 A medias: lo de código hecho, con lo que falta escrito | **32** |
| Sin construir: decisión de Martín | 11 |
| Sin construir: piden producción, la PC de Martín, su Chrome o un teléfono (30 son 📏 «hay que medir») | 44 |
| Sin construir: el onboarding, el reto o los tutoriales (otros chats hoy) | 5 |
| Documentación (F20, F22, F99, F128) y el índice (F53) | 5 |

## Las puntas

| Punta | Ítems | Último commit | En main |
|---|---|---|---|
| `nube-construir-grupo` | F141 | e165d34225 | ✅ |
| `nube-construir-carruseles` | F14, F27, F78, F130 | c17986f176 | ✅ |
| `nube-construir-vsl` · `-vsl-largo` | F93 | 920d442b93 · b583b318fb | ✅ |
| `nube-construir-plantillas` | F11, F103, F122, F123 | 3d3f2f9a22 | ✅ |
| `nube-construir-automations` · `-automations-audio` | F79, F119 · F80 | 3edbdad903 · 154da825a8 | ✅ |
| `nube-construir-admin-api` · `-ops-menu` | F21, F96, F114, F169 | 869219f936 · a2f2cfcc6e | ✅ |
| `nube-construir-image` | F17, F18, F44, F46, F47, F48, F49, F50, F132, F133, F135, F136 | aa177466d1 | ✅ |
| `nube-construir-fechas` | F125 | 32f5357073 | ✅ |
| `nube-construir-cerebro-plan` | F82, F108, F109, F156 | ba449fabf9 | ✅ |
| `nube-construir-copywriter` | F98, F118 | 69e23f39a4 | ✅ |
| `nube-construir-cs` | F113 | dab30bf558 | ✅ |
| `nube-construir-web` | F16, F112 | bbd2c162ad | ✅ |
| `nube-construir-ads` | F100 | fb64820641 | ✅ |
| `nube-construir-video` · `-video-2` | F160, F164, F166, F167, F168 | 71aed02596 · 1e35d50a0e | ✅ |
| `nube-construir-crm` | F117, F148, F150, F152, F154, F157, F158 | 4135431828 | ver «Lo que falta verificar» |
| `nube-construir-infra` | F69, F74, F85, F115, F126, F127, F173 | 6d3d5bb5a7 | ver «Lo que falta verificar» |
| `nube-construir-cierre` | F53, este relevo y el documento | — | — |

## Lo que decide Martín

Cada una en palabras de producto, con lo que pasa si sí y si no. Ninguna se construyó.

1. **Anuncios en cantidad (F92).** Un botón que pide 100 piezas de una vez, para probar muchos ángulos rápido. Falta saber de
   qué son. *Si son imagen o texto:* se arma una cola con tope; cada pieza descuenta MaKo Tokens. *Si son video:* sale por Flow
   con los créditos del cliente y tarda (Flow va de a pocos). *Si no:* se siguen pidiendo de a una.
2. **El curso de un cliente armado desde su oferta (F97).** MaKo lee la promesa y la oferta y propone los módulos; la persona
   confirma. *Si sí:* es una pantalla nueva que tienes que aprobar viéndola, con una referencia que todavía no hay. *Si no:* el
   curso se sigue armando a mano. La auditoría la puso en prioridad baja.
3. **Las letras del editor de imágenes (F131).** Hoy se bajan de un servicio gratis de terceros (jsDelivr). Guardarlas nosotros
   son 69 tipografías, 996 archivos, 17 MB. *Si sí:* costo de almacenamiento y de tráfico, y no dependemos de que ese servicio
   siga andando. *Si no:* seguimos así, o se achica la lista de letras.
4. **Compartir un diseño con un link (F132).** Es darle acceso a otra persona a ese diseño. *Si sí:* se construye el link, que
   se pueda cortar. *Si no:* un diseño no se comparte afuera.
5. **Muapi como segundo motor de video (F161).** Cobra por cada video, y el 9/11 decidiste que el video va por Flow para no
   gastar. *Si sí:* más estilos, y cada video cuesta. *Si no:* todo sigue por Flow.
6. **Un creador de formatos de video propios (F162).** El cliente arma su propio formato. *Si sí:* cada prueba gasta créditos de
   Flow y la pantalla necesita una app de referencia que elijas. *Si no:* sólo los formatos de MaKo.
7. **El clic afuera del menú del clic derecho (F83).** Hoy cierra el menú y además hace lo que tocaste (si cae en una tarjeta,
   la abre). *La otra opción:* sólo cierra, como el menú de Chrome. Recomendado: sólo cerrar, porque nunca abre algo sin querer.
8. **Guardar tus respuestas anteriores a un chat (F94).** Si cambias una respuesta, se guarda la de antes y el chat ve «cambió de
   opinión». *Si no:* la nueva pisa la anterior. Hoy importa poco: las preguntas ya van en el chat.
9. **El Focus Tracker (F95).** Medir horas trabajadas de verdad contra horas sentado, con tu cuenta de Toggl. Falta el alcance:
   ¿tu tiempo, el del equipo? Mientras, la hoja Productividad sigue leyendo sólo el tablero.
10. **Sacar el video sin abrir el editor (F165).** Montar el anuncio desde el chat ya existe; falta que el MP4 salga solo, en un
    servidor. *Si sí:* cada cliente conecta su cuenta de AWS y paga su uso. *Si no:* el video se exporta desde el editor.
11. **Los 32 temas de hashtag (F56).** *Si se apagan:* la biblioteca de ejemplos pierde unas 280 piezas que entraron por ellos.
    *Si no:* siguen entrando.
12. **Las fotos de muestra de las plantillas del editor de imágenes (F42).** ¿De dónde salen (un banco con licencia, generadas,
    propias)? Y si Image pregunta antes de escribir, como Copywriting desde el 13/11.
13. **Qué plantillas «de MaKo» se publican en la galería (F103).** Ya se puede retirar lo publicado; falta elegir qué siembra
    MaKo para todos.
14. **Dos de la API de MaKo (F114).** (a) Las integraciones de Claude que ya instalaron los clientes pueden leer el historial de
    WhatsApp y las reuniones. *Si se deja:* siguen viéndolo. *Si se corta:* dejan de poder consultarlo. (b) ¿La bandeja de lo
    que propone MaKo deja confirmar a closers y setters, o sólo a los admins?
15. **Plantillas propias de Web Generator y AI Avatar (F122).** ¿Se puede publicar como plantilla una página que replica la web
    de otra empresa? (*Si sí:* otros negocios usarían el diseño de un tercero.) ¿De AI Avatar se publica el look, que es la cara
    de una persona real, o la escena?
16. **Buscar en el CRM con tus palabras (F150).** *Si sí:* los leads pasan por la IA y descuenta MaKo Tokens. *Si no:* la búsqueda
    por texto y por campos que ya está.
17. **Clips de Pexels para las plantillas de video (F164).** Abrir una cuenta (gratis, con crédito al autor) y elegir unos 30.
18. **«Prueba real» (F21).** ¿Es una cuenta de prueba? *Si sí:* sale de los números de Customers y el Reset la podría vaciar.
19. **Dos de los anuncios (F100).** (a) Prender un anuncio a la hora de un evento del Calendario gasta plata. (b) Que una reserva
    de Google Calendar mueva la etapa del CRM: hoy toda reserva la confirma una persona.
20. **La llamada de entrega del curso (F113).** ¿Qué evento de Calendly es? Con eso, el recordatorio les sale solo a los clientes.
21. **Verificar las palabras de cada montaje (F166).** *Si sí:* avisa si un montaje cortó una palabra, y gasta una transcripción
    por montaje. *Si no:* no se verifica.
22. **La música del editor de video (F167).** Necesita la licencia comercial (Epidemic Sound Connect), que la firmas tú.

## Lo que espera producción, la PC o un teléfono

- **Tres migraciones SIN APLICAR**, las tres con el código que tolera que falten (las aplica el Cerebro después de la revisión):
  **0418** (`borrados_workspace`: la constancia de borrar un cliente, F126), **0419** (`plan_tareas.responsable_tipo`, F156) y
  **0420** (`reclamada_at` de las pendientes de la API, F114). La **0421** y la **0422** quedaron libres.
- **En la PC de Martín:** correr una vez `scripts\limpiar-temporales-instalar.cmd` (F69; antes, `node scripts\limpiar-temporales.mjs`
  muestra qué borraría). Subir el JSON de `bf5d86f73` de `C:/dev/mako-api` (F68). Rescatar el mensaje c250f453 y el sexto del limbo
  con `scripts/tickets.ts mensaje <id>` (F10). El pre-push del clon de la PC (la parte 3 de F75).
- **Con el Chrome de Martín:** las cinco piezas de Canva de F133, el panel de Framer de F112 (1), exportar el original de Canva de
  las diez caras (F159).
- **Lecturas de producción o pantallas con sesión:** los 30 📏 (cada uno con su «Qué medir»), F23 y F105 (conversaciones con IA real:
  la nube no tiene las claves), F40, F61, F72 y F73 (que la 0407 y la 0406 estén aplicadas), F110, F3, F55, F134 y F138 (una cuenta de
  TikTok conectada a Zernio en un negocio de prueba, y `ig_conversaciones` sólo admite Instagram y Facebook).

## Lo que no se tocó

F151 y F155 (onboarding), F153 (la guía de la ficha y el Funnel Coach del reto), F90 (el primer ingreso y las aperturas por tab),
F102 (la escalera del Ops Center, atada al reto). Y dentro de ítems a medias: la parte de Offer de F11 y F122, (c) de F18, (c) de
F46 y el campo de F50 (van en `app/_crear/PantallaCrear.tsx`, que hoy edita otro chat).

**Para el jefe «Sidebar»** (los demás no tocan `nav.ts`): «VSL Generator» (key `vsl-writer`) pasa a `SIN_FILA`, como
`youtube-writer`, y el `match` de Copywriting cubre /vsl-generator y /vsl-writer (F93); «Creaciones», ruta /creaciones (F122).

## Trampas que valen para el próximo

- **El tsc acotado en la nube muere por memoria con el tope por defecto** («código undefined»): `--heap=6144` da verde.
- **El pre-push corre con el Node 22 del sistema** y da rojos falsos (api-mako-imagen, `mock.module`); el aislamiento del worktree
  no deja cambiar el PATH en el mismo comando que `git push`. Se corre el filtro con Node 24 y se sube con `MAKO_SIN_FILTRO=1`.
- **Desde que entra F127, una server action nueva en cualquier tab da rojo** hasta que se clasifica: su operación en el registro de
  la API, una excepción con su motivo o la deuda (lib/api-mako/cobertura.ts).
- **`tests-afectados` lista como rojos los `todo`** que fallan a propósito (`leerResultado` nombra todo «test at» del pie): en la
  punta de admin-api, dos de los tres «rojos» eran eso. Es de Infra (ya anotado el 14/11 como SIN HACER en hallazgos-infra.md).
- **El mismo pendiente estaba en dos listas con dos dueños** (F17 y O35 de «De octubre»): otro chat trabajó «De octubre» en paralelo.
  Antes de construir, `git log origin/main -- <archivo>`.
- **El prompt de «Crear con IA» de Automations quedó en 4.000 de 4.000 tokens** (el techo de Groq): lo próximo que se sume se paga
  sacando otra cosa.
- **F115 encontró dos agujeros reales** y los cerró: `estadoPuenteAction` y `estadoPruebaAction` (app/video-generator/puente-actions.ts)
  contestaban sin sesión.
- **El índice de hallazgos se re-duplicaba solo** (F53): 64 → 89 filas en dos horas después de P21. La clave del driver pasó al
  documento (hallazgos-infra.md, «El índice volvió a duplicarse…»).
- **Una VSL larga cuesta unas seis llamadas a la IA** (F93): cada tanda descuenta MaKo Tokens. Sin medir si seis tandas entran en
  los 300 s con el Gemini de un negocio.

## Lo que falta verificar

- **Las puntas de CRM e Infra** estaban corriendo en Actions cuando se escribió esto (runs 44250994330 y 44250203217). Si dan rojo,
  queda `ci-rojo/nube-construir-crm` o `-infra`: se lee el paso rojo, se arregla en la misma rama y se vuelve a subir.
- Nada corrió contra producción ni en un teléfono: el arrastre del Copywriter (F98) y el del curso con el dedo (F113) se probaron en
  jsdom; las miniaturas de «Nuevo video» (F160) y el «⋯» de los chats (F96, F119) con sus tests, no en un navegador.
- «En main» no es «en producción»: el despliegue diario corre a las 08:05 de Argentina.

## Autocrítica

- **Lo que cambió por la segunda lectura:** los ítems con un resto («falta Ver ejemplo», «falta aplicar la migración», «falta la
  frase en una respuesta exitosa») quedaron a medias y no tachados, aunque su agente los diera por construidos.
- **Lo que se descartó a propósito:** construir pantallas nuevas sin una referencia abierta (F97, el riel «Lo que hizo» de F96, el
  creador de formatos de F162), por la regla de no inventar; y todo lo que gasta plata o le escribe a un cliente.
- **Lo que hice de más y vale la pena mirar:** F53 pedía juntar dos filas, y al hacerlo apareció que la limpieza de P21 se estaba
  deshaciendo con cada mezcla. Se arregló la causa (la clave del driver), no sólo las dos filas.
