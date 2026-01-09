# Tech Stack
- JavaScript
- CSS
- HTML

# Context assumption
This solution will be a part of an aspx web forms page and as such it will not handle any JS Http requests for fetching or submitting data. It (language table) will consume the data source (JSON) provided by the server-side code, while persisting of the data will be handled by the submit action that exists outside of this application's scope. It only needs to consume the data and save the changes in another object as part of its state management system.

# Code quality and general concerns
Do not write spaghetti code. Design meaningful functions and objects, so that their logic is easily followed and reasoned.

# Specification

## Data source consumption and handling features
### 1. Table state management
The language table consumes the following JSON format:
```JSON
[
    {
        "LanguageTwoLetter":"en",
        "Translations":{
            "key": "value",
            "another_key": "<b>value can also be rich text</b>"
        }
    },
    {
        "LanguageTwoLetter":"hr",
        "Translations":{
            "key": "vrijednost",
            "another_key": "<b>vrijednost može biti i obogaćeni tekst</b>"
        }
    }
]
```

**Data Structure:** The JSON structure is an array at the root level (not an object wrapping an array). See `sample-genius.json` for reference.

**Data Initialization:** The original data source will be provided via an inline `<script>` tag with a global variable named `originalDataSource`.

**State Management:**
- `originalDataSource` - Immutable, provided by server-side code, never modified
- `modifiedDataSource` - Working copy for edits, exposed as global object for server-side access
- `modifiedDataSource` is updated in real-time on every committed cell value change
- A third data source may be used to display search results, but any edits must still be saved to `modifiedDataSource`, which will be displayed again after the search field is cleared

### 2. Value change notification
Once a value has been changed in the data source, a message in a red outlined notification banner should be displayed at the bottom of the toolbar occupying the full toolbar width, with the message "You have unsaved changes.". This message can not be interacted with.

## Table UI features
### 1. Table layout
The table should have the left-most column be the "key" property of "Translation" object and named in the table header "Keys". Every subsequent column should render its respective translation with full HTML support and should be titled in caps lock as such provided by the value of "LanguageTwoLetter" property.
### 2. The "key" cell functionality
Table cells under "Keys" columns should not be editable and display their value as-is.
### 3. The "value" cell functionality
The "value" cells have 2 modes: "display mode" and "edit mode".
  - In display mode, the "value" cells display their value as fully rendered HTML.
  - Clicking on any cell in a "value" column should switch them into edit mode, effectively from HTML rendered text to a textarea with their original string value. User can now edit the value and choose to click on any of the two buttons to the right of the cell.
    - The green colored button with a checkmark icon (✔ U+2714) should save the new value to the table's data source JSON.
    - The red outlined button with an x symbol (✖ U+2716) should discard the value and reset it to its original one.
    - There is no delete feature, but a user may submit an empty string.

**Edit Mode Behavior:**
- When a cell enters edit mode, any other cell in edit mode automatically exits and discards its changes
- Only one cell can be in edit mode at a time
- Clicking outside the cell does nothing - user must explicitly click save or cancel
- No validation or max length checks are performed
- Very long HTML values should wrap within the textarea
- Edit mode shows the original string value (raw HTML) which can be edited freely

**Save/Cancel Button Positioning:**
- Buttons appear as an overlay to the right of the cell
- Positioned vertically in line with the cell
- Do not affect table layout (absolute positioning)

**HTML Rendering:**
- Trust and render all HTML without sanitization
- Display mode: Fully rendered HTML
- Edit mode: Raw HTML string in textarea
### 4. Sorting
Any column can be sorted ascendingly or descendingly.

**Sorting Behavior:**
- Click column header to cycle through: No sort → Ascending (▲) → Descending (▼) → No sort
- Visual indicators (▲/▼) show current sort state
- Only one column can be sorted at a time
- Sorts by rendered text content (HTML tags stripped for comparison)
- Case-insensitive alphabetical sorting
- Search results clear sorting, but users can sort the filtered results
- When search is cleared, table returns to unsorted state (not restoring previous sort)
### 5. Column Collapse/Restore
Language columns (not the Keys column) can be collapsed and restored.

**Collapse/Restore Behavior:**
- Triggered by clicking on the column header
- Visual indication: Column is hidden when collapsed
- Collapsed header shows restore icon (▶ U+25B6)
- Expanded header shows collapse icon (◀ U+25C0)
- Header rotates 90 degrees when collapsed
- Multiple columns can be collapsed simultaneously
- Restore by clicking the collapsed header again
- Only value columns can be collapsed (Keys column cannot be collapsed)

### 6. Toolbar
A toolbar is a visually distinct element placed above the table that contains tools and other information when working with the language table.

**1. Search**
A text input field is used for searching either a language key or language value and is placed to the most left of the toolbar, occupying about half toolbar's width. The input change event should trigger search submit with a debounce delay of 300ms. The result of the search should display matches made with regex that searches globally and case insensitively. A third data source may be used to display the search results, but any edits must still be saved to `modifiedDataSource`, which will be displayed again after the search field is cleared. The search field has a label titled "Search" positioned to the left of the input field. The search field has a "clear" button (✖ U+2716) that clears the input field and resets the table data source to display `modifiedDataSource`.

**Search Behavior:**
- Clear button is visible only when there's text in the search field
- Search results clear any active sorting
- Users can sort the search results
- When search is cleared, table returns to unsorted state
- Search exits edit mode and discards any unsaved changes in the current cell
- Searches both keys and values
- Special regex characters are escaped for literal search

**2. Discard changes button**
A "Discard changes" button should be placed to the most right of the toolbar and only shown when the data source has been changed. Clicking the button should overwrite `modifiedDataSource` with `originalDataSource`, effectively resetting the entire language table to the original state. No confirmation dialog is shown.


---

## Implementation Details & Technical Requirements

### File Structure
- **Separate files:** HTML, CSS, and JavaScript in separate files
- **No naming conventions imposed**
- **Single JavaScript file:** All logic in one JS file
- **No build scripts or frameworks:** Pure vanilla JavaScript, no webpack, no bundlers

### Browser Compatibility & Dependencies
- **Target browsers:** Modern browsers only (Chrome, Firefox, Safari, Edge)
- **JavaScript features:** Modern ES6+ features allowed (arrow functions, template literals, etc.)
- **No external libraries:** Pure vanilla JavaScript, no jQuery, no frameworks
- **Icons:** Use ASCII/Unicode characters only, no icon fonts or SVG libraries
  - Checkmark (save): ✔ (U+2714)
  - Cancel: ✖ (U+2716)
  - Column collapse: ◀ (U+25C0)
  - Column restore: ▶ (U+25B6)
  - Sort ascending: ▲
  - Sort descending: ▼

### Accessibility & Usability
- **No keyboard navigation required**
- **No screen reader support required** (no ARIA labels)
- **No loading states or animations required**
- **No tooltips or help text required**
- Mouse-only interaction is acceptable

### Design & Styling
- **Design tokens:** Use CSS custom properties (CSS variables) for easy theming
- **Monotone color scheme** with colored action buttons
- **Alternating column shading** for visual distinction
- **Responsive considerations:** Not required, desktop-focused

### Data Format Reference
See `sample-genius.json` for the exact data structure expected. The format is:
- Array at root level (not object)
- Each array element has `LanguageTwoLetter` and `Translations` properties
- `Translations` is an object with key-value pairs
- Values can contain HTML markup

### Global Variables Exposed
- **`originalDataSource`** (input) - Provided by ASPX server-side code, immutable
- **`modifiedDataSource`** (output) - Contains all user edits, accessible by ASPX for form submission

### Integration with ASPX
The application is designed to be embedded in an ASPX Web Forms page:
1. ASPX provides `originalDataSource` via inline `<script>` tag
2. Application initializes automatically when data is available
3. ASPX accesses `modifiedDataSource` for form submission (e.g., via hidden field)
4. No HTTP requests are made by the JavaScript application

### Validation & Error Handling
- **No validation required:** Accept any string value including empty strings
- **No max length checks**
- **No error messages for invalid input**
- **HTML content:** Trust all HTML, no sanitization
- **Regex errors:** Handle gracefully by escaping special characters