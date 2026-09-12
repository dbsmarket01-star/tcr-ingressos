export type AdmissionCountItem = {
  quantity: number;
  admissionsPerUnit?: number | null;
};

export function getAdmissionCount(items: AdmissionCountItem[]) {
  return items.reduce(
    (total, item) => total + item.quantity * Math.max(item.admissionsPerUnit ?? 1, 1),
    0
  );
}
