# 🎨 Safr — Frontend Web Application

This folder contains the complete client-side user interface, React components, and routing system for **Safr**.

---

## 📁 Directory Structure

```
frontend/
├── src/                           # Application source code
│   ├── components/                # React 19 UI components (GoogleTranslate, NearbyPlaces, AppShell)
│   ├── routes/                    # TanStack file-based routes (/map, /dashboard, /explore, etc.)
│   ├── lib/                       # Client utilities (geo, itinerary, phone validation)
│   └── styles.css                 # TailwindCSS v4 design system
├── public/                        # Static assets (logos, icons, illustrations)
├── components.json                # Radix UI / shadcn component configuration
├── package.json                   # Dependencies, scripts, and build tasks
├── tsconfig.json                  # TypeScript strict compiler configuration
├── vite.config.ts                 # Vite & TanStack Start build configuration
└── .env                           # Environment configuration
```

---

## 🚀 Running the Frontend

```bash
# Navigate to the frontend directory
cd frontend

# Start the local development server (live on http://localhost:5173)
npm run dev

# Run automated tests
npm test

# Build production bundle
npm run build
```
