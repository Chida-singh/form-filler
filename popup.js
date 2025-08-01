// 🚀 Enhanced Auto Filler Pro Popup
class AutoFillerPopup {
    constructor() {
        this.currentTab = 'analyze';
        this.formAnalysis = null;
        this.init();
    }

    init() {
        this.setupTabSwitching();
        this.setupEventListeners();
        this.loadCurrentTab();
        this.checkCurrentPage();
    }

    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
        this.loadCurrentTab();
    }

    setupEventListeners() {
        // Fill actions
        document.getElementById('quick-fill-btn').addEventListener('click', () => {
            this.quickFillForm();
        });

        document.getElementById('analyze-btn').addEventListener('click', () => {
            this.analyzeForm();
        });

        document.getElementById('clear-data-btn').addEventListener('click', () => {
            this.clearSavedData();
        });

        // Learning mode toggle
        document.getElementById('learn-mode-toggle').addEventListener('change', (e) => {
            this.saveLearningModeSetting(e.target.checked);
        });

        // Data management actions
        document.getElementById('data-filter').addEventListener('input', (e) => {
            this.filterDataItems(e.target.value);
        });

        document.getElementById('add-field-btn').addEventListener('click', () => {
            this.addNewField();
        });

        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });
    }

    async loadCurrentTab() {
        switch (this.currentTab) {
            case 'analyze':
                await this.loadAnalyzeTab();
                break;
            case 'fill':
                await this.loadFillTab();
                break;
            case 'data':
                await this.loadDataTab();
                break;
            case 'profiles':
                await this.loadProfilesTab();
                break;
        }
    }

    async checkCurrentPage() {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!tab.url.includes('docs.google.com/forms')) {
            this.showMessage('info', '📝 Please navigate to a Google Form to use Auto Filler Pro', 'fill-status');
            this.disableActions();
        }
    }

    async loadAnalyzeTab() {
        const analyzeContent = document.getElementById('analyze-content');
        
        try {
            // Check if we have recent analysis data
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            const result = await chrome.storage.local.get([`form_analysis_${tab.id}`]);
            const analysis = result[`form_analysis_${tab.id}`];
            
            if (analysis && Date.now() - analysis.timestamp < 300000) { // 5 minutes
                this.displayFormAnalysis(analysis);
            } else {
                // Trigger new analysis
                await this.analyzeCurrentForm();
            }
        } catch (error) {
            console.error('Error loading analysis:', error);
            analyzeContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <p>Unable to analyze form</p>
                    <small>Make sure you're on a Google Form page</small>
                </div>
            `;
        }
    }

    async analyzeCurrentForm() {
        const analyzeContent = document.getElementById('analyze-content');
        
        analyzeContent.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                Analyzing form structure...
            </div>
        `;

        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            // Check if the tab is a Google Form
            if (!tab.url.includes('docs.google.com/forms')) {
                throw new Error('Not a Google Form page');
            }
            
            // Send analysis request to content script
            const response = await chrome.tabs.sendMessage(tab.id, {action: 'analyzeForm'});
            
            if (!response || !response.success) {
                throw new Error(response?.error || 'Content script did not respond');
            }
            
            // Wait for analysis to be stored and then retrieve it
            let attempts = 0;
            const maxAttempts = 10;
            const checkInterval = 200; // ms
            
            const checkForAnalysis = async () => {
                attempts++;
                const result = await chrome.storage.local.get([`form_analysis_${tab.id}`]);
                const analysis = result[`form_analysis_${tab.id}`];
                
                if (analysis && analysis.timestamp && Date.now() - analysis.timestamp < 5000) {
                    // Fresh analysis found
                    this.displayFormAnalysis(analysis);
                    return true;
                } else if (attempts >= maxAttempts) {
                    throw new Error('Analysis timeout - no data received');
                } else {
                    // Try again
                    setTimeout(checkForAnalysis, checkInterval);
                    return false;
                }
            };
            
            await checkForAnalysis();
            
        } catch (error) {
            console.error('Analysis error:', error);
            let errorMessage = 'Analysis failed';
            let errorDetail = 'Please try refreshing the page and try again';
            
            if (error.message.includes('Not a Google Form')) {
                errorMessage = 'Not a Google Form';
                errorDetail = 'Please navigate to a Google Form page';
            } else if (error.message.includes('Could not establish connection')) {
                errorMessage = 'Content script not loaded';
                errorDetail = 'Please refresh the page and try again';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Analysis timeout';
                errorDetail = 'The form might be too complex or not fully loaded';
            }
            
            analyzeContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p>${errorMessage}</p>
                    <small>${errorDetail}</small>
                    <button class="action-button secondary-button" onclick="window.autoFillerPopup.analyzeCurrentForm()" style="margin-top: 15px;">
                        🔄 Try Again
                    </button>
                </div>
            `;
        }
    }

    displayFormAnalysis(analysis) {
        const analyzeContent = document.getElementById('analyze-content');
        this.formAnalysis = analysis;
        
        analyzeContent.innerHTML = `
            <div class="form-info">
                <div class="form-title">${analysis.title || 'Untitled Form'}</div>
                <div class="form-meta">
                    <span>📝 ${analysis.fieldCount || 0} fields</span>
                    <span>🕒 ${new Date(analysis.timestamp).toLocaleTimeString()}</span>
                </div>
                ${analysis.description ? `<p style="margin-top: 8px; font-size: 12px; color: #666;">${analysis.description}</p>` : ''}
            </div>
            
            ${analysis.fields && analysis.fields.length > 0 ? `
                <h4 style="margin-bottom: 10px; color: #333; font-size: 14px;">Detected Fields:</h4>
                <div class="field-list">
                    ${analysis.fields.map(field => `
                        <div class="field-item">
                            <span class="field-type">${field.type}</span>
                            <span class="field-label">${field.label || 'Unnamed field'}</span>
                            ${field.required ? '<span class="field-required">*</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <p>No fields detected</p>
                    <small>This might not be a fillable form</small>
                </div>
            `}
            
            <button class="action-button secondary-button" onclick="window.autoFillerPopup.analyzeCurrentForm()" style="margin-top: 15px;">
                🔄 Refresh Analysis
            </button>
        `;
    }

    async loadFillTab() {
        // Load learning mode setting
        const result = await chrome.storage.local.get(['learningMode', 'formData']);
        const learningMode = result.learningMode !== undefined ? result.learningMode : true;
        const formData = result.formData || {};
        const dataCount = Object.keys(formData).length;
        
        // Set toggle state
        document.getElementById('learn-mode-toggle').checked = learningMode;
        
        const statusDiv = document.getElementById('fill-status');
        
        if (dataCount > 0) {
            statusDiv.innerHTML = `
                <div class="status-info">
                    💾 ${dataCount} field values saved and ready to use
                    ${learningMode ? '<br>🧠 Learning mode enabled - will ask for unknown fields' : '<br>📝 Learning mode disabled - will only fill known fields'}
                </div>
            `;
        } else {
            statusDiv.innerHTML = `
                <div class="status-info">
                    📝 No saved data yet. ${learningMode ? 'Learning mode will collect field values as you fill forms.' : 'Enable learning mode to collect field values automatically.'}
                </div>
            `;
        }
    }

    async loadProfilesTab() {
        const profilesContent = document.getElementById('profiles-content');
        
        try {
            const response = await chrome.runtime.sendMessage({action: 'getProfiles'});
            const profiles = response.profiles || [];
            
            if (profiles.length === 0) {
                profilesContent.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">👤</div>
                        <p>No profiles yet</p>
                        <small>Profiles will be created automatically as you fill forms</small>
                    </div>
                `;
            } else {
                profilesContent.innerHTML = `
                    <div class="profiles-list">
                        ${profiles.map((profile, index) => `
                            <div class="profile-item">
                                <div class="profile-name">${profile.name || `Profile ${index + 1}`}</div>
                                <div class="profile-fields">${Object.keys(profile.data).length} saved fields</div>
                                <div class="profile-actions">
                                    <button class="profile-button primary-button" onclick="window.autoFillerPopup.useProfile(${index})">
                                        Use Profile
                                    </button>
                                    <button class="profile-button secondary-button" onclick="window.autoFillerPopup.deleteProfile(${index})">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading profiles:', error);
            profilesContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <p>Error loading profiles</p>
                </div>
            `;
        }
    }

    async quickFillForm() {
        const statusDiv = document.getElementById('fill-status');
        
        try {
            statusDiv.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    Starting smart fill...
                </div>
            `;
            
            // Get learning mode setting
            const result = await chrome.storage.local.get(['learningMode']);
            const learningMode = result.learningMode !== undefined ? result.learningMode : true;
            
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            // Check if the tab is a Google Form
            if (!tab.url.includes('docs.google.com/forms')) {
                throw new Error('Not a Google Form page');
            }
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'quickFill',
                learningMode: learningMode
            });
            
            if (!response || !response.success) {
                throw new Error(response?.error || 'Content script did not respond');
            }
            
            statusDiv.innerHTML = `
                <div class="status-success">
                    ✅ Smart fill completed! ${learningMode ? 'New field values have been saved.' : ''}
                </div>
            `;
            
            // Reload the tab to show updated data count
            setTimeout(() => this.loadFillTab(), 2000);
            
        } catch (error) {
            console.error('Fill error:', error);
            let errorMessage = 'Failed to fill form';
            let errorDetail = 'Please try again';
            
            if (error.message.includes('Not a Google Form')) {
                errorMessage = 'Not a Google Form';
                errorDetail = 'Please navigate to a Google Form page';
            } else if (error.message.includes('Could not establish connection')) {
                errorMessage = 'Content script not loaded';
                errorDetail = 'Please refresh the page and try again';
            }
            
            statusDiv.innerHTML = `
                <div class="status-error">
                    ❌ ${errorMessage}. ${errorDetail}
                </div>
            `;
        }
    }

    async loadDataTab() {
        const dataContent = document.getElementById('data-content');
        
        try {
            const result = await chrome.storage.local.get(['formData']);
            const formData = result.formData || {};
            this.formData = formData;
            
            console.log('📊 Loaded form data:', formData);
            console.log('📊 Number of fields:', Object.keys(formData).length);
            
            if (Object.keys(formData).length === 0) {
                dataContent.innerHTML = `
                    <div class="empty-data">
                        <div class="empty-data-icon">📝</div>
                        <p>No saved data yet</p>
                        <small>Fill out some forms to see your saved field values here</small>
                    </div>
                `;
            } else {
                this.displayDataItems(formData);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            dataContent.innerHTML = `
                <div class="empty-data">
                    <div class="empty-data-icon">❌</div>
                    <p>Error loading data</p>
                </div>
            `;
        }
    }

    displayDataItems(formData, filter = '') {
        const dataContent = document.getElementById('data-content');
        const filteredData = Object.entries(formData).filter(([key, value]) => 
            key.toLowerCase().includes(filter.toLowerCase()) ||
            String(value).toLowerCase().includes(filter.toLowerCase())
        );

        if (filteredData.length === 0) {
            dataContent.innerHTML = `
                <div class="empty-data">
                    <div class="empty-data-icon">🔍</div>
                    <p>No matching data found</p>
                    <small>Try adjusting your search</small>
                </div>
            `;
            return;
        }

        dataContent.innerHTML = `
            <div class="data-list">
                ${filteredData.map(([fieldName, fieldValue]) => `
                    <div class="data-item" data-field-name="${this.escapeHtml(fieldName)}">
                        <div class="data-field">
                            <div class="data-field-name">${this.escapeHtml(fieldName)}</div>
                            <div class="data-field-value" title="${this.escapeHtml(String(fieldValue))}">
                                ${this.escapeHtml(this.formatFieldValue(fieldValue))}
                            </div>
                        </div>
                        <div class="data-item-actions">
                            <button class="data-btn edit" data-action="edit">
                                ✏️ Edit
                            </button>
                            <button class="data-btn delete" data-action="delete">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Add event listeners for edit and delete buttons
        const editButtons = dataContent.querySelectorAll('.data-btn[data-action="edit"]');
        const deleteButtons = dataContent.querySelectorAll('.data-btn[data-action="delete"]');

        editButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dataItem = e.target.closest('.data-item');
                const fieldName = dataItem.dataset.fieldName;
                this.editField(fieldName);
            });
        });

        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dataItem = e.target.closest('.data-item');
                const fieldName = dataItem.dataset.fieldName;
                this.deleteField(fieldName);
            });
        });
    }

    formatFieldValue(value) {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        const str = String(value);
        return str.length > 30 ? str.substring(0, 30) + '...' : str;
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    filterDataItems(filter) {
        if (this.formData) {
            this.displayDataItems(this.formData, filter);
        }
    }

    editField(fieldName) {
        const dataItem = document.querySelector(`[data-field-name="${this.escapeHtml(fieldName)}"]`);
        if (!dataItem) {
            console.error('Data item not found for field:', fieldName);
            return;
        }

        dataItem.classList.add('editing');
        const fieldValue = this.formData[fieldName];
        const isArray = Array.isArray(fieldValue);
        const displayValue = isArray ? fieldValue.join(', ') : String(fieldValue);

        const dataField = dataItem.querySelector('.data-field');
        dataField.innerHTML = `
            <div class="data-field-name">${this.escapeHtml(fieldName)}</div>
            <input type="text" class="data-field-input" value="${this.escapeHtml(displayValue)}" 
                   placeholder="Enter value..." maxlength="200">
            ${isArray ? '<small style="color: #666; font-size: 10px;">Separate multiple values with commas</small>' : ''}
        `;

        const actions = dataItem.querySelector('.data-item-actions');
        actions.innerHTML = `
            <button class="data-btn save" data-action="save">
                ✅ Save
            </button>
            <button class="data-btn cancel" data-action="cancel">
                ❌ Cancel
            </button>
        `;

        // Add event listeners for save and cancel
        const saveBtn = actions.querySelector('[data-action="save"]');
        const cancelBtn = actions.querySelector('[data-action="cancel"]');

        saveBtn.addEventListener('click', () => this.saveField(fieldName));
        cancelBtn.addEventListener('click', () => this.cancelEdit(fieldName));

        // Focus and select the input
        const input = dataItem.querySelector('.data-field-input');
        input.focus();
        input.select();

        // Handle Enter and Escape keys
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveField(fieldName);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelEdit(fieldName);
            }
        });
    }

    async saveField(fieldName) {
        const dataItem = document.querySelector(`[data-field-name="${this.escapeHtml(fieldName)}"]`);
        if (!dataItem) {
            console.error('Data item not found for field:', fieldName);
            return;
        }

        const input = dataItem.querySelector('.data-field-input');
        if (!input) {
            console.error('Input field not found for field:', fieldName);
            return;
        }

        const newValue = input.value.trim();

        if (!newValue) {
            alert('Value cannot be empty. Use delete if you want to remove this field.');
            return;
        }

        try {
            // Check if original value was array and handle accordingly
            const originalValue = this.formData[fieldName];
            let processedValue;

            if (Array.isArray(originalValue)) {
                // Split by comma and trim each value
                processedValue = newValue.split(',').map(v => v.trim()).filter(v => v);
                if (processedValue.length === 0) {
                    alert('At least one value is required for multi-value fields.');
                    return;
                }
            } else {
                processedValue = newValue;
            }

            // Update local data
            this.formData[fieldName] = processedValue;

            // Save to storage
            await chrome.storage.local.set({ formData: this.formData });

            // Refresh display
            this.displayDataItems(this.formData, document.getElementById('data-filter').value);

            // Show success message briefly
            this.showDataMessage('✅ Field updated successfully!', 'success');

            console.log('Field saved successfully:', fieldName, '=', processedValue);

        } catch (error) {
            console.error('Error saving field:', error);
            this.showDataMessage('❌ Failed to save field', 'error');
        }
    }

    cancelEdit(fieldName) {
        // Simply refresh the display to cancel editing
        this.displayDataItems(this.formData, document.getElementById('data-filter').value);
    }

    async deleteField(fieldName) {
        if (!confirm(`Are you sure you want to delete the field "${fieldName}"?`)) {
            return;
        }

        try {
            // Check if field exists
            if (!this.formData.hasOwnProperty(fieldName)) {
                console.error('Field not found in formData:', fieldName);
                this.showDataMessage('❌ Field not found', 'error');
                return;
            }

            // Remove from local data
            delete this.formData[fieldName];

            // Save to storage
            await chrome.storage.local.set({ formData: this.formData });

            // Refresh display
            this.displayDataItems(this.formData, document.getElementById('data-filter').value);

            // Show success message
            this.showDataMessage('🗑️ Field deleted successfully!', 'success');

            console.log('Field deleted successfully:', fieldName);

        } catch (error) {
            console.error('Error deleting field:', error);
            this.showDataMessage('❌ Failed to delete field', 'error');
        }
    }

    addNewField() {
        const fieldName = prompt('Enter field name:');
        if (!fieldName || !fieldName.trim()) return;

        const trimmedName = fieldName.trim();
        
        if (this.formData[trimmedName]) {
            alert('A field with this name already exists. Use edit to modify it.');
            return;
        }

        const fieldValue = prompt('Enter field value:');
        if (fieldValue === null) return; // User cancelled

        this.formData[trimmedName] = fieldValue.trim();
        
        // Save to storage
        chrome.storage.local.set({ formData: this.formData }).then(() => {
            // Refresh display
            this.displayDataItems(this.formData, document.getElementById('data-filter').value);
            this.showDataMessage('➕ New field added successfully!', 'success');
        }).catch(error => {
            console.error('Error adding field:', error);
            this.showDataMessage('❌ Failed to add field', 'error');
        });
    }

    exportData() {
        try {
            const dataStr = JSON.stringify(this.formData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `autofiller-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showDataMessage('📤 Data exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showDataMessage('❌ Failed to export data', 'error');
        }
    }

    showDataMessage(message, type) {
        const dataContent = document.getElementById('data-content');
        const messageDiv = document.createElement('div');
        messageDiv.className = `status-message status-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            z-index: 10003;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    async saveLearningModeSetting(enabled) {
        await chrome.storage.local.set({ learningMode: enabled });
        console.log('Learning mode:', enabled ? 'enabled' : 'disabled');
        
        // Update the status display
        this.loadFillTab();
    }

    async analyzeForm() {
        const statusDiv = document.getElementById('fill-status');
        
        try {
            statusDiv.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    Analyzing form...
                </div>
            `;
            
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            // Check if the tab is a Google Form
            if (!tab.url.includes('docs.google.com/forms')) {
                throw new Error('Not a Google Form page');
            }
            
            const response = await chrome.tabs.sendMessage(tab.id, {action: 'analyzeForm'});
            
            if (!response || !response.success) {
                throw new Error(response?.error || 'Content script did not respond');
            }
            
            statusDiv.innerHTML = `
                <div class="status-success">
                    🔍 Form analysis completed! Check the Analyze tab.
                </div>
            `;
            
            // Switch to analyze tab
            this.switchTab('analyze');
            
        } catch (error) {
            console.error('Analysis error:', error);
            let errorMessage = 'Analysis failed';
            let errorDetail = 'Make sure you\'re on a Google Form';
            
            if (error.message.includes('Not a Google Form')) {
                errorMessage = 'Not a Google Form';
                errorDetail = 'Please navigate to a Google Form page';
            } else if (error.message.includes('Could not establish connection')) {
                errorMessage = 'Content script not loaded';
                errorDetail = 'Please refresh the page and try again';
            }
            
            statusDiv.innerHTML = `
                <div class="status-error">
                    ❌ ${errorMessage}. ${errorDetail}
                </div>
            `;
        }
    }

    async clearSavedData() {
        if (confirm('Are you sure you want to clear all saved form data?')) {
            await chrome.storage.local.remove(['formData']);
            
            const statusDiv = document.getElementById('fill-status');
            statusDiv.innerHTML = `
                <div class="status-info">
                    🗑️ All saved data cleared successfully.
                </div>
            `;
            
            setTimeout(() => {
                this.loadFillTab();
            }, 2000);
        }
    }

    async useProfile(profileIndex) {
        try {
            const response = await chrome.runtime.sendMessage({action: 'getProfiles'});
            const profiles = response.profiles || [];
            const profile = profiles[profileIndex];
            
            if (profile) {
                const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'fillWithProfile',
                    profile: profile
                });
                
                this.showMessage('success', `✅ Applied profile: ${profile.name || `Profile ${profileIndex + 1}`}`, 'fill-status');
            }
        } catch (error) {
            console.error('Error using profile:', error);
            this.showMessage('error', '❌ Failed to apply profile', 'fill-status');
        }
    }

    async deleteProfile(profileIndex) {
        if (confirm('Are you sure you want to delete this profile?')) {
            try {
                await chrome.runtime.sendMessage({
                    action: 'deleteProfile',
                    profileId: profileIndex
                });
                
                // Reload profiles tab
                this.loadProfilesTab();
            } catch (error) {
                console.error('Error deleting profile:', error);
            }
        }
    }

    disableActions() {
        const buttons = document.querySelectorAll('.action-button');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
    }

    showMessage(type, message, containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="status-message status-${type}">
                    ${message}
                </div>
            `;
        }
    }
}

// Initialize popup
window.autoFillerPopup = new AutoFillerPopup();
