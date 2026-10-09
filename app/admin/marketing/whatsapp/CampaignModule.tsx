"use client";
import {
  Fragment,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  initialConfig,
  configSchema,
  templateParts,
  parameterNames,
  renderedMessage,
  estimateSeconds,
  stateLabels,
  type CampaignConfig,
  validateContent,
} from "@/features/whatsapp/campaigns/rules";
import { uploadMime } from "@/features/whatsapp/campaigns/media-policy";
import { useCampaignDraft, api } from "./autosave";
import { Icon } from "./icons";
import s from "./campaigns.module.css";
const base = "/admin/marketing/whatsapp";
const contactListTemplate = [
  "nome;telefone;cidade;tag;opt_in_status;opt_in_date;opt_in_source;finalidade;origem_coleta",
  ...Array(10).fill(";;;;;;;;"),
].join("\n");
const number = (n: number = 0) => n.toLocaleString("pt-BR");
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
const kindLabels: Record<string, string> = {
  text: "Texto",
  image: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
};
const percent = (n: number = 0) => `${n.toLocaleString("pt-BR")}%`;
function duration(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600),
    minutes = Math.floor((total % 3600) / 60),
    rest = total % 60;
  return [
    hours ? `${hours}h` : "",
    minutes ? `${minutes}min` : "",
    rest || !total ? `${rest}s` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
function pace(c: CampaignConfig) {
  return c.pace === "auto"
    ? "Automático"
    : c.pace === "interval"
      ? `1 mensagem / ${c.intervalSeconds}s`
      : `${c.batchSize} mensagens / ${c.batchPeriodSeconds}s + pausa de ${c.batchPauseSeconds}s`;
}
function Card({
  icon,
  title,
  subtitle,
  children,
  orange = false,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  orange?: boolean;
}) {
  return (
    <section className={`${s.card} ${orange ? s.orangeCard : ""}`}>
      <header className={s.cardHeading}>
        <span className={s.iconTile}>
          <Icon name={icon} />
        </span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`${s.field} ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} className={s.modal} onCancel={onClose}>
      <header>
        <h2>{title}</h2>
        <button className={s.iconButton} onClick={onClose} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function PhonePreview({
  config,
  media,
  template,
}: {
  config: CampaignConfig;
  media?: any;
  template?: any;
}) {
  const p = template ? templateParts(template) : null;
  const text = config.templateId
    ? renderedMessage(config)
    : config.message.replace(
        /\{\{nome\}\}/g,
        config.personalize ? "Nome do contato" : "Olá",
      );
  return (
    <div className={s.phoneBackdrop}>
      <div className={s.phone}>
        <div className={s.phoneStatus}>
          <b>16:00</b>
          <span className={s.phoneNotch} />
          <span>▮▮▮ ▰</span>
        </div>
        <div className={s.phoneHeader}>
          <span>‹</span>
          <img src="/brands/tcr-logomarca.png" alt="Logo TCR Eventos" />
          <div>
            <strong>TCR Eventos</strong>
            <small>Conta comercial</small>
          </div>
          <Icon name="video" size={19} />
          <span>⋮</span>
        </div>
        <div className={s.phoneChat}>
          <article className={s.bubble}>
            {config.kind === "image" && media && (
              <img
                className={s.previewImage}
                src={`/api/admin/whatsapp/media/${media.id}`}
                alt="Imagem da campanha"
              />
            )}
            {config.kind === "video" && media && (
              <video controls src={`/api/admin/whatsapp/media/${media.id}`} />
            )}
            {config.kind === "audio" && media && (
              <audio controls src={`/api/admin/whatsapp/media/${media.id}`} />
            )}
            {config.kind !== "text" && !media && (
              <div className={s.mediaPlaceholder}>
                <Icon name={config.kind} size={42} />
                <span>{kindLabels[config.kind]}</span>
              </div>
            )}
            {p?.header?.text && <strong>{p.header.text}</strong>}
            <p>
              {text ||
                (config.kind === "audio" ? "" : "Sua mensagem aparecerá aqui.")}
            </p>
            {p?.footer && <small>{p.footer}</small>}
            <time>16:00</time>
            {config.ctaUrl &&
              (config.templateId ? (
                <a href={config.ctaUrl} target="_blank" rel="noreferrer">
                  <Icon name="link" size={15} />
                  {config.ctaLabel || "Acessar link"}
                </a>
              ) : (
                <a href={config.ctaUrl} target="_blank" rel="noreferrer">
                  {config.ctaUrl}
                </a>
              ))}
            {p?.buttons
              .filter((b) => b.type !== "URL")
              .map((b, i) => (
                <div key={i} className={s.previewStaticButton}>
                  {b.text}
                </div>
              ))}
          </article>
        </div>
      </div>
    </div>
  );
}
export function CampaignModule({ campaignId }: { campaignId?: string }) {
  const [data, setData] = useState<any>(null),
    [campaign, setCampaign] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [confirmOpen, setConfirmOpen] = useState(false),
    [report, setReport] = useState<any>(null),
    [audience, setAudience] = useState<any>(null),
    [media, setMedia] = useState<any>(null),
    [progress, setProgress] = useState(0),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState(""),
    [page, setPage] = useState(1);
  const [from, setFrom] = useState(
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const draft = useCampaignDraft(campaignId);
  const c = draft.config;
  const initialized = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/admin/whatsapp/campaigns?from=${from}&to=${to}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }, [from, to]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await refresh();
        if (campaignId) {
          const response = await fetch(
            `/api/admin/whatsapp/campaigns?id=${encodeURIComponent(campaignId)}`,
            { cache: "no-store" },
          );
          const row = await response.json();
          if (!response.ok) throw new Error(row.error);
          if (!live) return;
          setCampaign(row);
          if (!initialized.current) {
            draft.initialize(configSchema.parse(row.config), row.version);
            initialized.current = true;
          }
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [refresh, campaignId]);
  useEffect(() => {
    if (campaignId && campaign?.status === "draft" && c.listId) {
      let live = true;
      const timer = setTimeout(() => {
        api({ operation: "audience", config: c })
          .then((v) => {
            if (live) setAudience(v);
          })
          .catch((e) => {
            if (live) setError(e.message);
          });
      }, 350);
      return () => {
        live = false;
        clearTimeout(timer);
      };
    }
    setAudience(null);
  }, [
    c.listId,
    c.tag,
    c.city,
    c.contactStatus,
    c.purpose,
    c.templateId,
    campaign?.status,
  ]);
  useEffect(() => {
    if (!campaignId || campaign?.status === "draft") return;
    const timer = setInterval(() => {
      fetch(`/api/admin/whatsapp/campaigns?id=${campaignId}`)
        .then((r) => r.json())
        .then((row) => {
          if (row.id) setCampaign(row);
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [campaignId, campaign?.status]);
  useEffect(() => {
    if (c.mediaId && campaign?.snapshot?.media?.id === c.mediaId)
      setMedia(campaign.snapshot.media);
    else if (c.mediaId) {
      fetch(`/api/admin/whatsapp/campaigns?mediaId=${c.mediaId}`)
        .then((r) => r.json())
        .then((v) => {
          if (v.id) setMedia(v);
        })
        .catch(() => {});
    } else setMedia(null);
  }, [c.mediaId]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file: File) => {
    const mime = uploadMime(file.name, file.type);
    const upload = await api({
      operation: "beginUpload",
      name: file.name,
      mime,
      size: file.size,
    });
    let final: any;
    for (let offset = 0; offset < file.size; offset += 2 * 1024 * 1024) {
      const chunk = file.slice(offset, offset + 2 * 1024 * 1024);
      const response = await fetch(`/api/admin/whatsapp/media/${upload.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-upload-offset": String(offset),
        },
        body: chunk,
      });
      final = await response.json();
      if (!response.ok) throw new Error(final.error);
      setProgress(Math.round(((offset + chunk.size) / file.size) * 100));
    }
    return final;
  };
  const attach = (file?: File) => {
    if (!file || busy) return;
    void run(async () => {
      setProgress(0);
      const result = await upload(file);
      if (result.metadata.kind !== c.kind)
        throw new Error(
          "O arquivo não corresponde ao tipo de conteúdo selecionado.",
        );
      setMedia(result);
      draft.update({ mediaId: result.id });
    });
  };
  const next = async (step: number) => {
    if (step === 2 && (!c.name.trim() || !c.listId))
      throw new Error("Informe o nome e selecione uma lista.");
    if (step === 3)
      validateContent(
        c,
        data?.templates.find((t: any) => t.id === c.templateId) ?? null,
      );
    draft.update({ step });
    if (!(await draft.flush()))
      throw new Error(
        "Aguarde a confirmação do salvamento antes de continuar.",
      );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const template = data?.templates.find((t: any) => t.id === c.templateId);
  const selectedList = data?.lists.find((l: any) => l.id === c.listId);
  const selectTemplate = (id: string) => {
    const t = data.templates.find((t: any) => t.id === id);
    if (!t) {
      draft.update({
        templateId: "",
        variables: {},
        message: "",
        ctaLabel: "",
        ctaUrl: "",
        trackClicks: false,
      });
      return;
    }
    const p = templateParts(t),
      button = p.buttons.find((b) => b.type === "URL"),
      trackingButton =
        button?.url === `${data?.trackingBaseUrl}/r/whatsapp/{{1}}`,
      kind = (
        p.header?.format ?? "TEXT"
      ).toLowerCase() as CampaignConfig["kind"];
    draft.update({
      templateId: id,
      message: p.body,
      variables: Object.fromEntries(
        parameterNames(p.body).map((k, i) => [k, i === 0 ? "{{nome}}" : ""]),
      ),
      kind: ["text", "image", "video"].includes(kind) ? kind : "text",
      mediaId: "",
      ctaLabel: button?.text ?? "",
      ctaUrl: trackingButton
        ? ""
        : (button?.url?.replace("{{1}}", "") ?? ""),
      purpose: t.category === "UTILITY" ? "utility" : "marketing",
      trackClicks: trackingButton,
    });
    setMedia(null);
  };
  const confirm = () =>
    run(async () => {
      if (!(await draft.flush()))
        throw new Error("O rascunho ainda não foi salvo.");
      const row = await api({
        operation: "confirm",
        id: campaignId,
        version: draft.versionRef.current.version,
      });
      setCampaign(row);
      setConfirmOpen(false);
      window.location.assign(`${base}/${row.id}`);
    });
  const control = (id: string, operation: string) =>
    run(async () => {
      await api({ operation, id });
      if (campaignId) {
        const r = await fetch(`/api/admin/whatsapp/campaigns?id=${id}`);
        setCampaign(await r.json());
      } else await refresh();
    });
  if (loading)
    return (
      <div className={s.module}>
        <div className={s.loading}>Carregando campanhas...</div>
      </div>
    );
  const rows = (data?.campaigns ?? []).filter(
    (r: any) =>
      r.name.toLowerCase().includes(search.toLowerCase()) &&
      (!statusFilter || r.status === statusFilter) &&
      (!typeFilter || r.config.kind === typeFilter),
  );
  const header = (
    <header className={s.header}>
      <div className={s.titleGroup}>
        <span className={s.brandIcon}>
          <Icon name="whatsapp" size={38} />
        </span>
        <div>
          <h1>
            {campaignId
              ? campaign?.status === "draft"
                ? "Nova campanha WhatsApp"
                : campaign?.name
              : "Disparos WhatsApp"}
          </h1>
          <p>
            {campaignId
              ? campaign?.status === "draft"
                ? `Etapa ${c.step} de 3 — ${c.step === 1 ? "Configure a campanha, escolha a lista e defina o agendamento do envio." : c.step === 2 ? "Escreva a mensagem, adicione mídias e veja a pré-visualização." : "Revise todas as informações e confirme o envio da sua campanha."}`
                : "Acompanhe os resultados e o andamento da campanha."
              : "Gerencie campanhas de envio em massa pelo WhatsApp Business API e acompanhe o desempenho dos disparos."}
          </p>
          {campaignId && campaign?.status === "draft" && (
            <small className={s.autoSave} role="status">
              {draft.saveState}
            </small>
          )}
        </div>
      </div>
      <div className={s.headerActions}>
        {!campaignId ? (
          <>
            <div className={s.dateRange}>
              <Icon name="calendar" />
              <input
                type="date"
                aria-label="Início do período"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
              <span>→</span>
              <input
                type="date"
                aria-label="Fim do período"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <button
              className={s.green}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const row = await api({
                    operation: "create",
                    key: crypto.randomUUID(),
                  });
                  window.location.assign(`${base}/${row.id}`);
                })
              }
            >
              <Icon name="plus" />
              Nova campanha
            </button>
          </>
        ) : campaign?.status === "draft" ? (
          <>
            <button
              className={s.secondary}
              onClick={() =>
                run(async () => {
                  if (await draft.flush()) window.location.assign(base);
                })
              }
            >
              {c.step === 1 ? "Cancelar" : "Voltar ao painel"}
            </button>
            {c.step < 3 && (
              <button
                className={s.green}
                disabled={busy || draft.conflict}
                onClick={() => run(() => next(c.step + 1))}
              >
                Ir para {c.step === 1 ? "conteúdo" : "revisão"}
                <Icon name="arrow" />
              </button>
            )}
          </>
        ) : (
          <a className={s.secondary} href={base}>
            <Icon name="back" />
            Voltar ao painel
          </a>
        )}
      </div>
    </header>
  );
  return (
    <div className={s.module}>
      {header}
      {error && (
        <div className={s.error} role="alert">
          {error}
          <button
            className={s.iconButton}
            onClick={() => setError("")}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      )}
      {draft.conflict && (
        <div className={s.error}>
          As alterações locais foram preservadas.{" "}
          <button
            onClick={() => {
              const content =
                localStorage.getItem(`wa-draft:${campaignId}`) ?? "{}";
              const a = document.createElement("a");
              a.href = URL.createObjectURL(
                new Blob([content], { type: "application/json" }),
              );
              a.download = "rascunho-whatsapp.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Baixar cópia local
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(`wa-draft:${campaignId}`);
              window.location.reload();
            }}
          >
            Carregar versão do servidor
          </button>
        </div>
      )}
      {!campaignId && (
        <>
          <div className={s.metrics}>
            {[
              ["send", "Campanhas ativas", data?.metrics.active ?? 0],
              ["message", "Enviados no período", number(data?.metrics.sent)],
              ["check", "Taxa de entrega", percent(data?.metrics.deliveryRate)],
              ["message", "Respostas", number(data?.metrics.replies)],
            ].map(([icon, label, value]) => (
              <article key={String(label)}>
                <span className={s.metricIcon}>
                  <Icon name={String(icon)} size={33} />
                </span>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </article>
            ))}
          </div>
          <section className={s.tableCard}>
            <div className={s.tableToolbar}>
              <div className={s.tableTitle}>
                <Icon name="file" size={32} />
                <div>
                  <h2>Últimas campanhas</h2>
                  <p>
                    Consulte os envios recentes e acesse os relatórios
                    individuais.
                  </p>
                </div>
              </div>
              <div className={s.filters}>
                <label className={s.search}>
                  <Icon name="search" />
                  <input
                    placeholder="Buscar por nome da campanha..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <select
                  aria-label="Status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos os status</option>
                  {Object.entries(stateLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Tipo"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos os tipos</option>
                  {Object.entries(kindLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={s.tableScroll}>
              <table>
                <thead>
                  <tr>
                    {[
                      "Campanha",
                      "Data do envio",
                      "Tipo",
                      "Lista",
                      "Status",
                      "Enviados",
                      "Entregues",
                      "Respostas",
                      "Falhas",
                      "Ações",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((page - 1) * 8, page * 8).map((row: any) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>{row.config.objective}</small>
                      </td>
                      <td>{date(row.startedAt ?? row.scheduledAt)}</td>
                      <td>
                        <span className={s.inline}>
                          <Icon name={row.config.kind || "message"} />
                          {kindLabels[row.config.kind] ?? "Texto"}
                        </span>
                      </td>
                      <td>
                        {row.snapshot?.list?.name ??
                          data.lists.find(
                            (l: any) => l.id === row.config.listId,
                          )?.name ??
                          "—"}
                      </td>
                      <td>
                        <span className={`${s.badge} ${s[row.status] ?? ""}`}>
                          ● {stateLabels[row.status]}
                        </span>
                      </td>
                      <td>{number(row.metrics.sent)}</td>
                      <td>
                        {number(row.metrics.delivered)}
                        <small>{percent(row.metrics.deliveryRate)}</small>
                      </td>
                      <td>
                        {number(row.metrics.replies)}
                        <small>{percent(row.metrics.replyRate)}</small>
                      </td>
                      <td>{number(row.metrics.failed)}</td>
                      <td>
                        <div className={s.inline}>
                          <a className={s.secondary} href={`${base}/${row.id}`}>
                            {row.status === "draft" ? (
                              "Continuar campanha"
                            ) : (
                              <>
                                <Icon name="chart" size={16} />
                                Estatísticas
                              </>
                            )}
                          </a>
                          {[
                            "sending",
                            "queued",
                            "scheduled",
                            "paused",
                          ].includes(row.status) && (
                            <details className={s.menu}>
                              <summary aria-label="Ações da campanha">
                                ⋮
                              </summary>
                              <div>
                                <button
                                  onClick={() =>
                                    control(
                                      row.id,
                                      row.status === "paused"
                                        ? "resume"
                                        : "pause",
                                    )
                                  }
                                >
                                  {row.status === "paused"
                                    ? "Retomar"
                                    : "Pausar"}
                                </button>
                                <button
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Cancelar os envios pendentes desta campanha?",
                                      )
                                    )
                                      void control(row.id, "cancel");
                                  }}
                                >
                                  Cancelar campanha
                                </button>
                              </div>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <div className={s.empty}>
                  Nenhuma campanha neste período. Comece em Nova campanha.
                </div>
              )}
            </div>
            <footer className={s.tableFooter}>
              <span>
                Mostrando {Math.min(rows.length, 8)} de {rows.length} campanhas
              </span>
              <div>
                <button
                  disabled={page === 1}
                  onClick={() => setPage((n) => n - 1)}
                >
                  ‹
                </button>
                <b>{page}</b>
                <button
                  disabled={page * 8 >= rows.length}
                  onClick={() => setPage((n) => n + 1)}
                >
                  ›
                </button>
              </div>
            </footer>
          </section>
          <div className={s.tip}>
            <Icon name="message" />
            <span>
              <strong>Dica:</strong> Use campanhas segmentadas para conversar
              com quem autorizou receber suas mensagens.
            </span>
            <button
              className={s.textButton}
              onClick={() => setSettingsOpen(true)}
            >
              <Icon name="settings" />
              Integração e preferências
            </button>
          </div>
        </>
      )}
      {campaignId && campaign?.status === "draft" && (
        <>
          <nav className={s.stepper} aria-label="Etapas da campanha">
            {[
              ["Configuração", "Defina os detalhes da campanha"],
              ["Conteúdo", "Escreva a mensagem e adicione mídias"],
              ["Revisão", "Confira o resumo e envie"],
            ].map(([title, subtitle], i) => (
              <button
                key={title}
                className={
                  c.step === i + 1
                    ? s.activeStep
                    : c.step > i + 1
                      ? s.doneStep
                      : ""
                }
                disabled={busy || draft.conflict}
                onClick={() => run(() => next(i + 1))}
              >
                <span>{c.step > i + 1 ? <Icon name="check" /> : i + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </div>
              </button>
            ))}
          </nav>
          <div onBlur={() => void draft.flush()}>
            {c.step === 1 && (
              <div className={s.stack}>
                <Card
                  icon="file"
                  title="Informações da campanha"
                  subtitle="Defina as informações básicas da campanha."
                >
                  <div className={s.configGrid}>
                    <Field label="Nome da campanha *">
                      <input
                        value={c.name}
                        onChange={(e) => draft.update({ name: e.target.value })}
                        placeholder="Ex.: Fernandinho 2026 | Santo André"
                      />
                    </Field>
                    <Field label="Evento / Categoria">
                      <select
                        value={c.eventId}
                        onChange={(e) =>
                          draft.update({ eventId: e.target.value })
                        }
                      >
                        <option value="">Selecione uma categoria</option>
                        {data?.events.map((e: any) => (
                          <option key={e.id} value={e.id}>
                            {e.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Objetivo da campanha">
                      <select
                        value={c.objective}
                        onChange={(e) =>
                          draft.update({ objective: e.target.value })
                        }
                      >
                        {[
                          "Divulgação",
                          "Convite para evento",
                          "Relacionamento",
                          "Informação ao cliente",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Responsável">
                      <select
                        value={c.responsibleId}
                        onChange={(e) =>
                          draft.update({ responsibleId: e.target.value })
                        }
                      >
                        <option value="">Selecione</option>
                        {data?.users.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Observações internas" className={s.span2}>
                      <input
                        value={c.notes}
                        onChange={(e) =>
                          draft.update({ notes: e.target.value })
                        }
                        placeholder="Anotações opcionais sobre esta campanha"
                      />
                    </Field>
                  </div>
                </Card>
                <Card
                  icon="users"
                  title="Público / Lista de contatos"
                  subtitle="Selecione uma lista existente ou importe uma nova lista para o disparo."
                >
                  <div className={s.listRow}>
                    <Field label="Selecionar lista existente">
                      <select
                        value={c.listId}
                        onChange={(e) =>
                          draft.update({
                            listId: e.target.value,
                            tag: "",
                            city: "",
                          })
                        }
                      >
                        <option value="">Selecione uma lista</option>
                        {data?.lists.map((l: any) => (
                          <option
                            key={l.id}
                            value={l.id}
                            disabled={l.status !== "ready"}
                          >
                            {l.name}{" "}
                            {l.status !== "ready" ? "(processando)" : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button
                      className={s.orange}
                      onClick={() => setImportOpen(true)}
                    >
                      <Icon name="upload" />
                      Importar nova lista
                    </button>
                  </div>
                  {selectedList && (
                    <div className={s.selectedList}>
                      <Icon name="check" size={27} />
                      <strong>Lista selecionada: {selectedList.name}</strong>
                      <span>
                        <b>
                          {number(audience?.total ?? selectedList.validCount)}
                        </b>
                        contatos válidos
                      </span>
                      <span>
                        Origem:<b>{selectedList.source}</b>
                      </span>
                      <span>
                        Última atualização:<b>{date(selectedList.createdAt)}</b>
                      </span>
                    </div>
                  )}
                  {selectedList && (
                    <p className={s.helper}>
                      Importação: {number(selectedList.originalCount)} linhas ·{" "}
                      {number(selectedList.invalidCount)} inválidos ·{" "}
                      {number(selectedList.duplicateCount)} duplicados
                      removidos.
                    </p>
                  )}
                  <div className={s.info}>
                    ⓘ Formatos aceitos: CSV e Excel (.xlsx). Inclua telefone com
                    código do país e os registros de consentimento.
                  </div>
                  <div className={s.threeColumns}>
                    <Field label="Tag / origem">
                      <select
                        value={c.tag}
                        onChange={(e) => draft.update({ tag: e.target.value })}
                      >
                        <option value="">Todas as tags</option>
                        {audience?.tags?.map((t: string) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cidade">
                      <select
                        value={c.city}
                        onChange={(e) => draft.update({ city: e.target.value })}
                      >
                        <option value="">Todas as cidades</option>
                        {audience?.cities?.map((t: string) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status do contato">
                      <select
                        value={c.contactStatus}
                        onChange={(e) =>
                          draft.update({ contactStatus: e.target.value as any })
                        }
                      >
                        <option value="">Todos os contatos</option>
                        <option value="active">Ativos</option>
                        <option value="cooldown">Em descanso</option>
                      </select>
                    </Field>
                  </div>
                  {audience && (
                    <details className={s.audienceDetails}>
                      <summary>
                        {number(audience.eligible)} contatos elegíveis agora ·
                        Consultar consentimento e frequência
                      </summary>
                      <p>
                        {Object.entries(audience.reasons)
                          .map(([why, n]) => `${why}: ${n}`)
                          .join(" · ") || "Nenhuma restrição encontrada."}{" "}
                        A elegibilidade será conferida novamente no envio.
                      </p>
                      <table>
                        <thead>
                          <tr>
                            <th>Contato</th>
                            <th>Consentimento</th>
                            <th>Última mensagem promocional</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audience.contacts.map((v: any) => (
                            <tr key={v.phone}>
                              <td>{v.name}</td>
                              <td>
                                {v.optInStatus === "opt_in"
                                  ? "Registrado"
                                  : v.optInStatus === "opt_out"
                                    ? "Descadastrado"
                                    : "Não informado"}
                              </td>
                              <td>{date(v.lastMarketingAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </Card>
                <Card
                  icon="calendar"
                  title="Agendamento"
                  subtitle="Defina quando a campanha deverá ser enviada."
                  orange
                >
                  <div className={s.scheduleRow}>
                    <button
                      className={`${s.choice} ${c.scheduleMode === "now" ? s.chosen : ""}`}
                      onClick={() => draft.update({ scheduleMode: "now" })}
                    >
                      <span className={s.radio} />
                      <Icon name="send" />
                      <div>
                        <strong>Enviar agora</strong>
                        <small>Iniciar após a confirmação final</small>
                      </div>
                    </button>
                    <button
                      className={`${s.choice} ${c.scheduleMode === "scheduled" ? s.chosen : ""}`}
                      onClick={() =>
                        draft.update({ scheduleMode: "scheduled" })
                      }
                    >
                      <span className={s.radio} />
                      <Icon name="calendar" />
                      <div>
                        <strong>Agendar envio</strong>
                        <small>Definir data e horário</small>
                      </div>
                    </button>
                    <Field label="Data de envio">
                      <input
                        type="date"
                        value={c.date}
                        disabled={c.scheduleMode === "now"}
                        onChange={(e) => draft.update({ date: e.target.value })}
                      />
                    </Field>
                    <Field label="Horário">
                      <input
                        type="time"
                        value={c.time}
                        disabled={c.scheduleMode === "now"}
                        onChange={(e) => draft.update({ time: e.target.value })}
                      />
                    </Field>
                    <Field label="Fuso horário">
                      <select
                        value={c.timezone}
                        onChange={(e) =>
                          draft.update({ timezone: e.target.value })
                        }
                      >
                        <option value="America/Sao_Paulo">
                          Brasília (São Paulo)
                        </option>
                        <option value="America/Manaus">Manaus</option>
                        <option value="America/Rio_Branco">Rio Branco</option>
                        <option value="Europe/Lisbon">Lisboa</option>
                      </select>
                    </Field>
                  </div>
                  <div className={s.pace}>
                    <h3>Ritmo de envio</h3>
                    <div className={s.threeColumns}>
                      {[
                        ["auto", "Automático — recomendado"],
                        ["interval", "Intervalo por mensagem"],
                        ["batch", "Envio em lotes"],
                      ].map(([key, label]) => (
                        <label className={s.paceRadio} key={key}>
                          <input
                            type="radio"
                            name="pace"
                            checked={c.pace === key}
                            onChange={() => draft.update({ pace: key as any })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {c.pace === "auto" ? (
                      <p>
                        O sistema ajusta a fila conforme a capacidade, a saúde
                        da integração e as respostas da Meta.
                      </p>
                    ) : c.pace === "interval" ? (
                      <Field label="Intervalo entre mensagens (segundos)">
                        <input
                          type="number"
                          min={1}
                          max={3600}
                          value={c.intervalSeconds}
                          onChange={(e) =>
                            draft.update({
                              intervalSeconds: Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                    ) : (
                      <div className={s.threeColumns}>
                        <Field label="Quantidade por lote">
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={c.batchSize}
                            onChange={(e) =>
                              draft.update({
                                batchSize: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Período para envio do lote (segundos)">
                          <input
                            type="number"
                            min={1}
                            max={86400}
                            value={c.batchPeriodSeconds}
                            onChange={(e) =>
                              draft.update({
                                batchPeriodSeconds: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Pausa após cada lote (segundos)">
                          <input
                            type="number"
                            min={0}
                            max={86400}
                            value={c.batchPauseSeconds}
                            onChange={(e) =>
                              draft.update({
                                batchPauseSeconds: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      </div>
                    )}
                    <div className={s.estimate}>
                      <Icon name="clock" />
                      {number(audience?.eligible ?? 0)} contatos elegíveis ·{" "}
                      {pace(c)} · Tempo estimado:{" "}
                      {duration(
                        estimateSeconds(
                          c,
                          Math.min(audience?.eligible ?? 0, 20000),
                          data?.integration?.minimumIntervalMs ?? 1000,
                        ),
                      )}
                      . O intervalo é mínimo: processamento, pausas e limites
                      podem ampliar esse tempo.
                    </div>
                    <Field label="Lote inicial para validação">
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={c.canarySize}
                        onChange={(e) =>
                          draft.update({ canarySize: Number(e.target.value) })
                        }
                      />
                      <small>
                        A campanha pausa após esse lote para conferir aceitação,
                        entrega e falhas. Use 0 somente para não pausar.
                      </small>
                    </Field>
                  </div>
                </Card>
              </div>
            )}
            {c.step === 2 && (
              <div className={s.contentColumns}>
                <div className={s.stack}>
                  <Card
                    icon="file"
                    title="Mensagem e conteúdo"
                    subtitle="Escreva a mensagem principal e configure a mídia da campanha."
                  >
                    <div className={s.tabs}>
                      {Object.entries(kindLabels).map(([key, label]) => (
                        <button
                          key={key}
                          className={c.kind === key ? s.selectedTab : ""}
                          disabled={busy}
                          onClick={() => {
                            if (c.kind === key) return;
                            draft.update({
                              kind: key as any,
                              mediaId: "",
                              ...(key === "audio"
                                ? {
                                    templateId: "",
                                    message: "",
                                    ctaLabel: "",
                                    ctaUrl: "",
                                    trackClicks: false,
                                  }
                                : {}),
                            });
                            setMedia(null);
                          }}
                        >
                          <Icon name={key === "text" ? "file" : key} />
                          {label}
                        </button>
                      ))}
                    </div>
                    <Field label="Mensagem *">
                      <textarea
                        rows={6}
                        value={c.message}
                        readOnly={!!c.templateId}
                        disabled={c.kind === "audio"}
                        placeholder={
                          c.kind === "audio"
                            ? "Áudio é enviado sem legenda, dentro da janela de atendimento."
                            : "Escreva a mensagem ou selecione um template aprovado"
                        }
                        onChange={(e) =>
                          draft.update({ message: e.target.value })
                        }
                        maxLength={
                          c.templateId || c.kind !== "text" ? 1024 : 4096
                        }
                      />
                    </Field>
                    <div className={s.characterCount}>
                      {c.message.length}/
                      {c.templateId || c.kind !== "text" ? 1024 : 4096}
                    </div>
                    {c.templateId && (
                      <p className={s.helper}>
                        O texto aprovado permanece fixo. Personalize os campos
                        abaixo.
                      </p>
                    )}
                    {template && parameterNames(c.message).length > 0 && (
                      <div className={s.threeColumns}>
                        {parameterNames(c.message).map((key) => (
                          <Field key={key} label={`Variável ${key}`}>
                            <input
                              value={c.variables[key] ?? ""}
                              placeholder="Use {{nome}} para o nome do contato"
                              onChange={(e) =>
                                draft.update({
                                  variables: {
                                    ...c.variables,
                                    [key]: e.target.value,
                                  },
                                })
                              }
                            />
                          </Field>
                        ))}
                      </div>
                    )}
                    <div className={s.contentFields}>
                      <Field label="Link / CTA (opcional)">
                        <input
                          type="url"
                          value={c.ctaUrl}
                          placeholder="https://seuevento.com.br/inscricoes"
                          onChange={(e) =>
                            draft.update({ ctaUrl: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Texto do botão">
                        <input
                          value={c.ctaLabel}
                          readOnly
                          onChange={(e) =>
                            draft.update({ ctaLabel: e.target.value })
                          }
                          placeholder="Acessar inscrições"
                        />
                      </Field>
                      <Field label="Template aprovado">
                        <select
                          value={c.templateId}
                          onChange={(e) => selectTemplate(e.target.value)}
                        >
                          <option value="">
                            Mensagem livre (janela de 24h)
                          </option>
                          {data?.templates.map((t: any) => (
                            <option
                              key={t.id}
                              value={t.id}
                              disabled={t.status !== "APPROVED"}
                            >
                              {t.name} · {t.language}
                              {t.status !== "APPROVED" ? ` (${t.status})` : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className={s.contentTools}>
                      <small>
                        {!c.templateId
                          ? "Mensagens livres exigem uma mensagem recente do destinatário (até 24 horas)."
                          : "Somente templates aprovados e disponíveis serão enviados."}
                      </small>
                      <button
                        className={s.textButton}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api({ operation: "sync" });
                            await refresh();
                          })
                        }
                      >
                        Sincronizar templates
                      </button>
                    </div>
                  </Card>
                  {c.kind !== "text" && (
                    <Card
                      icon="image"
                      title="Mídia da campanha"
                      subtitle="Adicione o arquivo que acompanhará a mensagem."
                    >
                      <div className={s.mediaUpload}>
                        <button
                          className={s.dropzone}
                          disabled={busy}
                          onClick={() => inputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            attach(e.dataTransfer.files[0]);
                          }}
                        >
                          <Icon name="upload" size={45} />
                          <strong>
                            {busy
                              ? `Enviando... ${progress}%`
                              : "Clique para enviar sua mídia ou arraste aqui"}
                          </strong>
                          <small>
                            {c.kind === "image"
                              ? "JPG, PNG (máx. 5 MB)"
                              : c.kind === "video"
                                ? "MP4, 3GP • H.264 + AAC (máx. 16 MB)"
                                : "MP3, AAC, AMR, M4A, OGG/Opus (máx. 16 MB)"}
                          </small>
                        </button>
                        <input
                          ref={inputRef}
                          className={s.hidden}
                          type="file"
                          accept={
                            c.kind === "image"
                              ? "image/jpeg,image/png"
                              : c.kind === "video"
                                ? "video/mp4,video/3gpp"
                                : ".mp3,.aac,.amr,.m4a,.ogg,audio/mpeg,audio/aac,audio/amr,audio/mp4,audio/x-m4a,audio/ogg"
                          }
                          onChange={(e) => {
                            attach(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                        {media && (
                          <div className={s.mediaSummary}>
                            {c.kind === "image" ? (
                              <img
                                src={`/api/admin/whatsapp/media/${media.id}`}
                                alt="Mídia selecionada"
                              />
                            ) : c.kind === "video" ? (
                              <video
                                controls
                                src={`/api/admin/whatsapp/media/${media.id}`}
                              />
                            ) : (
                              <audio
                                controls
                                src={`/api/admin/whatsapp/media/${media.id}`}
                              />
                            )}
                            <small>
                              {media.name} ·{" "}
                              {(media.size / 1024 / 1024).toFixed(2)} MB{" "}
                              {media.metadata?.width
                                ? `· ${media.metadata.width} × ${media.metadata.height} px`
                                : ""}
                              {media.metadata?.duration
                                ? ` · ${Number(media.metadata.duration).toFixed(1)} s`
                                : ""}
                            </small>
                            <button
                              className={s.orange}
                              disabled={busy}
                              onClick={() => inputRef.current?.click()}
                            >
                              <Icon name="upload" />
                              Trocar mídia
                            </button>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                  <Card
                    icon="settings"
                    title="Configurações da mensagem"
                    subtitle="Defina opções adicionais para a campanha."
                  >
                    <div className={s.toggles}>
                      <label>
                        <input
                          type="checkbox"
                          checked={c.personalize}
                          onChange={(e) =>
                            draft.update({ personalize: e.target.checked })
                          }
                        />
                        <span>
                          <b>Inserir nome do contato</b>
                          <small>
                            Use a variável {"{{nome}}"} na mensagem.
                          </small>
                        </span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={c.trackClicks}
                          disabled={
                            !template ||
                            !data?.trackingBaseUrl ||
                            !templateParts(template).buttons.some(
                              (b) =>
                                b.url ===
                                `${data.trackingBaseUrl}/r/whatsapp/{{1}}`,
                            )
                          }
                          onChange={(e) =>
                            draft.update({ trackClicks: e.target.checked })
                          }
                        />
                        <span>
                          <b>Rastrear cliques no CTA</b>
                          <small>
                            Requer botão aprovado com link rastreável.
                          </small>
                        </span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={c.purpose === "marketing"}
                          disabled={!!c.templateId}
                          onChange={(e) =>
                            draft.update({
                              purpose: e.target.checked
                                ? "marketing"
                                : "utility",
                            })
                          }
                        />
                        <span>
                          <b>Campanha promocional</b>
                          <small>Respeita consentimento e frequência.</small>
                        </span>
                      </label>
                    </div>
                  </Card>
                </div>
                <aside className={s.previewColumn}>
                  <Card
                    icon="eye"
                    title="Pré-visualização"
                    subtitle="Veja como sua mensagem será exibida no WhatsApp."
                  >
                    <PhonePreview
                      config={c}
                      media={media}
                      template={template}
                    />
                  </Card>
                  <Card icon="file" title="Resumo do conteúdo">
                    <dl className={s.summary}>
                      <dt>Tipo de envio</dt>
                      <dd>{kindLabels[c.kind]}</dd>
                      <dt>CTA configurado</dt>
                      <dd>{c.ctaUrl ? "Sim" : "Não"}</dd>
                      <dt>Template</dt>
                      <dd>{template?.name ?? "Janela de atendimento"}</dd>
                      <dt>Mídia anexada</dt>
                      <dd>{media ? "1 arquivo" : "Nenhuma"}</dd>
                    </dl>
                  </Card>
                  <div className={s.orangeNote}>
                    A prévia representa o conteúdo. A aparência final pode
                    variar conforme o aplicativo do destinatário.
                  </div>
                </aside>
              </div>
            )}
            {c.step === 3 && (
              <div className={s.contentColumns}>
                <div className={s.stack}>
                  <Card
                    icon="file"
                    title="Informações da campanha"
                    subtitle="Confira as principais informações da campanha."
                  >
                    <dl className={s.reviewGrid}>
                      <dt>Nome da campanha</dt>
                      <dd>{c.name}</dd>
                      <dt>Objetivo da campanha</dt>
                      <dd>{c.objective}</dd>
                      <dt>Evento / Categoria</dt>
                      <dd>
                        {data?.events.find((e: any) => e.id === c.eventId)
                          ?.title ??
                          c.category ??
                          "—"}
                      </dd>
                      <dt>Responsável</dt>
                      <dd>
                        {data?.users.find((u: any) => u.id === c.responsibleId)
                          ?.name ?? "—"}
                      </dd>
                      <dt>Tipo de envio</dt>
                      <dd>{kindLabels[c.kind]}</dd>
                      <dt>Observações internas</dt>
                      <dd>{c.notes || "—"}</dd>
                    </dl>
                  </Card>
                  <Card
                    icon="users"
                    title="Público / Lista"
                    subtitle="Confira o público que receberá sua campanha."
                  >
                    <dl className={s.reviewGrid}>
                      <dt>Lista selecionada</dt>
                      <dd>{selectedList?.name ?? "—"}</dd>
                      <dt>Segmentação</dt>
                      <dd>
                        {c.tag || "Todas as tags"} ·{" "}
                        {c.city || "Todas as cidades"} ·{" "}
                        {c.contactStatus || "Todos os contatos"}
                      </dd>
                      <dt>Contatos finais</dt>
                      <dd>{number(audience?.eligible ?? 0)}</dd>
                      <dt>Origem</dt>
                      <dd>{selectedList?.source ?? "—"}</dd>
                    </dl>
                  </Card>
                  <Card
                    icon="file"
                    title="Conteúdo da mensagem"
                    subtitle="Confira a mensagem que será enviada."
                  >
                    <p className={s.reviewMessage}>
                      {c.templateId
                        ? renderedMessage(c)
                        : c.message || kindLabels[c.kind]}
                    </p>
                    <div className={s.reviewContent}>
                      <div>
                        <small>Tipo de conteúdo</small>
                        {kindLabels[c.kind]}
                      </div>
                      <div>
                        <small>Link / CTA</small>
                        {c.ctaUrl || "—"}
                      </div>
                      <div>
                        <small>Texto do botão</small>
                        {c.ctaLabel || "—"}
                      </div>
                      <div>
                        <small>Mídia anexa</small>
                        {media?.name ?? "Nenhuma"}
                      </div>
                    </div>
                  </Card>
                  <Card
                    icon="calendar"
                    title="Agendamento"
                    subtitle="Confira quando sua campanha será enviada."
                    orange
                  >
                    <div className={s.reviewContent}>
                      <div>
                        <small>Modo de envio</small>
                        {c.scheduleMode === "now" ? "Enviar agora" : "Agendado"}
                      </div>
                      <div>
                        <small>Data de envio</small>
                        {c.scheduleMode === "now"
                          ? "Após a confirmação"
                          : c.date}
                      </div>
                      <div>
                        <small>Horário</small>
                        {c.scheduleMode === "now" ? "Agora" : c.time}
                      </div>
                      <div>
                        <small>Fuso horário</small>
                        {c.timezone}
                      </div>
                      <div>
                        <small>Ritmo de envio</small>
                        {pace(c)}
                      </div>
                    </div>
                  </Card>
                </div>
                <aside className={s.previewColumn}>
                  <Card
                    icon="eye"
                    title="Pré-visualização final"
                    subtitle="Confira sua mensagem antes do envio no WhatsApp."
                  >
                    <PhonePreview
                      config={c}
                      media={media}
                      template={template}
                    />
                  </Card>
                </aside>
              </div>
            )}
          </div>
          <footer className={s.wizardFooter}>
            {c.step === 1 ? (
              <p>
                Próxima etapa: conteúdo da mensagem, mídia e pré-visualização.
              </p>
            ) : (
              <button
                className={s.secondary}
                disabled={busy}
                onClick={() => run(() => next(c.step - 1))}
              >
                <Icon name="back" />
                Voltar
              </button>
            )}
            <button
              className={s.green}
              disabled={busy || draft.conflict}
              onClick={() =>
                c.step < 3 ? run(() => next(c.step + 1)) : setConfirmOpen(true)
              }
            >
              {c.step === 1
                ? "Continuar para conteúdo"
                : c.step === 2
                  ? "Continuar para revisão"
                  : "Enviar campanha"}
              <Icon name="arrow" />
            </button>
          </footer>
        </>
      )}
      {campaignId && campaign && campaign.status !== "draft" && (
        <CampaignReport
          report={campaign}
          busy={busy}
          control={control}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      {confirmOpen && (
        <Modal
          title="Confirmar envio da campanha?"
          onClose={() => setConfirmOpen(false)}
        >
          <dl className={s.summary}>
            <dt>Nome</dt>
            <dd>{c.name}</dd>
            <dt>Contatos</dt>
            <dd>{number(audience?.eligible ?? 0)}</dd>
            <dt>Data/hora</dt>
            <dd>
              {c.scheduleMode === "now"
                ? "Após a confirmação"
                : `${c.date} ${c.time} · ${c.timezone}`}
            </dd>
            <dt>Ritmo</dt>
            <dd>{pace(c)}</dd>
          </dl>
          <footer>
            <button
              className={s.secondary}
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </button>
            <button className={s.green} disabled={busy} onClick={confirm}>
              {busy ? "Confirmando..." : "Confirmar envio"}
            </button>
          </footer>
        </Modal>
      )}
      {importOpen && (
        <ImportDialog
          busy={busy}
          progress={progress}
          onClose={() => setImportOpen(false)}
          submit={(name, file, country) =>
            run(async () => {
              setProgress(0);
              const uploadResult = await upload(file);
              const list = await api({
                operation: "import",
                name,
                uploadId: uploadResult.id,
                country,
              });
              await refresh();
              draft.update({ listId: list.id, tag: "", city: "" });
              setImportOpen(false);
            })
          }
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          integration={data?.integration}
          templates={data?.templates ?? []}
          busy={busy}
          onClose={() => setSettingsOpen(false)}
          submit={(body) =>
            run(async () => {
              await api(body);
              await refresh();
            })
          }
        />
      )}
      {report && (
        <Modal title={report.name} onClose={() => setReport(null)}>
          <CampaignReport
            report={report}
            busy={busy}
            control={control}
            onSettings={() => setSettingsOpen(true)}
          />
        </Modal>
      )}
    </div>
  );
}
function ImportDialog({
  busy,
  progress,
  onClose,
  submit,
}: {
  busy: boolean;
  progress: number;
  onClose: () => void;
  submit: (name: string, file: File, country: string) => void;
}) {
  const [name, setName] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [country, setCountry] = useState("BR");
  return (
    <Modal title="Importar nova lista" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (file) submit(name, file, country);
        }}
      >
        <Field label="Nome da lista">
          <input
            required
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Arquivo CSV / XLSX">
          <input
            type="file"
            accept=".csv,.xlsx"
            required
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setFile(file);
                if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
              }
            }}
          />
        </Field>
        <Field label="País dos números sem código internacional">
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="BR">Brasil (+55)</option>
            <option value="PT">Portugal (+351)</option>
            <option value="US">Estados Unidos (+1)</option>
            <option value="AR">Argentina (+54)</option>
          </select>
        </Field>
        <p className={s.helper}>
          Colunas: nome, telefone, cidade, tag, opt_in_status, opt_in_date,
          opt_in_source, finalidade e origem_coleta. Consentimento exige data
          ISO, origem e finalidade (marketing ou utility). Telefones inválidos e
          duplicados serão separados.
        </p>
        <a
          className={s.textButton}
          download="modelo-teste-whatsapp-10-contatos.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(contactListTemplate)}`}
        >
          Baixar modelo CSV para 10 contatos
        </a>
        {busy && (
          <p role="status">
            {progress < 100
              ? `Enviando arquivo: ${progress}%`
              : "Validando contatos e salvando lista..."}
          </p>
        )}
        <footer>
          <button
            type="button"
            className={s.secondary}
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button className={s.orange} disabled={busy || !file || !name}>
            Importar lista
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function SettingsDialog({
  integration: i,
  templates,
  busy,
  onClose,
  submit,
}: {
  integration: any;
  templates: any[];
  busy: boolean;
  onClose: () => void;
  submit: (body: any) => void;
}) {
  const [frequency, setFrequency] = useState(i?.frequencyHours ?? 72),
    [cooldown, setCooldown] = useState(i?.cooldownDays ?? 14),
    [disengaged, setDisengaged] = useState(i?.disengagedAfter ?? 3),
    [minimum, setMinimum] = useState((i?.minimumIntervalMs ?? 1000) / 1000),
    [phone, setPhone] = useState(""),
    [reason, setReason] = useState("");
  return (
    <Modal title="Integração e preferências" onClose={onClose}>
      <dl className={s.summary}>
        <dt>Número</dt>
        <dd>{i?.health?.display_phone_number ?? "Não sincronizado"}</dd>
        <dt>Qualidade Meta</dt>
        <dd>{i?.health?.quality_rating ?? "Não informado"}</dd>
        <dt>Status do número</dt>
        <dd>{i?.health?.status ?? "Não informado"}</dd>
        <dt>Limite informado pela Meta</dt>
        <dd>{i?.health?.messaging_limit_tier ?? "Não informado"}</dd>
        <dt>Última sincronização</dt>
        <dd>{date(i?.syncedAt)}</dd>
      </dl>
      {i?.blockedReason && <div className={s.error}>{i.blockedReason}</div>}
      <button
        className={s.green}
        disabled={busy}
        onClick={() => submit({ operation: "sync", release: true })}
      >
        Revalidar integração e templates
      </button>
      <h3>Templates da Meta</h3>
      {templates.length ? (
        <dl className={s.summary}>
          {templates.map((template) => (
            <Fragment key={template.id}>
              <dt>{template.name}</dt>
              <dd>
                {template.category} · {template.language} · {template.status}
                {template.reviewReason
                  ? ` — Motivo: ${template.reviewReason}`
                  : ""}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p className={s.helper}>Nenhum template sincronizado.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({
            operation: "settings",
            frequencyHours: frequency,
            cooldownDays: cooldown,
            disengagedAfter: disengaged,
            minimumIntervalMs: minimum * 1000,
          });
        }}
      >
        <h3>Frequência e descanso</h3>
        <div className={s.twoColumns}>
          <Field label="Intervalo promocional por pessoa (horas)">
            <input
              type="number"
              min={1}
              max={8760}
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
            />
          </Field>
          <Field label="Descanso (dias)">
            <input
              type="number"
              min={1}
              max={365}
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
            />
          </Field>
          <Field label="Descanso após envios sem interação">
            <input
              type="number"
              min={1}
              max={50}
              value={disengaged}
              onChange={(e) => setDisengaged(Number(e.target.value))}
            />
          </Field>
          <Field label="Intervalo mínimo global (segundos)">
            <input
              type="number"
              min={1}
              max={3600}
              value={minimum}
              onChange={(e) => setMinimum(Number(e.target.value))}
            />
          </Field>
        </div>
        <footer>
          <button className={s.secondary} disabled={busy || !i}>
            Aplicar preferências
          </button>
        </footer>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({ operation: "suppress", phone, reason });
        }}
      >
        <h3>Descadastrar contato</h3>
        <Field label="Telefone com código do país">
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Motivo / origem da solicitação">
          <input
            required
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <footer>
          <button className={s.secondary} disabled={busy}>
            Adicionar à supressão
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function CampaignReport({
  report,
  busy,
  control,
  onSettings,
}: {
  report: any;
  busy: boolean;
  control: (id: string, op: string) => void;
  onSettings: () => void;
}) {
  const m = report.metrics ?? {};
  const snapshot = report.snapshot ?? {};
  return (
    <div className={s.stack}>
      <div className={s.reportBar}>
        <span className={`${s.badge} ${s[report.status]}`}>
          ● {stateLabels[report.status]}
        </span>
        <div>
          {["sending", "scheduled", "queued", "paused"].includes(
            report.status,
          ) && (
            <>
              {["sending", "scheduled", "queued"].includes(
                report.status,
              ) && Number(m.queued ?? 0) > 0 ? (
                <button
                  className={s.secondary}
                  disabled={busy}
                  onClick={() => control(report.id, "dispatchNow")}
                >
                  Enviar próximo agora
                </button>
              ) : null}
              <button
                className={s.secondary}
                disabled={busy}
                onClick={() =>
                  control(
                    report.id,
                    report.status === "paused" ? "resume" : "pause",
                  )
                }
              >
                {report.status === "paused"
                  ? "Retomar campanha"
                  : "Pausar campanha"}
              </button>
              <button
                className={s.secondary}
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Cancelar os envios pendentes?"))
                    control(report.id, "cancel");
                }}
              >
                Cancelar campanha
              </button>
            </>
          )}
          <button className={s.secondary} onClick={onSettings}>
            Saúde da integração
          </button>
        </div>
      </div>
      {report.pauseReason && (
        <div className={s.error}>{report.pauseReason}</div>
      )}
      <div className={s.reportMetrics}>
        {[
          ["Contatos", m.total],
          ["Na fila", m.queued],
          ["Aceitos pela API", m.accepted],
          ["Enviados", m.sent],
          ["Entregues", m.delivered],
          ["Lidos", m.read],
          ["Respostas", m.replies],
          ["Falhas", m.failed],
          ["Descadastros", m.optOuts],
          ["Cancelados", m.cancelled],
          ["Cliques no CTA", snapshot.config?.trackClicks ? m.clicks : null],
          [
            "Cliques totais",
            snapshot.config?.trackClicks ? m.totalClicks : null,
          ],
        ].map(([label, value]) => (
          <article key={String(label)}>
            <span>{label}</span>
            <strong>
              {value == null ? "Não disponível" : number(Number(value))}
            </strong>
          </article>
        ))}
      </div>
      <Card icon="chart" title="Estatísticas da campanha">
        <dl className={s.reviewGrid}>
          <dt>Taxa de entrega</dt>
          <dd>{percent(m.deliveryRate)}</dd>
          <dt>Taxa de leitura</dt>
          <dd>{percent(m.readRate)}</dd>
          <dt>Taxa de resposta</dt>
          <dd>{percent(m.replyRate)}</dd>
          <dt>Taxa de cliques</dt>
          <dd>
            {snapshot.config?.trackClicks
              ? percent(m.clickRate)
              : "Não disponível"}
          </dd>
          <dt>Início</dt>
          <dd>{date(report.startedAt)}</dd>
          <dt>Fim</dt>
          <dd>{date(report.completedAt)}</dd>
          <dt>Duração</dt>
          <dd>
            {report.startedAt
              ? duration(
                  ((report.completedAt
                    ? new Date(report.completedAt).getTime()
                    : Date.now()) -
                    new Date(report.startedAt).getTime()) /
                    1000,
                )
              : "—"}
          </dd>
          <dt>Template</dt>
          <dd>{snapshot.template?.name ?? "Mensagem livre"}</dd>
          <dt>Lista / versão</dt>
          <dd>
            {snapshot.list?.name} / {snapshot.list?.version}
          </dd>
          <dt>Mídia</dt>
          <dd>{snapshot.media?.name ?? "Nenhuma"}</dd>
        </dl>
        <p className={s.helper}>
          Entrega e leitura dependem dos webhooks. Respostas sem referência
          direta são atribuídas ao último envio aceito dos últimos 7 dias.
          Cliques rastreados podem incluir acessos automatizados.
        </p>
      </Card>
      <Card icon="users" title="Detalhamento por destinatário">
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Contato</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Aceito</th>
                <th>Entregue</th>
                <th>Lido</th>
                <th>Cliques</th>
                <th>Falha / restrição</th>
              </tr>
            </thead>
            <tbody>
              {(report.contacts ?? []).map((contact: any) => (
                <tr key={contact.id}>
                  <td>{contact.name || "—"}</td>
                  <td>{contact.phone}</td>
                  <td>{stateLabels[contact.state] ?? contact.state}</td>
                  <td>{date(contact.acceptedAt)}</td>
                  <td>{date(contact.deliveredAt)}</td>
                  <td>{date(contact.readAt)}</td>
                  <td>{number(Number(contact.clickCount ?? 0))}</td>
                  <td>
                    {contact.errorCode ? `${contact.errorCode} · ` : ""}
                    {contact.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card icon="file" title="Falhas e restrições por motivo">
        {Object.entries(m.errors ?? {}).map(([reason, n]) => (
          <div key={reason} className={s.errorRow}>
            <span>{reason}</span>
            <b>{number(Number(n))}</b>
          </div>
        ))}
        {!Object.keys(m.errors ?? {}).length && (
          <p>Nenhuma falha registrada.</p>
        )}
      </Card>
      <Card icon="clock" title="Histórico da campanha">
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {report.audit?.map((a: any) => (
                <tr key={a.id}>
                  <td>{date(a.createdAt)}</td>
                  <td>{a.action}</td>
                  <td>{a.actorId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
