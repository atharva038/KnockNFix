(function (global) {
    const TOAST_CONTAINER_ID = 'knf-toast-container';

    function getOrCreateContainer() {
        let container = document.getElementById(TOAST_CONTAINER_ID);
        if (container) return container;

        container = document.createElement('div');
        container.id = TOAST_CONTAINER_ID;
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '1080';
        document.body.appendChild(container);
        return container;
    }

    function createToast(type, message, options = {}) {
        if (!global.bootstrap || !bootstrap.Toast) {
            alert(message);
            return;
        }

        const typeClassMap = {
            success: 'text-bg-success',
            error: 'text-bg-danger',
            info: 'text-bg-primary',
            warn: 'text-bg-warning'
        };

        const container = getOrCreateContainer();
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center border-0 ${typeClassMap[type] || 'text-bg-secondary'}`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');

        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close ${type === 'warn' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;

        container.appendChild(toastEl);

        const toast = new bootstrap.Toast(toastEl, {
            delay: options.delay || 3000
        });

        toastEl.addEventListener('hidden.bs.toast', function () {
            toastEl.remove();
            if (typeof options.onHidden === 'function') {
                options.onHidden();
            }
        });

        toast.show();
    }

    const notify = {
        success(message, options) {
            createToast('success', message, options);
        },
        error(message, options) {
            createToast('error', message, options);
        },
        info(message, options) {
            createToast('info', message, options);
        },
        warn(message, options) {
            createToast('warn', message, options);
        },
        confirm(message) {
            return window.confirm(message);
        }
    };

    global.KNFCore = global.KNFCore || {};
    global.KNFCore.notify = notify;
})(window);