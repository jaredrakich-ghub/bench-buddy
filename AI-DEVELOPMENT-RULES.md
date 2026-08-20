AI Development Rules
These rules apply to all AI-assisted development of this project.

1. Protect the working application
Treat the current working application as valuable.
Do not make large or unnecessary changes without first explaining the proposed approach.
Preserve existing functionality unless a change has been explicitly requested.
Before significant changes, identify the files that will be modified.
Prefer small, incremental changes over large rewrites.
2. Git and version control
GitHub is the source of truth for this project.
Keep the project in a clean, working state wherever practical.
Make a Git commit after completing a meaningful, tested change.
Before major refactoring, ensure there is a recent known-good commit.
Never delete or overwrite substantial existing functionality without first explaining the consequences.
Do not rewrite Git history or force-push unless explicitly instructed.
3. Explain before major changes
Before making a significant architectural change, explain:

What you propose to change.
Why the change is necessary.
Which files will change.
What functionality could be affected.
Any new dependencies that will be introduced.
How the change can be tested.
For routine, low-risk changes, proceed normally and explain what was changed afterward.

4. Keep changes focused
Work on one feature or problem at a time.
Do not combine unrelated refactoring with a feature unless there is a clear reason.
Avoid changing working code simply because another implementation looks cleaner.
Prefer the simplest solution that is maintainable and understandable.
5. Dependencies and third-party code
Before adding a new dependency:

Explain why it is needed.
Prefer established, actively maintained packages.
Check and identify the package's licence.
Avoid adding a dependency when the functionality can reasonably be implemented without one.
Do not copy substantial proprietary or closed-source code into this project.

Prefer original implementations or appropriately licensed open-source code.

6. Security and secrets
Never commit or expose:

API keys
passwords
authentication tokens
private credentials
database credentials
production secrets
private certificates or keys
Use environment variables or an appropriate secret-management mechanism where required.

Check that sensitive files are excluded through .gitignore.

If a proposed change involves authentication, permissions, payments, personal information, external APIs, or other security-sensitive functionality, flag the risk before implementing it.

7. Personal and workplace information
This is a personal project.

Do not introduce or process confidential workplace information, proprietary company code, internal documents, credentials, customer information, or other confidential material.

Keep personal projects and workplace projects separate.

8. AI-generated code
Do not assume generated code is automatically correct.

For important changes:

Explain the implementation.
Identify assumptions.
Identify potential edge cases.
Suggest appropriate tests.
Do not claim something has been tested unless it has actually been tested.
If something cannot be verified, say so clearly.

9. Testing
After making a meaningful change:

Run the appropriate tests, checks, or build process where available.
If no automated tests exist, explain how the change should be manually tested.
Report any errors or warnings rather than hiding them.
Do not declare the project working unless there is evidence that it works.
10. Refactoring
Do not perform broad refactoring simply for the sake of making the code look cleaner.

When refactoring is useful:

Explain the problem with the current structure.
Identify the proposed improvement.
Keep behaviour unchanged unless otherwise requested.
Make the refactor independently reviewable where practical.
Test before and after the change.
11. Project ownership and decision-making
The human owner of this project makes the product and architectural decisions.

AI should provide recommendations, explain trade-offs, and implement agreed changes.

Do not make significant product decisions silently.

When there are multiple reasonable approaches, explain the options and recommend one.

12. Working style
Use this development loop:

Plan → Explain → Implement → Test → Review → Commit

When a task is ambiguous, ask for clarification rather than making a significant assumption.

When a task is straightforward and low-risk, proceed without unnecessary questions.

13. Default behaviour
When asked to make a change, first consider:

Is the requested change clear?
Could it break existing functionality?
Does it require a new dependency?
Does it introduce security, privacy, licensing, or data risks?
Can it be implemented incrementally?
How will it be tested?
When in doubt, prefer the option that is simpler, safer, reversible, and easier for the human owner to understand.

14. Avoid the command line where a GUI alternative exists
The project owner is not comfortable using PowerShell/Command Prompt and prefers not to.

Before asking the owner to run a terminal command, check whether the same result is achievable through a GUI instead — a web console (e.g. the Firebase console's Rules editor instead of `firebase deploy`), a desktop app already in use (e.g. GitHub Desktop instead of `git`/`gh` CLI), or a settings page — and use that path if it exists.

Only ask the owner to open a terminal when there is genuinely no GUI equivalent. When that happens:
- Say plainly why no GUI option exists for this specific step.
- Give exact copy-pasteable commands with plain-language explanation of what each one does and what success looks like.
- Assume no prior command-line familiarity — don't assume the owner knows how to open a terminal, navigate directories, or read command output.
