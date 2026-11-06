# Hallazgos — Marketing CoPilot (la tab que antes era Ads Manager)

Área: `app/ads-manager/` y `lib/media-buyer/`. Pedido de Martín, 6/11/2026. Relevo: `docs/relevo/nube-marketing-copilot.md`.

## Renombrar una tab: el rótulo se cambia, la key no

- **Síntoma:** al llamarla «Marketing CoPilot» el primer intento rompía `guia-catalogo` («Entra a Ads Manager» en `lib/mako-capacidades.ts`), `sidebar-nueva` y las listas de More.
- **Causa:** `ads-manager` es una key que viven la base (capas, permisos, onboarding), la API y el móvil. La ruta `/ads-manager` la abren links guardados.
- **Regla:** se cambian `label` e `icon` en `app/_components/nav.ts` y `lib/movil-rutas.ts`; la key y la ruta NO. Los textos que le dicen a la persona dónde ir (`mako-capacidades.ts`, `lib/api-mako/tipos.ts`) llevan el nombre nuevo, y la API se regenera (`scripts/generar-api-doc.mjs`).
- **Trampa:** mover una tab de familia (Web Generator, de Marketing a Create) toca seis listas escritas a mano en tests (`sidebar-nueva`, `movil-mas-secciones`, `movil-rutas`) y el orden de More en `lib/movil-rutas.ts`, que debe seguir el de la barra.
