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
    }

    async loadCurrentTab() {
        switch (this.currentTab) {
            case 'analyze':
                await this.loadAnalyzeTab();
                break;
            case 'fill':
                await this.loadFillTab();
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
            
            // Send analysis request to content script
            const response = await chrome.tabs.sendMessage(tab.id, {action: 'analyzeForm'});
            
            // Wait a moment for analysis to complete
            setTimeout(async () => {
                const result = await chrome.storage.local.get([`form_analysis_${tab.id}`]);
                const analysis = result[`form_analysis_${tab.id}`];
                
                if (analysis) {
                    this.displayFormAnalysis(analysis);
                } else {
                    throw new Error('No analysis data received');
                }
            }, 1000);
            
        } catch (error) {
            console.error('Analysis error:', error);
            analyzeContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p>Analysis failed</p>
                    <small>Please try refreshing the page and try again</small>
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
            await chrome.tabs.sendMessage(tab.id, {
                action: 'quickFill',
                learningMode: learningMode
            });
            
            setTimeout(() => {
                statusDiv.innerHTML = `
                    <div class="status-success">
                        ✅ Smart fill completed! ${learningMode ? 'New field values have been saved.' : ''}
                    </div>
                `;
                
                // Reload the tab to show updated data count
                setTimeout(() => this.loadFillTab(), 2000);
            }, 1500);
            
        } catch (error) {
            console.error('Fill error:', error);
            statusDiv.innerHTML = `
                <div class="status-error">
                    ❌ Failed to fill form. Please try again.
                </div>
            `;
        }
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
            await chrome.tabs.sendMessage(tab.id, {action: 'analyzeForm'});
            
            setTimeout(() => {
                statusDiv.innerHTML = `
                    <div class="status-success">
                        🔍 Form analysis completed! Check the Analyze tab.
                    </div>
                `;
                
                // Switch to analyze tab
                this.switchTab('analyze');
            }, 1000);
            
        } catch (error) {
            console.error('Analysis error:', error);
            statusDiv.innerHTML = `
                <div class="status-error">
                    ❌ Analysis failed. Make sure you're on a Google Form.
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
