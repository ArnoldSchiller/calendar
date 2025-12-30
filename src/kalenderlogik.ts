import { type KalenderTag, type TagTyp } from './kalendertag.js';

interface FeiertagInfo {
  istGesetzlich: boolean;
  name: string;
}

export class KalenderLogik {
  // Deine Osterformel (Gauß)
  static berechneOstern(jahr: number): Date {
    const a = jahr % 19;
    const k = Math.floor(jahr / 100);
    const m = 15 + Math.floor((3 * k + 3) / 4) - Math.floor((8 * k + 13) / 25);
    const s = 2 - Math.floor((3 * k + 3) / 4);
    const d = (19 * a + m) % 30;
    const r = Math.floor(d / 29) + (Math.floor(d / 28) - Math.floor(d / 29)) * Math.floor(a / 11);
    const og = 21 + d - r;
    const sz = 7 - (jahr + Math.floor(jahr / 4) + s) % 7;
    const oe = 7 - (og - sz) % 7;
    const tageAbMaerz = og + oe;
    
    return tageAbMaerz <= 31 
      ? new Date(jahr, 2, tageAbMaerz) 
      : new Date(jahr, 3, tageAbMaerz - 31);
  }

  static getFeiertag(datum: Date): FeiertagInfo | null {
    const d = datum.getDate();
    const m = datum.getMonth() + 1; // 1-12
    const j = datum.getFullYear();
    const ostern = this.berechneOstern(j);

    // Hilfsfunktion für bewegliche Feiertage (Tage relativ zu Ostern)
    const relativZuOstern = (tage: number): string => {
      const d2 = new Date(ostern.getTime());
      d2.setDate(d2.getDate() + tage);
      return d2.toDateString();
    };

    const dStr = datum.toDateString();

    // 1. Feste Feiertage
    if (m === 1 && d === 1)   return { name: "Neujahr", istGesetzlich: true };
    if (m === 1 && d === 6)   return { name: "Heilige Drei Könige", istGesetzlich: true };
    if (m === 5 && d === 1)   return { name: "Maifeiertag", istGesetzlich: true };
    if (m === 10 && d === 3)  return { name: "Tag der Deutschen Einheit", istGesetzlich: true };
    if (m === 11 && d === 1)  return { name: "Allerheiligen", istGesetzlich: true };
    if (m === 12 && d === 24) return { name: "Heiligabend", istGesetzlich: false };
    if (m === 12 && d === 25) return { name: "1. Weihnachtsfeiertag", istGesetzlich: true };
    if (m === 12 && d === 26) return { name: "2. Weihnachtsfeiertag", istGesetzlich: true };
    if (m === 12 && d === 31) return { name: "Silvester", istGesetzlich: false };


    // 2. Bewegliche Feiertage (basierend auf Oster-Logik)
    if (dStr === relativZuOstern(-48)) return { name: "Rosenmontag", istGesetzlich: false };
    if (dStr === relativZuOstern(-47)) return { name: "Faschingsdienstag", istGesetzlich: false };
    if (dStr === relativZuOstern(-46)) return { name: "Aschermittwoch", istGesetzlich: false };
    if (dStr === relativZuOstern(-2))  return { name: "Karfreitag", istGesetzlich: true };
    if (dStr === relativZuOstern(0))   return { name: "Ostersonntag", istGesetzlich: true };
    if (dStr === relativZuOstern(1))   return { name: "Ostermontag", istGesetzlich: true };
    if (dStr === relativZuOstern(39))  return { name: "Christi Himmelfahrt", istGesetzlich: true };
    if (dStr === relativZuOstern(49))  return { name: "Pfingstsonntag", istGesetzlich: true };
    if (dStr === relativZuOstern(50))  return { name: "Pfingstmontag", istGesetzlich: true };
    if (dStr === relativZuOstern(60))  return { name: "Fronleichnam", istGesetzlich: true };

    // Buß- und Bettag: Mittwoch vor dem 23. November
    const bussUndBettagDate = new Date(j, 10, 22); // 22. Nov (Monat 10 in JS)
    const wochentag = bussUndBettagDate.getDay(); // 0 (So) bis 6 (Sa)
    const offset = (wochentag >= 3) ? (wochentag - 3) : (wochentag + 4);
    bussUndBettagDate.setDate(bussUndBettagDate.getDate() - offset);

    if (dStr === bussUndBettagDate.toDateString()) return { name: "Buß- und Bettag", istGesetzlich: false }; // Nur in SN gesetzlich



    return null;
  }

  static getTageImMonat(jahr: number, monat: number): KalenderTag[] {
    const tage: KalenderTag[] = [];
    const anzahlTage = new Date(jahr, monat + 1, 0).getDate();
    const heute = new Date().toDateString();

    for (let t = 1; t <= anzahlTage; t++) {
      const aktuellesDatum = new Date(jahr, monat, t);
      const feiertag = this.getFeiertag(aktuellesDatum);
      
      let typ: TagTyp = 'NORMAL';
      const wochentag = aktuellesDatum.getDay();
      if (wochentag === 0) typ = 'SONNTAG';
      else if (wochentag === 6) typ = 'SAMSTAG';
      
      if (feiertag) typ = 'FEIERTAG';
      if (aktuellesDatum.toDateString() === heute) typ = 'HEUTE';

      tage.push({
        tagNummer: t,
        datum: aktuellesDatum,
        typ: typ,
        istGesetzlich: feiertag?.istGesetzlich || false,
        beschreibung: feiertag?.name || (typ === 'SONNTAG' ? 'Sonntag' : '')
      });
    }
    return tage;
  }
}
