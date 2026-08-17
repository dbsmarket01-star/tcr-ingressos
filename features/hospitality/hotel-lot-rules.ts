export const DOUBLE_ROOM_LODGING_LOT_NAME = "Ingresso com hospedagem quarto duplo";

export const DOUBLE_ROOM_EXTRA_NIGHT_NOTE =
  "Diaria extra de quinta para sexta. Entrada na quinta e saida no domingo.";

function normalizeLotName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getHotelRoomsPerUnit(lot: { name: string; hasHotel?: boolean | null }) {
  if (!lot.hasHotel) {
    return 0;
  }

  return normalizeLotName(lot.name) === normalizeLotName(DOUBLE_ROOM_LODGING_LOT_NAME) ? 2 : 1;
}

export function getHomeListNotesForLot(lot: { name: string }) {
  return normalizeLotName(lot.name) === normalizeLotName(DOUBLE_ROOM_LODGING_LOT_NAME)
    ? DOUBLE_ROOM_EXTRA_NIGHT_NOTE
    : null;
}

export function shouldHideWhenSoldOut(lot: { name: string }) {
  return normalizeLotName(lot.name) === normalizeLotName(DOUBLE_ROOM_LODGING_LOT_NAME);
}
