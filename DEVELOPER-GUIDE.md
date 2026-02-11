# Developer Guide: Language Table UI

This guide explains how the current implementation of the language/translation table works and how to integrate and extend it. It is intended as an onboarding document for developers who need to add features, fix bugs, or embed this UI into another application.

---

## 1. Project overview

This repository is a **standalone, browser-based translation table** for editing key/value pairs where values can contain rich HTML.

- **Tech stack:** plain HTML, CSS, and vanilla JavaScript; [Quill](https://quilljs.com/) is used as a rich text editor inside a modal dialog.
- **Primary entry point:** `index.html` (loads the table markup, sample data, styles, Quill, and `language-table.js`).
- **Core logic:** `language-table.js` – responsible for rendering the table, managing state, handling search/sort/pagination, and launching the Quill-based edit modal.

The UI is designed to be embedded into a larger server-side app: the server provides the initial translation data, and reads back the edited data via a hidden form post.

---

## 2. Repository structure

- `index.html` – Main HTML page demonstrating the language table.
  - Declares `originalDataSource` (sample translation data).
  - Defines the hidden `<form>` and `submitTranslations()` helper used to POST edits back to the server.
  - Contains the modal markup for the Quill editor and code view.
  - Includes Quill CSS/JS and the `language-table.js` script.
- `language-table.js` – All client-side behavior and rendering logic for the table.
  - Manages global UI state and `modifiedDataSource`.
  - Renders header/body and pagination.
  - Integrates the Quill editor in a modal for editing values.
- `styles.css` – Layout and styling for the toolbar, table, pagination, edit modal, and Quill overrides.
- `quilljs/` – Local copy of Quill JS and CSS assets (Snow theme) used by the modal editor. These are treated as third-party, vendor files.

There is no build step or bundler; everything runs directly in the browser.

---

## 3. Data model & host integration

### 3.1 Data shape

Both the server-provided data and the client-modified data share the same structure:

- Top-level: `Array<Language>`
- `Language` object:
  - `LanguageTwoLetter: string` – language code (e.g. `"en"`, `"hr"`).
  - `Translations: { [key: string]: string }` – mapping from translation key to **HTML string**.

Example (simplified):

```js
var originalDataSource = [
  {
    LanguageTwoLetter: 'en',
    Translations: {
      status_payment_aggregated: 'Aggregated',
      email_payment_slip_HRK: '<div>…rich HTML…</div>'
    }
  },
  {
    LanguageTwoLetter: 'hr',
    Translations: {
      status_payment_aggregated: 'Agregiran'
    }
  }
];
```

### 3.2 `originalDataSource` and `modifiedDataSource`

- `originalDataSource`
  - Defined globally **before** `language-table.js` is loaded (see `index.html`).
  - Represents the authoritative data from the server.
  - Must **never** be mutated by the UI code.
- `modifiedDataSource`
  - Global variable defined in `language-table.js`.
  - Deep clone of `originalDataSource`, created in `initializeData()`.
  - All edits are applied to `modifiedDataSource` and rendered from there.
  - This is what should be serialized and sent back to the server.

### 3.3 Submitting data back to the server

`index.html` includes a hidden form and a helper function:

- Hidden form (`#translations-form`) with a hidden `<input id="translations-json">`.
- `submitTranslations()` (defined inline in `index.html`):
  - Serializes `modifiedDataSource` with `JSON.stringify`.
  - Writes it into the hidden input.
  - Submits the form to the configured `action` URL.

To integrate into your own app:

1. Render an `originalDataSource` JavaScript variable on the page with your real data.
2. Ensure the hidden form/action URL match your backend endpoint.
3. Wire your own “Save” button to call `submitTranslations()`.

---

## 4. JavaScript architecture (`language-table.js`)

### 4.1 Global state

`language-table.js` declares:

- `modifiedDataSource: Language[]` – mutable copy of the server data.
- `state` – single object holding transient UI state:
  - `initialized: boolean` – prevents multiple event binding.
  - `hasUnsavedChanges: boolean` – drives the unsaved banner and discard button.
  - `searchQuery: string` and `searchDebounceTimer: number | null`.
  - `sortState: { [columnIndex: number]: 'asc' | 'desc' }` – at most one active column.
  - `collapsedColumns: Set<number>` – indices of language columns that are visually collapsed.
  - `isSearchActive: boolean`.
  - `pagination: { currentPage, rowsPerPage, rowsPerPageOptions }`.
  - `quillEditor: Quill | null` – singleton Quill instance for the modal.
  - `currentEditContext: { key: string; langIndex: number } | null` – what is being edited in the modal.
  - `isCodeViewActive: boolean` – whether the modal is showing Quill or the raw HTML textarea.

### 4.2 Initialization & render loop

On page load, if `originalDataSource` exists and has entries, the script:

1. Waits for `DOMContentLoaded`.
2. Calls `initializeData()` → deep-clones `originalDataSource` into `modifiedDataSource`.
3. Calls `initializeEventListeners()` to wire up search, discard, and pagination controls.
4. Calls `renderTable()`.

`renderTable()` is the central render function:

1. Chooses `dataToRender` = either `modifiedDataSource` or `getSearchResults()` depending on `state.isSearchActive`.
2. Calls `renderTableHeader()` to rebuild the `<thead>`.
3. Calls `renderTableBody(dataToRender)` to rebuild `<tbody>` and compute the total row count.
4. Calls `renderPagination(totalRows)` to update info text and page controls.

All user actions eventually mutate `state` and/or `modifiedDataSource`, then call `renderTable()` to re-render the view.

---

## 5. Editing flow (modal + Quill)

### 5.1 Opening the editor

- Each value cell is rendered with `data-key` and `data-lang-index` attributes.
- Clicking a value cell calls `handleCellClick(event, key, langIndex, currentValue)`.
- If nothing is currently being edited, `handleCellClick` calls `openEditModal(key, langIndex, currentValue)`.

### 5.2 Quill initialization

`openEditModal` ensures the Quill editor is created exactly once via `initializeQuillEditor()`:

- Quill is attached to `#quill-editor` with the Snow theme.
- The toolbar includes headings, inline formatting, colors, lists, links, a “clean” button, and a custom **Code View** button.
- The custom button is wired to `toggleCodeView`, which switches between the rich text editor and a plain-text `<textarea>` that shows the underlying HTML.

When opening the modal:

- `state.currentEditContext` is set to `{ key, langIndex }`.
- The existing HTML value (if any) is loaded into Quill via `clipboard.dangerouslyPasteHTML`.
- The modal overlay `#edit-modal` is displayed and focus is given to the editor.

### 5.3 Code view behavior

- `toggleCodeView()` retrieves Quill’s current HTML via `getSemanticHTML()`.
- HTML entities are decoded for readability using `decodeHTMLEntities`.
- In code view, this decoded HTML is displayed in `#code-view-textarea` (read-only) while the Quill editor is hidden.
- Toggling back hides the textarea, shows Quill again, and focuses the editor.

### 5.4 Saving and cancelling

- **Save (`handleModalSave`)**
  - Reads HTML from Quill using `getSemanticHTML()`.
  - Writes it into `modifiedDataSource[langIndex].Translations[key]`.
  - Sets `state.hasUnsavedChanges = true` and calls `updateUI()`.
  - Closes the modal (`closeEditModal()`) and calls `renderTable()` to refresh the table.
- **Cancel / close (`handleModalCancel` / clicking overlay / pressing Escape)**
  - Just closes the modal without changing `modifiedDataSource`.

`closeEditModal()` also makes sure to:

- Reset `state.currentEditContext`.
- Exit code view if active and reset the Code View button state.
- Clear any content left in the Quill editor.

Search, pagination, and discarding changes will **close the modal first** if there is an active edit.

---

## 6. Search, sorting, column collapse, and pagination

### 6.1 Search

- `handleSearchInput` debounces user input and calls `performSearch(query)` after 300ms.
- `performSearch`:
  - Closes the edit modal if open.
  - Updates `state.searchQuery` and `state.isSearchActive`.
  - Clears `state.sortState` when search is active.
  - Resets `state.pagination.currentPage = 1`.
  - Calls `renderTable()`.
- `getSearchResults()`
  - Escapes special regex characters and builds a case-insensitive regex.
  - For each language, builds a new `Translations` object containing only keys/values that match either the key or the HTML value.
  - Returns an array with the same length and language ordering as `modifiedDataSource`.

### 6.2 Sorting

- Each language header contains a clickable `sort-indicator`.
- Clicking the indicator calls `cycleSortState(columnIndex)` which cycles that column through: no sort → ascending → descending → no sort (and clears other columns).
- `renderTableBody` calls `applySortingToKeys(allKeys)`:
  - Uses `modifiedDataSource[columnIndex].Translations[key]` as the value source.
  - Strips HTML tags with `getTextFromHTML` for text-based comparison.

### 6.3 Column collapse

- Each language header also has a `collapse-indicator`.
- Clicking it toggles the column index in `state.collapsedColumns` via `toggleColumnCollapse(index)` and re-renders.
- Collapsed columns remain in the data model but are visually compressed in the UI.

### 6.4 Pagination

- Pagination state lives under `state.pagination`.
- `renderPagination(totalRows)` computes total pages and delegates to:
  - `renderPaginationInfo(totalRows)` – updates the “Showing X–Y of Z entries” label.
  - `renderPaginationControls(totalPages)` – builds numbered page buttons with ellipses using `getPageNumbers(currentPage, totalPages)`.
  - `updatePaginationButtons(totalPages)` – enables/disables Prev/Next.
- `goToPage(page)` validates the requested page, closes the modal if open, updates `currentPage`, and calls `renderTable()`.
- `handleRowsPerPageChange` closes the modal (if needed), updates `rowsPerPage`, resets `currentPage` to 1, and re-renders.

---

## 7. Development setup & running locally

Prerequisites:

- Any modern browser (Chrome, Firefox, Edge, Safari).
- Optional: a simple static HTTP server for local development.

To run locally:

1. Open `index.html` directly in a browser **or** serve the directory via a static server (e.g., `python -m http.server` in the repo root) and visit `http://localhost:8000/index.html`.
2. Verify that:
   - The table renders with the sample `originalDataSource` from `index.html`.
   - Clicking a value cell opens the Quill modal and edits persist in the table until reload or discard.

To embed in another project:

1. Copy or include `styles.css`, `language-table.js`, and the `quilljs/` assets into your web app.
2. Render markup equivalent to the contents of `index.html`’s `<body>` (container, toolbar, table, pagination, hidden form, and modal).
3. Ensure your server emits a compatible `originalDataSource` JS variable before `language-table.js` is loaded.
4. Wire your own Save button to call `submitTranslations()`.

---

## 8. Testing

There are **no automated tests** in this repository.

Recommended manual checks after changes:

- Load with a realistic `originalDataSource` and verify:
  - Search filters by key and value as expected.
  - Sorting a column orders rows alphabetically by visible text.
  - Collapsing a column hides its content but does not break editing.
  - Pagination works with large datasets (Prev/Next, numbered pages, rows-per-page selector).
  - Editing translations via the modal updates `modifiedDataSource` and sets the unsaved-changes notification.
  - Discarding changes resets the table to the original data.

If you introduce significant new behavior, consider adding your own test harness or integrating into your existing test framework.

---

## 9. Code organization & conventions

- The script uses **plain functions and a single `state` object** instead of classes or frameworks.
- Sections in `language-table.js` are separated by banner comments (GLOBAL STATE, INITIALIZATION, TABLE RENDERING, EDIT MODE, SEARCH, SORTING, DISCARD CHANGES, UI UPDATES, PAGINATION).
- All DOM queries use `document.getElementById` or simple selectors; the DOM is re-rendered on each relevant state change via `renderTable()`.
- `modifiedDataSource` is treated as the single source of truth for translation data; the DOM is considered a **view**, not a data store.
- New features should generally follow this pattern:
  1. Extend `state` if you need to track additional UI flags.
  2. Update `renderTable` / helpers to respect the new state.
  3. Add event listeners in `initializeEventListeners()` or a dedicated initializer.
  4. Mutate `state` / `modifiedDataSource` in handlers, then call `renderTable()` (and `updateUI()` if unsaved state changed).

---