declare namespace imports.ui.applet {
    // Das hat gefehlt: Die Definition der Klasse im Namespace
    class AppletPopupMenu {
        constructor(launcher: any, orientation: any);
        addActor(actor: any): void;
        toggle(): void;
        connect(signal: string, callback: Function): void;
    }

    // Deine bestehende TextIconApplet Definition
    class TextIconApplet {
	constructor(orientation: any, panel_height: number, instance_id: number);
        set_applet_icon_name(name: string): void;
        set_applet_label(label: string): void;
        set_applet_tooltip(text: string): void;
        menu: AppletPopupMenu; // Damit 'this.menu' bekannt ist
    }
}



declare namespace imports.misc.util {
    function spawnCommandLine(command: string): void;
}

declare namespace imports.gettext {
    function domain(name: string): { gettext: (s: string) => string };
}

declare namespace imports.ui.appletManager {
    const appletMeta: { [key: string]: any };
}

declare namespace imports.misc.fileUtils {
    function requireModule(path: string): any;
}

// Falls noch nicht vorhanden, für den Rest von ui:
declare namespace imports.ui {
    const applet: any;
    const settings: any;
}

// Falls noch nicht vorhanden, für misc:
declare namespace imports.misc {
    const util: any;
}

// 1. Das globale 'imports' Objekt definieren
declare namespace imports {
    export namespace gi {
        const St: any;
        const Clutter: any;
        const Gio: any;
        const Cinnamon: any;
        const GLib: any;
    }
    const signals: any;
    const mainloop = imports.mainloop;

    // Bestehende Definitionen für dein Applet
    export namespace ui {
        const applet: any;
        const appletManager: any;
        const settings: any;
    }
    export namespace misc {
        const util: any;
        const fileUtils: any;
    }
    const gettext: any;
}

// 2. Das Signals-Modul für TypeScript greifbar machen
// Wir definieren einen Namespace, damit 'Signals.Signals' als Typ funktioniert
declare namespace Signals {
    export interface Signals {
        connect(signal: string, callback: Function): number;
        disconnect(id: number): void;
        emit(signal: string, ...args: any[]): void;
    }
    export function addSignalMethods(proto: any): void;
}

// 3. Unterstützung für die klassischen Konstanten (falls benötigt)
declare var global: any;
declare function _(str: string): string;




