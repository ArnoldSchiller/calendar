"use strict";
/**
 * Project IT Calendar - Main Calendar View Component
 * =================================================
 *
 * This class is responsible for rendering and managing the
 * visual calendar views (MONTH / YEAR / DAY) inside the
 * Cinnamon applet.
 *
 * ------------------------------------------------------------------
 * ARCHITECTURAL DESIGN NOTES
 * ------------------------------------------------------------------
 *
 * 1. INSTANCE-BASED LOGIC
 * ----------------------
 * The calendar logic (holidays, date calculations, etc.) is handled
 * by a CalendarLogic *instance*, injected via the applet.
 *
 * This avoids static/global state and allows:
 * - per-applet configuration
 * - cleaner testability
 * - future multi-instance support
 *
 * 2. STATE-DRIVEN RENDERING
 * ------------------------
 * The UI is driven exclusively by internal state:
 *   - displayedYear
 *   - displayedMonth
 *   - currentView (MONTH | YEAR | DAY)
 *   - selectedDay
 *
 * Any state change triggers a full re-render via render().
 * No partial DOM mutation logic is used on purpose.
 *
 * 3. LOGICAL DECOUPLING
 * --------------------
 * CalendarView does NOT control the EventListView directly.
 * It only emits context updates (_updateExternalViews()).
 *
 * The left-hand view decides on its own how to react.
 *
 * 4. FUTURE WORK (ICS IMPORT)
 * ---------------------------
 * The ICS import button in the Year View is intentionally
 * a placeholder.
 *
 * File selection and parsing will later be implemented
 * using a FileChooserDialog and EventManager integration.
 *
 * ------------------------------------------------------------------
 *
 * @author Arnold Schiller
 * @link    https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarView = void 0;
const { St, Clutter, Gio } = imports.gi;
const { fileUtils: FileUtils } = imports.misc;
const Gettext = imports.gettext;
const Tooltips = imports.ui.tooltips;
/* === Dynamic Environment Detection ============================== */
const UUID = typeof __meta !== "undefined"
    ? __meta.uuid
    : "calendar@projektit.de";
const AppletDir = typeof __meta !== "undefined"
    ? __meta.path
    : imports.ui.appletManager.appletMeta[UUID].path;
Gettext.bindtextdomain(UUID, AppletDir + "/locale");
/**
 * Translation helper.
 * Tries applet domain first, then Cinnamon, then GNOME Calendar.
 */
function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    if (translated !== str)
        return translated;
    translated = Gettext.dgettext("cinnamon", str);
    if (translated !== str)
        return translated;
    return Gettext.dgettext("gnome-calendar", str);
}
/* =================================================================
 * CalendarView
 * ================================================================= */
class CalendarView {
    constructor(applet, uuid = "calendar@projektit.de") {
        this.currentView = "MONTH";
        this.selectedDay = null;
        this.LOCALE = undefined;
        this.applet = applet;
        this._uuid = uuid;
        const today = new Date();
        this.displayedYear = today.getFullYear();
        this.displayedMonth = today.getMonth();
        /* === Root Actor ========================================= */
        this.actor = new St.BoxLayout({
            vertical: true,
            style_class: "calendar-main-box",
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        // Allow child widgets (e.g. tooltips) to overflow
        this.actor.set_clip_to_allocation(false);
        /* === Input Handling ===================================== */
        // Mouse wheel: month navigation
        this.actor.connect("scroll-event", (_, event) => {
            const dir = event.get_scroll_direction();
            if (dir === Clutter.ScrollDirection.UP)
                this.scrollMonth(-1);
            if (dir === Clutter.ScrollDirection.DOWN)
                this.scrollMonth(1);
            return Clutter.EVENT_STOP;
        });
        // Keyboard navigation
        this.actor.connect("key-press-event", (_, event) => {
            switch (event.get_key_symbol()) {
                case Clutter.KEY_Left:
                    this.scrollMonth(-1);
                    return Clutter.EVENT_STOP;
                case Clutter.KEY_Right:
                    this.scrollMonth(1);
                    return Clutter.EVENT_STOP;
                case Clutter.KEY_Up:
                    this.scrollYear(-1);
                    return Clutter.EVENT_STOP;
                case Clutter.KEY_Down:
                    this.scrollYear(1);
                    return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        /* === Layout Containers ================================= */
        this.navBox = new St.BoxLayout({ style_class: "calendar-nav-box" });
        this.contentBox = new St.BoxLayout({ vertical: true });
        this.actor.add_actor(this.navBox);
        this.actor.add_actor(this.contentBox);
        this.render();
    }
    /**
     * Reset calendar to today's date and switch to month view.
     */
    resetToToday() {
        const today = new Date();
        this.displayedYear = today.getFullYear();
        this.displayedMonth = today.getMonth();
        this.currentView = "MONTH";
        this.render();
    }
    /**
     * Helper used by applet.ts to fetch holiday names for a date.
     */
    getHolidayForDate(date) {
        if (!this.applet.CalendarLogic)
            return null;
        const holidays = this.applet.CalendarLogic.getHolidaysForDate(date, "de");
        return holidays.length > 0
            ? { beschreibung: holidays.join(", ") }
            : null;
    }
    /* ============================================================
     * Navigation Bar
     * ============================================================ */
    renderNav() {
        this.navBox.destroy_children();
        const navContainer = new St.BoxLayout({
            style_class: "calendar-nav-box",
            x_align: St.Align.MIDDLE,
        });
        /* --- Month Selector ------------------------------------ */
        const monthBox = new St.BoxLayout({ style: "margin: 0 10px;" });
        const btnPrevM = new St.Button({
            label: "‹",
            style_class: "calendar-change-month-back",
        });
        btnPrevM.connect("clicked", () => this.scrollMonth(-1));
        const monthLabel = new St.Label({
            text: new Date(this.displayedYear, this.displayedMonth).toLocaleString(this.LOCALE, { month: "long" }),
            style_class: "calendar-month-label",
            style: "min-width: 100px; text-align: center;",
        });
        const btnNextM = new St.Button({
            label: "›",
            style_class: "calendar-change-month-forward",
        });
        btnNextM.connect("clicked", () => this.scrollMonth(1));
        monthBox.add_actor(btnPrevM);
        monthBox.add_actor(monthLabel);
        monthBox.add_actor(btnNextM);
        /* --- Year Selector ------------------------------------- */
        const yearBox = new St.BoxLayout({
            style: "margin: 0 10px; margin-left: 20px;",
        });
        const btnPrevY = new St.Button({
            label: "‹",
            style_class: "calendar-change-month-back",
        });
        btnPrevY.connect("clicked", () => this.scrollYear(-1));
        const yearBtn = new St.Button({
            label: this.displayedYear.toString(),
            style_class: "calendar-month-label",
            reactive: true,
        });
        yearBtn.connect("clicked", () => {
            this.currentView = "YEAR";
            this.render();
        });
        const btnNextY = new St.Button({
            label: "›",
            style_class: "calendar-change-month-forward",
        });
        btnNextY.connect("clicked", () => this.scrollYear(1));
        yearBox.add_actor(btnPrevY);
        yearBox.add_actor(yearBtn);
        yearBox.add_actor(btnNextY);
        navContainer.add_actor(monthBox);
        navContainer.add_actor(yearBox);
        this.navBox.add_actor(navContainer);
    }
    scrollYear(delta) {
        this.displayedYear += delta;
        this.selectedDay = null; //
        this.render();
    }
    scrollMonth(delta) {
        const d = new Date(this.displayedYear, this.displayedMonth + delta, 1);
        this.selectedDay = null; //
        this.displayedYear = d.getFullYear();
        this.displayedMonth = d.getMonth();
        this.render();
    }
    /**
     * Synchronize context with external views (EventListView).
     *
     */
    _updateExternalViews() {
        if (!this.applet.showEvents || !this.applet.eventListView)
            return;
        const elv = this.applet.eventListView;
        if (this.currentView === "DAY" || this.selectedDay !== null) {
            // Wir wollen Details für einen spezifischen Tag sehen
            const targetDate = new Date(this.displayedYear, this.displayedMonth, this.selectedDay || 1);
            const events = this.applet.eventManager.getEventsForDate(targetDate);
            // Nutzt die neue spezialisierte Methode
            elv.updateForDate(targetDate, events);
        }
        else {
            // Monatsübersicht (beim Blättern oder Initial)
            const events = this.applet.eventManager.getEventsForMonth(this.displayedYear, this.displayedMonth);
            // Nutzt die neue spezialisierte Methode für Monatslisten
            elv.updateForMonth(this.displayedYear, this.displayedMonth, events);
        }
    }
    /**
     * Öffentliche Methode, um von außen einen Tag anzuwählen
     * Wird aufgerufen, wenn in der Event-Liste ein Termin geklickt wird.
     */
    jumpToDate(date) {
        this.displayedYear = date.getFullYear();
        this.displayedMonth = date.getMonth();
        this.selectedDay = date.getDate();
        this.currentView = "DAY";
        this.render();
    }
    /**
     * Central render dispatcher.
     */
    render() {
        this.renderNav();
        this.contentBox.destroy_children();
        switch (this.currentView) {
            case "DAY":
                this.renderDayView();
                break;
            case "YEAR":
                this.renderYearView();
                break;
            default:
                this.renderMonthView();
                break;
        }
        const footer = new St.BoxLayout({
            style_class: "calendar-footer",
        });
        this.contentBox.add_actor(footer);
        this._updateExternalViews();
    }
    /* ============================================================
     * MONTH VIEW
     * ============================================================ */
    renderMonthView() {
        const grid = new St.Table({
            homogeneous: true,
            style_class: "calendar",
        });
        const colOffset = this.applet.showWeekNumbers ? 1 : 0;
        this.getDayNames().forEach((name, i) => {
            grid.add(new St.Label({
                text: name,
                style_class: "calendar-day-base",
            }), { row: 0, col: i + colOffset });
        });
        let iter = new Date(this.displayedYear, this.displayedMonth, 1);
        const firstWeekday = (iter.getDay() + 6) % 7;
        iter.setDate(iter.getDate() - firstWeekday);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let row = 1; row <= 6; row++) {
            if (this.applet.showWeekNumbers) {
                const kwDate = new Date(iter);
                kwDate.setDate(kwDate.getDate() + 3);
                grid.add(new St.Label({
                    text: this.getWeekNumber(kwDate).toString(),
                    style_class: "calendar-week-number",
                }), { row, col: 0 });
            }
            for (let col = 0; col < 7; col++) {
                const isOtherMonth = iter.getMonth() !== this.displayedMonth;
                const isToday = iter.getTime() === today.getTime();
                const hasEvents = !isOtherMonth &&
                    this.applet.eventManager.hasEvents(iter);
                const holidays = !isOtherMonth && this.applet.CalendarLogic
                    ? this.applet.CalendarLogic.getHolidaysForDate(iter, "de")
                    : [];
                const isHoliday = holidays.length > 0;
                const btnClasses = ["calendar-day"];
                if (isOtherMonth)
                    btnClasses.push("calendar-other-month-day");
                if (isToday)
                    btnClasses.push("calendar-today");
                if (iter.getDay() === 0 || isHoliday)
                    btnClasses.push("calendar-nonwork-day");
                const btn = new St.Button({
                    reactive: true,
                    can_focus: true,
                    style_class: btnClasses.join(" "),
                });
                const content = new St.BoxLayout({
                    vertical: true,
                    x_align: St.Align.MIDDLE,
                });
                content.add_actor(new St.Label({
                    text: iter.getDate().toString(),
                    style_class: "calendar-day-label",
                }));
                content.add_actor(new St.Label({
                    text: hasEvents ? "•" : " ",
                    style_class: "calendar-day-event-dot-label",
                }));
                btn.set_child(content);
                if (Tooltips.Tooltip) {
                    const tooltipLines = [];
                    holidays.forEach(h => tooltipLines.push(h));
                    if (hasEvents) {
                        const events = this.applet.eventManager.getEventsForDate(iter);
                        events.forEach((e) => tooltipLines.push(`• ${e.summary}`));
                    }
                    if (tooltipLines.length > 0) {
                        new Tooltips.Tooltip(btn, tooltipLines.join("\n"));
                    }
                }
                const d = iter.getDate();
                const m = iter.getMonth();
                const y = iter.getFullYear();
                btn.connect("clicked", () => {
                    this.selectedDay = d;
                    this.displayedMonth = m;
                    this.displayedYear = y;
                    this.currentView = "DAY";
                    this.render();
                });
                grid.add(btn, {
                    row,
                    col: col + colOffset,
                });
                iter.setDate(iter.getDate() + 1);
            }
        }
        this.contentBox.add_actor(grid);
    }
    /* ============================================================
     * YEAR VIEW
     * ============================================================ */
    renderYearView() {
        const yearBox = new St.BoxLayout({
            vertical: true,
            style_class: "year-view-container",
        });
        const actionArea = new St.BoxLayout({
            x_align: St.Align.MIDDLE,
            style: "padding: 10px;",
        });
        const importBtn = new St.Button({
            label: _("Import a Calendar"),
            style_class: "calendar-event-button",
            x_expand: true,
        });
        importBtn.connect("clicked", () => {
            global.log("[CalendarView] ICS import requested (not yet implemented)");
            this.onImportRequested?.();
        });
        actionArea.add_actor(importBtn);
        yearBox.add_actor(actionArea);
        const grid = new St.Table({
            homogeneous: true,
            style_class: "calendar",
        });
        for (let m = 0; m < 12; m++) {
            const btn = new St.Button({
                label: new Date(this.displayedYear, m).toLocaleString(this.LOCALE, {
                    month: "short",
                }),
                style_class: "calendar-month-label",
            });
            btn.connect("clicked", () => {
                this.displayedMonth = m;
                this.currentView = "MONTH";
                this.render();
            });
            grid.add(btn, {
                row: Math.floor(m / 3),
                col: m % 3,
            });
        }
        yearBox.add_actor(grid);
        this.contentBox.add_actor(yearBox);
    }
    /* ============================================================
     * DAY VIEW
     * ============================================================ */
    renderDayView() {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: "calendar-events-main-box",
        });
        const selectedDate = new Date(this.displayedYear, this.displayedMonth, this.selectedDay || 1);
        box.add_actor(new St.Label({
            text: selectedDate.toLocaleString(this.LOCALE, {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
            }),
            style_class: "day-details-title",
        }));
        if (this.applet.CalendarLogic) {
            const holidays = this.applet.CalendarLogic.getHolidaysForDate(selectedDate, "de");
            holidays.forEach(h => {
                const row = new St.BoxLayout({
                    style_class: "calendar-event-button",
                    style: "background-color: rgba(255,0,0,0.1);",
                });
                row.add_actor(new St.Label({
                    text: h,
                    style_class: "calendar-event-summary",
                }));
                box.add_actor(row);
            });
        }
        const events = this.applet.eventManager.getEventsForDate(selectedDate);
        if (events.length > 0) {
            events.forEach((ev) => {
                const row = new St.BoxLayout({
                    style_class: "calendar-event-button",
                });
                row.add_actor(new St.Label({
                    text: ev.summary,
                    style_class: "calendar-event-summary",
                }));
                box.add_actor(row);
            });
        }
        else if (box.get_n_children() === 1) {
            box.add_actor(new St.Label({
                text: _("No events"),
                style_class: "calendar-events-no-events-label",
            }));
        }
        const backBtn = new St.Button({
            label: _("Month view"),
            style_class: "nav-button",
            style: "margin-top: 15px;",
        });
        backBtn.connect("clicked", () => {
            this.currentView = "MONTH";
            this.render();
        });
        box.add_actor(backBtn);
        this.contentBox.add_actor(box);
    }
    /* ============================================================
     * Date Helpers
     * ============================================================ */
    getDayNames() {
        const formatter = new Intl.DateTimeFormat(this.LOCALE, {
            weekday: "short",
        });
        return [1, 2, 3, 4, 5, 6, 7].map(d => formatter.format(new Date(2024, 0, d)));
    }
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil(((d.getTime() - yearStart.getTime()) /
            86400000 +
            1) /
            7);
    }
}
exports.CalendarView = CalendarView;
/* === Hybrid Export for Cinnamon ================================ */
if (typeof exports !== "undefined") {
    exports.CalendarView = CalendarView;
}
global.CalendarView = CalendarView;
