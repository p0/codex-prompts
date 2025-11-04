import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const CODEX_REPO_PATH = '/Users/pavel/src/codex/codex-rs';
const COLLECTION_REPO_PATH = '/Users/pavel/src/codex-prompts';

interface PromptFile {
  sourcePath: string;
  targetPath: string;
  name: string;
}

const PROMPT_FILES: PromptFile[] = [
  {
    sourcePath: 'core/prompt.md',
    targetPath: 'prompts/base.md',
    name: 'Base instructions'
  },
  {
    sourcePath: 'core/gpt_5_codex_prompt.md',
    targetPath: 'prompts/gpt5.md',
    name: 'GPT-5 Codex instructions'
  },
  {
    sourcePath: 'core/review_prompt.md',
    targetPath: 'prompts/review.md',
    name: 'Review mode instructions'
  }
];

async function getAllTags(): Promise<string[]> {
  const { stdout } = await execAsync('git tag --sort=creatordate', {
    cwd: CODEX_REPO_PATH
  });

  return stdout
    .trim()
    .split('\n')
    .filter(tag => tag.startsWith('rust-v'));
}

async function isVersionProcessed(version: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `git log --oneline --grep="Add metadata for ${version}$"`,
      { cwd: COLLECTION_REPO_PATH }
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function checkoutTag(tag: string): Promise<void> {
  await execAsync(`git checkout ${tag}`, {
    cwd: CODEX_REPO_PATH
  });
}

async function returnToMain(): Promise<void> {
  await execAsync('git checkout main', {
    cwd: CODEX_REPO_PATH
  });
}

async function extractPrompts(): Promise<{ extracted: string[], missing: string[] }> {
  const extracted: string[] = [];
  const missing: string[] = [];

  // Ensure prompts directory exists
  await fs.mkdir(path.join(COLLECTION_REPO_PATH, 'prompts'), { recursive: true });

  for (const file of PROMPT_FILES) {
    const sourcePath = path.join(CODEX_REPO_PATH, file.sourcePath);
    const targetPath = path.join(COLLECTION_REPO_PATH, file.targetPath);

    try {
      await fs.access(sourcePath);
      const content = await fs.readFile(sourcePath, 'utf-8');
      await fs.writeFile(targetPath, content, 'utf-8');
      extracted.push(file.name);
    } catch {
      missing.push(file.name);
    }
  }

  return { extracted, missing };
}

async function commitChanges(tag: string, extracted: string[], missing: string[]): Promise<void> {
  // Check if there are any changes to commit
  try {
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: COLLECTION_REPO_PATH
    });

    if (!statusOutput.trim()) {
      console.log('  No changes to commit');
      return;
    }

    // Add all changes
    await execAsync('git add .', {
      cwd: COLLECTION_REPO_PATH
    });

    // Create commit message
    let message = `Add metadata for ${tag}\n\nExtracted:\n`;
    extracted.forEach(name => {
      message += `- ${name}\n`;
    });

    if (missing.length > 0) {
      message += '\nMissing:\n';
      missing.forEach(name => {
        message += `- ${name}\n`;
      });
    }

    // Commit
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: COLLECTION_REPO_PATH
    });

    console.log(`  ✓ Committed changes`);
  } catch (error) {
    console.error('  ✗ Failed to commit:', error);
  }
}

async function main() {
  console.log('🔍 Collecting Codex CLI prompts...\n');

  // Parse command line arguments
  const startFromIndex = process.argv.findIndex(arg => arg.startsWith('--start-from='));
  const startFromVersion = startFromIndex !== -1
    ? process.argv[startFromIndex].split('=')[1]
    : null;

  const limitIndex = process.argv.findIndex(arg => arg.startsWith('--limit='));
  const limit = limitIndex !== -1
    ? parseInt(process.argv[limitIndex].split('=')[1], 10)
    : null;

  // Get all tags
  const allTags = await getAllTags();
  console.log(`Found ${allTags.length} rust-v tags\n`);

  // Filter tags if start-from is specified
  let tags = allTags;
  if (startFromVersion) {
    const startIndex = allTags.indexOf(startFromVersion);
    if (startIndex === -1) {
      console.error(`❌ Version ${startFromVersion} not found`);
      process.exit(1);
    }
    tags = allTags.slice(startIndex);
    console.log(`Starting from ${startFromVersion} (${tags.length} tags to process)\n`);
  }

  // Limit number of tags if specified
  if (limit) {
    tags = tags.slice(0, limit);
    console.log(`Limiting to first ${limit} tags\n`);
  }

  // Process each tag
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    console.log(`[${i + 1}/${tags.length}] Processing ${tag}...`);

    // Check if already processed
    const alreadyProcessed = await isVersionProcessed(tag);
    if (alreadyProcessed) {
      console.log(`  ⊘ Skipping (already processed)\n`);
      continue;
    }

    try {
      // Checkout tag
      await checkoutTag(tag);

      // Extract prompts
      const { extracted, missing } = await extractPrompts();

      if (extracted.length > 0) {
        console.log(`  ✓ Extracted: ${extracted.join(', ')}`);
      }
      if (missing.length > 0) {
        console.log(`  ⚠ Missing: ${missing.join(', ')}`);
      }

      // Commit changes
      await commitChanges(tag, extracted, missing);

      console.log('');
    } catch (error) {
      console.error(`  ✗ Error processing ${tag}:`, error);
      console.log('');
    }
  }

  // Return codex repo to main branch
  await returnToMain();

  console.log('✅ Collection complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
