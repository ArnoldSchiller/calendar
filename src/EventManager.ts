const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Mainloop = imports.mainloop;

export interface EventManager extends Signals.Signals {}

export interface EventData {
    id: string;
    date: Date;
    summary: string;
    description?: string;
    color: string;
    isFullDay: boolean;
}

export class EventManager {
    private _server: any = null;
    private _events: EventData[] = [];
    private _isReady: boolean = false;
    private _selectedDate: Date;

    constructor() {
        this._selectedDate = new Date();
        this._loadInitialData(); // Dummy-Daten für den ersten Start
        this._initProxy();
        Mainloop.timeout_add_seconds(60, () => {
    		this.refresh();
    		return true; // true = Timer läuft weiter
		});
    }



    private _loadInitialData(): void {
        const heute = new Date();
        this._events = [
            {
                id: "dummy-1",
                date: heute,
                summary: "Projekt IT Calendar Development",
                description: "Event-Manager Test Event",
                color: "#3498db",
                isFullDay: false
            }
        ];
    }

    private _initProxy(): void {
        Cinnamon.CalendarServerProxy.new_for_bus(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.NONE,
            "org.cinnamon.CalendarServer",
            "/org/cinnamon/CalendarServer",
            null,
            (obj, res) => {
                try {
                    this._server = Cinnamon.CalendarServerProxy.new_for_bus_finish(res);
                    this._server.connect('events-added-or-updated', this._onEventsChanged.bind(this));
                    this._server.connect('events-removed', this._onEventsChanged.bind(this));
                    
                    this._isReady = true;
                    this.emit('manager-ready');
                    
                    // Initialen Bereich laden (aktueller Monat)
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    this.fetchRange(start, end);
                } catch (e) {
                    global.logError("PROJEKTIT: Error Connection Calendar-Server: " + e);
                }
            }
        );
    }

    // --- Deine Helper-Methoden aus der ersten Version ---

    public selectDate(date: Date): void {
        this._selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    public getEventsForSelectedDate(): EventData[] {
        return this.getEventsForDate(this._selectedDate);
    }

    public hasEvents(date: Date): boolean {
        return this.getEventsForDate(date).length > 0;
    }

    // ---------------------------------------------------

    public fetchRange(start: Date, end: Date): void {
        if (!this._server) return;
        let startUnix = Math.floor(start.getTime() / 1000);
        let endUnix = Math.floor(end.getTime() / 1000);

        this._server.call_set_time_range(startUnix, endUnix, true, null, (server, res) => {
            try { this._server.call_set_time_range_finish(res); } catch (e) {}
        });
    }

    public refresh(): void {
	    if (!this._server) return;
    
    	  // Wir fordern den aktuellen Monat einfach nochmal neu an
    	   const now = new Date();
    	   const start = new Date(now.getFullYear(), now.getMonth(), 1);
    	   const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    	   this.fetchRange(start, end);
    }
    private _onEventsChanged(server: any, varray: any): void {
        const rawEvents = varray.unpack();
        this._events = rawEvents.map(e => {
            const [id, color, summary, allDay, start, end] = e.deep_unpack();
            return {
                id: id,
                summary: summary,
                color: color,
                date: new Date(start * 1000),
                isFullDay: allDay
            };
        });
        this.emit('events-updated');
    }

    public getEventsForDate(date: Date): EventData[] {
        return this._events.filter(e => 
            e.date.getDate() === date.getDate() &&
            e.date.getMonth() === date.getMonth() &&
            e.date.getFullYear() === date.getFullYear()
        );
    }
}

Signals.addSignalMethods(EventManager.prototype);
