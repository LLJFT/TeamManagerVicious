import {
  SiValorant, SiLeagueoflegends, SiCounterstrike, SiDota2, SiPubg,
  SiEa, SiActivision, SiEpicgames, SiUbisoft, SiRiotgames,
} from "react-icons/si";

import codMobileImg from "@assets/554px-CDM_Major_2025_allmode_1772182451275.png";
import efootballImg from "@assets/571px-EFootball_default_darkmode_1772182451275.png";
import apexImg from "@assets/594px-Apex_Legends_default_darkmode_1772182451275.png";
import crossfireImg from "@assets/600px-Crossfire_default_darkmode_1772182451275.png";
import mlbbImg from "@assets/600px-Mobile_Legends_2023_allmode_1772182451275.png";
import rocketLeagueImg from "@assets/630px-Rocket_League_default_lightmode_1772182451275.png";
import freeFireImg from "@assets/704px-Free_Fire_default_2022_allmode_1772182451276.png";
import theFinalsImg from "@assets/800px-The_Finals_default_darkmode_1772182451276.png";
import trackmaniaImg from "@assets/800px-Trackmania_logo_darkmode_1772182451276.png";
import brawlStarsImg from "@assets/Brawl_Stars_Default_allmode_1772182451276.png";
import warzoneImg from "@assets/COD_Warzone_1.0_default_lightmode_1772182451276.png";
import deadlockImg from "@assets/Deadlock_logo_allmode_1772182451276.png";
import fortniteImg from "@assets/Fortnite_default_allmode_1772182451276.png";
import hokImg from "@assets/Honor_of_Kings_allmode_1772182451276.png";
import overwatchImg from "@assets/Overwatch_default_lightmode_1772182451276.png";
import r6Img from "@assets/Rainbow_Six_Siege_default_lightmode_1772182451276.png";
import marvelRivalsImg from "@assets/rivals_1772182451276.png";
import tftImg from "@assets/Teamfight_Tactics_logo_lightmode_1772182451276.png";

const GAME_IMAGE_MAP: Record<string, string> = {
  "cod-mobile": codMobileImg,
  "efootball": efootballImg,
  "apex": apexImg,
  "crossfire": crossfireImg,
  "mlbb": mlbbImg,
  "rocket-league": rocketLeagueImg,
  "free-fire": freeFireImg,
  "free-fire-mobile": freeFireImg,
  "the-finals": theFinalsImg,
  "trackmania": trackmaniaImg,
  "brawl-stars": brawlStarsImg,
  "warzone": warzoneImg,
  "deadlock": deadlockImg,
  "fortnite": fortniteImg,
  "hok": hokImg,
  "hok-mobile": hokImg,
  "overwatch": overwatchImg,
  "r6": r6Img,
  "marvel-rivals": marvelRivalsImg,
  "tft": tftImg,
};

const SI_ICONS: Record<string, any> = {
  "valorant": SiValorant,
  "lol": SiLeagueoflegends,
  "cs": SiCounterstrike,
  "dota2": SiDota2,
  "pubg": SiPubg,
  "pubg-mobile": SiPubg,
  "ea-fc": SiEa,
  "cod": SiActivision,
  "fighting-games": SiActivision,
};

export const GAME_COLORS: Record<string, string> = {
  "valorant": "#FF4655",
  "lol": "#C89B3C",
  "cs": "#F0A03E",
  "dota2": "#9B1C1F",
  "pubg": "#F5A623",
  "pubg-mobile": "#F5A623",
  "overwatch": "#FA9C1E",
  "apex": "#CD3333",
  "fortnite": "#00C3FF",
  "rocket-league": "#0066FF",
  "r6": "#009BDE",
  "cod": "#8CC63F",
  "cod-mobile": "#8CC63F",
  "mlbb": "#1A7EC6",
  "hok": "#FFB800",
  "hok-mobile": "#FFB800",
  "brawl-stars": "#FF2A6D",
  "marvel-rivals": "#E62429",
  "ea-fc": "#00B2FF",
  "free-fire": "#FF6B00",
  "free-fire-mobile": "#FF6B00",
  "tft": "#C8AA6E",
  "crossfire": "#00A1E0",
  "deadlock": "#6B4226",
  "trackmania": "#009DDC",
  "the-finals": "#FFD700",
  "fighting-games": "#9333EA",
  "warzone": "#8CC63F",
  "efootball": "#1D5BA4",
};

export function GameIcon({ slug, name, size = "md", iconUrl }: { slug: string; name: string; size?: "sm" | "md"; iconUrl?: string | null }) {
  const imageUrl = iconUrl || GAME_IMAGE_MAP[slug];
  const SIIcon = SI_ICONS[slug];
  const color = GAME_COLORS[slug] || "#6B7280";
  const dim = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const iconSize = size === "sm" ? 14 : 22;
  const textSize = size === "sm" ? "text-[9px]" : "text-xs";

  if (imageUrl) {
    return (
      <div className={`${dim} rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden`} style={{ background: `${color}20` }}>
        <img src={imageUrl} alt={name} className="h-full w-full object-contain p-0.5" />
      </div>
    );
  }

  if (SIIcon) {
    return (
      <div className={`${dim} rounded-md flex items-center justify-center flex-shrink-0`} style={{ background: `${color}20` }}>
        <SIIcon style={{ color, fontSize: iconSize }} />
      </div>
    );
  }

  const abbr = name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <div className={`${dim} rounded-md flex items-center justify-center font-bold ${textSize} flex-shrink-0`} style={{ background: `${color}20`, color }}>
      {abbr}
    </div>
  );
}

export function GameBadge({ slug, name }: { slug: string; name: string }) {
  const imageUrl = GAME_IMAGE_MAP[slug];
  const SIIcon = SI_ICONS[slug];
  const color = GAME_COLORS[slug] || "#6B7280";

  if (imageUrl) {
    return (
      <div className="h-6 w-6 rounded flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: `${color}20` }}>
        <img src={imageUrl} alt={name} className="h-full w-full object-contain p-0.5" />
      </div>
    );
  }

  if (SIIcon) {
    return (
      <div className="h-6 w-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
        <SIIcon style={{ color, fontSize: 14 }} />
      </div>
    );
  }

  const abbr = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="h-6 w-6 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: `${color}20`, color }}>
      {abbr}
    </div>
  );
}
