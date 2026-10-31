# La estrategia de lanzamiento: low ticket → high ticket

**Decidida por Martín en la llamada del 30/10/2026.** Esta es la fuente de verdad del funnel con el que
se lanza. Reemplaza cualquier supuesto anterior sobre vender MaKo como SaaS suelto.

> Esto sale de una conversación grabada. Acá está **sólo lo que decide el producto**: el avatar, el funnel, la
> oferta y el orden de ejecución. Lo que se dijo sobre personas concretas no es una decisión de producto y no
> se registra.

## 1. El avatar: NO agencias

**Se va a coaches, infoproductores y prestadores de servicio que venden high ticket** — gente que está
**recién empezando** a vender sus servicios. No agencias.

Las agencias eran el camino cómodo y por eso hay que decir por qué se descartan:

| | Agencias | Coaches / servicios (ELEGIDO) |
|---|---|---|
| Pagan los 97 de entrada | Sí, tienen capital | Cuesta más |
| Entienden la herramienta | Sí, ya usan otras | Hay que hacer más marketing para que la entiendan |
| Bajas | Más bajas: le traen sus propios clientes | Más altas: puede comprar una vez y no seguir |
| Plata | Estable pero lenta | **Rápida**, que es lo que hace falta ahora |
| Soporte | Toleran esperar un arreglo | Piden todo y lo piden ya |
| **Lo que falta** | **No hay high ticket para ellas** | **Permite llamadas grupales y el upsell** |

**El motivo de fondo:** con agencias el ingreso es chico y sostenido; el objetivo ahora es juntar caja para
reinvertir en anuncios, y eso son **10 clientes de high ticket**, no una suscripción que crece de a poco.
Las agencias quedan para después, cuando haga falta estabilidad.

**Y las mentorías grupales no son un puente:** «van a ser parte eterna de la aplicación, nunca voy a dejar de
vender las mentorías grupales».

## 2. El funnel: uno solo, low to high

```
anuncios → landing → COMPRA MaKo (47 o 97, con 50% off el primer mes)
                            ↓
              Martín lo contacta por WhatsApp
                            ↓
                 agenda una llamada (15 min)
                            ↓
                 vende el high ticket: US$ 1.500
```

- **No existe una landing que venda el high ticket.** Todo el funnel vende MaKo. El high ticket se vende en
  la llamada, y ahí se construye el valor.
- **MaKo es la entrada, no el producto final de este funnel.** Cuanta más gente entre, más llamadas, más
  cierres de high ticket.
- **Quien pagó está cualificado.** Ese es el filtro, y es el único que importa para agendar.

## 3. La oferta de entrada: 50% el primer mes, con reloj

En la landing aparece un cartel: **«te ganaste un 50% de descuento»**, con un **reloj de 5 a 10 minutos**,
sobre cualquiera de los dos planes (47 y 97). **El descuento es del primer mes.**

## 4. Se apaga la prueba gratis de 7 días

**No se borra: se apaga.** Queda detrás de un interruptor para cuando se venda MaKo como SaaS suelto.

Los motivos, que son los que mandan si hay que decidir un borde:

1. **50% + prueba gratis es demasiado y se lee como sospechoso.**
2. **La prueba gratis es para vender un SaaS por escalabilidad**, y este funnel no vende un SaaS: vende un
   high ticket con MaKo como entrada.
3. **Con prueba hay que esperar siete días** para saber si compraron. No se agenda una llamada con alguien que
   no pagó un peso: entrarían leads descalificados.

⚠️ **A quien ya está en prueba no se le toca nada.** Se apaga para las altas nuevas, igual que el horario de
fábrica de las automatizaciones.

Vive en `PRUEBA_DIAS` (`lib/planes-mako.ts`), `lib/prueba-plan-reglas.ts` y `lib/plan-acceso-reglas.ts`.

## 5. Se paga ANTES de entrar a la app

Hoy el onboarding termina y **después** aparecen los planes. Con esta estrategia es al revés: **se compra y
recién ahí se entra a la aplicación**. Así que al terminar el onboarding ya no se muestran los planes de pago.

## 6. El orden de ejecución, como lo fijó Martín

1. **La calculadora de presupuesto de anuncios** (lo primero de todo). Dado lo que hay para invertir, por
   ingeniería inversa: cuántos avatares se pueden testear, cuántas razones de compra, **cuántos anuncios** y
   **cuántas landings**. El número que puso: **con US$1.000 son 2 landings** (tres a 333 cada una es muy poco);
   con 2.000 serían 4, a 500 cada una.
2. **Armar las landings con MaKo** — una por cada una de las **2 funcionalidades más fuertes**, eligiendo según
   el dolor del avatar.
3. **Sacar los ángulos de comunicación de esas landings** para los anuncios.
4. **Los guiones → video con Avatar de IA** (no se graba él).
5. **Publicar y dejar que MaKo maneje los anuncios**: que elija el ganador, lo pague, y avise cuál no funciona
   para darlo de baja. Eso ya está construido (el Media Buyer).

## 7. Lo que queda abierto

- **La oferta alternativa que no se descartó:** instalación de US$1.000 + 97/mes + 47 por cliente, como hacen
  otros que venden software. Martín: «tengo que ver el tema de la oferta».
- **Si el reloj del 50% se reinicia** al volver a entrar, y cómo.
- **Cuáles son las 2 funcionalidades más fuertes** para las dos landings: «ya voy a ir viendo con qué me quedo».
