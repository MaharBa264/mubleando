# Hoja de ruta

Actualizada el 27 de noviembre de 2026.

## Decisiones que marcan el plan

- **Sin CNC.** El taller no tiene máquina de control numérico: las piezas se encargan cortadas a una **maderera**. Por eso la salida de producción prioritaria es una lista de corte clara (CSV, impresa o PDF) y, más adelante, un optimizador que diga cuántos tableros pedir. Los posprocesadores para máquinas CNC pasan a "quizá algún día".
- **Impresión 3D.** Exportar a STL, el mueble completo o pieza a pieza, a escala, con opciones para los cajones (integrados, aparte montados o pieza a pieza).
- **Repositorio público** en GitHub: <https://github.com/MaharBa264/mubleando>.
- **Documentación** siempre detallada y en español.

## Fase 1: el núcleo (hecha)

- Motor de cálculo: caja, trasera en ranura o clavada, estantes y divisores anidados, medidas fijas o repartidas, canto frontal, medidas de corte.
- Proyectos y muebles, editor 3D con estructura y propiedades, deshacer y rehacer, guardado automático con detección de conflictos.
- Despiece agrupado o pieza a pieza, por mueble y por proyecto; CSV; totales de material y costo.
- PWA (instalable, sin conexión en producción).
- Exportación STL para impresión 3D (añadida tras la fase 1).

## Fase 2: muebles completos (hecha)

- **Puertas**: una o dos hojas, superpuestas o encastradas, con holgura y bisagras a un lado u otro.
- **Cajones**: por número, con alturas fijas o repartidas; caja completa (laterales, trasera, contrafrente, fondo en ranura o clavado), holguras para guías y fondo redondeado a largos de guía.
- **Zócalo** con altura y retranqueo.
- **Bibliotecas editables**: tableros, cantos y precios; métodos de fabricación propios, con frentes y cajones.
- **Material y cantos por pieza**.
- Visor con frentes cerrados, abiertos u ocultos. STL con los cajones integrados, aparte o por piezas.

Pendiente de la fase 2, para más adelante:

- Zonas exteriores aparte del zócalo (cornisa, remates laterales).
- Puertas correderas y abatibles.
- Cajones interiores (detrás de una puerta) y cajones con frente doble.
- Tolerancias de encaje propias para los cajones impresos en 3D.

## Herrajes, corredizas y juguete (18-11-2026)

- Biblioteca editable de herrajes: bisagras de cazoleta (codo 0, 9, 18), correderas (bolas, rodillo, oculta, cajón metálico) y sistemas corredizos (2 y 3 hojas), con sus medidas; se eligen por método o por mueble y corrigen las piezas; lista de herrajes con costo en el despiece.
- Puertas corredizas.
- STL de juguete con bisagras impresas en su lugar, cajones de una pieza y corredizas con rieles.
- En el 3D del ambiente, las paredes que tapan la vista se transparentan solas.

Pendiente: taladros de bisagras y correderas (para planos y CNC), reglas de posición de las bisagras, herrajes para estantes y uniones (soportes, excéntricas), y que la bisagra de codo 9 calcule el frente semisuperpuesto.

## Ambientes (primera versión, 18-11-2026)

- Planta con paredes medidas en obra (largos y ángulos, error de cierre), fuera de escuadra, L y ochavas; esquinas arrastrables.
- Puertas, ventanas y aberturas sin hoja.
- Colocar muebles del proyecto (varias veces el mismo), arrastrar con imán a la pared, girar, colgar a una altura.
- Avisos: fuera del ambiente, muebles que se pisan, puertas y ventanas tapadas, relleno cónico en esquinas fuera de escuadra.
- Vista 3D del ambiente.

Siguiente para ambientes:

- Que el mueble se adapte a la esquina fuera de escuadra: relleno o costado en cuña agregado al despiece.
- Despiece y presupuesto por ambiente.
- Paredes de distinto espesor y alto, columnas y vigas.
- Una casa: varios ambientes que comparten paredes.
- Arrastrar muebles también en el 3D.

## Constructor de muebles (en curso)

Hecho (17-11-2026):

- Plantillas: bajo con puertas, cajonera, bajo con cajón y puerta, bajo pileta, alacena, alacena abierta, columna, placard, estantería, caja vacía.
- Barra de herramientas sobre el 3D para el hueco elegido; cotas en 3D; dibujo del frente en la lista y en la galería; duplicar muebles.
- Materiales y métodos de partida argentinos (melamina 18, fibrofácil 3, tapacanto 0,45 y 2) y descuento de tapacanto solo desde un espesor.

También hecho: cambiar los paneles después de hecho el mueble (cómo se unen tapa, base y fondo; travesaños; quitar tapa o fondo; altura exacta y retranqueo propio de un estante; aplicar material y tapacanto a todas las piezas de un tipo).

Siguiente:

- **Formas irregulares**: que una pieza pueda tener cualquier contorno (no solo rectángulos), en el 3D, la lista de corte y el STL. En este orden:
  1. Recortes y calados: recorte rectangular en un costado (caño, zócalo), esquinas redondeadas, pasacables.
  2. Techo o costado inclinado: muebles bajo escalera o en altillos.
  3. Esquinero en ochava: frente o costado a 45°.
  4. Esquinero en L para cocinas en L, con puerta en ángulo.
- **Herrajes y tolerancias**: biblioteca de bisagras (cazoleta 35 mm, codos 0 / 9 / 18, con y sin cierre suave) y correderas (telescópicas de bolas, ocultas bajo el cajón, cajón metálico, de rodillo) con sus medidas reales, que el motor use para las holguras, los largos de guía y los descuentos de cada pieza. Cada herraje con sus avisos (por ejemplo, un cajón más corto que la corredera más corta).
- **Ambiente**: plano de la cocina o habitación con paredes, colocar y mover módulos en 2D, verlos juntos en 3D y despiece del ambiente.
- Divisiones libres y proporcionales, cajones interiores, puertas correderas, cornisa y remates.

## Guardado en la nube (hecho, falta conectar un proyecto real)

- Cuentas con correo y contraseña, confirmación por correo, recuperar contraseña, cerrar sesión en todos los dispositivos y borrar la cuenta.
- Proyectos, muebles y bibliotecas en Supabase, con reglas de acceso por fila probadas con dos usuarios.
- Subir a la cuenta los datos guardados en el navegador.
- Pendiente: crear el proyecto de Supabase y comprobarlo de verdad ([pasos](nube.md), [lista](../replica/backend.md)); correo propio (SMTP con tu dominio); copias de seguridad; trabajar sin conexión y sincronizar después; talleres con varios usuarios; entrar con Google.

## Comprobación contra listas reales

- Montar 2–3 muebles en el programa comercial que usa hoy el taller, exportar su lista de corte y dejarla en `replica/referencia/`.
- Se convierten en pruebas automáticas y se ajusta el motor hasta que las cifras coincidan.
- Puede hacerse en paralelo con cualquier fase.

## Fase 3: producción y presupuesto

- **Pedido a la maderera**: hoja de pedido lista para enviar (PDF), con piezas, cantos y observaciones; formato que pida tu maderera si tiene uno.
- **Optimizador de corte**: cuántos tableros hacen falta y cómo se colocan las piezas, respetando la veta.
- **Etiquetas** de piezas para identificarlas al montar.
- **Presupuesto en PDF** para el cliente.
- **Herrajes** (bisagras, correderas) con sus reglas de colocación y su lista de compra.
- **Planos** con cotas.
- DXF por pieza (útil si algún día se usa un servicio de corte por control numérico).


## Consolidación de marca, Obra 3D y Bajo escalera (26–27-11-2026)

- **Marca oficial**: unificación de la identidad de la app como **Mueblando** (con dirección visual *Estudio Nórdico*).
- **Obra 3D y Alzado por pared**: muretes, mesadas base y losas inclinadas en ambientes, vista lateral ortogonal por pared con bloqueo de eje (horizontal o vertical) y asistente **Generar módulos bajo escalera**.
- **Techo inclinado y corte diagonal real**: el motor calcula costados a medida, tapa por hipotenusa y `diagonalCut` en puertas y fondo; los visores 3D y las vistas vectoriales del PDF muestran el corte diagonal real, mientras que la maderera recibe el rectángulo completo y el PDF suma croquis acotados para cortar en taller.

## Próximos módulos de producto (en planificación)

Detalles técnicos y criterios de cierre en [Propuestas](propuestas.md):

- **Constructor de mesadas y bachas** ([propuesta #16](propuestas.md#16-constructor-de-mesadas-y-bachas)): formas (recta, L, U, isla), redondeo de bordes y perfiles, calados para bacha y anafe, bacha integrada o independiente (material único monolítico o materiales distintos), alzada/zócalo, faldón/regrueso, escurridor y perforaciones de grifería.
- **Constructor independiente de sillas y mesas** ([propuesta #17](propuestas.md#17-sillas-y-mesas-constructor-independiente)): diseño paramétrico de carpintería de bastidor y patas (tapas, patas rectas o inclinadas, travesaños, respaldos, ergonomía), despiece de listones/tableros e inserción en ambientes.
- **Exportación 3D para renderizado externo** ([propuesta #18](propuestas.md#18-exportación-3d-para-renderizado-externo-sketchup-y-formatos-estándar)): exportación con materiales, escala real en mm y jerarquía de piezas/grupos hacia **COLLADA (`.dae`)** (importación directa en SketchUp), **glTF/GLB** (estándar moderno para Blender, Twinmotion, Lumion y SketchUp 2024+) y **OBJ + MTL**.
- **Constructor de sillones** ([propuesta #19](propuestas.md#19-sillones-estructura-y-tapicería)): constructor especializado en estructura interna de madera + tapicería (módulos rectos, esquineros, *chaise longue*, apoyabrazos, almohadones, patas vistas/ocultas y cálculo de madera, espuma y metraje de tela).

## Al final

- Diseño visual y marca propios.
- Publicación en un dominio propio (HTTPS, instalación en el móvil).

## Quizá algún día

- Muebles en L y rinconeros, forma libre.
- Estancia con varios muebles colocados, y exportarla a STL.
- Posprocesadores para máquinas CNC concretas.
- Compartir un proyecto con el cliente por enlace.
