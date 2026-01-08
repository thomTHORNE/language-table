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
{
    [
        {
            "LanguageTwoLetter":"en",
            "Translations":{
                "key": "value",
                "another_key": "<b>value can also be rich text</b>"
            }
        }
    ]
}
```
The original data source (JSON) should remain immutable throughout the application life cycle. It will be provided server-side along with the rest of HTML. The table should duplicate this data source for the purposes of making edits and manage it through its state management system. A third data source may be used to display the search results, but any edits must still be saved to the copy of the original JSON, that will be displayed again after the search field is cleared.

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
  - Clicking on any cell in a "value" column should switch them into edit mode, effectively from HTML rendered text to an input field with their original string value. User can now edit the value and choose to click on any of the two buttons to the right of the cell. 
    - The green colored button with a checkmark icon should save the new value to the table's data source JSON.
    - The red outlined button with an x symbol should discard the value and reset it to its original one.
    - There is no delete feature, but a user may submit an empty string.
### 4. Sorting
Any column can be sorted ascendingly or descendingly.  
### 5. Toolbar
A toolbar is a visually distinct element placed above the table that contains tools and other information when working with the language table. 

1. Search
A text input field is used for searching either a language key or language value and is placed to the most left of the toolbar, occupying about half toolbar's width. The input change event should trigger search submit with a debounce delay of 300ms. The result of the search should display matches made with regex that searches globally and case insensitively. A third data source may be used to display the search results, but any edits must still be saved to the copy of the original JSON, that will be displayed again after the search field is cleared. The search field has a label titled "Search" position to the left of the input field. The search field has a "clear" button that clears the input field and resets the table data source to display the copy of the original JSON.

2. Discard changes button
A "Discard changes" button should be placed to the most right of the toolbar and only shown when the data source has been changed. Clicking the button should overwrite the data source copy with the original, effectively resetting the entire language table to the original state. 