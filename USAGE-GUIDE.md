# Language Table - Complete Usage Guide

## Overview

This is a vanilla JavaScript application for managing multilingual translation tables. It's designed to be embedded in ASPX Web Forms pages without requiring any external libraries or frameworks.

## Quick Start

### For Testing Locally

1. Start the Node.js server:
   ```bash
   node server.js
   ```

2. Open your browser to: `http://localhost:8000`

3. The test version (`index.html`) loads data from `sample-genius.json`

### For Production (ASPX Integration)

Use `index-production.html` as a template. See the "ASPX Integration" section below.

## Features

### 1. Inline Editing
- **Trigger**: Click any value cell (not the Keys column)
- **Behavior**: 
  - Cell enters edit mode with a textarea
  - Save (✔) and Cancel (✖) buttons appear to the right
  - Only one cell can be edited at a time
  - Starting to edit another cell discards changes in the current cell
- **Actions**:
  - Click ✔ to save changes
  - Click ✖ to discard changes
  - Clicking outside does nothing (user must explicitly save or cancel)

### 2. Search
- **Location**: Toolbar, left side
- **Behavior**:
  - Searches both keys and values
  - Case-insensitive
  - Uses regex pattern matching (special characters are escaped)
  - 300ms debounce delay
  - Clear button (✖) appears when text is entered
- **Effects**:
  - Filters table to show only matching rows
  - Clears any active sorting
  - Exits edit mode and discards changes
  - When cleared, returns to original data order

### 3. Sorting
- **Trigger**: Click on any language column header (not Keys column)
- **Behavior**:
  - Cycles through: No sort → Ascending (▲) → Descending (▼) → No sort
  - Sorts by rendered text content (HTML tags stripped)
  - Case-insensitive alphabetical sorting
  - Visual indicator shows current sort state
  - Only one column can be sorted at a time
- **Notes**:
  - Sorting is cleared when search is performed
  - Sorting works on search results

### 4. Column Collapse/Restore
- **Trigger**: Click on the collapse indicator (◀/▶) or the right side of a language column header
- **Behavior**:
  - Collapses the column, hiding all value cells
  - Header rotates 90 degrees and shows ▶
  - Click again to restore (shows ◀)
  - Multiple columns can be collapsed simultaneously
- **Notes**:
  - Only language columns can be collapsed (not Keys column)
  - Collapse state does not persist across page reloads
  - Does not affect data or sorting

### 5. Change Tracking
- **Notification**: Red banner appears below toolbar controls
- **Message**: "You have unsaved changes."
- **Trigger**: Appears immediately after saving any cell edit
- **Behavior**: 
  - Cannot be dismissed manually
  - Disappears only when "Discard changes" is clicked

### 6. Discard Changes
- **Location**: Toolbar, right side
- **Visibility**: Only shown when there are unsaved changes
- **Behavior**: 
  - Resets all modifications back to original data
  - No confirmation dialog
  - Hides the unsaved changes notification
  - Clears edit mode

## Data Format

### Input Format (originalDataSource)

```json
[
    {
        "LanguageTwoLetter": "en",
        "Translations": {
            "translation_key_1": "Translation value",
            "translation_key_2": "<b>HTML content is supported</b>",
            "translation_key_3": "Another value"
        }
    },
    {
        "LanguageTwoLetter": "hr",
        "Translations": {
            "translation_key_1": "Vrijednost prijevoda",
            "translation_key_2": "<b>HTML sadržaj je podržan</b>",
            "translation_key_3": "Druga vrijednost"
        }
    }
]
```

### Output Format (modifiedDataSource)

The `modifiedDataSource` global variable maintains the same structure as the input, but with user edits applied.

## ASPX Integration

### Step 1: Include Files in Your ASPX Page

```aspx
<%@ Page Language="C#" AutoEventWireup="true" %>

<!DOCTYPE html>
<html>
<head>
    <title>Language Management</title>
    <link rel="stylesheet" href="path/to/styles.css">
</head>
<body>
    <!-- Your ASPX content -->
</body>
</html>
```

### Step 2: Add HTML Structure

Copy the HTML structure from `index-production.html`:

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

### Step 3: Provide Data from Server-Side

```aspx
<script>
    // Serialize your C# data to JSON
    var originalDataSource = <%= JsonConvert.SerializeObject(YourLanguageData) %>;
</script>

<script src="path/to/language-table.js"></script>
```

### Step 4: Access Modified Data for Form Submission

```aspx
<asp:HiddenField ID="hiddenTranslationsData" runat="server" />

<script>
    function saveTranslations() {
        // Get modified data
        var jsonData = JSON.stringify(modifiedDataSource);
        
        // Set to hidden field
        document.getElementById('<%= hiddenTranslationsData.ClientID %>').value = jsonData;
        
        // Trigger postback
        __doPostBack('<%= UpdatePanel1.ClientID %>', '');
    }
</script>

<asp:Button ID="btnSave" runat="server" Text="Save Translations" OnClientClick="saveTranslations(); return false;" />
```

### Step 5: Process Data on Server-Side (C#)

```csharp
protected void Page_Load(object sender, EventArgs e)
{
    if (IsPostBack)
    {
        string jsonData = hiddenTranslationsData.Value;
        
        if (!string.IsNullOrEmpty(jsonData))
        {
            var translations = JsonConvert.DeserializeObject<List<LanguageData>>(jsonData);
            
            // Process and save translations
            SaveTranslations(translations);
        }
    }
}

public class LanguageData
{
    public string LanguageTwoLetter { get; set; }
    public Dictionary<string, string> Translations { get; set; }
}
```

## Customization

### Theme Customization

All visual styling is controlled by CSS custom properties in `styles.css`. Modify these values to match your application's theme:

```css
:root {
    /* Colors */
    --color-primary-bg: #ffffff;
    --color-secondary-bg: #f8f8f8;
    --color-border: #d0d0d0;
    --color-text: #333333;
    
    /* Button colors */
    --color-save-btn: #28a745;
    --color-cancel-btn: #dc3545;
    --color-discard-btn: #6c757d;
    
    /* Notification colors */
    --color-notification-bg: #fff5f5;
    --color-notification-border: #dc3545;
    
    /* Spacing */
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    
    /* Typography */
    --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-size-base: 14px;
}
```

### Behavior Customization

To modify behavior, edit `language-table.js`:

- **Search debounce delay**: Line ~330, change `300` to desired milliseconds
- **Edit button icons**: Lines ~270-275, change Unicode characters
- **Column collapse width**: `styles.css` line ~240, change `35px`

## Browser Support

- **Minimum**: Modern browsers with ES6+ support
- **Tested**: Chrome, Firefox, Safari, Edge (latest versions)
- **Not supported**: Internet Explorer

## Troubleshooting

### Table doesn't render
- Check that `originalDataSource` is defined before `language-table.js` loads
- Verify JSON format matches expected structure
- Check browser console for errors

### Edit buttons appear off-screen
- Ensure `.table-container` has `padding-right: 80px` in CSS
- Check for conflicting CSS from parent page

### Search doesn't work
- Verify search input has `id="search-input"`
- Check that `initializeEventListeners()` is called

### Changes not persisting
- Remember: Changes are only stored in `modifiedDataSource` JavaScript variable
- You must manually submit this data to server for persistence
- Use the hidden field approach shown in Step 4 above

## Files Reference

- `index.html` - Test version with async data loading
- `index-production.html` - Production template for ASPX integration
- `styles.css` - All styling with design tokens
- `language-table.js` - Core application logic
- `sample-genius.json` - Sample data for testing
- `server.js` - Simple Node.js server for local testing
- `README.md` - Project overview
- `USAGE-GUIDE.md` - This file

## Support

For issues or questions, refer to the `project-plan.md` for original specifications.

