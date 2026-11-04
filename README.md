# Savor One — GitHub Pages + Supabase edition

Target repository: https://github.com/md-alaminIslam/savor-one

Supabase project connected: wergrlnhsskksdsyttbj. Account schema and RLS are installed. This GitHub version is separate from the earlier ChatGPT-hosted prototype. GitHub Pages publication and Supabase Auth redirect settings must be enabled before end-to-end email signup is ready.

## What is included

- Corporate login and self-signup with full name, employee ID, department, email, password and password confirmation.
- Supabase email verification and password reset flow.
- New employee accounts start Pending. Admin reviews approval and role.
- Verified configured Admin: alaminislam105655@gmail.com; display name Al-amin Islam.
- Database-enforced account permissions; no client-controlled self-promotion.
- Existing marketing reports, IT inventory, requisitions, to-do planning, custom sections and sharing UI.
- GitHub Pages deployment workflow. Paths work beneath /savor-one/.

Business module records remain a BROWSER-LOCAL PROTOTYPE. Account registration, verification, approval and roles use Supabase after setup. This export does not move the old D1 accounts or local business records into Supabase. Users register again. Custom sections do not become shared across devices. Android APK must be rebuilt with the final, verified GitHub Pages URL after deployment; the previous APK still opens the previous hosted Site.

## Setup — do these in order

1. Create a new Supabase project. Keep Authentication > Email confirmation enabled. Configure your project's supported outgoing email delivery before inviting staff.
2. Run `supabase/setup.sql` once in that project's SQL Editor. It creates profiles, signup/verification triggers, RLS and an Admin-only approval function.
3. In `site/config.js`, fill the Supabase Project URL and PUBLIC publishable/anon key. Never put a service_role/secret key, account password or database password in this file or GitHub.
4. Upload the CONTENTS of this folder to the root of `md-alaminIslam/savor-one` on branch `main`, preserving `.github/workflows/pages.yml`. Do not upload only the containing folder or ZIP. If using GitHub's web uploader, ensure the workflow is included; hidden folders may need to be added separately.
5. Repository Settings > Pages > Source: GitHub Actions. Run the Deploy Savor One workflow. After success, copy the exact website URL from Pages or the workflow result.
6. Supabase Authentication > URL Configuration: set Site URL to the deployed website's `index.html` URL and add that URL plus the same URL with `?reset=1` to Redirect URLs.
7. On the new website, Create account using the configured Admin email, choose your password in the form, and verify the email. The trusted verification trigger assigns Admin access. Passwords are handled by Supabase; none are embedded in this package.
8. Test signup with a separate employee email: verify email, sign in, confirm Pending, then approve from Admin > Manage user accounts. Test sign-out and password reset on a real mailbox.

Until step 3 is completed, the website displays Setup required and does not pretend that login works.

## Validation and limits

All authored JavaScript was syntax-checked. Database tests verified staff row isolation, rejection of self-promotion through user metadata, rejection of direct profile updates, rejection of staff approval, and successful Admin approval. Tests ran in a rolled-back transaction; no test users were retained. Supabase security advisors reported no findings after hardening the existing RLS event-trigger function. End-to-end mailbox signup/reset and final Pages publication still require verification. No private credentials, user passwords, service tokens or old development signing keys are included.

The Supabase JS SDK is pinned at 2.118.0 and loaded from esm.sh; the login pages require internet and access to that CDN and your Supabase project.

## Project files

- site/index.html, auth.js: email/password login, signup and account panel.
- site/client.js: Supabase client and current account lookup.
- site/workspace.html, workspace-guard.js, workspace-code.js: existing browser-local business UI behind the active-account flow.
- supabase/setup.sql: server-side profile policies and approval.
- .github/workflows/pages.yml: Pages publication.

Account data is protected by RLS. The static UI's JavaScript is publicly downloadable on GitHub Pages; it contains no company records or secrets. Business demo editing in the browser is not a production authorization boundary. Implement shared business storage and permissions before using confidential operational records.
