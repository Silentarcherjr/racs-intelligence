/**
 * Side-effect import that arms the egress guard before anything else runs.
 *
 * Imported first in index.ts so it is evaluated before kafkajs, the ClickHouse
 * writer or the QVAC runtime have any chance to open a socket. Ordering is the
 * whole point: a guard installed after the first connection proves nothing.
 */
import { installEgressGuard } from "@sentinel/egress-guard";

installEgressGuard({ verbose: process.argv.includes("--trace-egress") });
