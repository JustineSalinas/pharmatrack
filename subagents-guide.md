# Reusing Auditing Subagents in Other Projects

We have saved the subagents defined for this project to [subagents-manifest.json](file:///Users/virnajanem.navarro/Desktop/pharmatrack/subagents-manifest.json). You can easily import and reuse them in any other project by following these steps.

## How to Import Subagents in a New Project

1. **Copy the Manifest**:
   Copy the `subagents-manifest.json` file to the root of your new project's workspace.

2. **Instruct the Assistant**:
   In your new chat conversation for that project, send the following request to the AI assistant:
   > "Please read the `subagents-manifest.json` file in the root of the workspace and define all the subagents specified there."

3. **Verify Registration**:
   The assistant will parse the file, call the `define_subagent` tool for each subagent (Front-end, Back-end, QA, and Security), and confirm when they are ready.

4. **Launch the Subagents**:
   Once registered, you can ask the assistant to launch them:
   > "Launch the frontend_agent, backend_agent, qa_agent, and security_agent in parallel to inspect this project."

---

## Agent Specifications

*   **`frontend_agent`**: Audits layouts, styles, viewport responsiveness, inputs, and aesthetic quality.
*   **`backend_agent`**: Inspects API routes, database queries, logic flows, and performance.
*   **`qa_agent`**: Integrates testing libraries, generates test suites, and runs verification checks.
*   **`security_agent`**: Evaluates row-level security, auth middleware, and validation inputs.
