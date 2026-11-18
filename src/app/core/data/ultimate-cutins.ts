/** Approved style-3 cut-ins. Presentation only: never controls skill timing or damage. */
export interface UltimateCutinArt {
  file: string;
  accent: string;
  /** Native artwork ratio; text slots are measured against each isolated plate. */
  ratio: string;
  left: string;
  top: string;
  width: string;
  titleSize: string;
  nameLeft: string;
  nameTop: string;
  nameWidth: string;
  nameHeight: string;
  nameSize: string;
  /** Whether the source plate already contains the small gold name badge. */
  embeddedNameFrame: boolean;
  addTitleStars?: boolean;
  bakedText?: boolean;
  stageWidth?: string;
  vfx?: 'water';
  layers?: readonly string[];
}

const plate = (id: string, accent: string): UltimateCutinArt => ({
  file: `ui/cutins/${id}.webp`, accent, ratio: '2.25', left: '47%', top: '48%', width: '34%',
  titleSize: '3.5cqw', nameLeft: '53%', nameTop: '70%', nameWidth: '23%', nameHeight: '8.5%',
  nameSize: '2.1cqw', embeddedNameFrame: false,
});
/** Same approved Bai Long layout/animation, with hero-specific generated art and aura. */
const lockedPlate = (id: string, accent: string, w: number, h: number, group = 'locked-five'): UltimateCutinArt => ({
  ...plate(id, accent), file: `ui/cutins/${group}/${id}.webp`, ratio: `${w} / ${h}`,
  bakedText: true, embeddedNameFrame: true, stageWidth: '76vw', vfx: 'water',
  layers: [`ui/cutins/${group}/${id}-wake.webp`, `ui/cutins/${group}/${id}-spray.webp`],
});
export const ULTIMATE_CUTINS: Readonly<Record<string, UltimateCutinArt>> = {
  bailong: { ...plate('bailong', '#8edfff'), file: 'ui/cutins/bailong-aura-italic.webp', ratio: '1899 / 828',
    bakedText: true, stageWidth: '76vw', vfx: 'water',
    layers: ['ui/cutins/bailong-water-wake.webp', 'ui/cutins/bailong-water-spray.webp'],
    left: '47%', top: '48.5%', width: '28%', titleSize: '4.3cqw',
    nameLeft: '49.2%', nameTop: '63.2%', nameWidth: '23.8%', nameHeight: '8.4%', embeddedNameFrame: true },
  yuezheng: lockedPlate('yuezheng', '#ffbd55', 1899, 828),
  moye: lockedPlate('moye', '#ff5267', 1899, 828),
  tangxun: lockedPlate('tangxun', '#78e5ae', 1899, 828),
  linxue: lockedPlate('linxue', '#ffb5cf', 1899, 828),
  garrick: lockedPlate('garrick', '#e7c37a', 1899, 828, 'locked-next-five'),
  kael: lockedPlate('kael', '#ff9145', 1899, 828, 'locked-next-five'),
  mirelle: lockedPlate('mirelle', '#a9e8ff', 1899, 828, 'locked-next-five'),
  sylvara: lockedPlate('sylvara', '#9be66a', 1899, 828, 'locked-next-five'),
  elira: lockedPlate('elira', '#ffe0a1', 1899, 828, 'locked-next-five'),
  vaelric: lockedPlate('vaelric', '#e5cbdc', 1899, 828, 'locked-final-five'),
  draeven: lockedPlate('draeven', '#e84b60', 1899, 828, 'locked-final-five'),
  mordrienne: lockedPlate('mordrienne', '#98c9aa', 1899, 828, 'locked-final-five'),
  sylas: lockedPlate('sylas', '#69d8d4', 1899, 828, 'locked-final-five'),
  lucien: lockedPlate('lucien', '#eed1a5', 1899, 828, 'locked-final-five'),
};
