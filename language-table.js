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

/**
 * Note: Quill 2.x does not easily support custom attribute preservation through Parchment Blots.
 * Instead, we handle attribute preservation at the save/load level using DOM manipulation.
 * This is a more reliable approach that doesn't interfere with Quill's internal document model.
 */
function registerCustomQuillFormats() {
    // No custom formats needed - we handle attributes at save/load time
    console.log('Using DOM-based attribute preservation (Quill 2.x compatible)');
}

function initializeQuillEditor() {
    if (state.quillEditor) {
        return;
    }

    // Register custom formats before creating the editor
    registerCustomQuillFormats();

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
        let htmlContent = state.quillEditor.getSemanticHTML();

        // Restore original tag names and attributes that Quill stripped,
        // so the user sees the preserved HTML structure in Code View
        if (state.currentEditContext) {
            const { originalAttributes } = state.currentEditContext;
            if (hasPreservableStructure(originalAttributes)) {
                htmlContent = reapplyHTMLAttributes(htmlContent, originalAttributes);
            }
        }

        // Decode HTML entities for better readability
        const decodedHTML = decodeHTMLEntities(htmlContent);

        // Display decoded HTML in textarea
        codeViewTextarea.value = decodedHTML;

        // Store the initial Code View content so we can detect changes on save.
        // This is what the user sees when they first switch to Code View.
        if (state.currentEditContext) {
            state.currentEditContext.codeViewInitialHTML = decodedHTML;
        }

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

        // Re-extract HTML structure from the Code View content so that
        // subsequent Design View formatting preserves the updated tags and attributes.
        // This ensures consistency when the user edits HTML in Code View and then
        // applies formatting (bold, italic, etc.) in Design View.
        if (state.currentEditContext && htmlContainsTags(editedHTML)) {
            state.currentEditContext.originalAttributes = extractHTMLAttributes(editedHTML);
        }

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

/**
 * Extract HTML element structure (tag names and attributes) from an HTML string.
 * Returns an ordered list of element descriptors for both block-level and inline elements,
 * capturing the original tag name, attributes (id, class, data-*), and text content
 * for positional matching when reapplying to Quill's output.
 *
 * @param {string} html - HTML string to parse
 * @returns {Object} - Object with `blockElements` and `inlineElements` arrays
 */
function extractHTMLAttributes(html) {
    if (!html || typeof html !== 'string' || html.trim() === '') {
        return { blockElements: [], inlineElements: [] };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const blockElements = [];
    const inlineElements = [];

    // Block-level tags that Quill typically converts to <p>
    const blockTags = new Set([
        'p', 'div', 'section', 'article', 'header', 'footer', 'main',
        'aside', 'nav', 'figure', 'figcaption', 'address', 'details',
        'summary', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ]);

    // Inline tags that Quill may strip or convert
    const inlineTags = new Set(['span', 'a', 'abbr', 'cite', 'code', 'mark', 'time']);

    /**
     * Extract preservable attributes (id, class, data-*) from an element.
     * @param {Element} element
     * @returns {Object} - key/value pairs of preserved attributes
     */
    function getPreservableAttrs(element) {
        const attrs = {};
        if (element.hasAttribute('id')) {
            attrs.id = element.getAttribute('id');
        }
        if (element.hasAttribute('class')) {
            attrs.class = element.getAttribute('class');
        }
        Array.from(element.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                attrs[attr.name] = attr.value;
            }
        });
        return attrs;
    }

    // Walk direct children of body for block-level elements (preserves document order)
    const topLevelChildren = doc.body.children;
    for (let i = 0; i < topLevelChildren.length; i++) {
        const element = topLevelChildren[i];
        const tagName = element.tagName.toLowerCase();

        if (blockTags.has(tagName)) {
            const attrs = getPreservableAttrs(element);
            const hasAttrsToPreserve = Object.keys(attrs).length > 0;
            const isNonDefaultTag = tagName !== 'p';

            // Store if there are attributes to preserve OR the tag is non-default
            if (hasAttrsToPreserve || isNonDefaultTag) {
                blockElements.push({
                    originalTag: tagName,
                    attrs: attrs,
                    textContent: element.textContent.trim()
                });
            } else {
                // Still push a placeholder to maintain positional alignment
                blockElements.push(null);
            }
        }
    }

    // Walk all elements for inline elements that have preservable attributes or non-default tags
    const allElements = doc.body.querySelectorAll('*');
    allElements.forEach(element => {
        const tagName = element.tagName.toLowerCase();
        if (inlineTags.has(tagName)) {
            const attrs = getPreservableAttrs(element);
            if (Object.keys(attrs).length > 0 || tagName !== 'span') {
                inlineElements.push({
                    originalTag: tagName,
                    attrs: attrs,
                    textContent: element.textContent.trim(),
                    parentTextContent: element.parentElement
                        ? element.parentElement.textContent.trim()
                        : ''
                });
            }
        }
    });

    return { blockElements, inlineElements };
}

/**
 * Reapply original HTML tag names and attributes to Quill's formatted HTML output.
 * Quill typically converts all block elements to <p> and strips custom attributes.
 * This function restores the original tag names and attributes by positional matching.
 *
 * @param {string} html - HTML string from Quill's getSemanticHTML()
 * @param {Object} originalStructure - Structure extracted by extractHTMLAttributes()
 * @returns {string} - HTML with original tag names and attributes restored
 */
function reapplyHTMLAttributes(html, originalStructure) {
    if (!html || !originalStructure) {
        return html;
    }

    const { blockElements, inlineElements } = originalStructure;
    const hasBlockChanges = blockElements && blockElements.some(el => el !== null);
    const hasInlineChanges = inlineElements && inlineElements.length > 0;

    if (!hasBlockChanges && !hasInlineChanges) {
        return html;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // --- Restore block-level elements ---
    if (hasBlockChanges) {
        const quillBlocks = Array.from(doc.body.children);

        for (let i = 0; i < quillBlocks.length && i < blockElements.length; i++) {
            const original = blockElements[i];
            if (!original) continue; // null placeholder — nothing to restore

            const quillElement = quillBlocks[i];
            const quillTag = quillElement.tagName.toLowerCase();

            // Restore original tag name if it differs from Quill's output
            if (original.originalTag !== quillTag) {
                const newElement = doc.createElement(original.originalTag);

                // Copy all existing attributes from Quill's element (e.g. style)
                Array.from(quillElement.attributes).forEach(attr => {
                    newElement.setAttribute(attr.name, attr.value);
                });

                // Move all child nodes to the new element
                while (quillElement.firstChild) {
                    newElement.appendChild(quillElement.firstChild);
                }

                // Replace in DOM
                quillElement.parentNode.replaceChild(newElement, quillElement);

                // Update reference for attribute application below
                quillBlocks[i] = newElement;
            }

            // Reapply preserved attributes
            const targetElement = quillBlocks[i];
            Object.keys(original.attrs).forEach(attrName => {
                targetElement.setAttribute(attrName, original.attrs[attrName]);
            });
        }
    }

    // --- Restore inline elements ---
    if (hasInlineChanges) {
        inlineElements.forEach(originalInline => {
            // Find matching inline elements in Quill's output by text content
            const candidates = doc.body.querySelectorAll('span, a, abbr, cite, code, mark, time');
            for (const candidate of candidates) {
                const candidateText = candidate.textContent.trim();
                if (candidateText === originalInline.textContent) {
                    const candidateTag = candidate.tagName.toLowerCase();

                    // Restore tag name if different
                    if (originalInline.originalTag !== candidateTag) {
                        const newInline = doc.createElement(originalInline.originalTag);
                        Array.from(candidate.attributes).forEach(attr => {
                            newInline.setAttribute(attr.name, attr.value);
                        });
                        while (candidate.firstChild) {
                            newInline.appendChild(candidate.firstChild);
                        }
                        candidate.parentNode.replaceChild(newInline, candidate);

                        // Apply attributes to the new element
                        Object.keys(originalInline.attrs).forEach(attrName => {
                            newInline.setAttribute(attrName, originalInline.attrs[attrName]);
                        });
                    } else {
                        // Same tag — just reapply attributes
                        Object.keys(originalInline.attrs).forEach(attrName => {
                            candidate.setAttribute(attrName, originalInline.attrs[attrName]);
                        });
                    }
                    break; // matched — move to next original inline
                }
            }
        });
    }

    return doc.body.innerHTML;
}

/**
 * Check if a Quill delta contains any formatting attributes.
 * This detects bold, italic, underline, strike, color, background,
 * headers, lists, links, alignment, and any other Quill formatting.
 * @param {Object} delta - Quill delta object from getContents()
 * @returns {boolean} - True if any op has formatting attributes or non-text inserts (embeds)
 */
function deltaHasFormatting(delta) {
    if (!delta || !delta.ops) {
        return false;
    }
    return delta.ops.some(op => {
        // Check for formatting attributes (bold, italic, color, header, list, link, etc.)
        // Exclude custom HTML attributes (id, class, data-*) from formatting detection
        if (op.attributes && Object.keys(op.attributes).length > 0) {
            const formattingAttrs = Object.keys(op.attributes).filter(attr => {
                return !['id', 'class'].includes(attr) && !attr.startsWith('data-');
            });
            if (formattingAttrs.length > 0) {
                return true;
            }
        }
        // Check for non-text inserts (embeds like images, videos, etc.)
        if (typeof op.insert !== 'string') {
            return true;
        }
        return false;
    });
}

/**
 * Check if a string contains any HTML tags.
 * Used to distinguish plain text from HTML content in Code View.
 * @param {string} str - String to check
 * @returns {boolean} - True if the string contains HTML tags
 */
function htmlContainsTags(str) {
    if (!str || typeof str !== 'string') {
        return false;
    }
    // Match opening or self-closing HTML tags (e.g. <p>, <br/>, <div class="x">)
    // Excludes plain text that happens to contain < or > characters
    return /<[a-z][a-z0-9]*(\s[^>]*)?\/?>/i.test(str);
}

/**
 * Check if an extracted HTML structure has any preservable content
 * (non-default tags or custom attributes).
 * @param {Object} structure - Structure from extractHTMLAttributes()
 * @returns {boolean} - True if there are block or inline elements to preserve
 */
function hasPreservableStructure(structure) {
    if (!structure) {
        return false;
    }
    const hasBlocks = structure.blockElements && structure.blockElements.some(el => el !== null);
    const hasInlines = structure.inlineElements && structure.inlineElements.length > 0;
    return hasBlocks || hasInlines;
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

    // Store the edit context with original value for smart save logic
    const originalValue = currentValue || '';

    // Extract HTML attributes from the original value to preserve them
    const originalAttributes = extractHTMLAttributes(originalValue);

    state.currentEditContext = {
        key,
        langIndex,
        originalValue,
        originalAttributes
    };

    // Set the Quill editor content
    // Use clipboard.dangerouslyPasteHTML to load HTML content
    state.quillEditor.root.innerHTML = '';
    if (currentValue && currentValue.trim() !== '') {
        state.quillEditor.clipboard.dangerouslyPasteHTML(0, currentValue);
    }

    // Capture the initial text content after Quill has processed the value.
    // This is used on save to detect whether the text was actually modified.
    state.currentEditContext.originalText = state.quillEditor.getText();

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

    const { key, langIndex, originalValue, originalText, originalAttributes } = state.currentEditContext;

    let newValue;

    if (state.isCodeViewActive) {
        // ── Code View: smart save logic for raw HTML editing ──
        const codeViewTextarea = document.getElementById('code-view-textarea');
        const codeViewHTML = codeViewTextarea.value;

        // Compare against what was actually displayed in the textarea when Code View opened.
        // This accounts for the fact that the displayed HTML has already been through
        // reapplyHTMLAttributes + decodeHTMLEntities, so it may differ from originalValue.
        const codeViewBaseline = state.currentEditContext.codeViewInitialHTML || originalValue;

        if (codeViewHTML === codeViewBaseline) {
            // Case 1: No edits made — preserve original value exactly
            newValue = originalValue;
        } else if (!htmlContainsTags(codeViewHTML)) {
            // Case 2: User replaced content with plain text (no HTML tags) — save as plain text
            newValue = codeViewHTML;
        } else {
            // Case 3 & 4: Content contains HTML tags
            // Save the HTML as-is (user is directly editing raw HTML, so respect their intent)
            newValue = codeViewHTML;

            // Also update originalAttributes in the edit context so that if the user
            // later switches to Design View and applies formatting, the new structure
            // from Code View will be preserved
            state.currentEditContext.originalAttributes = extractHTMLAttributes(codeViewHTML);
        }
    } else {
        // ── Design View: smart save logic to avoid unnecessary HTML wrapping ──
        const currentDelta = state.quillEditor.getContents();
        const currentText = state.quillEditor.getText();
        const hasFormatting = deltaHasFormatting(currentDelta);

        if (hasFormatting) {
            // Case 3 & 4: User explicitly applied formatting (bold, italic, color, headers, lists, etc.)
            // Get Quill's HTML output
            newValue = state.quillEditor.getSemanticHTML();

            // Case 4: If original content had HTML attributes or non-default tags, preserve them
            if (hasPreservableStructure(originalAttributes)) {
                newValue = reapplyHTMLAttributes(newValue, originalAttributes);
            }
        } else if (currentText === originalText) {
            // Case 1: No edits made (preview only) — preserve the original value exactly
            newValue = originalValue;
        } else {
            // Case 2: Text content changed but no formatting applied
            // Return plain text without HTML wrapper elements
            // Remove the trailing newline that Quill always appends
            newValue = currentText.replace(/\n$/, '');
        }
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

