# Codex CLI Prompt Collection

This repository tracks the evolution of OpenAI's Codex CLI system prompts and tool definitions across versions.

## Overview

The Codex CLI is an open-source AI coding assistant. This repository extracts system prompts from each tagged version in the [Codex repository](https://github.com/openai/codex) and commits them to track changes over time.

## Collection Method

Unlike closed-source tools that require HTTP interception, Codex is open source, so we can extract prompts directly from the git repository:

1. Checkout each `rust-v*` tag in the Codex repo
2. Copy prompt markdown files:
   - `core/prompt.md` → `prompts/base.md` (base instructions)
   - `core/gpt_5_codex_prompt.md` → `prompts/gpt5.md` (GPT-5 variant)
   - `core/review_prompt.md` → `prompts/review.md` (review mode)
3. Commit to this repository

This approach is much simpler and faster than HTTP interception (~1s per version vs ~30s).

## Repository Structure

```
codex-prompts/
├── prompts/
│   ├── base.md          # Main system prompt
│   ├── gpt5.md          # GPT-5 Codex variant
│   └── review.md        # Review mode prompt
├── collect.ts           # Collection script
└── README.md
```

## Usage

### Initial Setup

```bash
npm install
```

### Collect All Versions

```bash
npm start
```

### Collect Starting From Specific Version

```bash
npm run start:from=rust-v0.0.2505171051
```

### Limit Collection for Testing

```bash
npm start -- --limit=10
```

## Viewing Changes

View the evolution of prompts using git history:

```bash
# See all versions
git log --oneline

# View changes in a specific file
git log -p prompts/base.md

# Compare two versions
git diff rust-v0.0.2505171051 rust-v0.0.2506151200 prompts/base.md
```

## Requirements

- Node.js 20+
- Access to the Codex repository at `/Users/pavel/src/codex/codex-rs`

## Related

- [Claude Code Prompts](https://github.com/p0/claude-code-prompts) - Similar collection for Claude Code CLI
