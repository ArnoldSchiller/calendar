#!/usr/bin/env python3
"""
Safe script to add JSDoc-style Doxygen tags to TypeScript files
"""

import os
import re
from pathlib import Path

# Safe JSDoc-style tags (no backslashes)
HEADER_TEMPLATES = {
    "applet.ts": """/**
 * @file applet.ts
 * @brief Main entry point for the Cinnamon Calendar Applet
 * 
 * @details This file implements the UniversalCalendarApplet class which acts as the 
 * central controller in the MVC architecture. It orchestrates all components and 
 * manages the complete UI lifecycle.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 * 
 * @see CalendarView
 * @see EventManager
 * @see CalendarLogic
 * @see EventListView
 */""",

    "CalendarView.ts": """/**
 * @file CalendarView.ts
 * @brief Main calendar UI component
 * 
 * @details Implements the visual calendar grid with month/year/day views.
 * Uses Cinnamon's St toolkit for rendering and Clutter for input handling.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 */""",

    "EventManager.ts": """/**
 * @file EventManager.ts
 * @brief Core data management layer for calendar events
 * 
 * @details Handles all calendar event operations including synchronization
 * with Evolution Data Server, ICS import, and event caching.
 * 
 * @warning This component works around several Cinnamon/GJS limitations
 * including read-only CalendarServer and complex EDS write operations.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 */""",

    "CalendarLogic.ts": """/**
 * @file CalendarLogic.ts
 * @brief Business logic for holiday and date calculations
 * 
 * @details Pure logic component for date mathematics and holiday detection
 * with regional rules. No UI dependencies, no I/O operations.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 */""",

    "EventListView.ts": """/**
 * @file EventListView.ts
 * @brief Event sidebar UI component
 * 
 * @details Displays events in list format with scrollable container
 * and navigation support. Acts as the left column in the two-column layout.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 */"""
}

def has_existing_header(content):
    """Check if file already has a file-level header"""
    lines = content.split('\n')
    in_comment = False
    for line in lines:
        if line.strip().startswith('/**'):
            in_comment = True
        if in_comment and line.strip().startswith('*/'):
            return True
        if in_comment and ('@file' in line or '\\file' in line):
            return True
    return False

def add_safe_header(filepath, template):
    """Add safe JSDoc header without breaking TypeScript"""
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Skip if already has header
    if has_existing_header(content):
        print(f"✓ {filepath.name}: Already has header")
        return
    
    # Add template at the beginning
    new_content = template + '\n\n' + content
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✓ {filepath.name}: Added safe JSDoc header")

def main():
    print("Adding safe JSDoc headers to TypeScript files")
    print("=" * 50)
    
    for filename, template in HEADER_TEMPLATES.items():
        filepath = Path(filename)
        if filepath.exists():
            print(f"\nProcessing: {filename}")
            add_safe_header(filepath, template)
        else:
            print(f"\n⚠️  Not found: {filename}")
    
    print("\n" + "=" * 50)
    print("✅ Done! All files updated with safe JSDoc headers.")
    print("These headers are TypeScript-compatible and Doxygen-friendly.")

if __name__ == "__main__":
    main()