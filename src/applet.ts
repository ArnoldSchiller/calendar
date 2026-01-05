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
// ============================================================================
// Project IT Calendar – Cinnamon Applet Entry Point
// ----------------------------------------------------------------------------
// This file represents the main entry point of the Cinnamon applet.
// It is responsible for:
//   - Initializing the applet instance
//   - Wiring together UI, logic, and event management
//   - Registering the applet with the Cinnamon panel infrastructure
//
// IMPORTANT RULE FOR THIS CLEANUP:
// --------------------------------
// * NO executable code has been changed.
// * ONLY comments were added, translated, or expanded.
// * Any potential architectural or technical improvement is noted as TODO
//   comments WITHOUT changing runtime behavior.
//
// The goal of this documentation is that even a reader with:
//   - no TypeScript knowledge
//   - no Cinnamon/GJS background
//   - no calendar domain expertise
// can still understand what happens here and why.
// ============================================================================

/* eslint-disable @typescript-eslint/no-unused-vars */

// ----------------------------------------------------------------------------
// GJS / Cinnamon Imports
// ----------------------------------------------------------------------------
// These imports expose native Cinnamon and GNOME APIs to JavaScript.
// In GJS, these are NOT npm modules but runtime-provided bindings.

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// ----------------------------------------------------------------------------
// Internal Project Imports
// ----------------------------------------------------------------------------
// These are local project modules compiled into the final applet bundle.
// They are attached to the global namespace by the build system.

const CalendarView = (global as any).CalendarView;
const EventManager = (global as any).EventManager;
const CalendarLogic = (global as any).CalendarLogic;

// ----------------------------------------------------------------------------
// Applet Class Definition
// ----------------------------------------------------------------------------
// This class is instantiated by Cinnamon when the applet is loaded.
// One instance exists per panel placement.

class ProjectITCalendarApplet extends Applet.Applet {
    // ------------------------------------------------------------------------
    // Core Components
    // ------------------------------------------------------------------------
    // These fields represent the main building blocks of the applet.
    // They are created once and reused for the lifetime of the applet.

    private menu: any;              // Popup menu attached to the panel icon
    private calendarView: any;      // Visual calendar UI (month/day views)
    private eventManager: any;      // Handles system calendar integration (EDS)
    private calendarLogic: any;     // Pure date/holiday calculation logic

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    // Called automatically by Cinnamon.
    // The parameters are provided by the panel and must not be changed.

    constructor(metadata: any, orientation: any, panelHeight: number, instanceId: number) {
        super(orientation, panelHeight, instanceId);

        // Set the tooltip shown when hovering over the panel icon
        this.set_applet_tooltip("Calendar");

        // --------------------------------------------------------------------
        // Popup Menu Initialization
        // --------------------------------------------------------------------
        // Cinnamon applets typically show UI inside a popup menu.
        // The menu is anchored to the applet actor (panel icon).

        this.menu = new PopupMenu.PopupMenu(this, 0.0, St.Side.TOP);
        Main.uiGroup.add_actor(this.menu.actor);
        this.menu.actor.hide();

        // --------------------------------------------------------------------
        // Core Service Initialization
        // --------------------------------------------------------------------
        // These components are intentionally decoupled:
        //   - EventManager: system calendar access (EDS, DBus)
        //   - CalendarLogic: pure logic, no UI, no IO
        //   - CalendarView: UI only, reacts to signals

        this.eventManager = new EventManager(metadata.uuid);
        this.calendarLogic = new CalendarLogic();

        // --------------------------------------------------------------------
        // View Initialization
        // --------------------------------------------------------------------
        // CalendarView is responsible for rendering and navigation.
        // It receives references to the applet and manager but does not
        // perform IO or DBus operations itself.

        this.calendarView = new CalendarView(
            this,
            this.menu,
            this.eventManager,
            this.calendarLogic
        );

        // --------------------------------------------------------------------
        // Signal Wiring
        // --------------------------------------------------------------------
        // The EventManager emits signals when calendar data changes.
        // The view listens and re-renders accordingly.

        this.eventManager.connect('events-updated', () => {
            this.calendarView.render();
        });

        // --------------------------------------------------------------------
        // Initial Render
        // --------------------------------------------------------------------
        // Ensures the UI is visible immediately, even if real data
        // has not yet arrived from the system calendar.

        this.calendarView.render();
    }

    // ------------------------------------------------------------------------
    // Applet Click Handler
    // ------------------------------------------------------------------------
    // This method is called automatically by Cinnamon when the user
    // clicks the panel icon.

    on_applet_clicked(event: any): void {
        this.menu.toggle();
    }

    // ------------------------------------------------------------------------
    // Applet Removal Cleanup
    // ------------------------------------------------------------------------
    // Called when the applet is removed from the panel or Cinnamon restarts.
    // Used to free resources and avoid dangling actors.

    on_applet_removed_from_panel(): void {
        if (this.menu) {
            this.menu.destroy();
        }
    }
}

// ----------------------------------------------------------------------------
// Required Entry Point
// ----------------------------------------------------------------------------
// Cinnamon looks specifically for a function named `main`.
// It must return an instance of the applet class.

function main(metadata: any, orientation: any, panelHeight: number, instanceId: number) {
    return new ProjectITCalendarApplet(metadata, orientation, panelHeight, instanceId);
}

// ----------------------------------------------------------------------------
// TODOs (DOCUMENTATION ONLY – NO CODE CHANGES)
// ----------------------------------------------------------------------------
// TODO: Consider lazy-initializing CalendarView only when the menu is opened
//       to reduce startup overhead.
//
// TODO: Consider explicit disconnect of EventManager signals on destroy
//       for additional safety, although Cinnamon usually cleans this up.
//
// TODO: Evaluate whether CalendarLogic could be fully stateless and shared
//       across multiple applet instances in the future.
//
// TODO: Add high-level architectural diagram to project documentation
//       explaining the separation between View, Logic, and Manager.
// ============================================================================
