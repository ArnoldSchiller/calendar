export type TagTyp = 'NORMAL' | 'FEIERTAG' | 'HEUTE' | 'SAMSTAG' | 'SONNTAG' | 'LEER';

export interface KalenderTag {
  tagNummer: number | null; // null für Leertage
  datum: Date;
  typ: TagTyp;
  istGesetzlich: boolean;
  beschreibung: string;
}
