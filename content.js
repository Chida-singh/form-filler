// 🚀 Enhanced Google Forms Auto Filler Content Script
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
            document.addEventListener('DOMContentLoaded', () => this.analyzeForm());
        } else {
            this.analyzeForm();
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'quickFill':
                    this.quickFillForm(request.learningMode);
                    sendResponse({success: true});
                    break;
                case 'analyzeForm':
                    this.analyzeForm(true);
                    sendResponse({success: true});
                    break;
                case 'fillWithProfile':
                    this.fillWithProfile(request.profile);
                    sendResponse({success: true});
                    break;
            }
        });
    }

    setupWindowMessageListener() {
        // Listen for messages from the injected indicator
        window.addEventListener('message', (event) => {
            if (event.data.type === 'AUTOFILLER_ANALYZE' && event.data.source === 'autofiller-indicator') {
                this.analyzeForm(true);
            }
        });
    }

    async loadFormData() {
        const result = await chrome.storage.local.get(['formData']);
        this.formData = result.formData || {};
    }

    analyzeForm(showResults = false) {
        console.log('🔍 Analyzing Google Form structure...');
        
        const formTitle = this.getFormTitle();
        const formDescription = this.getFormDescription();
        const fields = this.detectFormFields();
        
        const analysis = {
            title: formTitle,
            description: formDescription,
            fieldCount: fields.length,
            fields: fields,
            url: window.location.href
        };

        if (showResults) {
            this.displayAnalysisResults(analysis);
        }

        // Send analysis to background script
        chrome.runtime.sendMessage({
            action: 'formAnalyzed',
            data: analysis
        });

        return analysis;
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
        
        // Google Forms specific selectors
        const questionContainers = document.querySelectorAll([
            '[role="listitem"]',
            '.freebirdFormviewerComponentsQuestionBaseRoot',
            '.geS5n', // Updated Google Forms selector
            '.Qr7Oae' // Another common selector
        ].join(','));

        questionContainers.forEach((container, index) => {
            const field = this.analyzeField(container, index);
            if (field) {
                fields.push(field);
                this.fieldMappings.set(field.id, field);
            }
        });

        console.log(`📝 Detected ${fields.length} form fields`);
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
                // Clean up the label text
                let text = label.textContent.trim();
                text = text.replace(/\s*\*\s*$/, ''); // Remove required asterisk
                return text;
            }
        }

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

        // Dropdown/Select
        const dropdown = container.querySelector('[role="listbox"], select');
        if (dropdown) {
            result.type = 'select';
            result.element = dropdown;
            result.options = Array.from(container.querySelectorAll('[role="option"]')).map(option => {
                return option.textContent.trim();
            }).filter(Boolean);
            return result;
        }

        // Date input
        const dateInput = container.querySelector('input[type="date"]');
        if (dateInput) {
            result.type = 'date';
            result.element = dateInput;
            return result;
        }

        // Time input
        const timeInput = container.querySelector('input[type="time"]');
        if (timeInput) {
            result.type = 'time';
            result.element = timeInput;
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
        
        const analysis = this.analyzeForm();
        let filledCount = 0;
        let newDataCollected = {};
        let hasNewData = false;

        // First pass: Fill known fields
        for (const field of analysis.fields) {
            if (field.element && field.label) {
                if (this.formData[field.label]) {
                    // We have data for this field
                    const success = await this.fillField(field, this.formData[field.label]);
                    if (success) filledCount++;
                } else if (learningMode) {
                    // We don't have data - collect it if learning mode is on
                    const value = await this.collectFieldData(field);
                    if (value !== null && value !== '') {
                        newDataCollected[field.label] = value;
                        hasNewData = true;
                        
                        const success = await this.fillField(field, value);
                        if (success) filledCount++;
                    }
                }
                // If learning mode is off and we don't have data, skip the field
            }
        }

        // Save any new data collected
        if (hasNewData) {
            this.formData = { ...this.formData, ...newDataCollected };
            await chrome.storage.local.set({ formData: this.formData });
            console.log('💾 Saved new form data:', newDataCollected);
        }

        const duration = Date.now() - startTime;
        
        // Send completion message
        chrome.runtime.sendMessage({
            action: 'formFilled',
            data: {
                fieldCount: filledCount,
                duration: duration,
                newFieldsLearned: Object.keys(newDataCollected).length,
                learningMode: learningMode
            }
        });

        const extraInfo = hasNewData ? `(learned ${Object.keys(newDataCollected).length} new fields)` : 
                         learningMode ? '' : '(learning mode disabled)';
        this.showFillComplete(filledCount, analysis.fields.length, extraInfo);
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
                    <button class="dialog-btn secondary" onclick="this.closest('.autofiller-dialog-overlay').dispatchEvent(new CustomEvent('skip'))">
                        Skip This Field
                    </button>
                    <button class="dialog-btn primary" onclick="this.closest('.autofiller-dialog-overlay').dispatchEvent(new CustomEvent('save'))">
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

        // Close button handler
        overlay.querySelector('.dialog-close').addEventListener('click', () => {
            overlay.dispatchEvent(new CustomEvent('skip'));
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

        // Enter key handler for text inputs
        const textInput = overlay.querySelector('.dialog-input');
        if (textInput) {
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    overlay.dispatchEvent(new CustomEvent('save'));
                }
            });
            
            // Auto-focus
            setTimeout(() => textInput.focus(), 100);
        }

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
            if (field.element && profile.data[field.label]) {
                const success = await this.fillField(field, profile.data[field.label]);
                if (success) filledCount++;
            }
        }

        const duration = Date.now() - startTime;
        
        // Send completion message
        chrome.runtime.sendMessage({
            action: 'formFilled',
            data: {
                fieldCount: filledCount,
                duration: duration,
                profileUsed: profile.name
            }
        });

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
                    
                case 'radio':
                    // Find matching option
                    const radioOption = field.container.querySelector(`[aria-label*="${value}"], [data-value="${value}"]`);
                    if (radioOption) {
                        radioOption.click();
                    }
                    break;
                    
                case 'checkbox':
                    if (Array.isArray(value)) {
                        value.forEach(optionValue => {
                            const checkboxOption = field.container.querySelector(`[aria-label*="${optionValue}"]`);
                            if (checkboxOption) {
                                checkboxOption.click();
                            }
                        });
                    }
                    break;
                    
                case 'select':
                    const selectOption = field.container.querySelector(`[data-value="${value}"]`);
                    if (selectOption) {
                        selectOption.click();
                    }
                    break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            return true;
        } catch (error) {
            console.error('Error filling field:', error);
            return false;
        }
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
new GoogleFormsAutoFiller();
