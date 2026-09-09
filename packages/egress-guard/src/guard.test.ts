import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { egressReport, installEgressGuard, isLocalHost, sovereignModePanel } from "./index.js";

test("classifies the trusted infrastructure boundary correctly", () => {
  for (const h of ["localhost", "127.0.0.1", "::1", "10.10.0.53", "192.168.1.10",
                   "172.16.0.5", "clickhouse", "kafka", "host.local"]) {
    assert.ok(isLocalHost(h), `${h} should be local`);
  }
  for (const h of ["api.openai.com", "generativelanguage.googleapis.com",
                   "huggingface.co", "8.8.8.8", "1.1.1.1", "example.com",
                   "172.15.0.1", "172.32.0.1"]) {
    assert.ok(!isLocalHost(h), `${h} should be external`);
  }
});

test("blocks a connection to a cloud AI endpoint", async () => {
  installEgressGuard();
  const sock = new net.Socket();
  assert.throws(
    () => sock.connect({ host: "api.openai.com", port: 443 }),
    /egress blocked/,
    "a cloud inference endpoint must not be reachable",
  );
  sock.destroy();
  assert.ok(egressReport().blocked >= 1);
});

test("allows a local service", () => {
  installEgressGuard();
  const before = egressReport().local;
  const sock = new net.Socket();
  // Nothing is listening; we only care that the guard did not object.
  sock.on("error", () => undefined);
  sock.connect({ host: "127.0.0.1", port: 59999 });
  sock.destroy();
  assert.equal(egressReport().local, before + 1);
});

test("the proof panel never claims to be air-gapped", () => {
  // Spec §21: never falsely claim air-gapped. The machine has a working NIC.
  const panel = sovereignModePanel().toLowerCase();
  assert.ok(!panel.includes("air-gap"), "must not claim an air gap");
  assert.ok(panel.includes("sovereign mode"));
  assert.ok(panel.includes("cloud inference endpoints"));
});
