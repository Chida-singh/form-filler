// 🚀 Enhanced Google Forms Auto Filler Content Script v2.4 - Advanced Dropdown Support
class GoogleFormsAutoFiller {
    constructor() {
        this.formData = {};
        this.fieldMappings = new Map();
        this.init();
    }

    init() {
        console.log('🎯 Google Forms Auto Filler initialized!');
        this.setupMessageListener();
        this.setupWindowMessageListener();
        this.loadFormData();
        
        // Auto-detect when form loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.analyzeForm().catch(error => {
                    console.error('Initial form analysis failed:', error);
                });
            });
        } else {
            this.analyzeForm().catch(error => {
                console.error('Initial form analysis failed:', error);
            });
        }
    }

    // Normalize field labels to prevent duplicates due to whitespace/formatting differences
    normalizeFieldLabel(label) {
        if (!label) return '';
        return label.trim()
                   .replace(/\s+/g, ' ')  // Normalize whitespace
                   .replace(/\s*\*\s*$/, '') // Remove required asterisk
                   .replace(/[""]/g, '"')  // Normalize quotes
                   .replace(/['']/g, "'"); // Normalize apostrophes
    }

    // Create a canonical field key for grouping similar fields
    getCanonicalFieldKey(label) {
        if (!label) return '';
        
        // Normalize the label first
        let normalized = this.normalizeFieldLabel(label).toLowerCase();
        
        // Remove common separators and extra words
        normalized = normalized
            .replace(/[\/\-_|:;,\.]/g, ' ')  // Replace separators with space
            .replace(/\s+/g, ' ')            // Normalize whitespace again
            .replace(/\b(number|no|id|code)\b/g, '') // Remove common suffixes
            .replace(/\s+/g, ' ')            // Clean up extra spaces
            .trim();
        
        // Check for known field synonyms and map to canonical forms
        const fieldMappings = {
            // Student identification
            'usn': ['usn', 'university serial number', 'student id', 'student number', 'roll number', 'rollno', 'registration'],
            'rollno': ['usn', 'university serial number', 'student id', 'student number', 'roll number', 'rollno', 'registration'],
            'studentid': ['usn', 'university serial number', 'student id', 'student number', 'roll number', 'rollno', 'registration'],
            
            // Personal information
            'name': ['name', 'full name', 'student name', 'your name', 'first name', 'last name'],
            'email': ['email', 'email address', 'e-mail', 'mail', 'email id'],
            'phone': ['phone', 'mobile', 'contact', 'phone number', 'mobile number', 'contact number'],
            'address': ['address', 'home address', 'residential address', 'current address'],
            
            // Academic information
            'semester': ['semester', 'sem', 'current semester', 'academic semester'],
            'branch': ['branch', 'department', 'stream', 'course', 'specialization'],
            'college': ['college', 'institution', 'university', 'school'],
            'year': ['year', 'academic year', 'current year', 'study year'],
            
            // Common form fields
            'age': ['age', 'your age', 'current age'],
            'gender': ['gender', 'sex'],
            'dob': ['date of birth', 'dob', 'birth date', 'birthday'],
            'city': ['city', 'town', 'location', 'place'],
            'state': ['state', 'province', 'region'],
            'country': ['country', 'nation'],
            'pincode': ['pincode', 'zip code', 'postal code', 'zip'],
        };
        
        // Find the canonical key for this field
        for (const [canonical, synonyms] of Object.entries(fieldMappings)) {
            for (const synonym of synonyms) {
                if (normalized.includes(synonym) || synonym.includes(normalized)) {
                    console.log(`🔗 Mapped "${label}" to canonical key: "${canonical}"`);
                    return canonical;
                }
            }
        }
        
        // If no mapping found, return the normalized label
        return normalized;
    }

    // Find existing data for a field using various matching strategies
    findExistingDataForField(fieldLabel) {
        const normalizedLabel = this.normalizeFieldLabel(fieldLabel);
        const canonicalKey = this.getCanonicalFieldKey(fieldLabel);
        
        console.log(`🔍 Looking for data for field: "${fieldLabel}"`);
        console.log(`📝 Normalized: "${normalizedLabel}"`);
        console.log(`🔑 Canonical key: "${canonicalKey}"`);
        
        // Strategy 1: Exact match with normalized label
        if (this.formData[normalizedLabel]) {
            console.log(`✅ Found exact match for: "${normalizedLabel}"`);
            return { value: this.formData[normalizedLabel], key: normalizedLabel };
        }
        
        // Strategy 2: Check all stored keys for canonical key match
        for (const [storedKey, storedValue] of Object.entries(this.formData)) {
            const storedCanonical = this.getCanonicalFieldKey(storedKey);
            if (storedCanonical === canonicalKey && canonicalKey !== '') {
                console.log(`🎯 Found canonical match: "${storedKey}" matches "${fieldLabel}"`);
                return { value: storedValue, key: storedKey };
            }
        }
        
        // Strategy 3: Fuzzy matching for similar labels
        const threshold = 0.7; // Similarity threshold
        for (const [storedKey, storedValue] of Object.entries(this.formData)) {
            const similarity = this.calculateStringSimilarity(normalizedLabel.toLowerCase(), storedKey.toLowerCase());
            if (similarity >= threshold) {
                console.log(`🔍 Found fuzzy match (${(similarity * 100).toFixed(1)}%): "${storedKey}" ≈ "${fieldLabel}"`);
                return { value: storedValue, key: storedKey };
            }
        }
        
        console.log(`❌ No existing data found for: "${fieldLabel}"`);
        return null;
    }

    // Debug function to analyze dropdown structure
    debugDropdownStructure(container, fieldLabel) {
        console.log(`🔍 DEBUGGING DROPDOWN: "${fieldLabel}"`);
        console.log('📋 Container HTML:', container.outerHTML.substring(0, 500) + '...');
        
        // Check for various dropdown indicators
        const indicators = [
            '[role="listbox"]',
            '[aria-haspopup="listbox"]', 
            '.exportSelect',
            '.freebirdFormviewerComponentsQuestionSelectRoot',
            'select',
            '[data-value=""]'
        ];
        
        indicators.forEach(selector => {
            const found = container.querySelector(selector);
            if (found) {
                console.log(`✅ Found indicator: ${selector}`, found);
            }
        });
        
        // Check for potential options
        const optionSelectors = [
            '[role="option"]',
            '.exportOption',
            '.freebirdFormviewerComponentsQuestionSelectOption',
            '[data-value]:not([data-value=""])'
        ];
        
        optionSelectors.forEach(selector => {
            const options = container.querySelectorAll(selector);
            if (options.length > 0) {
                console.log(`📝 Found ${options.length} options with ${selector}:`, 
                    Array.from(options).map(opt => opt.textContent?.trim()));
            }
        });
        
        // Check all text content in container
        const allText = Array.from(container.querySelectorAll('*'))
            .map(el => el.textContent?.trim())
            .filter(text => text && text.length > 1 && text.length < 100);
        console.log('📄 All text in container:', [...new Set(allText)]);
    }

    // Calculate string similarity using Levenshtein distance
    calculateStringSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    // Calculate Levenshtein distance between two strings
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    setupMessageListener() {
        if (!chrome?.runtime?.onMessage) {
            console.error('❌ Chrome runtime not available');
            return;
        }
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 Received message:', request);
            
            switch (request.action) {
                case 'ping':
                    console.log('🏓 Responding to ping');
                    sendResponse({success: true, message: 'Content script is alive!'});
                    break;
                case 'quickFill':
                    this.quickFillForm(request.learningMode)
                        .then(() => {
                            console.log('✅ Quick fill completed');
                            sendResponse({success: true});
                        })
                        .catch((error) => {
                            console.error('❌ Quick fill error:', error);
                            sendResponse({success: false, error: error.message});
                        });
                    return true; // Keep message channel open for async response
                case 'analyzeForm':
                    this.analyzeForm(true)
                        .then(() => {
                            console.log('✅ Analysis completed');
                            sendResponse({success: true});
                        })
                        .catch((error) => {
                            console.error('❌ Analysis error:', error);
                            sendResponse({success: false, error: error.message});
                        });
                    return true; // Keep message channel open for async response
                case 'fillWithProfile':
                    this.fillWithProfile(request.profile)
                        .then(() => {
                            console.log('✅ Fill with profile completed');
                            sendResponse({success: true});
                        })
                        .catch((error) => {
                            console.error('❌ Fill profile error:', error);
                            sendResponse({success: false, error: error.message});
                        });
                    return true; // Keep message channel open for async response
                default:
                    console.warn('⚠️ Unknown action:', request.action);
                    sendResponse({success: false, error: 'Unknown action'});
            }
        });
        
        console.log('📨 Message listener setup complete');
    }

    setupWindowMessageListener() {
        // Listen for messages from the injected indicator
        window.addEventListener('message', (event) => {
            if (event.data.type === 'AUTOFILLER_ANALYZE' && event.data.source === 'autofiller-indicator') {
                this.analyzeForm(true).catch(error => {
                    console.error('Window message triggered analysis failed:', error);
                });
            }
        });
    }

    async loadFormData() {
        try {
            if (!chrome?.storage?.local) {
                console.error('❌ Chrome storage not available');
                this.formData = {};
                return;
            }
            
            const result = await chrome.storage.local.get(['formData']);
            this.formData = result.formData || {};
            console.log('📚 Loaded existing form data:', Object.keys(this.formData).length, 'fields');
            console.log('📚 Existing field names:', Object.keys(this.formData));
        } catch (error) {
            console.error('❌ Failed to load form data:', error);
            this.formData = {};
        }
    }

    async analyzeForm(showResults = false) {
        console.log('🔍 Analyzing Google Form structure...');
        console.log('🔍 Current URL:', window.location.href);
        console.log('🔍 Document ready state:', document.readyState);
        
        try {
            const formTitle = this.getFormTitle();
            console.log('📝 Form title:', formTitle);
            
            const formDescription = this.getFormDescription();
            console.log('📝 Form description:', formDescription);
            
            const fields = this.detectFormFields();
            console.log('📝 Detected fields count:', fields.length);
            
            const analysis = {
                title: formTitle,
                description: formDescription,
                fieldCount: fields.length,
                fields: fields,
                url: window.location.href,
                timestamp: Date.now()
            };

            if (showResults) {
                this.displayAnalysisResults(analysis);
            }

            // Send analysis to background script
            console.log('📤 Sending analysis to background script...');
            try {
                if (chrome?.runtime?.sendMessage) {
                    const response = await chrome.runtime.sendMessage({
                        action: 'formAnalyzed',
                        data: analysis
                    });
                    console.log('📤 Background script response:', response);
                } else {
                    console.warn('⚠️ Chrome runtime not available for messaging');
                }
            } catch (msgError) {
                console.error('❌ Failed to send message to background script:', msgError);
                // Continue anyway - analysis can still work without background communication
            }

            console.log('✅ Form analysis completed:', analysis);
            return analysis;
        } catch (error) {
            console.error('❌ Form analysis failed:', error);
            console.error('❌ Error stack:', error.stack);
            throw error;
        }
    }

    getFormTitle() {
        // Multiple selectors for form title
        const titleSelectors = [
            '[role="heading"]',
            '.freebirdFormviewerViewHeaderTitle',
            'h1',
            '.exportHeader h1',
            '.freebirdFormviewerViewHeaderTitleRow'
        ];

        for (const selector of titleSelectors) {
            const title = document.querySelector(selector);
            if (title && title.textContent.trim()) {
                return title.textContent.trim();
            }
        }

        return 'Untitled Form';
    }

    getFormDescription() {
        const descSelectors = [
            '.freebirdFormviewerViewHeaderDescription',
            '.exportDescription',
            '.freebirdFormviewerViewHeaderDescriptionText'
        ];

        for (const selector of descSelectors) {
            const desc = document.querySelector(selector);
            if (desc && desc.textContent.trim()) {
                return desc.textContent.trim();
            }
        }

        return '';
    }

    detectFormFields() {
        const fields = [];
        const seenLabels = new Set(); // Track seen field labels to prevent duplicates
        const seenCanonicalKeys = new Set(); // Track canonical keys to prevent semantic duplicates
        
        // Google Forms specific selectors
        const questionContainers = document.querySelectorAll([
            '[role="listitem"]',
            '.freebirdFormviewerComponentsQuestionBaseRoot',
            '.geS5n', // Updated Google Forms selector
            '.Qr7Oae' // Another common selector
        ].join(','));

        console.log(`🔍 Found ${questionContainers.length} potential field containers`);

        questionContainers.forEach((container, index) => {
            const field = this.analyzeField(container, index);
            if (field && field.label) {
                const normalizedLabel = this.normalizeFieldLabel(field.label);
                const canonicalKey = this.getCanonicalFieldKey(field.label);
                
                // Check for exact duplicate field labels
                if (seenLabels.has(normalizedLabel)) {
                    console.log(`⚠️ Duplicate field detected: "${normalizedLabel}" - skipping`);
                    return;
                }
                
                // Check for semantic duplicates using canonical keys
                if (canonicalKey && seenCanonicalKeys.has(canonicalKey)) {
                    console.log(`⚠️ Semantic duplicate detected: "${normalizedLabel}" (canonical: "${canonicalKey}") - skipping`);
                    return;
                }
                
                seenLabels.add(normalizedLabel);
                if (canonicalKey) {
                    seenCanonicalKeys.add(canonicalKey);
                }
                
                field.label = normalizedLabel; // Update field with normalized label
                field.canonicalKey = canonicalKey; // Store canonical key for later use
                fields.push(field);
                this.fieldMappings.set(field.id, field);
                console.log(`✅ Added field: "${normalizedLabel}" (canonical: "${canonicalKey}", type: ${field.type})`);
            }
        });

        console.log(`📝 Detected ${fields.length} unique form fields`);
        return fields;
    }

    analyzeField(container, index) {
        const field = {
            id: `field_${index}`,
            container: container,
            type: 'unknown',
            label: '',
            description: '',
            required: false,
            element: null,
            options: []
        };

        // Get question label/title
        field.label = this.getFieldLabel(container);
        
        // Get question description
        field.description = this.getFieldDescription(container);
        
        // Check if required
        field.required = this.isFieldRequired(container);
        
        // Detect field type and element
        const fieldData = this.getFieldTypeAndElement(container);
        field.type = fieldData.type;
        field.element = fieldData.element;
        field.options = fieldData.options;

        return field.label || field.element ? field : null;
    }

    getFieldLabel(container) {
        const labelSelectors = [
            '[role="heading"]',
            '.freebirdFormviewerComponentsQuestionBaseTitle',
            '.M7eMe', // Question title
            '.geS5n .M7eMe',
            'span[dir="auto"]',
            '.exportLabel'
        ];

        for (const selector of labelSelectors) {
            const label = container.querySelector(selector);
            if (label && label.textContent.trim()) {
                // Clean up and normalize the label text
                const text = this.normalizeFieldLabel(label.textContent);
                
                if (text) {
                    console.log(`🏷️ Extracted label: "${text}" using selector: ${selector}`);
                    return text;
                }
            }
        }

        console.log(`❌ No label found in container`);
        return '';
    }

    getFieldDescription(container) {
        const descSelectors = [
            '.freebirdFormviewerComponentsQuestionBaseDescription',
            '.z12JJ',
            '.exportHelpText'
        ];

        for (const selector of descSelectors) {
            const desc = container.querySelector(selector);
            if (desc && desc.textContent.trim()) {
                return desc.textContent.trim();
            }
        }

        return '';
    }

    isFieldRequired(container) {
        // Look for required indicators
        const requiredSelectors = [
            '[aria-required="true"]',
            '.freebirdFormviewerComponentsQuestionBaseRequiredAsterisk',
            '.mxD2z' // Required asterisk
        ];

        return requiredSelectors.some(selector => container.querySelector(selector));
    }

    getFieldTypeAndElement(container) {
        const result = {
            type: 'unknown',
            element: null,
            options: []
        };

        // Text input
        const textInput = container.querySelector('input[type="text"], input[type="email"], input[type="url"], input[type="tel"]');
        if (textInput) {
            result.type = 'text';
            result.element = textInput;
            return result;
        }

        // Textarea
        const textarea = container.querySelector('textarea');
        if (textarea) {
            result.type = 'textarea';
            result.element = textarea;
            return result;
        }

        // Date input (enhanced detection)
        const dateInput = container.querySelector('input[type="date"]');
        if (dateInput) {
            result.type = 'date';
            result.element = dateInput;
            return result;
        }

        // Date picker (Google Forms specific)
        const datePicker = container.querySelector('[aria-label*="date" i], [aria-label*="birth" i], .exportInput[placeholder*="date" i]');
        if (datePicker) {
            result.type = 'date';
            result.element = datePicker;
            return result;
        }

        // Time input
        const timeInput = container.querySelector('input[type="time"]');
        if (timeInput) {
            result.type = 'time';
            result.element = timeInput;
            return result;
        }

        // Dropdown/Select (enhanced detection)
        const dropdownSelectors = [
            '[role="listbox"]', 
            'select', 
            '[aria-haspopup="listbox"]',
            '.exportSelect',
            '.freebirdFormviewerComponentsQuestionSelectRoot',
            '.quantumWizMenuPaperselectEl',
            '[data-value=""]', // Empty dropdown indicator
            '.freebirdFormviewerComponentsQuestionSelectPlaceholder'
        ];
        
        let dropdown = null;
        for (const selector of dropdownSelectors) {
            dropdown = container.querySelector(selector);
            if (dropdown) {
                console.log(`🎯 Found dropdown with selector: ${selector}`);
                break;
            }
        }
        
        if (dropdown) {
            result.type = 'select';
            result.element = dropdown;
            
            // Debug the dropdown structure
            this.debugDropdownStructure(container, 'Detected Dropdown');
            
            // Enhanced option extraction for Google Forms dropdowns
            const options = [];
            
            // Method 1: Standard options
            const standardOptions = container.querySelectorAll('[role="option"]');
            if (standardOptions.length > 0) {
                console.log(`📋 Found ${standardOptions.length} standard options`);
                standardOptions.forEach(option => {
                    const text = option.textContent.trim();
                    if (text && text !== 'Choose' && text !== 'Select' && text !== '') {
                        options.push(text);
                        console.log(`📝 Added option: "${text}"`);
                    }
                });
            }
            
            // Method 2: Google Forms specific option detection
            if (options.length === 0) {
                const formOptionSelectors = [
                    '.exportOption', 
                    '.freebirdFormviewerComponentsQuestionSelectOption',
                    '.quantumWizMenuPaperselectOption'
                ];
                
                for (const selector of formOptionSelectors) {
                    const formOptions = container.querySelectorAll(selector);
                    if (formOptions.length > 0) {
                        console.log(`📋 Found ${formOptions.length} options with selector: ${selector}`);
                        formOptions.forEach(option => {
                            const text = option.textContent.trim();
                            if (text && text !== 'Choose' && text !== 'Select') {
                                options.push(text);
                                console.log(`📝 Added form option: "${text}"`);
                            }
                        });
                        break;
                    }
                }
            }
            
            // Method 3: Look for data attributes
            if (options.length === 0) {
                const dataOptions = container.querySelectorAll('[data-value]:not([data-value=""])');
                if (dataOptions.length > 0) {
                    console.log(`📋 Found ${dataOptions.length} data-value options`);
                    dataOptions.forEach(option => {
                        const text = option.textContent.trim() || option.getAttribute('data-value');
                        if (text && text !== 'Choose' && text !== 'Select') {
                            options.push(text);
                            console.log(`📝 Added data option: "${text}"`);
                        }
                    });
                }
            }
            
            // Method 4: Look for any clickable text elements that might be options
            if (options.length === 0) {
                const textElements = container.querySelectorAll('span, div, li');
                const possibleOptions = [];
                textElements.forEach(el => {
                    const text = el.textContent.trim();
                    if (text && text.length > 1 && text.length < 100 && 
                        !text.includes('Choose') && !text.includes('Select') &&
                        el.offsetParent !== null) { // Element is visible
                        possibleOptions.push(text);
                    }
                });
                
                // Remove duplicates and take reasonable options
                const uniqueOptions = [...new Set(possibleOptions)];
                if (uniqueOptions.length > 1 && uniqueOptions.length < 20) {
                    options.push(...uniqueOptions);
                    console.log(`📝 Added ${uniqueOptions.length} possible text options`);
                }
            }
            
            result.options = options;
            console.log(`✅ Dropdown detected with ${options.length} options:`, options);
            console.log(`🎯 Dropdown element details:`, {
                tagName: dropdown.tagName,
                className: dropdown.className,
                role: dropdown.getAttribute('role'),
                ariaHaspopup: dropdown.getAttribute('aria-haspopup')
            });
            return result;
        }

        // Radio buttons
        const radioButtons = container.querySelectorAll('input[type="radio"]');
        if (radioButtons.length > 0) {
            result.type = 'radio';
            result.element = radioButtons[0];
            result.options = Array.from(container.querySelectorAll('[role="radio"]')).map(option => {
                const label = option.querySelector('span[dir="auto"]');
                return label ? label.textContent.trim() : '';
            }).filter(Boolean);
            return result;
        }

        // Checkboxes
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            result.type = 'checkbox';
            result.element = checkboxes[0];
            result.options = Array.from(container.querySelectorAll('[role="checkbox"]')).map(option => {
                const label = option.querySelector('span[dir="auto"]');
                return label ? label.textContent.trim() : '';
            }).filter(Boolean);
            return result;
        }

        return result;
    }

    displayAnalysisResults(analysis) {
        // Create analysis overlay
        const overlay = document.createElement('div');
        overlay.id = 'form-analysis-overlay';
        overlay.innerHTML = `
            <div class="analysis-panel">
                <div class="analysis-header">
                    <h3>📋 Form Analysis Results</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="analysis-content">
                    <h4>${analysis.title}</h4>
                    ${analysis.description ? `<p class="description">${analysis.description}</p>` : ''}
                    <p><strong>Fields detected:</strong> ${analysis.fieldCount}</p>
                    <div class="fields-list">
                        ${analysis.fields.map(field => `
                            <div class="field-item">
                                <span class="field-type">[${field.type.toUpperCase()}]</span>
                                <span class="field-label">${field.label}</span>
                                ${field.required ? '<span class="required">*</span>' : ''}
                                ${field.description ? `<br><small>${field.description}</small>` : ''}
                                ${field.options.length > 0 ? `<br><small>Options: ${field.options.join(', ')}</small>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const style = document.createElement('style');
        style.textContent = `
            .analysis-panel {
                background: white;
                border-radius: 10px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            .analysis-header {
                background: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .analysis-header h3 {
                margin: 0;
                font-size: 18px;
            }
            .close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .close-btn:hover {
                background: rgba(255,255,255,0.2);
            }
            .analysis-content {
                padding: 20px;
            }
            .analysis-content h4 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 16px;
            }
            .description {
                color: #666;
                font-style: italic;
                margin-bottom: 15px;
            }
            .fields-list {
                margin-top: 15px;
            }
            .field-item {
                padding: 10px;
                border: 1px solid #eee;
                border-radius: 5px;
                margin-bottom: 8px;
                background: #f9f9f9;
            }
            .field-type {
                background: #2196F3;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                margin-right: 8px;
            }
            .field-label {
                font-weight: 500;
                color: #333;
            }
            .required {
                color: #f44336;
                font-weight: bold;
                margin-left: 5px;
            }
            .field-item small {
                color: #666;
                font-size: 12px;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);

        // Close functionality
        overlay.querySelector('.close-btn').addEventListener('click', () => {
            overlay.remove();
            style.remove();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                style.remove();
            }
        });
    }

    async quickFillForm(learningMode = true) {
        console.log('⚡ Starting smart fill... Learning mode:', learningMode);
        const startTime = Date.now();
        
        try {
            const analysis = await this.analyzeForm();
            let filledCount = 0;
            let newDataCollected = {};
            let hasNewData = false;

            console.log(`🔍 Found ${analysis.fields.length} fields to process`);

            // First pass: Fill known fields
            for (const field of analysis.fields) {
                if (field.element && field.label) {
                    console.log(`🔍 Processing field: "${field.label}"`);
                    
                    // Use intelligent data matching
                    const existingData = this.findExistingDataForField(field.label);
                    
                    if (existingData) {
                        // We have data for this field (or a similar one)
                        console.log(`✅ Found existing data for: "${field.label}" using key: "${existingData.key}"`);
                        const success = await this.fillField(field, existingData.value);
                        if (success) filledCount++;
                    } else if (learningMode) {
                        // We don't have data - collect it if learning mode is on
                        console.log(`🤔 No data found for: "${field.label}" - asking user`);
                        const value = await this.collectFieldData(field);
                        console.log(`📝 Received value:`, value, `for field: "${field.label}"`);
                        
                        // Check if user wants to abort the entire filling process
                        if (value === 'ABORT_FILLING') {
                            console.log('🛑 User aborted the filling process');
                            this.showFillComplete(filledCount, analysis.fields.length, '(filling cancelled by user)');
                            return; // Exit the entire filling process
                        }
                        
                        if (value !== null && value !== '' && value !== undefined) {
                            // Determine the best key to store this data under
                            const canonicalKey = field.canonicalKey || field.label;
                            const storageKey = canonicalKey || field.label;
                            
                            // Handle array values (checkboxes) differently
                            if (Array.isArray(value) && value.length > 0) {
                                newDataCollected[storageKey] = value;
                                hasNewData = true;
                                const success = await this.fillField(field, value);
                                if (success) filledCount++;
                            } else if (!Array.isArray(value)) {
                                newDataCollected[storageKey] = value;
                                hasNewData = true;
                                const success = await this.fillField(field, value);
                                if (success) filledCount++;
                            }
                            
                            console.log(`💾 Will save data under key: "${storageKey}"`);
                        } else {
                            console.log(`⏭️ Skipping field: "${field.label}" (no value provided)`);
                        }
                    } else {
                        console.log(`🚫 Skipping field: "${field.label}" (learning mode disabled, no data available)`);
                    }
                    // If learning mode is off and we don't have data, skip the field
                }
            }

            // Save any new data collected
            if (hasNewData) {
                try {
                    this.formData = { ...this.formData, ...newDataCollected };
                    if (chrome?.storage?.local) {
                        await chrome.storage.local.set({ formData: this.formData });
                        console.log('💾 Saved new form data:', newDataCollected);
                    } else {
                        console.warn('⚠️ Chrome storage not available');
                    }
                } catch (storageError) {
                    console.error('❌ Failed to save form data:', storageError);
                }
            }

            const duration = Date.now() - startTime;
            
            // Send completion message
            try {
                if (chrome?.runtime?.sendMessage) {
                    await chrome.runtime.sendMessage({
                        action: 'formFilled',
                        data: {
                            fieldCount: filledCount,
                            duration: duration,
                            newFieldsLearned: Object.keys(newDataCollected).length,
                            learningMode: learningMode
                        }
                    });
                } else {
                    console.warn('⚠️ Chrome runtime not available for completion message');
                }
            } catch (msgError) {
                console.error('❌ Failed to send completion message:', msgError);
                // Continue anyway - the user notification will still show
            }

            const extraInfo = hasNewData ? `(learned ${Object.keys(newDataCollected).length} new fields)` : 
                             learningMode ? '' : '(learning mode disabled)';
            this.showFillComplete(filledCount, analysis.fields.length, extraInfo);
        } catch (error) {
            console.error('❌ Quick fill failed:', error);
            this.showNotification('❌ Fill Failed', 'error');
            throw error;
        }
    }

    async collectFieldData(field) {
        return new Promise((resolve) => {
            // Create a smart input dialog
            const dialog = this.createSmartInputDialog(field, resolve);
            document.body.appendChild(dialog);
        });
    }

    createSmartInputDialog(field, callback) {
        const overlay = document.createElement('div');
        overlay.className = 'autofiller-dialog-overlay';
        
        const suggestions = this.getSuggestionsForField(field);
        
        // Check if we have similar/related fields data to suggest
        const existingData = this.findExistingDataForField(field.label);
        let existingDataSection = '';
        
        if (existingData && existingData.key !== field.label) {
            existingDataSection = `
                <div class="existing-data-section">
                    <div class="existing-data-header">
                        <span class="info-icon">💡</span>
                        <strong>Found related data:</strong>
                    </div>
                    <div class="existing-data-item">
                        <span class="existing-data-label">"${existingData.key}"</span> 
                        <span class="existing-data-arrow">→</span> 
                        <span class="existing-data-value">"${Array.isArray(existingData.value) ? existingData.value.join(', ') : existingData.value}"</span>
                    </div>
                    <button class="use-existing-btn" data-value="${Array.isArray(existingData.value) ? JSON.stringify(existingData.value) : existingData.value}">
                        Use This Value
                    </button>
                </div>
            `;
        }
        
        overlay.innerHTML = `
            <div class="autofiller-dialog">
                <div class="dialog-header">
                    <h3>🤔 Need Information</h3>
                    <button class="dialog-close">&times;</button>
                </div>
                <div class="dialog-content">
                    <div class="field-info">
                        <span class="field-type-badge">${field.type.toUpperCase()}</span>
                        <strong>${field.label}</strong>
                        ${field.required ? '<span class="required-indicator">*</span>' : ''}
                    </div>
                    ${field.description ? `<p class="field-description">${field.description}</p>` : ''}
                    
                    ${existingDataSection}
                    
                    ${field.type === 'radio' || field.type === 'checkbox' ? `
                        <div class="options-list">
                            <p><strong>Available options:</strong></p>
                            <ul>
                                ${field.options.map(option => `<li>${option}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${field.type === 'text' || field.type === 'textarea' ? `
                        <div class="input-container">
                            <label>Enter value:</label>
                            <input type="text" class="dialog-input" placeholder="Type your answer..." />
                            ${suggestions.length > 0 ? `
                                <div class="suggestions">
                                    <small>Suggestions:</small>
                                    ${suggestions.map(suggestion => `
                                        <button class="suggestion-btn" data-value="${suggestion}">${suggestion}</button>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${field.type === 'date' ? `
                        <div class="input-container">
                            <label>Enter date:</label>
                            <input type="date" class="dialog-input dialog-date-input" />
                            <div class="date-suggestions">
                                <small>Quick options:</small>
                                <button class="suggestion-btn" data-action="today">Today</button>
                                <button class="suggestion-btn" data-action="yesterday">Yesterday</button>
                                <button class="suggestion-btn" data-action="custom">Custom Date</button>
                            </div>
                            <div class="date-format-help">
                                <small>Or enter manually: DD/MM/YYYY or MM/DD/YYYY</small>
                                <input type="text" class="dialog-input dialog-text-date" placeholder="e.g., 15/08/1995" style="margin-top: 5px;" />
                            </div>
                        </div>
                    ` : ''}
                    
                    ${field.type === 'select' ? `
                        <div class="select-container">
                            <label>Select an option:</label>
                            <div class="select-options">
                                ${field.options.map(option => `
                                    <label class="select-option">
                                        <input type="radio" name="dialog-select" value="${option}">
                                        <span>${option}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${field.type === 'radio' ? `
                        <div class="radio-container">
                            <label>Select an option:</label>
                            <div class="radio-options">
                                ${field.options.map(option => `
                                    <label class="radio-option">
                                        <input type="radio" name="dialog-radio" value="${option}">
                                        <span>${option}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${field.type === 'checkbox' ? `
                        <div class="checkbox-container">
                            <label>Select options (multiple allowed):</label>
                            <div class="checkbox-options">
                                ${field.options.map(option => `
                                    <label class="checkbox-option">
                                        <input type="checkbox" value="${option}">
                                        <span>${option}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="dialog-actions">
                    <button class="dialog-btn secondary skip-btn">
                        Skip This Field
                    </button>
                    <button class="dialog-btn primary save-btn">
                        Save & Continue
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .autofiller-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 10002;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            }
            
            .autofiller-dialog {
                background: white;
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            }
            
            .dialog-header {
                background: #4CAF50;
                color: white;
                padding: 20px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .dialog-header h3 {
                margin: 0;
                font-size: 18px;
            }
            
            .dialog-close {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .dialog-close:hover {
                background: rgba(255,255,255,0.2);
            }
            
            .dialog-content {
                padding: 20px;
            }
            
            .field-info {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 10px;
                font-size: 16px;
            }
            
            .field-type-badge {
                background: #2196F3;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: bold;
            }
            
            .required-indicator {
                color: #f44336;
                font-weight: bold;
            }
            
            .field-description {
                background: #f5f5f5;
                padding: 10px;
                border-radius: 6px;
                font-size: 14px;
                color: #666;
                margin-bottom: 15px;
                font-style: italic;
            }
            
            .options-list {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
            }
            
            .options-list ul {
                margin: 8px 0 0 0;
                padding-left: 20px;
            }
            
            .options-list li {
                margin-bottom: 4px;
                color: #555;
            }
            
            .existing-data-section {
                background: #e8f5e8;
                border: 2px solid #4CAF50;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
            }
            
            .existing-data-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 10px;
                font-size: 14px;
                color: #2e7d32;
            }
            
            .info-icon {
                font-size: 16px;
            }
            
            .existing-data-item {
                background: white;
                padding: 10px;
                border-radius: 6px;
                margin-bottom: 10px;
                font-family: monospace;
                font-size: 13px;
                word-break: break-all;
            }
            
            .existing-data-label {
                color: #1976d2;
                font-weight: bold;
            }
            
            .existing-data-arrow {
                color: #666;
                margin: 0 8px;
            }
            
            .existing-data-value {
                color: #2e7d32;
                font-weight: bold;
            }
            
            .use-existing-btn {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .use-existing-btn:hover {
                background: #45a049;
                transform: translateY(-1px);
            }
            
            .input-container {
                margin-bottom: 15px;
            }
            
            .input-container label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #333;
            }
            
            .dialog-input {
                width: 100%;
                padding: 12px;
                border: 2px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
                transition: border-color 0.2s;
            }
            
            .dialog-input:focus {
                outline: none;
                border-color: #4CAF50;
            }
            
            .dialog-date-input {
                margin-bottom: 10px;
            }
            
            .dialog-text-date {
                font-size: 12px;
            }
            
            .date-suggestions {
                margin: 10px 0;
            }
            
            .date-format-help {
                margin-top: 10px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 6px;
            }
            
            .date-format-help small {
                color: #666;
                font-size: 11px;
            }
            
            .select-container {
                margin-bottom: 15px;
            }
            
            .select-container label {
                display: block;
                margin-bottom: 12px;
                font-weight: 500;
                color: #333;
            }
            
            .select-options {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .select-option {
                display: flex !important;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border: 2px solid #eee;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                margin-bottom: 0 !important;
                font-weight: normal !important;
            }
            
            .select-option:hover {
                border-color: #4CAF50;
                background: #f8f9fa;
            }
            
            .select-option input {
                margin: 0;
            }
            
            .suggestions {
                margin-top: 10px;
            }
            
            .suggestion-btn {
                background: #e3f2fd;
                border: 1px solid #2196F3;
                color: #1976d2;
                padding: 4px 8px;
                margin: 2px 4px 2px 0;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .suggestion-btn:hover {
                background: #2196F3;
                color: white;
            }
            
            .radio-container, .checkbox-container {
                margin-bottom: 15px;
            }
            
            .radio-container label, .checkbox-container label {
                display: block;
                margin-bottom: 12px;
                font-weight: 500;
                color: #333;
            }
            
            .radio-options, .checkbox-options {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .radio-option, .checkbox-option {
                display: flex !important;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border: 2px solid #eee;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                margin-bottom: 0 !important;
                font-weight: normal !important;
            }
            
            .radio-option:hover, .checkbox-option:hover {
                border-color: #4CAF50;
                background: #f8f9fa;
            }
            
            .radio-option input, .checkbox-option input {
                margin: 0;
            }
            
            .dialog-actions {
                padding: 15px 20px;
                border-top: 1px solid #eee;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .dialog-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .dialog-btn.primary {
                background: #4CAF50;
                color: white;
            }
            
            .dialog-btn.primary:hover {
                background: #45a049;
                transform: translateY(-1px);
            }
            
            .dialog-btn.primary:active {
                transform: translateY(0);
                background: #3d8b40;
            }
            
            .dialog-btn.secondary {
                background: #f5f5f5;
                color: #666;
                border: 1px solid #ddd;
            }
            
            .dialog-btn.secondary:hover {
                background: #e0e0e0;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;

        document.head.appendChild(style);

        // Event handlers
        overlay.addEventListener('skip', () => {
            overlay.remove();
            style.remove();
            callback(null);
        });

        overlay.addEventListener('save', () => {
            let value = null;
            
            if (field.type === 'text' || field.type === 'textarea') {
                const input = overlay.querySelector('.dialog-input');
                value = input.value.trim();
            } else if (field.type === 'radio') {
                const selected = overlay.querySelector('input[name="dialog-radio"]:checked');
                value = selected ? selected.value : null;
            } else if (field.type === 'checkbox') {
                const selected = overlay.querySelectorAll('.checkbox-option input:checked');
                value = Array.from(selected).map(cb => cb.value);
            }
            
            overlay.remove();
            style.remove();
            callback(value);
        });

        // Button handlers
        overlay.querySelector('.skip-btn').addEventListener('click', () => {
            overlay.remove();
            style.remove();
            callback(null);
        });

        overlay.querySelector('.save-btn').addEventListener('click', () => {
            const saveBtn = overlay.querySelector('.save-btn');
            const originalText = saveBtn.textContent;
            
            // Show loading state
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            
            let value = null;
            
            console.log('💾 Save button clicked for field:', field.label, 'type:', field.type);
            
            try {
                if (field.type === 'text' || field.type === 'textarea') {
                    const input = overlay.querySelector('.dialog-input');
                    value = input ? input.value.trim() : '';
                    console.log('📝 Text input value:', value);
                } else if (field.type === 'date') {
                    const dateInput = overlay.querySelector('.dialog-date-input');
                    const textDateInput = overlay.querySelector('.dialog-text-date');
                    
                    if (dateInput && dateInput.value) {
                        // Use HTML5 date input value
                        value = dateInput.value;
                        console.log('📅 Date input value:', value);
                    } else if (textDateInput && textDateInput.value.trim()) {
                        // Use manually entered date
                        value = textDateInput.value.trim();
                        console.log('📅 Manual date value:', value);
                    } else {
                        value = '';
                    }
                } else if (field.type === 'select') {
                    const selected = overlay.querySelector('input[name="dialog-select"]:checked');
                    value = selected ? selected.value : null;
                    console.log('📋 Select value:', value);
                } else if (field.type === 'radio') {
                    const selected = overlay.querySelector('input[name="dialog-radio"]:checked');
                    value = selected ? selected.value : null;
                    console.log('🔘 Radio selected value:', value);
                } else if (field.type === 'checkbox') {
                    const selected = overlay.querySelectorAll('.checkbox-option input:checked');
                    value = Array.from(selected).map(cb => cb.value);
                    if (value.length === 0) value = null;
                    console.log('☑️ Checkbox selected values:', value);
                } else if (field.type === 'time') {
                    // Handle time fields if needed
                    value = null;
                    console.log('⏰ Time field - not implemented yet');
                } else {
                    // Handle other field types
                    value = null;
                    console.log('❓ Unknown field type:', field.type);
                }
                
                console.log('✅ Final value to save:', value);
                
                // Small delay to show the loading state
                setTimeout(() => {
                    overlay.remove();
                    style.remove();
                    callback(value);
                }, 100);
                
            } catch (error) {
                console.error('❌ Error saving field data:', error);
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
            }
        });

        // Close button handler - completely exit the filling process
        overlay.querySelector('.dialog-close').addEventListener('click', () => {
            overlay.remove();
            style.remove();
            // Send a special signal to stop the entire filling process
            callback('ABORT_FILLING');
        });

        // Suggestion button handlers
        overlay.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = overlay.querySelector('.dialog-input');
                if (input) {
                    input.value = btn.dataset.value;
                    input.focus();
                }
            });
        });

        // Use existing data button handler
        const useExistingBtn = overlay.querySelector('.use-existing-btn');
        if (useExistingBtn) {
            useExistingBtn.addEventListener('click', () => {
                let value = useExistingBtn.dataset.value;
                
                // Try to parse as JSON for array values
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        value = parsed;
                    }
                } catch (e) {
                    // Not JSON, use as string
                }
                
                console.log('✅ Using existing data:', value);
                overlay.remove();
                style.remove();
                callback(value);
            });
        }

        // Date field quick options
        overlay.querySelectorAll('.date-suggestions .suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const dateInput = overlay.querySelector('.dialog-date-input');
                
                if (action === 'today') {
                    const today = new Date().toISOString().split('T')[0];
                    if (dateInput) dateInput.value = today;
                } else if (action === 'yesterday') {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    if (dateInput) dateInput.value = yesterday.toISOString().split('T')[0];
                } else if (action === 'custom') {
                    const textDateInput = overlay.querySelector('.dialog-text-date');
                    if (textDateInput) textDateInput.focus();
                }
            });
        });

        // Select option handlers
        overlay.querySelectorAll('.select-option').forEach(option => {
            option.addEventListener('click', () => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                }
            });
        });

        // Enter key handler for text inputs
        const textInput = overlay.querySelector('.dialog-input');
        if (textInput) {
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    overlay.querySelector('.save-btn').click();
                }
            });
            
            // Auto-focus
            setTimeout(() => textInput.focus(), 100);
        }

        // Radio button change handlers for easier selection
        overlay.querySelectorAll('.radio-option').forEach(option => {
            option.addEventListener('click', () => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                }
            });
        });

        // Checkbox option handlers
        overlay.querySelectorAll('.checkbox-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const checkbox = option.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                    }
                }
            });
        });

        return overlay;
    }

    getSuggestionsForField(field) {
        const label = field.label.toLowerCase();
        const suggestions = [];

        // Common suggestions based on field labels
        if (label.includes('name') || label.includes('full name')) {
            suggestions.push('John Doe', 'Jane Smith', 'Alex Johnson');
        } else if (label.includes('email')) {
            suggestions.push('john@example.com', 'user@gmail.com', 'test@email.com');
        } else if (label.includes('phone') || label.includes('mobile')) {
            suggestions.push('+1-555-0123', '(555) 123-4567', '555-0123');
        } else if (label.includes('age')) {
            suggestions.push('25', '30', '35', '18-25', '26-35');
        } else if (label.includes('city') || label.includes('location')) {
            suggestions.push('New York', 'Los Angeles', 'Chicago', 'San Francisco');
        } else if (label.includes('company') || label.includes('organization')) {
            suggestions.push('Google', 'Microsoft', 'Apple', 'Amazon', 'Self-employed');
        } else if (label.includes('country')) {
            suggestions.push('United States', 'Canada', 'United Kingdom', 'India');
        }

        return suggestions;
    }

    async fillWithProfile(profile) {
        console.log('👤 Filling with profile:', profile.name);
        const startTime = Date.now();
        
        const analysis = this.analyzeForm();
        let filledCount = 0;
        
        for (const field of analysis.fields) {
            if (field.element) {
                console.log(`🔍 Looking for profile data for field: "${field.label}"`);
                
                // Try to find matching data in the profile using intelligent matching
                let profileValue = null;
                const canonicalKey = field.canonicalKey || field.label;
                
                // Strategy 1: Direct match with field label
                if (profile.data[field.label]) {
                    profileValue = profile.data[field.label];
                    console.log(`✅ Found direct match in profile for: "${field.label}"`);
                }
                // Strategy 2: Match using canonical key
                else if (profile.data[canonicalKey]) {
                    profileValue = profile.data[canonicalKey];
                    console.log(`✅ Found canonical match in profile: "${canonicalKey}" for field: "${field.label}"`);
                }
                // Strategy 3: Search through all profile data for similar keys
                else {
                    for (const [profileKey, profileVal] of Object.entries(profile.data)) {
                        const profileCanonical = this.getCanonicalFieldKey(profileKey);
                        if (profileCanonical === canonicalKey && canonicalKey !== '') {
                            profileValue = profileVal;
                            console.log(`✅ Found semantic match in profile: "${profileKey}" matches "${field.label}"`);
                            break;
                        }
                    }
                }
                
                if (profileValue) {
                    const success = await this.fillField(field, profileValue);
                    if (success) filledCount++;
                } else {
                    console.log(`❌ No matching data found in profile for: "${field.label}"`);
                }
            }
        }

        const duration = Date.now() - startTime;
        
        // Send completion message
        try {
            if (chrome?.runtime?.sendMessage) {
                await chrome.runtime.sendMessage({
                    action: 'formFilled',
                    data: {
                        fieldCount: filledCount,
                        duration: duration,
                        profileUsed: profile.name
                    }
                });
            }
        } catch (msgError) {
            console.error('❌ Failed to send profile completion message:', msgError);
        }

        this.showFillComplete(filledCount, analysis.fields.length, `using ${profile.name || 'profile'}`);
    }

    async fillField(field, value) {
        try {
            const element = field.element;
            
            switch (field.type) {
                case 'text':
                case 'textarea':
                    element.value = value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                    
                case 'date':
                    // Handle date formatting for different input types
                    if (element.type === 'date') {
                        // HTML5 date input expects YYYY-MM-DD format
                        let dateValue = value;
                        if (typeof value === 'string' && value.includes('/')) {
                            // Convert DD/MM/YYYY or MM/DD/YYYY to YYYY-MM-DD
                            const parts = value.split('/');
                            if (parts.length === 3) {
                                // Assume DD/MM/YYYY format
                                dateValue = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            }
                        }
                        element.value = dateValue;
                    } else {
                        // Text input for date
                        element.value = value;
                    }
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                    
                case 'radio':
                    // Find matching radio option by value or text content
                    let radioFound = false;
                    const radioOptions = field.container.querySelectorAll('[role="radio"], input[type="radio"]');
                    
                    for (const radioOption of radioOptions) {
                        const optionText = radioOption.textContent?.trim() || 
                                         radioOption.getAttribute('aria-label') ||
                                         radioOption.value;
                        
                        if (optionText === value || radioOption.value === value) {
                            radioOption.click();
                            radioFound = true;
                            console.log(`✅ Clicked radio option: "${optionText}"`);
                            break;
                        }
                    }
                    
                    if (!radioFound) {
                        console.log(`❌ Radio option not found for value: "${value}"`);
                        return false;
                    }
                    break;
                    
                case 'checkbox':
                    if (Array.isArray(value)) {
                        value.forEach(optionValue => {
                            const checkboxOptions = field.container.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
                            
                            for (const checkboxOption of checkboxOptions) {
                                const optionText = checkboxOption.textContent?.trim() || 
                                                 checkboxOption.getAttribute('aria-label') ||
                                                 checkboxOption.value;
                                
                                if (optionText === optionValue || checkboxOption.value === optionValue) {
                                    checkboxOption.click();
                                    console.log(`✅ Clicked checkbox option: "${optionText}"`);
                                    break;
                                }
                            }
                        });
                    }
                    break;
                    
                case 'select':
                    // Enhanced dropdown handling for Google Forms
                    let selectFound = false;
                    console.log(`🔽 Attempting to fill dropdown with value: "${value}"`);
                    console.log(`🔍 Dropdown element:`, element);
                    console.log(`📋 Container HTML:`, field.container.outerHTML.substring(0, 300));
                    
                    // Method 1: Google Forms specific dropdown handling
                    const googleFormsDropdowns = [
                        '[role="listbox"]',
                        '[aria-haspopup="listbox"]', 
                        '.exportSelect',
                        '.freebirdFormviewerComponentsQuestionSelectRoot',
                        '.quantumWizMenuPaperselectEl',
                        '[data-value=""]' // Empty dropdown trigger
                    ];
                    
                    for (const selector of googleFormsDropdowns) {
                        const dropdownTrigger = field.container.querySelector(selector);
                        if (dropdownTrigger) {
                            console.log(`🎯 Found dropdown trigger with selector: ${selector}`);
                            
                            // Click to open dropdown
                            dropdownTrigger.click();
                            
                            // Wait for dropdown to open and options to load
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            // Method 1a: Look for options in the document (dropdown might be rendered elsewhere)
                            const optionSelectors = [
                                '[role="option"]',
                                '.exportOption',
                                '.quantumWizMenuPaperselectOption',
                                '.freebirdFormviewerComponentsQuestionSelectOption',
                                '[data-value]:not([data-value=""])'
                            ];
                            
                            for (const optionSelector of optionSelectors) {
                                const options = document.querySelectorAll(optionSelector);
                                if (options.length > 0) {
                                    console.log(`🔍 Found ${options.length} options with selector: ${optionSelector}`);
                                    
                                    for (const option of options) {
                                        const optionText = option.textContent?.trim() || option.getAttribute('data-value') || option.getAttribute('aria-label');
                                        console.log(`📝 Checking option: "${optionText}"`);
                                        
                                        if (optionText === value) {
                                            console.log(`✅ Clicking matching option: "${optionText}"`);
                                            option.click();
                                            selectFound = true;
                                            
                                            // Wait for selection to register
                                            await new Promise(resolve => setTimeout(resolve, 200));
                                            break;
                                        }
                                    }
                                    
                                    if (selectFound) break;
                                }
                            }
                            
                            // Method 1b: Look for options within the field container
                            if (!selectFound) {
                                const containerOptions = field.container.querySelectorAll('[role="option"], .exportOption, [data-value]:not([data-value=""])');
                                console.log(`🔍 Found ${containerOptions.length} options in container`);
                                
                                for (const option of containerOptions) {
                                    const optionText = option.textContent?.trim() || option.getAttribute('data-value');
                                    if (optionText === value) {
                                        console.log(`✅ Clicking container option: "${optionText}"`);
                                        option.click();
                                        selectFound = true;
                                        break;
                                    }
                                }
                            }
                            
                            // If we found and clicked an option, we're done
                            if (selectFound) {
                                console.log(`✅ Successfully selected dropdown option: "${value}"`);
                                break;
                            }
                            
                            // Close dropdown if we didn't find the option
                            document.addEventListener('click', function closeDropdown(e) {
                                if (!e.target.closest('[role="listbox"], .exportSelect')) {
                                    document.removeEventListener('click', closeDropdown);
                                }
                            });
                            document.body.click(); // Click outside to close
                        }
                    }
                    
                    // Method 2: Traditional select element
                    if (!selectFound && element && element.tagName === 'SELECT') {
                        console.log(`🔽 Trying traditional select element`);
                        const options = element.querySelectorAll('option');
                        for (const option of options) {
                            if (option.textContent.trim() === value || option.value === value) {
                                element.value = option.value;
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                selectFound = true;
                                console.log(`✅ Selected traditional option: "${option.textContent}"`);
                                break;
                            }
                        }
                    }
                    
                    // Method 3: Fallback - try clicking elements with matching text
                    if (!selectFound) {
                        console.log(`🔄 Fallback: searching for clickable elements with text "${value}"`);
                        const clickableElements = field.container.querySelectorAll('*');
                        for (const el of clickableElements) {
                            if (el.textContent?.trim() === value && (el.onclick || el.getAttribute('role') || el.tagName === 'BUTTON')) {
                                console.log(`✅ Clicking fallback element: "${el.textContent.trim()}"`);
                                el.click();
                                selectFound = true;
                                break;
                            }
                        }
                    }
                    
                    if (!selectFound) {
                        console.log(`❌ Dropdown option not found for value: "${value}"`);
                        console.log(`Available options in container:`, Array.from(field.container.querySelectorAll('*')).map(el => el.textContent?.trim()).filter(Boolean));
                        return false;
                    }
                    break;
                    
                case 'time':
                    element.value = value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            return true;
        } catch (error) {
            console.error('Error filling field:', error);
            return false;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div class="fill-notification fill-notification-${type}">
                ${message}
            </div>
        `;
        
        // Position it at the top right of the page
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            pointer-events: none;
        `;
        
        // Add enhanced styles for different notification types
        const style = document.createElement('style');
        style.textContent = `
            .fill-notification-info {
                background: #2196F3;
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                animation: slideInRight 0.5s ease-out;
                max-width: 300px;
                text-align: center;
            }
            .fill-notification-error {
                background: #f44336;
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                animation: slideInRight 0.5s ease-out;
                max-width: 300px;
                text-align: center;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
                style.remove();
            }
        }, 3000);
    }

    showFillComplete(filled, total, extraInfo = '') {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div class="fill-notification">
                ✅ Filled ${filled}/${total} fields successfully${extraInfo ? ` ${extraInfo}` : ''}!
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .fill-notification {
                background: #4CAF50;
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                animation: slideInRight 0.5s ease-out;
                max-width: 300px;
                text-align: center;
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 4000);
    }
}

// Initialize the auto filler
// Initialize the auto filler with error handling
try {
    console.log('🚀 Loading Google Forms Auto Filler Content Script v2.4...');
    const autoFiller = new GoogleFormsAutoFiller();
    console.log('✅ Google Forms Auto Filler loaded successfully!');
    
    // Make globally accessible for debugging
    window.autoFiller = autoFiller;
} catch (error) {
    console.error('❌ Failed to initialize Google Forms Auto Filler:', error);
    console.error('❌ Error stack:', error.stack);
}
