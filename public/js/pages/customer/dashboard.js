/**
 * Customer Dashboard JavaScript
 * Handles booking management, payments, and user interactions
 */

var knfCore = window.KNFCore || {};
var knfApi = knfCore.api;
var knfNotify = knfCore.notify;

function notify(type, message, options) {
    if (knfNotify && typeof knfNotify[type] === 'function') {
        knfNotify[type](message, options);
        return;
    }
    alert(message);
}

function confirmAction(message) {
    if (knfNotify && typeof knfNotify.confirm === 'function') {
        return knfNotify.confirm(message);
    }
    return window.confirm(message);
}

function getErrorInfo(error, fallbackMessage) {
    const status = error?.response?.status || error?.status || null;
    const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.data?.error ||
        error?.data?.message ||
        error?.message ||
        fallbackMessage;

    return { status, message };
}

async function apiGet(url, options = {}) {
    if (knfApi && typeof knfApi.get === 'function') {
        return knfApi.get(url, options);
    }

    if (window.axios) {
        const response = await window.axios.get(url, options);
        return response.data;
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    });

    const data = await response.json();
    if (!response.ok) {
        const error = new Error((data && (data.error || data.message)) || 'Request failed');
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

async function apiPost(url, body = {}, options = {}) {
    if (knfApi && typeof knfApi.post === 'function') {
        return knfApi.post(url, body, options);
    }

    if (window.axios) {
        const response = await window.axios.post(url, body, options);
        return response.data;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        const error = new Error((data && (data.error || data.message)) || 'Request failed');
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", function () {
    initializeDashboard();
    setupEventListeners();
    initializeTooltips();
});

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize the dashboard with default settings
 */
function initializeDashboard() {
    // Set bookings section as active by default
    const defaultSection = document.getElementById('bookings');
    const defaultNavLink = document.querySelector('.nav-link[data-section="bookings"]');

    if (defaultSection && defaultNavLink) {
        // Activate bookings section
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('active');
        });
        defaultSection.classList.add('active');

        // Activate bookings nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        defaultNavLink.classList.add('active');
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    setupNavigationListeners();
    setupFilterListeners();
    setupBookingActionListeners();
}

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
    const tooltips = document.querySelectorAll("[title]");
    tooltips.forEach((el) => {
        new bootstrap.Tooltip(el);
    });
}

// ============================================================================
// NAVIGATION HANDLERS
// ============================================================================

/**
 * Setup section navigation event listeners
 */
function setupNavigationListeners() {
    const navLinks = document.querySelectorAll(".nav-link[data-section]");
    const sections = document.querySelectorAll(".dashboard-section");

    navLinks.forEach((link) => {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            const targetSection = this.getAttribute("data-section");

            // Update active states
            navLinks.forEach((l) => l.classList.remove("active"));
            this.classList.add("active");

            // Show/hide sections
            sections.forEach((section) => {
                section.classList.remove('active');
                if (section.id === targetSection) {
                    section.classList.add('active');
                }
            });
        });
    });
}

// ============================================================================
// FILTER HANDLERS
// ============================================================================

/**
 * Setup booking status filter event listeners
 */
function setupFilterListeners() {
    const statusFilter = document.querySelector('.status-filter');
    const bookingTable = document.querySelector('.booking-table tbody');

    if (statusFilter && bookingTable) {
        statusFilter.addEventListener('change', function () {
            const selectedStatus = this.value;
            const rows = bookingTable.getElementsByTagName('tr');

            Array.from(rows).forEach(row => {
                const statusCell = row.querySelector('.status-badge');
                if (statusCell) {
                    const rowStatus = statusCell.textContent.trim().toLowerCase();
                    if (selectedStatus === 'all' || rowStatus === selectedStatus) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        });
    }
}

// ============================================================================
// BOOKING ACTION HANDLERS
// ============================================================================

/**
 * Setup booking action event listeners (view, cancel, etc.)
 */
function setupBookingActionListeners() {
    const viewButtons = document.querySelectorAll(".view-booking-btn");
    const cancelButtons = document.querySelectorAll(".cancel-booking-btn");

    // View booking details
    if (viewButtons.length > 0) {
        viewButtons.forEach(button => {
            button.addEventListener("click", async function () {
                const bookingId = this.getAttribute("data-id");
                await fetchBookingDetails(bookingId);
            });
        });
    }

    // Cancel booking
    if (cancelButtons.length > 0) {
        cancelButtons.forEach(button => {
            button.addEventListener("click", async function () {
                const bookingId = this.getAttribute("data-id");
                if (confirmAction('Are you sure you want to cancel this booking?')) {
                    await cancelBooking(bookingId);
                }
            });
        });
    }
}

// ============================================================================
// BOOKING DETAILS FUNCTIONS
// ============================================================================

/**
 * Fetch and display booking details in modal
 * @param {string} bookingId - The booking ID to fetch details for
 */
async function fetchBookingDetails(bookingId) {
    try {
        // Show loading state
        showLoadingState();

        const data = await apiGet(`/api/bookings/${bookingId}`, {
            timeout: 10000
        });
        const booking = data.booking;

        // Update modal with booking details
        updateBookingModal(booking);

        // Show the modal
        const bookingModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('viewBookingModal'));
        bookingModal.show();

    } catch (error) {
        console.error('Error fetching booking details:', error);

        let errorMessage = 'Failed to load booking details. Please try again.';

        const { status, message } = getErrorInfo(error, errorMessage);
        if (status === 401) {
            showSessionExpiredAlert();
            return;
        }

        if (!status && (error.request || error.message === 'Failed to fetch')) {
            errorMessage = 'Network error. Please check your connection.';
        } else {
            errorMessage = message;
        }

        showErrorAlert(errorMessage);
    }
}

/**
 * Show loading state in modal
 */
function showLoadingState() {
    const loadingText = "Loading...";
    const loadingElements = [
        'modal-service-name',
        'modal-provider-name',
        'modal-booking-date',
        'modal-booking-address',
        'modal-booking-notes',
        'modal-booking-cost',
        'modal-payment-status',
        'modal-booking-status'
    ];

    loadingElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = loadingText;
        }
    });
}

/**
 * Update booking modal with fetched data
 * @param {Object} booking - Booking data object
 */
function updateBookingModal(booking) {
    // Basic information
    setElementText('modal-service-name', booking.service?.name || 'Unknown Service');
    setElementText('modal-provider-name', booking.provider?.user?.name || 'Unknown Provider');

    // Format and set date/time
    const bookingDate = new Date(booking.bookingDate || booking.date);
    const dateStr = bookingDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = bookingDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    setElementText('modal-booking-date', `${dateStr} at ${timeStr}`);

    // Address and notes
    setElementText('modal-booking-address', booking.address || "Not specified");
    setElementText('modal-booking-notes', booking.notes || "No notes provided");

    // Cost
    setElementText('modal-booking-cost', `₹${booking.totalCost || 0}`);

    // Payment status
    const paymentStatusText = getPaymentStatusText(booking.paymentStatus);
    setElementText('modal-payment-status', paymentStatusText);

    // Status badge
    const statusBadge = document.getElementById('modal-booking-status');
    if (statusBadge) {
        statusBadge.textContent = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
        statusBadge.className = `status-badge status-${booking.status.toLowerCase()}`;
    }

    // Update payment information and action buttons
    updatePaymentInfo(booking);
    updateActionButtons(booking);
}

/**
 * Get formatted payment status text
 * @param {string} paymentStatus - Payment status from booking
 * @returns {string} Formatted payment status text
 */
function getPaymentStatusText(paymentStatus) {
    const statusMap = {
        'completed': 'Fully Paid',
        'partially_paid': 'Advance Paid',
        'pending': 'Pending'
    };
    return statusMap[paymentStatus] || 'Pending';
}

/**
 * Update payment information based on booking status
 * @param {Object} booking - Booking data object
 */
function updatePaymentInfo(booking) {
    const paymentInfoContainer = document.getElementById('payment-info-container');
    if (!paymentInfoContainer) return;

    const advanceAmount = (booking.totalCost * 0.15).toFixed(2);
    const remainingAmount = (booking.totalCost * 0.85).toFixed(2);

    let paymentHTML = '';

    switch (booking.status) {
        case 'pending':
            if (booking.advancePayment?.paid) {
                paymentHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        Advance payment of ₹${advanceAmount} (15%) completed successfully. 
                        Waiting for provider to confirm your booking.
                    </div>
                `;
            } else {
                paymentHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-info-circle me-2"></i>
                        Your booking is pending advance payment of ₹${advanceAmount} (15%)
                    </div>
                    <button class="btn btn-primary payment-action-btn" onclick="makeAdvancePayment('${booking._id}')">
                        <i class="fas fa-credit-card me-2"></i>
                        Pay Advance (15%)
                    </button>
                `;
            }
            break;

        case 'confirmed':
            paymentHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    Your booking has been confirmed by the provider. 
                    Remaining payment: ₹${remainingAmount} (85%) - Pay this after work completion
                </div>
                <div class="alert alert-warning">
                    <i class="fas fa-clock me-2"></i>
                    <strong>Note:</strong> Pay the remaining amount only after the service is completed to your satisfaction.
                </div>
                <button class="btn btn-success payment-action-btn" onclick="completePayment('${booking._id}')">
                    <i class="fas fa-check-circle me-2"></i>
                    Service Done - Pay Remaining & Complete
                </button>
            `;
            break;

        case 'completed':
            paymentHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    Service completed successfully! Full payment of ₹${booking.totalCost} has been processed.
                </div>
            `;
            break;

        default:
            paymentHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    Payment information will be available once booking is confirmed.
                </div>
            `;
    }

    paymentInfoContainer.innerHTML = paymentHTML;
}

/**
 * Update action buttons based on booking status
 * @param {Object} booking - Booking data object
 */
function updateActionButtons(booking) {
    const actionButtonsContainer = document.getElementById('modal-action-buttons');
    if (!actionButtonsContainer) return;

    let buttonsHTML = '';

    switch (booking.status) {
        case 'pending':
            buttonsHTML = `
                <button type="button" class="btn btn-outline-warning" disabled>
                    <i class="fas fa-clock me-2"></i>Awaiting Provider Confirmation
                </button>
                <button type="button" class="btn btn-danger" onclick="cancelBooking('${booking._id}')">
                    <i class="fas fa-times me-2"></i>Cancel Booking
                </button>
            `;
            break;

        case 'confirmed':
            buttonsHTML = `
                <button type="button" class="btn btn-outline-info" disabled>
                    <i class="fas fa-check me-2"></i>Confirmed by Provider
                </button>
            `;
            break;

        case 'completed':
            buttonsHTML = `
                <button type="button" class="btn btn-outline-primary" onclick="rateService('${booking._id}')">
                    <i class="fas fa-star me-2"></i>Rate Service
                </button>
            `;
            break;

        case 'cancelled':
            buttonsHTML = `
                <button type="button" class="btn btn-outline-secondary" disabled>
                    <i class="fas fa-ban me-2"></i>Booking Cancelled
                </button>
            `;
            break;

        default:
            buttonsHTML = `
                <button type="button" class="btn btn-outline-secondary" disabled>
                    <i class="fas fa-info me-2"></i>Status: ${booking.status}
                </button>
            `;
    }

    actionButtonsContainer.innerHTML = buttonsHTML;
}

// ============================================================================
// PAYMENT FUNCTIONS
// ============================================================================

/**
 * Handle advance payment for booking
 * @param {string} bookingId - The booking ID to make advance payment for
 */
async function makeAdvancePayment(bookingId) {
    if (!confirmAction('Proceed with advance payment (15%) for this booking?')) {
        return;
    }

    try {
        showLoadingAlert('Initiating payment...');

        const data = await apiPost(`/payment/${bookingId}/advance-payment`, {}, {
            timeout: 15000
        });

        if (!data.success) {
            throw new Error(data.error || 'Failed to initiate payment');
        }

        // Initialize Razorpay payment
        const paymentOptions = {
            key: data.key,
            amount: data.order.amount,
            currency: data.order.currency,
            name: "KnockNFix",
            description: `Advance Payment for ${data.booking.service}`,
            order_id: data.order.id,
            handler: function (response) {
                verifyPayment(response, bookingId, 'advance');
            },
            prefill: {
                name: data.booking.customer.name,
                email: data.booking.customer.email,
                contact: data.booking.customer.phone
            },
            theme: {
                color: "#3399cc"
            },
            modal: {
                ondismiss: function () {
                    console.log('Payment dismissed by user');
                }
            }
        };

        hideLoadingAlert();
        const rzp = new Razorpay(paymentOptions);
        rzp.open();

    } catch (error) {
        console.error('Error initiating advance payment:', error);
        hideLoadingAlert();

        let errorMessage = 'Failed to initiate payment. Please try again.';

        errorMessage = getErrorInfo(error, errorMessage).message;

        showErrorAlert(errorMessage);
    }
}

/**
 * Handle final payment completion for booking
 * @param {string} bookingId - The booking ID to complete payment for
 */
async function completePayment(bookingId) {
    if (!confirmAction('Proceed with the remaining payment for this booking?')) {
        return;
    }

    try {
        showLoadingAlert('Initiating final payment...');

        const data = await apiPost(`/payment/${bookingId}/complete-payment`, {}, {
            timeout: 15000
        });

        if (!data.success) {
            throw new Error(data.error || 'Failed to initiate payment');
        }

        if (!data.order || !data.key || !data.booking) {
            throw new Error('Incomplete payment data received from server');
        }

        // Initialize Razorpay payment
        const paymentOptions = {
            key: data.key,
            amount: data.order.amount,
            currency: data.order.currency,
            name: "KnockNFix",
            description: `Final Payment for ${data.booking.service}`,
            order_id: data.order.id,
            handler: function (response) {
                verifyPayment(response, bookingId, 'final');
            },
            prefill: {
                name: data.booking.customer.name || '',
                email: data.booking.customer.email || '',
                contact: data.booking.customer.phone || ''
            },
            theme: {
                color: "#3399cc"
            },
            modal: {
                ondismiss: function () {
                    console.log('Payment dismissed by user');
                }
            }
        };

        hideLoadingAlert();
        const rzp = new Razorpay(paymentOptions);
        rzp.open();

    } catch (error) {
        console.error('Error initiating final payment:', error);
        hideLoadingAlert();

        let errorMessage = 'Failed to initiate payment. Please try again.';

        errorMessage = getErrorInfo(error, errorMessage).message;

        showErrorAlert(errorMessage);
    }
}

/**
 * Verify payment with server after Razorpay success
 * @param {Object} razorpayResponse - Response from Razorpay
 * @param {string} bookingId - The booking ID
 * @param {string} paymentType - Type of payment ('advance' or 'final')
 */
async function verifyPayment(razorpayResponse, bookingId, paymentType) {
    try {
        showLoadingAlert('Verifying payment...');

        console.log("Verifying payment with data:", {
            razorpay_order_id: razorpayResponse.razorpay_order_id,
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_signature: razorpayResponse.razorpay_signature,
            bookingId: bookingId,
            paymentType: paymentType
        });

        const data = await apiPost('/payment/verify-payment', {
            razorpay_order_id: razorpayResponse.razorpay_order_id,
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_signature: razorpayResponse.razorpay_signature,
            bookingId: bookingId,
            paymentType: paymentType
        }, {
            timeout: 10000
        });

        if (!data.success) {
            throw new Error(data.error || 'Payment verification failed');
        }

        hideLoadingAlert();

        if (paymentType === 'final') {
            // Redirect to feedback page after final payment
            showSuccessAlert('Payment successful! Redirecting to feedback page...');
            setTimeout(() => {
                window.location.href = `/feedback/${bookingId}`;
            }, 2000);
        } else {
            showSuccessAlert('Payment processed successfully!');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }

    } catch (error) {
        console.error('Error verifying payment:', error);
        hideLoadingAlert();

        let errorMessage = 'Payment verification failed. Please contact support.';

        errorMessage = getErrorInfo(error, errorMessage).message;

        showErrorAlert(errorMessage);
    }
}

// ============================================================================
// BOOKING MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Cancel a booking
 * @param {string} bookingId - The booking ID to cancel
 */
async function cancelBooking(bookingId) {
    try {
        const reason = prompt("Please provide a reason for cancellation (optional):");

        showLoadingAlert('Cancelling booking...');

        const data = await apiPost(`/booking/cancel/${bookingId}`, {
            reason: reason || 'No reason provided'
        }, {
            timeout: 10000
        });

        if (!data.success) {
            throw new Error(data.error || 'Failed to cancel booking');
        }

        hideLoadingAlert();
        showSuccessAlert(data.message || 'Booking cancelled successfully!');

        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (error) {
        console.error('Error cancelling booking:', error);
        hideLoadingAlert();

        let errorMessage = 'Failed to cancel booking';

        const { status, message: serverError } = getErrorInfo(error, errorMessage);

        if (serverError && serverError !== errorMessage) {

            // Handle specific error cases
            if (serverError.includes('24 hours') || serverError.includes('2 hours')) {
                showWarningAlert(`Cancellation Policy:\n\n${serverError}\n\nFor urgent cancellations, please contact customer support.`);
                return;
            } else if (serverError.includes('already cancelled')) {
                showInfoAlert('This booking is already cancelled.');
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
                return;
            } else if (serverError.includes('completed')) {
                showInfoAlert('Completed bookings cannot be cancelled. For refunds, please contact support.');
                return;
            }

            errorMessage = serverError;
        } else if (status === 401) {
            showSessionExpiredAlert();
            return;
        }

        showErrorAlert(errorMessage);
    }
}

/**
 * Navigate to service rating page
 * @param {string} bookingId - The booking ID to rate
 */
function rateService(bookingId) {
    window.location.href = `/feedback/${bookingId}`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Set text content of element by ID
 * @param {string} elementId - Element ID
 * @param {string} text - Text to set
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

// ============================================================================
// ALERT FUNCTIONS
// ============================================================================

/**
 * Show loading alert
 * @param {string} message - Loading message
 */
function showLoadingAlert(message = 'Loading...') {
    // You can implement a loading spinner/modal here
    console.log('Loading:', message);
}

/**
 * Hide loading alert
 */
function hideLoadingAlert() {
    // Hide loading spinner/modal
    console.log('Loading complete');
}

/**
 * Show success alert
 * @param {string} message - Success message
 */
function showSuccessAlert(message) {
    notify('success', message);
}

/**
 * Show error alert
 * @param {string} message - Error message
 */
function showErrorAlert(message) {
    notify('error', message);
}

/**
 * Show warning alert
 * @param {string} message - Warning message
 */
function showWarningAlert(message) {
    notify('warn', message, { delay: 5000 });
}

/**
 * Show info alert
 * @param {string} message - Info message
 */
function showInfoAlert(message) {
    notify('info', message);
}

/**
 * Show session expired alert and redirect to login
 */
function showSessionExpiredAlert() {
    notify('warn', 'Session expired. Please log in again.', {
        delay: 1500,
        onHidden: function () {
            window.location.href = '/login';
        }
    });

    setTimeout(function () {
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    }, 1600);
}

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

/**
 * Global error handler for unhandled promise rejections
 */
window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled promise rejection:', event.reason);
    showErrorAlert('An unexpected error occurred. Please try again.');
});