# Relevo — API de MaKo (09/10/2026, cuenta 2, uso semanal 92%)

Escrito por el chat que hizo el trabajo. Lo que sigue es de PRIMERA mano.

## El pedido abierto

Martín, 08/10 a la noche, literal:

> «Falta todo lo de las tareas en el apartado de CURSOS... También falta la comunidad...
> Estoy seguro que en el resto de cosas, como CRM, Plan, etc deben faltar acciones posibles.
> Investiga bien e implementalo todo.»

## Lo que YA está en main y en producción

- `3b684747` + cosecha `938c17b0`: el curso por la API acepta `tareas` en crear/editar una clase
  (los ids de los campos se conservan) y el video por código `<iframe>` (Panda, Wistia, Bunny).
  Probado de punta a punta en el ws9. Deploy Ready.
- Antes: la API copiada de GitHub (`b51155c9`) y el área «curso» con 11 operaciones (`c4309144`).

## Lo que quedó A MEDIAS — y dónde está

**Rama local `wip/api-acciones-0910`** (NO pusheada), en el worktree `C:/dev/mako-api`:

- `987bd737`: 220 archivos, +30.434 / −4.901. Las operaciones nuevas del registro, área por área.
- `bf5d86f7`: `docs/api-acciones-relevo.json` (lo que devolvió cada agente: relevamiento,
  verificación e implementación por área; la lista a implementar de cada una es
  `<area>.verificar.aprobadas`) y `scripts/integrar-rest-wip.ts` (agrega las rutas REST que
  devolvieron los implementadores y avisa las que faltan o chocan).

La corrida fue `wf_c0a3860e-135` (20 áreas × relevar → verificar → implementar → revisar). Se cortó
tres veces: límite de uso y dos cierres de sesión. **No se puede reanudar desde otra sesión** (el
caché es de la misma sesión): hay que lanzar una corrida nueva con las listas del JSON.

| Área | Pantalla / ya en la API / a implementar | Estado |
|---|---|---|
| comunidad (área NUEVA, registrada) | 41 / 0 / 41 | implementada, **sin revisar** |
| contenido | 27 / 15 / 8 | implementada, sin revisar |
| email | 32 / 22 / 12 | implementada, sin revisar |
| general | 25 / 14 / 4 | implementada, sin revisar |
| integraciones | 46 / 20 / 5 | implementada, sin revisar |
| whatsapp | 62 / 39 / 8 | implementada, sin revisar |
| experimentos | 15 / 14 / 1 | implementada; la revisión se cortó |
| landing | 46 / 27 / 12 | implementada; la revisión se cortó |
| **curso** (tareas como recurso, entregas, alumnos, quiz/publicar/comentar) | 54 / 11 / 42 | **a medias** |
| crm | 120 / 56 / 37 | a medias |
| plan | 75 / 24 / 27 | a medias |
| cs | 50 / 8 / 26 | a medias |
| chatbot | 63 / 26 / 26 | a medias |
| video | 59 / 10 / 31 | a medias |
| negocio | 79 / 41 / 22 | a medias |
| ads | 50 / 27 / 20 | a medias |
| equipo | 49 / 17 / 17 | a medias |
| closing | 13 / 10 / 7 | a medias |
| metricas | 37 / 28 / 6 | a medias |
| mako | 19 / 6 / 4 | a medias |

«A medias» = el implementador escribió parte y se cortó: hay defs sin runner, extracciones de
server actions a `lib/` empezadas, tests parciales. **No se sabe qué compila.**

## Cómo seguir (en este orden)

1. En `C:/dev/mako-api` (`git switch wip/api-acciones-0910`): `npx tsc --noEmit` y ver qué está roto.
2. Corrida nueva por área con la lista de `docs/api-acciones-relevo.json`, diciéndole a cada
   implementador que hay trabajo a medias (mirar `git diff 938c17b0 -- <sus archivos>`) y que siga
   desde ahí. Después, el revisor de seguridad por área (las 20, incluidas las «implementadas»).
3. Rutas REST: `node --import tsx scripts/integrar-rest-wip.ts <resultados.json> --escribir`
   (lee el registro real y lista las ops http sin ruta).
4. `node --import tsx scripts/generar-api-doc.mjs` (docs + snapshot), `npm test`, typecheck,
   `npm run build` (hay server actions tocadas), e2e en el ws9.
5. Juntar con main: `git merge origin/main`. Ojo: el CRM subió `40d01258` sobre `lib/mako-intencion.ts`
   (mi único cambio ahí es la clave `comunidad` de `AREA_KEYWORDS`), y el hunk de `package.json`
   (`typecheck` → `typecheck-lock.mjs`) ya está en main: se descarta. Varias server actions de
   `app/` se tocaron para extraer lógica a `lib/` → posibles conflictos con otros chats.
6. Cosecha (hallazgos-api-mako, AGENTS.md, bitácora de /admin/dev) y push. Recién ahí avisar a Martín.

## Decisiones de Martín pendientes (no inventar)

- Comunidad: con qué AUTOR se publica por la API. El implementador eligió «la persona que confirma
  o la que creó el token; sin persona, no se publica» (ver cabecera de `comunidad.def.ts`).
- Un token detallado no se apaga cuando su creador pierde el acceso (seguridad; ofrecí arreglarlo).
- El alcance en `/api/agente/plan` y `/lead` (POST) no se mira.
- Publicar `plugin/` en el repo público. Borrar las llamadas de prueba del ws9 en `api_llamadas`.

## Aviso del chat del CRM (09/10)

El mismo cuello del clasificador del doer que arreglaron para el CRM (`esPedidoSobreLead`) existe
para las operaciones de otras áreas (ads, chatbot, email): un verbo sin tilde y sin un objeto que el
clasificador conozca cae al default `capturar`. No está medido.
