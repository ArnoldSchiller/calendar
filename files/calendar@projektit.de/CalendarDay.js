"use strict";
/**
 * Project IT Calendar - Day Interface & Type Definitions
 * =======================================================
 *
 * This file contains TypeScript type definitions and interfaces
 * used throughout the calendar application for type-safe date handling.
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * -----------------------------
 * This file contains ONLY type definitions - it produces NO JavaScript
 * output when compiled. These types exist purely for TypeScript's
 * static type checking and development-time tooling.
 *
 * Why separate type definitions?
 * 1. Centralized type management: All date-related types in one place
 * 2. Reusability: Multiple components can import the same types
 * 3. Consistency: Ensures all components use the same type definitions
 * 4. Documentation: Serves as living documentation of the data model
 *
 * ------------------------------------------------------------------
 * TYPE SYSTEM IN CINNAMON/GJS CONTEXT:
 * ------------------------------------------------------------------
 * TypeScript types are STRIPPED at compile time when using:
 * - Module: "None" in tsconfig.json
 * - OutFile: Single-file bundling for Cinnamon applets
 *
 * This means:
 * - These interfaces EXIST only during development
 * - They provide IDE autocompletion and error checking
 * - They are REMOVED in production (no runtime overhead)
 * - No global export needed (types don't exist at runtime)
 *
 * ------------------------------------------------------------------
 * USAGE BY OTHER COMPONENTS:
 * ------------------------------------------------------------------
 * 1. CalendarLogic.ts (Primary Consumer):
 *    - Uses DayType enum to categorize days
 *    - Uses CalendarDay interface for structured date information
 *    - Provides type-safe holiday calculations
 *
 * 2. CalendarView.ts (Potential Consumer):
 *    - Could use these types for day cell rendering
 *    - Ensures consistency between logic and view layers
 *
 * 3. EventManager.ts (Potential Consumer):
 *    - Could use CalendarDay for event-date associations
 *
 * ------------------------------------------------------------------
 * @author Arnold Schiller <calendar@projektit.de>
 * @link https://github.com/ArnoldSchiller/calendar
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
Object.defineProperty(exports, "__esModule", { value: true });
/* ================================================================
 * TYPE GUARD FUNCTIONS (Potential Future Enhancement)
 * ================================================================
 *
 * These functions don't exist yet but show how types could be used:
 *
 * function isWorkDay(day: CalendarDay): boolean {
 *     return day.type === 'WORKDAY';
 * }
 *
 * function isHoliday(day: CalendarDay): boolean {
 *     return day.type === 'PUBLIC_HOLIDAY' || day.type === 'OBSERVANCE';
 * }
 *
 * function isWeekend(day: CalendarDay): boolean {
 *     return day.type === 'WEEKEND';
 * }
 */
/* ================================================================
 * DEVELOPER NOTES
 * ================================================================
 *
 * NO GLOBAL EXPORT NEEDED:
 * ------------------------
 * Unlike other files in this project, we DO NOT use:
 *   (global as any).CalendarDay = CalendarDay;
 *
 * Reason: These are TypeScript-only type definitions that are
 * completely removed during compilation. They don't exist at
 * runtime in the GJS/Cinnamon environment.
 *
 * COMPILATION BEHAVIOR:
 * ---------------------
 * With tsconfig.json setting: "module": "none"
 * - TypeScript interfaces and type aliases produce NO JavaScript
 * - They exist only for type checking during development
 * - No runtime code is generated for this file
 *
 * This is intentional and correct for type definition files.
 */
/* ================================================================
 * EXAMPLE USAGE IN OTHER FILES
 * ================================================================
 *
 * // In CalendarLogic.ts:
 * import { CalendarDay, DayType } from './CalendarDay';
 *
 * function createCalendarDay(date: Date, holidayName: string): CalendarDay {
 *     return {
 *         dayNumber: date.getDate().toString(),
 *         date: date,
 *         type: holidayName ? 'PUBLIC_HOLIDAY' : 'WORKDAY',
 *         description: holidayName,
 *         isPublic: !!holidayName
 *     };
 * }
 *
 * // In CalendarView.ts (if using TypeScript strictly):
 * function renderDayCell(day: CalendarDay) {
 *     // TypeScript knows day has dayNumber, type, description, etc.
 *     applyStyle(day.type);  // Type-safe access
 *     setText(day.dayNumber);
 * }
 */
/* ================================================================
 * TODOs AND FUTURE ENHANCEMENTS
 * ================================================================
 *
 * TODO: Add DayColor interface for theming support
 * TODO: Add CalendarWeek type for week-based operations
 * TODO: Add DateRange type for event span calculations
 * TODO: Add type guard functions for runtime type checking
 * TODO: Consider adding i18n keys to descriptions for translation
 */ 
