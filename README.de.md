
# Projekt IT Calendar

**Cinnamon Spices Applet** – Ein erweiterter Kalender für Cinnamon, inkl. Feiertagen und Systemereignissen.  
Geschrieben in **TypeScript**, kompiliert zu `applet.js`.  

---

## 📝 Beschreibung

Dieses Applet bietet eine übersichtliche Monats-, Jahres- und Tagesansicht direkt in Cinnamon. Es unterstützt:  

- Anzeige von Feiertagen (inkl. gesetzlicher Feiertage)  
- Integration von Terminen über den `EventManager`  
- Scroll- und Navigation per Maus, Scrollrad und Tastatur  
- Tooltips mit Feiertags- und Eventinformationen  

Die Hauptansicht wird durch `CalendarView` (`calendarView.ts`) gesteuert und läuft innerhalb eines `AppletPopupMenu`.

---

## ⚙️ Installation (Entwickler)

1. Repo klonen:
```bash
git clone https://github.com/ArnoldSchiller/calendar.git
````

2. In das Applet-Verzeichnis wechseln:

```bash
cd calendar
```

3. TypeScript kompilieren:

```bash
tsc
```

Dies erstellt `applet.js` aus den `.ts`-Dateien.

4. Applet in Cinnamon installieren:

   * Applet-Verzeichnis in `~/.local/share/cinnamon/applets/` kopieren
   * Cinnamon neustarten oder `Alt+F2 → r` zum Neustart
   * Applet über die Einstellungen hinzufügen

---

## 🛠️ Struktur

```
calendar/
├─ metadata.json       # Applet-Metadaten (UUID, Name, Beschreibung, Icon etc.)
├─ applet.js           # kompiliertes TypeScript
├─ calendarView.ts     # Hauptansicht (Monat/Tag/Jahr)
├─ EventManager.ts     # Verwaltung von Events/Terminen
├─ kalenderlogik.ts    # Berechnung von Tagen/Feiertagen
├─ locale/             # Übersetzungen
├─ styles.css          # optionales Styling
└─ package.json        # Node/TypeScript Abhängigkeiten
```

---

## 🧩 Nutzung

* **Monatsansicht:** Standardansicht, zeigt Tage und Wochen.
* **Tagesansicht:** Klick auf einen Tag wechselt zur Detailansicht.
* **Jahresansicht:** Übersicht über alle Monate, Klick wechselt zurück zur Monatsansicht.
* **Feiertage & Events:** werden farblich hervorgehoben und mit Tooltips versehen.
* **Navigation:**

  * Maus: Scrollrad → Monat wechseln
  * Tastatur: Pfeiltasten → Monat/Jahr wechseln

---

## 📄 Lizenz

Dieses Projekt steht unter der **GPL-3.0 License**.

---

## 💡 Hinweise für Entwickler

* `CalendarView.render()` darf erst aufgerufen werden, nachdem `navBox` & `contentBox` existieren.
* Events werden über den `EventManager` verwaltet, der auch externe Termine bereitstellen kann.
* Für TypeScript-Entwicklung:

  * Kompilierung nach `applet.js`
  * `.gitignore` sollte `node_modules/` und `.tsbuildinfo` enthalten

---

## 🌐 Kontakt

Autor: Projekt IT
UUID: `calendar@projektit.de`

Die englische Readme ist umfangreicher. Ich pflege das jetzt nicht doppelt.
Das Projekt ist jetzt wie es ist. Aus verschiedenen Gründen, erweitere ich es nicht mehr.
Werde es auch nicht weiterentwickeln. Es hat die Grenzen des Cinnamon Applet ausgeschöpft.
Alles weitere ist nicht im Sinne eines Applet.



## 📄 License

This project is licensed under the **GPL-3.0-or-later License**.

---

## 🌐 Contact & Links

**Author:** Arnold Schiller  
**UUID:** `calendar@projektit.de`  
**GitHub:** https://github.com/ArnoldSchiller/calendar  
**Project Page:** https://projektit.de/kalender  
**Cinnamon Spices:** https://cinnamon-spices.linuxmint.com/applets

---

## 🙏 Acknowledgments

- **Cinnamon Team** for the excellent desktop environment
- **GNOME/GTK** for the underlying technologies
- **TypeScript** for bringing modern JavaScript to Cinnamon
- **All Contributors** who help improve this applet
```


```

---




```

