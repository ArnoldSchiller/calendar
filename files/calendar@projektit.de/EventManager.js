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
    /* get events for range */
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
        // Window: 2 months back, 7 months ahead
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
            const [id, color, summary, allDay, start, end] = e.deep_unpack();
            return {
                id: id,
                summary: summary,
                color: color,
                start: new Date(start * 1000),
                end: new Date(end * 1000),
                isFullDay: allDay
            };
        });
        // Notify the UI to re-render
        this.emit('events-updated');
    }
    resolveClientForEvent(ev) {
        try {
            // Registry lazy initialisieren
            if (!this._registry) {
                this._registry = EDataServer.SourceRegistry.new_sync(null);
            }
            // Cache-Hit?
            if (this._clientCache.has(ev.sourceUid)) {
                return this._clientCache.get(ev.sourceUid);
            }
            // Source anhand UID holen
            const source = this._registry.ref_source(ev.sourceUid);
            if (!source) {
                global.logError(`${this._uuid}: EDS source not found: ${ev.sourceUid}`);
                return null;
            }
            // Schreibbarkeit prüfen (GJS-kompatibel!)
            const writable = source.has_extension(EDataServer.SOURCE_EXTENSION_CALENDAR) &&
                !source.get_readonly();
            if (!writable) {
                global.logError(`${this._uuid}: Calendar source is read-only: ${ev.sourceUid}`);
                return null;
            }
            // Client synchron verbinden
            const client = ECal.Client.new_sync(source, ECal.ClientSourceType.EVENTS, null);
            if (!client) {
                global.logError(`${this._uuid}: Failed to create ECal.Client for ${ev.sourceUid}`);
                return null;
            }
            // Cache
            this._clientCache.set(ev.sourceUid, client);
            return client;
        }
        catch (e) {
            global.logError(`${this._uuid}: resolveClientForEvent failed: ${e}`);
            return null;
        }
    }
    // cinnamon_calendar_server couldn't sav events
    // above const ECal = imports.gi.ECal; and const ICal = imports.gi.ICalGLib;
    /**
     * Adds an event directly to the Evolution Data Server (EDS).
     * * RATIONALE FOR PR:
     * The standard 'Cinnamon.CalendarServer' is read-only via DBus. To allow
     * adding events without modifying system-files or requiring external tools,
     * we interface directly with 'libecal' and 'libedataserver' (EDS).
     * This ensures the event is synced with Evolution, Google Calendar, etc.
     */
    addEvent(ev) {
        try {
            const registry = EDataServer.SourceRegistry.new_sync(null);
            const sources = registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR);
            const tryNextSource = (index) => {
                if (index >= sources.length) {
                    global.logError(`${this._uuid}: No writable EDS calendar found`);
                    return;
                }
                const source = sources[index];
                ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, 30, null, (_, res) => {
                    let client;
                    try {
                        client = ECal.Client.connect_finish(res);
                    }
                    catch {
                        tryNextSource(index + 1);
                        return;
                    }
                    const caps = client.get_capabilities();
                    if (!caps.includes(ECal.ClientCapability.CREATE_OBJECTS)) {
                        tryNextSource(index + 1);
                        return;
                    }
                    /* ====================================================
                     * VEVENT erzeugen
                     * ==================================================== */
                    const comp = ICal.Component.new(ICal.ComponentKind.VEVENT_COMPONENT);
                    comp.set_summary(ev.summary);
                    if (ev.description) {
                        comp.set_description(ev.description);
                    }
                    const tz = ICal.Timezone.get_utc_timezone();
                    const start = ICal.Time.new_from_timet_with_zone(Math.floor(ev.start.getTime() / 1000), ev.isFullDay ? 1 : 0, tz);
                    const end = ICal.Time.new_from_timet_with_zone(Math.floor(ev.end.getTime() / 1000), ev.isFullDay ? 1 : 0, tz);
                    comp.set_dtstart(ICal.ComponentDateTime.new(start, tz.get_tzid()));
                    comp.set_dtend(ICal.ComponentDateTime.new(end, tz.get_tzid()));
                    if (ev.id)
                        comp.set_uid(ev.id);
                    client.create_object(comp, null, (_c, r) => {
                        try {
                            const [success, uid] = client.create_object_finish(r);
                            if (success) {
                                global.log(`${this._uuid}: Event created in EDS (${uid})`);
                            }
                        }
                        catch (e) {
                            global.logError(`${this._uuid}: create_object failed: ${e}`);
                        }
                    });
                });
            };
            tryNextSource(0);
        }
        catch (e) {
            global.logError(`${this._uuid}: addEvent failed: ${e}`);
        }
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
            // Convert Uint8Array to string (Standard GJS/Cinnamon way)
            const icsText = contents.toString();
            // Simple Regex based VEVENT extraction
            const veventMatches = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
            if (!veventMatches)
                return;
            let importedCount = 0;
            for (const veventBlock of veventMatches) {
                try {
                    const summary = (veventBlock.match(/SUMMARY:(.*)/i)?.[1] || 'Unnamed').trim();
                    const dtstartMatch = veventBlock.match(/DTSTART(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                    const dtendMatch = veventBlock.match(/DTEND(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                    if (!dtstartMatch)
                        continue;
                    const startStr = dtstartMatch[1].trim();
                    const endStr = dtendMatch ? dtendMatch[1].trim() : startStr;
                    const start = this._parseICSDate(startStr);
                    const end = this._parseICSDate(endStr);
                    const allDay = startStr.length === 8;
                    // Generate a unique ID using monotonic time
                    const eventId = `ics_${GLib.get_monotonic_time().toString(16)}_${importedCount++}`;
                    const startUnix = Math.floor(start.getTime() / 1000);
                    const endUnix = Math.floor(end.getTime() / 1000);
                    // Push to the actual system calendar server
                    this._server.call_add_event(eventId, color, summary, allDay, startUnix, endUnix, null, (server, res) => {
                        try {
                            server.call_add_event_finish(res);
                            global.log(this._uuid + `: "${summary}" imported successfully`);
                        }
                        catch (e) {
                            global.logError(this._uuid + `: Event import failed: ${e}`);
                        }
                    });
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
    /**
     * Parses ICS Date strings (YYYYMMDD or YYYYMMDDTHHMMSS[Z])
     */
    _parseICSDate(icsDate) {
        if (icsDate.length === 8) {
            // Format: YYYYMMDD
            return new Date(parseInt(icsDate.substr(0, 4)), parseInt(icsDate.substr(4, 2)) - 1, // Month is 0-indexed
            parseInt(icsDate.substr(6, 2)));
        }
        // Format with time: YYYYMMDDTHHMMSS
        return new Date(icsDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7'));
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
 * 1. For AMD (Development/Modular mode)
 * 2. For Global (Bundled/Production mode)
 *
 * NOTE: EventData and DateRange are TypeScript interfaces, not runtime values.
 * They cannot be exported like classes. Use import/export syntax for TypeScript,
 * but they won't exist at runtime.
 */
if (typeof exports !== 'undefined') {
    exports.EventManager = EventManager;
    // EventData and DateRange are TypeScript-only types, don't export them
}
global.EventManager = EventManager;
