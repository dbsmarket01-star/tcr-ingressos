type TicketForCheckIn = {
  status: "ACTIVE" | "USED" | "CANCELED" | "INVALID";
};

export function getCheckInDecision(ticket?: TicketForCheckIn) {
  if (!ticket) {
    return "INVALID";
  }

  if (ticket.status === "USED") {
    return "ALREADY_USED";
  }

  if (ticket.status === "CANCELED") {
    return "CANCELED";
  }

  if (ticket.status === "INVALID") {
    return "INVALID";
  }

  return "APPROVED";
}
