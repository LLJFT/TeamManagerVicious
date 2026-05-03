import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { extraResources } from "./locales-extra";

export type SupportedLanguage =
  | "en" | "ar" | "fr" | "es" | "de" | "pt" | "tr"
  | "ja" | "ko" | "zh" | "ru" | "it" | "nl" | "pl" | "sv";

export interface LanguageMeta {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇬🇧" },
  { code: "ar", label: "Arabic", nativeLabel: "عربي", flag: "🇸🇦", rtl: true },
  { code: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸" },
  { code: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", flag: "🇵🇹" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe", flag: "🇹🇷" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "Korean", nativeLabel: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "Chinese (Simplified)", nativeLabel: "中文简体", flag: "🇨🇳" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", flag: "🇷🇺" },
  { code: "it", label: "Italian", nativeLabel: "Italiano", flag: "🇮🇹" },
  { code: "nl", label: "Dutch", nativeLabel: "Nederlands", flag: "🇳🇱" },
  { code: "pl", label: "Polish", nativeLabel: "Polski", flag: "🇵🇱" },
  { code: "sv", label: "Swedish", nativeLabel: "Svenska", flag: "🇸🇪" },
];

export const RTL_LANGUAGES: SupportedLanguage[] = ["ar"];

export function isRtl(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang as SupportedLanguage);
}

export function applyDirection(lang: string) {
  if (typeof document === "undefined") return;
  const dir = isRtl(lang) ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang);
}

const en = {
  common: {
    save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit",
    add: "Add", remove: "Remove", search: "Search", loading: "Loading…",
    back: "Back", signOut: "Sign out", confirm: "Confirm", close: "Close",
    submit: "Submit", retry: "Retry", yes: "Yes", no: "No", noData: "No data yet",
  },
  nav: {
    games: "Games", overview: "Overview", calendar: "Calendar", users: "Users",
    roles: "Roles", gameAccess: "Game Access", gameTemplates: "Game Templates",
    mediaLibrary: "Media Library", subscriptions: "Subscriptions",
    managementChat: "Management Chat", settings: "Settings", account: "Account",
    navigation: "Navigation", administration: "Administration", communication: "Communication",
    allGames: "All Games", schedule: "Schedule", events: "Events", results: "Results",
    players: "Players", statistics: "Statistics", playerStats: "Player Stats",
    history: "History", compare: "Compare", opponents: "Opponents",
    draftStats: "Draft Stats", mapInsights: "Map Insights", heroInsights: "Hero Insights",
    trends: "Trends", teamLeaderboard: "Team Leaderboard", playerLeaderboard: "Player Leaderboard",
    teamComps: "Team Comps", dashboard: "Dashboard", staff: "Staff", chat: "Chat",
    main: "Main", analytics: "Analytics", management: "Management",
  },
  header: {
    help: "Help & Guide", theme: "Toggle theme", notifications: "Notifications",
    sidebarToggle: "Toggle sidebar", language: "Language",
  },
  subscription: {
    expiredTitle: "Your subscription has expired",
    requiredTitle: "Subscription required",
    expiredOn: "Your {{type}} ended on {{date}}.",
    inactiveAccount: "Your account is currently inactive. Please contact The Bootcamp to reactivate.",
    noSubscription: "Your account does not have an active subscription yet. Reach out to The Bootcamp to get started.",
    expiresToday: "Your subscription expires today",
    expiresTomorrow: "Your subscription expires tomorrow",
    expiresInDays: "Your subscription expires in {{days}} days",
    trial: "trial", plan: "plan",
    dismiss: "Dismiss", myPlan: "My Plan",
    active: "Active", inactive: "Inactive", admin: "Admin",
  },
  social: { discord: "Join our Discord", twitter: "Follow on X" },
  language: { select: "Select language" },
};

const ar = {
  common: {
    save: "حفظ", cancel: "إلغاء", delete: "حذف", edit: "تعديل",
    add: "إضافة", remove: "إزالة", search: "بحث", loading: "جارٍ التحميل…",
    back: "رجوع", signOut: "تسجيل الخروج", confirm: "تأكيد", close: "إغلاق",
    submit: "إرسال", retry: "إعادة المحاولة", yes: "نعم", no: "لا", noData: "لا توجد بيانات بعد",
  },
  nav: {
    games: "الألعاب", overview: "نظرة عامة", calendar: "التقويم", users: "المستخدمون",
    roles: "الأدوار", gameAccess: "صلاحيات الألعاب", gameTemplates: "قوالب الألعاب",
    mediaLibrary: "مكتبة الوسائط", subscriptions: "الاشتراكات",
    managementChat: "محادثة الإدارة", settings: "الإعدادات", account: "الحساب",
    navigation: "التنقل", administration: "الإدارة", communication: "التواصل",
    allGames: "كل الألعاب", schedule: "الجدول", events: "الأحداث", results: "النتائج",
    players: "اللاعبون", statistics: "الإحصائيات", playerStats: "إحصاءات اللاعب",
    history: "السجل", compare: "مقارنة", opponents: "الخصوم",
    draftStats: "إحصاءات الاختيار", mapInsights: "تحليل الخرائط", heroInsights: "تحليل الأبطال",
    trends: "المؤشرات", teamLeaderboard: "ترتيب الفريق", playerLeaderboard: "ترتيب اللاعبين",
    teamComps: "تشكيلات الفريق", dashboard: "لوحة التحكم", staff: "الطاقم", chat: "المحادثة",
    main: "الرئيسية", analytics: "التحليلات", management: "الإدارة",
  },
  header: {
    help: "المساعدة والدليل", theme: "تبديل السمة", notifications: "الإشعارات",
    sidebarToggle: "تبديل الشريط الجانبي", language: "اللغة",
  },
  subscription: {
    expiredTitle: "انتهت صلاحية اشتراكك",
    requiredTitle: "الاشتراك مطلوب",
    expiredOn: "انتهى {{type}} في {{date}}.",
    inactiveAccount: "حسابك غير نشط حاليًا. يرجى التواصل مع The Bootcamp لإعادة التفعيل.",
    noSubscription: "لا يوجد اشتراك نشط في حسابك بعد. تواصل مع The Bootcamp للبدء.",
    expiresToday: "ينتهي اشتراكك اليوم",
    expiresTomorrow: "ينتهي اشتراكك غدًا",
    expiresInDays: "ينتهي اشتراكك خلال {{days}} يومًا",
    trial: "النسخة التجريبية", plan: "الخطة",
    dismiss: "إخفاء", myPlan: "خطتي",
    active: "نشط", inactive: "غير نشط", admin: "مشرف",
  },
  social: { discord: "انضم إلى Discord", twitter: "تابعنا على X" },
  language: { select: "اختر اللغة" },
};

const fr = {
  common: {
    save: "Enregistrer", cancel: "Annuler", delete: "Supprimer", edit: "Modifier",
    add: "Ajouter", remove: "Retirer", search: "Rechercher", loading: "Chargement…",
    back: "Retour", signOut: "Déconnexion", confirm: "Confirmer", close: "Fermer",
    submit: "Envoyer", retry: "Réessayer", yes: "Oui", no: "Non", noData: "Aucune donnée pour le moment",
  },
  nav: {
    games: "Jeux", overview: "Vue d'ensemble", calendar: "Calendrier", users: "Utilisateurs",
    roles: "Rôles", gameAccess: "Accès aux jeux", gameTemplates: "Modèles de jeu",
    mediaLibrary: "Médiathèque", subscriptions: "Abonnements",
    managementChat: "Chat de direction", settings: "Paramètres", account: "Compte",
    navigation: "Navigation", administration: "Administration", communication: "Communication",
    allGames: "Tous les jeux", schedule: "Calendrier", events: "Événements", results: "Résultats",
    players: "Joueurs", statistics: "Statistiques", playerStats: "Stats joueurs",
    history: "Historique", compare: "Comparer", opponents: "Adversaires",
    draftStats: "Stats de draft", mapInsights: "Analyse des cartes", heroInsights: "Analyse des héros",
    trends: "Tendances", teamLeaderboard: "Classement équipe", playerLeaderboard: "Classement joueurs",
    teamComps: "Compositions", dashboard: "Tableau de bord", staff: "Staff", chat: "Chat",
    main: "Principal", analytics: "Analytique", management: "Gestion",
  },
  header: {
    help: "Aide et guide", theme: "Changer de thème", notifications: "Notifications",
    sidebarToggle: "Basculer la barre latérale", language: "Langue",
  },
  subscription: {
    expiredTitle: "Votre abonnement a expiré",
    requiredTitle: "Abonnement requis",
    expiredOn: "Votre {{type}} s'est terminé le {{date}}.",
    inactiveAccount: "Votre compte est actuellement inactif. Contactez The Bootcamp pour le réactiver.",
    noSubscription: "Votre compte n'a pas encore d'abonnement actif. Contactez The Bootcamp pour commencer.",
    expiresToday: "Votre abonnement expire aujourd'hui",
    expiresTomorrow: "Votre abonnement expire demain",
    expiresInDays: "Votre abonnement expire dans {{days}} jours",
    trial: "essai", plan: "abonnement",
    dismiss: "Ignorer", myPlan: "Mon abonnement",
    active: "Actif", inactive: "Inactif", admin: "Admin",
  },
  social: { discord: "Rejoindre Discord", twitter: "Suivre sur X" },
  language: { select: "Choisir la langue" },
};

const es = {
  common: {
    save: "Guardar", cancel: "Cancelar", delete: "Eliminar", edit: "Editar",
    add: "Añadir", remove: "Quitar", search: "Buscar", loading: "Cargando…",
    back: "Atrás", signOut: "Cerrar sesión", confirm: "Confirmar", close: "Cerrar",
    submit: "Enviar", retry: "Reintentar", yes: "Sí", no: "No", noData: "Aún no hay datos",
  },
  nav: {
    games: "Juegos", overview: "Resumen", calendar: "Calendario", users: "Usuarios",
    roles: "Roles", gameAccess: "Acceso a juegos", gameTemplates: "Plantillas de juego",
    mediaLibrary: "Mediateca", subscriptions: "Suscripciones",
    managementChat: "Chat de gestión", settings: "Ajustes", account: "Cuenta",
    navigation: "Navegación", administration: "Administración", communication: "Comunicación",
    allGames: "Todos los juegos", schedule: "Horario", events: "Eventos", results: "Resultados",
    players: "Jugadores", statistics: "Estadísticas", playerStats: "Estadísticas de jugador",
    history: "Historial", compare: "Comparar", opponents: "Rivales",
    draftStats: "Estadísticas de draft", mapInsights: "Análisis de mapas", heroInsights: "Análisis de héroes",
    trends: "Tendencias", teamLeaderboard: "Clasificación del equipo", playerLeaderboard: "Clasificación de jugadores",
    teamComps: "Composiciones", dashboard: "Panel", staff: "Staff", chat: "Chat",
    main: "Principal", analytics: "Analítica", management: "Gestión",
  },
  header: {
    help: "Ayuda y guía", theme: "Cambiar tema", notifications: "Notificaciones",
    sidebarToggle: "Alternar barra lateral", language: "Idioma",
  },
  subscription: {
    expiredTitle: "Tu suscripción ha expirado",
    requiredTitle: "Se requiere suscripción",
    expiredOn: "Tu {{type}} terminó el {{date}}.",
    inactiveAccount: "Tu cuenta está inactiva. Contacta a The Bootcamp para reactivarla.",
    noSubscription: "Tu cuenta aún no tiene una suscripción activa. Contacta a The Bootcamp para comenzar.",
    expiresToday: "Tu suscripción expira hoy",
    expiresTomorrow: "Tu suscripción expira mañana",
    expiresInDays: "Tu suscripción expira en {{days}} días",
    trial: "prueba", plan: "plan",
    dismiss: "Descartar", myPlan: "Mi plan",
    active: "Activo", inactive: "Inactivo", admin: "Admin",
  },
  social: { discord: "Únete a Discord", twitter: "Síguenos en X" },
  language: { select: "Seleccionar idioma" },
};

const de = {
  common: {
    save: "Speichern", cancel: "Abbrechen", delete: "Löschen", edit: "Bearbeiten",
    add: "Hinzufügen", remove: "Entfernen", search: "Suchen", loading: "Lädt…",
    back: "Zurück", signOut: "Abmelden", confirm: "Bestätigen", close: "Schließen",
    submit: "Absenden", retry: "Erneut versuchen", yes: "Ja", no: "Nein", noData: "Noch keine Daten",
  },
  nav: {
    games: "Spiele", overview: "Übersicht", calendar: "Kalender", users: "Benutzer",
    roles: "Rollen", gameAccess: "Spielzugriff", gameTemplates: "Spielvorlagen",
    mediaLibrary: "Medienbibliothek", subscriptions: "Abonnements",
    managementChat: "Management-Chat", settings: "Einstellungen", account: "Konto",
    navigation: "Navigation", administration: "Verwaltung", communication: "Kommunikation",
    allGames: "Alle Spiele", schedule: "Zeitplan", events: "Ereignisse", results: "Ergebnisse",
    players: "Spieler", statistics: "Statistiken", playerStats: "Spielerstats",
    history: "Verlauf", compare: "Vergleichen", opponents: "Gegner",
    draftStats: "Draft-Stats", mapInsights: "Karten-Analyse", heroInsights: "Helden-Analyse",
    trends: "Trends", teamLeaderboard: "Team-Rangliste", playerLeaderboard: "Spieler-Rangliste",
    teamComps: "Aufstellungen", dashboard: "Dashboard", staff: "Staff", chat: "Chat",
    main: "Hauptmenü", analytics: "Analyse", management: "Verwaltung",
  },
  header: {
    help: "Hilfe & Anleitung", theme: "Theme wechseln", notifications: "Benachrichtigungen",
    sidebarToggle: "Seitenleiste umschalten", language: "Sprache",
  },
  subscription: {
    expiredTitle: "Dein Abonnement ist abgelaufen",
    requiredTitle: "Abonnement erforderlich",
    expiredOn: "Dein {{type}} endete am {{date}}.",
    inactiveAccount: "Dein Konto ist derzeit inaktiv. Kontaktiere The Bootcamp zur Reaktivierung.",
    noSubscription: "Dein Konto hat noch kein aktives Abonnement. Wende dich an The Bootcamp.",
    expiresToday: "Dein Abonnement läuft heute ab",
    expiresTomorrow: "Dein Abonnement läuft morgen ab",
    expiresInDays: "Dein Abonnement läuft in {{days}} Tagen ab",
    trial: "Testversion", plan: "Plan",
    dismiss: "Ausblenden", myPlan: "Mein Plan",
    active: "Aktiv", inactive: "Inaktiv", admin: "Admin",
  },
  social: { discord: "Tritt unserem Discord bei", twitter: "Auf X folgen" },
  language: { select: "Sprache auswählen" },
};

const pt = {
  common: {
    save: "Salvar", cancel: "Cancelar", delete: "Excluir", edit: "Editar",
    add: "Adicionar", remove: "Remover", search: "Pesquisar", loading: "Carregando…",
    back: "Voltar", signOut: "Sair", confirm: "Confirmar", close: "Fechar",
    submit: "Enviar", retry: "Tentar novamente", yes: "Sim", no: "Não", noData: "Ainda sem dados",
  },
  nav: {
    games: "Jogos", overview: "Visão geral", calendar: "Calendário", users: "Usuários",
    roles: "Funções", gameAccess: "Acesso a jogos", gameTemplates: "Modelos de jogo",
    mediaLibrary: "Biblioteca de mídia", subscriptions: "Assinaturas",
    managementChat: "Chat da gestão", settings: "Configurações", account: "Conta",
    navigation: "Navegação", administration: "Administração", communication: "Comunicação",
    allGames: "Todos os jogos", schedule: "Agenda", events: "Eventos", results: "Resultados",
    players: "Jogadores", statistics: "Estatísticas", playerStats: "Estatísticas do jogador",
    history: "Histórico", compare: "Comparar", opponents: "Adversários",
    draftStats: "Estatísticas de draft", mapInsights: "Análise de mapas", heroInsights: "Análise de heróis",
    trends: "Tendências", teamLeaderboard: "Ranking da equipe", playerLeaderboard: "Ranking dos jogadores",
    teamComps: "Composições", dashboard: "Painel", staff: "Staff", chat: "Chat",
    main: "Principal", analytics: "Análises", management: "Gerenciamento",
  },
  header: {
    help: "Ajuda e guia", theme: "Alternar tema", notifications: "Notificações",
    sidebarToggle: "Alternar barra lateral", language: "Idioma",
  },
  subscription: {
    expiredTitle: "Sua assinatura expirou",
    requiredTitle: "Assinatura necessária",
    expiredOn: "Sua {{type}} terminou em {{date}}.",
    inactiveAccount: "Sua conta está inativa. Entre em contato com The Bootcamp para reativar.",
    noSubscription: "Sua conta ainda não tem uma assinatura ativa. Fale com The Bootcamp para começar.",
    expiresToday: "Sua assinatura expira hoje",
    expiresTomorrow: "Sua assinatura expira amanhã",
    expiresInDays: "Sua assinatura expira em {{days}} dias",
    trial: "avaliação", plan: "plano",
    dismiss: "Dispensar", myPlan: "Meu plano",
    active: "Ativo", inactive: "Inativo", admin: "Admin",
  },
  social: { discord: "Entrar no Discord", twitter: "Seguir no X" },
  language: { select: "Selecionar idioma" },
};

const tr = {
  common: {
    save: "Kaydet", cancel: "İptal", delete: "Sil", edit: "Düzenle",
    add: "Ekle", remove: "Kaldır", search: "Ara", loading: "Yükleniyor…",
    back: "Geri", signOut: "Çıkış yap", confirm: "Onayla", close: "Kapat",
    submit: "Gönder", retry: "Tekrar dene", yes: "Evet", no: "Hayır", noData: "Henüz veri yok",
  },
  nav: {
    games: "Oyunlar", overview: "Genel bakış", calendar: "Takvim", users: "Kullanıcılar",
    roles: "Roller", gameAccess: "Oyun erişimi", gameTemplates: "Oyun şablonları",
    mediaLibrary: "Medya kütüphanesi", subscriptions: "Abonelikler",
    managementChat: "Yönetim sohbeti", settings: "Ayarlar", account: "Hesap",
    navigation: "Gezinme", administration: "Yönetim", communication: "İletişim",
    allGames: "Tüm oyunlar", schedule: "Program", events: "Etkinlikler", results: "Sonuçlar",
    players: "Oyuncular", statistics: "İstatistikler", playerStats: "Oyuncu istatistikleri",
    history: "Geçmiş", compare: "Karşılaştır", opponents: "Rakipler",
    draftStats: "Seçim istatistikleri", mapInsights: "Harita analizi", heroInsights: "Kahraman analizi",
    trends: "Trendler", teamLeaderboard: "Takım sıralaması", playerLeaderboard: "Oyuncu sıralaması",
    teamComps: "Kompozisyonlar", dashboard: "Pano", staff: "Ekip", chat: "Sohbet",
    main: "Ana", analytics: "Analiz", management: "Yönetim",
  },
  header: {
    help: "Yardım ve kılavuz", theme: "Tema değiştir", notifications: "Bildirimler",
    sidebarToggle: "Kenar çubuğunu aç/kapat", language: "Dil",
  },
  subscription: {
    expiredTitle: "Aboneliğiniz sona erdi",
    requiredTitle: "Abonelik gerekli",
    expiredOn: "{{type}} {{date}} tarihinde sona erdi.",
    inactiveAccount: "Hesabınız şu anda aktif değil. Yeniden etkinleştirmek için The Bootcamp ile iletişime geçin.",
    noSubscription: "Hesabınızda henüz aktif bir abonelik yok. Başlamak için The Bootcamp ile iletişime geçin.",
    expiresToday: "Aboneliğiniz bugün sona eriyor",
    expiresTomorrow: "Aboneliğiniz yarın sona eriyor",
    expiresInDays: "Aboneliğiniz {{days}} gün içinde sona eriyor",
    trial: "deneme", plan: "abonelik",
    dismiss: "Kapat", myPlan: "Aboneliğim",
    active: "Aktif", inactive: "Pasif", admin: "Yönetici",
  },
  social: { discord: "Discord'a katıl", twitter: "X'te takip et" },
  language: { select: "Dil seçin" },
};

const ja = {
  common: {
    save: "保存", cancel: "キャンセル", delete: "削除", edit: "編集",
    add: "追加", remove: "削除", search: "検索", loading: "読み込み中…",
    back: "戻る", signOut: "サインアウト", confirm: "確認", close: "閉じる",
    submit: "送信", retry: "再試行", yes: "はい", no: "いいえ", noData: "データはまだありません",
  },
  nav: {
    games: "ゲーム", overview: "概要", calendar: "カレンダー", users: "ユーザー",
    roles: "ロール", gameAccess: "ゲームアクセス", gameTemplates: "ゲームテンプレート",
    mediaLibrary: "メディアライブラリ", subscriptions: "サブスクリプション",
    managementChat: "管理チャット", settings: "設定", account: "アカウント",
    navigation: "ナビゲーション", administration: "管理", communication: "コミュニケーション",
    allGames: "すべてのゲーム", schedule: "スケジュール", events: "イベント", results: "結果",
    players: "プレイヤー", statistics: "統計", playerStats: "プレイヤー統計",
    history: "履歴", compare: "比較", opponents: "対戦相手",
    draftStats: "ドラフト統計", mapInsights: "マップ分析", heroInsights: "ヒーロー分析",
    trends: "トレンド", teamLeaderboard: "チームランキング", playerLeaderboard: "プレイヤーランキング",
    teamComps: "編成", dashboard: "ダッシュボード", staff: "スタッフ", chat: "チャット",
    main: "メイン", analytics: "分析", management: "管理",
  },
  header: {
    help: "ヘルプ・ガイド", theme: "テーマ切替", notifications: "通知",
    sidebarToggle: "サイドバー切替", language: "言語",
  },
  subscription: {
    expiredTitle: "サブスクリプションの有効期限が切れました",
    requiredTitle: "サブスクリプションが必要です",
    expiredOn: "{{type}}は{{date}}に終了しました。",
    inactiveAccount: "アカウントは現在非アクティブです。再有効化するには The Bootcamp までご連絡ください。",
    noSubscription: "アカウントにはまだ有効なサブスクリプションがありません。The Bootcamp までお問い合わせください。",
    expiresToday: "サブスクリプションは本日で終了します",
    expiresTomorrow: "サブスクリプションは明日で終了します",
    expiresInDays: "サブスクリプションは{{days}}日後に終了します",
    trial: "トライアル", plan: "プラン",
    dismiss: "閉じる", myPlan: "マイプラン",
    active: "有効", inactive: "無効", admin: "管理者",
  },
  social: { discord: "Discord に参加", twitter: "X でフォロー" },
  language: { select: "言語を選択" },
};

const ko = {
  common: {
    save: "저장", cancel: "취소", delete: "삭제", edit: "편집",
    add: "추가", remove: "제거", search: "검색", loading: "로딩 중…",
    back: "뒤로", signOut: "로그아웃", confirm: "확인", close: "닫기",
    submit: "제출", retry: "다시 시도", yes: "예", no: "아니오", noData: "아직 데이터가 없습니다",
  },
  nav: {
    games: "게임", overview: "개요", calendar: "캘린더", users: "사용자",
    roles: "역할", gameAccess: "게임 접근", gameTemplates: "게임 템플릿",
    mediaLibrary: "미디어 라이브러리", subscriptions: "구독",
    managementChat: "관리 채팅", settings: "설정", account: "계정",
    navigation: "탐색", administration: "관리", communication: "커뮤니케이션",
    allGames: "모든 게임", schedule: "일정", events: "이벤트", results: "결과",
    players: "플레이어", statistics: "통계", playerStats: "플레이어 통계",
    history: "기록", compare: "비교", opponents: "상대",
    draftStats: "드래프트 통계", mapInsights: "맵 분석", heroInsights: "영웅 분석",
    trends: "추세", teamLeaderboard: "팀 순위", playerLeaderboard: "플레이어 순위",
    teamComps: "조합", dashboard: "대시보드", staff: "스태프", chat: "채팅",
    main: "메인", analytics: "분석", management: "관리",
  },
  header: {
    help: "도움말 및 가이드", theme: "테마 전환", notifications: "알림",
    sidebarToggle: "사이드바 전환", language: "언어",
  },
  subscription: {
    expiredTitle: "구독이 만료되었습니다",
    requiredTitle: "구독이 필요합니다",
    expiredOn: "{{type}}이(가) {{date}}에 종료되었습니다.",
    inactiveAccount: "계정이 현재 비활성 상태입니다. 재활성화하려면 The Bootcamp에 문의하세요.",
    noSubscription: "계정에 아직 활성 구독이 없습니다. 시작하려면 The Bootcamp에 문의하세요.",
    expiresToday: "구독이 오늘 만료됩니다",
    expiresTomorrow: "구독이 내일 만료됩니다",
    expiresInDays: "구독이 {{days}}일 후 만료됩니다",
    trial: "체험", plan: "플랜",
    dismiss: "닫기", myPlan: "내 플랜",
    active: "활성", inactive: "비활성", admin: "관리자",
  },
  social: { discord: "Discord 참여", twitter: "X 팔로우" },
  language: { select: "언어 선택" },
};

const zh = {
  common: {
    save: "保存", cancel: "取消", delete: "删除", edit: "编辑",
    add: "添加", remove: "移除", search: "搜索", loading: "加载中…",
    back: "返回", signOut: "退出登录", confirm: "确认", close: "关闭",
    submit: "提交", retry: "重试", yes: "是", no: "否", noData: "暂无数据",
  },
  nav: {
    games: "游戏", overview: "概览", calendar: "日历", users: "用户",
    roles: "角色", gameAccess: "游戏权限", gameTemplates: "游戏模板",
    mediaLibrary: "媒体库", subscriptions: "订阅",
    managementChat: "管理聊天", settings: "设置", account: "账户",
    navigation: "导航", administration: "管理", communication: "沟通",
    allGames: "所有游戏", schedule: "日程", events: "赛事", results: "结果",
    players: "选手", statistics: "统计", playerStats: "选手统计",
    history: "历史", compare: "对比", opponents: "对手",
    draftStats: "BP 统计", mapInsights: "地图分析", heroInsights: "英雄分析",
    trends: "趋势", teamLeaderboard: "战队排行", playerLeaderboard: "选手排行",
    teamComps: "阵容", dashboard: "仪表板", staff: "团队", chat: "聊天",
    main: "主菜单", analytics: "分析", management: "管理",
  },
  header: {
    help: "帮助与指南", theme: "切换主题", notifications: "通知",
    sidebarToggle: "切换侧边栏", language: "语言",
  },
  subscription: {
    expiredTitle: "您的订阅已过期",
    requiredTitle: "需要订阅",
    expiredOn: "您的{{type}}已于 {{date}} 结束。",
    inactiveAccount: "您的账户当前未激活。请联系 The Bootcamp 以重新激活。",
    noSubscription: "您的账户尚无有效订阅。请联系 The Bootcamp 开始使用。",
    expiresToday: "您的订阅今日到期",
    expiresTomorrow: "您的订阅明日到期",
    expiresInDays: "您的订阅将在 {{days}} 天后到期",
    trial: "试用", plan: "套餐",
    dismiss: "忽略", myPlan: "我的套餐",
    active: "有效", inactive: "无效", admin: "管理员",
  },
  social: { discord: "加入 Discord", twitter: "在 X 关注" },
  language: { select: "选择语言" },
};

const ru = {
  common: {
    save: "Сохранить", cancel: "Отмена", delete: "Удалить", edit: "Изменить",
    add: "Добавить", remove: "Убрать", search: "Поиск", loading: "Загрузка…",
    back: "Назад", signOut: "Выйти", confirm: "Подтвердить", close: "Закрыть",
    submit: "Отправить", retry: "Повторить", yes: "Да", no: "Нет", noData: "Пока нет данных",
  },
  nav: {
    games: "Игры", overview: "Обзор", calendar: "Календарь", users: "Пользователи",
    roles: "Роли", gameAccess: "Доступ к играм", gameTemplates: "Шаблоны игр",
    mediaLibrary: "Медиатека", subscriptions: "Подписки",
    managementChat: "Чат менеджмента", settings: "Настройки", account: "Аккаунт",
    navigation: "Навигация", administration: "Администрирование", communication: "Связь",
    allGames: "Все игры", schedule: "Расписание", events: "События", results: "Результаты",
    players: "Игроки", statistics: "Статистика", playerStats: "Статистика игрока",
    history: "История", compare: "Сравнить", opponents: "Соперники",
    draftStats: "Статистика драфта", mapInsights: "Анализ карт", heroInsights: "Анализ героев",
    trends: "Тренды", teamLeaderboard: "Рейтинг команды", playerLeaderboard: "Рейтинг игроков",
    teamComps: "Составы", dashboard: "Панель", staff: "Состав", chat: "Чат",
    main: "Главное", analytics: "Аналитика", management: "Управление",
  },
  header: {
    help: "Справка и руководство", theme: "Переключить тему", notifications: "Уведомления",
    sidebarToggle: "Боковая панель", language: "Язык",
  },
  subscription: {
    expiredTitle: "Срок вашей подписки истёк",
    requiredTitle: "Требуется подписка",
    expiredOn: "Ваш {{type}} закончился {{date}}.",
    inactiveAccount: "Ваш аккаунт неактивен. Обратитесь в The Bootcamp для активации.",
    noSubscription: "У вашего аккаунта пока нет активной подписки. Свяжитесь с The Bootcamp.",
    expiresToday: "Ваша подписка истекает сегодня",
    expiresTomorrow: "Ваша подписка истекает завтра",
    expiresInDays: "Ваша подписка истекает через {{days}} дн.",
    trial: "пробный период", plan: "тариф",
    dismiss: "Скрыть", myPlan: "Мой тариф",
    active: "Активна", inactive: "Неактивна", admin: "Админ",
  },
  social: { discord: "Присоединиться к Discord", twitter: "Подписаться в X" },
  language: { select: "Выберите язык" },
};

const it = {
  common: {
    save: "Salva", cancel: "Annulla", delete: "Elimina", edit: "Modifica",
    add: "Aggiungi", remove: "Rimuovi", search: "Cerca", loading: "Caricamento…",
    back: "Indietro", signOut: "Esci", confirm: "Conferma", close: "Chiudi",
    submit: "Invia", retry: "Riprova", yes: "Sì", no: "No", noData: "Nessun dato disponibile",
  },
  nav: {
    games: "Giochi", overview: "Panoramica", calendar: "Calendario", users: "Utenti",
    roles: "Ruoli", gameAccess: "Accesso ai giochi", gameTemplates: "Modelli di gioco",
    mediaLibrary: "Libreria media", subscriptions: "Abbonamenti",
    managementChat: "Chat di gestione", settings: "Impostazioni", account: "Account",
    navigation: "Navigazione", administration: "Amministrazione", communication: "Comunicazione",
    allGames: "Tutti i giochi", schedule: "Programma", events: "Eventi", results: "Risultati",
    players: "Giocatori", statistics: "Statistiche", playerStats: "Statistiche giocatore",
    history: "Cronologia", compare: "Confronta", opponents: "Avversari",
    draftStats: "Statistiche draft", mapInsights: "Analisi mappe", heroInsights: "Analisi eroi",
    trends: "Tendenze", teamLeaderboard: "Classifica squadra", playerLeaderboard: "Classifica giocatori",
    teamComps: "Composizioni", dashboard: "Dashboard", staff: "Staff", chat: "Chat",
    main: "Principale", analytics: "Analitica", management: "Gestione",
  },
  header: {
    help: "Aiuto e guida", theme: "Cambia tema", notifications: "Notifiche",
    sidebarToggle: "Mostra/nascondi barra laterale", language: "Lingua",
  },
  subscription: {
    expiredTitle: "Il tuo abbonamento è scaduto",
    requiredTitle: "Abbonamento richiesto",
    expiredOn: "Il tuo {{type}} è terminato il {{date}}.",
    inactiveAccount: "Il tuo account è inattivo. Contatta The Bootcamp per riattivarlo.",
    noSubscription: "Il tuo account non ha ancora un abbonamento attivo. Contatta The Bootcamp.",
    expiresToday: "Il tuo abbonamento scade oggi",
    expiresTomorrow: "Il tuo abbonamento scade domani",
    expiresInDays: "Il tuo abbonamento scade tra {{days}} giorni",
    trial: "prova", plan: "piano",
    dismiss: "Ignora", myPlan: "Il mio piano",
    active: "Attivo", inactive: "Inattivo", admin: "Admin",
  },
  social: { discord: "Unisciti al Discord", twitter: "Seguici su X" },
  language: { select: "Seleziona lingua" },
};

const nl = {
  common: {
    save: "Opslaan", cancel: "Annuleren", delete: "Verwijderen", edit: "Bewerken",
    add: "Toevoegen", remove: "Verwijderen", search: "Zoeken", loading: "Laden…",
    back: "Terug", signOut: "Uitloggen", confirm: "Bevestigen", close: "Sluiten",
    submit: "Verzenden", retry: "Opnieuw proberen", yes: "Ja", no: "Nee", noData: "Nog geen gegevens",
  },
  nav: {
    games: "Games", overview: "Overzicht", calendar: "Agenda", users: "Gebruikers",
    roles: "Rollen", gameAccess: "Game-toegang", gameTemplates: "Game-sjablonen",
    mediaLibrary: "Mediabibliotheek", subscriptions: "Abonnementen",
    managementChat: "Managementchat", settings: "Instellingen", account: "Account",
    navigation: "Navigatie", administration: "Beheer", communication: "Communicatie",
    allGames: "Alle games", schedule: "Schema", events: "Evenementen", results: "Resultaten",
    players: "Spelers", statistics: "Statistieken", playerStats: "Spelerstats",
    history: "Geschiedenis", compare: "Vergelijken", opponents: "Tegenstanders",
    draftStats: "Draftstats", mapInsights: "Map-analyse", heroInsights: "Hero-analyse",
    trends: "Trends", teamLeaderboard: "Teamranglijst", playerLeaderboard: "Spelersranglijst",
    teamComps: "Composities", dashboard: "Dashboard", staff: "Staff", chat: "Chat",
    main: "Hoofd", analytics: "Analyses", management: "Beheer",
  },
  header: {
    help: "Help en gids", theme: "Thema wisselen", notifications: "Meldingen",
    sidebarToggle: "Zijbalk wisselen", language: "Taal",
  },
  subscription: {
    expiredTitle: "Je abonnement is verlopen",
    requiredTitle: "Abonnement vereist",
    expiredOn: "Je {{type}} is geëindigd op {{date}}.",
    inactiveAccount: "Je account is momenteel inactief. Neem contact op met The Bootcamp.",
    noSubscription: "Je account heeft nog geen actief abonnement. Neem contact op met The Bootcamp.",
    expiresToday: "Je abonnement verloopt vandaag",
    expiresTomorrow: "Je abonnement verloopt morgen",
    expiresInDays: "Je abonnement verloopt over {{days}} dagen",
    trial: "proefperiode", plan: "abonnement",
    dismiss: "Sluiten", myPlan: "Mijn abonnement",
    active: "Actief", inactive: "Inactief", admin: "Admin",
  },
  social: { discord: "Word lid van Discord", twitter: "Volg op X" },
  language: { select: "Taal kiezen" },
};

const pl = {
  common: {
    save: "Zapisz", cancel: "Anuluj", delete: "Usuń", edit: "Edytuj",
    add: "Dodaj", remove: "Usuń", search: "Szukaj", loading: "Ładowanie…",
    back: "Wstecz", signOut: "Wyloguj", confirm: "Potwierdź", close: "Zamknij",
    submit: "Wyślij", retry: "Ponów", yes: "Tak", no: "Nie", noData: "Brak danych",
  },
  nav: {
    games: "Gry", overview: "Przegląd", calendar: "Kalendarz", users: "Użytkownicy",
    roles: "Role", gameAccess: "Dostęp do gier", gameTemplates: "Szablony gier",
    mediaLibrary: "Biblioteka mediów", subscriptions: "Subskrypcje",
    managementChat: "Czat zarządu", settings: "Ustawienia", account: "Konto",
    navigation: "Nawigacja", administration: "Administracja", communication: "Komunikacja",
    allGames: "Wszystkie gry", schedule: "Harmonogram", events: "Wydarzenia", results: "Wyniki",
    players: "Zawodnicy", statistics: "Statystyki", playerStats: "Statystyki zawodnika",
    history: "Historia", compare: "Porównaj", opponents: "Przeciwnicy",
    draftStats: "Statystyki draftu", mapInsights: "Analiza map", heroInsights: "Analiza bohaterów",
    trends: "Trendy", teamLeaderboard: "Ranking drużyny", playerLeaderboard: "Ranking zawodników",
    teamComps: "Składy", dashboard: "Pulpit", staff: "Sztab", chat: "Czat",
    main: "Główne", analytics: "Analityka", management: "Zarządzanie",
  },
  header: {
    help: "Pomoc i przewodnik", theme: "Przełącz motyw", notifications: "Powiadomienia",
    sidebarToggle: "Przełącz pasek boczny", language: "Język",
  },
  subscription: {
    expiredTitle: "Twoja subskrypcja wygasła",
    requiredTitle: "Wymagana subskrypcja",
    expiredOn: "Twój {{type}} zakończył się {{date}}.",
    inactiveAccount: "Twoje konto jest nieaktywne. Skontaktuj się z The Bootcamp w celu reaktywacji.",
    noSubscription: "Twoje konto nie ma jeszcze aktywnej subskrypcji. Skontaktuj się z The Bootcamp.",
    expiresToday: "Twoja subskrypcja wygasa dzisiaj",
    expiresTomorrow: "Twoja subskrypcja wygasa jutro",
    expiresInDays: "Twoja subskrypcja wygasa za {{days}} dni",
    trial: "okres próbny", plan: "plan",
    dismiss: "Ukryj", myPlan: "Mój plan",
    active: "Aktywny", inactive: "Nieaktywny", admin: "Admin",
  },
  social: { discord: "Dołącz do Discorda", twitter: "Obserwuj na X" },
  language: { select: "Wybierz język" },
};

const sv = {
  common: {
    save: "Spara", cancel: "Avbryt", delete: "Ta bort", edit: "Redigera",
    add: "Lägg till", remove: "Ta bort", search: "Sök", loading: "Läser in…",
    back: "Tillbaka", signOut: "Logga ut", confirm: "Bekräfta", close: "Stäng",
    submit: "Skicka", retry: "Försök igen", yes: "Ja", no: "Nej", noData: "Ingen data ännu",
  },
  nav: {
    games: "Spel", overview: "Översikt", calendar: "Kalender", users: "Användare",
    roles: "Roller", gameAccess: "Spelbehörighet", gameTemplates: "Spelmallar",
    mediaLibrary: "Mediabibliotek", subscriptions: "Prenumerationer",
    managementChat: "Ledningschatt", settings: "Inställningar", account: "Konto",
    navigation: "Navigering", administration: "Administration", communication: "Kommunikation",
    allGames: "Alla spel", schedule: "Schema", events: "Händelser", results: "Resultat",
    players: "Spelare", statistics: "Statistik", playerStats: "Spelarstatistik",
    history: "Historik", compare: "Jämför", opponents: "Motståndare",
    draftStats: "Draftstatistik", mapInsights: "Kartanalys", heroInsights: "Hjälteanalys",
    trends: "Trender", teamLeaderboard: "Lagrankning", playerLeaderboard: "Spelarrankning",
    teamComps: "Sammansättningar", dashboard: "Översikt", staff: "Staff", chat: "Chatt",
    main: "Huvud", analytics: "Analys", management: "Hantering",
  },
  header: {
    help: "Hjälp och guide", theme: "Växla tema", notifications: "Aviseringar",
    sidebarToggle: "Växla sidofält", language: "Språk",
  },
  subscription: {
    expiredTitle: "Din prenumeration har gått ut",
    requiredTitle: "Prenumeration krävs",
    expiredOn: "Din {{type}} avslutades {{date}}.",
    inactiveAccount: "Ditt konto är inaktivt. Kontakta The Bootcamp för att aktivera igen.",
    noSubscription: "Ditt konto har ännu ingen aktiv prenumeration. Kontakta The Bootcamp.",
    expiresToday: "Din prenumeration går ut idag",
    expiresTomorrow: "Din prenumeration går ut imorgon",
    expiresInDays: "Din prenumeration går ut om {{days}} dagar",
    trial: "provperiod", plan: "plan",
    dismiss: "Ignorera", myPlan: "Min plan",
    active: "Aktiv", inactive: "Inaktiv", admin: "Admin",
  },
  social: { discord: "Gå med i Discord", twitter: "Följ på X" },
  language: { select: "Välj språk" },
};

const baseTranslations: Record<string, any> = {
  en, ar, fr, es, de, pt, tr, ja, ko, zh, ru, it, nl, pl, sv,
};

function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== "object") return target;
  if (!target || typeof target !== "object") return { ...source };
  const out: any = { ...target };
  for (const key of Object.keys(source)) {
    const s = source[key];
    const t = out[key];
    if (s && typeof s === "object" && !Array.isArray(s) && t && typeof t === "object" && !Array.isArray(t)) {
      out[key] = deepMerge(t, s);
    } else {
      out[key] = s;
    }
  }
  return out;
}

const resources: Record<string, { translation: any }> = {};
for (const code of Object.keys(baseTranslations)) {
  resources[code] = {
    translation: deepMerge(baseTranslations[code], extraResources[code] || {}),
  };
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "app.language",
      caches: ["localStorage"],
    },
  });

applyDirection(i18n.language);
i18n.on("languageChanged", (lng) => applyDirection(lng));

export default i18n;
