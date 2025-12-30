const UUID = "calendar@projektit.de";
const GLib = (imports as any).gi.GLib;
const St = (imports as any).gi.St;
const Settings = (imports as any).ui.settings;
const PopupMenu = (imports as any).ui.popupMenu;
const Applet = (imports as any).ui.applet;
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
const Gettext = (imports as any).gettext;
const Lang = (imports as any).lang;
const Main = (imports as any).ui.main;
const Clutter = (imports as any).gi.Clutter;
const Util = (imports as any).misc.util;
const CalendarModule = imports.misc.fileUtils.requireModule(AppletDir + '/calendarView.js');
/*=== Anbindung zum EventManager === */
// import { EventManager } from './EventManager';
// import { EventListView } from './EventListView';

/*======== Locale Helper ======*/
Gettext.bindtextdomain(UUID, AppletDir + "/locale");

function _(str: string) {
    let custom = Gettext.dgettext(UUID, str);
    if (custom !== str) return custom;
    let cinnamon = Gettext.dgettext("cinnamon", str);
    if (cinnamon !== str) return cinnamon;
    return Gettext.dgettext("gnome-calendar", str);
}

class CalendarApplet extends Applet.TextIconApplet {
    calendarView: any;
    menu: any;
    menuManager: any;
    settings: any;
    _updateId: number = 0;
    
    // UI Elemente
    private _mainBox: any;
    private _dayLabel: any;
    private _dateLabel: any;
    private _holidayLabel: any;
    private _selectedDate: Date | null = null;
    private _isUserSelectedDate: boolean = false;
    
    // Settings
    showEvents: boolean = true;
    showWeekNumbers: boolean = false;
    useCustomFormat: boolean = false;
    customFormat: string = "";
    customTooltipFormat: string = "";
    keyOpen: string = "";

    constructor(metadata: any, orientation: any, panel_height: number, instance_id: number) {
        super(orientation, panel_height, instance_id);

        try {
            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.eventManager = new EventManager();
	    this.eventListView = new EventListView();
            // Settings binden
            this.settings.bind("show-events", "showEvents", this.on_settings_changed.bind(this));
            this.settings.bind("show-week-numbers", "showWeekNumbers", this.on_settings_changed.bind(this));
            this.settings.bind("use-custom-format", "useCustomFormat", this.on_settings_changed.bind(this));
            this.settings.bind("custom-format", "customFormat", this.on_settings_changed.bind(this));
            this.settings.bind("custom-tooltip-format", "customTooltipFormat", this.on_settings_changed.bind(this));
            this.settings.bind("keyOpen", "keyOpen", this.on_hotkey_changed.bind(this));

            this.set_applet_icon_name("office-calendar");

            // Menü Initialisierung
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Haupt-Container bauen (Original "calbox" Logik)
            this._mainBox = new St.BoxLayout({ 
			vertical: true, 
			style_class: 'calendar-main-box',
			important: true 
		});
            
            // 1. Header (Tag & Datum wie im Original)
            let headerBox = new St.BoxLayout({ 
                vertical: true, 
                style_class: 'calendar-today-home-button', 
                reactive: true 
            });
       
            headerBox.connect("button-release-event", () => {
                 const heute = new Date();
   		 this.calendarView.resetToToday();
                 this.setHeaderDate(heute);        // Setzt die Labels oben zurück
	    });

            this._dayLabel = new St.Label({ style_class: 'calendar-today-day-label' });
            this._dateLabel = new St.Label({ style_class: 'calendar-today-date-label' });
            this._holidayLabel = new St.Label({ style_class: 'calendar-holiday-label', text: "" });

            headerBox.add_actor(this._dayLabel);
            headerBox.add_actor(this._dateLabel);
            headerBox.add_actor(this._holidayLabel);
            this._mainBox.add_actor(headerBox);

            // 2. Kalender-Gitter (Deine View)
            this.calendarView = new CalendarModule.CalendarView(this);
            this._mainBox.add_actor(this.calendarView.actor);

            // 3. Footer mit Buttons
            let footerBox = new St.BoxLayout({ style_class: 'calendar-footer', vertical: false });

            let settingsBtn = new St.Button({ 
                label: _("Date and Time Settings"), 
                style_class: 'calendar-footer-button',
                can_focus: true,
                x_expand: true
            });
            settingsBtn.connect("clicked", () => {
                this.menu.close();    
                Util.spawnCommandLine("cinnamon-settings calendar");
            });

            let calendarBtn = new St.Button({ 
                label: _("Manage Calendars"),
                style_class: 'calendar-footer-button',
                can_focus: true,
                x_expand: true
            });
            calendarBtn.connect("clicked", () => {
                this.menu.close();
                Util.spawnCommandLine("gnome-calendar"); 
            });

            footerBox.add_actor(settingsBtn);
            footerBox.add_actor(calendarBtn);
            this._mainBox.add_actor(footerBox);

            // Alles ins Menü hängen
            this.menu.addActor(this._mainBox);

            // Hotkey & Update-Loop
            this.on_hotkey_changed();
            this.menu.connect("open-state-changed", (menu: any, isOpen: boolean) => {
                if (isOpen) {
		    const heute = new Date();
                    this.calendarView.render();
                    this.setHeaderDate(heute); 
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                        this.calendarView.actor.grab_key_focus();
                        return false;
                    });
                }
            });
            
	    this.update_label_and_tooltip();
            this._updateId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
                this.update_label_and_tooltip();
                return true;
            });

        } catch (e) {
            global.log("Calendar@projektit.de Error Constructor: " + e);
        }
    }

    on_hotkey_changed() {
        Main.keybindingManager.removeHotKey("projektit-calendar-open");
        if (this.keyOpen) {
            Main.keybindingManager.addHotKey("projektit-calendar-open", this.keyOpen, () => {
                this.menu.toggle();
            });
        }
    }

    on_settings_changed() {
        this.update_label_and_tooltip();
        if (this.menu.isOpen) {
            this.calendarView.render();
        }
    }

    update_label_and_tooltip() {
        const now = new Date();
        const gNow = GLib.DateTime.new_now_local();
        
        // Panel Label (Uhrzeit)
        let timeLabel = this.useCustomFormat ? gNow.format(this.customFormat) : 
                        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
       
        // Tooltip
        let dateTooltip = this.useCustomFormat ? gNow.format(this.customTooltipFormat) : 
                          now.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

        this.set_applet_label(timeLabel || "");
        this.set_applet_tooltip(dateTooltip || "");

	}

    // Jetzt öffentlich, damit die View sie rufen kann
    public setHeaderDate(date: Date) {
    	if (!this._dayLabel) return;

    	const gDate = GLib.DateTime.new_from_unix_local(date.getTime() / 1000);
    
    	this._dayLabel.set_text(gDate.format("%A")); 
    	this._dateLabel.set_text(gDate.format("%e. %B %Y"));

    	const tagInfo = this.calendarView.getHolidayForDate(date);
    
    	// Prüfung auf 'beschreibung' (wie im Log gesehen!)
    	if (tagInfo && tagInfo.beschreibung) {
        	this._holidayLabel.set_text(tagInfo.beschreibung);
        	this._holidayLabel.show();
    	} else {
        	this._holidayLabel.hide();
    	}
    }
    
    on_applet_clicked(event: any): void {
        
        if (!this.menu.isOpen) {
            this._isUserSelectedDate = false;
            this._selectedDate = null;
	    // Bevor das Menü aufgeht: Daten frisch vom System holen!
            this.eventManager.refresh();
	} else {
            this._isUserSelectedDate = true;
        }

    	this.menu.toggle();
	}

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey("projektit-calendar-open");
        if (this._updateId > 0) {
            GLib.source_remove(this._updateId);
        }
        this.menu.destroy();
    }
}

function main(metadata: any, orientation: any, panel_height: number, instance_id: number) {
    try {
        return new CalendarApplet(metadata, orientation, panel_height, instance_id);
    } catch (e) {
        global.log("Calendar: Fehler in main(): " + e);
        return null;
    }
}

(global as any).main = main;
