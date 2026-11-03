# El movimiento de las plantillas de Code and Chill — medido, 31/10/2026

## ⚠️ LA PRIMERA MEDICIÓN DE ESTE DOCUMENTO ESTUVO MAL, Y CÓMO SE EQUIVOCÓ VALE MÁS QUE EL RESULTADO

La primera vuelta de este archivo concluyó que «estas plantillas casi no animan», con el CSS contado
y los números a la vista. **Era falso**, y Martín lo desmintió de memoria: *«tiene animaciones al
abrirse la página o cambiar de tab, al cambiar de dark mode, y otras»*. Tenía razón.

Los dos errores, porque los dos se repiten:

1. **Se buscó `transition`, `@keyframes` y `animation-timeline` — y NO `view-transition`.** Las
   animaciones de abrir una página, cambiar de pestaña y cambiar de tema NO se hacen con ninguna de
   esas tres: se hacen con la **View Transitions API**, que es invisible para ese grep. Una cuenta
   exhaustiva sobre el vocabulario equivocado da cero con total confianza.
2. **Se grabó `Element.prototype.animate` y sólo se SCROLLEÓ.** Nunca se cambió de pestaña ni se tocó
   el interruptor de tema, que son justo los dos gestos que disparan todo esto. El grabador no mintió:
   nadie hizo lo que había que hacer para que grabara algo.

**La regla que queda: una medición que da CERO es sospechosa, no concluyente.** Antes de reportar que
algo no existe, hay que preguntarse qué nombre tendría si existiera y buscar ESE, y hacer el gesto que
lo dispararía.

Lo que sí se sostiene de la primera vuelta: el movimiento **de adorno** no existe. Nada aparece, se
desliza ni escalona al entrar. El movimiento está reservado para los CAMBIOS DE ESTADO (de tema, de
pantalla) y para decir algo (esto cambió, esto está vivo, esto trabaja).

## Las animaciones de verdad

### El cambio de TEMA: un círculo que se abre desde el botón que tocaste

Es la pieza más lograda y es toda copiable. Medida en `fitlo` (y la misma en las demás):

```js
const r = boton.getBoundingClientRect();
const x = r ? r.left + r.width / 2 : innerWidth - 40;
const y = r ? r.top + r.height / 2 : 40;
// el radio llega hasta la esquina MÁS LEJANA, por eso nunca queda un borde sin pintar
const radio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

if (!document.startViewTransition || reducirMovimiento()) { aplicarTema(); return; }

document.startViewTransition(aplicarTema).ready.then(() => {
  document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
    { duration: 450, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' },
  );
});
```

**Y el detalle sin el cual no funciona**, en el CSS:

```css
::view-transition-old(root) { mix-blend-mode: normal; animation: none; }
::view-transition-new(root) { mix-blend-mode: normal; animation: none; }
```

Apagan el **cruzado por defecto** del navegador. Sin esto, el barrido circular queda tapado por un
fundido de las dos capas y se ve sucio. Es el error clásico de quien copia sólo el `clipPath`.

Tres cosas más del mismo bloque, que son producto y no adorno:
- el tema se guarda en `localStorage` (`fitlo:theme`);
- se actualiza `<meta name="theme-color">` — `#111514` en oscuro, `#f7f6f2` en claro — que es lo que
  pinta la barra del navegador en el teléfono;
- **hay una guarda de `prefers-reduced-motion` ANTES de animar**: quien pide menos movimiento recibe
  el cambio de tema instantáneo, no una versión degradada.

### El cambio de PANTALLA

También `startViewTransition`, pero el que trae **React** (su soporte nativo de view transitions), no
código de la plantilla. Lo que la plantilla pone de su lado son las dos reglas de arriba.

### Lo demás: siete piezas de movimiento, con sus valores

Se bajó el CSS entero de dos plantillas muy distintas y se contó sobre el texto crudo, no sobre una
impresión:

| | Merrin (app de CRM) | Fitlo (tienda) |
|---|---|---|
| CSS total | 97.142 caracteres, 15 hojas | 108.932 caracteres |
| `transition` | **4 apariciones; el único valor real es `transition: none`** | 5 apariciones, **2 valores reales** |
| `@keyframes` | **3** | **4** |
| `:hover` | 34 reglas, **ninguna con transición** | — |
| Animación por scroll | **0** (ni `view-timeline`, ni `animation-timeline`, ni `@starting-style`) | **0** |
| Web Animations API (`element.animate`) | **0 llamadas**, grabado con un hook sobre `Element.prototype.animate` mientras se scrolleaba | — |

También se verificó que **no estaba activo `prefers-reduced-motion`** (sí tienen el interruptor, ver
abajo): la falta de movimiento es real, no un modo degradado.

## El vocabulario COMPLETO de movimiento, con sus valores

Son siete cosas. Esto es todo lo que hay para copiar:

```css
/* La curva única de toda la familia: sale rápido y frena largo. */
--ease: cubic-bezier(.22, 1, .36, 1);

/* 1. Un valor que acaba de cambiar DESTELLA en el color de acento y vuelve. */
@keyframes flash { 0% { color: var(--accent); } 100% { color: inherit; } }
animation: flash 1s var(--ease);

/* 2 y 3. Un indicador VIVO respira en opacidad. Dos variantes: el punto y su anillo. */
@keyframes breathe      { 0%, 100% { opacity: .1;  } 50% { opacity: .45; } }
@keyframes breathe-ring { 0%, 100% { opacity: .4;  } 50% { opacity: 1;   } }
animation: 2s   ease-in-out infinite breathe;
animation: 2.2s ease-in-out infinite breathe-ring;

/* 4. Los puntitos de «escribiendo» en el chat. */
animation: 1s linear infinite typing;

/* 5. El girador de carga. */
animation: .7s linear infinite spin;

/* 6. El hover: color lento, movimiento más rápido que el color. */
transition: color .2s, transform .18s ease-out;

/* 7. El «pop»: la ÚNICA curva con rebote de toda la familia (1.1 > 1 = se pasa y vuelve). */
transition: transform .34s cubic-bezier(.25, 1.1, .4, 1);
```

Y el interruptor, que también se copia:

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after { transition-duration: .001ms !important; animation-duration: .001ms !important; }
}
```

## Lo que esto implica para MaKo

1. **No hay animaciones de entrada que copiar.** Nada aparece, se desliza ni escalona al entrar a la
   pantalla. Si MaKo quiere entradas animadas, es una decisión NUESTRA, no una copia — y hay que
   decirlo así en vez de atribuírsela a la referencia.
2. **El movimiento está reservado para decir algo**: este número cambió (`flash`), esto está vivo
   (`breathe`), esto está trabajando (`spin`, `typing`). Nada se mueve de adorno.
3. **El hover mueve `transform` MÁS RÁPIDO que el color** (.18s contra .2s). Es al revés de lo que
   sale por defecto y es parte de por qué se siente preciso.
4. **Un solo rebote en toda la familia**, y es para el «pop» de una transformación. El resto frena sin
   pasarse.

## ⚠️ Y una corrección a lo que se había escrito antes

El primer documento del rediseño (`docs/diseno-dashboards-codeandchill.md`, 31/10) describe «el
movimiento en ms y curva» de cada patrón y afirma, entre otras cosas, que «el morfeo tiene DOS modos».
**Eso no está en el CSS de las plantillas.** Son inferencias del análisis presentadas junto a lo
medido, sin marcar la diferencia. Pueden ser buenas ideas de producto —la de los dos modos del morfeo
lo es— pero **no son una copia**, y el documento no deja distinguir una cosa de la otra. Cuando se
aplique, hay que saber cuál es cuál.
