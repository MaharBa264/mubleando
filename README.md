# Mubleando

Aplicación web y móvil para diseñar muebles de tablero (cocinas, armarios, estanterías) y sacar de cada diseño todo lo necesario para fabricarlo: la lista de corte para mandar a la maderera, el material y el coste, y los archivos STL para imprimir el mueble en 3D como maqueta.

Funciona en el navegador del ordenador y del móvil, y se puede instalar como aplicación (PWA). El nombre interno del código sigue siendo `mueblesweb` hasta que se elija la marca definitiva.

> **Estado:** en desarrollo, fase 1 terminada. Los datos se guardan en el navegador de cada dispositivo; la sincronización entre el PC y el móvil llega con el guardado en la nube.

## Qué hace hoy

| Función | Estado |
| --- | --- |
| Proyectos con varios muebles | Hecho |
| Mueble rectangular por medidas (ancho, alto, fondo) | Hecho |
| Visor 3D (perspectiva, ortogonal, alámbrico), con ratón y con el dedo | Hecho |
| Dividir el interior en estantes y divisores, con medidas fijas o repartidas | Hecho |
| Trasera en ranura o clavada por detrás | Hecho |
| Canto en el frente de las piezas, descontado de la medida de corte | Hecho |
| Deshacer y rehacer (Ctrl+Z / Ctrl+Y) | Hecho |
| Lista de corte agrupada o pieza a pieza, por mueble y por proyecto | Hecho |
| Exportar la lista de corte a CSV (para la maderera, Excel o un optimizador) | Hecho |
| Metros cuadrados de tablero, metros de canto y coste estimado | Hecho |
| Exportar a STL para impresión 3D: mueble completo o pieza a pieza, a escala | Hecho |
| Puertas, cajones y zócalo | Fase 2 |
| Editar materiales, cantos y métodos de fabricación | Fase 2 |
| Guardado en la nube y uso desde varios dispositivos | Fase 2-3 |

El detalle de todas las funciones, previstas y hechas, está en [`replica/features.csv`](replica/features.csv). El plan está en [`docs/hoja-de-ruta.md`](docs/hoja-de-ruta.md).

## Arrancar en tu ordenador

Necesitas [Node.js](https://nodejs.org/) 22 o superior (se ha probado con Node 24 y npm 11).

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:3100>. La primera vez aparece un proyecto de ejemplo, "Cocina de ejemplo", con dos muebles.

Otros comandos:

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

`npm test` pasa las pruebas automáticas del motor y de las exportaciones. `npm run typecheck` comprueba los tipos de TypeScript en todo el código. `npm run build` compila la versión de producción. La guía completa, con cómo abrirla en el móvil y qué hacer si algo falla, está en [`docs/instalacion-y-desarrollo.md`](docs/instalacion-y-desarrollo.md).

## Documentación

Toda la documentación está en español, en la carpeta [`docs/`](docs/README.md):

- [Instalación y desarrollo](docs/instalacion-y-desarrollo.md): requisitos, comandos, abrirla en el móvil, problemas frecuentes.
- [Guía de uso](docs/guia-de-uso.md): cómo diseñar un mueble paso a paso, de cero a la lista de corte.
- [El motor de cálculo](docs/motor.md): cómo se calculan las piezas, las convenciones de construcción y un ejemplo con todas las cifras.
- [Exportaciones](docs/exportaciones.md): CSV para la maderera y STL para impresión 3D (escalas, espesor mínimo, cajones).
- [La aplicación web](docs/app-web.md): pantallas, editor, guardado de datos, modo sin conexión.
- [Hoja de ruta](docs/hoja-de-ruta.md): qué viene después y en qué orden.
- [Cómo contribuir](docs/contribuir.md): ramas, commits, pruebas y estilo.

La planificación original (inventario de funciones, arquitectura, esquema de base de datos y registro de construcción) está en [`replica/`](replica/).

## Estructura del código

```
mueblesweb/
├─ packages/
│  ├─ engine/      motor de cálculo: diseño + método → piezas (TypeScript puro, sin interfaz)
│  └─ exporters/   exportaciones: CSV de lista de corte, STL, ZIP
├─ apps/
│  └─ web/         aplicación Next.js: proyectos, editor 3D, despiece, bibliotecas
├─ docs/           documentación
├─ replica/        planificación: funciones, arquitectura, esquema SQL, registro
└─ scripts/        utilidades (generar los iconos de la app)
```

Todas las longitudes del código son números enteros en **centésimas de milímetro** (1 mm = 100). Así no hay errores de redondeo al sumar y repartir medidas. Más detalle en [`docs/motor.md`](docs/motor.md).

## Origen

Es una aplicación propia, escrita desde cero. Se inspira en lo que hace un programa comercial de diseño de muebles por paneles, pero no contiene código, textos, imágenes, bibliotecas ni marcas de ese programa.

## Licencia

Todavía sin licencia definida. Mientras no se añada un archivo `LICENSE`, todos los derechos están reservados al autor.
