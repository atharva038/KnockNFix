document.addEventListener('DOMContentLoaded', function () {
    const core = window.KNFCore || {};
    const api = core.api;
    const notify = core.notify;
    const dom = core.dom;

    const qsa = dom && typeof dom.qsa === 'function'
        ? dom.qsa
        : function (selector, root = document) {
            return Array.from(root.querySelectorAll(selector));
        };

    function showToast(type, message, options) {
        if (notify && typeof notify[type] === 'function') {
            notify[type](message, options);
            return;
        }
        alert(message);
    }

    async function postJson(url, payload) {
        if (api && typeof api.post === 'function') {
            return api.post(url, payload);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: payload ? JSON.stringify(payload) : undefined
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error((data && (data.message || data.error)) || 'Request failed');
        }
        return data;
    }

    qsa('.process-payout-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            const providerId = this.getAttribute('data-provider-id');
            const providerName = this.getAttribute('data-provider-name');
            const amount = this.getAttribute('data-amount');

            document.getElementById('providerIdInput').value = providerId;
            document.getElementById('providerNameDisplay').value = providerName;
            document.getElementById('payoutAmountDisplay').value = amount;

            document.getElementById('transactionReference').value = '';
            document.getElementById('payoutNotes').value = '';

            document.querySelector('.process-payout-form').classList.remove('d-none');
            document.querySelector('.process-payout-form-footer').classList.remove('d-none');
            document.querySelector('.process-payout-success').classList.add('d-none');
            document.querySelector('.process-payout-success-footer').classList.add('d-none');
            document.querySelector('.process-payout-error').classList.add('d-none');
            document.querySelector('.process-payout-error-footer').classList.add('d-none');
        });
    });

    const confirmPayoutBtn = document.getElementById('confirmPayoutBtn');
    if (confirmPayoutBtn) {
        confirmPayoutBtn.addEventListener('click', async function () {
            const providerId = document.getElementById('providerIdInput').value;
            const transactionReference = document.getElementById('transactionReference').value;
            const notes = document.getElementById('payoutNotes').value;

            if (!transactionReference) {
                showToast('warn', 'Transaction reference is required');
                return;
            }

            const spinner = this.querySelector('.spinner-border');
            if (spinner) spinner.classList.remove('d-none');
            this.disabled = true;

            try {
                const data = await postJson(`/admin/process-payout/${providerId}`, { transactionReference, notes });

                if (data.success) {
                    document.querySelector('.process-payout-form').classList.add('d-none');
                    document.querySelector('.process-payout-form-footer').classList.add('d-none');
                    document.querySelector('.process-payout-success').classList.remove('d-none');
                    document.querySelector('.process-payout-success-footer').classList.remove('d-none');
                    document.querySelector('.payout-success-message').textContent = data.message;

                    const modalElement = document.getElementById('processPayoutModal');
                    if (modalElement) {
                        const onHidden = function () {
                            window.location.reload();
                            modalElement.removeEventListener('hidden.bs.modal', onHidden);
                        };
                        modalElement.addEventListener('hidden.bs.modal', onHidden);
                    }
                } else {
                    throw new Error(data.message || 'Failed to process payout');
                }
            } catch (error) {
                document.querySelector('.process-payout-form').classList.add('d-none');
                document.querySelector('.process-payout-form-footer').classList.add('d-none');
                document.querySelector('.process-payout-error').classList.remove('d-none');
                document.querySelector('.process-payout-error-footer').classList.remove('d-none');
                document.querySelector('.payout-error-message').textContent = error.message;
            } finally {
                if (spinner) spinner.classList.add('d-none');
                this.disabled = false;
            }
        });
    }

    const retryPayoutBtn = document.getElementById('retryPayoutBtn');
    if (retryPayoutBtn) {
        retryPayoutBtn.addEventListener('click', function () {
            document.querySelector('.process-payout-form').classList.remove('d-none');
            document.querySelector('.process-payout-form-footer').classList.remove('d-none');
            document.querySelector('.process-payout-error').classList.add('d-none');
            document.querySelector('.process-payout-error-footer').classList.add('d-none');
        });
    }

    qsa('.verify-bank-btn').forEach(function (button) {
        button.addEventListener('click', async function () {
            const providerId = this.getAttribute('data-provider-id');

            try {
                button.disabled = true;
                button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Verifying...';

                const data = await postJson(`/admin/verify-bank-details/${providerId}`);

                if (data.success) {
                    showToast('success', 'Bank details verified successfully', {
                        delay: 3000,
                        onHidden: function () {
                            window.location.reload();
                        }
                    });
                } else {
                    throw new Error(data.message || 'Failed to verify bank details');
                }
            } catch (error) {
                showToast('error', `Error: ${error.message}`);
                console.error('Error verifying bank details:', error);
            } finally {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-check me-1"></i> Verify Bank';
            }
        });
    });

    const exportReportBtn = document.getElementById('exportReportBtn');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', function () {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const format = document.querySelector('input[name="exportFormat"]:checked').value;
            const statuses = qsa('input[type="checkbox"]:checked').map(function (checkbox) {
                return checkbox.value;
            });

            showToast('info', 'Generating report. Download will start soon.');

            const exportModalElement = document.getElementById('exportModal');
            const exportModal = exportModalElement ? bootstrap.Modal.getInstance(exportModalElement) : null;
            if (exportModal) {
                exportModal.hide();
            }

            console.log('Export params:', { startDate, endDate, format, statuses });
        });
    }
});