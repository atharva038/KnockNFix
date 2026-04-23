/**
 * KNFCore.booking — Shared booking utility helpers
 * Used by both provider and customer dashboard pages.
 * Attach to window.KNFCore.booking.
 */
(function (global) {
    'use strict';

    /**
     * Format a booking date/time string into a human-readable format.
     * @param {string|Date} dateInput
     * @returns {string} e.g. "Monday, 23 April 2026 at 06:00 PM"
     */
    function formatBookingDate(dateInput) {
        const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        const dateStr = d.toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = d.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        return `${dateStr} at ${timeStr}`;
    }

    /**
     * Convert a raw paymentStatus value to a display string.
     * @param {string} paymentStatus
     * @returns {string}
     */
    function getPaymentStatusText(paymentStatus) {
        const map = {
            completed: 'Fully Paid',
            partially_paid: 'Advance Paid',
            pending: 'Pending'
        };
        return map[paymentStatus] || 'Pending';
    }

    /**
     * Safely set the textContent of a DOM element by its ID.
     * @param {string} elementId
     * @param {string} text
     */
    function setElementText(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = text;
    }

    /**
     * Set a list of modal element IDs to a loading placeholder text.
     * @param {string[]} elementIds
     * @param {string} [placeholder='Loading...']
     */
    function showLoadingInModal(elementIds, placeholder) {
        var text = placeholder || 'Loading...';
        elementIds.forEach(function (id) {
            setElementText(id, text);
        });
    }

    global.KNFCore = global.KNFCore || {};
    global.KNFCore.booking = {
        formatBookingDate: formatBookingDate,
        getPaymentStatusText: getPaymentStatusText,
        setElementText: setElementText,
        showLoadingInModal: showLoadingInModal
    };
})(window);
