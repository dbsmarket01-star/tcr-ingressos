import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { updateTicketLotAction } from "@/features/lots/lot.actions";
import { getTicketLotForEdit } from "@/features/lots/lot.service";
import { formatDateTimeInput } from "@/lib/format";

export const dynamic = "force-dynamic";

type EditLotPageProps = {
  params: Promise<{
    eventId: string;
    lotId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditLotPage({ params, searchParams }: EditLotPageProps) {
  await requirePermission("EVENTS");
  const { eventId, lotId } = await params;
  const query = searchParams ? await searchParams : {};
  const lot = await getTicketLotForEdit(eventId, lotId);

  if (!lot) {
    notFound();
  }

  return (
    <AdminShell
      title="Editar ingresso"
      description={`Atualize nome, preço, taxas, quantidade e regras de venda de ${lot.event.title}.`}
    >
      {typeof query.error === "string" ? <div className="errorBox spacedSection">{query.error}</div> : null}

      <form action={updateTicketLotAction} className="card form wideForm">
        <input type="hidden" name="eventId" value={lot.eventId} />
        <input type="hidden" name="eventSlug" value={lot.event.slug} />
        <input type="hidden" name="lotId" value={lot.id} />

        <div className="formSection">
          <h2>Dados do ingresso</h2>
          <label className="field">
            <span>Nome</span>
            <input name="name" defaultValue={lot.name} required />
          </label>
          <label className="field">
            <span>Descrição</span>
            <input name="description" defaultValue={lot.description ?? ""} />
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Preço</span>
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={(lot.priceInCents / 100).toFixed(2)}
                required
              />
            </label>
            <label className="field">
              <span>Quantidade total</span>
              <input name="totalQuantity" type="number" min="1" defaultValue={lot.totalQuantity} required />
              <small>
                Já vendidos/reservados: {lot.soldQuantity + lot.reservedQuantity}. O total não pode ser menor que isso.
              </small>
            </label>
          </div>
        </div>

        <div className="formSection">
          <h2>Taxas e parcelamento</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Taxa sobre ingresso (%)</span>
              <input
                name="serviceFeePercent"
                type="number"
                min="0"
                max="30"
                step="0.01"
                defaultValue={(lot.serviceFeeBps / 100).toFixed(2)}
                required
              />
            </label>
            <label className="field">
              <span>Desconto no Pix</span>
              <select
                name="pixDiscountType"
                defaultValue={
                  lot.pixDiscountPercentBps > 0 ? "PERCENTAGE" : lot.pixDiscountFixedInCents > 0 ? "FIXED" : "NONE"
                }
              >
                <option value="NONE">Sem desconto</option>
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Desconto Pix (%)</span>
              <input
                name="pixDiscountPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={(lot.pixDiscountPercentBps / 100).toFixed(2)}
              />
            </label>
            <label className="field">
              <span>Desconto Pix (R$)</span>
              <input
                name="pixDiscountFixed"
                type="number"
                min="0"
                step="0.01"
                defaultValue={(lot.pixDiscountFixedInCents / 100).toFixed(2)}
              />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Juros do cartão por parcela (%)</span>
              <input
                name="cardInterestPercentPerInstallment"
                type="number"
                min="0"
                max="10"
                step="0.01"
                defaultValue={(lot.cardInterestBpsPerInstallment / 100).toFixed(2)}
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Cobrar juros a partir da parcela</span>
            <select name="cardInterestStartsAtInstallment" defaultValue={String(lot.cardInterestStartsAtInstallment)}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((installment) => (
                <option value={installment} key={installment}>
                  {installment}x
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="formSection">
          <h2>Regras de venda</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Mínimo por pedido</span>
              <input name="minPerOrder" type="number" min="1" defaultValue={lot.minPerOrder} required />
            </label>
            <label className="field">
              <span>Máximo por pedido</span>
              <input name="maxPerOrder" type="number" min="1" defaultValue={lot.maxPerOrder} required />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Início das vendas</span>
              <input name="salesStartsAt" type="datetime-local" defaultValue={formatDateTimeInput(lot.salesStartsAt)} />
            </label>
            <label className="field">
              <span>Fim das vendas</span>
              <input name="salesEndsAt" type="datetime-local" defaultValue={formatDateTimeInput(lot.salesEndsAt)} />
            </label>
          </div>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={lot.status}>
              <option value="DRAFT">Rascunho</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PAUSED">Pausado</option>
              <option value="CLOSED">Encerrado</option>
            </select>
          </label>
        </div>

        <div className="formActions">
          <Link className="secondaryButton" href={`/admin/events/${lot.eventId}`}>
            Cancelar
          </Link>
          <button className="button" type="submit">
            Salvar ingresso
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
