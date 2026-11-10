// Spanish names for the IFC classes that usually appear in building models.

const LABELS: Record<string, string> = {
  IfcWall: 'Muros',
  IfcWallStandardCase: 'Muros',
  IfcCurtainWall: 'Muros cortina',
  IfcSlab: 'Losas',
  IfcRoof: 'Cubiertas',
  IfcBeam: 'Vigas',
  IfcColumn: 'Columnas',
  IfcMember: 'Miembros (correas, cerchas)',
  IfcPlate: 'Placas',
  IfcFooting: 'Cimentaciones',
  IfcPile: 'Pilotes',
  IfcStair: 'Escaleras',
  IfcStairFlight: 'Tramos de escalera',
  IfcRamp: 'Rampas',
  IfcRailing: 'Barandas',
  IfcDoor: 'Puertas',
  IfcWindow: 'Ventanas',
  IfcCovering: 'Recubrimientos',
  IfcBuildingElementProxy: 'Elementos genéricos',
  IfcFurniture: 'Mobiliario',
  IfcFurnishingElement: 'Mobiliario',
  IfcReinforcingBar: 'Barras de refuerzo',
  IfcFlowSegment: 'Tuberías y ductos',
  IfcFlowTerminal: 'Aparatos',
};

export function ifcClassLabel(ifcClass: string): string {
  return LABELS[ifcClass] ?? ifcClass;
}
