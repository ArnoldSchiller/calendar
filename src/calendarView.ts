/* calendarView.ts
 * Cinnamon Applet Calendar View
 *
 * WICHTIG:
 * - Diese View läuft innerhalb eines AppletPopupMenu
 * - Deshalb müssen wir Events abfangen, ohne Child-Actors zu blockieren
 * - render() darf erst aufgerufen werden, NACHDEM navBox & contentBox existieren
 */

declare const imports: any;
declare const global: any;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const Settings = imports.ui.settings;
const Tooltips = (imports as any).ui.tooltips;

/* === Utils (Programme starten) === */
const Util = imports.misc.util;
// Nutze das Gio Modul für Standard-Anwendungen
const Gio = (imports as any).gi.Gio;

/* === Cinnamon / GJS Imports === */
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

/* === Applet Pfad === */
const UUID = "calendar@projektit.de";
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;

/* === Logik laden === */
const LogikModule = imports.misc.fileUtils.requireModule(
    AppletDir + "/kalenderlogik.js"
);
const KalenderLogik = LogikModule.KalenderLogik;

/*=== Anbindung zum EventManager === */
import { EventManager } from './EventManager';

/*======== Locale  Strings nach Möglichkeit von Cinnamon oder gnome-calendar ======*/

const Gettext = (imports as any).gettext;

// Helfer-Funktionen
// Das hier bindet das Applet an seine eigene (evtl. leere) Domain
Gettext.bindtextdomain(UUID, imports.ui.appletManager.appletMeta[UUID].path + "/locale");

function _(str: string) {
    // Probiere erst das Applet 
    let custom = Gettext.dgettext(UUID, str);
    if (custom !== str) return custom;
    // nicht mit Return abgebrochen, lass uns cinnamon probieren
    let cinnamon = Gettext.dgettext("cinnamon", str);
    if (cinnamon !== str) return cinnamon;
    
    // Fallback System perhaps gnome-calendar
    return Gettext.dgettext("gnome-calendar", str);
}


/* ===================================================================== */

export class CalendarView {
    public applet: any;
    public actor: any;

    /* UI-Container */
    private navBox: any;
    private contentBox: any;

    /* Kalender-Zustand */
    private angezeigtJahr: number;
    private angezeigtMonat: number;
    private currentAnsicht: "MONAT" | "JAHR" | "TAG" = "MONAT";
    private gewaehlterTag: number | null = null;
    private monatsTage: any[] = [];

    /* Locale – bewusst vorbereitet, aber noch nicht hart verwendet */
    private readonly LOCALE = undefined; // später z.B. "de-DE"

    constructor(applet: any) {
        this.applet = applet;
        
        const heute = new Date();

        this.angezeigtJahr = heute.getFullYear();
        this.angezeigtMonat = heute.getMonth();
        

        /* =========================================================
         * Root Actor
         * =========================================================
         * Muss:
         * - reactive sein (sonst keine Events)
         * - Fokus behalten
         * - Events vom PopupMenu abschirmen
         */
        this.actor = new St.BoxLayout({
            vertical: true,
            style_class: "calendar-main-box",
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        this.actor.set_reactive(true);
	this.actor.set_can_focus(true); 
        this.actor.set_track_hover(true);

	// EXTREM WICHTIG für hover:
	this.actor.set_clip_to_allocation(false);
        /* =========================================================
         * WICHTIG:
         * Cinnamon erwartet clicked bei St.Button 
         * button-press-event ist Low-Level (Clutter)
         * Mischung aus beiden → Fokus-Desync
         * 
         * ========================================================= */
        

        /* =========================================================
         * Scrollrad:
         * Monat wechseln (bewusst hier, nicht auf einzelnen Buttons)
         * ========================================================= */
        this.actor.connect("scroll-event", (_: any, event: any) => {
            const dir = event.get_scroll_direction();
            if (dir === Clutter.ScrollDirection.UP) this.scrollMonat(-1);
            if (dir === Clutter.ScrollDirection.DOWN) this.scrollMonat(1);
            return Clutter.EVENT_STOP;
        });

        /*=========================================================== 
	* Key right, key left, key up, key down
        * Monat/Jahr wechseln, wenn kein scroll-event 
        * =========================================================== */

        this.actor.connect("key-press-event", (_: any, event: any) => {
	    const sym = event.get_key_symbol();	

	    switch (sym) {
	        case Clutter.KEY_Left:
	            this.scrollMonat(-1);
	            return Clutter.EVENT_STOP;

	        case Clutter.KEY_Right:
	            this.scrollMonat(1);
	            return Clutter.EVENT_STOP;

	        case Clutter.KEY_Up:
	            this.scrollJahr(-1);
	            return Clutter.EVENT_STOP;

	        case Clutter.KEY_Down:
	            this.scrollJahr(1);
	            return Clutter.EVENT_STOP;
	    }

	    return Clutter.EVENT_PROPAGATE;
	});


         this.applet.eventManager.connect('events-updated', () => {
    	// Wenn neue Daten kommen, Kalender neu zeichnen (mit Punkten!)
    		this.render(); 
	});
 

        /* === Navigation (oben) === */
        this.navBox = new St.BoxLayout({
            vertical: false,
            style_class: "calendar-nav-box"
        });
        this.actor.add_actor(this.navBox);

        /* === Content (Kalender / Tag / Jahr) === */
        this.contentBox = new St.BoxLayout({
            vertical: true
        });
        this.actor.add_actor(this.contentBox);

        /* =========================================================
         * ERST JETZT rendern!
         * navBox & contentBox müssen existieren,
         * sonst fliegt dir renderNav() um die Ohren.
         * ========================================================= */
        this.render();
    }


    private renderNav() {
        this.navBox.destroy_children();
        this.navBox.set_vertical(true); // Heute-Zeile + Picker-Zeile

        
        

        /* ---------- Monat / Jahr Picker ---------- */
        const pickerBox = new St.BoxLayout({ style_class: "picker-box" });

        /* Monat */
        const btnPrevM = new St.Button({
            label: "<<<",
            style_class: "nav-button-small",
            reactive: true
        });
        btnPrevM.connect("clicked", () => this.scrollMonat(-1));

        const monatLabel = new St.Label({
            text: new Date(
                this.angezeigtJahr,
                this.angezeigtMonat
            ).toLocaleString(this.LOCALE, { month: "long" }),
            style_class: "nav-label-main"
        });

        const btnNextM = new St.Button({
            label: ">>>",
            style_class: "nav-button-small",
            reactive: true
        });
        btnNextM.connect("clicked", () => this.scrollMonat(1));

        pickerBox.add_actor(btnPrevM);
        pickerBox.add_actor(monatLabel);
        pickerBox.add_actor(btnNextM);

        /* Jahr */
        const btnPrevY = new St.Button({
            label: "‹‹‹",
            style_class: "nav-button-small",
            reactive: true
        });
        btnPrevY.connect("clicked", () => this.scrollJahr(-1));

        const jahrLabel = new St.Label({
            text: this.angezeigtJahr.toString(),
            style_class: "nav-label-main"
        });

        const btnNextY = new St.Button({
            label: "›››",
            style_class: "nav-button-small",
            reactive: true
        });
        btnNextY.connect("clicked", () => this.scrollJahr(1));

        pickerBox.add_actor(btnPrevY);
        pickerBox.add_actor(jahrLabel);
        pickerBox.add_actor(btnNextY);

        this.navBox.add_actor(pickerBox);
    }

    /* ================= SCROLL-LOGIK ================= */

    private scrollJahr(delta: number) {
        this.angezeigtJahr += delta;
        this.render();
    }

    private scrollMonat(delta: number) {
        /* Bewusst wie früher:
         * Date kümmert sich um Jahreswechsel */
        const d = new Date(
            this.angezeigtJahr,
            this.angezeigtMonat + delta,
            1
        );
        this.angezeigtJahr = d.getFullYear();
        this.angezeigtMonat = d.getMonth();
        this.render();
    }

    /* ================= RENDER ================= */

    public render() {
        this.renderNav();
        this.contentBox.destroy_children();
        this.monatsTage = KalenderLogik.getTageImMonat(this.angezeigtJahr, this.angezeigtMonat);
    
        
        if (this.currentAnsicht === "TAG") {
            this.renderTagesAnsicht();
        } else if (this.currentAnsicht === "JAHR") {
            this.renderJahresAnsicht();
        } else {
            this.renderMonatsAnsicht();
        }

        /* ---------- Footer ---------- */
        const footer = new St.BoxLayout({
            style_class: "calendar-footer"
        });
        /* falls später was unter den Kalender soll */
        this.contentBox.add_actor(footer);
    }
    // In calendarView.ts
    public resetToToday(): void {
    	const now = new Date();
    	this.angezeigtJahr = now.getFullYear();
    	this.angezeigtMonat = now.getMonth();
    	this.currentAnsicht = "MONAT";
    	this.render();
	}


    // Feiertage für applet.ts und andere
    public getHolidayForDate(date: Date): any {
	    if (!this.monatsTage || this.monatsTage.length === 0) {
        	return null;
    		}

            const gesuchterTag = date.getDate();
    
	    // Wir suchen manuell, um jeden Schritt zu loggen
    	    const treffer = this.monatsTage.find(t => {
            const istMatch = Number(t.tagNummer) === Number(gesuchterTag);
        
            // Wir loggen nur, wenn wir den Tag gefunden haben, um das Log nicht zu fluten
            if (istMatch) {
	        }
        	return istMatch;
    		});

    	    if (!treffer) {
        	// Falls gar nichts gefunden wurde für diesen Tag (sehr verdächtig!)
        	// global.log(`Projektit Calendar FIND-CHECK: Nichts gefunden für Tag ${gesuchterTag}`);
    		}

    	    return treffer;
              
            // return this.monatsTage.find(t => Number(t.tagNummer) === date.getDate());
    		
	}

    /*================= GETDAYNAMES ================================ */
    private getDayNames(): string[] {
        const formatter = new Intl.DateTimeFormat(this.LOCALE, { weekday: 'short' });
        return [1, 2, 3, 4, 5, 6, 7].map(day => 
            formatter.format(new Date(2024, 0, day))
        );
    }

    /*================= GETWEEKNUMBER (ISO-8601) =================== */
    private getWeekNumber(date: Date): number {
        let d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        let yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    /* ================= MONATSANSICHT ================= */
    /* 6 Zeilen mit getDayNames und getWeekNumber        */
    /* ================================================= */
    private renderMonatsAnsicht() {
        const grid = new St.Table({ homogeneous: true, style_class: "calendar-grid" });
        const showWeeks = this.applet.showWeekNumbers;
        
        const colOffset = showWeeks ? 1 : 0;

        const dayNames = this.getDayNames();
        dayNames.forEach((name, i) => {
            grid.add(new St.Label({ text: name, style_class: "calendar-header" }), 
                     { row: 0, col: i + colOffset });
        });

        // 1. Wir holen uns die Tage für den aktuellen Monat aus kalenderlogik.ts
        // Das brauchen wir für die Feiertags-Infos
        const monatsTage = KalenderLogik.getTageImMonat(this.angezeigtJahr, this.angezeigtMonat);

        let iter = new Date(this.angezeigtJahr, this.angezeigtMonat, 1);
        let dayOfWeek = (iter.getDay() + 6) % 7; 
        iter.setDate(iter.getDate() - dayOfWeek);

        const heute = new Date();

        for (let row = 1; row <= 6; row++) {
            if (showWeeks) {
                let kwDate = new Date(iter);
                kwDate.setDate(kwDate.getDate() + 3); 
                let kw = this.getWeekNumber(kwDate);
                grid.add(new St.Label({ text: kw.toString(), style_class: "calendar-week-number" }), 
                         { row: row, col: 0 });
            }

            for (let col = 0; col < 7; col++) {
                let isOtherMonth = iter.getMonth() !== this.angezeigtMonat;
                let isToday = iter.getDate() === heute.getDate() && 
                              iter.getMonth() === heute.getMonth() && 
                              iter.getFullYear() === heute.getFullYear();
                
                // FEIERTAGS-CHECK:
                // Wir schauen in monatsTage nach, ob der aktuelle iter-Tag ein Feiertag ist
                // (Nur für den aktuellen Monat möglich, da getTageImMonat nur diesen liefert)
                let istFeiertag = false;
                
                let tooltipZeilen: string[] = [];
		
		if (!isOtherMonth) {
		    const logikTag = monatsTage.find(t => t.tagNummer === iter.getDate());
		    if (logikTag && logikTag.typ === "FEIERTAG") {		
				        istFeiertag = true;
					        tooltipZeilen.push(logikTag.beschreibung);
        			if (logikTag.istGesetzlich) {
            				tooltipZeilen.push(_("(Gesetzlicher Feiertag)"));
        			}
    			}

	    	// 2. TERMIN-CHECK (Neu: Integration des EventManagers)
    		    const tagesTermine = this.applet.eventManager.getEventsForDate(iter);
    		    if (tagesTermine.length > 0) {
        	// Trenner hinzufügen, wenn es vorher schon einen Feiertag gab
        		if (tooltipZeilen.length > 0) tooltipZeilen.push("---"); 
        
        			tooltipZeilen.push(_("Termine:"));
        			tagesTermine.forEach((ev: any) => {
            			let zeit = ev.isFullDay ? "" : `[${ev.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] `;
            			tooltipZeilen.push(`• ${zeit}${ev.summary}`);
        		});
    		    }
		}

	 	// 3. CSS Klassen zusammenbauen
		let css = ["day-button"];
		if (isOtherMonth) css.push("calendar-other-month-day");
		if (isToday) css.push("today");
		if (istFeiertag || iter.getDay() === 0) css.push("holiday");

		// Markiere Tage mit Terminen optisch (optional, zusätzlich zum Tooltip)
		if (this.applet.eventManager.hasEvents(iter)) {	
    			css.push("calendar-day-with-events");
			}

		const btn = new St.Button({
    			label: iter.getDate().toString(),
    			style_class: css.join(" "),
    			reactive: true,
    			can_focus: true,
    			track_hover: true,
		});

		// 4. Den fertigen Tooltip setzen
		if (tooltipZeilen.length > 0) {
    			new Tooltips.Tooltip(btn, tooltipZeilen.join("\n"));
		}
                

		
                // Werte für den Click-Handler einfrieren
                let d = iter.getDate();
                let m = iter.getMonth();
                let y = iter.getFullYear();
		btn.connect("enter-event", () => {
    			global.log("ENTER day " + d);
		});
                btn.connect("clicked", () => {
                    this.gewaehlterTag = d;
                    this.angezeigtMonat = m;
                    this.angezeigtJahr = y;
                    this.currentAnsicht = "TAG";
                                        
                    // WICHTIG: Applet über die Auswahl informieren
                    const selectedDate = new Date(y, m, d);
                    if (this.applet.onDateSelected) {
                        this.applet.onDateSelected(selectedDate);
                    }


                    this.render();
                });

                grid.add(btn, { row: row, col: col + colOffset });
                iter.setDate(iter.getDate() + 1);
            }
        }
        this.contentBox.add_actor(grid);
    }
    

    
    /* ================= TAGESANSICHT ================= */

    private renderTagesAnsicht() {
    	const box = new St.BoxLayout({
        	vertical: true,
        	style_class: "day-details-box"
    	});


	/* =====================================================
	 * Datums-Überschrift inkl. Wochentag und Jahr
	 * ===================================================== */
	const gewaehltesDatum = new Date(this.angezeigtJahr, this.angezeigtMonat, this.gewaehlterTag);
        const tagInfo = this.getHolidayForDate(gewaehltesDatum);
      

	let displayDate = gewaehltesDatum.toLocaleString(this.LOCALE, { 
	    weekday: "long", 
	    day: "2-digit", 
	    month: "long", 
	    year: "numeric" 
	});
        let css = ["day-details-title"];

	if (tagInfo && tagInfo.typ === 'FEIERTAG') {  
    		css.push("is-holiday");
                displayDate = tagInfo.beschreibung + "\n" + displayDate;
	}
	box.add_actor(
	    new St.Label({
	        text: displayDate,
	        style_class: css.join(" ")
	    })
	);

    /* =====================================================
     * Die echten Termine aus dem EventManager laden
     * ===================================================== */
     	const terminListe = new St.BoxLayout({
    		vertical: true,
    		style_class: "termin-liste"
	});

	// Hol die Events für das gewählte Datum vom Manager

	const tagesTermine = this.applet.eventManager.getEventsForDate(gewaehltesDatum);

	if (tagesTermine.length > 0) {
    		tagesTermine.forEach(ev => {
        	const eventBox = new St.BoxLayout({ 
            		style_class: "termin-item",
            		vertical: false 
        	});

        	// Ein farbiger Balken oder Punkt (aus den Systemdaten)
        	const colorIndicator = new St.Widget({
            		style: `background-color: ${ev.color};`,
            		style_class: "termin-color-indicator"
        	});

        	const textVBox = new St.BoxLayout({ vertical: true });
        
        	// Uhrzeit (falls nicht ganztägig)
        	let zeitText = ev.isFullDay ? _("All Day") : ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        	textVBox.add_actor(new St.Label({
            		text: zeitText,
            		style_class: "termin-time"
        	}));

        	textVBox.add_actor(new St.Label({
            		text: ev.summary,
            			style_class: "termin-summary"
        		}));

        		eventBox.add_actor(colorIndicator);
        		eventBox.add_actor(textVBox);
        		terminListe.add_actor(eventBox);
    		});
	} else {
    		/* Nur wenn wirklich nichts da ist, den Platzhalter zeigen */
    		terminListe.add_actor(
        		new St.Label({
            			text: _("No events"),
            			style_class: "termin-placeholder"
        		})
    	     	);
	}

	box.add_actor(terminListe);
     


    /* =====================================================
     * Zurück-Button zur Monatsansicht
     * WICHTIG:
     * - clicked (nicht button-press-event)
     * - KEIN EVENT_STOP
     * ===================================================== */
    	const backBtn = new St.Button({
        	label: _("Month view"),
        	style_class: "nav-button",
        	reactive: true,
        	can_focus: true
    	});

    	backBtn.connect("clicked", () => {
        	this.currentAnsicht = "MONAT";
        	this.render();
    	});

    	box.add_actor(backBtn);
    	this.contentBox.add_actor(box);
    }


    /* ================= JAHRESANSICHT ================= */

    private renderJahresAnsicht() {
        const grid = new St.Table({
            homogeneous: true,
            style_class: "year-grid"
        });

        for (let m = 0; m < 12; m++) {
            const btn = new St.Button({
                label: new Date(
                    this.angezeigtJahr,
                    m
                ).toLocaleString(this.LOCALE, { month: "short" }),
                style_class: "mini-month-button",
                reactive: true,
                can_focus: true
            });

            btn.connect("clicked", () => {
                this.angezeigtMonat = m;
                this.currentAnsicht = "MONAT";
                this.render();
            });

            grid.add(btn, {
                row: Math.floor(m / 3),
                col: m % 3
            });
        }

        this.contentBox.add_actor(grid);
    }
}

/* Export für requireModule */
(global as any).CalendarView = CalendarView;
