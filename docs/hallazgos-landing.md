# Hallazgos de Landing / VSL

Lo que hay que saber antes de tocar `lib/landing-analyst.ts` y las lecturas de
`landing_visits` / `vsl_events`. **No es un changelog.**

Origen: corrida multi-agente de 08/2026. Regla de la cosecha en `AGENTS.md`.

---

## 1. El módulo tolera la falta de datos, así que traga cualquier error nuevo

**Síntoma:** el análisis de una landing con tráfico real decía **"sin datos de
comportamiento"**. No hay error en el log: es una respuesta válida del producto.

**Causa:** `getComportamiento` hace `catch { return vacio; }` **a propósito** —una landing
recién publicada no tiene historial y igual se puede analizar el copy—. Cuando el bucle
paginado privado de este módulo (que no tenía techo) se unificó en
`lib/supabase-paginado.ts`, heredó un tope que **sí** lanza. `landing_visits` es una fila
por visita: 100.000 es alcanzable en una landing viva. El `throw` cayó en ese `catch` y el
truncado silencioso que el paginado existe para matar reapareció **una capa más arriba**.

**El diagnóstico obvio era el equivocado:** no había nada roto en el analista ni en el
tracking. Lo que cambió fue el contrato de errores de una función tres niveles abajo.

**Dónde:** `lib/landing-analyst.ts:128` (`leerTabla`) y el `catch` de `getComportamiento`.
El tope vive en `lib/supabase-paginado.ts` — ver [hallazgos-infra.md](hallazgos-infra.md)
§1, "Un tope nuevo es un truncado nuevo".

**Regla:** antes de meter un `throw` nuevo en una lectura, mirá **qué `catch` lo está
esperando**. En un módulo que degrada por diseño, cada excepción nueva se convierte en un
"no hay nada" que nadie va a poder distinguir de la verdad.

## 2. Estas cuatro lecturas ya ordenaban bien, y por una razón

`landing_visits`, `vsl_events` y `landing_analyses` tienen `id` como PK, que es el orden
por defecto del helper y el único que garantiza páginas coherentes. Fueron las únicas del
barrido que no tenían el bug de `ORDER BY`. Si se agrega una tabla de tracking sin `id`
autoincremental, **hace falta elegirle un orden único explícito**.

---

## 3. Descartado a propósito (no volver a "arreglarlo")

- **Cambiar el `catch { return vacio; }` de `getComportamiento` por propagar el error.** La
  tolerancia es intencional y está escrita en el JSDoc: el analista tiene que poder correr
  sobre una landing sin historial. Con el tope del helper ya corregido, el falso vacío deja
  de ser alcanzable en la práctica. Cambiar la semántica de error de este módulo es otra
  pasada, con la decisión de producto de por medio ("¿qué ve el usuario si el tracking
  falla y el copy sí se puede analizar?").
