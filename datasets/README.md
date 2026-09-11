# Datasets

**All data here is synthetic.** No real customer or production DNS traffic is used
anywhere in this project (spec §2, §33 item 14).

## `synthetic/sample-events.json`

66 hand-shaped `DnsEvent` records — a **fixture, not the producer.**

Its only job is to unblock parallel work: every lane can build and test against a
real, stable event shape without waiting for Kafka or the generator to exist.

> ⚠️ **This is not board item 2.** The real synthetic producer — streaming, seeded,
> covering the full scenario set in spec §13 — is still `NOT STARTED` and belongs to
> Dev 1 in `apps/synthetic-producer/`. Do not mark item 2 done because this file exists.

What it contains, so each lane has something to detect:

| Scenario | Events | Shape |
|---|---|---|
| Normal traffic | 24 | Two sites, healthy latency (8–34 ms), `NOERROR` |
| DGA | 10 | One host (`10.10.1.77`), high-entropy labels, all `NXDOMAIN` |
| Typosquatting | 4 | `micr0soft-secure-login.example` and friends, queried by several hosts |
| DNS tunneling | 8 | 48-char encoded labels under `tun.exfil-demo.example`, `TXT` |
| Beaconing | 8 | `cdn-sync-node.example` on a rigid 60 s cadence |
| QoE degradation | 12 | Branch resolver saturation: 380–950 ms, `SERVFAIL` bursts |

Generated with a fixed seed (`20260909`) and committed, so it is byte-identical for
everyone. Regenerating it changes a shared contract — if you must, say so in §10.

Sites: `ca-casa-matriz` (zone `corp.banco.local`) and `ca-costa-del-este`
(zone `sucursal.banco.local`) — a bank's data centre and one of its branches.
The generator adds `ca-el-dorado`, `ca-banca-linea` and `ca-red-atm`.

The site names are real Panamanian districts with real bank branches. The
*threat* brands are all fictional: a repository that ships a convincing
imitation of a real bank's login page is a liability regardless of intent.
