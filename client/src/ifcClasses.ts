import { isMessageKey, t } from './i18n/core';

/** Readable name of an IFC class (see the `ifc.*` texts); unknown classes keep their name. */
export function ifcClassLabel(ifcClass: string): string {
  const key = `ifc.${ifcClass}`;
  return isMessageKey(key) ? t(key) : ifcClass;
}
