# Voxel Atlas — reparación del núcleo

Juego voxel original, inspirado en Minecraft Java vanilla de escritorio. No es Minecraft ni una reproducción completa. Conserva las tres dimensiones, 16 tipos de bioma, herramientas, recetas, criaturas y modos del intento inicial. Texturas y sonidos son recursos originales aproximados.

## Ejecutar

**Un único archivo:** descarga `mweb.html` con el botón **Download raw file** de GitHub y ábrelo en un navegador con WebAssembly y WebGL. El motor, las texturas de 16 × 16 y los sonidos sintetizados están incorporados. No necesita CDN, cuenta, instalación ni conexión.

El guardado automático depende de que el navegador permita almacenamiento local. Para mover una partida entre navegadores, rutas o dispositivos, usa **Pausa → Exportar partida** e **Importar partida**. Conserva una copia de tus guardados antes de cambiar de versión.

**Versión organizada y compilación reproducible** (Node.js 22):
```sh
npm install
npm run build
npm run serve
```
Abre http://127.0.0.1:8080/dist/organized/index.html. La compilación genera HTML, CSS, JavaScript y `engine.wasm` separados en `dist/organized/`, y el HTML portable en `dist/voxel-atlas-completo.html`.

Para probar:
```sh
npx playwright install --with-deps chromium
npm test
```
La prueba presupone haber ejecutado `npm run build`.

## Controles

- WASD: caminar. Espacio: saltar o nadar hacia arriba.
- Ctrl + W: correr. Shift: agacharse y proteger el borde del bloque.
- Ratón: mirar. Clic izquierdo: minar/atacar. Clic derecho: usar estación/comida o colocar. Shift + clic derecho: colocar junto a una estación.
- E: inventario/fabricación. 1–9 o rueda: acceso rápido. F: usar.
- V: alternar vuelo creativo. Espacio/Shift: subir/bajar. El vuelo creativo conserva las colisiones; espectador puede atravesar bloques.
- Esc: pausa. En móvil hay botones para movimiento, salto, minería, colocación, uso, carrera y agachado, y arrastre sobre el mundo para mirar.

## Diagnóstico y cambios

El archivo original era una aplicación completa con un parche gráfico incorporado, no un port de Minecraft. El repositorio contenía únicamente el HTML y un README vacío de instrucciones.

Defectos corregidos: vuelo creativo sin colisiones; contacto impreciso con suelo y techo; temporizador de hambre compartido con ahogamiento; reaparición inmediata sin pantalla; objetos entregados directamente al romper; orientación perdida de hornos/troncos; estado de criaturas y colas de simulación perdido al viajar/cargar; transparencias ordenadas solo por chunk; profundidad del sol/luna que podía tapar terreno lejano; reconstrucción síncrona de todos los chunks; recursos gráficos sin liberar al reiniciar el contexto; copia HTML capturada durante la ejecución con elementos de interfaz de la sesión.

Nuevas partidas: fronteras de biomas mediante centros desplazados por semilla y alturas interpoladas. Las partidas versión 1 conservan el generador anterior para evitar mover el terreno bajo construcciones existentes.

## Estado real de los sistemas

| Sistema | Estado de esta entrega |
|---|---|
| Arranque offline, motor WASM y WebGL 1 | Implementado; pruebas automatizadas en Chromium |
| Cámara, gravedad, salto, carrera, agachado, colisión de cabeza/cuerpo, natación, caída | Implementados; físicas aproximadas, sin escalones de media altura |
| Texturas por cara, transparencia, contorno, grietas, partículas, mano, sonidos | Implementados; materiales, criaturas y audio son aproximaciones originales |
| Minería, herramienta, durabilidad, recogida, colocación y orientación | Implementados; catálogo y equilibrio simplificados |
| Guardar/cargar/exportar/importar | Implementados; posición, inventario, cambios, orientación, criaturas, cultivos, objetos y colas por dimensión |
| Creativo, supervivencia, aventura, espectador y extremo | Implementados con reglas simplificadas |
| Chunks | Mallas de caras visibles, carga/descarga de mallas y presupuesto por fotograma; terreno finito 96 × 48 × 96 |
| Biomas, cuevas y minerales | Parciales; 16 tipos y generación por semilla, sin la complejidad de vanilla |
| Inventario y fabricación | Parciales; cantidades por tipo y recetas por botones, sin movimiento/división de pilas |
| Mesa, horno, cama | Parciales; estaciones próximas, fundición instantánea y sueño simplificado |
| Criaturas y combate | Parciales; movimiento/colisión, daño, objetos, sin navegación avanzada |
| Agua/lava | Parciales; expansión acotada, gravedad y solidificación, sin retirada de flujo ni niveles de agua completos |
| Cultivos | Parciales; semillas, azada y crecimiento por tiempo, sin hidratación completa |
| Dimensiones y portales | Parciales; tres mundos finitos, entrada caminando o usando, sin jefes |
| Luz | Parcial; orientación, AO y cuatro luces próximas, sin propagación voxel ni sombras de antorchas |
| Cofres, armadura, experiencia, redstone, encantamientos, pociones | Pendientes |
| Estructuras complejas, mundo ilimitado y generación en worker | Pendientes |
| Multijugador | Pendiente; no existe servidor de juego |

No hay promesa de compatibilidad con todos los dispositivos. WebGL no disponible muestra un error explícito. Las pruebas táctiles emulan un móvil en Chromium; no sustituyen dispositivos físicos ni Safari/Firefox.

## WebAssembly y validación

`engine/engine.wat` contiene el código fuente compilable. El HTML incorpora un ensamblador binario equivalente, por lo que es independiente de archivos externos. WASM ejecuta almacenamiento/lectura voxel, hash de semilla, gravedad y cálculo de las seis caras visibles por bloque durante el mallado. La generación de alto nivel, el resto del mallado, física de colisión, interfaz y renderizado siguen en JavaScript.

`npm run build` compila WAT con WABT y compara su comportamiento con el módulo incorporado: límites, hash, gravedad y máscaras de caras. `tests/browser.mjs` prueba creación, movimiento, colisión, interacción, fabricación, guardado/reapertura, límites de chunks, portal/dimensiones, controles táctiles, HTML descargado y versión organizada.

GitHub Actions publica el resultado real y un artefacto con ambos formatos, capturas y `test-results/report.json`. Un workflow presente en el repositorio no implica que haya pasado: revisa la ejecución del commit concreto.
