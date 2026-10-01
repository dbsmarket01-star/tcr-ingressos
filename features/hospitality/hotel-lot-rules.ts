export const DOUBLE_ROOM_LODGING_LOT_NAME = "Ingresso com hospedagem quarto duplo";

export const DOUBLE_ROOM_EXTRA_NIGHT_NOTE =
  "Diaria extra de quinta para sexta. Entrada na quinta e saida no domingo.";

const SINGLE_NIGHT_LODGING_KEYWORDS = ["apenas hospedagem", "1 diaria"];
const TWO_NIGHTS_LODGING_KEYWORDS = ["duas diarias", "sexta para sabado", "sabado para domingo"];

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
  const lotName = normalizeLotName(lot.name);

  if (lotName === normalizeLotName(DOUBLE_ROOM_LODGING_LOT_NAME)) {
    return DOUBLE_ROOM_EXTRA_NIGHT_NOTE;
  }

  if (TWO_NIGHTS_LODGING_KEYWORDS.every((keyword) => lotName.includes(normalizeLotName(keyword)))) {
    return "Hospedagem de duas diarias: sexta para sabado e sabado para domingo.";
  }

  if (SINGLE_NIGHT_LODGING_KEYWORDS.every((keyword) => lotName.includes(normalizeLotName(keyword)))) {
    return "Hospedagem de uma diaria: sabado para domingo.";
  }

  return null;
}

export function shouldHideWhenSoldOut(lot: { name: string }) {
  return normalizeLotName(lot.name) === normalizeLotName(DOUBLE_ROOM_LODGING_LOT_NAME);
}
