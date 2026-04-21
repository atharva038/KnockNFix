(function (global) {
    async function request(method, url, body, options = {}) {
        const headers = new Headers(options.headers || {});
        const fetchOptions = {
            method,
            headers,
            credentials: options.credentials || 'same-origin'
        };

        if (body !== undefined && body !== null) {
            if (body instanceof FormData) {
                fetchOptions.body = body;
            } else {
                if (!headers.has('Content-Type')) {
                    headers.set('Content-Type', 'application/json');
                }
                fetchOptions.body = JSON.stringify(body);
            }
        }

        const timeout = options.timeout || 15000;
        const controller = new AbortController();
        const timer = setTimeout(function () {
            controller.abort();
        }, timeout);
        fetchOptions.signal = controller.signal;

        try {
            const response = await fetch(url, fetchOptions);
            const contentType = response.headers.get('content-type') || '';
            let data = null;

            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const message =
                    (data && (data.message || data.error)) ||
                    `Request failed with status ${response.status}`;
                const error = new Error(message);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    const api = {
        request,
        get(url, options) {
            return request('GET', url, null, options);
        },
        post(url, body, options) {
            return request('POST', url, body, options);
        },
        put(url, body, options) {
            return request('PUT', url, body, options);
        },
        patch(url, body, options) {
            return request('PATCH', url, body, options);
        },
        delete(url, body, options) {
            return request('DELETE', url, body, options);
        }
    };

    global.KNFCore = global.KNFCore || {};
    global.KNFCore.api = api;
})(window);