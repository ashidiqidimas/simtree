---
name: publish
description: Bump version, build, and publish to npm
disable-model-invocation: true
argument-hint: "[patch|minor|major]"
---

# Publish to npm

Publish `@ashidiqidimas/simtree` to npm.

## Steps

1. Determine bump type from `$ARGUMENTS` (default to `patch` if not provided)
2. Run `pnpm build` and verify it succeeds
3. Run `npm version $ARGUMENTS` to bump version and create a git tag (use `patch` if no argument)
4. Ask the user for their npm OTP code
5. Run `npm publish --access public --ignore-scripts --otp <code>`
6. If OTP fails, ask for a fresh code and retry immediately
7. Run `git push && git push --tags`
8. Report the published version and link: https://www.npmjs.com/package/@ashidiqidimas/simtree
