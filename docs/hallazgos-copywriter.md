# Hallazgos — Copywriter (app/copywriter, lib/copywriter)

Lo que costó o sorprendió armando el Copywriter (mila.gg + Notion, 28/10/2026). El diseño y sus decisiones están en
[diseno-copywriter.md](diseno-copywriter.md); acá va lo que no se deduce del código.

## `adminOnly` esconde la fila; la puerta es otra cosa (28/10/2026)

- **Síntoma posible:** una tab nueva «sólo para el super admin» con `adminOnly: true` en nav.ts y
  `requireRolWs([], { nav })` en la página **se abre para el admin de CUALQUIER negocio** que escriba la URL: esa puerta
  pregunta el rol del workspace y la capa, no si es la agencia.
- **Dónde vive la puerta:** `app/copywriter/acceso.ts` (`veCopywriter`, con `getSesionAdmin`), el molde de AI Avatar. La
  preguntan las dos páginas de escritorio, las dos del teléfono (`app/m/copywriter/puerta.ts`) y las dos rutas /api.
- **Y la API de MaKo también:** su `gating.tab` mira la CAPA del negocio, y las capas `completo` y `agencia` ven todas las
  tabs. Cada runner del Copywriter pregunta la misma puerta (`veCopywriterEnApi`). El día que Martín lo abra, se cambia
  ESE archivo.
- **La regla:** una tab que nace para el super admin lleva su `acceso.ts` desde el primer commit, y
  `tests/redirige-antes-del-loader.test.ts` (PUERTAS) tiene que conocer sus `require…`.

## El «/» del Web Generator era de Gamma por dentro (28/10/2026)

- **Lo que parecía:** un plugin genérico del menú «/» (app/web-generator/editor/extensiones/barra.ts) que cualquier editor
  podía montar.
- **Lo que era:** `consultaValida` le preguntaba al catálogo de GAMMA si lo escrito con espacios todavía era un comando,
  y el plugin traía los atajos de Gamma, donde «> » es una cita. En Notion «> » es una **lista desplegable** y la cita es
  «" ». Montado tal cual en el Copywriter, «/pedirle a» se cerraba solo y «> » armaba una cita.
- **Cómo quedó:** el plugin recibe `buscar` (el catálogo) y `atajos` (los de Gamma, que el Copywriter apaga). Sin opciones
  hace lo de siempre. Los atajos de Notion van en una EXTENSIÓN con prioridad 101 (`AtajosNotion`, app/copywriter/editor/
  extensiones.ts): las reglas se prueban en el orden de las extensiones y gana la primera.
- ⚠️ **No subirle la prioridad a un NODO para que su regla gane:** la prioridad de un nodo cambia el orden del esquema, y el
  primer nodo del grupo `block` es el que TipTap usa para rellenar un documento.

## Los guiones viven en `app_settings`, con compare-and-set (28/10/2026)

- Un índice (`mako.copywriter.indice`) y un documento por guion (`mako.copywriter.doc.<id>`), como los guiones del Ads
  Writer en `mako.razones`: sin migración, y testeable en local sin tocar el esquema de producción.
- `cambiarSettingSi` compara el VALOR ENTERO: el índice se lee, se cambia con una función pura (lib/copywriter/arbol.ts) y se
  reescribe sólo si nadie lo cambió en el medio, hasta 4 veces. El documento exige la `version` que se abrió (409 →
  «Recargar», nunca pisa).
- Si un negocio llega a cientos de guiones con versiones, se muda a una tabla con su migración (y sus tres registros: ver
  la cabecera de `supabase/migrations/0246_editor_landing.sql`).

## Lo que crees MIENTRAS corren los tests afectados lo ven las barredoras (28/10/2026)

- **Síntoma:** `tests/api-mako-registro.test.ts` rojo en la corrida de la tanda 1 («nadie mira estos runners:
  copywriter»), con un archivo que NO era de esa tanda.
- **Causa:** `tests-afectados` arma su lista al empezar, pero las barredoras que recorren carpetas con `readdir` leen el
  disco cuando les toca (a los 13 minutos, con poca RAM). `lib/api-mako/areas/copywriter.run.ts` se escribió en el medio.
- **La regla:** mientras corren los afectados, no se crean archivos en carpetas que barre un test (lib/api-mako/areas,
  app/m, app/api). Se escriben después, o en otro worktree.

## Qué quedó sin hacer

- La búsqueda web con fuentes de mila.gg (MaKo no tiene una para los chats): docs/diseno-copywriter.md → «Qué queda».
- Versiones guardadas del documento (hoy: deshacer, y la foto de antes mientras hay una propuesta de MaKo).
