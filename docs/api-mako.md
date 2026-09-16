# API de MaKo — referencia

> Generada de `lib/api-mako/areas/*.def.ts` por `scripts/generar-api-doc.mjs`. No la edites a mano: cambia la definición y regenera.

## Cómo se usa

- **Autenticación:** `Authorization: Bearer <token>`. El token se genera en **Integraciones → Claude** de MaKo y es de UN workspace: no hay forma de pedir los datos de otro.
- **Alcance del token** (se elige al generarlo):
  - `lectura` — **Solo leer.** El agente consulta tu negocio y tus números. No deja nada pendiente ni propone cambios.
  - `proponer` — **Leer y proponer.** Además deja propuestas y acciones pendientes que tú confirmas en MaKo o por WhatsApp. Nada se escribe sin tu confirmación.
  - `ejecutar` — **Leer, proponer y ejecutar.** Además puede confirmar por sí mismo las acciones que dejó pendientes (mover un lead, pausar una campaña). Lo que gasta plata sigue pasando por una pantalla.
- **Catálogo:** `GET /api/v1` devuelve, para tu token, todas las operaciones con sus parámetros. Empieza por ahí: lo que no aparece, no existe para ese token.
- **Lecturas:** `GET /api/v1/{area}/{operacion}?param=valor`. La respuesta trae `Content-Type` según la salida (`application/json`, `text/markdown`, `text/csv` o `text/plain`).
- **Acciones:** `POST /api/v1/{area}/{operacion}` con el cuerpo en JSON. Ninguna escribe directo: devuelve una **pendiente** (la confirma una persona en MaKo o por WhatsApp) o una **propuesta** con un link a la pantalla donde se revisa.
- **Pendientes:** `GET /api/v1/mako/listar_pendientes` lista las vigentes; `POST /api/v1/mako/cancelar_accion` descarta una; `POST /api/v1/mako/confirmar_accion` la ejecuta, solo con alcance `ejecutar` y siempre con su `id`.
- **Errores:** siempre `{ ok: false, error }`, con `faltan` (parámetros) o `disponibles` (qué sí se puede pedir) cuando ayuda. 400 es tuyo, 401 es el token, 404 no existe para este token, 429 es el ritmo, 500 es nuestro.
- **Cuerpos con acentos:** manda el JSON desde un archivo (`--data-binary @archivo.json`), no inline en la shell.
- **Tope del cuerpo:** 256 KB. Los textos cortan en 4000 caracteres y las listas en 200 ítems salvo que la operación declare otro tope.

## Índice

- **MaKo (pendientes, propuestas, chats)** (`mako`): `listar_pendientes` · `confirmar_accion` · `cancelar_accion`

## MaKo (pendientes, propuestas, chats) — `mako`

Tab **Pregúntale a MaKo** (`/mako`). 1 lecturas · 0 acciones · 2 controles.

### `GET /api/v1/mako/listar_pendientes` — Acciones pendientes de confirmar

Lista las acciones que quedaron pendientes de confirmación y siguen vigentes (no vencidas): qué se propuso, de dónde vino y cuándo vence. En WhatsApp muestra las del grupo y las que llegaron por la API del mismo negocio. No requiere parámetros.

- **Alcance mínimo del token:** lectura
- **Devuelve:** json
- **Costo:** gratis

_Sin parámetros._

```bash
curl -s "https://hola-mako.com/api/v1/mako/listar_pendientes" -H "Authorization: Bearer $TOKEN"
```

### `POST /api/v1/mako/confirmar_accion` — Confirmar una acción pendiente

EJECUTA una acción que estaba pendiente de confirmación, cuando la persona dio el OK («sí», «dale», «confirmo»). En WhatsApp, si hay una sola pendiente vigente puedes omitir el id; en cualquier otro canal el id es obligatorio (de listar_pendientes). Por la API solo funciona con un token de alcance «ejecutar».

- **Alcance mínimo del token:** ejecutar
- **Control:** corre directo sobre una pendiente ya existente.
- **Costo:** gratis

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `id` | number | no | id de la acción pendiente a ejecutar (de listar_pendientes). |

```bash
curl -s -X POST "https://hola-mako.com/api/v1/mako/confirmar_accion" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary '{}'
```

### `POST /api/v1/mako/cancelar_accion` — Cancelar una acción pendiente

Cancela una acción pendiente (la persona dijo que no, o cambió de idea). En WhatsApp, si hay una sola vigente puedes omitir el id; en cualquier otro canal el id es obligatorio.

- **Alcance mínimo del token:** proponer
- **Control:** corre directo sobre una pendiente ya existente.
- **Costo:** gratis

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `id` | number | no | id de la acción pendiente a cancelar (de listar_pendientes). |

```bash
curl -s -X POST "https://hola-mako.com/api/v1/mako/cancelar_accion" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary '{}'
```
