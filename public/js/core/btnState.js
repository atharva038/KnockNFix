/**
 * KNFCore.btnState — Button loading-state helper
 * Eliminates the repeated disabled + spinner HTML pattern across all pages.
 * Attach to window.KNFCore.btnState.
 *
 * Usage example:
 *   const reset = KNFCore.btnState.setLoading(btn, 'Saving...');
 *   try { await doWork(); } finally { reset(); }
 *
 * Or with the all-in-one wrapper:
 *   await KNFCore.btnState.withLoading(btn, 'Saving...', async () => {
 *       await doWork();
 *   });
 */
(function (global) {
    'use strict';

    var SPINNER_HTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>';

    /**
     * Put a button into a loading state and return a reset function.
     * @param {HTMLElement} btn
     * @param {string} [loadingText='Processing...']
     * @returns {function} Call the returned function to restore the original state.
     */
    function setLoading(btn, loadingText) {
        if (!btn) return function () {};
        var originalHTML = btn.innerHTML;
        var originalDisabled = btn.disabled;

        btn.disabled = true;
        btn.innerHTML = SPINNER_HTML + ' ' + (loadingText || 'Processing...');

        return function reset() {
            btn.disabled = originalDisabled;
            btn.innerHTML = originalHTML;
        };
    }

    /**
     * Run an async function with the button in a loading state.
     * Automatically restores the button when done (success or error).
     * @param {HTMLElement} btn
     * @param {string} loadingText
     * @param {function} asyncFn  Must return a Promise.
     * @returns {Promise}
     */
    function withLoading(btn, loadingText, asyncFn) {
        var reset = setLoading(btn, loadingText);
        return Promise.resolve()
            .then(asyncFn)
            .finally(reset);
    }

    global.KNFCore = global.KNFCore || {};
    global.KNFCore.btnState = {
        setLoading: setLoading,
        withLoading: withLoading
    };
})(window);
