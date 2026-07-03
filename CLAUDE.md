# Pharmatrack Development Guide

## gstack

Install on a new machine: `bash scripts/setup-gstack.sh` (requires [bun](https://bun.sh)).

Use the `/browse` skill from gstack for all web browsing. **Never use `mcp__claude-in-chrome__*` tools.**

### Available gstack skills:
- `/office-hours` — Schedule and manage office hours
- `/plan-ceo-review` — Plan CEO review
- `/plan-eng-review` — Plan engineering review
- `/plan-design-review` — Plan design review
- `/design-consultation` — Design consultation
- `/design-shotgun` — Design shotgun reviews
- `/design-html` — Design HTML/frontend
- `/review` — Code review
- `/ship` — Ship changes
- `/land-and-deploy` — Land and deploy
- `/canary` — Canary deployments
- `/benchmark` — Benchmark performance
- `/browse` — Web browsing (primary tool for all web access)
- `/connect-chrome` — Connect Chrome browser
- `/qa` — QA testing
- `/qa-only` — QA only
- `/design-review` — Design review
- `/setup-browser-cookies` — Setup browser cookies
- `/setup-deploy` — Setup deployment
- `/setup-gbrain` — Setup GBrain
- `/retro` — Retrospective
- `/investigate` — Investigate issues
- `/document-release` — Document release
- `/document-generate` — Generate documentation
- `/codex` — Code search and exploration
- `/cso` — Customer success operations
- `/autoplan` — Automatic planning
- `/plan-devex-review` — Plan developer experience review
- `/devex-review` — Developer experience review
- `/careful` — Careful mode
- `/freeze` — Freeze changes
- `/guard` — Guard mode
- `/unfreeze` — Unfreeze changes
- `/gstack-upgrade` — Upgrade gstack
- `/learn` — Learn mode

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
