import { AdminRole } from "@prisma/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminUserEventScopeField } from "@/components/admin/AdminUserEventScopeField";
import {
  createAdminUserAction,
  updateAdminUserEventAccessAction,
  updateAdminUserRoleAction,
  updateAdminUserStatusAction
} from "@/features/admin-users/admin-user.actions";
import { listAdminUsers } from "@/features/admin-users/admin-user.service";
import { requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const roleLabels = {
  OWNER: "Proprietário",
  MANAGER: "Gerente",
  FINANCE: "Financeiro",
  SUPPORT: "Atendimento",
  STAFF: "Operação",
  CHECKIN: "Portaria"
};

function getAccessProfile(user: {
  role: AdminRole;
  accessAllEvents: boolean;
  allowedEventIds: string[];
}) {
  if (user.role === AdminRole.OWNER) {
    return {
      label: "Cliente / dono da operação",
      note: "Acesso total à bilheteria e às configurações da operação.",
      tone: "published"
    };
  }

  if (user.role === AdminRole.MANAGER || user.role === AdminRole.FINANCE) {
    return {
      label: "Gestão da operação",
      note: user.accessAllEvents ? "Vê a base inteira da operação." : "Tem governança parcial com eventos filtrados.",
      tone: "pending"
    };
  }

  if (!user.accessAllEvents) {
    return {
      label: "Equipe restrita",
      note: `${user.allowedEventIds.length} evento(s) liberado(s)`,
      tone: "draft"
    };
  }

  return {
    label: "Equipe operacional",
    note: "Acesso às áreas liberadas no papel atual.",
    tone: "pending"
  };
}

type AdminUsersPageProps = {
  searchParams?: Promise<{
    error?: string;
    created?: string;
    updated?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const admin = await requirePermission("USERS");
  const organizationContext = await getCurrentOrganizationContext();
  const params = searchParams ? await searchParams : {};
  const [users, events] = await Promise.all([
    listAdminUsers(admin.organizationId!),
    prisma.event.findMany({
      where: {
        organizationId: admin.organizationId!
      },
      orderBy: [{ startsAt: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true
      }
    })
  ]);
  const eventTitleById = new Map(events.map((event) => [event.id, event.title]));
  const error = typeof params.error === "string" ? params.error : "";
  const created = typeof params.created === "string" ? params.created : "";
  const updated = typeof params.updated === "string" ? params.updated : "";
  const activeUsers = users.filter((user) => user.isActive);
  const restrictedUsers = users.filter((user) => !user.accessAllEvents && user.role !== AdminRole.OWNER);
  const ownerUsers = users.filter((user) => user.role === AdminRole.OWNER);
  const managementUsers = users.filter((user) => user.role === AdminRole.MANAGER || user.role === AdminRole.FINANCE);

  return (
    <AdminShell
      title="Usuários"
      description={`Gerencie equipe interna, papéis e acesso ao painel da ${organizationContext.brandName}.`}
    >
      {error ? <div className="errorBox spacedSection">{error}</div> : null}
      {created ? <div className="successBox spacedSection">Usuário criado: {created}</div> : null}
      {updated ? <div className="successBox spacedSection">{updated}</div> : null}

      <section className="operationCommandStrip spacedSection" aria-label="Leitura rápida da equipe">
        <article className="operationCommandCard">
          <span className="eyebrow">Equipe da operação</span>
          <h2>Quem entra no painel da {organizationContext.brandName} e com qual nível de acesso.</h2>
          <p>Use esta tela para liberar o cliente, organizar o time e limitar o acesso por evento quando isso fizer sentido.</p>
        </article>
        <div className="operationCommandActions">
          <a className="secondaryButton smallButton" href="/admin">
            Dashboard
          </a>
          <a className="secondaryButton smallButton" href="/admin/events">
            Eventos
          </a>
          <a className="secondaryButton smallButton" href="/admin/account">
            Minha conta
          </a>
        </div>
      </section>

      <section className="grid dashboardGrid spacedSection">
        <article className="card metric dashboardHeroMetric">
          <span className="muted">Usuários ativos</span>
          <strong>{activeUsers.length}</strong>
          <small>Equipe hoje com acesso ao painel</small>
        </article>
        <article className="card metric">
          <span className="muted">Total da equipe</span>
          <strong>{users.length}</strong>
          <small>Inclui usuários inativos</small>
        </article>
        <article className="card metric">
          <span className="muted">Acesso restrito</span>
          <strong>{restrictedUsers.length}</strong>
          <small>Usuários limitados a eventos específicos</small>
        </article>
        <article className="card metric">
          <span className="muted">Cliente / dono</span>
          <strong>{ownerUsers.length}</strong>
          <small>Acessos que governam a operação</small>
        </article>
        <article className="card metric">
          <span className="muted">Gestão</span>
          <strong>{managementUsers.length}</strong>
          <small>Camada de gestão e financeiro</small>
        </article>
        <article className="card metric">
          <span className="muted">Eventos disponíveis</span>
          <strong>{events.length}</strong>
          <small>Base usada para liberar escopos</small>
        </article>
      </section>

      <section className="grid twoColumns">
        <form action={createAdminUserAction} className="card form">
          <h2>Novo usuário</h2>
          <p className="muted">Crie o acesso do cliente ou da equipe operacional com senha inicial e escopo correto.</p>
          <label className="field">
            <span>Nome</span>
            <input name="name" required />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" required />
          </label>
          <label className="field">
            <span>Senha inicial</span>
            <input name="password" type="password" minLength={8} required />
          </label>
          <label className="field">
            <span>Papel</span>
            <select name="role" defaultValue={AdminRole.STAFF}>
              {Object.values(AdminRole).map((role) => (
                <option value={role} key={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Escopo dos eventos</span>
            <AdminUserEventScopeField
              events={events}
              defaultAccessAllEvents
              defaultAllowedEventIds={[]}
            />
            <small>Escolha se este usuário vê todos os eventos ou apenas os que você marcar abaixo.</small>
          </label>
          <button className="button" type="submit">
            Criar usuário
          </button>
        </form>

        <div className="usersSecurityColumn">
          <section className="card">
            <h2>Camada de segurança</h2>
            <p className="muted">Uma régua simples para não misturar dono do cliente, gestão e equipe de rotina.</p>
            <div className="usersSecurityGrid">
              <article className="usersSecurityCard">
                <span className="status published">Cliente</span>
                <strong>Dono da operação</strong>
                <p>Enxerga toda a bilheteria, equipe e configurações da operação.</p>
              </article>
              <article className="usersSecurityCard">
                <span className="status pending">Gestão</span>
                <strong>Gerente / Financeiro</strong>
                <p>Opera a base comercial e financeira sem precisar ser dono da conta.</p>
              </article>
              <article className="usersSecurityCard">
                <span className="status draft">Equipe restrita</span>
                <strong>Atendimento / Portaria / Operação</strong>
                <p>Entra só nas áreas e eventos que você liberar.</p>
              </article>
            </div>
          </section>

          <section className="card">
            <h2>Papéis de acesso</h2>
            <p className="muted">Use isso como régua rápida para não abrir acesso demais sem necessidade.</p>
            <div className="permissionList">
              <p><strong>Proprietário:</strong> acesso total.</p>
              <p><strong>Gerente:</strong> eventos, pedidos, financeiro, atendimento, check-in e ingressos.</p>
              <p><strong>Financeiro:</strong> dashboard, pedidos e financeiro.</p>
              <p><strong>Atendimento:</strong> suporte, pedidos e ingressos.</p>
              <p><strong>Operação:</strong> eventos, pedidos, atendimento e ingressos.</p>
              <p><strong>Portaria:</strong> check-in e ingressos.</p>
            </div>
          </section>
        </div>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Equipe cadastrada</h2>
            <p className="muted">Atualize papel, escopo por evento e status sem sair da tela.</p>
          </div>
        </div>
        {users.length === 0 ? (
          <div className="empty">Nenhum usuário cadastrado.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Papel</th>
                <th>Escopo</th>
                <th>Camada</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <br />
                    <span className="muted">{user.email}</span>
                  </td>
                  <td>
                    <form action={updateAdminUserRoleAction} className="inlineForm">
                      <input type="hidden" name="userId" value={user.id} />
                      <select name="role" defaultValue={user.role}>
                        {Object.values(AdminRole).map((role) => (
                          <option value={role} key={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                      <button className="secondaryButton smallButton" type="submit">
                        Salvar
                      </button>
                    </form>
                  </td>
                  <td>
                    <form action={updateAdminUserEventAccessAction} className="stackedInlineForm">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="role" value={user.role} />
                      <AdminUserEventScopeField
                        events={events}
                        defaultAccessAllEvents={user.role === AdminRole.OWNER || user.accessAllEvents}
                        defaultAllowedEventIds={user.allowedEventIds}
                        lockedToAllEvents={user.role === AdminRole.OWNER}
                      />
                      <small className="muted">
                        {user.role === AdminRole.OWNER || user.accessAllEvents
                          ? "Acesso sem restrição de evento."
                          : user.allowedEventIds.map((eventId) => eventTitleById.get(eventId) || eventId).join(", ")}
                      </small>
                      <button className="secondaryButton smallButton" type="submit">
                        Salvar escopo
                      </button>
                    </form>
                  </td>
                  <td>
                    {(() => {
                      const accessProfile = getAccessProfile(user);

                      return (
                        <div className="usersProfileCell">
                          <span className={`status ${accessProfile.tone}`}>{accessProfile.label}</span>
                          <small className="muted">{accessProfile.note}</small>
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <span className={`status ${user.isActive ? "published" : "draft"}`}>
                      {user.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td>
                    <form action={updateAdminUserStatusAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="isActive" value={String(!user.isActive)} />
                      <button className="secondaryButton smallButton" type="submit">
                        {user.isActive ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
