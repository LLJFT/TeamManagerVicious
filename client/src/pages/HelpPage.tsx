import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HelpCircle,
  Calendar,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  CreditCard,
  LifeBuoy,
  Search,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { SiDiscord, SiX } from "react-icons/si";

const SECTION_IDS = [
  "getting-started",
  "schedule-events",
  "players-staff",
  "stats",
  "communication",
  "dashboard",
  "subscriptions",
  "support",
] as const;

const ICONS: Record<string, typeof HelpCircle> = {
  "getting-started": HelpCircle,
  "schedule-events": Calendar,
  "players-staff": Users,
  stats: BarChart3,
  communication: MessageSquare,
  dashboard: Settings,
  subscriptions: CreditCard,
  support: LifeBuoy,
};

interface ResolvedTopic { q: string; a: string }
interface ResolvedSection { id: string; title: string; blurb: string; topics: ResolvedTopic[]; icon: typeof HelpCircle }

export default function HelpPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(SECTION_IDS[0]);

  const allSections: ResolvedSection[] = useMemo(() => {
    return SECTION_IDS.map(id => {
      const topics = (t(`help.sections.${id}.topics`, { returnObjects: true }) as ResolvedTopic[]) || [];
      return {
        id,
        title: t(`help.sections.${id}.title`),
        blurb: t(`help.sections.${id}.blurb`),
        topics: Array.isArray(topics) ? topics : [],
        icon: ICONS[id] || HelpCircle,
      };
    });
  }, [t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSections;
    return allSections
      .map(section => ({
        ...section,
        topics: section.topics.filter(
          topic => topic.q.toLowerCase().includes(q) || topic.a.toLowerCase().includes(q),
        ),
      }))
      .filter(s => s.topics.length > 0 || s.title.toLowerCase().includes(q));
  }, [query, allSections]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.find(s => s.id === activeId)) {
      setActiveId(filtered[0].id);
    }
  }, [filtered, activeId]);

  const scrollTo = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(`help-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-2">
        <HelpCircle className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
          {t("help.pageTitle")}
        </h1>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">{t("help.pageSubtitle")}</p>

      <div className="relative max-w-md mb-6">
        <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t("help.searchPh")}
          className="ps-9"
          data-testid="input-help-search"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <nav className="md:sticky md:top-20 self-start space-y-1" data-testid="nav-help-toc">
          {allSections.map(section => {
            const Icon = section.icon;
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                onClick={() => scrollTo(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover-elevate ${isActive ? "bg-accent font-medium" : "text-muted-foreground"}`}
                data-testid={`link-help-toc-${section.id}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{section.title}</span>
              </button>
            );
          })}
          <div className="pt-3 mt-3 border-t space-y-1">
            <a
              href="https://discord.gg/HrGFwMxaD"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover-elevate"
              data-testid="link-help-discord"
            >
              <SiDiscord className="h-4 w-4" />
              <span>{t("help.discord")}</span>
              <ExternalLink className="h-3 w-3 ms-auto" />
            </a>
            <a
              href="https://x.com/The__BootCamp"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover-elevate"
              data-testid="link-help-x"
            >
              <SiX className="h-4 w-4" />
              <span>{t("help.xTwitter")}</span>
              <ExternalLink className="h-3 w-3 ms-auto" />
            </a>
          </div>
        </nav>

        <div className="space-y-6 min-w-0">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground" data-testid="text-help-no-results">
                {t("help.noResults", { query })}
              </CardContent>
            </Card>
          ) : (
            filtered.map(section => {
              const Icon = section.icon;
              return (
                <Card key={section.id} id={`help-${section.id}`} data-testid={`section-help-${section.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-md bg-primary/10 flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{section.blurb}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0">
                      {t("help.topicCount", { count: section.topics.length })}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {section.topics.map((topic, idx) => (
                      <div key={idx} className="border-t pt-4 first:border-t-0 first:pt-0" data-testid={`topic-${section.id}-${idx}`}>
                        <h3 className="text-sm font-semibold text-foreground mb-1">{topic.q}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{topic.a}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}

          <Card data-testid="section-help-quicklinks">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-primary" />
                {t("help.quickLinks")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              <Link href="/" data-testid="link-quick-home">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 me-2" /> {t("help.backToHome")}
                </Button>
              </Link>
              <Link href="/account" data-testid="link-quick-account">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 me-2" /> {t("help.accountSettings")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
