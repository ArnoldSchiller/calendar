const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
import { EventData } from './EventManager';

export class EventListView {
    public actor: any;
    private _eventsBox: any;
    private _selectedDateLabel: any;

    constructor() {
        // Hauptbox (entspricht .calendar-events-main-box im Original)
        this.actor = new St.BoxLayout({
            style_class: "calendar-events-main-box",
            vertical: true,
            x_expand: true
        });

        // Datumsanzeige über der Liste
        this._selectedDateLabel = new St.Label({
            style_class: "calendar-events-date-label",
            text: "" 
        });
        this.actor.add_actor(this._selectedDateLabel);

        // ScrollView wie im Original (vfade sorgt für das Ausfaden oben/unten)
        let scrollBox = new St.ScrollView({
            style_class: 'calendar-events-scrollbox vfade',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC
        });

        this._eventsBox = new St.BoxLayout({
            style_class: 'calendar-events-event-container',
            vertical: true
        });

        scrollBox.add_actor(this._eventsBox);
        this.actor.add_actor(scrollBox);
    }

    /**
     * Aktualisiert die Liste und das Datums-Label
     */
    public update(date: Date, events: EventData[]): void {
        // Datum oben aktualisieren (Format kannst du anpassen)
        this._selectedDateLabel.set_text(date.toLocaleDateString(undefined, { 
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
        }));

        this._eventsBox.destroy_children();

        if (!events || events.length === 0) {
            this._showNoEvents();
            return;
        }

        events.forEach((ev) => {
            this._addEventRow(ev);
        });
    }

    private _showNoEvents() {
        let box = new St.BoxLayout({
            style_class: "calendar-events-no-events-box",
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        
        box.add_actor(new St.Icon({
            icon_name: 'office-calendar',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 48
        }));

        box.add_actor(new St.Label({
            text: "Keine Termine",
            style_class: "calendar-events-no-events-label"
        }));

        this._eventsBox.add_actor(box);
    }

    private _addEventRow(ev: EventData) {
        // Die "EventRow" Struktur aus dem Original
        let row = new St.BoxLayout({
            style_class: "calendar-event-button",
            reactive: true
        });

        // Der farbige Streifen links (calendar-event-color-strip)
        let colorStrip = new St.Bin({
            style_class: "calendar-event-color-strip",
            style: `background-color: ${ev.color || '#3498db'};`
        });
        row.add_actor(colorStrip);

        let contentVBox = new St.BoxLayout({
            style_class: "calendar-event-row-content",
            vertical: true,
            x_expand: true
        });

        // Zusammenfassung (Titel)
        let summary = new St.Label({
            text: ev.summary,
            style_class: "calendar-event-summary"
        });
        contentVBox.add_actor(summary);

        // Zeit oder Beschreibung
        if (ev.description) {
            let desc = new St.Label({
                text: ev.description,
                style_class: "calendar-event-time-future" // Wir nutzen die Zeit-Klasse für Untertext
            });
            contentVBox.add_actor(desc);
        }

        row.add_actor(contentVBox);
        this._eventsBox.add_actor(row);
    }
}
