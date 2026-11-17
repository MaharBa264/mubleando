# Cómo contribuir

## Ramas

- `main`: la versión estable. Lo que hay aquí compila y pasa las pruebas.
- Una rama por fase o por función: `fase-2`, `stl-cajones`, `nube`… Se fusiona en `main` cuando está terminada y probada.

## Mensajes de commit

En español, con un prefijo que diga de qué tipo es el cambio:

| Prefijo | Para |
| --- | --- |
| `build:` | Funciones o pantallas nuevas. |
| `fix:` | Arreglos. |
| `docs:` | Solo documentación. |
| `test:` | Solo pruebas. |
| `refactor:` | Cambios internos sin cambiar lo que hace. |

Ejemplo: `build: exportación STL del mueble completo y pieza a pieza`.

Los commits se firman con la dirección privada de GitHub (`…@users.noreply.github.com`), para que ningún correo personal quede publicado en el historial del repositorio público.

## Antes de subir un cambio

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

Y abre la app (`npm run dev`) para probar a mano lo que hayas tocado, también con el navegador a ancho de móvil (unos 390 px).

## Normas del código

- **TypeScript estricto.** Nada de `any` salvo que no haya otra forma, y entonces con un comentario.
- **Medidas en centésimas de mm** (enteros) en todo el motor y las exportaciones. Se convierten a mm solo para mostrarlas o escribirlas en un archivo.
- **Precios en centavos** (enteros).
- **El motor es puro**: sin React, sin navegador, sin red, sin fechas ni números aleatorios. Si una función del motor necesita un identificador nuevo, lo recibe por parámetro (`IdGen`).
- **Toda función del motor o de las exportaciones lleva pruebas.** Para las medidas, la prueba debe dar cifras concretas comprobadas a mano, no solo "que no falle".
- **Colores y medidas de la interfaz** como variables CSS (`globals.css`), nunca sueltos en los componentes.
- **Todo en español**: textos de la interfaz, comentarios, mensajes de error, documentación y nombres de archivo generados.
- **Documentación al día**: cada función nueva actualiza su página en `docs/` (qué hace, cómo se usa, ejemplos y limitaciones) y su fila en `replica/features.csv`.

## Origen del código

Esta aplicación se escribe desde cero. Puede inspirarse en lo que hacen otros programas de diseño de muebles, pero **no** se copia su código, sus textos, sus imágenes, sus iconos, sus bibliotecas de materiales o herrajes ni su marca. Los datos de herrajes se tomarán de los catálogos públicos de los fabricantes.
