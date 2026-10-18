# Relevo: chat «Sidebar» (la barra, la navegación y el teléfono que la sigue)

<sub>Escrito el 18/10/2026 de madrugada (hora AR), con la cuenta claude4 al 85% de la cuota semanal.</sub>

**Pegar en un chat nuevo:** «Sos el jefe Sidebar. Leé docs/relevo/sidebar.md y docs/diseno-sidebar.md (la v2 arriba) y seguí
con lo pendiente. No pushees: pasale tu punta al Cerebro.»

## Qué es de este chat

`app/_components/nav.ts` (el ÚNICO que lo edita; los demás chats pasan nombre, ruta, key y roles), `Sidebar.tsx`,
`BuscadorNav.tsx` + `lib/buscador-nav.ts`, y el lado teléfono que copia la barra: `lib/movil-rutas.ts` (familias de More,
barra de abajo), `app/m/mas`. El diseño y por qué: `docs/diseno-sidebar.md`. El test: `tests/sidebar-nueva.test.ts`.

## Dónde quedó

- **Rama `sidebar-v2`** en `C:/dev/wt-sidebar-email` (salió de `origin/integracion` 2858b8185): la sidebar del prototipo
  (lo diario arriba, Sales · Marketing · Create, barra fija con flecha, Ctrl K sin modal, la cara del menú de la foto,
  colores de sección, More del teléfono con la foto real, barra de abajo CRM · Chats · Dashboard · Plan · More). Commit
  hecho, **sin pushear** (pushea el Cerebro).
- La tanda anterior (Chats unificado, Ops Center arriba, Admin al menú de la foto) ya está en main (51cbc9df8).

## Lo que falta (con el archivo donde vive)

1. **Dashboard abre en Focus** (`app/dashboard/page.tsx`, `app/general/page.tsx`, del jefe «Dashboard»): hoja fija Focus,
   botón Templates, /general → /dashboard?hoja=focus. Se le mandó el plan medido el 17/10. Cuando esté: sacar la fila
   «Dashboard sheets» de More (`SECCIONES_MAS` en `lib/movil-rutas.ts`) y el alias, si cambia la ruta.
2. **My Profile con «My leads / My tasks / My reports / Favorites»** (prototipo de coherencia, parte 7): antes hace falta
   un filtro «míos» en el CRM y el Plan. No se dibujaron filas que mientan.
3. **La barra de abajo flotante con el activo en píldora** (prototipo): es de `app/m/_ui/ShellM.tsx`, no se tocó.
4. **Mirarlo en un navegador**, escritorio y 390 px, en el ws3 (nunca el ws1). Esta tanda la fijan los tests y el tsc;
   nadie la vio dibujada.
5. Viejos: Resend Receiving + MX para el email entrante de Chats; sacar del todo la key `experimentos` cuando las
   redirecciones del Dashboard estén en producción.
