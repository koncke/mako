# ¿En qué chats estuve trabajando por último?

<sub>Escrito el 10/10/2026 para la cuenta 3, que arranca sin una sola línea de historial.
Se rehace en cada relevo — al final está el comando.</sub>

## Lo primero, porque si no esto no se entiende

Martín trabaja el mismo repo desde **varias cuentas de Claude**, y **la lista de chats de la
app está partida por cuenta**. Una cuenta nueva abre la barra lateral y la ve **vacía**: no es
que se perdió nada, es que esos chats pertenecen a las otras cuentas y desde acá no se pueden
ni abrir ni mensajear.

Lo que **sí** se comparte: el repo (y todo lo que está en `docs/`), y las transcripciones
crudas en `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/*.jsonl`
— 63 sesiones, varios cientos de MB, de las tres cuentas juntas.

**Por eso existe esta tabla.** Es el índice que la barra lateral no puede dar.

## Los chats vivos, por última actividad

Hora local (UTC−3). «Mensajes» son los de Martín más los de Claude en esa sesión: sirve para
medir cuánto pesa un chat, no cuánto hizo.

| Última actividad | Chat | De qué se trata | Su briefing |
|---|---|---|---|
| **10/10 19:02** | **Ads Manager** | Campañas de Meta: crear, pausar, presupuesto, renombrar, creativos. Y la conexión con Meta e Instagram | `ads-manager.md` |
| **10/10 19:02** | **Estrategia N cuentas Claude** | El chat orquestador: el traspaso entre cuentas, el relevo y esta tabla | `estrategia-2-cuentas.md` |
| **10/10 19:01** | **Pricing MaKo** | Precios, costos, runway, proyección y el programa de **referidos** (decidido el 10/10). Salió la tab **Strategy** del super admin (`9862c146`) | `super-admin.md` + `docs/referidos.md` |
| **10/10 15:56** | **Chatbot** | El más grande del repo. Hoy la tab se llama **Automations**: flujos con ramas, secuencias de nutrición, el lienzo | `chatbot.md` |
| **10/10 11:01** | **Integraciones** | Lo que MaKo conecta: credenciales por cliente (BYOK), Pixel, cifrado | `integraciones.md` · `pixel-clarity-landing.md` |
| **10/10 02:34** | **Customer Success** | El kanban de la ENTREGA por producto, la ficha del cliente, el **curso** dentro de MaKo y la comunidad | `customer-success.md` |
| **09/10 15:25** | **Plan · Perro Guardián** | El tablero de tareas del super admin y el agente que las prioriza | `plan-perro-guardian.md` |
| **09/10 15:25** | **CRM** | Leads, embudos, la ficha del lead, campañas → producto | `crm.md` |
| 09/10 00:52 | Fallas en la PC | Por qué se traba la máquina (Chrome, RAM, el typecheck) | `infra-y-build.md` |
| 07/10 14:28 | Admin | Super admin: clientes, agencia, links compartidos | `super-admin.md` |
| 07/10 02:03 | CURSOS | El pipeline que baja cursos comprados y los publica en `/conocimientos` | — (sin briefing propio) |
| 06/10 18:04 | Perro Guardián | Versión anterior del chat del Plan | `plan-perro-guardian.md` |

Los **ocho de arriba, en negrita o con fecha del 09 y 10/10, son los que están vivos**. El
resto quedó quieto hace días.

⚠️ Hay **varias sesiones con el mismo nombre** en disco (dos «CRM», dos «Chatbot», dos
«Integraciones», dos «Perro Guardián», dos «Customer Success»…). La tabla lista la más
reciente de cada una. No es un error: un chat se parte cuando se queda sin contexto.

## Cómo se retoma uno

La cuenta nueva **no puede reabrir** el chat viejo. Lo que se hace es abrir un chat **con el
mismo nombre** y pegar una línea:

```
Leé docs/relevo/<el-de-la-tabla>.md y seguimos desde ahí.
```

`docs/relevo/README.md` tiene la línea exacta de cada uno. Y el panorama completo de la
ventana está en [`../relevo.md`](../relevo.md) — que **siempre hay que mirar con qué fecha
está escrito**, porque se pisa en cada traspaso y entre medio el repo sigue moviéndose.

## Cómo se rehace esta tabla

Las fechas y los títulos salen de las transcripciones, no de la app. Cada `.jsonl` trae
registros sueltos `{"type":"custom-title"}` (el nombre que le puso Martín, manda éste) y
`{"type":"ai-title"}` (el que generó Claude, el fallback), más un `timestamp` por línea —
en **UTC**, hay que restar 3 horas.

Se recorre el directorio de arriba, se toma el último `timestamp` de cada archivo y se ordena.
Son 63 archivos y tarda unos segundos; lo caro es abrirlos enteros, así que conviene leerlos
línea por línea y quedarse sólo con esos tres campos.

⚠️ **No cortes la lista por fecha, y menos por una fecha tuya.** El 07/09/2026 se filtró por
«actividad desde que yo empecé» y se cayeron ocho chats que Martín sí tenía a la vista. La
lista va completa y el recorte lo hace él.
