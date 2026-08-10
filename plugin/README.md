# MaKo para Claude

Conecta tu negocio a Claude: tu oferta, tu cliente ideal, tus avatares, tus razones de
compra, tu catálogo con precios, cómo suena tu marca y tu plan de trabajo. Dejás de
contarle tu negocio en cada chat.

## Instalar

```
/plugin marketplace add mbustos-digital/mako-plugin
/plugin install mako@mako
```

## Tu token

La primera vez que Claude necesite tus datos te va a pedir tu token. Lo sacás de
**https://hola-mako.com/integraciones → Claude**, con un click. Se guarda en `~/.mako-token` y no te
lo vuelve a pedir.

El token identifica tu espacio y **no viaja en este repo**: por eso podés instalar esto
sin que nadie vea tus datos.

## Qué puede hacer

- **Leer tu negocio** — oferta, cliente ideal, fase, gancho, catálogo y voz de marca.
- **Leer secciones grandes bajo demanda** — la matriz de avatares × razones de compra,
  lo que MaKo entendió de tus documentos, o el catálogo completo.
- **Leer tu plan abierto** para no proponerte algo que ya está anotado.
- **Proponerte tareas**, cierres de lo que ya hiciste y detalle sobre lo que ya está.
  Nunca las crea solas: deja un borrador que revisás vos.

---

_Generado desde el repo de MaKo con `scripts/generar-plugin.mjs`. No se edita a mano:
la skill vive en `lib/agente-skill.ts` y esta copia se regenera desde ahí._
