import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const admin = await requirePermission("CUSTOMERS");
  const params = searchParams ? await searchParams : {};
  const query = params.q?.trim() ?? "";
  const allowedEventIds = getAdminAllowedEventIds(admin);

  const customers = await prisma.customer.findMany({
    where: query
      ? {
          AND: [
            ...(allowedEventIds ? [{ orders: { some: { eventId: { in: allowedEventIds } } } }] : []),
            {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { document: { contains: query } },
                { phone: { contains: query } }
              ]
            }
          ]
        }
      : allowedEventIds
        ? {
            orders: {
              some: {
                eventId: { in: allowedEventIds }
              }
            }
          }
        : undefined,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      _count: {
        select: {
          orders: allowedEventIds
            ? {
                where: {
                  eventId: { in: allowedEventIds }
                }
              }
            : true,
          participants: true
        }
      },
      orders: {
        where: allowedEventIds ? { eventId: { in: allowedEventIds } } : undefined,
        orderBy: [{ createdAt: "desc" }],
        take: 5,
        select: {
          code: true,
          status: true,
          totalInCents: true,
          createdAt: true,
          event: {
            select: {
              title: true
            }
          }
        }
      }
    }
  });

  const summary = customers.reduce(
    (acc, customer) => {
      acc.total += 1;
      acc.orders += customer._count.orders;
      acc.revenue += customer.orders
        .filter((order) => order.status === "PAID")
        .reduce((sum, order) => sum + order.totalInCents, 0);
      if (customer._count.orders > 1) {
        acc.returning += 1;
      }
      return acc;
    },
    { total: 0, orders: 0, revenue: 0, returning: 0 }
  );

  return (
    <AdminShell
      title="Clientes"
      description="Base de compradores para localizar histórico, recorrência e contato com mais velocidade."
    >
      <section className="adminPanelHero compact">
        <div>
          <span className="sectionEyebrow">Relacionamento</span>
          <h2>Compradores organizados para operação real</h2>
          <p className="muted">
            Aqui você localiza rapidamente quem já comprou, quantos pedidos fez e qual foi o último
            evento, sem misturar isso com módulos de outro produto.
          </p>
        </div>
      </section>

      <section className="grid dashboardGrid">
        <article className="card metric">
          <span className="muted">Clientes listados</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pedidos no recorte</span>
          <strong>{summary.orders}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Clientes recorrentes</span>
          <strong>{summary.returning}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Receita dos últimos pedidos</span>
          <strong>{formatCurrency(summary.revenue)}</strong>
          <small>Somente pedidos pagos do recorte</small>
        </article>
      </section>

      <section className="card financeFilters adminPanelBlock">
        <div className="filterPanelHeader">
          <div>
            <h2>Buscar comprador</h2>
            <p className="muted">
              Procure por nome, e-mail, telefone ou documento para responder atendimento e
              localizar compras antigas com mais rapidez.
            </p>
          </div>
        </div>
        <form className="financeFiltersForm">
          <label className="field">
            <span>Buscar</span>
            <input
              name="q"
              placeholder="Nome, e-mail, telefone ou CPF"
              defaultValue={query}
            />
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
          <Link className="secondaryButton" href="/admin/customers">
            Limpar
          </Link>
        </form>
      </section>

      <section className="card adminPanelBlock">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Base de clientes</h2>
            <p className="muted">O foco aqui é descobrir rápido quem é a pessoa, quanto já comprou e qual foi o último contato útil.</p>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="empty">Nenhum cliente encontrado neste recorte.</div>
        ) : (
          <div className="tableScroll wideTableScroll adminTableWrap">
            <table className="table operationalTable customersTable">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Pedidos</th>
                  <th>Participantes</th>
                  <th>Último pedido</th>
                  <th>Último evento</th>
                  <th>Valor do último pedido</th>
                  <th>Ação rápida</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const latestOrder = customer.orders[0];
                  const whatsappDigits = customer.phone?.replace(/\D/g, "");
                  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null;

                  return (
                    <tr key={customer.id}>
                      <td>
                        <strong>{customer.name}</strong>
                        <br />
                        <span className="muted">{customer.document || "Sem documento"}</span>
                      </td>
                      <td>
                        <span className="breakText">{customer.email}</span>
                        <br />
                        <span className="muted">{customer.phone || "Telefone não informado"}</span>
                      </td>
                      <td>{customer._count.orders}</td>
                      <td>{customer._count.participants}</td>
                      <td>{latestOrder ? formatDateTime(latestOrder.createdAt) : "-"}</td>
                      <td>{latestOrder?.event.title ?? "-"}</td>
                      <td>{latestOrder ? formatCurrency(latestOrder.totalInCents) : "-"}</td>
                      <td>
                        <div className="actionRow">
                          {latestOrder ? (
                            <Link className="secondaryButton smallButton" href={`/admin/orders/${latestOrder.code}`}>
                              Ver pedido
                            </Link>
                          ) : null}
                          {whatsappHref ? (
                            <a
                              className="secondaryButton smallButton"
                              href={whatsappHref}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              WhatsApp
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
