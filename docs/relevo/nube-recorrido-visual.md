# Relevo — lo que seguía abierto del recorrido visual y de la llamada con Leila (nube, 6/11/2026)

> Escrito por la sesión de la nube que hizo el trabajo (`cli_11df35a4-d789-5260-a695-cc3c7b859c4e`). Es de primera mano sobre
> lo que se escribió y se probó acá. **Producción NO se midió:** desde la nube no hay base ni sesión. Esta sesión no le puede
> escribir al Cerebro: todo lo que hay que hacer está acá.

## Lo pedido (el brief del 6/11)

«Arreglá todo lo que siga abierto en `docs/recorrido-visual-30-10.md`… Medí cada uno contra main: varios ya pueden estar
hechos.» Más seis pedidos de la llamada con Leila del 5/11: el arrastre del Copywriter, el desplegable de la difusión del CRM, el
carrusel 4:5 en el Web Generator, el Image Editor roto con la barra fijada y el chat, una pantalla que explique MaKo Desktop y
Agency más a la vista en el menú del perfil. «Cada arreglo probado rompiéndolo, de a tandas chicas. Mirá a 1440 y a 390 px…
**No toques** Admin (`app/admin`), Carruseles, Dashboards ni `app/ads-manager`… Las decisiones de producto no se inventan.»

## Dónde está

Rama `punta/recorrido-visual` (también `claude/quirky-bell-z362p3`), ocho commits sobre main del 6/11 (siete de código y uno de documentos). GitHub la lleva a main
con el verde de `punta.yml`. **«En main» no es «en producción»:** desde el 6/11 la lleva un cron una vez por día. Sin mirar desde
la nube: si la corrida dio verde y si el deploy quedó «Ready».

El estado de CADA ítem, con su commit o su dueño, está arriba de todo en `docs/recorrido-visual-30-10.md` («Estado al
6/11/2026»). Antes y después en `docs/recorrido-visual/`.

## Lo hecho (cada uno con su test, probado rompiéndolo)

| Commit | Qué | Test |
|---|---|---|
| `cd0f4811e` | Web Generator: una presentación puede ser 4:5 (pantalla, miniaturas, presentar, PDF, PowerPoint y la API) | tests/editor-landing-carrusel-45.test.ts |
| `968eea8ee` | CRM: la foto que no carga cae a las iniciales (C1), el nombre no se corta (C2), las flechas del menú dicen qué mueven (C4) | tests/recorrido-crm-tarjeta.test.ts |
| `7132bc7f2` | Automations «Activa» (A3), /chats sin el panel repetido y con los filtros en una fila (CH2), el hueco del objetivo del Plan (P2), los nombres de la API (AP1) | tests/recorrido-chats.test.ts, tests/recorrido-plan-api.test.ts |
| `49a7cad73` | Settings › Instalar la app › «Para qué sirve» (Desktop) y Partners + Agency debajo de Settings en el menú del perfil | tests/recorrido-instalar-agency.test.ts |
| `8b384b9e5` | Copywriter: arrastrar un título se lleva su sección | tests/copywriter-arrastrar-seccion.test.ts |
| `e7c51f1b2` | Image Editor: con el editor angosto (barra + chat), el panel de herramientas va encima del lienzo | tests/recorrido-imagen-panel.test.ts |
| `80d1af1fc` | Offer: dos plantillas de «Nueva oferta» ya no se llaman igual (OF1) | tests/offer-v2-pantalla.test.ts |

Ya estaban en main: AD1 (`2fb65f144`), EQ1 (`488e13b52`), W2 y la difusión del CRM (`6bf0a40a8`, en main desde el 2/11).

## Lo que espera una decisión de Martín

1. **A1 — Automations, el segundo nodo cortado entre 1024 y 1280.** Lo corta el piso de zoom legible (`ZOOM_LEGIBLE`), que es a
   propósito. ¿Abrimos el panel del nodo ENCIMA del lienzo debajo de 1280 (como se hizo en el Image Editor), o bajamos el piso
   cuando el flujo entero entra?
2. **A2 — «CRON» en eventos que no son programados.** Es el rótulo que pidió textual para el disparador. ¿Lo dejamos?
3. **A4 — Mayúscula Inicial en los nombres de las automatizaciones** (vienen de las plantillas y de la base). ¿Se cambia la regla?
4. **W1 — el cartel «Continuar viendo» del reproductor de la portada** es de Panda (su configuración), no de MaKo: ¿se apaga en Panda?
5. **U3 — la sidebar a 730-811 px de alto:** el último ítem queda detrás del avatar y el activo no se ve. La sidebar no scrollea
   (regla suya): que entre es REORGANIZARLA, y eso lo decide el jefe «Sidebar» con él.
6. **Agency en el menú del perfil:** quedó Settings · Partners · Agency (Agency sigue «abajo de Partners», como pidió el 25/10).
   Confirmar que es lo que Leila quería.
7. **La difusión del CRM:** el rediseño está en main desde el 2/11. Si Leila lo vio con la cara vieja el 5/11, producción no lo
   tenía; si lo vio con la nueva, falta preguntarle qué del modal no le sirve.

## Para otros chats (no se tocó: son de ellos)

- **Admin:** SB1 (`app/admin/operaciones/Conversacion.tsx:250`, la caja dice «Escribe a Chat nuevo»; también
  `PiezasCliente.tsx:179`), CU1 y CU2 (`lib/clientes-plataforma.ts:164`, `customers-vista.ts:74,78`: las cuentas de prueba
  cuentan como clientes, y «Nuevos en 30 días» y «Para mirar» tienen alcances distintos sin decirlo).
- **Ads:** AD2 (dos entradas a MaKo a la vista: la caja del centro y la estrella).
- **Dashboards:** D1 a D7 (la tabla del recorrido).
- **Plantillas reales** (docs/plantillas-reales/): CR1 (miniaturas en blanco en Video, Image y Offer) y AV1 (los retratos de AI
  Avatar se hacen en Flow; la nube no los puede generar).
- **Iniciativa** (docs/mako-iniciativa/plan.md): AV2 en T15, A5 en T8, CH1 en la T4b que propone el recorrido.

## Lo que falta verificar

- En producción, después del deploy: el Image Editor a 1280 y 1366 con la barra fijada y el chat (debería verse como
  `docs/recorrido-visual/imagen-barra-chat-despues-1280.png`), y el arrastre del Copywriter con un documento real.
- P2 y OF1 no tienen captura: BoardShell y la pantalla de Offer no se montan fuera de la app sin sesión. Se probaron con sus tests.
- El Image Editor no tiene captura a 390: el teléfono no abre el editor (Create en el teléfono es otra pantalla).

## Cómo se armaron los bancos (el scratchpad no sobrevive)

- **El «antes»:** un worktree en `origin/main` (`git worktree add --detach <ruta> origin/main`, con `node_modules` enlazado).
- **El banco:** esbuild (API) sobre el componente de verdad, con un plugin que cambia los módulos `'use server'` por stubs y
  `server-only` y `node:*` por módulos vacíos; los tokens de la app en `:root`. El Image Editor: `EditorApp` con su
  `memoryAdapter`, un carrusel 1080×1350 de tres páginas, una barra falsa de 240 px y una tarjeta falsa de 348.
- **Las fotos:** Playwright con el node 22 del sistema (`require('playwright')`), no con el 24 de `scripts/node24.sh`.
- **El tsc acotado** muere en la nube a 2.560 MB: `armarTsconfig` (scripts/tsc-acotado.mjs) y
  `node --max-old-space-size=6000 node_modules/typescript/bin/tsc -p <json>`. Dio 0 errores en todas las tandas.

**Sin hito en las bitácoras de `/admin/dev`:** viven en `app/admin/dev/`, y el brief dice «No toques Admin (`app/admin`)» (lo
rehace otro chat). Los commits de arriba son la lista para anotarlos cuando se pueda. De paso: el Copywriter no es un área de
`/admin/dev` (ningún `vive[]` declara `app/copywriter`) y Offer no tiene bitácora.

La cosecha de cada área: hallazgos-editor-landing, -crm, -comunicacion (chats), -plan, -api-mako, -chatbot, -ajustes,
-copywriter, -editor-imagen, -offer e -infra (entradas del 6/11).
