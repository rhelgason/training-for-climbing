import { BOULDER_GRADES, ROUTE_GRADES, gradeRank, gradesForDiscipline } from './grades';

describe('grade scales', () => {
  it('orders route grades easiest → hardest with letter sub-grades', () => {
    expect(ROUTE_GRADES[0]).toBe('5.5');
    expect(ROUTE_GRADES).toContain('5.9');
    expect(ROUTE_GRADES).toContain('5.10a');
    expect(ROUTE_GRADES[ROUTE_GRADES.length - 1]).toBe('5.15d');
    expect(gradeRank('lead', '5.11a')).toBeGreaterThan(gradeRank('lead', '5.10d'));
  });

  it('orders boulder grades VB → V17', () => {
    expect(BOULDER_GRADES[0]).toBe('VB');
    expect(BOULDER_GRADES[1]).toBe('V0');
    expect(BOULDER_GRADES[BOULDER_GRADES.length - 1]).toBe('V17');
    expect(gradeRank('boulder', 'V5')).toBeGreaterThan(gradeRank('boulder', 'V2'));
  });

  it('lead and top-rope share the route scale; boulder uses the V scale', () => {
    expect(gradesForDiscipline('lead')).toBe(ROUTE_GRADES);
    expect(gradesForDiscipline('toprope')).toBe(ROUTE_GRADES);
    expect(gradesForDiscipline('boulder')).toBe(BOULDER_GRADES);
  });

  it('returns -1 for an unknown grade', () => {
    expect(gradeRank('boulder', '5.11a')).toBe(-1);
  });
});
