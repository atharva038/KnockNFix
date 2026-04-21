(function (global) {
    const dom = {
        qs(selector, root = document) {
            return root.querySelector(selector);
        },

        qsa(selector, root = document) {
            return Array.from(root.querySelectorAll(selector));
        },

        on(target, eventName, selectorOrHandler, handler) {
            if (!target) return;

            if (typeof selectorOrHandler === 'function') {
                target.addEventListener(eventName, selectorOrHandler);
                return;
            }

            target.addEventListener(eventName, function (event) {
                const matched = event.target.closest(selectorOrHandler);
                if (!matched || !target.contains(matched)) return;
                handler.call(matched, event, matched);
            });
        }
    };

    global.KNFCore = global.KNFCore || {};
    global.KNFCore.dom = dom;
})(window);