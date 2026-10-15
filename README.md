# Voxel Atlas — controles de escritorio y shaders

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
- Ctrl + W o doble toque de W: correr. Shift: agacharse y proteger el borde.
- Ratón: mirar. Mantener clic izquierdo: minar/atacar. Clic derecho: usar o colocar; mantenerlo repite la colocación cada 0,2 s. Shift + clic derecho: colocar junto a una estación.
- Mantener clic derecho 1,6 s: comer si falta hambre. Soltarlo cancela la acción.
- Clic central: elegir el bloque apuntado; en supervivencia debes tenerlo.
- E: inventario/fabricación. 1–9 o rueda: acceso rápido. F: intercambiar con la mano secundaria.
- Q: soltar un objeto. Ctrl + Q: soltar hasta 64. Se lanzan al mundo, conservan colisiones y tienen espera antes de recogerlos.
- Doble espacio: activar/desactivar vuelo creativo. Espacio/Shift: subir/bajar. Aterrizar descendiendo desactiva el vuelo. El vuelo creativo conserva colisiones; espectador atraviesa bloques.
- F1: ocultar/mostrar interfaz y mano. F3: información de mundo/coordenadas. Esc: pausa y guardado.
- En móvil: botones de movimiento, salto, minería, colocación, uso, carrera y agachado; arrastre sobre el mundo para mirar. Doble toque de Saltar activa el vuelo creativo. Mantén Usar para comer.

**Pausa → Controles y shaders** permite cambiar campo de visión (60–100°), sensibilidad e inversión vertical. Los ajustes se conservan en el navegador. La mano secundaria se guarda con la partida y puede colocar bloques o comer cuando la principal no realiza una acción. El inventario continúa usando cantidades por tipo; F no introduce pilas independientes.

## Shaders incorporados

No requieren descargas ni archivos externos. Se ejecutan en GLSL/WebGL 1.

| Perfil | Efectos |
|---|---|
| Clásico | Atlas pixelado sin suavizado, luz por caras, AO de esquinas y luces próximas |
| Suave | Lo anterior, luz solar por normales, luz ambiental fría y luces cálidas, cielo al atardecer, movimiento de vegetación, ondas visuales y reflejo del cielo por Fresnel en el agua |
| Cinemático | Perfil Suave más una pasada de resplandor de zonas brillantes, contraste y viñeta sutil |

Suave es el valor inicial en pantallas táctiles; Cinemático en escritorio. Puedes volver a Clásico para reducir la carga gráfica. Los recursos de postprocesado se liberan al desactivarlo y se recrean al cambiar tamaño o restaurar WebGL; si el framebuffer no está disponible se mantiene Suave. La interfaz y la mano se dibujan después del resplandor.

Los reflejos son del cielo, no de edificios o criaturas. La iluminación conserva las sombras de contacto por AO: no hay sombras solares proyectadas, sombras de antorchas, ray tracing ni compatibilidad con paquetes Iris/OptiFine. El resplandor es una aproximación ligera de nueve muestras en color de 8 bits.

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
| Luz y shaders | Tres perfiles funcionales; normales, Fresnel, AO, luces próximas y postprocesado. Sin propagación voxel ni sombras proyectadas |
| Cofres, armadura, experiencia, redstone, encantamientos, pociones | Pendientes |
| Estructuras complejas, mundo ilimitado y generación en worker | Pendientes |
| Multijugador | Pendiente; no existe servidor de juego |

No hay promesa de compatibilidad con todos los dispositivos. WebGL no disponible muestra un error explícito. Las pruebas táctiles emulan un móvil en Chromium; no sustituyen dispositivos físicos ni Safari/Firefox.

## WebAssembly y validación

`engine/engine.wat` contiene el código fuente compilable. El HTML incorpora un ensamblador binario equivalente, por lo que es independiente de archivos externos. WASM ejecuta almacenamiento/lectura voxel, hash de semilla, gravedad y cálculo de las seis caras visibles por bloque durante el mallado. La generación de alto nivel, el resto del mallado, física de colisión, interfaz y renderizado siguen en JavaScript.

`npm run build` compila WAT con WABT y compara su comportamiento con el módulo incorporado: límites, hash, gravedad y máscaras de caras. `tests/browser.mjs` prueba creación, movimiento, colisión, interacción, fabricación, guardado/reapertura, límites de chunks, portal/dimensiones, controles táctiles, HTML descargado y versión organizada. También prueba los eventos de teclado/ratón nuevos, el tiempo de comer, la mano secundaria, los tres perfiles mediante lectura real de píxeles, restauración del contexto WebGL y persistencia de ajustes.

GitHub Actions publica el resultado real y un artefacto con ambos formatos, capturas y `test-results/report.json`. Un workflow presente en el repositorio no implica que haya pasado: revisa la ejecución del commit concreto.
