/* senate-io.mjs: node loader for the Senate ranking tables (senate-flows.mjs stays pure for the browser). */
import { readFileSync } from "node:fs";
import { rankingsFrom } from "./senate-flows.mjs";

export function loadRankings(year, root = ".") {
  return rankingsFrom(JSON.parse(readFileSync(`${root}/data/senate-rankings-${year}.json`, "utf8")), year);
}
