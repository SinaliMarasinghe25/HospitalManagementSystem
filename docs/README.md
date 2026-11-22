# HMS documentation

| Folder | Document | What it covers |
| --- | --- | --- |
| `guides/` | [setup-guide.md](guides/setup-guide.md) | Install the tools, create the database login (with `CREATEDB`), secrets, run the API and frontend, troubleshooting |
| `guides/` | [user-manual.md](guides/user-manual.md) | How each of the seven roles uses the system |
| `architecture/` | [architecture.md](architecture/architecture.md) | Four layers, folders, request flow, security design, decisions |
| `architecture/` | [roles-and-permissions.md](architecture/roles-and-permissions.md) | The 36 permissions × 7 roles, record-level rules, menus and dashboard tiles per role |
| `architecture/` | [database.md](architecture/database.md) | Tables, ER diagram, database rules, migrations, starter data |
| `api/` | [api-reference.md](api/api-reference.md) | Every endpoint with its permission, conventions, paging, errors |
| `testing/` | [testing-guide.md](testing/testing-guide.md) | Running the backend and frontend tests, what they cover, writing new ones |
| | [project-plan.md](project-plan.md) | Requirements from Hospital_system.pdf, traceability matrix, plan |

Still to come: the final report.

**Keeping the docs current:** a pull request that adds an endpoint, a permission, a table or a screen updates the matching document in the same pull request.
