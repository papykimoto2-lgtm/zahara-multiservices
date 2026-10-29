/* Base de données : migrations 001–004 + scénarios (droits, circuit de dépense, grand livre, RLS, audit, PV) dans un PostgreSQL jetable.
   Chaque contrôle « ok … » du script SQL devient un PASS ; toute erreur SQL = FAIL. Aucune base réelle n'est touchée.
   Usage : node arc-en-ciel/tests/base-sql.js */
const { spawnSync } = require("child_process"), path = require("path");
const r = spawnSync("bash", [path.join(__dirname, "run.sh")], { encoding: "utf8", timeout: 240000 }), out = (r.stdout || "") + (r.stderr || "");
let ok = 0, ko = 0, i = 0;
out.split("\n").forEach(l => { const m = l.match(/NOTICE:\s+ok\s+(.*)$/); if (m) { console.log("PASS BD-" + (++i), m[1]); ok++; } else if (/ERROR:|FAUX MESSAGE|ECHEC/.test(l)) { console.log("FAIL", l.replace(/^psql:\S+\s+/, "")); ko++; } });
const fin = /TOUS LES TESTS PASSENT/.test(out) && /TOUS LES TESTS V2 PASSENT/.test(out) && /TOUS LES TESTS V3 PASSENT/.test(out);
if (!fin && !ko) { console.log("FAIL BD-0 le script SQL ne s'est pas terminé\n" + out.slice(-500)); ko++; }
console.log("\n" + ok + " réussis, " + ko + " échecs"); process.exit(ko || !fin ? 1 : 0);
