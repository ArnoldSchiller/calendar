"use strict";
/**
 * Project IT Calendar - Event Manager Component
 * --------------------------------------------
 * Handles synchronization with the system calendar server (Cinnamon.CalendarServer)
 * and provides ICS file import capabilities.
 * * * ARCHITECTURAL DESIGN:
 * 1. HYBRID MODULE SYSTEM:
 * Uses 'export' for IDE/AMD support and 'global' assignment for monolithic
 * bundling. This ensures compatibility with both 'module: None' and 'module: AMD'.
 * * 2. GJS SIGNALS INTEGRATION:
 * Uses 'imports.signals' to add event-emitter capabilities. This allows the
 * View to react to 'events-updated' signals without tight coupling.
 * * 3. ASYNCHRONOUS DBUS COMMUNICATION:
 * Communicates with 'org.cinnamon.CalendarServer' via DBus. All calls are
 * handled asynchronously to keep the UI responsive.
 * * 4. MODERN GJS STANDARDS:
 * Uses TextDecoder or .toString() for data conversion instead of legacy
 * byte-array wrappers where possible.
 * * * * ARCHITECTURE OVERVIEW:
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
exports.EventManager = void 0;
// GJS Imports - Accessing native system APIs
const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
const ECal = imports.gi.ECal;
const ICal = imports.gi.ICalGLib;
const EDataServer = imports.gi.EDataServer;
class EventManager {
    /**
     * @param uuid - The unique identifier of the applet for logging purposes.
     */
    constructor(uuid = "EventManager@default") {
        this._server = null;
        this._events = [];
        this._isReady = false;
        this._registry = null;
        this._clientCache = new Map();
        this._uuid = uuid;
        this._selectedDate = new Date();
        this._loadInitialData();
        this._initProxy();
        // Refresh loop: Synchronize with system calendar every 60 seconds
        Mainloop.timeout_add_seconds(60, () => {
            this.refresh();
            return true; // Keep the timer running
        });
    }
    /**
     * Loads placeholder data during startup to ensure the UI is never empty.
     */
    _loadInitialData() {
        const today = new Date();
        this._events = [
            {
                id: "init-state",
                sourceUid: "Teststring",
                start: today,
                end: today,
                summary: "Calendar Manager Active",
                description: "Synchronizing with system calendar...",
                color: "#3498db",
                isFullDay: false
            }
        ];
    }
    /**
     * Initializes the DBus Proxy for Cinnamon's Calendar Server.
     * This is the bridge to GNOME Evolution / Google Calendar / Local calendars.
     */
    _initProxy() {
        Cinnamon.CalendarServerProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, "org.cinnamon.CalendarServer", "/org/cinnamon/CalendarServer", null, (obj, res) => {
            try {
                this._server = Cinnamon.CalendarServerProxy.new_for_bus_finish(res);
                // Listen for server-side updates (e.g., user adds event in Evolution)
                this._server.connect('events-added-or-updated', this._onEventsChanged.bind(this));
                this._server.connect('events-removed', this._onEventsChanged.bind(this));
                this._isReady = true;
                this.emit('manager-ready');
                // Initial fetch for the current month view
                this.refresh();
            }
            catch (e) {
                if (typeof global !== 'undefined') {
                    global.logError(`${this._uuid}: DBus Connection Error: ${e}`);
                }
            }
        });
    }
    selectDate(date) {
        this._selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    getEventsForSelectedDate() {
        return this.getEventsForDate(this._selectedDate);
    }
    hasEvents(date) {
        return this.getEventsForDate(date).length > 0;
    }
    /**
     * Fetches events for a specific Unix timestamp range from the server.
     */
    fetchRange(start, end) {
        if (!this._server)
            return;
        let startUnix = Math.floor(start.getTime() / 1000);
        let endUnix = Math.floor(end.getTime() / 1000);
        // Tell the server which time window we are interested in
        this._server.call_set_time_range(startUnix, endUnix, true, null, (server, res) => {
            try {
                this._server.call_set_time_range_finish(res);
            }
            catch (e) {
                // Ignore finish errors if the applet is closing
            }
        });
    }
    getEventsForRange(range) {
        const from = range.from.getTime();
        const to = range.to.getTime();
        return this._events
            .filter(ev => {
            const start = ev.start.getTime();
            const end = ev.end.getTime();
            return end >= from && start <= to;
        })
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    /**
     * Filters cached events by a specific calendar day.
     */
    getEventsForDate(date) {
        const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const to = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        return this.getEventsForRange({ from, to });
    }
    getEventsForMonth(year, month) {
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 0, 23, 59, 59);
        return this.getEventsForRange({ from, to });
    }
    getEventsForYear(year) {
        const from = new Date(year, 0, 1);
        const to = new Date(year, 11, 31, 23, 59, 59);
        return this.getEventsForRange({ from, to });
    }
    /**
     * Refreshes the event cache by requesting data for a 9-month window.
     */
    refresh() {
        if (!this._server)
            return;
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 7, 0);
        this.fetchRange(start, end);
    }
    /**
     * Callback triggered by DBus when the calendar server emits new data.
     */
    _onEventsChanged(server, varray) {
        const rawEvents = varray.unpack();
        this._events = rawEvents.map((e) => {
            const [fullId, color, summary, allDay, start, end] = e.deep_unpack();
            let sourceUid = "";
            let eventId = fullId;
            if (fullId.includes(':')) {
                const parts = fullId.split(':');
                sourceUid = parts[0];
                eventId = parts.slice(1).join(':');
            }
            return {
                id: eventId,
                sourceUid: sourceUid,
                summary: summary,
                color: color,
                start: new Date(start * 1000),
                end: new Date(end * 1000),
                isFullDay: allDay
            };
        });
        this.emit('events-updated');
    }
    /**
     * ICS IMPORT LOGIC
     * Parses a local .ics file and pushes events to the system calendar via DBus.
     */
    async importICSFile(icsPath, color = "#ff6b6b") {
        if (!this._server) {
            global.logError(this._uuid + ": CalendarServer not ready for ICS-Import");
            return;
        }
        try {
            const file = Gio.File.new_for_path(icsPath);
            const [ok, contents] = await new Promise(resolve => {
                file.load_contents_async(null, (f, res) => {
                    try {
                        const [success, data] = f.load_contents_finish(res);
                        resolve([success, data]);
                    }
                    catch (e) {
                        resolve([false, new Uint8Array()]);
                    }
                });
            });
            if (!ok)
                throw new Error("Can't read ICS file.");
            const icsText = contents.toString();
            const veventMatches = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
            if (!veventMatches)
                return;
            let importedCount = 0;
            for (const veventBlock of veventMatches) {
                try {
                    const summary = (veventBlock.match(/SUMMARY:(.*)/i)?.[1] || 'Unnamed').trim();
                    const description = (veventBlock.match(/DESCRIPTION:(.*)/i)?.[1] || '').trim();
                    const dtstartMatch = veventBlock.match(/DTSTART(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                    const dtendMatch = veventBlock.match(/DTEND(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                    if (!dtstartMatch)
                        continue;
                    const startStr = dtstartMatch[1].trim();
                    const endStr = dtendMatch ? dtendMatch[1].trim() : startStr;
                    const start = this._parseICSDate(startStr);
                    const end = this._parseICSDate(endStr);
                    const allDay = startStr.length === 8;
                    const eventToImport = {
                        id: "",
                        sourceUid: "",
                        summary: summary,
                        description: description,
                        start: start,
                        end: end,
                        isFullDay: allDay,
                        color: "#3498db"
                    };
                    this.addEvent(eventToImport);
                    importedCount++;
                }
                catch (e) {
                    global.logError(this._uuid + ": VEVENT parsing error: " + e);
                }
            }
            global.log(this._uuid + `: ${importedCount} Events imported from ${icsPath}`);
        }
        catch (e) {
            global.logError(this._uuid + `: ICS Import Error ${icsPath}: ${e}`);
        }
    }
    _parseICSDate(icsDate) {
        if (icsDate.length === 8) {
            return new Date(parseInt(icsDate.substr(0, 4)), parseInt(icsDate.substr(4, 2)) - 1, parseInt(icsDate.substr(6, 2)));
        }
        return new Date(icsDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7'));
    }
    /**
     * Adds an event to the system calendar using the sourceUid mapping.
     * * RATIONALE:
     * Since the Cinnamon Calendar Server provides IDs in "source:id" format,
     * we use the extracted sourceUid to target the specific EDS calendar.
     * Adds an event directly to the Evolution Data Server (EDS).
     * The standard 'Cinnamon.CalendarServer' is read-only via DBus. To allow
     * adding events without modifying system-files or requiring external tools,
     * we interface directly with 'libecal' and 'libedataserver' (EDS).
     * This ensures the event is synced with Evolution, Google Calendar, etc.
     */
    /**
    * Event-Daten auf ICal-Komponente mappen
    * Zentralisiert das Setzen von Summary, Description und Zeiten.
    */
    /**
     * Hauptmethode zum Hinzufügen oder Aktualisieren
     */
    addEvent(ev) {
        if (ev.id && ev.sourceUid) {
            this._modifyExistingEvent(ev);
        }
        else {
            this._createNewEvent(ev);
        }
    }
    _createNewEvent(ev) {
        const source = this._getDefaultWritableSource();
        if (!source) {
            global.logError("Create: Keine schreibbare Quelle");
            return;
        }
        // 1️⃣ ECal Component
        const comp = ECal.Component.new();
        comp.set_new_vtype(ECal.ComponentVType.EVENT);
        // 2️⃣ UID MUSS gesetzt sein
        comp.set_uid(ev.id || GLib.uuid_string_random());
        // 3️⃣ SUMMARY
        const summaryText = ECal.ComponentText.new(ev.summary || "Neuer Termin", null);
        comp.set_summary(summaryText);
        // 4️⃣ DESCRIPTION (optional, aber exakt so)
        if (ev.description && ev.description.trim() !== "") {
            const descText = ECal.ComponentText.new(ev.description, null);
            comp.set_description(descText);
        }
        // 5️⃣ Zeiten
        const tz = ICal.Timezone.get_utc_timezone();
        const start = ICal.Time.new_from_timet_with_zone(Math.floor(ev.start.getTime() / 1000), 0, tz);
        const end = ICal.Time.new_from_timet_with_zone(Math.floor(ev.end.getTime() / 1000), 0, tz);
        comp.set_dtstart(start);
        comp.set_dtend(end);
        // 6️⃣ Create
        ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, 30, null, (_o, res) => {
            try {
                const client = ECal.Client.connect_finish(res);
                client.create_object(comp, null, null, (_c, cres) => {
                    try {
                        client.create_object_finish(cres);
                        global.log("✅ CREATE OK");
                        this.refresh();
                    }
                    catch (e) {
                        global.logError("❌ create_object_finish failed: " + e);
                    }
                });
            }
            catch (e) {
                global.logError("❌ connect failed: " + e);
            }
        });
    }
    _modifyExistingEvent(ev) {
        const source = this._resolveSource(ev.sourceUid);
        if (!source)
            return;
        ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, 30, null, (_obj, res) => {
            try {
                const client = ECal.Client.connect_finish(res);
                if (ev.id && ev.id !== "" && !ev.id.startsWith("ics_")) {
                    // --- SMART MERGE (Vergleichs-Logik) ---
                    // FIX: 4 Argumente, damit der Aufruf nicht fehlschlägt
                    client.get_object(ev.id, null, null, (_obj2, getRes) => {
                        try {
                            const result = client.get_object_finish(getRes);
                            const icalComp = Array.isArray(result) ? result[1] : result;
                            if (icalComp) {
                                let anyChange = false;
                                // --- 1. SUMMARY ---
                                const oldSummary = icalComp.get_summary() || "";
                                // Nur ändern, wenn UI-Wert vorhanden UND anders als im Kalender
                                if (ev.summary && ev.summary.trim() !== "" && ev.summary !== oldSummary) {
                                    icalComp.set_summary(ev.summary);
                                    anyChange = true;
                                    global.log(`${this._uuid}: Update Summary`);
                                }
                                // --- 2. DESCRIPTION ---
                                const oldDesc = icalComp.get_description() || "";
                                // Schutz: Nur ändern, wenn im Formular tatsächlich Text steht und dieser abweicht
                                if (ev.description && ev.description.trim() !== "" && ev.description !== oldDesc) {
                                    icalComp.set_description(ev.description);
                                    anyChange = true;
                                    global.log(`${this._uuid}: Update Description`);
                                }
                                // --- 3. ZEITEN (Der kritische Teil für Mehrtages-Events) ---
                                try {
                                    const oldStartComp = icalComp.get_dtstart();
                                    const oldEndComp = icalComp.get_dtend();
                                    if (oldStartComp && oldEndComp) {
                                        const oldStartTimeObj = (typeof oldStartComp.get_value === 'function') ? oldStartComp.get_value() : oldStartComp;
                                        const oldEndTimeObj = (typeof oldEndComp.get_value === 'function') ? oldEndComp.get_value() : oldEndComp;
                                        const newStartSeconds = Math.floor(ev.start.getTime() / 1000);
                                        if (oldStartTimeObj.as_timet() !== newStartSeconds) {
                                            // Die Startzeit hat sich geändert!
                                            // Berechnung der ursprünglichen Dauer, um sie zu erhalten:
                                            const durationSeconds = oldEndTimeObj.as_timet() - oldStartTimeObj.as_timet();
                                            // Neues Start-Objekt bauen
                                            const tz = ICal.Timezone.get_utc_timezone();
                                            let newStart = ICal.Time.new_from_timet_with_zone(newStartSeconds, 0, tz);
                                            if (ev.isFullDay)
                                                newStart.set_is_date(true);
                                            // Neues Ende-Objekt basierend auf der ALTEN Dauer berechnen
                                            let newEnd = ICal.Time.new_from_timet_with_zone(newStartSeconds + durationSeconds, 0, tz);
                                            if (ev.isFullDay)
                                                newEnd.set_is_date(true);
                                            icalComp.set_dtstart(newStart);
                                            icalComp.set_dtend(newEnd);
                                            anyChange = true;
                                            global.log(`${this._uuid}: Update Times (Dauer von ${durationSeconds / 3600}h erhalten)`);
                                        }
                                    }
                                }
                                catch (e) {
                                    global.logWarning(`${this._uuid}: Zeit-Merge fehlgeschlagen: ${e}`);
                                }
                                // --- FINALE ---
                                if (anyChange) {
                                    client.modify_object(icalComp, ECal.ObjModType.THIS, 0, null, (_c, mRes) => {
                                        try {
                                            client.modify_object_finish(mRes);
                                            global.log(`${this._uuid}: Smart Merge erfolgreich durchgeführt.`);
                                            this.refresh();
                                        }
                                        catch (err) {
                                            global.logError("Modify finish failed: " + err);
                                        }
                                    });
                                }
                                else {
                                    global.log(`${this._uuid}: Keine Änderungen notwendig - Master-Daten bleiben unberührt.`);
                                }
                            }
                        }
                        catch (e) {
                            // Nur wenn get_object wirklich sagt "UID existiert nicht"
                            global.logWarning(`${this._uuid}: Smart Merge fehlgeschlagen (ID nicht gefunden), erstelle neu: ${e}`);
                            // Wir bauen hier das fehlende icalComp für den Fallback
                            let fallbackComp = ECal.Component.new();
                            fallbackComp.set_new_vtype(ECal.ComponentVType.EVENT);
                            fallbackComp.set_uid(ev.id || GLib.uuid_string_random());
                            this._createAsNew(client, ev, fallbackComp);
                        }
                    });
                }
                else {
                    /* Hier sollte er eigentlich nie landen falls doch speichern wir es als neues Event ab */
                    this._createNewEvent(ev);
                }
            }
            catch (e) {
                global.logError("Connection failed: " + e);
            }
        });
    }
    _applyEventToComponent(ecalComp, ev) {
        // 🔑 INTERNES ICal-Objekt holen
        const ical = ecalComp.get_icalcomponent();
        // UID (sehr wichtig)
        ical.set_uid(ev.id);
        // DTSTAMP
        ical.set_dtstamp(ICal.Time.new_current_with_zone(ICal.Timezone.get_utc_timezone()));
        // SUMMARY
        if (ev.summary) {
            const sumProp = ICal.Property.new_summary(ev.summary);
            ical.add_property(sumProp);
        }
        // DESCRIPTION   HIER IST DER FIX
        if (ev.description && ev.description.trim() !== "") {
            const descProp = ICal.Property.new_description(ev.description);
            ical.add_property(descProp);
        }
        // ZEITEN
        const tz = ICal.Timezone.get_utc_timezone();
        let start;
        let end;
        if (ev.isFullDay) {
            start = ICal.Time.new_null_time();
            start.set_date(ev.start.getFullYear(), ev.start.getMonth() + 1, ev.start.getDate());
            start.set_is_date(true);
            end = ICal.Time.new_null_time();
            const endDate = new Date(ev.end);
            if (endDate.getTime() <= ev.start.getTime()) {
                endDate.setDate(ev.start.getDate() + 1);
            }
            end.set_date(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate());
            end.set_is_date(true);
        }
        else {
            start = ICal.Time.new_from_timet_with_zone(Math.floor(ev.start.getTime() / 1000), 0, tz);
            end = ICal.Time.new_from_timet_with_zone(Math.floor(ev.end.getTime() / 1000), 0, tz);
        }
        ical.set_dtstart(start);
        ical.set_dtend(end);
    }
    _applyTimesToComponent(icalComp, ev) {
        const tz = ICal.Timezone.get_utc_timezone();
        let start = ICal.Time.new_null_time();
        let end = ICal.Time.new_null_time();
        if (ev.isFullDay) {
            start.set_date(ev.start.getFullYear(), ev.start.getMonth() + 1, ev.start.getDate());
            start.set_is_date(true);
            let endDate = new Date(ev.end);
            if (endDate.getTime() <= ev.start.getTime())
                endDate.setDate(ev.start.getDate() + 1);
            end.set_date(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate());
            end.set_is_date(true);
        }
        else {
            start = ICal.Time.new_from_timet_with_zone(Math.floor(ev.start.getTime() / 1000), 0, tz);
            end = ICal.Time.new_from_timet_with_zone(Math.floor(ev.end.getTime() / 1000), 0, tz);
        }
        icalComp.set_dtstart(start);
        icalComp.set_dtend(end);
    }
    /**
     * Erstellt ein komplett neues Objekt im EDS.
     * Fix: Erfordert in dieser GJS-Umgebung 4 Argumente (comp, opid, cancellable, callback).
     */
    _createAsNew(client, ev, icalComp) {
        try {
            // Falls der Aufrufer (z.B. aus dem Modify-Fallback) schon ein icalComp mitgibt,
            // nutzen wir es. Wenn es null ist (aus der normalen addEvent), erstellen wir es hier.
            let comp = icalComp;
            if (!comp) {
                comp = this._buildIcalComponent(ev);
            }
            else {
                // Wenn schon eins da ist, stellen wir sicher, dass die Daten aktuell sind
                this._applyEventToComponent(comp, ev);
            }
            // Der eigentliche Speicherbefehl (4 Argumente für GJS)
            client.create_object(comp, null, null, (_obj, res) => {
                try {
                    client.create_object_finish(res);
                    global.log(`${this._uuid}: Event erfolgreich erstellt.`);
                    this.refresh();
                }
                catch (e) {
                    global.logError(`${this._uuid}: create_object_finish failed: ${e}`);
                }
            });
        }
        catch (e) {
            global.logError(`${this._uuid}: _createAsNew failed: ${e}`);
        }
    }
    /**
    * Findet eine schreibbare Kalenderquelle.
    */
    _resolveSource(sUid) {
        if (!this._registry) {
            this._registry = EDataServer.SourceRegistry.new_sync(null);
        }
        if (sUid) {
            try {
                let s = this._registry.ref_source(sUid);
                if (s)
                    return s;
            }
            catch (e) { }
        }
        const sources = this._registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR);
        // 1. Suche nach bevorzugten Namen (System/Personal/Local)
        let bestSource = sources.find((s) => {
            try {
                const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                // Sicherer Check auf Readonly
                const ro = (typeof ext.get_readonly === 'function') ? ext.get_readonly() : ext.readonly;
                if (ro === true)
                    return false;
                const name = s.get_display_name().toLowerCase();
                return name.includes("system") || name.includes("personal") || name.includes("local");
            }
            catch (e) {
                return false;
            }
        });
        if (bestSource)
            return bestSource;
        // 2. Fallback: Nimm IRGENDEINEN der nicht readonly ist
        return sources.find((s) => {
            try {
                const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                const ro = (typeof ext.get_readonly === 'function') ? ext.get_readonly() : ext.readonly;
                return ro !== true;
            }
            catch (e) {
                return false;
            }
        });
    }
    /*
     * von Terminen des Proxy dürfen wir nur modify machen
     * also müssen wir für create new noch die writable finden
     */
    _getDefaultWritableSource() {
        if (!this._registry) {
            this._registry = EDataServer.SourceRegistry.new_sync(null);
        }
        const sources = this._registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR);
        return sources.find((s) => {
            try {
                const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                if (ext.get_readonly && ext.get_readonly())
                    return false;
                // 🔑 DAS ist wichtig
                return s.get_parent() !== null;
            }
            catch {
                return false;
            }
        });
    }
    /**
     * Date zu ICal.Time
     * Regelt Monats-Offset (+1) und Ganztags-Flags.
     */
    _dateToICalTime(date, isFullDay) {
        const tz = ICal.Timezone.get_utc_timezone();
        const time = ICal.Time.new_full(date.getFullYear(), date.getMonth() + 1, date.getDate(), isFullDay ? 0 : date.getHours(), isFullDay ? 0 : date.getMinutes(), 0, tz);
        if (isFullDay)
            time.set_is_date(true);
        return time;
    }
    /**
     * Factory-Methode zur Erstellung einer validen ECal.Component.
     * Kapselt die Eigenheiten der GJS-Libecal Bindungen.
     */
    _buildIcalComponent(ev) {
        const icalComp = ECal.Component.new();
        icalComp.set_new_vtype(ECal.ComponentVType.EVENT);
        icalComp.set_uid(ev.id || GLib.uuid_string_random());
        // Hier rufen wir die saubere Mapping-Funktion von oben auf
        this._applyEventToComponent(icalComp, ev);
        return icalComp;
    }
}
exports.EventManager = EventManager;
/**
 * GJS SIGNAL MIXIN
 * This injects the Signal emitter methods into the EventManager prototype.
 * Essential for the 'events-updated' notification system.
 */
Signals.addSignalMethods(EventManager.prototype);
/**
 * HYBRID EXPORT
 */
if (typeof exports !== 'undefined') {
    exports.EventManager = EventManager;
}
global.EventManager = EventManager;
