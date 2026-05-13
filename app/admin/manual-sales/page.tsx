import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { createManualSaleAction } from "@/features/manual-sales/manual-sale.actions";
import { listManualSaleOptions } from "@/features/manual-sales/manual-sale.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type ManualSalesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const lotStatusLabels = {
  ACTIVE: "Ativo",
  DRAFT: "Rascunho",
  PAUSED: "Pausado",
  SOLD_OUT: "Esgotado",
  CLOSED: "Encerrado"
} as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseQuantity(value: string | undefined) {
  const parsed = Number.parseInt(value || "1", 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, 20);
}

function formatMoneyInput(valueInCents: number) {
  return (valueInCents / 100).toFixed(2);
}

function formatDateTimeLocal(value: Date) {
  const offsetInMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetInMs).toISOString().slice(0, 16);
}

export default async function ManualSalesPage({ searchParams }: ManualSalesPageProps) {
  const admin = await requirePermission("ORDERS");
  const params = searchParams ? await searchParams : {};
  const selectedEventId = firstParam(params.eventId) || "";
  const selectedLotId = firstParam(params.lotId) || "";
  const selectedQuantity = parseQuantity(firstParam(params.quantity));
  const options = await listManualSaleOptions(admin.organizationId, getAdminAllowedEventIds(admin));
  const selectedEvent = options.find((event) => event.id === selectedEventId) || null;
  const selectedLot = selectedEvent?.lots.find((lot) => lot.id === selectedLotId) || null;
  const availableQuantity = selectedLot
    ? Math.max(selectedLot.totalQuantity - selectedLot.soldQuantity - selectedLot.reservedQuantity, 0)
    : 0;
  const suggestedTotalInCents = selectedLot ? selectedLot.priceInCents * selectedQuantity : 0;
  const hotelGuestCount = selectedLot?.hasHotel ? selectedQuantity : 0;

  return (
    <AdminShell
      title="Venda manual"
      description="Registre vendas antigas ou externas dentro da bilheteria atual, com pedido, QR Code, relatórios e Home List quando houver hotel."
    >
      {typeof params.error === "string" ? <div className="errorBox spacedSection">{params.error}</div> : null}
      {typeof params.created === "string" ? (
        <div className="successBox spacedSection">
          Venda manual registrada no pedido{" "}
          <Link href={`/admin/orders/${params.created}`}>
            <strong>{params.created}</strong>
          </Link>
          . {Number(firstParam(params.homeList) || "0") > 0 ? "Home List gerada automaticamente." : ""}
        </div>
      ) : null}

      <section className="operationCommandStrip spacedSection" aria-label="Cadastro manual de vendas">
        <article className="operationCommandCard">
          <span className="eyebrow">Importacao comercial</span>
          <h2>Traga vendas antigas para o sistema novo sem passar pelo checkout.</h2>
          <p>
            O registro entra como pedido pago, gera ingresso com QR Code, aparece no financeiro e respeita a
            bilheteria logada.
          </p>
        </article>
        <div className="operationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin/orders">
            Pedidos
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/finance">
            Financeiro
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/home-list">
            Home List
          </Link>
        </div>
      </section>

      <section className="card financeFilters adminPanelBlock">
        <div className="filterPanelHeader">
          <div>
            <h2>1. Selecione evento e ingresso</h2>
            <p className="muted">
              Primeiro escolha onde essa venda antiga deve entrar. Depois o formulario completo aparece abaixo.
            </p>
          </div>
        </div>
        <form className="financeFiltersForm">
          <label className="field">
            <span>Evento</span>
            <select name="eventId" defaultValue={selectedEventId} required>
              <option value="">Selecione</option>
              {options.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.title} - {formatDateTime(event.startsAt)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ingresso/lote</span>
            <select name="lotId" defaultValue={selectedLotId} disabled={!selectedEvent} required>
              <option value="">Selecione</option>
              {selectedEvent?.lots.map((lot) => {
                const available = Math.max(lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity, 0);

                return (
                  <option value={lot.id} key={lot.id}>
                    {lot.name} - {formatCurrency(lot.priceInCents)} - {available} disponivel(is)
                  </option>
                );
              })}
            </select>
          </label>
          <label className="field">
            <span>Quantidade</span>
            <input name="quantity" type="number" min="1" max="20" defaultValue={selectedQuantity} required />
          </label>
          <button className="button" type="submit">
            Montar formulario
          </button>
          <Link className="secondaryButton" href="/admin/manual-sales">
            Limpar
          </Link>
        </form>
      </section>

      {selectedEvent && selectedLot ? (
        <form action={createManualSaleAction} className="card form wideForm adminPanelBlock">
          <input type="hidden" name="eventId" value={selectedEvent.id} />
          <input type="hidden" name="lotId" value={selectedLot.id} />
          <input type="hidden" name="quantity" value={selectedQuantity} />
          <input type="hidden" name="hotelGuestCount" value={hotelGuestCount} />

          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">2. Dados da venda</span>
              <h2>{selectedEvent.title}</h2>
            </div>
            <p className="muted">
              {selectedLot.name} · {lotStatusLabels[selectedLot.status]} · {availableQuantity} ingresso(s) disponivel(is).
            </p>
          </div>

          <div className="grid twoColumns">
            <label className="field">
              <span>Nome do comprador</span>
              <input name="buyerName" required placeholder="Nome completo" />
            </label>
            <label className="field">
              <span>E-mail do comprador</span>
              <input name="buyerEmail" type="email" required placeholder="cliente@email.com" />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>CPF/CNPJ</span>
              <input name="buyerDocument" placeholder="Opcional para ingresso sem hotel" />
            </label>
            <label className="field">
              <span>Telefone</span>
              <input name="buyerPhone" placeholder="Opcional para ingresso sem hotel" />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Data da venda</span>
              <input name="paidAt" type="datetime-local" defaultValue={formatDateTimeLocal(new Date())} required />
            </label>
            <label className="field">
              <span>Forma de pagamento original</span>
              <select name="paymentMethod" defaultValue="LEGACY">
                <option value="LEGACY">Sistema antigo</option>
                <option value="PIX">Pix</option>
                <option value="CREDIT_CARD">Cartao de credito</option>
                <option value="CASH">Dinheiro</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="OTHER">Outro</option>
              </select>
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Valor total pago</span>
              <input name="totalPaid" type="number" min="0" step="0.01" defaultValue={formatMoneyInput(suggestedTotalInCents)} />
              <small>Use o valor real da venda antiga. Se houve cortesia, pode ser R$ 0,00.</small>
            </label>
            <label className="field">
              <span>Taxas recebidas</span>
              <input name="serviceFee" type="number" min="0" step="0.01" defaultValue="0.00" />
              <small>Opcional. Esse valor entra separado em “Taxas recebidas”.</small>
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Igreja</span>
              <input name="churchName" placeholder="Opcional" />
            </label>
            <label className="field">
              <span>Origem interna</span>
              <input name="sourceLabel" placeholder="Ex: sistema antigo, planilha, secretaria" />
            </label>
          </div>
          <label className="field">
            <span>Observacoes internas</span>
            <textarea name="internalNotes" rows={3} placeholder="Opcional. Use para explicar de onde veio a venda ou qualquer combinacao comercial." />
          </label>

          {selectedLot.hasHotel ? (
            <section className="formSection compactFormSection">
              <div className="formSectionHeader">
                <div>
                  <span className="sectionEyebrow">Home List / hotelaria</span>
                  <h2>Dados dos hospedes</h2>
                </div>
                <p className="muted">
                  Este ingresso possui hotel. Ao salvar, a Home List sera criada automaticamente para{" "}
                  {selectedLot.hotel ? `${selectedLot.hotel.name} - ${selectedLot.hotel.city}/${selectedLot.hotel.state}` : "o hotel vinculado"}.
                </p>
              </div>

              {Array.from({ length: hotelGuestCount }, (_, index) => {
                const guestIndex = index + 1;
                const prefix = `guest${guestIndex}`;

                return (
                  <article className="manualSaleGuestCard" key={guestIndex}>
                    <div className="formSectionHeader">
                      <div>
                        <span className="sectionEyebrow">Hospedagem {guestIndex}</span>
                        <h3>Hospedes do quarto</h3>
                      </div>
                    </div>
                    <div className="grid twoColumns">
                      <div className="formSection compactFormSection">
                        <h3>Hospede principal</h3>
                        <label className="field">
                          <span>Nome completo</span>
                          <input name={`${prefix}Guest1Name`} required />
                        </label>
                        <label className="field">
                          <span>CPF</span>
                          <input name={`${prefix}Guest1Document`} required />
                        </label>
                        <label className="field">
                          <span>Data de nascimento</span>
                          <input name={`${prefix}Guest1BirthDate`} type="date" required />
                        </label>
                        <label className="field">
                          <span>E-mail</span>
                          <input name={`${prefix}Guest1Email`} type="email" required />
                        </label>
                        <label className="field">
                          <span>Telefone</span>
                          <input name={`${prefix}Guest1Phone`} required />
                        </label>
                      </div>
                      <div className="formSection compactFormSection">
                        <h3>Acompanhante / conjuge</h3>
                        <label className="field">
                          <span>Nome completo</span>
                          <input name={`${prefix}Guest2Name`} required />
                        </label>
                        <label className="field">
                          <span>CPF</span>
                          <input name={`${prefix}Guest2Document`} required />
                        </label>
                        <label className="field">
                          <span>Data de nascimento</span>
                          <input name={`${prefix}Guest2BirthDate`} type="date" required />
                        </label>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}

          <div className="formActions">
            <button className="button" type="submit">
              Registrar venda manual
            </button>
          </div>
        </form>
      ) : (
        <section className="empty card adminPanelBlock">
          Selecione um evento, um ingresso e a quantidade para liberar o cadastro da venda manual.
        </section>
      )}
    </AdminShell>
  );
}
