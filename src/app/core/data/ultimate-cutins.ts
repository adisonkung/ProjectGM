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
const lockedPlate = (id: string, accent: string, w: number, h: number): UltimateCutinArt => ({
  ...plate(id, accent), file: `ui/cutins/locked-five/${id}.webp`, ratio: `${w} / ${h}`,
  bakedText: true, embeddedNameFrame: true, stageWidth: '76vw', vfx: 'water',
  layers: [`ui/cutins/locked-five/${id}-wake.webp`, `ui/cutins/locked-five/${id}-spray.webp`],
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
  garrick: { ...plate('garrick', '#e7c37a'), ratio: '1942 / 809',
    left: '46%', top: '47.5%', width: '30%', titleSize: '4cqw',
    nameLeft: '50%', nameTop: '63.5%', nameWidth: '22%', nameHeight: '8%' },
  kael: { ...plate('kael', '#ff9145'), ratio: '1920 / 819',
    left: '47%', top: '49%', width: '31%', titleSize: '3.8cqw',
    nameLeft: '52.5%', nameTop: '67%', nameWidth: '20%', nameHeight: '8%', addTitleStars: true },
  mirelle: { ...plate('mirelle', '#a9e8ff'), ratio: '1942 / 809',
    left: '48%', top: '52%', width: '30%', titleSize: '3.3cqw',
    nameLeft: '50%', nameTop: '71.5%', nameWidth: '26%', nameHeight: '8%', nameSize: '1.85cqw' },
  sylvara: { ...plate('sylvara', '#9be66a'), ratio: '1930 / 815',
    left: '50%', top: '52%', width: '28%', titleSize: '4cqw',
    nameLeft: '49%', nameTop: '68%', nameWidth: '30%', nameHeight: '8%', nameSize: '1.8cqw' },
  elira: { ...plate('elira', '#ffe0a1'), ratio: '1852 / 849',
    left: '47.5%', top: '50%', width: '27%', titleSize: '3.6cqw',
    nameLeft: '48.5%', nameTop: '68.5%', nameWidth: '25%', nameHeight: '8%', nameSize: '1.9cqw' },
};
