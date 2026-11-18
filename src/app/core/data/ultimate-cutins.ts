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
  /** Three source plates already contain the small gold name badge. */
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
export const ULTIMATE_CUTINS: Readonly<Record<string, UltimateCutinArt>> = {
  bailong: { ...plate('bailong', '#8edfff'), file: 'ui/cutins/bailong-aura-italic.webp', ratio: '1899 / 828',
    bakedText: true, stageWidth: '76vw', vfx: 'water',
    layers: ['ui/cutins/bailong-water-wake.webp', 'ui/cutins/bailong-water-spray.webp'],
    left: '47%', top: '48.5%', width: '28%', titleSize: '4.3cqw',
    nameLeft: '49.2%', nameTop: '63.2%', nameWidth: '23.8%', nameHeight: '8.4%', embeddedNameFrame: true },
  yuezheng: { ...plate('yuezheng', '#ffbd55'), ratio: '1920 / 819',
    left: '49%', top: '51%', width: '29%', titleSize: '4.5cqw',
    nameLeft: '53.5%', nameTop: '71%', nameWidth: '20%', nameHeight: '8%' },
  moye: { ...plate('moye', '#ff5267'), ratio: '1927 / 816',
    left: '46.2%', top: '49.5%', width: '29%', titleSize: '4.3cqw',
    nameLeft: '51.4%', nameTop: '66.6%', nameWidth: '18.6%', nameHeight: '8.4%', embeddedNameFrame: true },
  tangxun: { ...plate('tangxun', '#78e5ae'), ratio: '1940 / 810',
    left: '47%', top: '53%', width: '31%', titleSize: '3.4cqw',
    nameLeft: '52.5%', nameTop: '71%', nameWidth: '20%', nameHeight: '8%', addTitleStars: true },
  linxue: { ...plate('linxue', '#ffb5cf'), ratio: '1885 / 834',
    left: '49.5%', top: '49.5%', width: '25%', titleSize: '4.4cqw',
    nameLeft: '52.9%', nameTop: '66.8%', nameWidth: '18.2%', nameHeight: '8%', embeddedNameFrame: true },
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
