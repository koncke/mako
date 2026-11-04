# Relevo — Competitors Spy en la nube (pedido de Martín del 4/11/2026)

Lo escribe el chat de la nube que trabaja los 14 puntos. Se actualiza en cada etapa. **La nube no llega a Apify, a Google
ni a la base**: todo lo de acá se probó con dobles y respuestas armadas con la forma del servicio. Lo que dice «sin
probar» hay que mirarlo en el negocio de prueba (ws 3) una vez desplegado.

## Cómo se sube

Cada etapa va a su rama `punta/spy-<nombre>` encima de `origin/main`; `.github/workflows/punta.yml` la chequea y, si da
verde, llega sola a `main`.

## Por punto

| # | Qué pidió | Estado | Rama | Sin probar contra el servicio |
|---|---|---|---|---|
| 1 | La barra principal busca igual que el «+», con las redes separadas | Hecho: la barra abre el buscador (y «/» o ⌘K); grupos Instagram · YouTube · TikTok · Sitio web con su logo | `punta/spy-busqueda` | Mirarlo en pantalla, escritorio y teléfono |
| 2 | Mensajes mientras tarda, y buscar también en YouTube por nombre | Hecho: «Esto puede tardar unos 20 segundos.» → «Con su @ exacto es más rápido.»; YouTube por nombre sale de Google | `punta/spy-busqueda` | Cuánto tarda de verdad una corrida de Google de dos páginas |
| 3 | Por nombre, los mejores resultados (las cuentas grandes) | Hecho: Google (ordena por popularidad y trae los seguidores) + el buscador de Instagram, ordenado por seguidores; las 5 primeras se completan en UNA corrida | `punta/spy-busqueda` | Que la descripción de Google traiga «492K Followers» como se espera; que el lector de perfiles acepte 5 usuarios en una corrida |
| 4 | Un link de Instagram = el @ exacto; un link de YouTube trae la foto | Hecho: con o sin https y con `?igsh=`; el canal se lee con `channels.list` (foto, nombre, suscriptores), y su foto es la cara del competidor si no tiene Instagram | `punta/spy-busqueda` | La foto del canal desde la clave de YouTube de la plataforma |
| 12 | El @ sin la arroba también se busca, y más rápido | Hecho: «den.borgg» ya no es un sitio; con la clave de Spy, Apify va primero (antes esperaba a Meta, hasta 12 s) | `punta/spy-busqueda` | El tiempo real del actor por @ |

## Cambios de cupo y de costo (lo decidí yo; está en `docs/diseno-competitors-spy.md` §11)

- Lecturas con la clave de Spy: 40 → **150 por día** (~US$0,39 el peor día), con 30 reservadas para agregar.
- Búsquedas por nombre: **cupo propio de 60 corridas** (30 búsquedas, US$0,65 el peor día). Antes compartían el de las
  lecturas y con tres búsquedas el negocio se quedaba sin poder agregar a nadie.
- Lo paga cada negocio con su clave. Si querés otros números, son dos constantes en `lib/instagram-perfil.ts`.

## Migraciones que faltan aplicar

Ninguna todavía.
