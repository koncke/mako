# Relevo — el «3,7×» de cada pieza, en la nube (pedido de Martín del 5/11/2026)

Lo escribe la sesión de la nube que hizo el trabajo. **Esta sesión no puede escribirle al Cerebro:** todo lo que hace falta
está acá. La nube no llega a la base ni a producción: se probó con datos inventados y los tests.

## El pedido

> En Top Carousels cada carrusel tiene un botón «3.7×» o «1.4×», igual que en vidIQ, y Martín quiere lo mismo en Competitors
> Spy y en la sección de carruseles de Image, con reels, carruseles, videos de YouTube y anuncios, calculado igual en toda la
> app. (El pedido entero, con la fórmula, está en el hito del 5/11 de `app/admin/dev/image-editor/bitacora.ts`.)

## Qué quedó

| Dónde | Qué |
|---|---|
| `lib/multiplo-rendimiento.ts` | **La única cuenta.** Lo que hizo la pieza ÷ la mediana de hasta 20 suyas del mismo formato y red, las más cercanas en el tiempo; 7 como mínimo; sin pagadas, sorteos, sin comentarios a la vista ni lo de menos de una semana. Carruseles e imágenes: me gusta + comentarios. Reels, shorts y videos: vistas (cortos y largos aparte). Anuncios: días activos, «3× activo». |
| Competitors Spy | El chip en la esquina de cada tarjeta (fuerte desde 2×, título con de qué mediana sale), filtro por mínimo (1×+ … 10×+), orden «Mejor rendimiento», el detalle de la pieza («Frente a lo que suele hacer»), y «Lo que mejor le fue» sobre la misma cuenta. |
| Carruseles de Image | El outlier del explorador, de la franja y de la biblioteca es el mismo número; el título del chip dice de dónde sale. Los de un tema siguen sin número («no se leyó su cuenta»). |
| API de MaKo | `que_esta_haciendo` (Spy) trae «Lo que mejor le fue» y el número de cada pieza («frente a su cuenta: 3,7×» o «sin datos suficientes»); `buscar_carruseles` trae `outlierDice`. |
| Tests | `tests/multiplo-rendimiento.test.ts` (12, probado rompiéndolo: 8 roturas, cada una 1 rojo). Se reescribieron a la regla nueva los que fijaban la vieja: `spy-ficha-tercera` (6), `carruseles-explorar`, `carruseles-biblioteca`, `spy-guion` (8) y `spy-vista`. |

Se borraron `vecesSuMediana` y la cuenta propia de `mejoresPiezas` (las dos contra la mediana de TODA la cuenta, con 3 piezas).
Sin migración: se calcula al mostrar.

## Lo que Martín tiene que saber (y no se resolvió acá)

1. **YouTube queda sin número hasta el trámite con YouTube (la enmienda III.L, `ENMIENDA_III_L` en lib/spy-reglas.ts).** Sus
   políticas prohíben un puntaje hecho con vistas sin esa enmienda. Está todo hecho y probado; el día que se acepte se cambia esa
   constante y aparece solo. Antes de esto, «Lo que mejor le fue» SÍ lo mostraba para YouTube sin mirar el interruptor: ahora no.
2. **Lo de menos de una semana no lleva número** (es la regla de Top Carousels). «Esta semana» del explorador y la franja de
   «Nuevo diseño» se ordenan entonces por interacción.

## Lo que falta verificar

- **Mirarlo en pantalla.** No se levantó la app (la nube no tiene la base): el chip de la tarjeta de Spy va arriba a la derecha y
  baja una fila si está «Analizando…» (`.spy-pcard__veces`, en el CSS de SpyApp.tsx). Se ve en `/competitor-spy` y en
  `/image-editor?ver=carruseles`.
- **Cuántas piezas reales quedan sin número.** Con 13 publicaciones por cuenta (la biblioteca, 5/11) alcanza para 7 y no para 20;
  en Spy, una cuenta con pocas publicaciones de un formato dice «Sin datos suficientes». Se mide en producción contando los chips.
- **El tsc entero** lo corre GitHub en la punta. En esta nube el acotado no termina (`código undefined`); corrido a mano sobre los
  21 archivos tocados da 0 errores propios (los que salen son del editor de video y de `Compartir.tsx`, por dependencias que no
  se generan sin los `postinstall`).

## Cómo se sube

`punta/multiplo-rendimiento`. GitHub corre las guardas, los tests afectados y el tsc entero, y la lleva a main con verde.
