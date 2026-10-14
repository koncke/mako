# Image Editor — diseño (copia de Canva sobre el motor de Doory)

> **El pedido, textual (Martín, 14/10/2026):** «Quiero que implementes end to end un "Canva" dentro de
> MaKo, tal cual, copialo todo, tanto en diseño como funcionalidades. Revisa si hay algún repo que nos
> ahorre trabajo. Dejalo en "Content Machine" en una tab que sea "Image"».
>
> **Y la decisión de la base (14/10, entre tres opciones):** «Copia a Doory, y luego lo modificamos
> completamente para que sea original de MaKo, pero quiero la plantilla para ir trabajando».

Vive en `app/image-editor/` (tab «Image» de Content Machine, primera sección, «Editor»). Este documento
es el plano: qué se decidió, cómo está armado y qué falta. Los relevamientos que lo sostienen están en
`docs/editor-imagen/`:

| Archivo | Qué tiene |
|---|---|
| `repos/doory.md` | La base: licencia (qué obliga), arquitectura, tabla SÍ/PARCIAL/NO contra Canva, esfuerzo |
| `repos/tela.md`, `repos/fabritor-web.md` | Los descartados como base y las piezas que valen (snapping/reflow de Tela, recetas de fabric de fabritor) |
| `relevamiento-integracion-mako.md` | Cómo se enchufa una tab así en MaKo HOY: guard por persona, tests que barren, CSP, guardado, API |
| `relevamiento-contenido-licencias.md` | Fotos, íconos, fuentes, plantillas e IA en el navegador con licencia usable |
| `relevamiento-canva-armazon.md` | El armazón de Canva medido (paleta, proporciones, rótulos) — para el re-vestido |
| `relevamiento-canva-funciones.md` | La checklist de funciones de Canva — para lo que le falta a Doory |

---

## 1. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Motor: Doory** (`shaongitbd/doory`, commit en `_doory/COMMIT-DOORY`), su frontend portado a `app/image-editor/_doory/` | Martín, 14/10. Es el único Canva open source completo sobre fabric.js 7 (≈51 mil líneas de editor, TS estricto, ≈60 % de Canva). Ahorra 25–40 días contra escribirlo (`repos/doory.md` §8) |
| 2 | **El crédito de Doory se muestra en cada apertura del editor** (`editor/CreditoDoory.tsx`) y el `LICENSE` viaja con el código (`_doory/LICENSE-DOORY`, `NOTICE-DOORY`, `THIRD_PARTY-DOORY.md`) | La licencia es la Attribution Assurance License: servir el JS es redistribuir y pide «a prominent display … each time … launched». Modificar el código NO saca la obligación: se va con permiso escrito del autor (su propio `NOTICE` dice «the rest is MIT», sirve para pedírselo) o reescribiendo sin su código |
| 3 | **Sólo el super admin, por PERSONA** (`acceso.ts`, molde `b112e5b7` del Video Editor) + `adminOnly` en el nav | `adminOnly` sólo esconde la fila: por URL abriría a cualquier admin de un cliente (`relevamiento-integracion-mako.md` §0.6). Abrirlo a clientes pide resolver antes el crédito (#2) |
| 4 | **Etapa 1 = «plantilla para ir trabajando»: diseños e imágenes en el navegador** (IndexedDB, una base por workspace, `espacio.ts`), con el adaptador de «invitado» de Doory en modo `account` | Es lo que Doory ya trae andando y lo que Martín pidió primero. **Etapa 2: Supabase** (tabla de diseños + bucket, molde `landing_docs`/`landing-imagenes`): la regla de la casa es que el estado del producto va a la base, y la API de MaKo y las Estrellas leen de ahí (`relevamiento-integracion-mako.md` §0.7). Doory ya trae la migración «local → cuenta» (`migrateLocalDesign.ts`) |
| 5 | **Tokens de Doory prefijados `--cv-` y limitados a `.cv`**; su `global.css` reescrito colgado de `.cv` | Sus nombres (`--color-*`, `--text-*`, `--font-*`, `--space-*`) son los namespaces de Tailwind 4 y pisarían MaKo (`repos/doory.md` §4) |
| 6 | **Sin co-edición, comentarios, compartir, versiones, Marca ni fotos de stock en la etapa 1**: sus servicios van en `null` y el editor esconde esas herramientas | Dependen del backend Django de Doory. Vuelven con Supabase (etapa 2) |
| 7 | **Catálogos estáticos de MaKo** (`mako/servicios.ts`): fuentes de Google Fonts por la copia de jsDelivr de `@fontsource/*`; elementos y plantillas, los de prueba de Doory hasta el catálogo propio | El backend de Doory los servía. Licencias en `relevamiento-contenido-licencias.md` |
| 8 | **Dependencias nuevas instaladas SIN `npm install` en el clon** (en `C:/dev/canva-deps` y copiadas a `node_modules`), `package.json`/lock con `--package-lock-only` | El `node_modules` compartido tiene paquetes sueltos de otra sesión (`@simplewebauthn/*`): un `npm install` común los borraba |
| 9 | **Textos de pantalla en español neutro (tú)**, con los nombres de Canva | AGENTS.md + `tests/puente-panel-copy.test.ts` barre el port entero |
| 10 | **Onboarding = estado vacío** («Crear un diseño»), sin entrada en el catálogo | La tab ES la herramienta (regla del 05/10, como el Video Editor) |

**Lo que NO se copia de Canva:** el logo, los íconos propios, la fuente Canva Sans, sus plantillas,
fotos y elementos (son de Canva o de sus proveedores), publicar directo en redes, y lo «Pro» como
corona (no hay planes dentro del editor).

---

## 2. Cómo está armado

```
app/image-editor/
  page.tsx                 /image-editor — guard + inicio
  [diseno]/page.tsx        /image-editor/<id> — guard + editor
  acceso.ts                quién entra (hoy: sólo el super admin, por persona)
  espacio.ts               un repositorio IndexedDB por workspace
  ruta.ts                  rutas internas con el `?ws=`
  ImageEditorCliente.tsx   raíz `.cv` (tokens + estilos base de Doory), monta todo sin SSR
  inicio/Inicio.tsx        crear por tamaño + recientes (el inicio de Canva llega con el re-vestido)
  editor/PantallaEditor.tsx carga el diseño, arma el adaptador y monta EditorApp
  editor/CreditoDoory.tsx  el crédito que exige la licencia
  mako/servicios.ts        fuentes, elementos y plantillas del lado de MaKo
  _doory/                  el frontend de Doory portado (sin tests, sin el shell de su app)
    editor/                el editor: engine/ (fabric), chrome/, panels/, toolbar/, workspace/, dialogs/…
    types/                 documento, adaptador y tipos de su API
    lib/                   document.ts, local/ (IndexedDB), api/ (cliente de su backend: sin uso en MaKo)
    features/editor/adapters/  adaptadores de invitado/cuenta/compartido (MaKo usa el de invitado)
    styles/                tokens.css (`--cv-*`) y global.css (colgado de `.cv`)
    LICENSE-DOORY · NOTICE-DOORY · THIRD_PARTY-DOORY.md · COMMIT-DOORY
```

**El enchufe entre MaKo y el editor es UNO: `EditorAdapter`** (`_doory/types/adapter.ts`): guardar,
subir una imagen, resolver una URL y los servicios (fuentes, elementos, plantillas, subidos, marca,
stock, versiones, compartir, comentarios). El editor no toca rutas, sesión ni HTTP. La etapa 2 es
escribir un adaptador de Supabase, no tocar el editor.

**Extender el editor:** `_doory/editor/extensions.ts` (`registerPanel`, `registerToolbarSection`,
`registerCommand`, `registerExportFormat`, `registerObjectKind`). Los paneles ya declaran
`placement: 'drawer' | 'sidebar'`: el riel izquierdo de Canva es mover herramientas, no reescribir.

---

## 3. Reglas para el código nuevo del editor

1. **Texto de pantalla**: el rótulo de Canva en español, en tú, corto. Los textos de Doory viven en
   `_doory/editor/**/strings.ts`: se cambian ahí, no en el JSX.
2. **Colores**: los `--cv-*` de `styles/tokens.css`. El re-vestido cambia los VALORES por la paleta
   medida de Canva (`relevamiento-canva-armazon.md`), no los nombres.
3. **Navegación**: `Link`/`useRouter` de `@/app/_ui/Link`, o `rutaEditor()`.
4. **Nada del server importa de `_doory/`**: el motor entra sólo por `ImageEditorCliente`.
5. **Imágenes de afuera se copian antes al almacenamiento propio**: Openverse/Picsum no mandan CORS y
   un lienzo con una imagen ajena no se puede exportar (`relevamiento-integracion-mako.md` §0.3).
6. **Nada que cobre por default**; IA de imagen por el puente a Flow (decisión del 11/10).
7. **Typecheck acotado**: `node C:/dev/tsc-cv.mjs` (sólo `app/image-editor`, con el lock de la
   máquina; `tsconfig.cv.json` no se versiona). El completo lo corre el pre-push.
8. **Borrar** = el tacho de la casa (`BotonBorrar`).

---

## 4. Qué falta (por tandas)

| Tanda | Qué | Estado |
|---|---|---|
| 1 | Port de Doory + cáscara de MaKo + textos en español + crédito | en curso (14/10) |
| 2 | **Re-vestido como Canva**: barra superior (Archivo, Redimensionar, título, Compartir violeta), riel izquierdo con panel (Diseño, Elementos, Texto, Marca, Subidos, Herramientas, Proyectos, Apps), barra contextual, barra inferior (Notas, zoom, cuadrícula de páginas, pantalla completa), inicio de Canva; paleta y proporciones medidas | pendiente |
| 3 | **Supabase**: tabla de diseños (jsonb + miniatura, por workspace), bucket de imágenes, adaptador; Marca, versiones, compartir y comentarios con tablas propias | pendiente |
| 4 | **Catálogo propio**: ~64 fuentes alojadas + combinaciones, packs de íconos MIT/Apache por Iconify, emoji Fluent/Noto, ilustraciones CC0, formas/líneas/marcos/cuadrículas propias, plantillas propias (las 10 de Doory al principio), fotos de Unsplash | pendiente |
| 5 | **Lo que a Doory le falta frente a Canva**: texto en formas, tablas, cuadrículas, dibujar, copiar estilo, efectos de texto Elevar/Salpicadura/Eco/Glitch, líneas en codo/curvas, gráficos con datos, ajustes de foto que faltan, quitar fondo de objetos, borrador mágico | pendiente |
| 6 | **API de MaKo** (área del editor: listar/crear/exportar diseños) y Estrellas `formato_imagen` | pendiente (necesita la etapa 3) |
