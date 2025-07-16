// 🚀 Epic Background Service Worker for Google Forms Auto Filler
class AutoFillerBackground {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupContextMenus();
        this.setupNotifications();
        console.log('🚀 Auto Filler Background Service Worker initialized!');
    }

    setupEventListeners() {
        // Extension installed/updated
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });

        // Tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Messages from content script and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async response
        });

        // Keyboard shortcuts
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });
    }

    setupContextMenus() {
        chrome.contextMenus.create({
            id: 'fillForm',
            title: '⚡ Auto Fill This Form',
            contexts: ['page'],
            documentUrlPatterns: ['https://docs.google.com/forms/*']
        });

        chrome.contextMenus.create({
            id: 'analyzeForm',
            title: '🔍 Analyze Form Fields',
            contexts: ['page'],
            documentUrlPatterns: ['https://docs.google.com/forms/*']
        });

        chrome.contextMenus.create({
            id: 'separator',
            type: 'separator',
            contexts: ['page'],
            documentUrlPatterns: ['https://docs.google.com/forms/*']
        });

        chrome.contextMenus.create({
            id: 'openPopup',
            title: '🎯 Open Auto Filler',
            contexts: ['page', 'action']
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenu(info, tab);
        });
    }

    setupNotifications() {
        // Enable notifications for form filling status
        chrome.notifications.onClicked.addListener((notificationId) => {
            if (notificationId === 'form-filled') {
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    chrome.tabs.reload(tabs[0].id);
                });
            }
        });
    }

    handleInstall(details) {
        if (details.reason === 'install') {
            // First time installation
            this.showWelcomeNotification();
            this.setDefaultSettings();
        } else if (details.reason === 'update') {
            // Extension updated
            this.showUpdateNotification();
        }
    }

    handleTabUpdate(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url && tab.url.includes('docs.google.com/forms')) {
            // Inject form detection script
            this.injectFormDetector(tabId);
            
            // Update badge to show form detected
            chrome.action.setBadgeText({
                text: '📝',
                tabId: tabId
            });
            
            chrome.action.setBadgeBackgroundColor({
                color: '#4CAF50',
                tabId: tabId
            });
        } else {
            // Clear badge for non-form pages
            chrome.action.setBadgeText({
                text: '',
                tabId: tabId
            });
        }
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getProfiles':
                    const profiles = await this.getStoredProfiles();
                    sendResponse({success: true, profiles});
                    break;

                case 'saveProfile':
                    await this.saveProfile(request.profile);
                    sendResponse({success: true});
                    break;

                case 'deleteProfile':
                    await this.deleteProfile(request.profileId);
                    sendResponse({success: true});
                    break;

                case 'formAnalyzed':
                    await this.handleFormAnalysis(request.data, sender.tab);
                    sendResponse({success: true});
                    break;

                case 'formFilled':
                    await this.handleFormFilled(request.data, sender.tab);
                    sendResponse({success: true});
                    break;

                case 'showNotification':
                    this.showNotification(request.title, request.message, request.type);
                    sendResponse({success: true});
                    break;

                default:
                    sendResponse({success: false, error: 'Unknown action'});
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({success: false, error: error.message});
        }
    }

    async handleCommand(command) {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        switch (command) {
            case 'fill-form':
                if (tab.url.includes('docs.google.com/forms')) {
                    chrome.tabs.sendMessage(tab.id, {action: 'quickFill'});
                }
                break;
            
            case 'analyze-form':
                if (tab.url.includes('docs.google.com/forms')) {
                    chrome.tabs.sendMessage(tab.id, {action: 'analyzeForm'});
                }
                break;
        }
    }

    async handleContextMenu(info, tab) {
        switch (info.menuItemId) {
            case 'fillForm':
                chrome.tabs.sendMessage(tab.id, {action: 'quickFill'});
                break;
            
            case 'analyzeForm':
                chrome.tabs.sendMessage(tab.id, {action: 'analyzeForm'});
                break;
            
            case 'openPopup':
                chrome.action.openPopup();
                break;
        }
    }

    async injectFormDetector(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: {tabId: tabId},
                function: this.detectFormFields
            });
        } catch (error) {
            console.error('Error injecting form detector:', error);
        }
    }

    detectFormFields() {
        // This function runs in the page context
        const forms = document.querySelectorAll('form');
        const fieldCount = document.querySelectorAll('input, textarea, select').length;
        
        if (fieldCount > 0) {
            console.log(`🎯 Detected ${fieldCount} form fields!`);
            
            // Add visual indicator
            const indicator = document.createElement('div');
            indicator.id = 'autofiller-indicator';
            indicator.innerHTML = '🚀 Auto Filler Ready!';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: linear-gradient(45deg, #4CAF50, #45a049);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                animation: slideIn 0.5s ease-out;
            `;
            
            // Add animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(indicator);
            
            // Remove indicator after 3 seconds
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 3000);
        }
    }

    async getStoredProfiles() {
        const result = await chrome.storage.local.get(['profiles']);
        return result.profiles || [];
    }

    async saveProfile(profile) {
        const profiles = await this.getStoredProfiles();
        profiles.push(profile);
        await chrome.storage.local.set({profiles});
    }

    async deleteProfile(profileId) {
        const profiles = await this.getStoredProfiles();
        profiles.splice(profileId, 1);
        await chrome.storage.local.set({profiles});
    }

    async setDefaultSettings() {
        const defaultSettings = {
            fillDelay: 100,
            autoSubmit: false,
            smartFill: true,
            showNotifications: true,
            useKeyboardShortcuts: true,
            theme: 'dark'
        };

        await chrome.storage.local.set({settings: defaultSettings});
    }

    showWelcomeNotification() {
        chrome.notifications.create('welcome', {
            type: 'basic',
            iconUrl: 'icons/icon.png',
            title: '🚀 Welcome to Auto Filler Pro!',
            message: 'Create your first profile to start filling forms automatically!'
        });
    }

    showUpdateNotification() {
        chrome.notifications.create('update', {
            type: 'basic',
            iconUrl: 'icons/icon.png',
            title: '✨ Auto Filler Pro Updated!',
            message: 'New features and improvements are ready to use!'
        });
    }

    showNotification(title, message, type = 'basic') {
        const iconUrl = type === 'success' ? 'icons/icon.png' : 'icons/icon.png';
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: iconUrl,
            title: title,
            message: message
        });
    }

    async handleFormAnalysis(data, tab) {
        // Store form analysis data
        await chrome.storage.local.set({
            [`form_analysis_${tab.id}`]: {
                ...data,
                timestamp: Date.now(),
                url: tab.url
            }
        });
    }

    async handleFormFilled(data, tab) {
        // Log form filling statistics
        const stats = await chrome.storage.local.get(['fillStats']) || {fillStats: {}};
        const today = new Date().toISOString().split('T')[0];
        
        if (!stats.fillStats[today]) {
            stats.fillStats[today] = 0;
        }
        stats.fillStats[today]++;
        
        await chrome.storage.local.set({fillStats: stats.fillStats});
        
        // Show success notification
        this.showNotification(
            '✅ Form Filled Successfully!',
            `Filled ${data.fieldCount} fields in ${data.duration}ms`,
            'success'
        );
    }
}

// Initialize the epic background service
new AutoFillerBackground();

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
    console.log('🚀 Auto Filler Pro service worker started!');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    if (tab.url.includes('docs.google.com/forms')) {
        chrome.tabs.sendMessage(tab.id, {action: 'quickFill'});
    }
});

// Performance monitoring
const performanceObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
        if (entry.duration > 1000) {
            console.warn(`⚠️ Slow operation detected: ${entry.name} took ${entry.duration}ms`);
        }
    });
});

performanceObserver.observe({entryTypes: ['measure']});

// Memory cleanup
setInterval(() => {
    // Clean up old form analysis data (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    chrome.storage.local.get(null, (items) => {
        const keysToRemove = [];
        
        for (const key in items) {
            if (key.startsWith('form_analysis_') && items[key].timestamp < oneHourAgo) {
                keysToRemove.push(key);
            }
        }
        
        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove);
            console.log(`🧹 Cleaned up ${keysToRemove.length} old form analysis entries`);
        }
    });
}, 30 * 60 * 1000); // Run every 30 minutes