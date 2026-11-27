# Laboratorio Taller Constructivo

Rama `design/taller-constructivo`. Abrir `taller-constructivo.html` localmente en un navegador. No necesita servidor, dependencias ni acceso a datos de Mubleando.

## Iteración 2
- Composición editorial con retícula opcional, índice de objeto y título irregular/constructivista/moderado.
- Comparación latón frente a cobre actual en claro y oscuro.
- Tres estudios de isotipo A (evolución), B (ensamble), C (paneles); al elegir se modifica la cabecera de muestra. B es el valor inicial de prueba, no logo aprobado.
- Muestra simplificada del editor: estructura, visor vectorial, propiedades y contorno discontinuo de selección. Los datos son ilustrativos.
- Búsqueda sobre proyectos ficticios.

## Revisión pendiente
Abrir a 1440, 1024 y 375 px, comprobar desbordamientos, zoom 200%, teclado, temas y cada selector. Evaluar identidad y selección sobre materiales claros/oscuros. Las fuentes de sistema son provisionales: siguiente iteración debe usar Bricolage Grotesque, Onest y JetBrains Mono reales. No hay render 3D ni scroll narrativo todavía. No se ha ejecutado validación en navegador. No integrar en main antes de aprobar diseño y pruebas.

Siguiente decisión: elegir dirección de isotipo y grado de expresividad tipográfica; luego prototipo con fuentes reales y tokens validados antes de modificar la app.

## Iteración 3 — 27/11/2026
El propietario eligió explorar exclusivamente la opción B (Ensamble) y señaló que la irregularidad tipográfica de v2 era prácticamente imperceptible. Se reemplazan A/B/C en el laboratorio por B1 original, B2 encuentro, B3 diagonal, B4 ensamble abierto, B5 contrapeso y B6 modular bajo. Se incluyen muestras de 16/24/40 px y aplicación en cabecera. B2 es valor inicial de prueba, no decisión definitiva.
La escala tipográfica ahora es por carácter (0,58–1,48 em según letra, además de pequeños desplazamientos verticales); también se aplica en el título de Proyectos de muestra. El modo moderado desactiva esa irregularidad y el constructivista agrega composición asimétrica, bloques y contraste de peso. Se mantienen nombres accesibles. Fuentes de sistema aún provisionales; no se ha comprobado visualmente en navegador ni integrado en la aplicación. Revisar recorte, acentos, zoom y anchos estrechos antes de aprobar.

## Iteración 4
B11 (muesca inferior izquierda) es la referencia preferida por el propietario; B12–B15 son refinamientos no aprobados. Comparación a 16/32/64 px, monocromo, temas y composición tipográfica irregular del nombre. El laboratorio intenta fuentes locales Bricolage Grotesque, Onest y JetBrains Mono con fallback; no garantiza que estén instaladas. Falta probar fuentes reales y navegador. Decisiones y checklist guardados en main, docs/taller-constructivo.md secciones 11–12. No se modifica producción.

## Iteración 5 — decisión cerrada
El propietario eligió B12 (Encastre profundo) como isotipo definitivo. El laboratorio lo usa por defecto en cabecera y logotipo; B11/B13–B15 se mantienen como comparativas históricas. No seguir explorando familias. La geometría y el orden de integración están en docs/taller-constructivo.md, sección 13 de main. Los SVG de referencia se guardan en docs/prototipos/marca/. Aún falta QA en navegador, integración de fuentes y aplicación real; no se modifica producción.
