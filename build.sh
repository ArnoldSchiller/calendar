#!/bin/bash
set -e

# --- CONFIGURATION ---
UUID="calendar@projektit.de"
MODE=${1:-"prod"}

if [ "$MODE" = "dev" ]; then
    TARGET_UUID="calendar-dev@projektit.de"
    TSCONFIG="tsconfig.dev.json"
    echo "🛠 DEV BUILD INITIATED ($TARGET_UUID)"
else
    TARGET_UUID="$UUID"
    TSCONFIG="tsconfig.prod.json"
    echo "🚀 PRODUCTION BUILD INITIATED ($TARGET_UUID)"
fi

FILES_DIR="./files/$UUID"
LOCAL_APPLET_DIR="$HOME/.local/share/cinnamon/applets/$TARGET_UUID"

# --- 1. CLEANUP ---
echo "🧹 Cleaning previous build artifacts..."
mkdir -p "$FILES_DIR"
# Only remove JS files to preserve assets like JSON/CSS
find "$FILES_DIR" -name "*.js" -type f -delete

# --- 2. COMPILATION ---
echo "⚙️ Compiling TypeScript using $TSCONFIG..."
tsc -p "$TSCONFIG"

# --- 3. METADATA PATCHING (Crucial for Cinnamon) ---
if [ "$MODE" = "dev" ]; then
    echo "📝 Patching metadata.json for development UUID..."
    sed -i "s/\"uuid\": \"$UUID\"/\"uuid\": \"$TARGET_UUID\"/" "$FILES_DIR/metadata.json"
    sed -i "s/\"name\": \"/\"name\": \"(DEV) /" "$FILES_DIR/metadata.json"
fi

# --- 4. PRODUCTION BUNDLE WRAPPING ---
if [ "$MODE" = "prod" ]; then
    echo "🔌 Wrapping applet.js with AMD-loader bridge..."
    TEMP_JS=$(mktemp)
    
    # --- START: Minimal AMD loader ---
    cat > "$TEMP_JS" << 'EOF'
/**
 * MINIMAL AMD LOADER FOR CINNAMON JS ENVIRONMENT
 */
var modules = {};
var define = function(id, deps, factory) {
    var moduleId = id.split('/').pop();
    var resolvedDeps = deps.map(function(dep) {
        var depId = dep.split('/').pop();
        if (depId === 'require') {
            return function(moduleName) {
                return modules[moduleName.split('/').pop()];
            };
        }
        if (depId === 'exports') {
            return (modules[moduleId] = modules[moduleId] || {});
        }
        return modules[depId] || {};
    });
    var moduleExports = factory.apply(null, resolvedDeps);
    if (moduleExports !== undefined) {
        modules[moduleId] = moduleExports;
    }
};
EOF
    # --- END: AMD loader ---
    
    # Append the TypeScript-generated AMD bundle
    cat "$FILES_DIR/applet.js" >> "$TEMP_JS"
    
    # --- CRITICAL FIX: Add global exports for all modules ---
    # This ensures that modules are available globally, not just in AMD context
    cat >> "$TEMP_JS" << 'EOF'

/**
 * GLOBAL EXPORTS FOR CINNAMON ENVIRONMENT
 * ---------------------------------------
 * In production mode, we need to export all modules globally so that
 * applet.ts can find them via global.CalendarView, global.CalendarLogic, etc.
 * This is the counterpart to the hybrid export pattern in the source TypeScript.
 */

// Wait for all modules to be loaded, then export them globally
if (typeof global !== 'undefined') {
    // Export CalendarLogic
    if (modules['CalendarLogic'] && modules['CalendarLogic'].CalendarLogic) {
        global.CalendarLogic = modules['CalendarLogic'].CalendarLogic;
    }
    
    // Export CalendarView  
    if (modules['CalendarView'] && modules['CalendarView'].CalendarView) {
        global.CalendarView = modules['CalendarView'].CalendarView;
    }
    
    // Export EventListView
    if (modules['EventListView'] && modules['EventListView'].EventListView) {
        global.EventListView = modules['EventListView'].EventListView;
    }
    
    // Export EventManager
    if (modules['EventManager'] && modules['EventManager'].EventManager) {
        global.EventManager = modules['EventManager'].EventManager;
    }
    
    // Also make sure the main applet module is globally accessible
    if (modules['applet'] && modules['applet'].main) {
        global.main = modules['applet'].main;
    }
}
EOF
    
    # --- START: Cinnamon entry point wrapper ---
    cat >> "$TEMP_JS" << 'EOF'

/**
 * CINNAMON ENTRY POINT
 * --------------------
 * This function is called by Cinnamon when loading the applet.
 * IMPORTANT: This must be a global function named 'main'.
 */
function main(metadata, orientation, panel_height, instance_id) {
    // Strategy 1: Use the AMD module if available
    if (modules['applet'] && modules['applet'].main) {
        return modules['applet'].main(metadata, orientation, panel_height, instance_id);
    }
    
    // Strategy 2: Use the global main function (set by applet.ts)
    if (typeof global !== 'undefined' && global.main) {
        return global.main(metadata, orientation, panel_height, instance_id);
    }
    
    // Strategy 3: Last resort - create a basic applet
    if (typeof Applet !== 'undefined') {
        global.logError('[Calendar] Falling back to basic Applet instance');
        return new Applet.TextIconApplet(orientation, panel_height, instance_id);
    }
    
    throw new Error('Calendar applet initialization failed: Could not find main function.');
}
EOF
    # --- END: Cinnamon entry point ---
    
    # Replace the original applet.js with our wrapped version
    mv "$TEMP_JS" "$FILES_DIR/applet.js"
    
    echo "✅ Production bundle wrapped successfully"
    echo "   - Added AMD loader for TypeScript modules"
    echo "   - Added global exports for Cinnamon environment"
    echo "   - Added Cinnamon-compatible main() entry point"
fi

# --- 5. CREATE STUB MODULE FILES FOR PRODUCTION ---
# Since applet.ts tries to load CalendarView.js separately,
# we need to create stub files that re-export from the global scope
if [ "$MODE" = "prod" ]; then
    echo "📁 Creating stub module files for production compatibility..."
    
    # Create CalendarView.js stub
    cat > "$FILES_DIR/CalendarView.js" << 'EOF'
// Production stub - CalendarView is bundled in applet.js
if (typeof global !== 'undefined' && global.CalendarView) {
    module.exports = { CalendarView: global.CalendarView };
} else {
    throw new Error('CalendarView not available in production bundle');
}
EOF
    
    # Also create stubs for other modules that might be loaded
    cat > "$FILES_DIR/CalendarLogic.js" << 'EOF'
// Production stub - CalendarLogic is bundled in applet.js
if (typeof global !== 'undefined' && global.CalendarLogic) {
    module.exports = { CalendarLogic: global.CalendarLogic };
} else {
    throw new Error('CalendarLogic not available in production bundle');
}
EOF
    
    echo "   - Created stub files for module compatibility"
fi

# --- 6. DEPLOYMENT ---
echo "🚚 Syncing files to Cinnamon applets directory..."
mkdir -p "$LOCAL_APPLET_DIR"
rsync -av --delete "$FILES_DIR/" "$LOCAL_APPLET_DIR/"

# --- 7. CLEANUP SOURCE (Development only) ---
if [ "$MODE" = "dev" ]; then
    echo "🔄 Restoring original metadata.json in source folder..."
    sed -i "s/\"uuid\": \"$TARGET_UUID\"/\"uuid\": \"$UUID\"/" "$FILES_DIR/metadata.json"
    sed -i "s/\"name\": \"(DEV) /\"name\": \"/" "$FILES_DIR/metadata.json"
fi

echo "✅ Build successful ($MODE)"
echo "🔄 Instruction: Reload the applet via Cinnamon settings or Alt+F2 -> 'r'."
