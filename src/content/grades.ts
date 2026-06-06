/**
 * Climbing grade scales. Routes use the US YDS (5.x) scale; boulders use the
 * US V-scale — matching the book's conventions. Each scale is ordered easiest →
 * hardest so grades can be ranked and compared.
 */
import type { ClimbDiscipline } from './climbing';

function buildRouteGrades(): string[] {
  const grades = ['5.5', '5.6', '5.7', '5.8', '5.9'];
  for (let n = 10; n <= 15; n += 1) {
    for (const letter of ['a', 'b', 'c', 'd']) grades.push(`5.${n}${letter}`);
  }
  return grades;
}

function buildBoulderGrades(): string[] {
  const grades = ['VB'];
  for (let v = 0; v <= 17; v += 1) grades.push(`V${v}`);
  return grades;
}

export const ROUTE_GRADES: string[] = buildRouteGrades();
export const BOULDER_GRADES: string[] = buildBoulderGrades();

/** The grade scale used by a discipline (lead and top-rope share route grades). */
export function gradesForDiscipline(discipline: ClimbDiscipline): string[] {
  return discipline === 'boulder' ? BOULDER_GRADES : ROUTE_GRADES;
}

/** Ordinal rank of a grade within its scale (higher = harder), or -1 if unknown. */
export function gradeRank(discipline: ClimbDiscipline, grade: string): number {
  return gradesForDiscipline(discipline).indexOf(grade);
}
