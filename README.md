

````markdown
# Projekt IT Calendar

**Cinnamon Spices Applet** – An extended calendar for Cinnamon, including holidays and system events.  
Written in **TypeScript**, compiled to `applet.js`.  

---

## 📝 Description

This applet provides a clear month, year, and day view directly in Cinnamon. Features include:  

- Display of holidays (including statutory holidays)  
- Integration of events via the `EventManager`  
- Navigation via mouse, scroll wheel, and keyboard  
- Tooltips with holiday and event information  

The main view is controlled by `CalendarView` (`calendarView.ts`) and runs inside an `AppletPopupMenu`.

---

## ⚙️ Installation (Developers)

1. Clone the repository:
```bash
git clone https://github.com/ArnoldSchiller/calendar.git
````

2. Navigate to the applet directory:

```bash
cd calendar
```

3. Compile TypeScript:

```bash
tsc
```

This generates `applet.js` from the `.ts` files.

4. Install the applet in Cinnamon:

   * Copy the applet directory to `~/.local/share/cinnamon/applets/`
   * Restart Cinnamon or press `Alt+F2 → r` to reload
   * Add the applet through Cinnamon settings

---

## 🛠️ Structure

```
calendar/
├─ metadata.json       # Applet metadata (UUID, name, description, icon, etc.)
├─ applet.js           # compiled TypeScript
├─ calendarView.ts     # main view (month/day/year)
├─ EventManager.ts     # event/appointment management
├─ kalenderlogik.ts    # day/holiday calculations
├─ locale/             # translations
├─ styles.css          # optional styling
└─ package.json        # Node/TypeScript dependencies
```

---

## 🧩 Usage

* **Month View:** default view showing days and weeks.
* **Day View:** click on a day to switch to detailed view.
* **Year View:** overview of all months, click to return to month view.
* **Holidays & Events:** highlighted visually and with tooltips.
* **Navigation:**

  * Mouse: scroll wheel → change month
  * Keyboard: arrow keys → change month/year

---

## 📄 License

This project is licensed under the **GPL-3.0 License**.

---

## 💡 Developer Notes

* `CalendarView.render()` must be called only after `navBox` & `contentBox` exist.
* Events are managed via the `EventManager`, which can provide external events.
* For TypeScript development:

  * Compile to `applet.js`
  * `.gitignore` should include `node_modules/` and `.tsbuildinfo`

---

## 🌐 Contact

Author: Arnold Schiller
UUID: `calendar@projektit.de`

```

---




```

