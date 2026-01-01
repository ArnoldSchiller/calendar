#!/bin/bash
set -e

# --- KONFIGURATION ---
SPICES_FORK_DIR="../cinnamon-spices-applets"
UUID="calendar@projektit.de"
TARGET_DIR="$SPICES_FORK_DIR/$UUID"
CINNAMON_VER="5.4" # Dein primärer Ziel-Slot

echo "🔄 Zukunfts-Modus: Baue Profi-Struktur für Spices..."

# 1. Validierung
if [ ! -d "$SPICES_FORK_DIR" ]; then
    echo "❌ Fehler: Spices-Fork nicht gefunden unter $SPICES_FORK_DIR"
    exit 1
fi

# 2. Build ausführen
./build.sh prod

# 3. Struktur im Fork komplett neu aufbauen
echo "🧹 Bereite Fork-Verzeichnis vor..."
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR/$CINNAMON_VER"
mkdir -p "$TARGET_DIR/po"

# 4. Dateien verteilen
echo "🚚 Kopiere Dateien in die Spices-Struktur..."

# Produktions-Files in den Versions-Slot (ohne die Root-Metadaten)
rsync -av --exclude='metadata.json' "./files/$UUID/" "$TARGET_DIR/$CINNAMON_VER/"

# Metadaten ins Hauptverzeichnis (Pflicht für Spices)
cp "./files/$UUID/metadata.json" "$TARGET_DIR/"

# TypeScript Quellen für den Review (immer mit in den Version-Slot)
mkdir -p "$TARGET_DIR/$CINNAMON_VER/src"
cp -r ./src/*.ts "$TARGET_DIR/$CINNAMON_VER/src/"

# 5. Global Assets & Doku
echo "📝 Synchronisiere Dokumentation und Bilder..."
cp README.md CHANGELOG.md "$TARGET_DIR/" 2>/dev/null || true
[ -f "./icon.png" ] && cp "./icon.png" "$TARGET_DIR/"
[ -f "./screenshot.png" ] && cp "./screenshot.png" "$TARGET_DIR/"

# 6. Übersetzungs-Template (POT)
echo "🌍 Erzeuge Übersetzungsvorlage..."
xgettext --from-code=UTF-8 --keyword=_ --language=JavaScript --output="$TARGET_DIR/po/$UUID.pot" src/*.ts

echo ""
echo "✅ Fertig! Struktur für $UUID ist bereit."
ls -F "$TARGET_DIR"
