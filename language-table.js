// ========================================
// GLOBAL STATE
// ========================================

// modifiedDataSource will be accessed by server-side code
var modifiedDataSource = [];

// Application state
const state = {
    currentEditCell: null,
    hasUnsavedChanges: false,
    searchQuery: '',
    searchDebounceTimer: null,
    sortState: {}, // { columnIndex: 'asc' | 'desc' | null }
    collapsedColumns: new Set(), // Set of column indices that are collapsed
    isSearchActive: false
};

// ========================================
// INITIALIZATION
// ========================================

// Auto-initialize if originalDataSource is already available
// Otherwise, call initializeData() manually from HTML
if (typeof originalDataSource !== 'undefined' && originalDataSource.length > 0) {
    document.addEventListener('DOMContentLoaded', function() {
        initializeData();
        initializeEventListeners();
        renderTable();
    });
}

function initializeData() {
    // Deep clone the original data source
    if (originalDataSource && originalDataSource.length > 0) {
        modifiedDataSource = JSON.parse(JSON.stringify(originalDataSource));
    }
}

function initializeEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', handleSearchInput);
    
    // Clear search button
    const clearSearchBtn = document.getElementById('clear-search-btn');
    clearSearchBtn.addEventListener('click', handleClearSearch);
    
    // Discard changes button
    const discardChangesBtn = document.getElementById('discard-changes-btn');
    discardChangesBtn.addEventListener('click', handleDiscardChanges);
    
    // Click outside to handle edit mode (do nothing per requirements)
    document.addEventListener('click', handleDocumentClick);
}

// ========================================
// TABLE RENDERING
// ========================================

function renderTable() {
    const dataToRender = state.isSearchActive ? getSearchResults() : modifiedDataSource;
    renderTableHeader();
    renderTableBody(dataToRender);
}

function renderTableHeader() {
    const thead = document.getElementById('table-head');
    thead.innerHTML = '';

    if (modifiedDataSource.length === 0) {
        return;
    }

    const headerRow = document.createElement('tr');

    // Keys column
    const keysHeader = document.createElement('th');
    keysHeader.className = 'keys-column';
    keysHeader.textContent = 'Keys';
    headerRow.appendChild(keysHeader);

    // Language columns - always use modifiedDataSource for consistent indexing
    modifiedDataSource.forEach((lang, index) => {
        const langHeader = document.createElement('th');
        langHeader.className = 'value-column sortable';
        langHeader.dataset.columnIndex = index;

        const isCollapsed = state.collapsedColumns.has(index);
        if (isCollapsed) {
            langHeader.classList.add('collapsed');
        }

        // Sort indicator
        const sortIndicator = document.createElement('span');
        sortIndicator.className = 'sort-indicator';
        const sortDirection = state.sortState[index];
        if (sortDirection === 'asc') {
            sortIndicator.textContent = '▲ ';
        } else if (sortDirection === 'desc') {
            sortIndicator.textContent = '▼ ';
        } else {
            sortIndicator.textContent = '';
        }

        // Column title
        const title = lang.LanguageTwoLetter.toUpperCase();

        // Collapse indicator
        const collapseIndicator = document.createElement('span');
        collapseIndicator.className = 'collapse-indicator';
        collapseIndicator.textContent = isCollapsed ? ' ▶' : ' ◀';

        langHeader.appendChild(sortIndicator);
        langHeader.appendChild(document.createTextNode(title));
        langHeader.appendChild(collapseIndicator);

        langHeader.addEventListener('click', (e) => handleHeaderClick(e, index));

        headerRow.appendChild(langHeader);
    });

    thead.appendChild(headerRow);
}

function renderTableBody(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    if (data.length === 0) {
        return;
    }

    // Get all unique keys across all languages
    let allKeys = getAllKeys(data);

    // Apply sorting if active
    allKeys = applySortingToKeys(allKeys);

    allKeys.forEach(key => {
        const row = document.createElement('tr');

        // Keys cell
        const keyCell = document.createElement('td');
        keyCell.className = 'keys-cell';
        keyCell.textContent = key;
        row.appendChild(keyCell);

        // Value cells for each language
        // Use modifiedDataSource indices to ensure proper mapping
        modifiedDataSource.forEach((lang, langIndex) => {
            const valueCell = document.createElement('td');
            valueCell.className = 'value-cell';
            valueCell.dataset.key = key;
            valueCell.dataset.langIndex = langIndex;

            const isCollapsed = state.collapsedColumns.has(langIndex);
            if (isCollapsed) {
                valueCell.classList.add('collapsed-cell');
            }

            const value = lang.Translations[key] || '';

            // Render HTML content
            valueCell.innerHTML = value;

            // Add click handler for edit mode
            valueCell.addEventListener('click', (e) => handleCellClick(e, key, langIndex, value));

            row.appendChild(valueCell);
        });

        tbody.appendChild(row);
    });
}

function getAllKeys(data) {
    const keysSet = new Set();
    data.forEach(lang => {
        Object.keys(lang.Translations).forEach(key => keysSet.add(key));
    });
    return Array.from(keysSet);
}

function applySortingToKeys(keys) {
    const sortColumn = Object.keys(state.sortState)[0];
    if (sortColumn === undefined) {
        return keys;
    }

    const sortDirection = state.sortState[sortColumn];
    const columnIndex = parseInt(sortColumn);

    // Sort keys based on the rendered text content of the specified column
    // Always use modifiedDataSource for consistent column indexing
    const sortedKeys = [...keys].sort((keyA, keyB) => {
        const valueA = modifiedDataSource[columnIndex].Translations[keyA] || '';
        const valueB = modifiedDataSource[columnIndex].Translations[keyB] || '';

        // Extract text content from HTML
        const textA = getTextFromHTML(valueA).toLowerCase();
        const textB = getTextFromHTML(valueB).toLowerCase();

        if (textA < textB) return sortDirection === 'asc' ? -1 : 1;
        if (textA > textB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    return sortedKeys;
}

function getTextFromHTML(html) {
    // Create a temporary element to extract text content
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
}

// ========================================
// EDIT MODE
// ========================================

function handleCellClick(e, key, langIndex, currentValue) {
    e.stopPropagation();
    
    const cell = e.currentTarget;
    
    // Exit any existing edit mode
    if (state.currentEditCell && state.currentEditCell !== cell) {
        exitEditMode(true); // discard changes
    }
    
    // Don't re-enter edit mode if already editing this cell
    if (state.currentEditCell === cell) {
        return;
    }
    
    enterEditMode(cell, key, langIndex, currentValue);
}

function enterEditMode(cell, key, langIndex, currentValue) {
    state.currentEditCell = cell;
    cell.classList.add('editing');
    
    // Create textarea for editing
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-input';
    textarea.value = currentValue;
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'edit-buttons';
    
    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-btn save-btn';
    saveBtn.innerHTML = '✔';
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveEdit(cell, key, langIndex, textarea.value);
    });
    
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-btn cancel-btn';
    cancelBtn.innerHTML = '✖';
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exitEditMode(true);
    });
    
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    
    // Clear cell and add edit controls
    cell.innerHTML = '';
    cell.appendChild(textarea);
    cell.appendChild(buttonContainer);
    
    textarea.focus();
}

function saveEdit(_cell, key, langIndex, newValue) {
    // Update modifiedDataSource
    modifiedDataSource[langIndex].Translations[key] = newValue;

    // Mark as having unsaved changes
    state.hasUnsavedChanges = true;
    updateUI();

    // Exit edit mode
    exitEditMode(false);

    // Re-render table to show updated value
    renderTable();
}

function exitEditMode(discard) {
    if (!state.currentEditCell) {
        return;
    }
    
    state.currentEditCell.classList.remove('editing');
    state.currentEditCell = null;
    
    // Re-render to restore display mode
    if (discard) {
        renderTable();
    }
}

// ========================================
// SEARCH FUNCTIONALITY
// ========================================

function handleSearchInput(e) {
    const query = e.target.value;
    
    // Show/hide clear button
    const clearBtn = document.getElementById('clear-search-btn');
    clearBtn.style.display = query ? 'block' : 'none';
    
    // Debounce search
    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => {
        performSearch(query);
    }, 300);
}

function handleClearSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.value = '';
    document.getElementById('clear-search-btn').style.display = 'none';
    performSearch('');
}

function performSearch(query) {
    // Exit edit mode and discard changes when search is performed
    if (state.currentEditCell) {
        exitEditMode(true);
    }
    
    state.searchQuery = query;
    state.isSearchActive = query.trim() !== '';
    
    // Clear sort state when searching
    if (state.isSearchActive) {
        state.sortState = {};
    }
    
    renderTable();
}

function getSearchResults() {
    if (!state.searchQuery.trim()) {
        return modifiedDataSource;
    }

    try {
        // Escape special regex characters for literal search
        const escapedQuery = state.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Create case-insensitive global regex
        const regex = new RegExp(escapedQuery, 'gi');

        const results = modifiedDataSource.map(lang => {
            const filteredTranslations = {};

            Object.keys(lang.Translations).forEach(key => {
                const value = lang.Translations[key];

                // Search in both key and value
                // Reset regex lastIndex for global flag
                regex.lastIndex = 0;
                const keyMatch = regex.test(key);
                regex.lastIndex = 0;
                const valueMatch = regex.test(value);

                if (keyMatch || valueMatch) {
                    filteredTranslations[key] = value;
                }
            });

            return {
                LanguageTwoLetter: lang.LanguageTwoLetter,
                Translations: filteredTranslations
            };
        });

        return results;
    } catch (e) {
        // Invalid regex, return all results
        console.error('Search error:', e);
        return modifiedDataSource;
    }
}

// ========================================
// SORTING FUNCTIONALITY
// ========================================

function handleHeaderClick(e, columnIndex) {
    e.stopPropagation();
    
    const target = e.target;
    const isCollapseIndicator = target.classList.contains('collapse-indicator') || 
                                 target.textContent.includes('◀') || 
                                 target.textContent.includes('▶');
    
    // Check if click is on collapse indicator or header itself
    const clickX = e.offsetX;
    const headerWidth = e.currentTarget.offsetWidth;
    
    // If clicked on right side (collapse area) or it's a collapsed column, toggle collapse
    if (isCollapseIndicator || clickX > headerWidth - 30 || e.currentTarget.classList.contains('collapsed')) {
        toggleColumnCollapse(columnIndex);
    } else {
        // Otherwise, handle sorting
        cycleSortState(columnIndex);
    }
}

function toggleColumnCollapse(columnIndex) {
    if (state.collapsedColumns.has(columnIndex)) {
        state.collapsedColumns.delete(columnIndex);
    } else {
        state.collapsedColumns.add(columnIndex);
    }
    renderTable();
}

function cycleSortState(columnIndex) {
    const currentSort = state.sortState[columnIndex];

    // Cycle: null -> asc -> desc -> null
    if (!currentSort) {
        state.sortState = { [columnIndex]: 'asc' };
    } else if (currentSort === 'asc') {
        state.sortState = { [columnIndex]: 'desc' };
    } else {
        state.sortState = {};
    }

    renderTable();
}

// ========================================
// DISCARD CHANGES
// ========================================

function handleDiscardChanges() {
    // Reset modifiedDataSource to original
    modifiedDataSource = JSON.parse(JSON.stringify(originalDataSource));
    
    // Reset state
    state.hasUnsavedChanges = false;
    state.currentEditCell = null;
    
    updateUI();
    renderTable();
}

// ========================================
// UI UPDATES
// ========================================

function updateUI() {
    // Show/hide unsaved changes notification
    const notification = document.getElementById('unsaved-notification');
    notification.style.display = state.hasUnsavedChanges ? 'block' : 'none';
    
    // Show/hide discard changes button
    const discardBtn = document.getElementById('discard-changes-btn');
    discardBtn.style.display = state.hasUnsavedChanges ? 'block' : 'none';
}

function handleDocumentClick() {
    // Per requirements: clicking outside does nothing
    // User must explicitly save or cancel
}

