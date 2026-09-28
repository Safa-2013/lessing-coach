// Landeseinheitliche Ferientermine laut Kultusministerium Baden-Württemberg.
// Bewegliche Ferientage legt jede Schule selbst fest und sind hier nicht enthalten.
export const SCHOOL_HOLIDAYS = [
  ['2026-07-30','2026-09-12','Sommerferien BW'],
  ['2026-10-26','2026-10-30','Herbstferien BW'],
  ['2026-12-23','2027-01-09','Weihnachtsferien BW'],
  ['2027-03-25','2027-03-25','Schulfrei (Gründonnerstag BW)'],
  ['2027-03-30','2027-04-03','Osterferien BW'],
  ['2027-05-18','2027-05-29','Pfingstferien BW'],
  ['2027-07-29','2027-09-11','Sommerferien BW'],
  ['2027-11-02','2027-11-06','Herbstferien BW'],
  ['2027-12-23','2028-01-08','Weihnachtsferien BW'],
  ['2028-04-13','2028-04-13','Schulfrei (Gründonnerstag BW)'],
  ['2028-04-18','2028-04-22','Osterferien BW'],
  ['2028-06-06','2028-06-17','Pfingstferien BW'],
  ['2028-07-27','2028-09-09','Sommerferien BW'],
  ['2028-10-30','2028-11-03','Herbstferien BW'],
  ['2028-12-23','2029-01-05','Weihnachtsferien BW']
];
export const holidayOn = day => SCHOOL_HOLIDAYS.find(([first,last]) => day >= first && day <= last)?.[2] || null;
