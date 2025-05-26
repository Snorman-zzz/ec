/**
 * Client-side Analytics Tracking
 * Include this script in your frontend to track user behavior
 */

class EquityAnalytics {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.sessionId = this.getOrCreateSessionId();
        this.pageStartTime = Date.now();
        
        // Auto-track page views and events
        this.init();
    }

    init() {
        // Track page load
        this.trackPageView();
        
        // Track page unload
        window.addEventListener('beforeunload', () => {
            this.trackTimeOnPage();
        });

        // Track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.trackTimeOnPage();
            }
        });

        // Auto-track clicks
        document.addEventListener('click', (e) => {
            this.trackClick(e);
        });

        // Auto-track form submissions
        document.addEventListener('submit', (e) => {
            this.trackFormSubmit(e);
        });
    }

    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('equity_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('equity_session_id', sessionId);
        }
        return sessionId;
    }

    async trackEvent(eventData) {
        try {
            await fetch(`${this.baseUrl}/api/tracking/event`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId
                },
                body: JSON.stringify({
                    ...eventData,
                    timestamp: new Date().toISOString(),
                    pageUrl: window.location.pathname,
                    sessionId: this.sessionId
                })
            });
        } catch (error) {
            console.warn('Analytics tracking failed:', error);
        }
    }

    async trackConversion(funnelStep, workspaceId = null) {
        try {
            await fetch(`${this.baseUrl}/api/tracking/conversion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId
                },
                body: JSON.stringify({
                    funnelStep,
                    workspaceId,
                    sessionId: this.sessionId
                })
            });
        } catch (error) {
            console.warn('Conversion tracking failed:', error);
        }
    }

    async trackFeature(featureName) {
        try {
            await fetch(`${this.baseUrl}/api/tracking/feature`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId
                },
                body: JSON.stringify({
                    featureName,
                    sessionId: this.sessionId
                })
            });
        } catch (error) {
            console.warn('Feature tracking failed:', error);
        }
    }

    trackPageView() {
        this.trackEvent({
            eventType: 'page_view',
            eventCategory: 'navigation',
            eventAction: 'view',
            eventLabel: document.title,
            pageUrl: window.location.pathname
        });
    }

    trackTimeOnPage() {
        const timeOnPage = Math.round((Date.now() - this.pageStartTime) / 1000);
        this.trackEvent({
            eventType: 'time_on_page',
            eventCategory: 'engagement',
            eventAction: 'time_spent',
            eventValue: timeOnPage,
            pageUrl: window.location.pathname
        });
    }

    trackClick(event) {
        const element = event.target;
        let eventLabel = element.textContent?.trim() || element.alt || element.id || element.className;
        
        // Track button clicks
        if (element.tagName === 'BUTTON' || element.type === 'button') {
            this.trackEvent({
                eventType: 'click',
                eventCategory: 'button',
                eventAction: 'click',
                eventLabel: eventLabel,
                metadata: {
                    elementType: element.tagName,
                    elementId: element.id,
                    elementClass: element.className
                }
            });
        }
        
        // Track link clicks
        if (element.tagName === 'A') {
            this.trackEvent({
                eventType: 'click',
                eventCategory: 'link',
                eventAction: 'click',
                eventLabel: eventLabel,
                metadata: {
                    href: element.href,
                    external: !element.href.includes(window.location.hostname)
                }
            });
        }
    }

    trackFormSubmit(event) {
        const form = event.target;
        this.trackEvent({
            eventType: 'form_submit',
            eventCategory: 'form',
            eventAction: 'submit',
            eventLabel: form.id || form.className || 'anonymous_form',
            metadata: {
                formAction: form.action,
                formMethod: form.method
            }
        });
    }

    // Custom tracking methods for equity calculator specific events
    trackCalculatorStart() {
        this.trackConversion('started_calc');
        this.trackFeature('equity_calculator');
    }

    trackCalculatorComplete(workspaceId) {
        this.trackConversion('completed_calc', workspaceId);
        this.trackEvent({
            eventType: 'calculator_complete',
            eventCategory: 'conversion',
            eventAction: 'complete',
            eventLabel: 'equity_calculation',
            metadata: { workspaceId }
        });
    }

    trackReportDownload(workspaceId, format = 'json') {
        this.trackConversion('downloaded_report', workspaceId);
        this.trackEvent({
            eventType: 'download',
            eventCategory: 'report',
            eventAction: 'download',
            eventLabel: format,
            metadata: { workspaceId, format }
        });
    }

    trackDashboardUsage(feature) {
        this.trackFeature('analytics_dashboard');
        this.trackEvent({
            eventType: 'dashboard_usage',
            eventCategory: 'analytics',
            eventAction: 'use',
            eventLabel: feature
        });
    }

    trackError(error, context = {}) {
        this.trackEvent({
            eventType: 'error',
            eventCategory: 'error',
            eventAction: 'js_error',
            eventLabel: error.message || error,
            metadata: {
                stack: error.stack,
                context
            }
        });
    }
}

// Initialize analytics when script loads
window.EquityAnalytics = EquityAnalytics;

// Auto-initialize if not in test environment
if (typeof window !== 'undefined' && !window.location.href.includes('test')) {
    window.analytics = new EquityAnalytics();
}

// Usage examples:
/*
// Track custom events
window.analytics.trackEvent({
    eventType: 'custom_action',
    eventCategory: 'user_interaction',
    eventAction: 'button_click',
    eventLabel: 'calculate_equity'
});

// Track conversions
window.analytics.trackConversion('started_calc');

// Track features
window.analytics.trackFeature('advanced_calculator');

// Track errors
window.addEventListener('error', (e) => {
    window.analytics.trackError(e.error);
});
*/