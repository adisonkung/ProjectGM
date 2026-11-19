export const HOME_ART = 'ui/home-k7/';

type IconLayers = readonly [primary: string, secondary?: string];

export const HOME_ICONS: Readonly<Partial<Record<string, IconLayers>>> = {
  hero: ['nav_hero_helm', 'nav_hero_plume'],
  squad: ['nav_squad_pole', 'nav_squad_flag'],
  gear: ['nav_gear_shield', 'nav_gear_hammer'],
  summon: ['nav_summon_crystal', 'nav_summon_ring'],
  isle: ['nav_isle_island', 'nav_isle_cloud'],
  news: ['btn_news_horn'],
  mail: ['btn_mail_closed', 'btn_mail_open'],
  settings: ['btn_settings_gear'],
  event: ['tile_event_lantern'],
  mission: ['tile_mission_scroll_closed', 'tile_mission_scroll_open'],
  achieve: ['tile_achieve_trophy'],
  login: ['tile_login_calendar'],
  forge: ['tile_forge_anvil', 'tile_forge_hammer'],
  account: ['tile_account_crest'],
  boss: ['boss_emblem'],
};
