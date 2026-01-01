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
# Cinnamon rejects applets if the UUID in metadata.json doesn't match the folder name
if [ "$MODE" = "dev" ]; then
    echo "📝 Patching metadata.json for development UUID..."
    sed -i "s/\"uuid\": \"$UUID\"/\"uuid\": \"$TARGET_UUID\"/" "$FILES_DIR/metadata.json"
    sed -i "s/\"name\": \"/\"name\": \"(DEV) /" "$FILES_DIR/metadata.json"
fi

# --- 4. PRODUCTION BUNDLE WRAPPING ---
# GJS/Cinnamon doesn't support AMD modules natively. 
# We wrap the output and expose the 'main' function.
if [ "$MODE" = "prod" ]; then
    echo "🔌 Wrapping applet.js with AMD-loader bridge..."
    TEMP_JS=$(mktemp)
    
    # Injecting a minimal AMD loader
    echo "var modules = {}; 
    var define = function(id, deps, factory) { 
        modules[id.split('/').pop()] = factory.apply(null, deps.map(d => modules[d.split('/').pop()])); 
    };" > "$TEMP_JS"
    
    cat "$FILES_DIR/applet.js" >> "$TEMP_JS"
    
    # Exposing the main entry point to Cinnamon's global scope
    echo "function main(metadata, orientation, panel_height, instance_id) {
        var appletModule = modules['applet'];
        if (appletModule && appletModule.UniversalCalendarApplet) {
            return new appletModule.UniversalCalendarApplet(metadata, orientation, panel_height, instance_id);
        }
        throw new Error('Could not find UniversalCalendarApplet in module bundle.');
    }" >> "$TEMP_JS"
    
    mv "$TEMP_JS" "$FILES_DIR/applet.js"
fi

# --- 5. DEPLOYMENT ---
echo "🚚 Syncing files to Cinnamon applets directory..."
mkdir -p "$LOCAL_APPLET_DIR"
# Use rsync to ensure the target folder perfectly mirrors the build output
rsync -av --delete "$FILES_DIR/" "$LOCAL_APPLET_DIR/"

# --- 6. CLEANUP SOURCE ---
# Reverting metadata changes in the source folder to keep git history clean
if [ "$MODE" = "dev" ]; then
    sed -i "s/\"uuid\": \"$TARGET_UUID\"/\"uuid\": \"$UUID\"/" "$FILES_DIR/metadata.json"
    sed -i "s/\"name\": \"(DEV) /\"name\": \"/" "$FILES_DIR/metadata.json"
fi

echo "✅ Build successful ($MODE)"
echo "🔄 Instruction: Reload the applet via Cinnamon settings or Alt+F2 -> 'r'."
