#!/usr/bin/env python3
"""
Script zum Hinzufügen von Doxygen-Tags zu TypeScript-Dateien
"""

import os
import re
from pathlib import Path

# Doxygen-Templates für verschiedene Dateitypen
TEMPLATES = {
    "applet.ts": {
        "file": "applet.ts",
        "brief": "Main entry point for the Cinnamon Calendar Applet",
        "details": "This file implements the UniversalCalendarApplet class which acts as the central controller in the MVC architecture.",
        "class": "UniversalCalendarApplet"
    },
    "CalendarView.ts": {
        "file": "CalendarView.ts",
        "brief": "Main calendar UI component",
        "details": "Implements the visual calendar grid with month/year/day views using Cinnamon's St toolkit.",
        "class": "CalendarView"
    },
    "EventManager.ts": {
        "file": "EventManager.ts",
        "brief": "Core data management layer for calendar events",
        "details": "Handles all calendar event operations including synchronization with Evolution Data Server.",
        "class": "EventManager"
    },
    "CalendarLogic.ts": {
        "file": "CalendarLogic.ts",
        "brief": "Business logic for holiday and date calculations",
        "details": "Pure logic component for date mathematics and holiday detection with regional rules.",
        "class": "CalendarLogic"
    },
    "EventListView.ts": {
        "file": "EventListView.ts",
        "brief": "Event sidebar UI component",
        "details": "Displays events in list format with scrollable container and navigation support.",
        "class": "EventListView"
    }
}

def add_doxygen_header(filepath, template):
    """Fügt Doxygen-Header zu einer Datei hinzu"""
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Prüfe ob schon Doxygen-Header existiert
    if r'\file' in content:
        print(f"✓ {filepath.name}: Doxygen-Header bereits vorhanden")
        return
    
    # Erstelle Doxygen-Header
    doxygen_header = f'''/**
 * \\file {template['file']}
 * \\brief {template['brief']}
 * 
 * \\details {template['details']}
 * 
 * \\author Arnold Schiller <calendar@projektit.de>
 * \\date 2023-2026
 * \\copyright GPL-3.0-or-later
 */
'''
    
    # Füge Header nach existierendem Kommentar hinzu oder am Anfang
    lines = content.split('\n')
    new_lines = []
    header_added = False
    
    for line in lines:
        if not header_added and line.strip().startswith('/**') and 'class' not in line:
            # Füge Doxygen-Header nach existierendem File-Kommentar hinzu
            new_lines.append(line)
            new_lines.append(doxygen_header)
            header_added = True
        else:
            new_lines.append(line)
    
    if not header_added:
        # Füge Header am Anfang hinzu
        new_content = doxygen_header + '\n' + content
    else:
        new_content = '\n'.join(new_lines)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✓ {filepath.name}: Doxygen-Header hinzugefügt")

def add_class_doxygen(filepath, class_name):
    """Fügt Doxygen-Kommentar zur Klasse hinzu"""
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Suche nach Klassendefinition
    pattern = rf'export\s+class\s+{class_name}'
    match = re.search(pattern, content)
    
    if not match:
        print(f"⚠️  {filepath.name}: Klasse {class_name} nicht gefunden")
        return
    
    # Prüfe ob schon Doxygen-Kommentar existiert
    start_pos = match.start()
    # Gehe zurück um nach Kommentar zu suchen
    prev_lines = content[:start_pos].split('\n')[-5:]
    if any(r'\class' in line for line in prev_lines):
        print(f"✓ {filepath.name}: Doxygen-Klassenkommentar bereits vorhanden")
        return
    
    # Klassenkommentar erstellen
    class_comment = f'''
/**
 * \\class {class_name}
 * \\brief Main {class_name.lower().replace('view', ' view').replace('manager', ' manager')} class
 * 
 * \\details For detailed documentation see the main class documentation.
 */
'''
    
    # Kommentar vor der Klasse einfügen
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if re.search(rf'export\s+class\s+{class_name}', line):
            # Füge Kommentar vor dieser Zeile ein
            lines.insert(i, class_comment.strip())
            break
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"✓ {filepath.name}: Doxygen-Klassenkommentar hinzugefügt")

def process_directory(directory):
    """Verarbeitet alle TypeScript-Dateien im Verzeichnis"""
    
    ts_files = list(Path(directory).glob('*.ts'))
    
    for ts_file in ts_files:
        filename = ts_file.name
        
        if filename in TEMPLATES:
            print(f"\nVerarbeite: {filename}")
            template = TEMPLATES[filename]
            
            # Füge File-Header hinzu
            add_doxygen_header(ts_file, template)
            
            # Füge Klassenkommentar hinzu
            add_class_doxygen(ts_file, template['class'])

if __name__ == "__main__":
    print("Doxygen-Tag-Ergänzung für Project IT Calendar")
    print("=" * 50)
    
    # Aktuelles Verzeichnis oder spezifiziertes Verzeichnis
    directory = input("Verzeichnis (Enter für aktuelles): ").strip()
    if not directory:
        directory = "."
    
    if not os.path.exists(directory):
        print(f"❌ Verzeichnis existiert nicht: {directory}")
        exit(1)
    
    process_directory(directory)
    
    print("\n" + "=" * 50)
    print("✅ Fertig! Doxygen-Kommentare wurden hinzugefügt.")
    print("Führe 'doxygen Doxyfile' aus, um die Dokumentation zu generieren.")
