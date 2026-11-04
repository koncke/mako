# Relevo — Grupos de la app (sesión en la nube, 4/11/2026)

Pedido de Martín (3/11/2026), textual: «algo súper importante que quiero que crees ya mismo es la funcionalidad de grupos, tipo
grupos de WhatsApp dentro del Ops Center, de Mako, entonces básicamente los clientes pueden utilizar lo mismo que están
utilizando hoy en día en los grupos de Mako en WhatsApp, pero dentro de la aplicación mobile. Es decir, que le puedan, por
ejemplo, invitar a otros usuarios de Mako, en este caso a Joan y a Juanfran, que quieren estar pendientes, y que todas las
notificaciones que hoy en día estamos enviando por WhatsApp también haya un chat específico dentro de lo que sería Mako
Mobile, es decir, el Ops Center, que reciba todo eso, que sea el grupo justamente, y que esté posicionado arriba.»

El brief de esta sesión (del Cerebro): llevar `rescate/grupos-ops-0311` a main por `punta/grupos`, sin perder lo que separa a un
invitado de los datos del negocio, y arreglar lo chico que dejó abierto la revisión.

## Estado

- **Rama:** `punta/grupos-app` (la pidió el Cerebro; no hay `punta/grupos`): los cuatro commits de la etiqueta rearmados con
  cherry-pick encima de `origin/main` (`e5d67c37`), más los de esta sesión con lo de abajo. La misma punta queda en
  `claude/gracious-edison-knwd27`.
- **La primera subida (`cfa87cc9`, corrida 119) dio rojo en tres tests**, arreglados en la segunda: `agenda-google-grupo` (pedía la
  línea de `ctxGoogle` sin la guarda del invitado), `cuenta-revision-escrituras` (las rutas del grupo, clasificadas: cortadas para
  la cuenta de revisión) y `agenda-sin-ia` (prohíbe la palabra `apartadas` en el doer, y era el nombre de una variable nueva).
- **La segunda (`94866a72`, corrida 127) pasó todo lo suyo** (tipos y 10.274 tests) **y dio rojo en `tests/venta-externa.test.ts`**,
  que no es de esta rama: su evento tenía la fecha escrita a mano y el 4/11 cumplió 7 días (Meta recorta y suma `hecho_en`). Da rojo
  también sobre main. Lo arregló el Cerebro en `punta/test-venta-fecha` (`b73829cb1`); acá no se tocó. Con eso en main, se mezcla main
  y se vuelve a subir (main ya mezclado una vez el 4/11 a las 11:30: limpio, 204 de 204 en los tests de grupos y los que dieron rojo).
- **Verificado acá:** los 8 archivos `tests/grupos-ops-*` (el del recorrido, nuevo), los 1.060 archivos de tests que elige
  `tests-afectados` contra `origin/main` (10.221 tests, con node 24: con el 22 de la nube dan rojos falsos, también sobre main)
  y el `tsc` ENTERO (`--noEmit`, exit 0, con `next typegen`).
- **Sin ver:** la app con sesión, la base real y Evolution. La nube no tiene `.env.local`.
- **No entra acá** (decisión de Martín): nada nuevo que escriba por WhatsApp, y el corte de grupos de WhatsApp
  (`avisos-bot-corte-0311`).

## La migración 0372 — APLICADA

`supabase/migrations/0372_grupos_de_la_app.sql`: sólo agrega tres tablas (`grupo_mensajes`, `grupo_invitados`, `grupo_leidos`).
**El número estaba libre** (medido el 4/11 sobre `origin/main` y las 125 ramas del remoto: hay 0371 y 0373, ninguna otra 0372).
**El Cerebro la aplicó el 4/11** (midió: las tres tablas, con 0 filas y RLS prendida). Esta sesión no cambió su contenido.

- Su cabecera pide aplicarla **antes** del deploy. Si el deploy llega primero, no se rompe nada: la copia de los avisos loguea
  «FALTA LA MIG 0372» y sigue, WhatsApp sale igual, y la pantalla del grupo dice «No pude abrir el grupo» con Reintentar.
- Se aplica desde la PC: `node scripts/apply-migration.mjs supabase/migrations/0372_grupos_de_la_app.sql`. Se confirma con
  `node scripts/verificar-migraciones-aplicadas.mjs`, que la tiene que dar como aplicada.

## Cómo probarlo en producción

Cuando la punta esté en main, el deploy de Vercel en «Ready» y la 0372 aplicada. **En el Cliente de Prueba (ws3), nunca en el ws1**,
con una IA conectada en ese negocio (si no tiene, en `/integraciones?abrir=ia`). Sin su IA, MaKo no contesta en el grupo, y eso es
lo esperado.

1. **El grupo, primero:** en `/second-brain` (y en el teléfono, en el Ops Center) el grupo del negocio aparece debajo de «Nuevo
   chat», con la última línea y los no leídos.
2. **MaKo contesta:** escribe «MaKo, ¿cuántos leads entraron esta semana?». Llega el 👍 y después la respuesta, en el hilo de la
   app. **Lo que se escribe en la app no sale por WhatsApp**: el grupo de WhatsApp del negocio no lo recibe.
3. **Un aviso cae en los dos:** en `/automations`, «Probar» → «Probar en el grupo» de una automatización con una tarjeta «MaKo en
   WhatsApp»: la prueba aparece en el hilo de la app aunque WhatsApp no la entregue.
4. **Lo que entra por WhatsApp se ve en la app**, marcado «vino de WhatsApp», y MaKo no contesta dos veces.
5. **Un invitado con cuenta:** desde Participantes, invita el email de una cuenta de OTRO negocio. Le llega un push y un mail
   «Invitación de …» con el link. Con esa cuenta, en `/second-brain`, sale
   «Invitación de …». Escribe «MaKo, ¿cuánto vendimos este mes?»: MaKo contesta sin un solo dato del negocio, y sin herramientas.
   No ve lo anterior a su entrada ni los avisos a la agencia, y su número de no leídos tampoco los cuenta.
6. **Un invitado sin cuenta:** invita un email que no tenga cuenta en MaKo. La pantalla contesta igual. Le llega el mail «<quien> te
   invitó a su grupo de MaKo…». Cuando esa persona ENTRA a MaKo por primera vez con ese email (crearle la cuenta solo no alcanza),
   el grupo le aparece arriba de todo.
7. **La respuesta al equipo:** con una pregunta del equipo en el grupo, contéstala desde la app: le llega al equipo (al ticket o
   al grupo de SuperAdmin) y MaKo no salta, ni al rato.

## Lo que se hizo en esta sesión, además de mezclar

| Qué | Dónde |
|---|---|
| A un invitado no le llega si el negocio tiene Google Calendar conectado (`ctxGoogle`, de main) ni la cita como memoria (`ctxCita`) | `lib/mako-doer-in.ts`; `tests/grupos-ops-guarda.test.ts` y una semilla nueva en `tests/grupos-ops-turno.test.ts` |
| La cañería del bot 1 a 1 de main (`lib/mako-salida-drivers.ts`) queda como excepción de la guarda de copias, con un test que fija por qué | `tests/grupos-ops-guarda.test.ts` |
| La respuesta al equipo escrita en la app no llega a MaKo cuando falla el autollamado o la mezcla otra persona (`sinLasDelEquipo`) | `lib/mako-doer-in.ts`; dos escenas en `tests/grupos-ops-turno.test.ts` |
| Un invitado no cuenta como no leídos los avisos a la agencia que no ve | `lib/grupo-app.ts` → `resumenParaLaLista`; `tests/grupos-ops-puerta.test.ts` |
| Borrar un negocio se lleva `archivero/grupos/<ws>/` | `lib/reset-workspace.ts` → `CARPETAS_APARTE`; `tests/baja-cuenta.test.ts` |
| A quien no tiene cuenta le llega el mail con el link (mismo tope de 24 h), y la invitación se ata cuando ENTRA con ese email | `lib/grupo-app.ts` → `avisarInvitacion`; `lib/grupo-invitaciones.ts` → `atarInvitacionesAlEntrar`, desde `registrarLogin` (`lib/usuarios.ts`) |
| El recorrido de Joan de punta a punta: abrir, invitar, aviso, link en el teléfono, leer, escribir, MaKo, avisos, salir; y el de quien no tiene cuenta | `tests/grupos-ops-recorrido.test.ts` |
| Las rutas del grupo, clasificadas para la cuenta de revisión de las tiendas: cortadas (invitar manda mails a terceros) | `tests/cuenta-revision-escrituras.snapshot.txt` |

Cada arreglo, probado rompiéndolo: los números están al pie de cada test. Lo que costó: `docs/hallazgos-ops-center.md` →
«El grupo de la app, llevado a main».

## Lo que sigue abierto

En `docs/hallazgos-ops-center.md`, las dos listas «Lo que quedó sin hacer» (las del 3 y el 4/11): la sesión real de un invitado
(y si Joan y Juanfran comparten fila en `usuarios`), el push en un Android, el `?ws=` de `WsFetch` contra las rutas del grupo,
el autollamado que se aborta a los 5 s en un arranque en frío, el id de WhatsApp atado por posición, y reacciones/fijar/eliminar.
