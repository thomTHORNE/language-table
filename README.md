# Language Table

A vanilla JavaScript application for managing multilingual translation tables with inline editing, search, sorting, and column collapse features.

## Features

- **Inline Editing**: Click any value cell to edit translations with save/cancel buttons
- **Search**: Real-time search across keys and values with 300ms debounce
- **Sorting**: Click column headers to sort (ascending → descending → no sort)
- **Column Collapse**: Click collapse indicator (◀) to hide/show language columns
- **Change Tracking**: Visual notification when unsaved changes exist
- **Discard Changes**: Reset all modifications back to original data

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling with design tokens for easy theming
- `language-table.js` - Core application logic
- `sample-genius.json` - Sample data for testing

## Integration with ASPX Web Forms

### Step 1: Include Files

Add the CSS and JS files to your ASPX page:

```html
<link rel="stylesheet" href="path/to/styles.css">
```

### Step 2: Add HTML Structure

Include the table container in your ASPX page:

```html
<div class="container">
    <div class="toolbar">
        <div class="toolbar-controls">
            <div class="search-container">
                <label for="search-input" class="search-label">Search</label>
                <input type="text" id="search-input" class="search-input" placeholder="Search keys or values...">
                <button id="clear-search-btn" class="clear-search-btn" style="display: none;">✖</button>
            </div>
            <button id="discard-changes-btn" class="discard-changes-btn" style="display: none;">Discard changes</button>
        </div>
        <div id="unsaved-notification" class="unsaved-notification" style="display: none;">
            You have unsaved changes.
        </div>
    </div>
    <div class="table-container">
        <table id="language-table" class="language-table">
            <thead id="table-head"></thead>
            <tbody id="table-body"></tbody>
        </table>
    </div>
</div>
```

### Step 3: Provide Data Source

Before including the JavaScript file, define the `originalDataSource` variable with your JSON data:

```html
<script>
    // Server-side code should output JSON data here
    var originalDataSource = <%= YourJsonDataFromServer %>;
</script>

<script src="path/to/language-table.js"></script>
```

### Step 4: Access Modified Data

The application maintains a global `modifiedDataSource` variable that contains all user edits. Your server-side form submission can access this data:

```html
<script>
    function submitForm() {
        // modifiedDataSource contains the edited translations
        // You can serialize it and send to server
        var jsonData = JSON.stringify(modifiedDataSource);
        
        // Example: Set to hidden field for form submission
        document.getElementById('hiddenJsonField').value = jsonData;
        
        // Then submit your form
        __doPostBack('YourUpdatePanel', '');
    }
</script>
```

## Data Format

The application expects JSON data in the following format:

```json
[
    {
        "LanguageTwoLetter": "en",
        "Translations": {
            "key1": "value1",
            "key2": "<b>HTML content is supported</b>"
        }
    },
    {
        "LanguageTwoLetter": "hr",
        "Translations": {
            "key1": "vrijednost1",
            "key2": "<b>HTML sadržaj je podržan</b>"
        }
    }
]
```

## Customization

### Design Tokens

All visual styling can be customized by modifying CSS custom properties at the top of `styles.css`:

```css
:root {
    /* Colors */
    --color-primary-bg: #ffffff;
    --color-secondary-bg: #f8f8f8;
    --color-border: #d0d0d0;
    
    /* Button colors */
    --color-save-btn: #28a745;
    --color-cancel-btn: #dc3545;
    
    /* Spacing */
    --spacing-md: 12px;
    --spacing-lg: 16px;
    
    /* Typography */
    --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-size-base: 14px;
    
    /* ... and more */
}
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript features are used
- No external dependencies or frameworks required

## Testing Locally

To test the application locally:

1. Start the included Node.js server:
   ```bash
   node server.js
   ```

2. Open your browser to:
   ```
   http://localhost:8000
   ```

## Behavior Notes

- **Edit Mode**: Only one cell can be in edit mode at a time. Starting to edit another cell will discard changes in the current cell.
- **Search**: Clears any active sorting. Search uses case-insensitive regex matching.
- **Sorting**: Sorts by rendered text content (HTML tags are stripped for comparison).
- **Column Collapse**: Does not persist across page reloads. Collapsed state is visual only.
- **Unsaved Changes**: Notification appears immediately after saving any cell edit.

## License

This is a custom implementation for ASPX Web Forms integration.

