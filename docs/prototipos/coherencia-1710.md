# Coherencia: Dashboard unido, perfil/More y tarjetas con una sola estética

> Prototipo (17/10/2026, pedido de Martín ~22:40, puntos 3, 7 y 8). **No está implementado:** no se tocó código de la app.
> Se ve en `docs/prototipos/coherencia-1710.html` (un solo archivo, sin dependencias; claro por defecto, Nord + azul Meta, con interruptor a oscuro).
> Parte de `sidebar-nueva-1710.html` (Sales / Marketing / Create, buscador `Ctrl K`, menú de la foto). Se dejaron afuera el riel de íconos y los fijados: no cambian.
> Atajos para abrir una vista directa: `#dashboard`, `#profile`, `#more`, `#crm`, `#clients`, `#plan`, `#refs`, más `phone`, `dark`, `super`, `old`, `menu`, `tmpl`, `info`, `move` (se juntan: `#crm,phone,dark`).

## Qué muestra (la barra de arriba salta entre pedidos; Computadora / Teléfono cambia el dispositivo)

| Pedido | Qué se ve |
|---|---|
| 3 · Dashboard | «Home» desaparece de la sidebar. **Dashboard** abre en la hoja **Focus** (lo que era Home: meta del trimestre, KPIs, lo de hoy); las otras pestañas píldora son las hojas de siempre; el botón **Templates** abre la galería con portada y «Use» suma una hoja. Buscar «home» o «general» lleva a Dashboard. La barra de abajo del teléfono pasa a CRM · Chats · Dashboard · Plan · More. |
| 7 · Perfil / More | Teléfono: More empieza con la foto real (lápiz para editarla), nombre y @usuario; abajo las mismas secciones de la sidebar con la fila de la referencia A (ícono de color, flecha). Tocar la foto abre **My Profile** (foto grande, filas «My leads», «My tasks», «My reports», «Favorites», luego Account, Business, Platform). Computadora: el menú de la foto con la misma cara y la página **My Profile** completa. |
| 8 · CRM | Tarjetas grandes: foto (o iniciales con la insignia del canal), nombre, subtítulo **plata · por dónde llegó**, píldora «See info». Computadora: pestañas píldora de vistas (Board · List · Follow-ups), tarjeta destacada «Next up» y tablero que se arrastra. Teléfono: pestañas píldora por etapa con contador, tarjeta destacada azul, lista; «See info» abre una ficha rápida con «Move to…». «Cards de hoy» (arriba) las compara con las de ahora. |
| 8 · Clients | La misma tarjeta con una barra de avance y el aviso en rojo (pago fallido, sin entrar). Pestañas píldora = las siete sub-tabs de hoy. |
| 8 · Plan | Tarea: el **círculo de prioridad** ocupa el lugar de la foto, con proyecto y fecha; sin botón (el círculo completa la tarea); la etiqueta «MaKo» en naranja si la creó MaKo. Columnas por estado; la prioridad es filtro, como quedó el 16/10. |
| Piezas y referencias | Las tres tarjetas juntas, el kit (botones, pestañas, fotos, colores, barra flotante, medidas), de dónde salió cada cosa y lo que queda por decidir. |

## Decisiones que tomé (Martín las puede cambiar al verlo)

- **Un color, un significado.** La referencia A pinta cada fila de otro color; acá el color del ícono es el de la **sección** (azul lo diario, verde Sales, violeta Marketing, turquesa Create, gris ajustes) y el naranja sigue siendo sólo MaKo. En la sidebar de escritorio sólo se tiñe el ícono, sin chip.
- **Barra de abajo:** flotante (referencia B) con el activo en píldora con su etiqueta (referencia A).
- **La tarjeta destacada es azul** porque azul = «vos actuás»: es lo próximo que tenés que hacer (llamar, completar, renovar).
- **Foto:** el lead de anuncios casi nunca tiene; cae a iniciales con el color del canal. Las fotos del prototipo son dibujos de ejemplo, no personas.
- **«See info»** es una ficha rápida; la ficha completa del lead no cambia.

## Decidido por el Cerebro (17/10, Martín lo puede cambiar)

1. Dashboard: **Focus es una hoja fija**, la primera, que no se borra. Cada bloque es una tarjeta de la hoja, con el mismo editor que las demás (ver `objectives-kpis-general-focus`).
2. Foto: **la de perfil de WhatsApp o Instagram cuando exista**; si no, iniciales con la insignia del canal.
3. Las vistas del CRM de escritorio se mapean a las que ya existen al implementar.

## Qué no verifiqué

- Las referencias reales (HubSpot, Pipedrive, Attio, folk) las leí en su documentación y changelog, **sin ver capturas**; de ellas tomé comportamiento, no aspecto (la estética es la de las dos referencias de Martín). Del móvil de Pipedrive y de Attio no hay documentación: sólo escritorio/web. Detalle por app en la página «Piezas y referencias».
- Es una maqueta: datos inventados, sin tocar datos reales, el resto de las pantallas son esqueletos. El teléfono es un marco fijo de 370 px; no se probó en un dispositivo real.
- Al implementar se tocan `app/_components/nav.ts` y `Sidebar.tsx` (Home fuera, Dashboard con Focus), `lib/movil-rutas.ts` (la barra de abajo) y las tarjetas del CRM/Clients/Plan (`lib/crm-movil.ts` y el tablero de escritorio).

## Trampa que costó un rato

En JS, `hash >> 3` sobre un hash sin signo (`>>> 0`) puede dar un número **negativo** y `arr[negativo % n]` es `undefined`: la foto de ejemplo reventaba sólo para algunos nombres y la pantalla quedaba en blanco sin mensaje. Usar `>>>` en todo el hash.
