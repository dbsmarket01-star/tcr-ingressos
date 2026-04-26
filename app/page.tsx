import Link from "next/link";
import { listCachedPublishedEventShowcase } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getPlatformOverview } from "@/features/platform/platform.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

function formatEventCardDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const trustHighlights = ["Pix e cartão", "QR Code automático", "Check-in seguro"];

const operationalHighlights = [
  "Página pública com foco em conversão",
  "Pedidos, pagamentos e ingressos no mesmo fluxo",
  "Painel administrativo para operação diária"
];

const platformPillars = [
  {
    title: "Bilheteria própria",
    body: "Seu cliente deixa de depender de plataformas genéricas e passa a operar com domínio, painel e identidade próprios."
  },
  {
    title: "Mais margem por venda",
    body: "A proposta comercial da Ingresaas é ajudar a operação a capturar mais margem e lucrar entre 7% e 20% a mais por ingresso vendido."
  },
  {
    title: "Operação profissional",
    body: "Pedidos, check-in, QR Code, relatórios e rotina comercial ficam organizados em uma experiência mais forte para quem vende."
  }
];

const platformAudience = [
  "Produtores e operações que querem vender com bilheteria própria sem construir tecnologia do zero",
  "Clientes que querem domínio, equipe, branding e operação separados da plataforma-mãe",
  "Negócios que precisam vender, captar leads, validar QR Code e acompanhar resultados numa base única"
];

const platformCapabilityRows = [
  {
    title: "Venda, ticket e check-in",
    body: "Checkout, pagamento, emissão de ingresso e validação ficam centralizados em um fluxo que ajuda a vender e operar com menos ruído."
  },
  {
    title: "Captação e comercial",
    body: "Landing pages, leads, pedidos, atendimento e rotina operacional convivem no mesmo motor, sem quebra de fluxo."
  },
  {
    title: "Marca e domínio do cliente",
    body: "Cada operação filha publica no próprio domínio, com login próprio, identidade própria e percepção de marca mais forte."
  }
];

const platformControlPoints = [
  {
    title: "Estrutura de SaaS",
    body: "Você governa tudo do painel master e entrega ao cliente uma bilheteria pronta para operar."
  },
  {
    title: "Domínio próprio",
    body: "O cliente vende no próprio domínio e fortalece a percepção de marca a cada campanha."
  },
  {
    title: "Mais margem",
    body: "A base é pensada para ajudar a operação a capturar mais valor sobre cada venda realizada."
  }
];

const platformAccessCards = [
  {
    title: "Login do cliente",
    body: "Cada bilheteria filha entra no próprio admin com e-mail e senha, sem misturar acesso entre operações."
  },
  {
    title: "Segurança de acesso",
    body: "A Ingresaas controla quem pode ver dados, acessar configurações e operar cada cliente."
  },
  {
    title: "Governança central",
    body: "A plataforma-mãe acompanha domínios, branding, equipe e saúde da operação sem virar o painel do cliente final."
  }
];

export default async function Home() {
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;

  if (isPlatformHost) {
    const platformOverview = await getPlatformOverview();
    const liveOperations = platformOverview.operations.filter((item) => item.isActive);

    return (
      <main className="shell homePage platformHomePage">
        <section className="platformHero">
          <div className="platformHeroGrid">
            <div className="platformHeroContent">
              <div className="brand homeBrand" aria-label={organizationContext.platformName}>
                <span className="brandMark">{organizationContext.brandMark}</span>
                <span>{organizationContext.platformName}</span>
              </div>
              <span className="homeEyebrow">Plataforma SaaS de bilheteria</span>
              <h1>Tenha sua própria bilheteria, venda no seu domínio e capture mais margem em cada ingresso.</h1>
              <p>
                {organizationContext.platformName} entrega o motor da bilheteria para quem quer operar com marca
                própria, domínio próprio e mais controle comercial. A proposta é simples: sair da dependência de
                terceiros e lucrar entre 7% e 20% a mais na venda dos seus ingressos.
              </p>

              <div className="platformHeroActions">
                <Link className="button" href="/login">
                  Quero minha bilheteria
                </Link>
                <Link className="secondaryButton" href="/admin/operations">
                  Ver estrutura da plataforma
                </Link>
              </div>

              <div className="homeTrustStrip" aria-label="Diferenciais da plataforma">
                {["Bilheteria própria", "Domínio do cliente", "Mais margem por venda"].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>

              <div className="platformHeroChecklist">
                <span>Cria a operação</span>
                <span>Entrega login inicial</span>
                <span>Libera venda com domínio próprio</span>
              </div>

              <div className="platformControlGrid" aria-label="Pontos centrais da plataforma">
                {platformControlPoints.map((item) => (
                  <article className="platformControlCard" key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="platformHeroPanel">
              <div className="platformHeroPanelHeader">
                <span className="eyebrow">Resumo comercial</span>
                <strong>{organizationContext.platformName}</strong>
              </div>

              <div className="platformHeroMetrics">
                <article>
                  <span>Operações ativas</span>
                  <strong>{platformOverview.activeOrganizations}</strong>
                </article>
                <article>
                  <span>Domínios completos</span>
                  <strong>{platformOverview.fullyConfiguredOrganizations}</strong>
                </article>
                <article>
                  <span>Eventos publicados</span>
                  <strong>{platformOverview.publishedEvents}</strong>
                </article>
                <article>
                  <span>Usuários internos</span>
                  <strong>{platformOverview.totalAdmins}</strong>
                </article>
              </div>

              <div className="platformHeroNote">
                <strong>Modelo de negócio</strong>
                <p>
                  A plataforma controla o motor, enquanto cada cliente vende com a própria marca, o próprio domínio e
                  uma operação comercial separada.
                </p>
              </div>

              <div className="platformHeroMiniGrid">
                <article>
                  <span>Operações prontas</span>
                  <strong>{liveOperations.filter((item) => item.readinessScore >= 67).length}</strong>
                </article>
                <article>
                  <span>Implantação mínima</span>
                  <strong>Domínio + acesso + marca</strong>
                </article>
              </div>

              <div className="platformHeroSecurityPanel">
                <strong>Acesso e segurança</strong>
                <p>O cliente entra com login e senha próprios, enquanto a Ingresaas protege dados, relatórios e configurações por operação.</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="container platformSection">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">Por que a Ingresaas existe</span>
              <h2>Uma forma mais inteligente de vender sem entregar sua margem para plataformas genéricas.</h2>
            </div>
          </div>

          <div className="platformFlowGrid">
            {platformPillars.map((item, index) => (
              <article className="card platformFlowCard" key={item.title}>
                <span>{`0${index + 1}`}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container platformSection">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">O que o cliente recebe</span>
              <h2>Uma bilheteria pronta para vender, operar e crescer com a própria marca.</h2>
            </div>
          </div>

          <div className="platformCapabilityGrid">
            {platformCapabilityRows.map((item) => (
              <article className="card platformCapabilityCard" key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container platformSection">
          <div className="platformSplitGrid">
            <article className="card platformAudienceCard">
              <span className="eyebrow">Para quem faz sentido</span>
              <h2>Operações que querem bilheteria própria, mais controle comercial e uma base mais profissional.</h2>
              <div className="homeSupportList">
                {platformAudience.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>

            <article className="card platformOnboardingCard">
              <span className="eyebrow">Implantação enxuta</span>
              <h2>Como o cliente entra, recebe acesso e começa a vender dentro da plataforma.</h2>
              <ol className="platformChecklist">
                <li>Cadastra o cliente no painel master</li>
                <li>Define domínio público, domínio admin e identidade visual</li>
                <li>Cria o usuário inicial com login e senha</li>
                <li>Publica eventos e libera o fluxo comercial</li>
              </ol>
              <div className="platformOnboardingFootnote">
                Isso mantém cada novo cliente dentro do mesmo motor técnico, sem duplicar projeto, banco ou operação.
              </div>
            </article>
          </div>
        </section>

        <section className="container platformSection">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">Acesso controlado</span>
              <h2>Login do cliente, segurança de dados e acesso separado por operação.</h2>
            </div>
          </div>

          <div className="platformAccessGrid">
            {platformAccessCards.map((item) => (
              <article className="card platformAccessCard" key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container platformSection">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">Base já operando</span>
              <h2>Operações já estruturadas dentro da plataforma.</h2>
            </div>
            <div className="platformSectionActions">
              <Link className="secondaryButton smallButton" href="/admin">
                Abrir painel master
              </Link>
              <Link className="button smallButton" href="/admin/operations">
                Gerir operações
              </Link>
            </div>
          </div>

          <div className="platformOperationsGrid">
            {liveOperations.map((operation) => (
              <article className="card platformOperationCard" key={operation.id}>
                <div
                  className="platformOperationAccent"
                  style={{ background: operation.primaryColor || "linear-gradient(135deg, #0b7a63, #46a287)" }}
                />
                <div className="platformOperationHeader">
                  <div>
                    <strong>{operation.name}</strong>
                    <span>{operation.publicDomain || "Domínio ainda não configurado"}</span>
                  </div>
                  <span className={`status ${operation.isActive ? "published" : "draft"}`}>
                    {operation.isActive ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="platformOperationMeta">
                  <div>
                    <span>Eventos</span>
                    <strong>{operation.eventCount}</strong>
                  </div>
                  <div>
                    <span>Equipe</span>
                    <strong>{operation.adminCount}</strong>
                  </div>
                  <div>
                    <span>Prontidão</span>
                    <strong>{operation.readinessScore}%</strong>
                  </div>
                </div>
                <div className="platformReadinessBar" aria-label={`Prontidão de ${operation.readinessScore}%`}>
                  <span style={{ width: `${operation.readinessScore}%` }} />
                </div>
                <div className="platformReadinessTags">
                  {operation.readinessItems.map((item) => (
                    <span className={item.done ? "isDone" : "isTodo"} key={item.label}>
                      {item.label}
                    </span>
                  ))}
                </div>
                <p className="muted">
                  {operation.adminDomain
                    ? `Admin em ${operation.adminDomain}`
                    : "Ainda falta apontar o domínio administrativo desta operação."}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  const events = await listCachedPublishedEventShowcase(6, organizationContext.organization.id);
  const featuredEvent = events[0] ?? null;

  return (
    <main className="shell homePage">
      <section className="homeHero">
        <div className="homeHeroInner">
          <div className="homeHeroContent">
            <div className="brand homeBrand" aria-label={organizationContext.brandName}>
              <span className="brandMark">{organizationContext.brandMark}</span>
              <span>{organizationContext.brandName}</span>
            </div>
            <span className="homeEyebrow">Bilheteria oficial</span>
            <h1>Eventos em cartaz com compra segura, operação rápida e experiência profissional.</h1>
            <p>
              Encontre os próximos eventos da {organizationContext.brandName}, escolha seu ingresso em poucos passos e
              receba o QR Code automaticamente após a confirmação do pagamento.
            </p>
            <div className="homeTrustStrip" aria-label="Diferenciais da bilheteria">
              {trustHighlights.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="homeHeroStats" aria-label="Indicadores da bilheteria">
              <div>
                <span>Eventos</span>
                <strong>{events.length}</strong>
              </div>
              <div>
                <span>Fluxo</span>
                <strong>Compra e check-in</strong>
              </div>
              <div>
                <span>Pagamento</span>
                <strong>Pix e cartão</strong>
              </div>
            </div>
          </div>

          <aside className="homeFeaturePanel" aria-label="Evento em destaque">
            {featuredEvent ? (
              <article className="homeFeaturedEventCard">
                <div
                  className="homeFeaturedEventMedia"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(8, 20, 29, 0.08), rgba(8, 20, 29, 0.28)), url("${featuredEvent.bannerUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80"}")`
                  }}
                />
                <div className="homeFeaturedEventBody">
                  <span className="eyebrow">Em destaque</span>
                  <h2>{featuredEvent.title}</h2>
                  <p>
                    {formatEventCardDate(featuredEvent.startsAt)} • {featuredEvent.city}, {featuredEvent.state}
                  </p>
                  <strong>{featuredEvent.venueName}</strong>
                  <Link className="button fullButton" href={`/evento/${featuredEvent.slug}`}>
                    Comprar agora
                  </Link>
                </div>
              </article>
            ) : (
              <article className="card homeEmptyState">
                <h3>Nenhum evento em destaque</h3>
                <p className="muted">Assim que a agenda for publicada, os próximos eventos aparecem aqui.</p>
              </article>
            )}
          </aside>
        </div>
      </section>

      <section className="container homeSection">
        <div className="sectionHeader homeSectionHeader">
          <div>
            <span className="eyebrow">Agenda aberta</span>
            <h2>Confira os próximos eventos disponíveis</h2>
          </div>
        </div>

        <div className="homeShowcaseGrid">
          {events.length === 0 ? (
            <article className="card homeEmptyState">
              <h3>Nenhum evento publicado ainda</h3>
              <p className="muted">Assim que um evento for publicado no painel, ele aparecerá automaticamente aqui.</p>
            </article>
          ) : (
            events.map((event) => (
              <article className="card linkCard eventShowcaseCard" key={event.id}>
                <div
                  className="eventShowcaseImage"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(8, 20, 29, 0.06), rgba(8, 20, 29, 0.28)), url("${event.bannerUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1400&q=80"}")`
                  }}
                />
                <div className="eventShowcaseBody">
                  <span className="eyebrow">
                    {event.city}, {event.state}
                  </span>
                  <h3>{event.title}</h3>
                  <p className="muted">{formatEventCardDate(event.startsAt)}</p>
                  <strong>{event.venueName}</strong>
                  <Link className="button smallButton" href={`/evento/${event.slug}`}>
                    Comprar agora
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>

        <aside className="homeSupportPanel">
          <span className="eyebrow">Compra assistida</span>
          <h3>Do pedido ao QR Code, tudo em um só lugar.</h3>
          <p>
            A vitrine pública mostra os eventos em cartaz, enquanto o painel interno mantém a operação organizada para
            vendas, ingressos e check-in.
          </p>
          <div className="homeSupportList">
            {operationalHighlights.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
