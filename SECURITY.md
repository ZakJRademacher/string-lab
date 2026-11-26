# Security policy

## Supported versions

Only the live site and the latest release get security fixes.

| Version | Supported |
| --- | --- |
| 1.x (latest) | Yes |
| Older | No |

## Reporting a vulnerability

Please report security problems privately, not in a public issue.

1. Go to the repository's **Security** tab and choose **Report a vulnerability**. This opens a private advisory that only the maintainer can see.
2. Describe the problem, the affected page or file, and how to reproduce it.

You should get a reply within 7 days. Once a fix is released, the advisory is published with credit to you, unless you'd rather stay anonymous.

## Scope

These are in scope:

- The live site at https://string-lab.zakjrademacher.workers.dev, including script injection and the handling of setups saved in your browser.
- The third-party libraries the site loads.
- Secrets or private data committed to the repository, the GitHub Actions workflows, and pinned dependencies.

Out of scope are problems in the underlying hosting platform or the third-party services themselves.
