# Modelos de ejemplo

## AC20-FZK-Haus.ifc

Casa unifamiliar de dos plantas (IFC4, exportada desde ArchiCAD 20, 2,5 MB). Incluye cantidades base (`BaseQuantities`) en muros, losas, puertas y ventanas, en metros.

- **Autor:** Institute for Automation and Applied Informatics (IAI) / Karlsruhe Institute of Technology (KIT).
- **Licencia:** "These examples are made by the Institute for Applied Computer Science (IAI) at the Karlsruhe Institute of Technology (KIT), and are for unrestricted use."
- **Fuente:** https://www.ifcwiki.org/index.php?title=KIT_IFC_Examples

## AC20-Institute-Var-2.ifc

Edificio de oficinas de cinco niveles (IFC4, exportado desde ArchiCAD 20, 10,4 MB): 121 muros, 206 ventanas, 77 puertas, 26 losas, escaleras y barandas, con cantidades base. Sirve para probar la subida de un modelo grande.

- **Autor, licencia y fuente:** los mismos de _AC20-FZK-Haus.ifc_ (IAI / KIT, uso libre).

## Building-Structural.ifc

Estructura pequeña (IFC4, exportada desde SketchUp, 181 KB): vigas, muros y una zapata. Carga en segundos.

- **Autor:** © buildingSMART International Ltd.
- **Licencia:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Fuente:** https://github.com/buildingSMART/Sample-Test-Files (`IFC 4.0.2.1 (IFC 4 ADD2 TC1)/Simple-Scene`)

Todos los `.ifc` de esta carpeta se publican también como descargas de la aplicación desplegada (`/samples/<archivo>`): los copia `client/scripts/copy-assets.mjs` al compilar el cliente.

## Fixture de tests: `shared/src/extraction/__fixtures__/Building-Architecture.ifc`

Modelo mínimo (IFC4, unidades en milímetros, conjuntos `Qto_*BaseQuantities`) usado en los tests de extracción para cubrir la conversión de unidades.

- **Autor:** © buildingSMART International Ltd.
- **Licencia:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Fuente:** https://github.com/buildingSMART/Sample-Test-Files
