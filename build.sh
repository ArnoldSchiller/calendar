#!/bin/bash

UUID="calendar@projektit.de"
LOCAL_APPLET_DIR="$HOME/.local/share/cinnamon/applets/$UUID"

echo "🚀 Starte Build für $UUID..."

# 1. TypeScript kompilieren
tsc

if [ $? -eq 0 ]; then
    echo "✅ TypeScript Kompilierung erfolgreich."
    
    # 2. Lokales Verzeichnis vorbereiten (falls nicht vorhanden)
    mkdir -p "$LOCAL_APPLET_DIR"

    # 3. Dateien verlinken oder kopieren
    # Wir kopieren hier zur Sicherheit, damit das lokale Cinnamon-Verzeichnis 
    # immer den aktuellen Stand von 'files/' spiegelt.
    cp -r ./files/$UUID/* "$LOCAL_APPLET_DIR/"
    
    echo "📂 Dateien nach $LOCAL_APPLET_DIR kopiert."
    echo "🔄 Bitte Applet in Cinnamon neu laden (Rechtsklick -> Fehlerbehebung -> Erneuern)."
else
    echo "❌ Fehler: Kompilierung fehlgeschlagen. Bitte Code prüfen."
    exit 1
fi
