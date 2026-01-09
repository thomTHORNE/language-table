# Pagination Feature Plan

## Overview

Implement client-side pagination for the language translation table with numbered page buttons, previous/next navigation, configurable rows per page, and total count display.

## Requirements Summary

| Requirement | Implementation |
|-------------|----------------|
| Pagination Type | Fully client-side |
| Navigation Style | Numbered page buttons with Previous/Next |
| Rows Per Page | Configurable dropdown with options: 25, 50, 100 |
| Default Rows | 25 |
| Position | Bottom of table, after table element |
| Libraries | None - custom implementation only |
| Page Persistence | Not required (refreshes on page reload) |
| Count Display | "Showing X-Y of Z entries" format |
| Page Button Display | First, last, and window around current page (e.g., `1 ... 4 5 6 ... 20`) |
| Search Interaction | Reset to page 1 when search changes |
| Styling | Match existing application styles using CSS variables |

## Technical Design

### 1. State Management

Add pagination state to the existing `state` object in `language-table.js`:

```javascript
const state = {
    // ... existing state
    pagination: {
        currentPage: 1,
        rowsPerPage: 25,
        rowsPerPageOptions: [25, 50, 100]
    }
};
```

### 2. HTML Structure

Add pagination container after the table in `index.html`:

```html
<div class="table-container">
    <table>...</table>
</div>
<!-- New pagination section -->
<div class="pagination-container">
    <div class="pagination-info">
        Showing 1-25 of 150 entries
    </div>
    <div class="pagination-controls">
        <button class="pagination-btn" id="pagination-prev">Previous</button>
        <div class="pagination-pages" id="pagination-pages">
            <!-- Page buttons rendered dynamically -->
        </div>
        <button class="pagination-btn" id="pagination-next">Next</button>
    </div>
    <div class="pagination-rows-per-page">
        <label for="rows-per-page">Rows per page:</label>
        <select id="rows-per-page">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
        </select>
    </div>
</div>
```

### 3. JavaScript Functions

#### New Functions to Add:

| Function | Purpose |
|----------|---------|
| `renderPagination()` | Main function to render all pagination UI |
| `renderPaginationInfo(totalRows)` | Render "Showing X-Y of Z entries" |
| `renderPaginationControls(totalPages)` | Render page buttons with ellipsis logic |
| `getPageNumbers(currentPage, totalPages)` | Calculate which page numbers to display |
| `goToPage(page)` | Navigate to specific page |
| `handleRowsPerPageChange(e)` | Handle dropdown change |
| `initializePaginationListeners()` | Set up event listeners for pagination |

#### Modified Functions:

| Function | Changes |
|----------|---------|
| `renderTableBody(data)` | Slice data to only render current page rows |
| `renderTable()` | Call `renderPagination()` after rendering table |
| `performSearch(query)` | Reset `state.pagination.currentPage` to 1 |
| `initializeEventListeners()` | Add call to `initializePaginationListeners()` |

### 4. CSS Styling

New styles to add to `styles.css` using existing CSS variables:

```css
/* Pagination Container */
.pagination-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    background-color: var(--color-primary-bg);
    border: var(--border-width) solid var(--color-border);
    border-top: none;
    border-radius: 0 0 var(--border-radius) var(--border-radius);
}

/* Pagination Info */
.pagination-info {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
}

/* Pagination Controls */
.pagination-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
}

/* Page Buttons */
.pagination-btn { ... }
.pagination-btn:hover { ... }
.pagination-btn:disabled { ... }
.pagination-btn.active { ... }
.pagination-ellipsis { ... }

/* Rows Per Page Dropdown */
.pagination-rows-per-page { ... }
```

### 5. Page Number Display Logic

For the page number window with ellipsis:

```
Total Pages: 20, Current Page: 6
Display: [1] [...] [4] [5] [6] [7] [8] [...] [20]

Rules:
- Always show first page (1)
- Always show last page (totalPages)
- Show 2 pages before and after current page
- Use ellipsis (...) when there are gaps
- Ellipsis is not clickable
```

### 6. Data Flow

```
User Action -> State Update -> Re-render

1. Page Change:
   goToPage(n) -> state.pagination.currentPage = n -> renderTable()

2. Rows Per Page Change:
   handleRowsPerPageChange() -> state.pagination.rowsPerPage = value 
                             -> state.pagination.currentPage = 1 
                             -> renderTable()

3. Search:
   performSearch() -> state.pagination.currentPage = 1 -> renderTable()
```

## Implementation Steps

### Step 1: Update State Object
- Add `pagination` property to `state` object with `currentPage`, `rowsPerPage`, and `rowsPerPageOptions`

### Step 2: Add HTML Structure
- Add pagination container div after `.table-container` in `index.html`
- Include info display, page controls, and rows per page dropdown

### Step 3: Add CSS Styles
- Add pagination-specific styles to `styles.css`
- Use existing CSS variables for consistency

### Step 4: Implement Pagination Functions
- Add `getPageNumbers()` for calculating visible page numbers
- Add `renderPagination()` to render the pagination UI
- Add `goToPage()` for navigation
- Add `handleRowsPerPageChange()` for dropdown changes

### Step 5: Modify Existing Functions
- Update `renderTableBody()` to slice data based on current page
- Update `renderTable()` to call `renderPagination()`
- Update `performSearch()` to reset to page 1
- Update `initializeEventListeners()` to set up pagination listeners

### Step 6: Testing Scenarios
- [ ] Default state shows 25 rows on page 1
- [ ] Previous button disabled on page 1
- [ ] Next button disabled on last page
- [ ] Page numbers display correctly with ellipsis
- [ ] Clicking page number navigates correctly
- [ ] Changing rows per page updates display and resets to page 1
- [ ] Search resets to page 1
- [ ] Info text updates correctly ("Showing X-Y of Z entries")
- [ ] Works correctly with sorting
- [ ] Works correctly with column collapse
- [ ] Empty search results handled gracefully

## Files to Modify

1. **`language-table.js`**
   - Add pagination state
   - Add pagination functions
   - Modify `renderTableBody()`, `renderTable()`, `performSearch()`, `initializeEventListeners()`

2. **`styles.css`**
   - Add pagination container styles
   - Add pagination button styles
   - Add pagination info and dropdown styles

3. **`index.html`**
   - Add pagination container HTML structure

## Acceptance Criteria

- [x] Pagination displays 25 rows by default
- [x] Users can change rows per page (25, 50, 100)
- [x] Page navigation works with Previous/Next buttons
- [x] Numbered page buttons with smart ellipsis display
- [x] "Showing X-Y of Z entries" info displayed
- [x] Search resets pagination to page 1
- [x] Styling matches existing application design
- [x] No external libraries used

