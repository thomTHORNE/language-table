# Developer Guide: `language-table.js`

This guide explains the internal architecture and implementation details of `language-table.js`. It is intended for developers who need to add features, fix bugs, or otherwise maintain the translation table UI.

---

## 1. Architecture Overview

### 1.1 Responsibilities of `language-table.js`

`language-table.js` is a self-contained client-side controller for the "language/translation table" UI. Its responsibilities are:

- Maintain the in-memory representation of translations (`modifiedDataSource`).
- Track UI state (edit mode, search, sort, collapsed columns, pagination, etc.).
- Render the table header, body, and pagination controls into the DOM.
- Handle all user interactions (cell editing, search input, sort toggling, pagination, discarding changes, column collapse).
- Expose `modifiedDataSource` globally so server-side code can read the latest edits.

### 1.2 High-Level Structure

Key top-level elements (see lines 5–22, 29–36):

- **Global variables**
  - `originalDataSource` (provided externally, typically from server-side rendering).
  - `modifiedDataSource` (line 5) – deep clone of `originalDataSource`, mutated by the UI.
- **Central `state` object** (lines 9–22)
  - Tracks all transient UI state (edit mode, search, sort, pagination, etc.).
- **Initialization block** (lines 29–36)
  - On `DOMContentLoaded`, calls `initializeData()`, `initializeEventListeners()`, `renderTable()` if `originalDataSource` exists.
- **Feature sections**
  - Clearly separated by comment banners:
    - Global State / Initialization
    - Table Rendering
    - Edit Mode
    - Search Functionality
    - Sorting Functionality
    - Discard Changes
    - UI Updates
    - Pagination Functionality

### 1.3 State-Driven Rendering Pattern

The overall pattern is:

1. **Mutate state and/or `modifiedDataSource`.**
2. **Call `renderTable()`** to re-render header + body + pagination.
3. **Call `updateUI()`** when `hasUnsavedChanges` changes.

`renderTable()` (lines 75–80) is the core entry point for drawing the UI. It:

- Chooses `dataToRender` based on `state.isSearchActive` (`modifiedDataSource` vs. `getSearchResults()`).
- Calls `renderTableHeader()`.
- Calls `renderTableBody(dataToRender)` and obtains `totalRows`.
- Calls `renderPagination(totalRows)`.

### 1.4 Separation of Concerns

- **Data & state:**
  - `originalDataSource`, `modifiedDataSource`, and `state` keep data and UI state separate from rendering.
- **Rendering:**
  - `renderTableHeader`, `renderTableBody`, `renderPagination` (+ helpers) are responsible only for DOM creation / updates based on current state.
- **Event handling & behavior:**
  - `initializeEventListeners` wires DOM events into handler functions.
  - Handlers (`handleCellClick`, `handleSearchInput`, `cycleSortState`, `goToPage`, etc.) mutate state and then trigger re-renders.

---

## 2. State Management

### 2.1 `state` Object Structure

Defined at lines 9–22:

```js
const state = {
  initialized: false,
  currentEditCell: null,
  hasUnsavedChanges: false,
  searchQuery: '',
  searchDebounceTimer: null,
  sortState: {},
  collapsedColumns: new Set(),
  isSearchActive: false,
  pagination: {
    currentPage: 1,
    rowsPerPage: 25,
    rowsPerPageOptions: [25, 50, 100]
  }
};
```

### 2.2 Property-by-Property

- `initialized: boolean`
  - Guard to avoid registering duplicate DOM event listeners.
  - Used in `initializeEventListeners()` (lines 45–50).
- `currentEditCell: HTMLTableCellElement | null`
  - Points to the `<td>` currently in edit mode (see `enterEditMode` / `exitEditMode`).
  - `null` when not editing.
- `hasUnsavedChanges: boolean`
  - True if `modifiedDataSource` differs from `originalDataSource`.
  - Set to `true` in `saveEdit()` (lines 320–327).
  - Set to `false` in `handleDiscardChanges()` (lines 469–477).
  - Controls visibility of unsaved-changes notification and discard button in `updateUI()`.
- `searchQuery: string`
  - Current text in the search input.
  - Set in `performSearch()` (line 380).
  - Used by `getSearchResults()` (lines 394–435).
- `searchDebounceTimer: number | null`
  - Stores the timer ID for debounced search in `handleSearchInput()` (lines 353–365).
- `sortState: { [columnIndex: number]: 'asc' | 'desc' } | {}`
  - At most one entry at a time (enforced by `cycleSortState`, lines 450–460).
  - Key: column index (stringified when accessing via `Object.keys`).
  - Value: `'asc'`, `'desc'`, or absent (meaning no sort).
- `collapsedColumns: Set<number>`
  - Indices of columns whose cells are visually collapsed.
  - Used in `renderTableHeader()` (lines 104–107) and `renderTableBody()` (lines 185–188).
- `isSearchActive: boolean`
  - True when `searchQuery.trim() !== ''` (line 381).
  - Controls whether `renderTable()` uses `modifiedDataSource` or `getSearchResults()`.
- `pagination: { currentPage, rowsPerPage, rowsPerPageOptions }`
  - `currentPage: number` – 1-based page index (lines 18–21).
  - `rowsPerPage: number` – number of rows per page.
  - `rowsPerPageOptions: number[]` – allowed options for the rows-per-page selector.

### 2.3 Where to Add New State

- Add new top-level flags or nested objects directly on `state`.
- Keep **derived state** (that can be recomputed from other state) out of `state` to avoid inconsistencies.
- Whenever new state affects what is shown, ensure it is respected inside `renderTable()` and/or its helpers.

---

## 3. Data Flow

### 3.1 `originalDataSource` vs. `modifiedDataSource`

- `originalDataSource`
  - Provided globally by server-side code.
  - Must not be mutated directly.
- `modifiedDataSource` (line 5)
  - Deep clone of `originalDataSource`, created in `initializeData()` (lines 38–43).
  - **All edits** are applied to `modifiedDataSource`.
  - Used as the **single source of truth for columns and translations** when rendering.

```js
function initializeData() {
  if (originalDataSource && originalDataSource.length > 0) {
    modifiedDataSource = JSON.parse(JSON.stringify(originalDataSource));
  }
}
```

**Key rule:** `modifiedDataSource` indices are always used for column mapping to keep a stable alignment between table columns and language entries, regardless of search or filtering.

### 3.2 Rendering and Re-rendering

Typical flow for any user action:

1. Event handler runs (e.g., `handleCellClick`, `performSearch`, `cycleSortState`, `goToPage`).
2. Handler may:
   - Exit edit mode (`exitEditMode(true|false)`).
   - Mutate `modifiedDataSource`.
   - Mutate `state` (search, sort, pagination, collapse, etc.).
3. Handler calls `renderTable()` to recompute and rebuild the DOM based on current state.
4. If `hasUnsavedChanges` changed, handler calls `updateUI()` to refresh notification controls.

### 3.3 Editing Flow

- User clicks a value cell → `handleCellClick()` (lines 253–276).
- If another cell is already in edit mode:
  - `exitEditMode(true)` discards its changes and re-renders the table.
  - Afterwards, `handleCellClick` finds the new cell by `data-key`/`data-lang-index` in the fresh DOM and enters edit mode.
- `enterEditMode()` (lines 278–318) replaces cell content with a `<textarea>` and save/cancel buttons.
- `saveEdit()` (lines 320–333) writes the new value into `modifiedDataSource[langIndex].Translations[key]`, sets `hasUnsavedChanges = true`, calls `updateUI()`, exits edit mode, then `renderTable()`.

### 3.4 Search Flow

- User types into search input:
  - `handleSearchInput()` (lines 353–365) updates the clear button visibility, debounces, then calls `performSearch(query)`.
- `performSearch()` (lines 374–391):
  - Exits edit mode (discarding changes) if active.
  - Updates `state.searchQuery` and `state.isSearchActive`.
  - Clears `state.sortState` so sorting is disabled while searching.
  - Resets `state.pagination.currentPage = 1`.
  - Calls `renderTable()`.
- `renderTable()` uses `getSearchResults()` (lines 394–435) when `state.isSearchActive` is true.
- `getSearchResults()`:
  - Builds a **new array** of language entries with filtered `Translations` objects, but preserves the outer array length and indices to match `modifiedDataSource`.

### 3.5 Sorting Flow

- User clicks a column header’s sort indicator:
  - `cycleSortState(columnIndex)` (lines 450–462) cycles sort for that column through: none → ascending → descending → none, resetting other columns.
  - Calls `renderTable()`.
- In `renderTableBody()` (lines 147–205):
  - `getAllKeys(data)` gathers all unique keys from the data currently being rendered (search results or `modifiedDataSource`).
  - `applySortingToKeys(allKeys)` sorts the keys **using `modifiedDataSource[columnIndex]`** as the value source, ensuring consistent column mapping regardless of search.

### 3.6 Pagination Flow

- `renderTableBody()` slices the sorted key list for the current page before rendering rows (lines 162–167).
- `renderPagination(totalRows)` (lines 524–531) computes page counts and delegates to:
  - `renderPaginationInfo(totalRows)`.
  - `renderPaginationControls(totalPages)`.
  - `updatePaginationButtons(totalPages)`.
- `goToPage(page)` (lines 636–654) validates the page, exits edit mode if needed, updates `state.pagination.currentPage`, then `renderTable()`.
- `handleRowsPerPageChange()` (lines 656–667) updates `rowsPerPage`, resets `currentPage = 1`, exits edit mode, and re-renders.

### 3.7 Discard Changes Flow

- `handleDiscardChanges()` (lines 469–479) performs a full reset:
  - Deep clones `originalDataSource` back into `modifiedDataSource`.
  - Resets `state.hasUnsavedChanges` and `state.currentEditCell`.
  - Calls `updateUI()` and `renderTable()`.

---

## 4. Core Functions by Category

### 4.1 Initialization

- `initializeData()` (lines 38–43)
  - Deep clones `originalDataSource` into `modifiedDataSource`.
- `initializeEventListeners()` (lines 45–69)
  - Guarded by `state.initialized` to avoid duplicate listeners.
  - Wires up:
    - Search input → `handleSearchInput`.
    - Clear search → `handleClearSearch`.
    - Discard changes → `handleDiscardChanges`.
    - Document click → `handleDocumentClick`.
    - Pagination buttons/selects → `initializePaginationListeners()`.
- `initializePaginationListeners()` (lines 510–522)
  - Wires prev/next buttons and rows-per-page `<select>` to `goToPage` / `handleRowsPerPageChange`.

### 4.2 Rendering

- `renderTable()` (lines 75–80)
  - Central orchestrator for header, body, and pagination.
- `renderTableHeader()` (lines 82–145)
  - Clears `<thead>` and rebuilds the header row.
  - For each language in `modifiedDataSource`:
    - Creates column headers with sort and collapse controls.
    - Uses index as `data-column-index` and in `state.collapsedColumns`.
- `renderTableBody(data)` (lines 147–205)
  - Computes all unique keys via `getAllKeys(data)`.
  - Applies sorting (`applySortingToKeys`).
  - Applies pagination (slice keys for current page).
  - Renders each row:
    - Key cell.
    - One value cell per language index in `modifiedDataSource`, assigning `data-key` and `data-lang-index`.
    - Attaches `handleCellClick` to each value cell.
- `renderPagination(totalRows)` (lines 524–531)
  - Computes total pages from `totalRows` and `state.pagination.rowsPerPage`.
  - Delegates to info text, page buttons, and prev/next button state.

Helpers:

- `getAllKeys(data)` (lines 207–213) – collects unique keys across all language `Translations`.
- `getTextFromHTML(html)` (lines 242–247) – strips HTML tags for sort comparisons.

### 4.3 Edit Mode

- `handleCellClick(e, key, langIndex, currentValue)` (lines 253–276)
  - Main entry for entering edit mode.
  - Prevents editing multiple cells at once by exiting any existing edit mode first.
  - Re-finds the cell in the DOM after a re-render when switching which cell is edited.
- `enterEditMode(cell, key, langIndex, currentValue)` (lines 278–318)
  - Marks `state.currentEditCell` and adds the `editing` CSS class.
  - Replaces cell content with:
    - `textarea.edit-input` pre-filled with `currentValue`.
    - Save (`✔`) and cancel (`✖`) buttons.
- `saveEdit(_cell, key, langIndex, newValue)` (lines 320–333)
  - Writes new value into `modifiedDataSource`.
  - Sets `state.hasUnsavedChanges = true` and calls `updateUI()`.
  - Calls `exitEditMode(false)` and re-renders the table.
- `exitEditMode(discard)` (lines 335–347)
  - Clears edit state and `editing` class on `state.currentEditCell`.
  - When `discard === true`, calls `renderTable()` to restore original cell content.

### 4.4 Search

- `handleSearchInput(e)` (lines 353–365)
  - Displays/hides clear button.
  - Debounces calls to `performSearch` using `state.searchDebounceTimer`.
- `handleClearSearch()` (lines 367–372)
  - Clears input, hides clear button, and calls `performSearch('')`.
- `performSearch(query)` (lines 374–391)
  - Exits edit mode (discarding changes) if active.
  - Sets `state.searchQuery` and `state.isSearchActive`.
  - Clears `state.sortState` when search is active.
  - Resets `state.pagination.currentPage = 1`.
  - Calls `renderTable()`.
- `getSearchResults()` (lines 394–435)
  - Builds a filtered copy of `modifiedDataSource`, keeping language order and length.
  - Uses a case-insensitive regex built from `state.searchQuery`.
  - Matches against both keys and values.
  - Catches regex errors and falls back to `modifiedDataSource`.

### 4.5 Sorting

- `cycleSortState(columnIndex)` (lines 450–462)
  - Cycles sort state for one column: none → `'asc'` → `'desc'` → none.
  - Stores state in `state.sortState` and re-renders.
- `applySortingToKeys(keys)` (lines 215–239)
  - Reads the first (and only) key from `state.sortState`.
  - Uses `modifiedDataSource[columnIndex].Translations[key]` and `getTextFromHTML` for comparison.
  - Returns a new array of sorted keys.

### 4.6 Column Collapse

- `toggleColumnCollapse(columnIndex)` (lines 441–447)
  - Adds/removes `columnIndex` from `state.collapsedColumns`.
  - Calls `renderTable()`.
  - Header and body rendering check `state.collapsedColumns` to add CSS classes for collapsed state.

### 4.7 Pagination

- `renderPaginationInfo(totalRows)` (lines 533–546)
  - Displays "Showing X–Y of Z entries" or "No entries to display".
- `renderPaginationControls(totalPages)` (lines 548–577)
  - Clears page buttons container.
  - Uses `getPageNumbers(currentPage, totalPages)` to decide which page numbers and ellipses to show.
- `getPageNumbers(currentPage, totalPages)` (lines 580–625)
  - Implements a smart windowing algorithm around the current page with ellipses.
- `updatePaginationButtons(totalPages)` (lines 628–634)
  - Disables/enables prev/next buttons depending on `currentPage`.
- `goToPage(page)` (lines 636–654)
  - Validates page number against total pages computed from current data and `rowsPerPage`.
  - Exits edit mode if active.
  - Sets `state.pagination.currentPage` and re-renders.
- `handleRowsPerPageChange(e)` (lines 656–667)
  - Parses rows-per-page value, exits edit mode, sets `rowsPerPage`, resets `currentPage` to 1, and re-renders.

### 4.8 UI Helpers

- `updateUI()` (lines 485–493)
  - Shows/hides unsaved-changes notification and discard button based on `state.hasUnsavedChanges`.
- `handleDocumentClick(e)` (lines 495–503)
  - If a click occurs outside the currently edited cell, exits edit mode and discards changes.

---

## 5. Key Implementation Details & Rationale

### 5.1 Why `modifiedDataSource` Indices Are Always Used for Column Mapping

- Headers and body both iterate over `modifiedDataSource` to render columns.
- Search returns a **parallel array** (same length and indices), but with filtered `Translations` maps.
- Sorting (`applySortingToKeys`) reads from `modifiedDataSource[columnIndex]` even when the table shows search results.
- This avoids misalignment when search/filter changes which keys are visible; the physical columns always correspond to the same language index.

### 5.2 Single Active Edit Cell

- `state.currentEditCell` ensures only one cell is editable at a time.
- `handleCellClick`:
  - No-op if clicking the same cell already being edited.
  - Otherwise exits the existing edit (via `exitEditMode(true)`), re-renders, and then enters edit mode in the newly clicked cell.
- `handleDocumentClick` exits edit mode when clicking outside the active cell.

This design simplifies DOM management and prevents inconsistent partial edits.

### 5.3 Search, Sorting, and Pagination Interaction

- Search and sorting are mutually exclusive:
  - When `performSearch` sets `isSearchActive` to true, it also clears `sortState`.
  - Sorting can then be re-enabled by clicking a column header after search, which uses the currently visible keys.
- Pagination always operates on the set of keys produced from the current `dataToRender`:
  - When search is active, `getAllKeys` and pagination are applied to the filtered set.
  - When search is cleared, they apply to all keys from `modifiedDataSource`.
- Whenever search query or rows per page change, `currentPage` is reset to 1 to avoid empty pages.

### 5.4 Debounce Pattern for Search

- `handleSearchInput` uses `setTimeout` and `clearTimeout` with `state.searchDebounceTimer`:
  - Delays invocation of `performSearch` by 300ms after the user stops typing.
  - Prevents excessive re-renders on every keystroke.

### 5.5 Page Number Windowing Algorithm with Ellipsis

Implemented in `getPageNumbers(currentPage, totalPages)`:

- If `totalPages <= 7`, all page numbers are shown.
- Otherwise:
  - Always show page `1` and `totalPages`.
  - Compute a sliding window around the current page (size `windowSize = 2`).
  - When near the start or end, the window expands to keep a sensible number of visible pages.
  - Ellipses (`'...'`) are inserted when there is a gap between the first page and window start, or between window end and last page.

This gives a compact, user-friendly pagination bar.

---

## 6. Adding New Features

### 6.1 Adding New State

- Add new fields to the `state` object at the top of the file.
- Prefer primitives and small objects; if you need complex derived data, compute it in rendering functions instead.
- If new state affects multiple UI areas, document it in this guide and ensure it is reset appropriately when discarding changes or resetting the table.

### 6.2 Triggering Re-renders Correctly

- **Any time visible data or state changes**, call `renderTable()`.
- When the change affects unsaved status, call `updateUI()` as well.
- Avoid partial DOM manipulation outside the existing rendering functions; instead, update state and re-render.

### 6.3 Integrating with Existing Event Listeners

- Add new listeners in `initializeEventListeners()` or a dedicated initializer (similar to `initializePaginationListeners`).
- Guard against multiple initializations using `state.initialized` or a dedicated flag if needed.
- In the event handler:
  - Exit edit mode first if the action will change which cells/rows are visible.
  - Update relevant `state` properties.
  - Call `renderTable()` and, if appropriate, `updateUI()`.

### 6.4 Common Patterns to Follow

- **Exit edit mode before major state changes**
  - For operations that re-calculate keys, pages, or rows (search, pagination, discard changes, rows-per-page change), always call `exitEditMode(true)` first if `state.currentEditCell` is not null.
- **Use `modifiedDataSource` as the canonical data source**
  - Do not rely on DOM contents for data; always read/write translations through `modifiedDataSource`.
- **Deep clone when resetting from `originalDataSource`**
  - Use `JSON.parse(JSON.stringify(...))` as done in `initializeData` and `handleDiscardChanges` to avoid accidental shared references.
- **Reset pagination on data-shape changes**
  - When the effective set of keys changes (e.g., search or rows-per-page change), reset `currentPage` to `1`.

### 6.5 Example: Adding a New Global Filter

When implementing a new filter (e.g., show only keys missing in some language):

1. Add a new property on `state` (e.g., `state.showMissingOnly = false`).
2. Add UI controls and wire them to a new handler in `initializeEventListeners()`.
3. In the handler:
   - Exit edit mode if active.
   - Update `state.showMissingOnly`.
   - Reset `state.pagination.currentPage = 1`.
   - Call `renderTable()`.
4. In `renderTable()` or in a new helper, derive the `dataToRender` (for example, by wrapping `getSearchResults()` with additional filtering).

---

## 7. Common Gotchas & Best Practices

- **Always use `modifiedDataSource` for column indexing.**
  - Do not rely on filtered/search arrays for column positions.
  - Headers, body, and sorting all assume `modifiedDataSource[index]` defines the Nth column.
- **Always exit edit mode before major state changes.**
  - Before search, pagination changes, discarding changes, or changing rows-per-page, call `exitEditMode(true)` if `state.currentEditCell` is set.
  - This prevents stale references to DOM elements and inconsistent UI.
- **Deep clone when resetting from `originalDataSource`.**
  - Avoid mutating `originalDataSource` or shallow-copying it.
  - Use the same deep-cloning approach as `initializeData` and `handleDiscardChanges`.
- **Reset pagination to page 1 when data changes.**
  - Search, changing rows-per-page, or any operation that changes the set of keys should reset `state.pagination.currentPage`.
- **Remember to call `updateUI()` when changing `hasUnsavedChanges`.**
  - If you add new flows that change `hasUnsavedChanges`, ensure `updateUI()` is called so the notification and discard button remain in sync.
- **Be careful with HTML content in translations.**
  - `renderTableBody` assigns `valueCell.innerHTML = value`, so translations may contain HTML.
  - Sorting uses `getTextFromHTML` to compare textual content.
  - When editing, the raw HTML string is shown in the textarea.
- **Search uses regex under the hood.**
  - User input is escaped to form a literal regex, but malformed patterns still might throw; these are caught and logged, and the code falls back to showing all results.
- **Avoid directly manipulating DOM outside rendering functions.**
  - For consistency, treat the table as derived from `state`/`modifiedDataSource`, and change those instead.

---

By understanding these architectural decisions and patterns, you should be able to safely extend `language-table.js`, implement new behavior, and debug issues in the table UI without introducing subtle state or rendering bugs.

