import { AdminRole } from "@prisma/client";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  createAdminUserAction,
  updateAdminUserRoleAction,
  updateAdminUserStatusAction
} from "@/features/admin-users/admin-user.actions";
import { listAdminUsers } from "@/features/admin-users/admin-user.service";
import { requirePermission } from "@/features/auth/auth.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const roleLabels = {
  OWNER: "Proprietario",
  MANAGER: "Gerente",
  FINANCE: "Financeiro",
  SUPPORT: "Atendimento",
  STAFF: "Operacao",
  CHECKIN: "Portaria"
};

export default async function AdminUsersPage() {
  await requirePermission("USERS");
  const users = await listAdminUsers();

  return (
    <AdminShell
      title="Usuarios"
      description="Gerencie equipe interna, papeis e acesso ao painel da TCR Ingressos."
    >
      <section className="grid twoColumns">
        <form action={createAdminUserAction} className="card form">
          <h2>Novo usuario</h2>
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
          <button className="button" type="submit">
            Criar usuario
          </button>
        </form>

        <section className="card">
          <h2>Papeis de acesso</h2>
          <div className="permissionList">
            <p><strong>Proprietario:</strong> acesso total.</p>
            <p><strong>Gerente:</strong> eventos, pedidos, financeiro, atendimento, check-in e ingressos.</p>
            <p><strong>Financeiro:</strong> dashboard, pedidos e financeiro.</p>
            <p><strong>Atendimento:</strong> suporte, pedidos e ingressos.</p>
            <p><strong>Operacao:</strong> eventos, pedidos, atendimento e ingressos.</p>
            <p><strong>Portaria:</strong> check-in e ingressos.</p>
          </div>
        </section>
      </section>

      <section className="card spacedSection">
        {users.length === 0 ? (
          <div className="empty">Nenhum usuario cadastrado.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Papel</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Acoes</th>
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
