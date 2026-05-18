import Link from "next/link";
import { createPlatformLeadAction } from "@/features/platform-leads/platform-lead.actions";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { HomeEventCarousel } from "@/components/public/HomeEventCarousel";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { listCachedPublishedEventShowcase } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type HomePageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

function EnvelopeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7.5C4 6.67 4.67 6 5.5 6H18.5C19.33 6 20 6.67 20 7.5V16.5C20 17.33 19.33 18 18.5 18H5.5C4.67 18 4 17.33 4 16.5V7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M5 8L12 13L19 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.8 19.2C6.6 16.6 8.9 15 12 15C15.1 15 17.4 16.6 18.2 19.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 20C12 20 18 14.6 18 10.2C18 6.78 15.31 4 12 4C8.69 4 6 6.78 6 10.2C6 14.6 12 20 12 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="10.2" r="2.35" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M13.2 3.8L7.8 12H11.5L10.8 20.2L16.2 12H12.5L13.2 3.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3L18 5.4V10.2C18 14.2 15.7 17.86 12 19.5C8.3 17.86 6 14.2 6 10.2V5.4L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10H20.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.2 15H10.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.7V12L15.1 13.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 5.5H17C17 6.88 18.12 8 19.5 8V16C18.12 16 17 17.12 17 18.5H7C7 17.12 5.88 16 4.5 16V8C5.88 8 7 6.88 7 5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 8.6V10.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13.6V15.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4.8L14.17 9.2L19 9.9L15.5 13.3L16.33 18.1L12 15.82L7.67 18.1L8.5 13.3L5 9.9L9.83 9.2L12 4.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 11.8H7.8C8.46 11.8 9 12.34 9 13V17C9 17.66 8.46 18.2 7.8 18.2H6.5C5.67 18.2 5 17.53 5 16.7V13.3C5 12.47 5.67 11.8 6.5 11.8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.2 11.8H17.5C18.33 11.8 19 12.47 19 13.3V16.7C19 17.53 18.33 18.2 17.5 18.2H16.2C15.54 18.2 15 17.66 15 17V13C15 12.34 15.54 11.8 16.2 11.8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.2 19.2C14.5 19.73 13.46 20 12.1 20H11.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4C14.1 6.05 15.2 8.72 15.2 12C15.2 15.28 14.1 17.95 12 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4C9.9 6.05 8.8 8.72 8.8 12C8.8 15.28 9.9 17.95 12 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GrowthIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M5 18V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 18V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 18V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.8 7.4L9.2 3L13.8 7.6L20 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.4 1.8H20V6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 7.5C4 6.12 5.12 5 6.5 5H18.5C19.33 5 20 5.67 20 6.5V17.5C20 18.33 19.33 19 18.5 19H6.5C5.12 19 4 17.88 4 16.5V7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.6 8.2H13.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 19C4.55 16.52 6.5 15 9 15C11.5 15 13.45 16.52 14.2 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 11.3C16.54 11 17.7 9.64 17.7 8C17.7 6.36 16.54 5 15 4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.8 15.25C18.1 15.6 19.72 16.95 20.25 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 4V7.2M16 4V7.2M5 10H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="6.3" y="10" width="11.4" height="9" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.8 10V8.3C8.8 6.53 10.23 5.1 12 5.1C13.77 5.1 15.2 6.53 15.2 8.3V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

const leadAnnualRevenueBands = [
  "Até R$ 300 mil por ano",
  "De R$ 300 mil a R$ 1 milhão por ano",
  "De R$ 1 milhão a R$ 3 milhões por ano",
  "De R$ 3 milhões a R$ 10 milhões por ano",
  "Acima de R$ 10 milhões por ano"
];

function getPlatformLeadMessage(success?: string, error?: string) {
  if (error) {
    return {
      tone: "error" as const,
      text: error
    };
  }

  if (success === "existing") {
    return {
      tone: "success" as const,
      text: "Seu interesse já estava registrado. Nosso comercial pode continuar a conversa por esse mesmo contato."
    };
  }

  if (success === "created") {
    return {
      tone: "success" as const,
      text: "Recebemos seus dados. Nosso comercial vai falar com você para entender a operação e desenhar a melhor implantação."
    };
  }

  return null;
}

export default async function Home({ searchParams }: HomePageProps) {
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;
  const query = searchParams ? await searchParams : {};

  if (isPlatformHost) {
    const platformLeadMessage = getPlatformLeadMessage(query.success, query.error);

    return (
      <main className="ingressaasMarketPage">
        <section className="ingressaasHeroShell">
          <header className="ingressaasMarketHeader">
            <Link className="ingressaasMarketLogo" href="/" aria-label={organizationContext.platformName}>
              <span className="ingressaasLogoMark">
                <ShieldIcon />
              </span>
              <span>{organizationContext.platformName}</span>
            </Link>

            <nav className="ingressaasHeaderActions" aria-label="Ações principais">
              <a className="ingressaasHeaderButton" href="#quero-minha-bilheteria">
                <HeadsetIcon />
                <span>Falar com especialista</span>
              </a>
              <a className="ingressaasHeaderButton primary" href="#quero-minha-bilheteria">
                <TicketIcon />
                <span>Quero minha bilheteria</span>
              </a>
            </nav>
          </header>

          <div className="ingressaasHeroGrid">
            <div className="ingressaasHeroCopy">
              <span className="ingressaasHeroEyebrow">A bilheteria própria para produtores</span>
              <h1>
                Tenha a sua própria <strong>bilheteria.</strong>
              </h1>

              <ul className="ingressaasHeroBullets" aria-label="Benefícios principais">
                <li>
                  <span><GlobeIcon /></span>
                  Venda com o <strong>seu próprio domínio</strong>
                </li>
                <li>
                  <span><GrowthIcon /></span>
                  Ganhe <strong>mais por ingresso</strong> vendido
                </li>
                <li>
                  <span><WalletIcon /></span>
                  Saque seu dinheiro <strong>na hora</strong>
                </li>
              </ul>

              <p>
                A {organizationContext.platformName} foi criada para produtores que querem parar de depender de
                marketplaces e operar com mais margem, mais controle e 100% dos seus clientes.
              </p>

              <div className="ingressaasHeroActions">
                <a className="ingressaasCtaButton" href="#quero-minha-bilheteria">
                  Quero minha bilheteria <ArrowRightIcon />
                </a>
              </div>
            </div>

            <aside className="ingressaasDashboardMock" aria-label="Resumo comercial da bilheteria">
              <div className="ingressaasDashboardHeader">
                <strong><DotIcon /> Resumo comercial</strong>
                <span><CalendarIcon /> 12/05/2026 - 18/05/2026</span>
              </div>

              <div className="ingressaasMetricGrid">
                {[
                  ["Ingressos vendidos", "1.250", "+18.2%"],
                  ["Faturamento bruto", "R$ 87.540,00", "+22.7%"],
                  ["Visitantes", "942", "+15.4%"],
                  ["Ticket médio", "R$ 69,25", "+8.6%"]
                ].map(([label, value, growth]) => (
                  <article className="ingressaasMetricCard" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{growth} <em>vs ontem</em> ↗</small>
                  </article>
                ))}
              </div>

              <div className="ingressaasChartsGrid">
                <article className="ingressaasLineCard">
                  <div>
                    <strong>Vendas por dia</strong>
                    <span>Últimos 7 dias</span>
                  </div>
                  <svg viewBox="0 0 360 190" role="img" aria-label="Gráfico de vendas por dia">
                    <path d="M36 36H334M36 84H334M36 132H334M36 166H334" />
                    <polyline points="42,122 74,104 106,110 138,78 170,122 202,104 234,112 266,88 298,74 330,42" />
                    <circle cx="330" cy="42" r="6" />
                    <text x="34" y="178">12/05</text>
                    <text x="106" y="178">13/05</text>
                    <text x="178" y="178">15/05</text>
                    <text x="258" y="178">17/05</text>
                  </svg>
                </article>

                <article className="ingressaasDonutCard">
                  <strong>Canais de venda</strong>
                  <div className="ingressaasDonutContent">
                    <div className="ingressaasDonut" aria-label="85% site próprio">
                      <span>85%<small>Site próprio</small></span>
                    </div>
                    <ul>
                      <li><i /> Site próprio <strong>85%</strong></li>
                      <li><i /> Instagram <strong>8%</strong></li>
                      <li><i /> Link na bio <strong>5%</strong></li>
                      <li><i /> Outros <strong>2%</strong></li>
                    </ul>
                  </div>
                </article>
              </div>

              <article className="ingressaasFloatingCard">
                <span><ShieldIcon /></span>
                <div>
                  <strong>Operação 100% sua</strong>
                  <p>Dados, clientes e resultados no seu controle.</p>
                </div>
                <span><LockIcon /></span>
              </article>
            </aside>
          </div>

          <div className="ingressaasValueStrip" id="como-funciona">
            <article>
              <span><GrowthIcon /></span>
              <div>
                <strong>Mais margem para você</strong>
                <h2>5% a 15% a mais</h2>
                <h3>de margem por venda</h3>
                <p>Além do ingresso, você ganha de 5% a 15% a mais por venda com sua própria estrutura.</p>
              </div>
            </article>
            <article>
              <span><UsersIcon /></span>
              <div>
                <strong>Base de clientes 100% sua</strong>
                <h2>100%</h2>
                <h3>dos seus clientes</h3>
                <p>Nome, telefone e e-mail ficam na sua base, não no colo de plataforma concorrente.</p>
              </div>
            </article>
            <article>
              <span><WalletIcon /></span>
              <div>
                <strong>Seu dinheiro <em>sob seu controle</em></strong>
                <h2>Saque quando quiser</h2>
                <p>Receba seu faturamento quando quiser, com liberdade total para usar como precisar.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="ingressaasLeadSection" id="quero-minha-bilheteria">
          <div className="ingressaasLeadIntro">
            <span className="ingressaasHeroEyebrow">Implantação comercial</span>
            <h2>Conte o perfil da sua produtora e vamos desenhar sua bilheteria própria.</h2>
            <p>Preencha os dados para o time comercial entender nicho, porte e momento da operação.</p>
          </div>

          <form action={createPlatformLeadAction} className="ingressaasLeadForm">
            {platformLeadMessage?.tone === "error" ? (
              <ErrorNotice message={platformLeadMessage.text} className="formFeedback" />
            ) : platformLeadMessage ? (
              <div className="formFeedback success">
                {platformLeadMessage.text}
              </div>
            ) : null}

            <label>
              <span>Nome</span>
              <input name="name" type="text" placeholder="Seu nome completo" required />
            </label>
            <label>
              <span>E-mail</span>
              <input name="email" type="email" placeholder="voce@empresa.com.br" required />
            </label>
            <label>
              <span>Telefone</span>
              <input name="phone" type="tel" placeholder="1194444-2222" required />
            </label>
            <label>
              <span>Faturamento anual</span>
              <select name="annualRevenueBand" defaultValue="" required>
                <option value="" disabled>Selecione uma faixa</option>
                {leadAnnualRevenueBands.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>@ do Instagram <small>(opcional)</small></span>
              <input name="instagramHandle" type="text" placeholder="@suaprodutora" />
            </label>
            <label>
              <span>Nicho principal</span>
              <input name="eventNiche" type="text" placeholder="Conferências, shows, eventos gospel..." required />
            </label>
            <button className="ingressaasCtaButton" type="submit">Quero minha bilheteria</button>
          </form>
        </section>
      </main>
    );
  }

  const events = await listCachedPublishedEventShowcase(6, organizationContext.organization.id);
  const companySettings = await getCompanySettingsByOrganizationId(organizationContext.organization.id);
  const publicSocialSettings = companySettings as typeof companySettings & {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
    whatsappUrl?: string | null;
  };

  return (
    <main className="shell homePage" id="topo">
      <section className="tcrPremiumHero">
        <header className="tcrPremiumHeader">
          <Link className="tcrPremiumLogo" href="/">
            {organizationContext.brandLogoUrl ? (
              <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
            ) : (
              <>
                <span className="brandMark">{organizationContext.brandMark}</span>
                <span>{organizationContext.brandName}</span>
              </>
            )}
          </Link>

          <nav className="tcrPremiumNav" aria-label="Navegação principal">
            <a href="#eventos">Eventos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#ajuda">Ajuda</a>
          </nav>

          <form action="#eventos" className="tcrPremiumHeaderSearch" role="search">
            <SearchIcon />
            <input aria-label="Buscar eventos, artistas ou locais" name="q" placeholder="Buscar eventos, artistas ou locais" type="search" />
          </form>

          <div className="tcrPremiumActions">
            <Link className="button tcrPremiumTicketsCta" href="/meus-ingressos">
              <TicketIcon />
              <span>Meus ingressos</span>
            </Link>
          </div>

          <details className="tcrPremiumMobileMenu">
            <summary aria-label="Abrir menu">
              <MenuIcon />
            </summary>
            <div className="tcrPremiumMobilePanel">
              <a href="#eventos">Eventos</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#ajuda">Ajuda</a>
            </div>
          </details>
        </header>

        <div className="tcrPremiumHeroInner">
          <div className="tcrPremiumHeroLead">
            <span className="tcrPremiumEyebrow">Bilheteria oficial</span>
            <h1>A forma mais simples de viver <span>grandes experiências.</span></h1>
            <p>
              Compra rápida, ambiente seguro e acesso fácil aos seus ingressos.
            </p>
          </div>

          <form action="#eventos" className="tcrPremiumMobileSearch" role="search">
            <label>
              <SearchIcon />
              <input aria-label="Buscar eventos, artistas ou locais" name="q" placeholder="Buscar eventos, artistas ou locais" type="search" />
            </label>
            <label>
              <PinIcon />
              <select aria-label="Cidade">
                <option>Todas as cidades</option>
                <option>São Paulo, SP</option>
                <option>Porto Alegre, RS</option>
                <option>Santa Maria, RS</option>
              </select>
            </label>
            <button className="button" type="submit">
              Buscar eventos
            </button>
          </form>

          <div className="tcrPremiumTrustRow">
            <span>
              <ShieldIcon />
              <strong>Compra 100% segura</strong>
              <small>Seus dados protegidos</small>
            </span>
            <span>
              <CardIcon />
              <strong>Pagamento facilitado</strong>
              <small>Pix, cartão e mais</small>
            </span>
            <span>
              <LightningIcon />
              <strong>Ingresso na hora</strong>
              <small>Entrega após confirmação</small>
            </span>
          </div>

          <div className="tcrPremiumTrustInline" aria-label="Benefícios rápidos">
            <span>Compra 100% segura</span>
            <span>Pagamento facilitado</span>
            <span>Ingresso na hora</span>
          </div>

        </div>
      </section>

      <div className="tcrHeroToEventsBridge" aria-hidden="true" />

      <section className="container tcrEventsSection" id="eventos">
        <div className="tcrSectionHeader">
          <div>
            <span className="eyebrow">Em destaque</span>
            <h2>Próximos eventos</h2>
          </div>
        </div>
        <HomeEventCarousel events={events} />
      </section>

      <section className="container" id="como-funciona">
        <article className="tcrPremiumValueBand">
          <div className="tcrPremiumValueIcon">
            <ShieldIcon />
          </div>
          <div>
            <h3>Sua experiência é nossa prioridade.</h3>
            <p>Tecnologia, segurança e atendimento para você curtir o que realmente importa.</p>
          </div>
          <div className="tcrPremiumValueSupportIcon" aria-hidden="true">
            <HeadsetIcon />
          </div>
        </article>
      </section>

      <PublicSiteFooter
        brandLogoUrl={organizationContext.brandLogoUrl}
        brandName={organizationContext.brandName}
        supportPhone={organizationContext.organization.supportPhone}
        settings={publicSocialSettings}
      />
    </main>
  );
}
