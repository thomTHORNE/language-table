// ========================================
// GLOBAL STATE
// ========================================

// modifiedDataSource will be accessed by server-side code
var modifiedDataSource = [];

// Application state
const state = {
    // Guard against double initialization
    initialized: false,

    // True if modifiedDataSource differs from originalDataSource.
    hasUnsavedChanges: false,
    // Current text in the search input.
    searchQuery: '',
    searchDebounceTimer: null,
    // { columnIndex: 'asc' | 'desc' | null }
    sortState: {},
    // Set of column indices that are collapsed
    collapsedColumns: new Set(),
    isSearchActive: false,
    pagination: {
        currentPage: 1,
        rowsPerPage: 25,
        rowsPerPageOptions: [25, 50, 100, 200]
    },

    // Editor state
    quillEditor: null,              // Quill editor instance (created once, reused)
    currentEditContext: null,       // Track the current edit context for the modal { key, langIndex }
    isCodeViewActive: false         // Track the current view mode (design or code)
};

// ========================================
// INITIALIZATION
// ========================================

// Auto-initialize if originalDataSource is already available
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
    // Guard against double initialization (prevents duplicate event listeners)
    if (state.initialized) {
        return;
    }
    state.initialized = true;

    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', handleSearchInput);

    // Clear search button
    const clearSearchBtn = document.getElementById('clear-search-btn');
    clearSearchBtn.addEventListener('click', handleClearSearch);

    // Discard changes button
    const discardChangesBtn = document.getElementById('discard-changes-btn');
    discardChangesBtn.addEventListener('click', handleDiscardChanges);

    // Pagination listeners
    initializePaginationListeners();
}

// ========================================
// TABLE RENDERING
// ========================================

function renderTable() {
    const dataToRender = state.isSearchActive ? getSearchResults() : modifiedDataSource;
    renderTableHeader();
    const totalRows = renderTableBody(dataToRender);
    renderPagination(totalRows);
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

        // Sort indicator - clickable for sorting
        const sortIndicator = document.createElement('span');
        sortIndicator.className = 'sort-indicator';
        const sortDirection = state.sortState[index];
        if (sortDirection === 'asc') {
            sortIndicator.textContent = '▲';
        } else if (sortDirection === 'desc') {
            sortIndicator.textContent = '▼';
        } else {
            sortIndicator.textContent = '⇅';
        }
        sortIndicator.addEventListener('click', (e) => {
            e.stopPropagation();
            cycleSortState(index);
        });

        // Column title
        const title = lang.LanguageTwoLetter.toUpperCase();

        // Collapse indicator - clickable for collapsing
        const collapseIndicator = document.createElement('span');
        collapseIndicator.className = 'collapse-indicator';
        collapseIndicator.textContent = isCollapsed ? '▶' : '◀';
        collapseIndicator.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleColumnCollapse(index);
        });

        langHeader.appendChild(sortIndicator);
        langHeader.appendChild(document.createTextNode(' ' + title + ' '));
        langHeader.appendChild(collapseIndicator);

        headerRow.appendChild(langHeader);
    });

    thead.appendChild(headerRow);
}

function renderTableBody(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    if (data.length === 0) {
        return 0;
    }

    // Get all unique keys across all languages
    let allKeys = getAllKeys(data);
    const totalRows = allKeys.length;

    // Apply sorting if active
    allKeys = applySortingToKeys(allKeys);

    // Apply pagination - slice keys for current page
    const { currentPage, rowsPerPage } = state.pagination;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedKeys = allKeys.slice(startIndex, endIndex);

    paginatedKeys.forEach(key => {
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

    return totalRows;
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
// EDIT MODE (Modal + Quill)
// ========================================

function initializeQuillEditor() {
    if (state.quillEditor) {
        return;
    }

    state.quillEditor = new Quill('#quill-editor', {
        modules: {
            toolbar: {
                container: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link'],
                    ['clean'],
                    ['code-view'] // Custom button for code view toggle
                ],
                handlers: {
                    'code-view': toggleCodeView
                }
            }
        },
        theme: 'snow'
    });

    // Add custom button to toolbar
    // Use setTimeout to ensure button is rendered
    setTimeout(() => {
        const codeViewButton = document.querySelector('.ql-code-view');
        if (codeViewButton) {
            codeViewButton.innerHTML = 'Code View';
        }
    }, 0);

    // Modal button event listeners
    document.getElementById('edit-modal-save-btn').addEventListener('click', handleModalSave);
    document.getElementById('edit-modal-cancel-btn').addEventListener('click', handleModalCancel);
    document.getElementById('edit-modal-close-btn').addEventListener('click', handleModalCancel);

    // Close modal on overlay click (outside modal content)
    document.getElementById('edit-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            handleModalCancel();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && state.currentEditContext) {
            handleModalCancel();
        }
    });
}

/**
 * Decode HTML entities in a string for better readability in code view
 * @param {string} html - HTML string with entities
 * @returns {string} - HTML string with decoded entities
 */
function decodeHTMLEntities(html) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
}

function toggleCodeView() {
    const quillEditorContainer = document.getElementById('quill-editor');
    const codeViewContainer = document.getElementById('code-view');
    const codeViewTextarea = document.getElementById('code-view-textarea');
    const codeViewButton = document.querySelector('.ql-code-view');

    if (!state.isCodeViewActive) {
        // Switch to Code View
        // Get HTML content from Quill
        const htmlContent = state.quillEditor.getSemanticHTML();

        // Decode HTML entities for better readability
        const decodedHTML = decodeHTMLEntities(htmlContent);

        // Display decoded HTML in textarea
        codeViewTextarea.value = decodedHTML;

        // Hide Quill editor, show code view
        quillEditorContainer.style.display = 'none';
        codeViewContainer.style.display = 'block';

        if (codeViewButton) {
            codeViewButton.classList.add('ql-active');
            codeViewButton.setAttribute('data-active', 'true');
        }

        state.isCodeViewActive = true;
    } else {
        // Switch back to Design View
        // Get the edited HTML from textarea
        const editedHTML = codeViewTextarea.value;

        // Update Quill editor with the edited HTML
        // Clear existing content first
        state.quillEditor.root.innerHTML = '';

        // Load the edited HTML into Quill
        if (editedHTML && editedHTML.trim() !== '') {
            try {
                state.quillEditor.clipboard.dangerouslyPasteHTML(0, editedHTML);
            } catch (error) {
                console.error('Error parsing HTML from code view:', error);
                // If there's an error, try to set it as plain text
                state.quillEditor.setText(editedHTML);
            }
        }

        // Hide code view, show Quill editor
        codeViewContainer.style.display = 'none';
        quillEditorContainer.style.display = 'block';

        // Update button state
        if (codeViewButton) {
            codeViewButton.classList.remove('ql-active');
            codeViewButton.removeAttribute('data-active');
        }

        // Focus the editor
        state.quillEditor.focus();

        state.isCodeViewActive = false;
    }
}

function handleCellClick(e, key, langIndex, currentValue) {
    e.stopPropagation();

    // Don't open modal if already editing
    if (state.currentEditContext) {
        return;
    }

    openEditModal(key, langIndex, currentValue);
}

function openEditModal(key, langIndex, currentValue) {
    // Initialize Quill if not yet created
    initializeQuillEditor();

    // Store the edit context
    state.currentEditContext = { key, langIndex };

    // Set the Quill editor content
    // Use clipboard.dangerouslyPasteHTML to load HTML content
    state.quillEditor.root.innerHTML = '';
    if (currentValue && currentValue.trim() !== '') {
        state.quillEditor.clipboard.dangerouslyPasteHTML(0, currentValue);
    }

    // Show the modal
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'flex';

    // Focus the editor
    state.quillEditor.focus();
}

function handleModalSave() {
    if (!state.currentEditContext) {
        return;
    }

    const { key, langIndex } = state.currentEditContext;

    let newValue;

    // Check if we're in code view mode
    if (state.isCodeViewActive) {
        // Get HTML content directly from the textarea
        const codeViewTextarea = document.getElementById('code-view-textarea');
        newValue = codeViewTextarea.value;
    } else {
        // Get HTML content from Quill
        newValue = state.quillEditor.getSemanticHTML();
    }

    // Update modifiedDataSource
    modifiedDataSource[langIndex].Translations[key] = newValue;

    // Mark as having unsaved changes
    state.hasUnsavedChanges = true;
    updateUI();

    // Close the modal
    closeEditModal();

    // Re-render table to show updated value
    renderTable();
}

function handleModalCancel() {
    closeEditModal();
}

function closeEditModal() {
    state.currentEditContext = null;

    // Reset to design view if in code view
    if (state.isCodeViewActive) {
        const quillEditorContainer = document.getElementById('quill-editor');
        const codeViewContainer = document.getElementById('code-view');

        codeViewContainer.style.display = 'none';
        quillEditorContainer.style.display = 'block';

        state.isCodeViewActive = false;
    }

    // Always reset button state (even if not in code view, to ensure clean state)
    const codeViewButton = document.querySelector('.ql-code-view');
    if (codeViewButton) {
        codeViewButton.classList.remove('ql-active');
        codeViewButton.removeAttribute('data-active');
    }

    // Clear the editor content
    if (state.quillEditor) {
        state.quillEditor.root.innerHTML = '';
    }

    // Hide the modal (do this last to avoid visual glitches)
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'none';
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
    // Close modal if open when search is performed
    if (state.currentEditContext) {
        closeEditModal();
    }

    state.searchQuery = query;
    state.isSearchActive = query.trim() !== '';

    // Clear sort state when searching
    if (state.isSearchActive) {
        state.sortState = {};
    }

    // Reset pagination to page 1 when search changes
    state.pagination.currentPage = 1;

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

    // Close modal if open
    if (state.currentEditContext) {
        closeEditModal();
    }

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



// ========================================
// PAGINATION FUNCTIONALITY
// ========================================

function initializePaginationListeners() {
    // Previous button
    const prevBtn = document.getElementById('pagination-prev');
    prevBtn.addEventListener('click', () => goToPage(state.pagination.currentPage - 1));

    // Next button
    const nextBtn = document.getElementById('pagination-next');
    nextBtn.addEventListener('click', () => goToPage(state.pagination.currentPage + 1));

    // Rows per page dropdown
    const rowsPerPageSelect = document.getElementById('rows-per-page');
    rowsPerPageSelect.addEventListener('change', handleRowsPerPageChange);
}

function renderPagination(totalRows) {
    const { rowsPerPage } = state.pagination;
    const totalPages = Math.ceil(totalRows / rowsPerPage);

    renderPaginationInfo(totalRows);
    renderPaginationControls(totalPages);
    updatePaginationButtons(totalPages);
}

function renderPaginationInfo(totalRows) {
    const { currentPage, rowsPerPage } = state.pagination;
    const infoElement = document.getElementById('pagination-info');

    if (totalRows === 0) {
        infoElement.textContent = 'No entries to display';
        return;
    }

    const startRow = (currentPage - 1) * rowsPerPage + 1;
    const endRow = Math.min(currentPage * rowsPerPage, totalRows);

    infoElement.textContent = `Showing ${startRow}-${endRow} of ${totalRows} entries`;
}

function renderPaginationControls(totalPages) {
    const pagesContainer = document.getElementById('pagination-pages');
    pagesContainer.innerHTML = '';

    if (totalPages <= 1) {
        return;
    }

    const pageNumbers = getPageNumbers(state.pagination.currentPage, totalPages);

    pageNumbers.forEach(item => {
        if (item === '...') {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pagesContainer.appendChild(ellipsis);
        } else {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-btn pagination-page';
            pageBtn.textContent = item;
            pageBtn.dataset.page = item;

            if (item === state.pagination.currentPage) {
                pageBtn.classList.add('active');
            }

            pageBtn.addEventListener('click', () => goToPage(item));
            pagesContainer.appendChild(pageBtn);
        }
    });
}

function getPageNumbers(currentPage, totalPages) {
    const pages = [];
    const windowSize = 2; // Number of pages to show on each side of current page

    if (totalPages <= 7) {
        // Show all pages if total is 7 or less
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
        return pages;
    }

    // Always include first page
    pages.push(1);

    // Calculate window start and end
    let windowStart = Math.max(2, currentPage - windowSize);
    let windowEnd = Math.min(totalPages - 1, currentPage + windowSize);

    // Adjust window if at the edges
    if (currentPage <= windowSize + 2) {
        windowEnd = Math.min(totalPages - 1, windowSize * 2 + 3);
    }
    if (currentPage >= totalPages - windowSize - 1) {
        windowStart = Math.max(2, totalPages - windowSize * 2 - 2);
    }

    // Add ellipsis before window if needed
    if (windowStart > 2) {
        pages.push('...');
    }

    // Add window pages
    for (let i = windowStart; i <= windowEnd; i++) {
        pages.push(i);
    }

    // Add ellipsis after window if needed
    if (windowEnd < totalPages - 1) {
        pages.push('...');
    }

    // Always include last page
    pages.push(totalPages);

    return pages;
}

function updatePaginationButtons(totalPages) {
    const prevBtn = document.getElementById('pagination-prev');
    const nextBtn = document.getElementById('pagination-next');

    prevBtn.disabled = state.pagination.currentPage <= 1;
    nextBtn.disabled = state.pagination.currentPage >= totalPages || totalPages <= 1;
}

function goToPage(page) {
    const { rowsPerPage } = state.pagination;
    const dataToRender = state.isSearchActive ? getSearchResults() : modifiedDataSource;
    const totalRows = getAllKeys(dataToRender).length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);

    // Validate page number
    if (page < 1 || page > totalPages) {
        return;
    }

    // Close modal if open
    if (state.currentEditContext) {
        closeEditModal();
    }

    state.pagination.currentPage = page;
    renderTable();
}

function handleRowsPerPageChange(e) {
    const newRowsPerPage = parseInt(e.target.value, 10);

    // Close modal if open
    if (state.currentEditContext) {
        closeEditModal();
    }

    state.pagination.rowsPerPage = newRowsPerPage;
    state.pagination.currentPage = 1; // Reset to first page
    renderTable();
}

