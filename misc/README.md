# 📦 Safr — Documentation, Tests & Tools (Misc)

This folder contains project-wide technical documentation, test suites, and developer tools.

---

## 📁 Directory Structure

```
misc/
├── MASTER_PROJECT_DOCUMENTATION.md   # Exhaustive 50KB+ technical architecture & engineering guide
├── information.md                    # Technical documentation, API schemas, and feature breakdown
├── tests/                            # Automated test suite (28 test files, 105 passing tests)
│   ├── travel.test.ts                # Schedule budgeting, phone validation & route tests
│   ├── services.test.ts              # External provider fallbacks & itinerary generation tests
│   ├── valhalla.test.ts              # Valhalla multi-modal routing & OSRM failover tests
│   ├── safetag-alert.test.ts         # SafeTag alert formatting, sanitization & mock mode tests
│   ├── trip-save.test.ts             # Atomic trip save & companion transaction tests
│   └── route-comparison.test.ts      # Road surface, illumination & safety score tests
├── scripts/                          # Utility & test helper scripts
│   └── register-typescript.mjs       # TypeScript import loader for native Node tests
├── .agents/                          # Supabase Postgres agent skills and custom instructions
├── skills-lock.json                  # Skill dependency lockfile
├── GEMINI.md                         # Workspace rules (Firefox preview launcher)
├── eslint.config.js                  # Linter configuration
├── .prettierrc                       # Code formatting rules
├── run.bat                           # 1-click Windows development launcher
└── LICENSE                           # MIT License
```

---

## 🧪 Running Tests

From either the project root or the `frontend` folder:

```bash
# From project root:
node --import ./misc/scripts/register-typescript.mjs --test misc/tests/*.test.ts

# Or from frontend folder:
cd frontend
npm test
```
