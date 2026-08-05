## Description

<!-- Describe what changes you have made and why. Include any relevant motivation and context. -->

## Type of Change

<!-- Mark the appropriate option with an [x] -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code style update (formatting, renaming)
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test addition/update
- [ ] Build/CI configuration change
- [ ] Other (please describe):

## Testing

<!-- Describe the tests you ran to verify your changes. Provide instructions so we can reproduce. -->

### Tests Performed

- [ ] `npm test` passes locally
- [ ] `npm run check` passes locally
- [ ] `npm run typecheck` passes locally
- [ ] New tests added for new functionality
- [ ] Existing tests updated if needed

### Test Details

<!-- Include any additional testing information -->

```bash
# Commands you ran
npm test
npm run check:golden
npm run check:api
```

## Checklist

<!-- Mark items with [x] once completed -->

- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] All new and existing tests pass locally
- [ ] Any dependent changes have been merged and published

## Breaking Changes

<!-- If this is a breaking change, describe what breaks and migration steps -->

### API Changes

<!-- List any public API changes -->

```typescript
// Before
const chart = swe.natalChart(jd, lat, lon);

// After
const chart = swe.natalChart(jd, lat, lon, houseSystem);
```

### Migration Guide

<!-- If applicable, provide migration steps -->

## Documentation Updates

<!-- List documentation files that were updated -->

- [ ] README.md
- [ ] README.tr.md
- [ ] docs/API.md
- [ ] docs/ROADMAP.md
- [ ] Package README files
- [ ] JSDoc comments
- [ ] Other: _______________

## Related Issues

<!-- Link to related issues using GitHub syntax -->

Closes #___
Related to #___
Fixes #___

## Screenshots / Videos

<!-- If applicable, include screenshots or screen recordings showing the changes -->

## Additional Notes

<!-- Any other information that would be helpful to reviewers -->

### Performance Impact

<!-- If this affects performance, describe the impact -->

- Before: ___
- After: ___

### Dependencies

<!-- List any new dependencies added or existing dependencies updated -->

- Added: ___
- Updated: ___
- Removed: ___

### Security Considerations

<!-- If this has security implications, describe them -->

---

## For Maintainers

- [ ] Code review completed
- [ ] All CI checks pass
- [ ] Documentation reviewed
- [ ] Tests verified
- [ ] Ready to merge

**Merge Strategy**: 
- [ ] Squash and merge (for feature branches)
- [ ] Rebase and merge (for bug fixes)
