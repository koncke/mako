# Relevo: chat «Sidebar» (la barra, la navegación y el teléfono que la sigue)

<sub>Escrito el 18/10/2026 (hora AR), con la cuenta claude4 al 89% de la cuota semanal.</sub>

**Pegar en un chat nuevo:** «Sos el jefe Sidebar. Leé docs/relevo/sidebar.md y docs/diseno-sidebar.md (la v2 arriba) y seguí
con lo pendiente. No pushees: pasale tu punta al Cerebro.»

## Qué es de este chat

`app/_components/nav.ts` (el ÚNICO que lo edita; los demás chats pasan nombre, ruta, key y roles), `Sidebar.tsx`,
`BuscadorNav.tsx` + `lib/buscador-nav.ts`, y el lado teléfono que copia la barra: `lib/movil-rutas.ts` (familias de More,
barra de abajo), `app/m/mas`. El diseño y por qué: `docs/diseno-sidebar.md`. El test: `tests/sidebar-nueva.test.ts`.

## Dónde quedó

- La sidebar del prototipo (lo diario arriba, Sales · Marketing · Create, Ctrl K, la cara del menú de la foto, More con la
  foto real, barra de abajo CRM · Chats · Dashboard · Plan · More) está en main.
- **18/10: «Ops Center» en todos los negocios** (la fila de /second-brain con ese nombre y la estrella): rama
  `ops-center-clientes` en `C:/dev/wt-sidebar-email`, salida de origin/main. Commit hecho, **sin pushear** (pushea el Cerebro).

## Lo que falta (con el archivo donde vive)

1. **Dashboard con Focus**: lo hizo el jefe «Dashboard» (7e0a57b2a). La fila «Dashboard sheets» de More
   (`SECCIONES_MAS` en `lib/movil-rutas.ts`) se queda: quien no armó hojas en el Dashboard llega a Marketing/Comercial
   del teléfono sólo por ahí.
2. **My Profile con «My leads / My tasks / My reports / Favorites»** (prototipo de coherencia, parte 7): antes hace falta
   un filtro «míos» en el CRM y el Plan. No se dibujaron filas que mientan.
3. **La barra de abajo flotante con el activo en píldora** (prototipo): es de `app/m/_ui/ShellM.tsx`, no se tocó.
4. **Mirarlo en un navegador**, escritorio y 390 px, en el ws3 (nunca el ws1). Esta tanda la fijan los tests y el tsc;
   nadie la vio dibujada.
5. Los textos de MaKo que dicen «Second Brain → Persona» (lib/secciones-negocio.ts, reglas del chat): el lugar ahora se
   llama Ops Center en la barra del negocio. Es contenido del jefe Second Brain.
6. Viejos: Resend Receiving + MX para el email entrante de Chats; sacar del todo la key `experimentos` cuando las
   redirecciones del Dashboard estén en producción.
