# Taller Constructivo — dirección visual y plan de implementación

Fecha de decisión: 27 de noviembre de 2026.
Estado: dirección creativa aprobada por el propietario; valores y soluciones concretas sujetos a prototipo y validación. No equivale a una identidad desplegada.
Relacionado: [Sistema de diseño](diseno.md), [issue de Inicio #16](https://github.com/MaharBa264/mubleando/issues/16).

## 1. Origen y decisiones
Mubleando es una herramienta de diseño y fabricación de muebles, no una landing comercial. La navegación y distribución actuales gustan al propietario y deben preservarse. Se quiere una portada auténtica, con accesos directos y ayuda, animación 3D discreta controlada por scroll y una identidad reconocible.
La exploración comparó Arcilla, Bosque, Oliva y nogal, Grafito y latón, Borgoña y el naranja actual. Se eligió Grafito y latón. El azul se descartó por resultar genérico; el naranja actual es preferible al azul pero tampoco convence como identidad final.
En tipografía se exploraron Monumental, Escala irregular, Editorial de autor y Constructivista. Se eligió combinar Escala irregular y Constructivista. Gustaron especialmente la retícula tenue, la referencia AURUM y el póster de espíritu Bauhaus. El nombre interno elegido es **Taller Constructivo**; no es un cambio de nombre del producto.
El propietario aprobó explorar que tipografía e isotipo participen de la animación y autorizó reconsiderar el logo, sin obligación de conservar su dibujo exacto. No se ha aprobado aún un nuevo logo definitivo.

## 2. Punto de partida y coherencia documental
Al revisar main, globals.css declara «Estudio Nórdico», con fondo técnico gris, acento cobre/terracota #C25E1A (oscuro #E88442), superficies claras y selección naranja. La captura facilitada confirma visualmente esta línea. docs/diseno.md todavía describe «taller luminoso» y cobalto, por lo que su tabla histórica no coincide con el código. layout.tsx conserva themeColor #F3F0EB / #131312 de la dirección anterior. No atribuir a producción valores exactos solo por una captura: los valores citados corresponden al código inspeccionado.
La nueva dirección reemplaza conceptualmente las anteriores, pero el CSS vigente sigue siendo fuente de verdad del estado implementado hasta aprobar y aplicar los tokens nuevos. No presentar colores candidatos como ya desplegados. Registrar el historial, no borrarlo.
La aplicación usa Next.js, React, Three.js, React Three Fiber y Drei; las fuentes Onest, Bricolage Grotesque y JetBrains Mono ya están disponibles. La ruta raíz aloja Proyectos; AppShell enlaza a ella mediante marca y pestaña Proyectos. Ayuda existe en /ayuda y sus textos se centralizan en lib/help.ts.

## 3. Principios no negociables
- El mueble es protagonista; la interfaz no compite con materiales, cotas ni geometría.
- Expresividad en identidad y claridad en el trabajo. No convertir el editor CAD en un afiche.
- Mantener navegación, acciones, datos, cálculo, despiece, exportaciones, cuentas y PWA.
- Una sola acción primaria por contexto, jerarquía estable y selección inequívoca.
- Reutilizar componentes y tokens existentes; no introducir colores dispersos ni un segundo sistema de diseño.
- Identidad propia: inspiración conceptual en arquitectura, diseño industrial, Bauhaus y composición editorial; claridad de Shapr3D sin copia.
- No añadir brillo metálico literal, dorados de lujo, texturas de taller, ruido visual, sombras excesivas ni animación ornamental repetitiva.

## 4. Color y materiales
La dirección Grafito y latón usa grafito como estructura, piedra/papel/marfil como superficies y latón mate como acento cálido. No se pretende que todo parezca metal. Los colores de materiales de muebles son independientes de los colores de interfaz.
Paleta candidata (no definitiva; validar contraste y estados antes de integrarla):

| Rol | Claro | Oscuro |
|---|---|---|
| Fondo | #EFEEEB | #242422 |
| Superficie | #FAF9F6 | #2D2C29 |
| Superficie secundaria | #E7E3DC | #383631 |
| Texto | #262624 | #F3F0E9 |
| Texto secundario | #6D6962 | #B9B2A6 |
| Acento | #87612D | #CBA66C |
| Acento hover | #704D20 | #DEC08B |
| Acento suave | #EAE0CD | #443727 |
| Texto sobre acento | #FFFFFF | #262624 |
| Borde | #DAD7D1 | #4C4942 |
| Borde fuerte | #B0AAA0 | #777166 |
| Fondo visor | #E9E5DE | #242422 |
| Línea visor | #6D6962 | #A49D90 |

Los valores que no aparecieron en las maquetas originales son candidatos técnicos complementarios, no decisiones explícitas del propietario. Mantener verde/rojo/advertencia semánticos y validar cada par texto/fondo, foco y control. Para selección 3D estudiar latón de alto contraste, contorno y/o patrón; no confundir con madera, herrajes ni avisos. Separar tokens de marca y acción únicamente si hay necesidad comprobada. No usar color como único indicador.
Validar WCAG AA (4,5:1 para texto normal, 3:1 para texto grande y límites/estados de controles donde corresponda). Examinar selección sobre blanco, nogal, grafito y materiales cálidos. Revisar también themeColor, manifest, iconos, SVG y generación de PWA; sincronizarlos al aprobar la paleta.

## 5. Tipografía y composición
Mantener inicialmente Onest (texto, formularios, navegación), Bricolage Grotesque (marca y títulos), JetBrains Mono (cotas, índices técnicos y números tabulares). No añadir fuentes por anticipado. Si las pruebas no consiguen la expresividad buscada, comparar Syne, Space Grotesk y Unbounded en muestras equivalentes, con licencia, carga local y cobertura de español.
Crear dos niveles de expresión: títulos editoriales de portada y cabeceras especiales, frente a títulos funcionales de editor, diálogos, tablas y formularios. En los primeros se permiten mayúsculas monumentales, iniciales exageradas, alturas contrastantes, cambios de peso/ancho, alineación asimétrica y bloques tipográficos. En los segundos mantener escala estable y legibilidad.
La irregularidad debe ser diseñada y determinista, no aleatoria por render. Como punto de partida de prototipo usar letras destacadas de 1,2–1,55 veces la escala base (ajustar según óptica), baseline común o retícula deliberada, espaciado óptico y composición responsive con clamp. Probar acentos, Ñ, textos largos, zoom 200% y 375 px. No cortar palabras de forma que pierdan sentido. Mantener un único nombre accesible de cada título; spans decorativos aria-hidden si existe texto semántico equivalente. Evitar reflujo al animar; preferir transformaciones con espacio reservado. 
Textos candidatos, no eslogan aprobado: «De la idea al mueble», «Diseñá. Creá. Construí.», «Forma. Material. Precisión.», «Pensá en grande. Diseñá al milímetro.»

## 6. Retícula y lenguaje gráfico
Retícula fina, secundaria, inspirada en papel de dibujo y planos. Probar cuadrícula de 20–32 px en escritorio, adaptada a móvil; líneas de 1 px y opacidad aproximada 4–8% (verificar contraste perceptual y tema). Usar token dedicado y fondo CSS; no rasterizar una imagen pesada. No usar retícula detrás de texto denso, formularios o tablas; en editor preservar guías y cuadrículas funcionales existentes. Se permiten líneas de cota decorativas, marcas de registro, índices 01/02/03, divisores finos y contraste de masas grandes con detalles pequeños. La retícula no debe confundirse con escala real ni cotas de un proyecto.
Conservar radios, paneles flotantes, botones, iconos lineales y navegación segmentada existentes en la primera iteración. Solo ajustar cuando la comparación visual justifique el cambio. No aplanar ni endurecer todos los componentes por una asociación superficial con brutalismo.

## 7. Marca y logo
El logo aportado por el propietario es una M geométrica formada por módulos verticales tipo armario, trazos oscuros, pequeños tiradores, centro ensamblado y una pieza cálida naranja, sobre fondo claro redondeado. Es una referencia, no una obligación.
Explorar tres rutas: A) conservar estructura y recolorear/refinar; B) simplificar M modular con uniones de paneles y menos trazos; C) construir un símbolo nuevo mediante piezas de tablero, con lógica de ensamblaje y una M reconocible. Todas deben compartir el carácter de Taller Constructivo.
Entregables: comparativa con versiones monocromáticas, claro/oscuro, icono 16/32/64 px, avatar/PWA, logotipo horizontal, SVG accesible y versión animable por grupos. Verificar silueta y legibilidad a tamaño real. Diseñar la geometría para que las piezas puedan separarse, adquirir profundidad y volver a reunirse. No sustituir activos vigentes hasta aprobar una opción. Evitar confundir la M con una marca ajena. El logo no necesita degradado metálico.
La tipografía de marca puede tener escalas irregulares fijas; no alterar cada vez el nombre Mubleando.

## 8. Inicio: afiche interactivo, no barrera
Hero inmediatamente utilizable: navegación existente, título editorial, mueble/isotipo y CTA «Mis proyectos» visible sin hacer scroll ni esperar WebGL. Accesos a nuevo proyecto, recientes, bibliotecas, ayuda y ambientes según contexto real; no inventar rutas ni duplicar lógica de creación. Reutilizar ayuda y guías de novedades existentes. Sin onboarding obligatorio ni reproducción automática.
Storyboard:
- 0%: retícula tenue, composición tipográfica e isotipo modular, acceso inmediato.
- 0–25%: cambios suaves y limitados de escala/posición de letras; isotipo se separa en grupos.
- 25–55%: los grupos ganan profundidad y se transforman o encadenan visualmente a un mueble coherente; no exigir una transformación imposible pieza por pieza.
- 55–80%: vista explotada, giro leve, cotas y relación con despiece, usando un modelo de muestra determinista.
- 80–100%: cierre visual y accesos/ayuda; posibilidad de invertir toda la secuencia al subir.
El texto y las acciones no quedan atrapados en escena sticky. Preferir recorrido corto (probar 1–2 pantallas adicionales), scroll natural sin hijacking. No interceptar rueda o gestos. Probar también versión sin sticky en móvil.
Usar R3F/Three existente primero, progreso normalizado y transformaciones deterministas; CSS para letras y retícula. No incorporar GSAP u otra dependencia salvo necesidad demostrada. Modelo de muestra aislado de datos personales, geometría simplificada o reutilización segura del motor existente, sin modificarlo. Evaluar fallback SVG/imagen. Renderizar solo cuando visible, limitar DPR y sombras, liberar recursos. reduced-motion entrega composición estática completa y navegable; ante fallo de WebGL mantener todas las acciones. Evitar layout shift. No descargar el 3D para usuarios que entran directamente en Proyectos si puede evitarse.

## 9. Orden de implementación y puertas de aprobación
### 0 — Baseline (documentación y auditoría)
Registrar esta decisión, capturas de Proyectos, editor, ambientes, bibliotecas, ayuda, claro/oscuro y móvil. Inventariar tokens, colores hardcodeados, fuentes, iconos PWA, rutas y pruebas. Guardar commit base. No desplegar cambios.
### 1 — Laboratorio visual aislado
Crear rama de trabajo y prototipo estático, independiente de rutas existentes. Mostrar la pantalla Proyectos con su distribución actual, título expresivo, retícula opcional, paleta clara/oscura, botones, estados, campos, selección y una escena de mueble. Incluir comparación con cobre actual y muestra del editor. Probar tres composiciones tipográficas (moderada, expresiva y constructivista). Sin cambios en globals.css ni navegación de main. Aprobar paleta/jerarquía y legibilidad.
### 2 — Sistema visual global
Aplicar tokens aprobados en globals.css, actualizar docs/diseno.md y themeColor; componentes consumen tokens. Introducir componente de título expresivo opt-in y retícula decorativa, no reglas globales invasivas. Comprobar Proyectos, bibliotecas, editor, ambientes, administración, cuenta, ayuda, estados y PDF/print. No variar funciones. Aprobar visualmente antes de integrar.
### 3 — Identidad de marca
Explorar variantes de logo A/B/C, elegir una y generar activos SVG/PWA coherentes. Revisar cabecera, iconos, tamaños y modo oscuro. Puede trabajarse en paralelo con 1, pero el cambio final depende de aprobación. No mezclar rediseño completo con migración de rutas.
### 4 — Inicio estático
Crear portada funcional aislada; CTA, recientes, nuevo proyecto, ayuda. Extraer la página de Proyectos preservando comportamiento y datos; migrar a /proyectos solo tras auditar enlaces, redirects de auth, breadcrumbs, back, deep links, PWA start_url y cache. Logo → /; Proyectos → /proyectos. Mantener navegación actual, sin añadir pestaña por defecto (decisión técnica provisional). Probar rutas con y sin sesión y modo local. La portada debe ser útil aun sin animación.
### 5 — Animación
Prototipo de isotipo + tipografía + mueble controlado por scroll; primero trayectoria y continuidad, luego iluminación, cotas y pulido. Integrar bajo carga diferida con fallback. Verificar scroll inverso, cambio de tamaño, orientación, teclado, reduced-motion y WebGL ausente. No ligar la funcionalidad a la animación.
### 6 — QA, integración y despliegue
npm test, npm run typecheck, npm run build; pruebas manuales desktop/móvil 375 px, claro/oscuro, zoom, teclado, autenticación, local/nube y PWA. Revisar impresión/exportaciones y regresión 3D. Comparar rendimiento y estabilidad con baseline; comprobar ausencia de scroll bloqueado, errores de hidratación y pérdida de recursos. Revisar preview antes de merge/despliegue. Actualizar documentos y registrar commit y decisiones definitivas. No publicar automáticamente.

## 10. Qué queda decidido y qué no
Aprobado: Taller Constructivo, Grafito y latón como dirección, escala irregular + constructivismo, retícula discreta, referencia AURUM/Bauhaus, tipografía e isotipo animables, libertad de rediseñar logo, respeto a navegación y funciones.
Pendiente: hex definitivos, tratamiento exacto de selección, composición tipográfica y eslogan, normalización técnica del logo, técnica de morph 3D, duración y ubicación de portada, preferencia de entrada para usuarios frecuentes. No confundir muestras con aprobación de cada detalle.
Primer cambio recomendado: laboratorio visual aislado y revisable, sin cambiar la experiencia actual. No empezar por la animación ni por migrar rutas. 


## 11. Decisiones aprobadas tras las iteraciones 2 y 3 (27/11/2026)

- **Tipografía:** el propietario aprobó expresamente la escala irregular por carácter de la v3 («Lo de las letras, hermoso!! Es por ahí»). La v2, centrada en iniciales grandes, era demasiado tímida. Conservar diferencias visibles de escala; explorar ancho y peso sin perder legibilidad. Aplicar a portada y títulos de páginas principales, no a controles, cotas o formularios. Mantener composición determinista y animable.
- **Isotipo:** se eligió la familia B, con B1 como referencia de contundencia. El propietario detectó parecido con Gmail; entre las nuevas variantes B7–B11 eligió B11 «Muesca». Se conserva su geometría de referencia: M13 78V13H27L50 44 73 13H87V78H73V36L50 66 27 36V78H21V70H13Z; acento M50 44L73 13H87L50 66Z; viewBox 0 0 100 90. El recorte inferior izquierdo es el gesto distintivo. No afirmar que elimina por completo la asociación ni que se ha realizado una búsqueda de marcas. B11 fue la dirección preferida en esa iteración; sustituida después por B12 (sección 13).
- Grafito y latón, retícula discreta, referencia editorial AURUM/Bauhaus, animación de tipografía e isotipo siguen aprobados. El nombre Taller Constructivo es interno. No cambiar la navegación existente por motivos estéticos.

## 12. Checklist de ejecución acordado

### A — Logo (en paralelo con B)
- [x] Elegir familia B y muesca B11 como referencia.
- [x] Comparar cuatro refinamientos de profundidad, ancho y posición de muesca.
- [ ] Comprobar a 16, 32 y 64 px, en claro/oscuro y monocromo, junto al nombre.
- [x] Elegir B12 como isotipo definitivo por preferencia del propietario.
- [ ] Validar legibilidad y diferenciación en aplicaciones reales; no se ha realizado búsqueda marcaria.

### B — Tipografía
- [x] Aprobar irregularidad visible por letra.
- [ ] Probar Bricolage Grotesque, Onest y JetBrains Mono reales.
- [ ] Explorar ancho, peso y logotipo tipográfico Mubleando.
- [ ] Definir títulos Proyectos, Bibliotecas, Ambientes y Ayuda; validar móvil, zoom y teclado.

### C — Sistema visual
- [ ] Validar tokens grafito/latón y contraste de texto, foco, estados y selección 3D.
- [ ] Ajustar retícula, tarjetas, bordes, sombras e iconos sin cambiar navegación.
- [ ] Aprobar sistema visual.

### D — Integración
- [ ] Aplicar tokens, logo y cabeceras aprobadas en rama de desarrollo.
- [ ] Revisar editores, datos, rutas, PWA y documentación vigente.

### E — Inicio y animación
- [ ] Portada estática funcional, accesos y ayuda.
- [ ] Isotipo volumétrico, letras independientes y transición hacia mueble/despiece con scroll reversible.
- [ ] Fallback estático, reduced-motion, rendimiento y móvil.

### F — Validación y publicación
- [ ] Pruebas funcionales, visuales y de regresión; revisión conjunta.
- [ ] Merge y despliegue solo tras aprobar.

Rama de laboratorio: [design/taller-constructivo](https://github.com/MaharBa264/mubleando/tree/design/taller-constructivo). Este registro prevalece sobre las exploraciones de logo A/B/C de las secciones anteriores.

## 13. Decisión final del isotipo — B12 · Encastre profundo

Fecha: 27/11/2026. El propietario seleccionó B12 como definitiva tras comparar B11–B15. Se cierra la exploración de familias y se conserva la geometría exacta de B12 salvo correcciones técnicas justificadas y aprobadas. B11 es antecedente; B13–B15 quedan archivadas. La muesca inferior izquierda más profunda es el gesto distintivo. La mejora de lectura a tamaños pequeños y la diferenciación frente a Gmail son hipótesis de diseño pendientes de validación, no resultados de pruebas ni de una búsqueda de marcas.

Geometría canónica SVG: viewBox 0 0 100 90; contorno `M13 78V13H27L50 44 73 13H87V78H73V36L50 66 27 36V78H23V65H13Z`; plano de acento `M50 44L73 13H87L50 66Z`. Mantener ambas capas separadas para futura animación. Paleta candidata: grafito #262624 y latón #87612D en claro; marfil #F3F0E9 y latón #CBA66C en oscuro; monocromo con ambas capas del mismo color. No modificar proporciones ni recolocar la muesca para iconos sin revisión.

### Siguiente bloque: implementación real en rama de desarrollo

1. Congelar activos SVG B12 claro, oscuro y monocromo; comprobar 16/32/64 px y márgenes del icono. Conservar originales de producción hasta aprobar integración.
2. Actualizar el laboratorio: B12 por defecto en cabecera y composición tipográfica. Preservar variantes previas como historial; no reabrir el diseño del símbolo.
3. Auditar la rama y sincronizar con main antes de editar la app; no sobrescribir cambios ajenos. Registrar baseline y revisar colores hardcodeados y pruebas.
4. `apps/web/src/app/globals.css`: aplicar únicamente tokens grafito/latón validados, contraste de foco, selección y estados; conservar colores de materiales y API de tokens. Retícula decorativa opt-in, no global.
5. `apps/web/src/app/layout.tsx`: conservar Onest, Bricolage Grotesque y JetBrains Mono; sincronizar themeColor tras aprobar tokens; probar fuentes reales y variantes de peso/ancho.
6. `apps/web/src/components/AppShell.tsx`: integrar B12 mediante componente de marca reutilizable; preservar destinos, auth y navegación. Crear título expresivo accesible opt-in para cabeceras principales, con composición determinista por letra, sin alterar títulos técnicos. Revisar tamaños móviles y textos largos.
7. Auditar `app/icon.svg`, `app/apple-icon.png`, `app/manifest.ts`, `scripts/make-icons.mjs` y activos de public antes de regenerar iconos PWA. Usar la misma geometría canónica y mantener compatibilidad.
8. Verificar Proyectos, Bibliotecas, Ayuda, Ambientes, editores, cuenta, administración, impresión y exportaciones. Ejecutar npm test, npm run typecheck, npm run build y pruebas visuales claro/oscuro, 375 px y zoom 200%. Actualizar docs/diseno.md con valores realmente aplicados. No desplegar hasta revisión.
9. Solo después: portada funcional, separación de rutas y animación reversible de logo y tipografía según issue #16. No mezclar migración de rutas con esta fase visual.

Estado: identidad del isotipo aprobada, integración y QA pendientes. La rama de diseño es el espacio de trabajo; main conserva por ahora la aplicación vigente.
