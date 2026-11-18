# Documentación

| Documento | Para quién | Qué cuenta |
| --- | --- | --- |
| [Instalación y desarrollo](instalacion-y-desarrollo.md) | quien vaya a arrancar o tocar el código | requisitos, comandos, abrirla en el móvil, compilar, problemas frecuentes |
| [Guía de uso](guia-de-uso.md) | quien vaya a diseñar muebles | de crear un proyecto a mandar la lista de corte a la maderera o imprimir el mueble en 3D |
| [El motor de cálculo](motor.md) | quien quiera entender o cambiar cómo salen las medidas | unidades, el documento del diseño, el método de fabricación, cada pieza y su fórmula, avisos, funciones de edición |
| [Ambientes](ambientes.md) | quien vaya a dibujar una cocina o una habitación | planta, medidas de obra fuera de escuadra, aberturas, colocar muebles, avisos y cómo funciona por dentro |
| [Herrajes](herrajes.md) | quien elija bisagras, correderas y corredizas | biblioteca, cómo cambia cada herraje las medidas, ejemplos y fuentes |
| [Exportaciones](exportaciones.md) | quien use los archivos que salen de la app | CSV (columnas, decimales, cómo pedir el corte a una maderera) y STL (modos, escalas, espesor mínimo, cajones, ejes) |
| [La aplicación web](app-web.md) | quien toque la interfaz | pantallas y rutas, editor, visor 3D, capa de datos, guardado y conflictos, PWA |
| [Guardado en la nube](nube.md) | quien vaya a activar las cuentas | crear el proyecto de Supabase, variables, tablas, reglas de acceso, pruebas y limitaciones |
| [Publicar](publicar.md) | quien vaya a ponerla en internet | Cloudflare Workers paso a paso, variables y secretos, dominio propio, problemas frecuentes |
| [Hoja de ruta](hoja-de-ruta.md) | todos | fases, qué está hecho y qué falta |
| [Cómo contribuir](contribuir.md) | quien vaya a cambiar código | ramas, mensajes de commit, pruebas, estilo, normas de origen |

## Glosario

- **Mueble** (o *cuerpo*): una caja de tablero con su interior. Un proyecto tiene varios.
- **Hueco** (o *zona*): un espacio del interior. El interior entero es el primer hueco; al dividirlo salen huecos hijos.
- **Estante**: pieza horizontal que divide un hueco en niveles.
- **Divisor** (o *montante*): pieza vertical que divide un hueco en columnas.
- **Costado**: cada pieza lateral de la caja.
- **Tapa** y **base**: pieza de arriba y de abajo de la caja.
- **Trasera**: el fondo del mueble, normalmente de tablero fino (DM, HDF).
- **Ranura**: canal fresado en costados, tapa y base donde entra la trasera.
- **Canto**: tira que se pega en el borde visible de una pieza (PVC, ABS, madera).
- **L1, L2, A1, A2**: los cuatro bordes de una pieza. L1 y L2 van a lo largo del largo (L1 es siempre el frente); A1 y A2 son los extremos, a lo largo del ancho.
- **Medida acabada**: la medida de la pieza ya con el canto pegado.
- **Medida de corte**: la medida a la que hay que cortar el tablero. Si el canto descuenta, es la acabada menos el espesor del canto.
- **Veta**: dirección de las fibras o del dibujo del tablero. Una pieza con veta no se puede girar al optimizar el corte.
- **Método de fabricación**: el conjunto de reglas de construcción (qué tablero lleva la caja, cómo va la trasera, cuánto se retranquean los estantes, qué canto lleva el frente).
- **Retranqueo**: cuánto queda una pieza por detrás del frente del mueble.
