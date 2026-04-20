const ALLOWED_STATUS_TRANSITIONS = {
  pending: new Set(["confirmed", "cancelled", "rejected"]),
  confirmed: new Set(["in_progress", "completed", "cancelled"]),
  in_progress: new Set(["completed", "cancelled"]),
  completed: new Set([]),
  cancelled: new Set([]),
  rejected: new Set([]),
};

function isBookingFinalPaymentSettled(booking) {
  if (!booking) {
    return false;
  }

  return Boolean(booking.finalPayment?.paid) || booking.paymentStatus === "completed";
}

function canTransitionBookingStatus(currentStatus, nextStatus) {
  if (!currentStatus || !nextStatus) {
    return false;
  }

  if (currentStatus === nextStatus) {
    return true;
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  if (!allowed) {
    return false;
  }

  return allowed.has(nextStatus);
}

function validateBookingStatusTransition(booking, nextStatus, options = {}) {
  const currentStatus = booking?.status;
  const requireFinalPaymentForCompletion =
    options.requireFinalPaymentForCompletion !== false;

  if (!currentStatus) {
    return { ok: false, error: "Booking status is missing." };
  }

  if (!nextStatus) {
    return { ok: false, error: "Target booking status is required." };
  }

  if (!canTransitionBookingStatus(currentStatus, nextStatus)) {
    return {
      ok: false,
      error: `Cannot change booking status from ${currentStatus} to ${nextStatus}.`,
    };
  }

  if (
    nextStatus === "completed" &&
    requireFinalPaymentForCompletion &&
    !isBookingFinalPaymentSettled(booking)
  ) {
    return {
      ok: false,
      error: "Final payment must be completed before marking booking as completed.",
    };
  }

  return { ok: true };
}

function transitionBookingStatus(booking, nextStatus, options = {}) {
  const validation = validateBookingStatusTransition(booking, nextStatus, options);
  if (!validation.ok) {
    return validation;
  }

  const now = options.now || new Date();

  booking.status = nextStatus;

  if (nextStatus === "completed") {
    booking.completedAt = now;
    if (options.setPaymentCompleted) {
      booking.paymentStatus = "completed";
    }
  }

  if (nextStatus === "cancelled") {
    booking.cancelledAt = now;
    if (options.cancellationReason) {
      booking.cancellationReason = options.cancellationReason;
    }
  }

  return { ok: true };
}

module.exports = {
  ALLOWED_STATUS_TRANSITIONS,
  isBookingFinalPaymentSettled,
  canTransitionBookingStatus,
  validateBookingStatusTransition,
  transitionBookingStatus,
};
