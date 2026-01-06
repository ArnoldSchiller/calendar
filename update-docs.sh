#!/bin/bash
# update-docs.sh - Update Doxygen documentation

echo "🔧 Updating Project IT Calendar documentation..."

# Check if Doxygen is installed
if ! command -v doxygen &> /dev/null; then
    echo "❌ Doxygen not found. Please install:"
    echo "   sudo apt install doxygen graphviz"
    exit 1
fi

# Generate documentation
echo "📚 Generating Doxygen documentation..."
doxygen Doxyfile 2>&1 | grep -E "(Generating|warning:|error:)" || true

# Check if generation was successful
if [ -f "docs/html/index.html" ]; then
    echo "✅ Documentation generated successfully"
    echo "📁 Location: docs/html/index.html"
    
    # Count generated files
    file_count=$(find docs/html -type f -name "*.html" | wc -l)
    echo "📄 Generated $file_count HTML files"
    
    # Check for warnings
    if doxygen Doxyfile 2>&1 | grep -q "warning:"; then
        echo "⚠️  Warnings detected, check output above"
    fi
else
    echo "❌ Documentation generation failed"
    exit 1
fi

echo ""
echo "🌐 To view locally:"
echo "   cd docs/html && python3 -m http.server 8000"
echo "   Then open: http://localhost:8000"
echo ""
echo "📤 To deploy to GitHub Pages:"
echo "   git add docs/ && git commit -m 'Update documentation' && git push"
