# Sample models

Every `.ifc` file in this folder is also published as a download of the deployed app (`/samples/<file>`): `client/scripts/copy-assets.mjs` copies them when the client is built.

## AC20-FZK-Haus.ifc

Two-storey detached house (IFC4, exported from ArchiCAD 20, 2.5 MB). It includes base quantities (`BaseQuantities`) for walls, slabs, doors and windows, in metres. It is the model of the demo project.

- **Author:** Institute for Automation and Applied Informatics (IAI) / Karlsruhe Institute of Technology (KIT).
- **License:** "These examples are made by the Institute for Applied Computer Science (IAI) at the Karlsruhe Institute of Technology (KIT), and are for unrestricted use."
- **Source:** https://www.ifcwiki.org/index.php?title=KIT_IFC_Examples

## AC20-Institute-Var-2.ifc

Five-storey office building (IFC4, exported from ArchiCAD 20, 10.4 MB): 121 walls, 206 windows, 77 doors, 26 slabs, stairs and railings, with base quantities. Good for testing the upload of a large model.

- **Author, license and source:** the same as _AC20-FZK-Haus.ifc_ (IAI / KIT, unrestricted use).

## Building-Structural.ifc

Small structure (IFC4, exported from SketchUp, 181 KB): beams, walls and a footing. Loads in seconds.

- **Author:** © buildingSMART International Ltd.
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Source:** https://github.com/buildingSMART/Sample-Test-Files (`IFC 4.0.2.1 (IFC 4 ADD2 TC1)/Simple-Scene`)

## Test fixture: `shared/src/extraction/__fixtures__/Building-Architecture.ifc`

Minimal model (IFC4, units in millimetres, `Qto_*BaseQuantities` sets) used by the extraction tests to cover unit conversion.

- **Author:** © buildingSMART International Ltd.
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Source:** https://github.com/buildingSMART/Sample-Test-Files
