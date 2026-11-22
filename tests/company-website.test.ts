import test from "node:test";
import assert from "node:assert/strict";
import { companyWebsite } from "@/lib/validation/application";
import { safeUrl } from "@/lib/validation/primitives";

test("company websites accept domains without a scheme and preserve explicit HTTP(S) links", () => {
  assert.equal(companyWebsite.parse(" Ola.com "), "https://Ola.com");
  assert.equal(
    companyWebsite.parse("example.com/product?ref=founder"),
    "https://example.com/product?ref=founder",
  );
  assert.equal(
    companyWebsite.parse("https://example.com"),
    "https://example.com",
  );
  assert.equal(
    companyWebsite.parse("http://example.com"),
    "http://example.com",
  );
  for (const input of [
    "",
    "not a website",
    "javascript:alert(1)",
    "data:text/html,hello",
    "ftp://example.com",
    "user:password@example.com",
  ]) {
    assert.equal(companyWebsite.safeParse(input).success, false, input);
  }
  // Other programme links retain their existing HTTPS-only policy.
  assert.equal(safeUrl.safeParse("http://example.com").success, false);
});
