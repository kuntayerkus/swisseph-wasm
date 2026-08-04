# Contributing to swisseph-wasm

*English · [Türkçe](CONTRIBUTING.tr.md)*

Thank you for considering contributing to swisseph-wasm! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Please be respectful and constructive in your interactions. This project welcomes contributors of all backgrounds and experience levels.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/swisseph-wasm.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Node.js >= 20
- npm >= 11
- Docker (for WASM builds)
- Git

### Initial Setup

```bash
# Install dependencies
npm install

# Build WASM module (requires Docker)
npm run build:wasm

# Generate constants from C headers
npm run build:constants

# Build TypeScript
npm run build:ts

# Run all checks
npm run check
```

### Project Structure

```
swisseph-wasm/
├── packages/
│   ├── core/           # Main Swiss Ephemeris WASM wrapper
│   ├── data/           # Ephemeris data files (optional)
│   ├── asteroids/      # Asteroid ephemeris files
│   └── mcp/            # Model Context Protocol server
├── tools/              # Build and verification scripts
├── vendor/swisseph/    # Swiss Ephemeris C source
└── examples/           # Usage examples
```

## Coding Standards

### TypeScript

- Use strict mode (`"strict": true` in tsconfig.json)
- Prefer `const` over `let`, avoid `var`
- Use explicit type annotations for function parameters and return types
- Avoid `any` type; use `unknown` if necessary
- Export only public API surface; keep internals private

### JavaScript (Tools & Scripts)

- Use ES modules (`import`/`export`)
- No CommonJS in new code
- Follow Airbnb style guide where applicable

### File Naming

- TypeScript: `.ts` extension
- JavaScript: `.js` or `.mjs` for ES modules
- Test files: `.test.ts` or `.spec.ts`

### Documentation

- All public APIs must have JSDoc comments
- Include examples for complex functions
- Document edge cases and limitations
- Keep README files up to date

## Testing Requirements

### Before Submitting a PR

All tests must pass:

```bash
npm test
```

### Test Coverage

We aim for 90%+ coverage on core functionality. Run coverage:

```bash
npx vitest run --coverage
```

### Types of Tests

1. **Unit Tests**: Test individual functions in isolation
2. **Integration Tests**: Test interaction between components
3. **Golden Tests**: Verify numerical accuracy against native C build
4. **Smoke Tests**: Basic functionality without data files

### Adding New Tests

When adding new features, include:

- Unit tests for the core logic
- Integration tests if interacting with other modules
- Golden tests if performing numerical calculations

Example test structure:

```typescript
import { describe, it, expect } from 'vitest';
import { calc } from '../src/index.js';

describe('calc', () => {
  it('should return planetary positions', () => {
    const result = calc(2451545.0, Body.Sun);
    expect(result.longitude).toBeCloseTo(279.28, 2);
  });
});
```

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring without behavior change
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, tooling, or auxiliary file changes

### Examples

```
feat(lots): add Lot of Basis calculation

Implements the traditional Lot of Basis using the shorter arc
between Fortune and Spirit, with sect-aware mirroring.

Closes #42

---

fix(wasm): handle polar circle edge case in house calculation

The Ascendant was being swapped incorrectly beyond 66.5° latitude.
Now uses swehouse.c's built-in polar handling.

Fixes #38

---

docs(api): add Ayanamsa documentation

Documents all 48 sidereal modes with their traditional contexts
and recommended usage scenarios.
```

## Pull Request Process

### Before Opening a PR

1. Ensure all tests pass locally
2. Run `npm run check` to verify all quality gates
3. Update documentation if API changed
4. Add tests for new functionality
5. Rebase onto latest `main` branch

### PR Template

When opening a PR, please include:

- **Description**: What does this PR do?
- **Motivation**: Why is this needed?
- **Testing**: How was it tested?
- **Breaking Changes**: Does this break existing APIs?
- **Related Issues**: Link to any related issues

### Review Process

1. At least one maintainer must approve
2. All CI checks must pass
3. Code coverage must not decrease significantly
4. Documentation must be updated if needed

### Merging

- Squash merge for feature branches
- Rebase merge for bug fixes
- Never force push to shared branches

## Reporting Issues

### Bug Reports

Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md):

- Describe the bug clearly
- Provide steps to reproduce
- Include expected vs actual behavior
- Share environment details (Node version, OS, etc.)
- Add code snippets if applicable

### Feature Requests

Use the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md):

- Describe the desired feature
- Explain the use case
- Provide examples if possible
- Mention similar implementations in other libraries

### Documentation Improvements

Use the [Documentation Improvement Template](.github/ISSUE_TEMPLATE/docs_improvement.md):

- Specify which documentation needs improvement
- Suggest specific changes
- Provide context if needed

## Questions?

If you have questions before contributing:

1. Check existing [documentation](docs/)
2. Search closed issues for similar questions
3. Open a discussion on GitHub Discussions

Thank you for contributing to swisseph-wasm! 🙏
