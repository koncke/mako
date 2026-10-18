# Sidebar nueva: dónde estaba cada tab, dónde queda y qué app lo inspiró

> Prototipo (17/10/2026, pedido de Martín 21:30). **No está implementado:** el código de `nav.ts` y `Sidebar.tsx` no se tocó.
> Se ve en `docs/prototipos/sidebar-nueva-1710.html` (un solo archivo; claro por defecto, Nord + azul Meta, con interruptor a oscuro).
> Atajos para abrir una vista directa: `#super`, `#closer`, `#phone`, `#compare` (la de hoy al lado), `#all`, `#rail`, `#dark`, `#menu`, `#search`.

## La estructura

```
[buscador  Ctrl K]
☻ Second Brain  (super admin: ☻ Ops Center)      ← arriba, con su criatura, como hoy
Home · Plan · Chats (contador) · Dashboard       ← lo de todos los días, sin rótulo
SALES      CRM · Calendar · Automations · Clients · MaKo Partners*
MARKETING  Offer · Web Generator · Ads Manager
CREATE     Video · Image · Copywriting · AI Avatar†
[foto]  Account · Business settings · API · Report a problem   (super admin: + Platform)
```

\* sólo super admin y admin de una agencia · † sólo super admin. Cada rótulo se pliega solo y se recuerda; arranca abierto el de
Sales. Un rótulo con UNA sola fila visible no se dibuja (el closer ve CRM suelta, sin carpeta). Los fijados (chinche) suben arriba.

**Honesto con los números:** las filas no bajan (admin: 15 hoy, 15 nuevas; super: 18 hoy, 17 nuevas). Lo que baja es lo que hay
que leer al entrar (9 filas y 3 rótulos, contra 15 filas y 2 rótulos) y, sobre todo, lo que cambia es el criterio: tres nombres
que dicen QUÉ hay adentro (Sales, Marketing, Create) en lugar de «Operate» y «Sales Machine», que no dicen nada, y una zona de
arriba con lo diario. El teléfono repite lo mismo en More con los mismos nombres.

## El mapa

| Tab o cosa | Dónde estaba (hoy) | Dónde queda | App que inspiró la decisión |
|---|---|---|---|
| Ops Center (super) | Arriba, sin rótulo | Arriba, primera fila; adentro el Second Brain (grafo) y la Ticketera | Notion: la IA arriba y con carita |
| Second Brain (cliente, closer) | Arriba, sin rótulo | Igual | Notion (Notion AI) |
| General | Operate | Arriba, se llama **Home** | Linear, Notion, Attio y HubSpot: todas tienen «Home» |
| Plan | Operate | Arriba | Attio «Tasks», Linear «My issues» |
| Chats | Operate | Arriba, con el contador (adentro: Chats · MaKo WhatsApp, super) | Linear «Inbox», Attio notificaciones |
| Dashboard | Operate | Arriba | Attio «Reports», HubSpot «Reporting» |
| CRM | Operate | Sales | HubSpot: CRM y Sales juntos |
| Calendar | Operate | Sales (llamadas, etapa por evento) | GoHighLevel: Calendars al lado de Contacts |
| Automations | Sales Machine | Sales (adentro: + MaKo Messages, super) | GoHighLevel: Automation junto al CRM |
| Clients | Operate | Sales (siete sub-tabs adentro, como hoy) | Attio: los clientes son registros del mismo CRM |
| MaKo Partners | Operate | Sales, sólo agencias y super admin | GoHighLevel: menú distinto por agencia y plan |
| Offer | Sales Machine | Marketing (adentro: + Strategy y Playbook, super) | HubSpot: lo que atrae va bajo Marketing |
| Web Generator | Sales Machine | Marketing | HubSpot: sitio y landings bajo Marketing |
| Ads Manager | Operate | Marketing | HubSpot: Ads bajo Marketing |
| Video | Sales Machine | Create (adentro: Editor · Create with AI · Reels) | HubSpot: lo que se produce separado de lo que se ejecuta |
| Image | Sales Machine | Create (adentro: Editor · Generator · Thumbnails · Carousels) | idem |
| Copywriting | Sales Machine | Create (adentro: Ads Writer · Ideas · YouTube · Stories · Method) | idem |
| AI Avatar (super) | Sales Machine | Create | idem |
| Coming soon (7, super) | Desplegable dentro de Sales Machine | Menú de la foto › Platform › Coming soon; cada una con su casa futura: VSL Generator y Lead Magnet → Create; Sales Email, Newsletters y Competitor Spy → Marketing; Closing Script y Sales Roleplay → Sales | Linear: lo poco usado detrás de «More», no en la lista |
| Pantallas de adentro de una tab (Editor, Strategy, Reels…) | Barra de arriba de la pantalla, sin pista en la barra | Igual, y el buscador las encuentra | Notion y Attio: buscador global; Skool: pestañas arriba |
| Tu cuenta · Configuración del negocio · API · Reportar problema | Menú de la foto (en castellano) | Menú de la foto: Account · Business settings · API · Report a problem (en inglés, como las tabs) | Attio y Notion: ajustes en el menú del espacio, no en la lista |
| Billing · Client Agents · MaKo Context · AI Models · Knowledge · Dev (super) | Menú de la foto | Menú de la foto › Platform (Dev sigue siendo un modo que cambia la barra) | idem |
| Barra en rail de íconos que se abre con el cursor | Por defecto (68 px) | Abierta y fija (244 px) con los nombres; la flecha la pliega al rail | Linear, Notion, Attio, HubSpot: nombres siempre visibles |
| Buscador global (no lo encontré en `Sidebar.tsx`) | no hay | Arriba, `Ctrl K`; encuentra tabs, pantallas de adentro y ajustes, y el nombre viejo (escribís «General» y te lleva a Home) | Notion, Attio, Linear |
| Fijados | no hay | Opcional: chinche al pasar el cursor, sección «Pinned» arriba | Linear, Notion, Attio y ClickUp: Favorites / pinned |

## Qué tomé de cada app (investigación acotada, 5 apps)

- **Linear** ([changelog 2024-12-18](https://linear.app/changelog/2024-12-18-personalized-sidebar)): arriba lo personal sin rótulo; secciones que se
  pliegan y se recuerdan; lo poco usado detrás de «More»; el contador de no leídos como número.
- **Notion** ([sidebar](https://www.notion.com/help/navigate-with-the-sidebar)): Search y Home arriba, la IA con cara, favoritos, Settings abajo, `Ctrl K` abre el buscador.
- **Attio** ([navegación](https://attio.com/help/reference/attio-101/introduction-to-navigating-attio.md)): menú del espacio (con Settings) y buscador (`Ctrl K`) arriba; después Home, bandeja, Tasks, Reports; secciones nombradas por lo que contienen.
- **HubSpot** (fuentes de terceros y comunidad, parcial): navegación a la izquierda, nombrada por trabajo (Marketing, Sales, Service); no se personaliza, y por eso es predecible.
- **GoHighLevel / ClickUp**: GHL es el caso a evitar (lista larga y plana de módulos; su solución es que la agencia oculte o reordene enlaces por cuenta y plan, que en MaKo ya son las capas). De ClickUp, fijar lo importante y un «More» para lo que no se usa todos los días ([ayuda](https://help.clickup.com/hc/en-us/articles/12157360089495)).

## Qué no verifiqué

- HubSpot y GoHighLevel salen de resultados de terceros y de la comunidad, no de su documentación oficial; el detalle de sus menús puede haber cambiado.
- El prototipo es una maqueta de la barra: la criatura es un dibujo parecido, no el `Muneco` real, y las pantallas son esqueletos.
- Renombrar General a «Home» y pasar el menú de la foto al inglés son cambios de etiqueta: las keys (`general`, `perfil`…) y las rutas no se tocan.
