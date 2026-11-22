// Gera data/snapshot.json a partir do export salvo em data/monday-export-2026-11-14.json.
// Somente leitura: não chama a API da Monday.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { normalizeItem, buildLocalIndex } from '../lib/snapshot.mjs';
import { GROUPS } from '../lib/catalog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const exportPath = join(root, 'data', 'monday-export-2026-11-14.json');
const outPath = join(root, 'data', 'snapshot.json');
// Os PDFs já baixados ficam na Central TAG (não são copiados para não duplicar 125 MB).
const filesDirRelative = '../aprovacao-tag/data/files';
const manifestPath = resolve(root, filesDirRelative, '..', 'files-manifest.json');

const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
let manifest = [];
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { /* sem manifesto: arquivos sem cópia local */ }
const localIndex = buildLocalIndex(manifest, filesDirRelative);

const items = exported.items.map((raw) => normalizeItem(raw, localIndex));

const snapshot = {
  source: 'Monday · quadro Notas Fiscais (18407995628) · get_board_items_page',
  snapshotAt: '2026-11-14',
  board: exported.board,
  count: items.length,
  groups: GROUPS.map((g) => g.id),
  items,
};
writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8');

// Resumo para conferência
const byGroup = {};
for (const it of items) byGroup[it.group] = (byGroup[it.group] || 0) + 1;
const withLocal = items.reduce((n, it) => n + [...it.files, ...it.proofs].filter((f) => f.local).length, 0);
const totalFiles = items.reduce((n, it) => n + it.files.length + it.proofs.length, 0);
const divergent = items.filter((it) => it.groupId === 'group_mm2c28pe' && it.otavio === 'Reprovado').length;
console.log(JSON.stringify({ items: items.length, byGroup, files: totalFiles, filesWithLocalCopy: withLocal, pendentesComOtavioReprovado: divergent }, null, 2));
