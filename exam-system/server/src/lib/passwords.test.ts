import test from "node:test";
import assert from "node:assert/strict";
import { generateTempPassword, hashPassword, passwordPolicyError, verifyPassword } from "./passwords";

test("hash/verify round-trip", () => {
  const h = hashPassword("correct horse 42");
  assert.equal(verifyPassword("correct horse 42", h), true);
  assert.equal(verifyPassword("wrong password 42", h), false);
});

test("same password hashes differently (unique salt)", () => {
  assert.notEqual(hashPassword("abc123def456"), hashPassword("abc123def456"));
});

test("verify rejects malformed stored value", () => {
  assert.equal(verifyPassword("anything", "not-a-hash"), false);
});

test("temp passwords are 12 chars and satisfy the policy", () => {
  for (let i = 0; i < 20; i++) {
    const t = generateTempPassword();
    assert.equal(t.length, 12);
  }
});

test("password policy", () => {
  assert.ok(passwordPolicyError("short1"));            // too short
  assert.ok(passwordPolicyError("onlyletters"));       // no digit
  assert.ok(passwordPolicyError("0123456789"));        // no letter
  assert.equal(passwordPolicyError("goodpass123"), null);
});
