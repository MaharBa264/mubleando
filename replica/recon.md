# Mapa de reconocimiento: PolyBoard 6 (escritorio Windows) → app propia web + móvil

Alcance: el ciclo de diseño de muebles por paneles → lista de corte → exportación a taller/CNC. Primero el mueble rectangular; luego proyecto con varios muebles, herrajes por reglas y exportaciones CNC.
Para: el taller del usuario (dueño de licencia PolyBoard 6.4.10.1), con opción de venderlo después. **Supuesto, confirmar.**
Fecha: 2026-11-14

> Clean-room: aquí se describe *qué hace* PolyBoard y *cómo se mueve el usuario*, no cómo está programado. La nueva app se escribe desde cero, con nombre, iconos y textos propios.

## Fuentes

| # | fuente | URL / ubicación | notas |
| --- | --- | --- | --- |
| 1 | Textos de interfaz en español (paquete de idioma instalado) | `C:\Program Files (x86)\Boole & Partners\PolyBoard 6\Lang\PolyBoard.es.dll` | Menús, diálogos, propiedades y mensajes que ve el usuario. La fuente más completa del inventario de funciones. |
| 2 | Cabecera y librerías del ejecutable | `Polyboard.exe` | Solo tecnología (MFC, Direct3D 9) y nombres de formatos/exportadores. No se descompiló código. |
| 3 | Ayuda pública: diseño básico | https://wooddesigner.org/help-centre/polyboard-basic-design/ | Flujo de mueble nuevo, zonas, divisiones, puertas, cajones, métodos, materiales. |
| 4 | Ayuda pública: puesta en marcha | https://wooddesigner.org/help-centre/polyboard-set-up-and-overview/ | Visión general. |
| 5 | Ayuda pública: presupuestos | https://wooddesigner.org/help-centre/polyboard-quotes/ | Módulo de presupuesto (**PolyBoard 7**, no está en la v6 del usuario). |
| 6 | Página de producto / precio | https://wooddesigner.org/polyb | PolyBoard 7: 2.545–4.845 USD. Base del argumento "caro". |
| 7 | La instalación del propio usuario | en su PC, la maneja el usuario | Pendiente: capturas de cada pantalla en `screens/` y archivos de ejemplo `.pb-cab` / `.pb-proj`. |

## Ciclo principal

Defino un mueble con medidas exteriores, lo divido en zonas con estantes, montantes, puertas y cajones, y el programa calcula solo cada panel con su material, cantos, taladros y holguras. De ahí salen la lista de corte, la lista de herrajes, el precio y los archivos para la CNC.

## Pantallas

Las "pantallas" son ventanas, paneles acoplados y diálogos de una app de escritorio. En la versión web se convierten en rutas, paneles laterales y hojas modales.

| ID | pantalla | cómo se llega | propósito | componentes clave | estados vistos |
| --- | --- | --- | --- | --- | --- |
| S01 | Inicio / documentos recientes | arrancar la app | abrir o crear proyecto, mueble o catálogo | lista de recientes (Proyectos, Muebles, Catálogos), botones Nuevo | vacío, con recientes |
| S02 | Asistente "Nuevo Mueble" | Archivo › Nuevo Mueble (Ctrl+N) | elegir forma y método de fabricación | tarjetas de forma (Rectangular, en L, en Ángulo, Forma Libre, desde DXF), selector de método, medidas iniciales | por defecto, con método elegido |
| S03 | Editor de mueble (vista principal) | tras S02 o al abrir `.pb-cab` | diseñar el mueble en 3D | visor 3D, árbol/zonas, panel de Propiedades, cinta de herramientas, regla, dimensiones permanentes | zona seleccionada (azul), zona exterior (roja), puertas abiertas/cerradas, vista explosionada, alámbrico / caras ocultas / sólido / render, ortogonal / perspectiva |
| S04 | Panel de Propiedades | siempre visible en S03 | editar medidas, materiales, holguras y retrasos de lo seleccionado | rejilla de propiedades (texto, número, color, desplegable), unidades | mueble, zona, panel, puerta, cajón; valor inválido ("Dimensión incorrecta", "Dimensión demasiado grande") |
| S05 | Añadir divisiones | Modificar › Añadir estantes / montantes / dobles fondos / divisiones libres / paneles nulos | partir una zona interior | cantidad, distribución (equidistante, proporcional, distancia fija), alturas idénticas | vista previa, aplicar |
| S06 | Añadir puerta | Añadir una puerta… | puertas sobre una zona | tipo (única lado herraje / lado abierto, doble, corredera), encastrada / superpuesta / semi-encastrada, holgura, retraso, ángulo de apertura | abierta, cerrada |
| S07 | Añadir cajones | Añadir cajones… | cajones en una zona | número, tipo (encastrado, superpuesto, múltiple), estructura (laterales, fondo, trasera, frente, contra-frente), holgura entre cajones, "igualar tamaño de puertas y cajones" | — |
| S08 | Zonas exteriores | clic en zona roja | zócalo, tapetas, rellenos, encimera | lista de zócalos, lista de tapetas, distancias desde suelo/techo | — |
| S09 | Ranura y sobremedida | Métodos › Ranura y sobremedida… | cómo encajan las traseras y fondos | holgura en ranura, solape en ranuras completas, profundidad | — |
| S10 | Editor de métodos de fabricación | Herramientas › Métodos | reglas de construcción reutilizables | sub-métodos (cuerpo, puertas, cajones, ranuras, estilo de material, relaciones de herrajes), regla de canteado, reglas de retrasos y solapes, aplicar a mueble / método / nuevos componentes | modificado (pregunta guardar o aplicar) |
| S11 | Materiales de paneles | Materiales › Paneles… | biblioteca de tableros | nombre, espesor, fibra (con / sin), textura, precio, dimensiones de tablero | — |
| S12 | Materiales de cantos y perfiles | Materiales › Cantos / Perfiles… | cantos (cintas) y barras | material + espesor, precio, estilos de cantos | — |
| S13 | Estilos de material | Materiales › Estilos de material… | combinaciones nombradas (p. ej. "Cocina blanca") | asignación por tipo de panel | — |
| S14 | Biblioteca de herrajes | Herrajes… | bisagras, correderas, uniones (caja y espiga, excéntricas), patas | tipo, mecanizado (taladros ciegos / pasantes, verticales / horizontales, grupos), precio, código | — |
| S15 | Reglas de posicionado de herrajes | Lista de reglas de posicionado… | dónde y cuántos herrajes según la medida | regla de aplicación, distancias desde extremos, distancia entre taladros, nº por grupo, paralelo / perpendicular al panel | — |
| S16 | Relaciones de herrajes | Añadir relaciones de herrajes | qué herraje une cada par de paneles | panel prioritario / secundario, canto del panel, lado del herraje | — |
| S17 | Herrajes para un único panel | Herrajes para un único panel… | taladros y mecanizados sueltos en un panel | lista de herrajes mono-panel | — |
| S18 | Editor de panel simple / forma libre | Editar panel único…, Convertir en forma libre | contorno 2D de una pieza | editor de líneas (añadir / mover / borrar vértice, arcos de 11,25° a 180°, círculo, elipse, chaflán), cajeado interior, coordenadas relativas / absolutas | — |
| S19 | Estructuras de panel | Biblioteca de estructuras de panel | paneles compuestos (doble espesor, alma + chapas) | dividir espesor, duplicar espesor, aplicar estructura | — |
| S20 | Mecanizados | Mecanizado de esquinas…, Mecanizado en 3D | chaflanes, redondeos, ranuras, cajeados | — | — |
| S21 | Editor de proyecto (estancia) | Archivo › Nuevo proyecto (`.pb-proj`) | colocar varios muebles en una habitación | muros (nuevo, importar), suelo rectangular o libre, techo, añadir mueble o modelo, mover / girar / agrupar muebles, posiciones de muebles, luces | vacío, con muebles, mueble asociado o "desasociado del modelo" |
| S22 | Catálogo de modelos | Archivo › Nuevo catálogo (`.pb-cat`) | biblioteca de muebles tipo para reutilizar | lista de modelos, familias, duplicar, importar varios modelos, parámetros y variables | — |
| S23 | Parámetros y variables | Añadir parámetro | medidas como variables (mueble paramétrico) | nombres de variables, "A los parámetros", "Definida por parámetros" | — |
| S24 | Lista de corte | Listas de corte… | piezas a cortar | individual / agrupada, ordenar por material, dimensiones netas / totales / de referencia, cantos por lado, fibra | — |
| S25 | Opciones de lista de corte | Opciones de la lista de corte… | qué columnas y cómo redondear | holgura de cantos compartidos, unidades | — |
| S26 | Lista de materiales y de herrajes | Lista de materiales… / Lista de herrajes… | compras y costes | cantidades, m², m³, precio unitario, precio con mecanizado, ocultar precio | — |
| S27 | Etiquetas | Imprimir etiquetas… | etiquetas para las piezas | formato de hoja, nº ya usadas en la primera hoja, código de barras, situación de cantos | vista previa |
| S28 | Exportar a post-procesador CNC | Exportar post-procesador | archivos para la máquina | lista de post-procesadores, carpeta destino (una por material o por mueble), cara 1 / cara 2, códigos de herramienta, informe PP | error "panel no exportado: %1" |
| S29 | Opciones de post-procesador | Opciones del post-procesador… | configurar la máquina | herramientas (hasta N), diámetro de fresa, entrada / salida de herramienta, códigos de taladro, capas DXF por cara / profundidad / material | — |
| S30 | Exportar a OptiCut / ASCII / DXF 3D / 3DS | Archivo › Exportar | optimizador, CSV, CAD, render | — | — |
| S31 | Importar DXF | Importar DXF… | curvas para formas libres o suelos / muros | elegir entidad, curvas abiertas / cerradas | — |
| S32 | Imprimir planos y vistas | Imprimir…, Configurar impresión de vistas | planos de taller | vista 3D activa, una o dos páginas, acotación | vista previa |
| S33 | Opciones generales | Herramientas › Opciones | unidades, carpetas, rejilla, idioma | unidades (mm, 1/10 mm, cm, pulgadas), carpeta de bibliotecas y materiales, espaciado de rejilla, antialiasing, idioma | — |
| S34 | Activación de licencia | Ayuda › Activación | — | **skip**: no se replica | — |

## Flujos

```
F01 Diseñar un mueble bajo de cocina y sacar la lista de corte   (el ciclo principal)
    S01 -> S02 (Rectangular, método "Cocina") -> S03 + S04 (an 600, al 720, prof 560)
        -> S08 (zócalo 100) -> S05 (1 estante) -> S06 (puerta única, lado bisagra izq.)
        -> S24 lista de corte
    clics en el camino feliz: ~14 (medido con ayuda + menús; contar en la app real)
    borde: medida fuera de rango, zona demasiado pequeña para el cajón, material sin espesor,
           cambiar el ancho después de poner cajones (todo debe recalcularse)

F02 Cajonera de 4 cajones con frentes iguales
    S02 -> S03 -> S07 (4, superpuesto, igualar tamaño) -> S04 (holguras) -> S24
    borde: altura no divisible exactamente, frente mínimo, corredera que no cabe en la profundidad

F03 Crear y reutilizar un método de fabricación
    S10 (canteado, retrasos, ranuras, herrajes de unión) -> guardar -> S02 (elegir método) -> S03
    borde: aplicar el método a un mueble existente ("aplicar a mueble / solo nuevos componentes")

F04 Configurar herrajes automáticos
    S14 (bisagra, excéntrica, espiga) -> S15 (reglas por longitud) -> S16 (relaciones entre paneles) -> S03 (taladros visibles)
    borde: dos taladros coinciden ("mantener ambos / combinar en pasante"), panel más corto que la regla

F05 Cocina completa en una estancia
    S01 -> S21 (muros + suelo) -> añadir muebles desde S22 -> mover / girar / agrupar -> S24 agrupada + S26
    borde: mueble en esquina (en ángulo / en L), mueble modificado ("desasociar del modelo")

F06 Mandar a producción
    S24 -> S27 etiquetas -> S28 post-procesador (MPR / CIX / PGMX / HOP / TCN / DXF) o S30 OptiCut
    borde: panel de forma libre no exportable, cara 2 con mecanizados, carpeta destino con archivos (borrar existentes)

F07 Presupuesto rápido para el cliente
    S03 / S21 -> S26 (precios de material + herrajes + mecanizado) -> imprimir
    nota: en v6 solo hay "Precio" por pieza / herraje; el módulo de presupuesto con plantilla es de v7 (fuente 5)

F08 Pieza a medida (encimera curva, balda redondeada)
    S03 -> S18 (convertir en forma libre, arcos, cajeado) o S31 importar DXF -> S24
```

## Componentes

| componente | variantes | estados | usado en |
| --- | --- | --- | --- |
| Visor 3D | perspectiva / ortogonal; alámbrico, caras ocultas, sólido, render; explosionado | selección, hover de zona, puertas abiertas | S03, S21, S18 |
| Rejilla de propiedades | número con unidad, texto, desplegable, color, casilla, grupo plegable | por defecto, modificado, inválido, solo lectura | S04 y casi todos los diálogos |
| Árbol de estructura | mueble › zonas › paneles / puertas / cajones | seleccionado, oculto, nulo / virtual | S03 |
| Barra de herramientas / cinta | acciones de modificar, vistas 3D, zoom | activo, desactivado | S03, S21 |
| Lista editable de biblioteca | materiales, cantos, herrajes, reglas, modelos | vacía, filtrada, editando fila | S11–S16, S22 |
| Editor de contorno 2D | línea, arco, círculo, elipse, chaflán, vértice | dibujando, punto seleccionado, cerrado / abierto | S18, S21, S31 |
| Asistente de inserción | divisiones, puertas, cajones | vista previa, aplicar | S05–S07 |
| Tabla de resultados | lista de corte, materiales, herrajes | individual / agrupada, ordenable | S24, S26 |
| Diálogo de exportación | selector de formato, carpeta, opciones | error por panel | S28–S30 |
| Vista previa de impresión | una / dos páginas, etiquetas | — | S27, S32 |
| Selector de unidades | mm, 1/10 mm, cm, pulgadas | — | S33, S04 |
| Toast / panel de salida | mensajes, diagnosis | aviso, error | global |

## Modelo de datos inferido

```
Proyecto     id, nombre, cliente?, muros[], suelo, techo, muebles[] (posición, rotación), luces[]
             evidencia: S21, extensión .pb-proj, "Asociar el mueble a un proyecto"
             confianza: alta

Mueble       id, nombre, forma (rectangular | L | ángulo | libre), ancho, alto, profundidad,
             origen, metodo_id, estilo_material_id, modelo_id? (asociado o desasociado),
             zona_raiz, parámetros{}
             evidencia: S02–S04, .pb-cab, "Desasociar del modelo", "Independizar del modelo"
             confianza: alta

Zona         id, mueble_id, padre_id, tipo (interior | exterior), caja (x, y, z, an, al, prof),
             contenido: division | puerta | cajón | vacía
             evidencia: ayuda "inner volumes / external zones", "Editar tamaño de la zona"
             confianza: alta (es un árbol de particiones del volumen)

División     zona_id, orientación (horizontal = estante | vertical = montante | fondo),
             reparto (equidistante | proporcional | fijo), panel? (puede ser nulo / virtual)
             evidencia: S05, "Panel nulo", "Convertir una división en libre"
             confianza: alta

Panel        id, mueble_id, tipo (lateral izq/der, techo, suelo, trasera, estante, montante,
             puerta, frente, lateral cajón, fondo cajón, zócalo, tapeta...),
             material_id, espesor, fibra (dirección), cantos{sup, inf, izq, der}, prioritario?,
             contorno (rectángulo o curva libre), mecanizados[], estructura_id?
             evidencia: S04, S18, S24, "Personalizar tipo de panel", "Panel prioritario"
             confianza: alta. La geometría se *deriva* de Zona + Método; no se guarda a mano.

Puerta       zona_id, tipo (única bisagra | única abierta | doble | corredera),
             montaje (encastrada | superpuesta | semi), holgura, retraso, ángulo_apertura
             evidencia: S06; confianza: alta
Cajón        zona_id, número, tipo, estructura, holguras, retraso
             evidencia: S07; confianza: alta

Método       id, nombre, sub-métodos {cuerpo, puertas, cajones, ranuras, estilo_material,
             relaciones_herrajes}, reglas (canteado, retrasos, solapes)
             evidencia: S10; confianza: media (no se ve la lista completa de campos)

Material     id, tipo (panel | canto | perfil/barra), nombre, espesor, fibra, textura,
             precio (m², ml o unidad), tamaño de tablero
             evidencia: S11–S12; confianza: alta
EstiloMaterial  id, nombre, asignación {tipo_panel -> material}
             evidencia: S13; confianza: media

Herraje      id, nombre, marca?, código, precio, mecanizados[] (taladros: diámetro,
             profundidad, ciego / pasante, cara, posición), 3D?
             evidencia: S14, biblioteca XML de herrajes; confianza: alta
ReglaPosicionado  herraje_id, condiciones (longitud mín / máx), nº, distancias desde extremos,
             distancia entre taladros
             evidencia: S15; confianza: media
RelaciónHerraje  método_id, panel_A (tipo), panel_B (tipo), herraje_id / regla_id, lado
             evidencia: S16; confianza: media

Mecanizado   panel_id, tipo (taladro | ranura | cajeado | contorno | chaflán), cara (1 | 2 | canto),
             geometría, herramienta
             evidencia: S20, S28 (CONTORNO, RANURA, CHAFLAN...); confianza: alta

Modelo/Catálogo  catálogo_id, familia, mueble plantilla, parámetros
             evidencia: S22, .pb-cat; confianza: alta
PostProcesador  id, formato (MPR | CIX | PGMX | HOP | TCN | DXF | XXL), herramientas[], códigos, carpeta
             evidencia: S28–S29; confianza: alta (el formato de *salida* es público para varias máquinas)
```

Relaciones: Proyecto 1-n Mueble; Mueble 1-1 Zona raíz; Zona 1-n Zona (árbol); Zona 0-1 División / Puerta / Cajón; Mueble 1-n Panel (derivados); Panel n-1 Material; Panel 4 Cantos n-1 Material; Mueble n-1 Método; Método 1-n RelaciónHerraje n-1 Herraje; Herraje 1-n ReglaPosicionado; Panel 1-n Mecanizado; Catálogo 1-n Modelo.

**La pieza clave:** el modelo guarda la *intención* (zonas, divisiones, reglas) y los paneles se **calculan**. Ese motor de cálculo (holguras, retrasos, solapes, quién pisa a quién, cantos que descuentan medida) es el corazón del producto. Habrá que reconstruirlo con pruebas: mueble en PolyBoard → lista de corte → mismo mueble en la app nueva → comparar cifras.

## Matriz de funciones

Ver `features.csv`. Must: 24, should: 20, could: 14, skip: 4.

## Fuera de alcance (no se puede o no se debe clonar)

- Código, iconos, texturas, bibliotecas de herrajes y catálogos que vienen con PolyBoard: son de Boole & Partners. Las bibliotecas de herrajes se rehacen con los datos públicos de Blum, Hettich, Häfele…
- La activación y la protección de licencia.
- El formato binario `.pb-*`: no está documentado. Importar los proyectos viejos es un extra, no la base. Si hace falta, se estudia con archivos de ejemplo del usuario.
- OptiCut / OptiNest (otro producto de Boole): se sustituye por un optimizador de corte propio o por exportar CSV.
- El nombre "PolyBoard" y su marca.

## Tamaño

Pantallas 34 (≈ 12 de verdad en web; el resto son paneles y modales), flujos 8, entidades 16.

Partes difíciles:
1. **El motor paramétrico:** árbol de zonas → paneles con holguras, retrasos, solapes, cantos y prioridades, que se recalcula al cambiar una medida.
2. **Visor y editor 3D en el navegador y en el móvil:** selección táctil de zonas, vistas, explosionado (Three.js / WebGL).
3. **Herrajes por reglas + post-procesadores CNC:** cada máquina tiene su formato (MPR, CIX, PGMX…) y hay que validar cada uno en una máquina real.

Otros: editor 2D de formas libres, importar DXF, optimizador de corte, trabajo sin conexión en el móvil.

Tamaño: **L** (un trimestre) para F01–F04 + F06 con un post-procesador y DXF. El conjunto completo (proyectos de estancia, catálogos, todos los post-procesadores) es **XL** y conviene repartirlo en fases.
