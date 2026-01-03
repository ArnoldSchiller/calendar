"use strict";
/**
 * Universal Calendar Applet Core
 * ------------------------------
 * This is the entry point for the Cinnamon Applet. It acts as the Controller
 * in an MVC-like architecture, connecting the Cinnamon Panel with the
 * underlying Logic and UI components.
 * * * ARCHITECTURE OVERVIEW:
 * 1. EventManager: Handles data fetching (ICS/Evolution/System).
 * 2. CalendarLogic: Pure JS logic for date calculations and holiday parsing.
 * 3. CalendarView: The complex St.Table based UI grid.
 * 4. EventListView: Specialized view for displaying event details.
 * * * SYSTEM INTEGRATION:
 * - Uses 'Settings' for user-defined date formats and behavior.
 * - Uses 'AppletPopupMenu' to host the calendar UI.
 * - Uses 'KeybindingManager' for global hotkey support.
 * * @author Arnold Schiller <calendar@projektit.de>
 * @link https://github.com/ArnoldSchiller/calendar
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
const EventManager_1 = require("./EventManager");
const EventListView_1 = require("./EventListView");
const CalendarLogic_1 = require("./CalendarLogic");
/**
* Global Localization helper.
* Initialized in setupLocalization() to support multiple applet instances.
*/
let _;
/**
 * Setup internationalization for the applet.
 * It establishes a priority chain for translations to minimize missing strings:
 * Priority: 1. Applet Context, 2. Cinnamon Core, 3. Gnome Calendar
 */
function setupLocalization(uuid, path) {
    Gettext.bindtextdomain(uuid, path + "/locale");
    _ = function (str) {
        let custom = Gettext.dgettext(uuid, str);
        if (custom !== str)
            return custom;
        let cinnamon = Gettext.dgettext("cinnamon", str);
        if (cinnamon !== str)
            return cinnamon;
        return Gettext.dgettext("gnome-calendar", str);
    };
}
/*========================================================================================
*	MAIN CLASS
*=========================================================================================*/
class UniversalCalendarApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this._updateId = 0;
        // Bound Settings
        this.showIcon = false;
        this.showEvents = true;
        this.showWeekNumbers = false;
        this.useCustomFormat = false;
        this.customFormat = "";
        this.customTooltipFormat = "";
        this.keyOpen = "";
        this.uuid = metadata.uuid;
        setupLocalization(this.uuid, metadata.path);
        try {
            // 1. Backend Initialization
            this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.eventManager = new EventManager_1.EventManager();
            this.eventListView = new EventListView_1.EventListView();
            this.CalendarLogic = new CalendarLogic_1.CalendarLogic(metadata.path);
            // 2. Dynamic Component Loading
            const CalendarModule = FileUtils.requireModule(metadata.path + '/CalendarView');
            // 3. Settings Binding
            this.settings.bind("show-icon", "showIcon", this.on_settings_changed);
            this.settings.bind("show-events", "showEvents", this.on_settings_changed);
            this.settings.bind("show-week-numbers", "showWeekNumbers", this.on_settings_changed);
            this.settings.bind("use-custom-format", "useCustomFormat", this.on_settings_changed);
            this.settings.bind("custom-format", "customFormat", this.on_settings_changed);
            this.settings.bind("custom-tooltip-format", "customTooltipFormat", this.on_settings_changed);
            this.settings.bind("keyOpen", "keyOpen", this.on_hotkey_changed);
            // 4. Popup Menu Construction
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            // --- UI CONSTRUCTION START ---
            // Main Vertical Container
            this._mainBox = new St.BoxLayout({
                vertical: true,
                style_class: 'calendar-main-box'
            });
            /**
             * HEADER SECTION: Created first to be available for the rightColumn.
             *
             * Header Box: Displays current day/date.
             * Acts as a "Home" button to return to today's date in the grid.
             * dayLabel style calendar-today-day-label
             * dateLabel style calendar-today-date-label
             * holidayLabel style calendar-today-holiday
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
            this._holidayLabel = new St.Label({ style_class: 'calendar-today-holiday' });
            headerBox.add_actor(this._dayLabel);
            headerBox.add_actor(this._dateLabel);
            headerBox.add_actor(this._holidayLabel);
            /**
             * CALENDAR GRID: Initialized via the modular CalendarView.
             */
            this.CalendarView = new CalendarModule.CalendarView(this);
            // --- SIGNAL CONNECTION ---
            // We connect the ‘event-clicked’ signal of the list to the calendar.
            // Since we used interface merging in EventListView.ts,
            // TS accepts the call to .connect() here.
            this.eventListView.connect('event-clicked', (actor, ev) => {
                if (ev && ev.start) {
                    // 1. Kalender-Gitter auf den Tag des Events umstellen
                    this.CalendarView.jumpToDate(ev.start);
                    // 2. Den Header (Oben rechts) auf das Datum des Events aktualisieren
                    this.setHeaderDate(ev.start);
                }
            });
            /**
             * FOOTER SECTION: Buttons for system and calendar management.
             */
            let footerBox = new St.BoxLayout({ style_class: 'calendar-footer' });
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
            /**
             * LAYOUT COMPOSITION:
             * Here we nest the elements to preserve the legacy design while
             * preparing for the event list on the left.
             */
            // 1. Create the right-hand column (The "Classic" view)
            let rightColumn = new St.BoxLayout({
                vertical: true,
                style_class: 'calendar-right-column' // Optional for CSS fine-tuning
            });
            rightColumn.add_actor(headerBox);
            rightColumn.add_actor(this.CalendarView.actor);
            rightColumn.add_actor(footerBox);
            // 2. Create the horizontal bridge
            this._contentLayout = new St.BoxLayout({
                vertical: false, // SIDE-BY-SIDE
                style_class: 'calendar-content-layout'
            });
            // 3. Add Left Wing (Events) and Right Column (Calendar)
            this._contentLayout.add_actor(this.eventListView.actor);
            this._contentLayout.add_actor(rightColumn);
            // 4. Final Assembly
            this._mainBox.add_actor(this._contentLayout);
            this.menu.addActor(this._mainBox);
            // --- UI CONSTRUCTION END ---
            this.on_settings_changed();
            this.on_hotkey_changed();
            this.menu.connect("open-state-changed", (menu, isOpen) => {
                if (isOpen) {
                    this.CalendarView.render();
                    this.setHeaderDate(new Date());
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                        this.CalendarView.actor.grab_key_focus();
                        return false;
                    });
                }
            });
            this.update_label_and_tooltip();
            this._updateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
                this.update_label_and_tooltip();
                return true;
            });
        }
        catch (e) {
            global.log(`[${this.uuid}] CRITICAL: Initialization failed: ${e}`);
        }
    }
    /**
      * Unified handler for settings changes.
      * Manages Icon visibility and UI re-rendering.
      */
    on_settings_changed() {
        // Toggle Panel Icon visibility
        if (this.showIcon) {
            this.set_applet_icon_name("office-calendar");
            if (this._applet_icon_box)
                this._applet_icon_box.show();
        }
        else {
            this._hide_icon();
        }
        // Handle Event View Visibility (The left wing)
        if (this.eventListView) {
            if (this.showEvents) {
                this.eventListView.actor.show();
            }
            else {
                this.eventListView.actor.hide();
            }
        }
        this.update_label_and_tooltip();
        // If the menu is open, we need to re-render to reflect format changes
        if (this.menu && this.menu.isOpen) {
            this.CalendarView.render();
        }
    }
    /**
     * Helper to cleanly remove the icon from the panel.
     * Different Cinnamon versions handle empty icons differently; this ensures it's hidden.
     */
    _hide_icon() {
        this.set_applet_icon_name("");
        if (this._applet_icon_box) {
            this._applet_icon_box.hide();
        }
    }
    /**
     * Triggered when user clicks the panel applet.
     */
    on_applet_clicked(event) {
        if (!this.menu.isOpen) {
            this.eventManager.refresh();
        }
        this.menu.toggle();
    }
    /**
     * Updates the global hotkey based on user settings.
     */
    on_hotkey_changed() {
        Main.keybindingManager.removeHotKey(`${this.uuid}-open`);
        if (this.keyOpen) {
            Main.keybindingManager.addHotKey(`${this.uuid}-open`, this.keyOpen, () => {
                this.on_applet_clicked(null);
            });
        }
    }
    /**
      * Core Panel Logic:
      * Sets the text (Clock) displayed on the Cinnamon panel and its tooltip.
      * Supports both system locale and user-defined custom formats.
      */
    update_label_and_tooltip() {
        const now = new Date();
        const gNow = GLib.DateTime.new_now_local();
        let timeLabel = this.useCustomFormat ? gNow.format(this.customFormat) :
            now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let dateTooltip = this.useCustomFormat ? gNow.format(this.customTooltipFormat) :
            now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        this.set_applet_label(timeLabel || "");
        this.set_applet_tooltip(dateTooltip || "");
    }
    /**
    * Updates the UI Header inside the popup menu.
    * Shows Day, Date, and specific holiday descriptions if available.
    */
    setHeaderDate(date) {
        if (!this._dayLabel || !this.CalendarView)
            return;
        const gDate = GLib.DateTime.new_from_unix_local(date.getTime() / 1000);
        this._dayLabel.set_text(gDate.format("%A"));
        this._dateLabel.set_text(gDate.format("%e. %B %Y"));
        const tagInfo = this.CalendarView.getHolidayForDate(date);
        if (tagInfo && tagInfo.beschreibung) {
            this._holidayLabel.set_text(tagInfo.beschreibung);
            this._holidayLabel.show();
        }
        else {
            this._holidayLabel.hide();
        }
    }
    /**
    * Cleanup: Called when applet is removed or Cinnamon restarts.
    * Essential to prevent memory leaks and dangling signals/hotkeys.
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
 * EXPORT FOR CINNAMON
 * We bridge the modular code to Cinnamon's global scope.
 * The 'as any' cast is used to prevent TypeScript compiler errors.
 */
function main(metadata, orientation, panel_height, instance_id) {
    try {
        return new UniversalCalendarApplet(metadata, orientation, panel_height, instance_id);
    }
    catch (e) {
        if (typeof global !== 'undefined') {
            global.log(metadata.uuid + " CRITICAL: Initialization error: " + e);
        }
        return null;
    }
}
if (typeof global !== 'undefined') {
    global.main = main;
    global.main = main;
    if (typeof Applet !== 'undefined') {
        global.Applet = Applet;
        global.Applet = Applet;
    }
}
