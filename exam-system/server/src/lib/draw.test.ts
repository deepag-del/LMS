import test from "node:test";
import assert from "node:assert/strict";
import { BankQuestion, drawBalanced } from "./draw";

function bank(sops: Record<number, number>): BankQuestion[] {
  // {sopId: questionCount} -> flat bank with sequential ids
  const out: BankQuestion[] = [];
  let id = 1;
  for (const [sopId, count] of Object.entries(sops)) {
    for (let i = 0; i < Number(count); i++) out.push({ id: id++, sopId: Number(sopId) });
  }
  return out;
}

test("draws exactly n distinct questions", () => {
  const b = bank({ 1: 10, 2: 10, 3: 10 });
  const picked = drawBalanced(b, 5);
  assert.equal(picked.length, 5);
  assert.equal(new Set(picked.map(q => q.id)).size, 5);
});

test("balances across SOPs: 5 SOPs with plenty of questions -> 5 different SOPs", () => {
  const b = bank({ 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 });
  for (let i = 0; i < 20; i++) {
    const sops = new Set(drawBalanced(b, 5).map(q => q.sopId));
    assert.equal(sops.size, 5);
  }
});

test("balances across SOPs: 2 SOPs -> split 3/2, never 5/0", () => {
  const b = bank({ 1: 10, 2: 10 });
  for (let i = 0; i < 20; i++) {
    const counts = new Map<number, number>();
    for (const q of drawBalanced(b, 5)) counts.set(q.sopId, (counts.get(q.sopId) ?? 0) + 1);
    assert.deepEqual([...counts.values()].sort(), [2, 3]);
  }
});

test("excludeIds guarantees a non-overlapping set (cycle-2 rule)", () => {
  const b = bank({ 1: 5, 2: 5 });
  const first = drawBalanced(b, 5);
  const seen = new Set(first.map(q => q.id));
  for (let i = 0; i < 20; i++) {
    const second = drawBalanced(b, 5, seen);
    assert.equal(second.some(q => seen.has(q.id)), false);
  }
});

test("throws a clear error when the bank cannot supply n fresh questions", () => {
  const b = bank({ 1: 4 });
  assert.throws(() => drawBalanced(b, 5), /Question bank too small/);
  const b2 = bank({ 1: 6 });
  assert.throws(() => drawBalanced(b2, 5, new Set([1, 2])), /only 4 eligible/);
});

test("draw uses randomness: two draws from a large bank differ", () => {
  const b = bank({ 1: 30, 2: 30 });
  const a = drawBalanced(b, 5).map(q => q.id).join(",");
  let differed = false;
  for (let i = 0; i < 10 && !differed; i++) {
    differed = drawBalanced(b, 5).map(q => q.id).join(",") !== a;
  }
  assert.equal(differed, true);
});
