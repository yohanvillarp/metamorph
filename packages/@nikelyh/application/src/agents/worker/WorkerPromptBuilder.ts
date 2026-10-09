import { resolveMigrationCatalog, formatCatalogRules, MigrationPlan } from '@nikelyh/domain';
import { collectFileHints } from '../../migration/registry';
import { buildFileTree } from '../../context/FileTreeBuilder';
import { buildNeighborContext } from '../../context/NeighborContext';

function buildCatalogSection(source: string, target: string): string {
  const catalogEntry = resolveMigrationCatalog(source, target);
  if (!catalogEntry) return '';

  let section = `\nArchitectural rules (all → ${catalogEntry.layer} → frameworks → this pair):\n`;
  section += `${formatCatalogRules(catalogEntry.ruleSections)}\n`;

  if (catalogEntry.examples && catalogEntry.examples.length > 0) {
    section += `\nReference Examples:\n`;
    catalogEntry.examples.forEach((ex) => {
      section += `Example (${ex.description}):\nBefore:\n\`\`\`\n${ex.before}\n\`\`\`\nAfter:\n\`\`\`\n${ex.after}\n\`\`\`\n\n`;
    });
  }

  return section;
}

function buildProjectTreeSection(plan?: MigrationPlan | null): string {
  if (!plan?.tasks || plan.tasks.length === 0) return '';
  const allFiles = plan.tasks.map((t) => t.filePath);
  const projectTree = buildFileTree(allFiles);
  return `\nGlobal Project Architecture (Files being migrated):\n\`\`\`text\n${projectTree}\n\`\`\`\nUse this context to ensure your changes align with the overall project structure.\n`;
}

export function buildWorkOnFilePrompt(filePath: string, plan?: MigrationPlan | null): string {
  let prompt = `You need to migrate the file at path: ${filePath}\n`;
  if (plan) {
    prompt += `Migration Profile: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
    prompt += buildCatalogSection(plan.profile.source, plan.profile.target);

    if (plan.profile.rules) {
      prompt += `Specific User Rules: ${plan.profile.rules.join(', ')}\n`;
    }

    prompt += buildProjectTreeSection(plan);
    const catalogEntry = resolveMigrationCatalog(plan.profile.source, plan.profile.target);
    prompt += collectFileHints(
      filePath,
      { source: plan.profile.source, target: plan.profile.target },
      catalogEntry?.layer,
    );
  }

  prompt += buildNeighborContext(filePath);
  prompt += `\nYou are not a mechanical find-replace bot. Deduce the correct change from the evidence above and from tools (read_file, list_directory).
Before writing:
1. Read every local import you will call.
2. Keep that module's public prop/export names exactly.
3. If this is a router/bootstrap file, import an existing screen from the nearby paths — do not paste a new copy of its JSX.
Then write the file(s). If structure must change, create/rename/delete accordingly.`;

  return prompt;
}

export function buildFixRejectedPrompt(params: {
  filePath: string;
  errors: string[];
  source?: string;
  plan?: MigrationPlan | null;
}): string {
  const { filePath, errors, source, plan } = params;
  let prompt = `You need to FIX the file at path: ${filePath}\n`;

  if (source === 'integration') {
    prompt += `The Integration Agent rejected this file because the shadow workspace failed npm install / npm run build, or a catalog verifier flagged it.\n`;
    prompt += `If the file does not exist yet, create it. If it is a router/bootstrap file, import existing screens — do not re-implement them or rename their callback props.\n`;
  } else {
    prompt += `Your previous migration was REJECTED by the Quality Assurance Reviewer.\n`;
  }

  prompt += `Feedback/Errors:\n${errors.join('\n')}\n\n`;

  if (plan) {
    prompt += `Migration Profile: Transform from ${plan.profile.source} to ${plan.profile.target}.\n`;
    prompt += buildCatalogSection(plan.profile.source, plan.profile.target);
    prompt += buildProjectTreeSection(plan);

    const catalogEntry = resolveMigrationCatalog(plan.profile.source, plan.profile.target);
    prompt += collectFileHints(
      filePath,
      { source: plan.profile.source, target: plan.profile.target },
      catalogEntry?.layer,
    );
  }

  prompt += buildNeighborContext(filePath);
  prompt += `\nDeduce the fix from the errors and the disk evidence. Read imported modules (and list_directory if you need another screen). Do not guess APIs. Then write the corrected file(s). If the path does not exist, create it. Do not delete existing screens just to make a router file compile.`;

  return prompt;
}
