/** Approved style-3 cut-ins. Presentation only: never controls skill timing or damage. */
export interface UltimateCutinArt {
  file: string;
  accent: string;
  /** Native artwork ratio and normalized live-text plaque coordinates. */
  ratio: string;
  left: string;
  top: string;
  width: string;
}

const plate = (id: string, accent: string): UltimateCutinArt => ({
  file: `ui/cutins/${id}.webp`, accent, ratio: '2.25', left: '47%', top: '52%', width: '34%',
});
export const ULTIMATE_CUTINS: Readonly<Record<string, UltimateCutinArt>> = {
  bailong: { ...plate('bailong', '#8edfff'), ratio: '1864 / 843' },
  yuezheng: { ...plate('yuezheng', '#ffbd55'), ratio: '1920 / 819' },
  moye: { ...plate('moye', '#ff5267'), ratio: '1927 / 816' },
  tangxun: { ...plate('tangxun', '#78e5ae'), ratio: '1940 / 810' },
  linxue: { ...plate('linxue', '#ffb5cf'), ratio: '1885 / 834' },
  garrick: { ...plate('garrick', '#e7c37a'), ratio: '1942 / 809' },
  kael: { ...plate('kael', '#ff9145'), ratio: '1920 / 819' },
  mirelle: { ...plate('mirelle', '#a9e8ff'), ratio: '1942 / 809' },
  sylvara: { ...plate('sylvara', '#9be66a'), ratio: '1930 / 815' },
  elira: { ...plate('elira', '#ffe0a1'), ratio: '1852 / 849' },
};
