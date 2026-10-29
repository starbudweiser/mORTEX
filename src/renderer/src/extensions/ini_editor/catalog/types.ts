export type SettingType = "bool" | "int" | "float" | "choice" | "text";

export type TabId =
  | "display"
  | "shadows"
  | "distance"
  | "grassLod"
  | "waterFx"
  | "interface"
  | "game"
  | "camera"
  | "audio";

export interface ISettingOption {
  /** valeur écrite dans l'INI */
  value: string;
  /** libellé non traduit (nombre, nom propre) ; sinon la clé de texte `options.<id>.<value>` */
  label?: string;
}

export interface ISettingDependency {
  /** identifiant du réglage dont celui-ci dépend ; grisé tant que sa valeur n'est pas `value` */
  on: string;
  /** valeur qui active ce réglage ; "1" par défaut (réglage booléen activé) */
  value?: string;
  /** à la place de `value` : actif pour toute valeur autre que celle-ci */
  not?: string;
}

export interface ICatalogSetting {
  /** identifiant unique, aussi la base des clés de texte : `help.<id>` et `macNote.<id>` */
  id: string;
  tab: TabId;
  section: string;
  key: string;
  type: SettingType;
  min?: number;
  max?: number;
  step?: number;
  /** unité affichée après la valeur : "px", "m", "%" … */
  unit?: string;
  options?: ISettingOption[];
  dependsOn?: ISettingDependency;
  /** une note propre au Mac existe pour ce réglage (clé de texte `macNote.<id>`) */
  macNote?: true;
  /**
   * Le nom du réglage n'apparaît pas dans SkyrimSE.exe (le jeu le lit autrement) : il est connu
   * par les INI de Bethesda ou par l'usage, et reste à confirmer en jeu (console, `getini`).
   */
  outsideExe?: true;
}
