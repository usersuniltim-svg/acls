#!/bin/bash
git checkout -b fix-mobile-dashboard-active-tab-type
git add src/components/MobileDashboard.tsx
git commit -m "🧹 code health: Use specific literal types for setActiveTab" -m "🎯 What: Replaced 'any' with specific literal types ('timer' | 'interventions' | 'algorithm' | 'logs' | 'settings') for the 'tab' parameter in setActiveTab inside MobileDashboardProps.
💡 Why: Improves type safety and consistency across the component, ensuring only valid tabs are passed.
✅ Verification: Ran 'npm run lint' successfully and ensured the code compiles.
✨ Result: Enhanced code robustness without altering existing application behavior."
