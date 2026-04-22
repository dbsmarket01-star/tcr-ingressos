import { AdminRole } from "@prisma/client";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  createAdminUserAction,
  updateAdminUserEventAccessAction,
  updateAdminUserRoleAction,
  updateAdminUserStatusAction
} from "@/features/admin-users/admin-user.actions";
import { listAdminUsers } from "@/features/admin-users/admin-user.service";
import { requirePermission } from "@/features/auth/auth.service";
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

export default async function AdminUsersPage() {
  const admin = await requirePermission("USERS");
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

  return (
    <AdminShell
      title="Usuários"
      description="Gerencie equipe interna, papéis e acesso ao painel da TCR Ingressos."
    >
      <section className="grid twoColumns">
        <form action={createAdminUserAction} className="card form">
          <h2>Novo usuário</h2>
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
          <label className="checkboxField">
            <input name="accessAllEvents" type="checkbox" defaultChecked />
            <span>Liberar acesso a todos os eventos</span>
          </label>
          <label className="field">
            <span>Eventos permitidos</span>
            <select name="allowedEventIds" multiple size={Math.min(Math.max(events.length, 4), 8)}>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <small>Use esta lista quando o usuário puder acessar somente um ou alguns eventos.</small>
          </label>
          <button className="button" type="submit">
            Criar usuário
          </button>
        </form>

        <section className="card">
          <h2>Papéis de acesso</h2>
          <div className="permissionList">
            <p><strong>Proprietário:</strong> acesso total.</p>
            <p><strong>Gerente:</strong> eventos, pedidos, financeiro, atendimento, check-in e ingressos.</p>
            <p><strong>Financeiro:</strong> dashboard, pedidos e financeiro.</p>
            <p><strong>Atendimento:</strong> suporte, pedidos e ingressos.</p>
            <p><strong>Operação:</strong> eventos, pedidos, atendimento e ingressos.</p>
            <p><strong>Portaria:</strong> check-in e ingressos.</p>
          </div>
        </section>
      </section>

      <section className="card spacedSection">
        {users.length === 0 ? (
          <div className="empty">Nenhum usuário cadastrado.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Papel</th>
                <th>Escopo</th>
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
                      <label className="checkboxField compact">
                        <input
                          name="accessAllEvents"
                          type="checkbox"
                          defaultChecked={user.role === AdminRole.OWNER || user.accessAllEvents}
                          disabled={user.role === AdminRole.OWNER}
                        />
                        <span>{user.role === AdminRole.OWNER ? "Proprietário sempre vê tudo" : "Todos os eventos"}</span>
                      </label>
                      <select
                        name="allowedEventIds"
                        multiple
                        size={Math.min(Math.max(events.length, 4), 6)}
                        defaultValue={user.allowedEventIds}
                        disabled={user.role === AdminRole.OWNER || user.accessAllEvents}
                      >
                        {events.map((event) => (
                          <option value={event.id} key={event.id}>
                            {event.title}
                          </option>
                        ))}
                      </select>
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
