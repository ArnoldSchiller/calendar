/**
 * Universal Calendar Applet Core
 * ------------------------------
 * This is the entry point for the Cinnamon Applet. It acts as the "Controller" 
 * in an MVC-like architecture, connecting the Cinnamon Panel with the 
 * underlying Logic and UI components.
 * * ARCHITECTURE OVERVIEW:
 * 1. EventManager: Handles data fetching (ICS/Evolution/System).
 * 2. CalenderLogic: Pure JS logic for date calculations and holidays.
 * 3. CalendarView: The complex St.Table based UI grid.
 * 4. EventListView: Specialized view for displaying event details.
 * * SYSTEM INTEGRATION:
 * - Uses 'Settings' for user-defined date formats and behavior.
 * - Uses 'AppletPopupMenu' to host the calendar UI.
 * - Uses 'KeybindingManager' for global hotkey support.
 * * @author Arnold Schiller <calendar@projektit.de>
 * @link https://github.com/ArnoldSchiller/calendar
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */

/* === GJS / Cinnamon Imports === */
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;
const FileUtils = imports.misc.fileUtils;
const Gettext = imports.gettext;

/* === Module Imports === */
// These are bundled via tsc --outFile or loaded via FileUtils.requireModule
import { EventManager } from './EventManager';
import { EventListView } from './EventListView';
import { CalendarLogic } from './CalendarLogic';

/**
 * Global Localization helper.
 * Initialized in setupLocalization() to support multiple applet instances.
 */
let _: (str: string) => string;

function setupLocalization(uuid: string, path: string) {
    Gettext.bindtextdomain(uuid, path + "/locale");
    _ = function(str: string) {
        // Priority: 1. Applet Context, 2. Cinnamon Core, 3. Gnome Calendar fallback
        let custom = Gettext.dgettext(uuid, str);
        if (custom !== str) return custom;
        let cinnamon = Gettext.dgettext("cinnamon", str);
        if (cinnamon !== str) return cinnamon;
        return Gettext.dgettext("gnome-calendar", str);
    };
}

class UniversalCalendarApplet extends Applet.TextIconApplet {
    public CalendarView: any;
    public eventManager: EventManager;
    public eventListView: EventListView;
    public CalendarLogic: CalendarLogic;
    declare public menu: any;

    private menuManager: any;
    private settings: any;
    private _updateId: number = 0;
    private uuid: string;

    // UI Elements (Header Section)
    private _mainBox: any;
    private _dayLabel: any;
    private _dateLabel: any;
    private _holidayLabel: any;

    // Bound Settings (reflects values from settings-schema.json)
    public showEvents: boolean = true;
    public showWeekNumbers: boolean = false;
    public useCustomFormat: boolean = false;
    public customFormat: string = "";
    public customTooltipFormat: string = "";
    public keyOpen: string = "";

    constructor(metadata: any, orientation: any, panel_height: number, instance_id: number) {
        super(orientation, panel_height, instance_id);
        this.uuid = metadata.uuid;
        setupLocalization(this.uuid, metadata.path);

        try {
            // 1. Backend Initialization
            this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            
            this.eventManager = new EventManager();
            this.eventListView = new EventListView();

	    // CalendarLogic Instanz 
            // metadata.path for /holidays/*.json 
            this.CalendarLogic = new CalendarLogic(metadata.path);

            // 2. Dynamic Component Loading
            // We use requireModule for the View to allow for easier modular updates
            const CalendarModule = FileUtils.requireModule(metadata.path + "/CalendarView.js");
             
            // 3. Settings Binding
            this.settings.bind("show-events", "showEvents", this.on_settings_changed.bind(this));
            this.settings.bind("show-week-numbers", "showWeekNumbers", this.on_settings_changed.bind(this));
            this.settings.bind("use-custom-format", "useCustomFormat", this.on_settings_changed.bind(this));
            this.settings.bind("custom-format", "customFormat", this.on_settings_changed.bind(this));
            this.settings.bind("custom-tooltip-format", "customTooltipFormat", this.on_settings_changed.bind(this));
            this.settings.bind("keyOpen", "keyOpen", this.on_hotkey_changed.bind(this));

            this.set_applet_icon_name("office-calendar");

            // 4. UI Construction
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Main container with vertical layout
            this._mainBox = new St.BoxLayout({ 
                vertical: true, 
                style_class: 'calendar-main-box'
            });
            
            /**
             * Header Box: Displays current day/date.
             * Acts as a "Home" button to return to today's date in the calendar view.
             */
            let headerBox = new St.BoxLayout({ 
                vertical: true, 
                style_class: 'calendar-today-home-button', 
                reactive: true 
            });
            
            headerBox.connect("button-release-event", () => {
                this.CalendarView.resetToToday();
                this.setHeaderDate(new Date());
            });

            this._dayLabel = new St.Label({ style_class: 'calendar-today-day-label' });
            this._dateLabel = new St.Label({ style_class: 'calendar-today-date-label' });
            this._holidayLabel = new St.Label({ style_class: 'calendar-holiday-label', text: "" });

            headerBox.add_actor(this._dayLabel);
            headerBox.add_actor(this._dateLabel);
            headerBox.add_actor(this._holidayLabel);
            this._mainBox.add_actor(headerBox);

            // 5. Calendar View Initialization
            this.CalendarView = new CalendarModule.CalendarView(this);
            this._mainBox.add_actor(this.CalendarView.actor);

            /**
             * Footer Section:
             * Provides quick access to system-wide date settings and external calendar apps.
             */
            let footerBox = new St.BoxLayout({ style_class: 'calendar-footer', vertical: false });
            
            let settingsBtn = new St.Button({ 
                label: _("Date and Time Settings"), 
                style_class: 'calendar-footer-button', 
                x_expand: true 
            });
            settingsBtn.connect("clicked", () => {
                this.menu.close();
                Util.spawnCommandLine("cinnamon-settings calendar");
            });

            let calendarBtn = new St.Button({ 
                label: _("Manage Calendars"), 
                style_class: 'calendar-footer-button', 
                x_expand: true 
            });
            calendarBtn.connect("clicked", () => {
                this.menu.close();
                Util.spawnCommandLine("gnome-calendar");
            });

            footerBox.add_actor(settingsBtn);
            footerBox.add_actor(calendarBtn);
            this._mainBox.add_actor(footerBox);

            this.menu.addActor(this._mainBox);

            // 6. Signal Handling & Lifecycle
            this.on_hotkey_changed();

            this.menu.connect("open-state-changed", (menu: any, isOpen: boolean) => {
                if (isOpen) {
                    this.CalendarView.render();
                    this.setHeaderDate(new Date());
                    // Focus handling for keyboard navigation
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                        this.CalendarView.actor.grab_key_focus();
                        return false;
                    });
                }
            });

            // Refresh the panel label periodically (every 10 seconds)
            this.update_label_and_tooltip();
            this._updateId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
                this.update_label_and_tooltip();
                return true;
            });

        } catch (e) {
            global.log(`[${this.uuid}] CRITICAL: Initialization failed: ${e}`);
        }
    }

    /**
     * Triggered when user clicks the panel icon.
     */
    on_applet_clicked(event: any): void {
        if (!this.menu.isOpen) {
            this.eventManager.refresh(); // Sync latest events before opening
        }
        this.menu.toggle();
    }

    /**
     * Updates the global hotkey based on settings.
     */
    on_hotkey_changed() {
        Main.keybindingManager.removeHotKey(`${this.uuid}-open`);
        if (this.keyOpen) {
            Main.keybindingManager.addHotKey(`${this.uuid}-open`, this.keyOpen, () => {
                this.on_applet_clicked(null);
            });
        }
    }

    on_settings_changed() {
        this.update_label_and_tooltip();
        if (this.menu.isOpen) {
            this.CalendarView.render();
        }
    }

    /**
     * Core Panel Logic:
     * Sets the text displayed on the Cinnamon panel and its tooltip.
     */
    update_label_and_tooltip() {
        const now = new Date();
        const gNow = GLib.DateTime.new_now_local();
        
        let timeLabel = this.useCustomFormat ? gNow.format(this.customFormat) : 
                        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let dateTooltip = this.useCustomFormat ? gNow.format(this.customTooltipFormat) : 
                          now.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

        this.set_applet_label(timeLabel || "");
        this.set_applet_tooltip(dateTooltip || "");
    }

    /**
     * Updates the UI Header inside the popup.
     * Shows Day, Date, and specific holiday descriptions if available.
     */
    public setHeaderDate(date: Date) {
        if (!this._dayLabel) return;
        const gDate = GLib.DateTime.new_from_unix_local(date.getTime() / 1000);
        
        this._dayLabel.set_text(gDate.format("%A"));
        this._dateLabel.set_text(gDate.format("%e. %B %Y"));

        // Ask the view's data provider for holiday info
        const tagInfo = this.CalendarView.getHolidayForDate(date);
        if (tagInfo && tagInfo.beschreibung) {
            this._holidayLabel.set_text(tagInfo.beschreibung);
            this._holidayLabel.show();
        } else {
            this._holidayLabel.hide();
        }
    }

    /**
     * Cleanup: Called when applet is removed or Cinnamon restarts.
     */
    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey(`${this.uuid}-open`);
        if (this._updateId > 0) {
            GLib.source_remove(this._updateId);
        }
        this.menu.destroy();
    }
}

/**
 * CINNAMON ENTRY POINT
 * --------------------
 * This function is the primary entry point called by the Cinnamon shell.
 * * IMPORTANT FOR PRODUCTION:
 * Since we use AMD bundling, we assign the main function to the global scope
 * from WITHIN the module to ensure the class is fully defined when called.
 */
function main(metadata: any, orientation: any, panel_height: number, instance_id: number) {
    try {
        // Since we are inside the 'applet' module scope here, 
        // we can instantiate the class directly.
        return new UniversalCalendarApplet(metadata, orientation, panel_height, instance_id);
    } catch (e) {
        if (typeof global !== 'undefined') {
            global.log(metadata.uuid + "CRITICAL: Initialization failed: " + e);
        }
        return null;
    }
}

/**
 * EXPORT FOR CINNAMON
 * We bridge the modular code to Cinnamon's global requirement.
 */
// Export Prod global
if (typeof global !== 'undefined') {
    // for generated applet.js 
    global.main = main;

    // Ensure that the applet is available 
    if (typeof Applet !== 'undefined') {
        global.Applet = Applet;
    }
}
(global as any).main = main;





