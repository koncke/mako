# Hallazgos — Marketing CoPilot (la tab que antes era Ads Manager)

Área: `app/ads-manager/` y `lib/media-buyer/`. Pedido de Martín, 6/11/2026. Relevo: `docs/relevo/nube-marketing-copilot.md`.

## Renombrar una tab: el rótulo se cambia, la key no

- **Síntoma:** al llamarla «Marketing CoPilot» el primer intento rompía `guia-catalogo` («Entra a Ads Manager» en `lib/mako-capacidades.ts`), `sidebar-nueva` y las listas de More.
- **Causa:** `ads-manager` es una key que viven la base (capas, permisos, onboarding), la API y el móvil. La ruta `/ads-manager` la abren links guardados.
- **Regla:** se cambian `label` e `icon` en `app/_components/nav.ts` y `lib/movil-rutas.ts`; la key y la ruta NO. Los textos que le dicen a la persona dónde ir (`mako-capacidades.ts`, `lib/api-mako/tipos.ts`) llevan el nombre nuevo, y la API se regenera (`scripts/generar-api-doc.mjs`).
- **Trampa:** mover una tab de familia (Web Generator, de Marketing a Create) toca seis listas escritas a mano en tests (`sidebar-nueva`, `movil-mas-secciones`, `movil-rutas`) y el orden de More en `lib/movil-rutas.ts`, que debe seguir el de la barra.

## El agente se arma con reglas puras adelante, no con confianza en el modelo

- **Dónde:** `lib/media-buyer/copiloto.ts` (qué funnel conviene, `recomendarFunnel` / `evaluarFunnel`) y `lib/media-buyer/copiloto-contexto.ts` (lo que viaja al system).
- **Regla:** lo que se puede decidir con números (ticket, presupuesto, quién llama) lo decide el módulo puro y llega al system YA decidido («EL FUNNEL ELEGIDO NO LE SIRVE: …»). El modelo lo discute, no lo calcula. Un umbral se cambia en `UMBRALES` y los tests lo frenan en el borde exacto.
- **Las fuentes no se nombran:** `docs/conocimiento/anuncios-high-ticket.md` es de uso interno (casi todas las fuentes venden algo, ninguna cifra está auditada). El destilado (`copiloto-conocimiento.ts`) dice «un practicante de EE. UU., 2026», nunca el nombre; un test cruza la lista de nombres contra el documento para que no quede vieja.
- **Trampa del peso:** cada ficha de `lib/asesores` son ~5.000 caracteres en CADA mensaje. El CoPilot lleva a lo sumo dos (el referente elegido y una por tipo de funnel). Un test fija el tope.
- **Trampa de la tab:** el chat de una tab sólo toma su contexto propio si `MakoEnLaTab` declara `tab="Marketing CoPilot"` y la ruta lo mira (`desde.tab`). Cambiar el nombre en un lado y no en el otro lo deja hablando como el Ops Center, sin error. Un test lee los dos.
- **Una pantalla nueva con `<CajaChat>` entra en la lista de `tests/app-de-escritorio-todos-los-chats.test.ts`:** se pasó por alto en la primera entrega y lo cazó el test, no la revisión.
