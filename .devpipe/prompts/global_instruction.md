# Global Instructions

All agents share these rules.

## Project Context
- Respect existing code conventions and patterns
- Preserve all existing functionality when modifying files
- Keep changes minimal and focused on the task

## Output Format
- Include file path as a comment at the top of every code block
  - JS/TS: `// path/to/file.ts`
  - Python: `# path/to/file.py`
- Provide complete file contents, not partial snippets
- Never use placeholder comments like `// ... rest of file`

## Quality Standards
- All code must satisfy the acceptance criteria before marking done
- No hardcoded secrets or API keys
- Follow language-specific best practices
