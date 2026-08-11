import { randomInt } from "crypto";

// Balanced random question draw (used by the exam engine, Module 6).
// LOCKED rules covered here:
//  - 5 questions drawn randomly from the department bank
//  - balanced across SOPs (round-robin over SOP groups, random within each)
//  - excludeIds carries every question the employee already saw this year,
//    so a cycle-2 exam never overlaps cycle-1 (fresh, non-overlapping set)

export type BankQuestion = { id: number; sopId: number };

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); // crypto-quality randomness, not Math.random()
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function drawBalanced(
  bank: BankQuestion[],
  n: number,
  excludeIds: Set<number> = new Set()
): BankQuestion[] {
  const eligible = bank.filter(q => !excludeIds.has(q.id));
  if (eligible.length < n) {
    throw new Error(
      `Question bank too small: need ${n}, only ${eligible.length} eligible ` +
      `(bank ${bank.length}, excluded ${bank.length - eligible.length}). ` +
      `Add approved questions before running this exam.`
    );
  }
  // Group by SOP, shuffle within groups and the group order, then round-robin
  // so the 5 questions span as many different SOPs as possible.
  const groups = new Map<number, BankQuestion[]>();
  for (const q of shuffle(eligible)) {
    if (!groups.has(q.sopId)) groups.set(q.sopId, []);
    groups.get(q.sopId)!.push(q);
  }
  const order = shuffle([...groups.keys()]);
  const picked: BankQuestion[] = [];
  let round = 0;
  while (picked.length < n) {
    let took = false;
    for (const sopId of order) {
      if (picked.length >= n) break;
      const g = groups.get(sopId)!;
      if (round < g.length) {
        picked.push(g[round]);
        took = true;
      }
    }
    if (!took) break; // every group exhausted (cannot happen given the size check)
    round++;
  }
  return shuffle(picked); // final order random too (question order randomized per candidate)
}
