#!/bin/bash
# Fix Doxygen backslash comments for TypeScript compilation

echo "🔧 Fixing Doxygen comments in TypeScript files..."

# Liste aller TypeScript Dateien
TS_FILES=$(find . -name "*.ts" -type f ! -path "./node_modules/*" ! -path "./dist/*")

for file in $TS_FILES; do
    echo "Processing: $file"
    
    # Temporäre Datei erstellen
    tmp_file="${file}.tmp"
    
    # Backslashes in Kommentaren entfernen oder durch @ ersetzen
    sed -E '
        # In Kommentar-Blöcken
        /\/\*\*/,/\*\// {
            # \\file -> @file
            s/\\file /@file /
            # \\brief -> @brief  
            s/\\brief /@brief /
            # \\details -> @details
            s/\\details /@details /
            # \\author -> @author
            s/\\author /@author /
            # \\date -> @date
            s/\\date /@date /
            # \\copyright -> @copyright
            s/\\copyright /@copyright /
            # \\see -> @see
            s/\\see /@see /
            # \\note -> @note
            s/\\note /@note /
            # \\warning -> @warning
            s/\\warning /@warning /
            # \\bug -> @bug
            s/\\bug /@bug /
            # \\deprecated -> @deprecated
            s/\\deprecated /@deprecated /
            # \\todo -> @todo
            s/\\todo /@todo /
            # \\class -> @class
            s/\\class /@class /
            # \\extends -> @extends
            s/\\extends /@extends /
            # \\implements -> @implements
            s/\\implements /@implements /
            # \\fn -> @fn
            s/\\fn /@fn /
            # \\param -> @param
            s/\\param /@param /
            # \\return -> @return
            s/\\return /@return /
            # \\throws -> @throws
            s/\\throws /@throws /
            # \\enum -> @enum
            s/\\enum /@enum /
            # \\var -> @var
            s/\\var /@var /
            # \\typedef -> @typedef
            s/\\typedef /@typedef /
            # \\defgroup -> @defgroup
            s/\\defgroup /@defgroup /
            # \\ingroup -> @ingroup
            s/\\ingroup /@ingroup /
            # \\addtogroup -> @addtogroup
            s/\\addtogroup /@addtogroup /
            # \\section -> @section
            s/\\section /@section /
            # \\subsection -> @subsection
            s/\\subsection /@subsection /
            # \\page -> @page
            s/\\page /@page /
            # \\ref -> @ref
            s/\\ref /@ref /
            # \\code -> @code
            s/\\code /@code /
            # \\endcode -> @endcode
            s/\\endcode /@endcode /
            # Einzelne Backslashes entfernen (die nicht Teil von Tags sind)
            s/\\//g
        }
    ' "$file" > "$tmp_file"
    
    # Prüfe ob Änderungen gemacht wurden
    if ! diff -q "$file" "$tmp_file" > /dev/null; then
        mv "$tmp_file" "$file"
        echo "  ✅ Fixed: $file"
    else
        rm "$tmp_file"
        echo "  ✓ Already OK: $file"
    fi
done

echo ""
echo "✅ All TypeScript files fixed for Doxygen compatibility"
echo "📝 TypeScript compilation should now work correctly"