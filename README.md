# Keto Pro App (Expo)

This project is the Expo reimplementation of the Keto Pro web experience. It reuses the original 14-day keto plan, localized tips and workouts, and adds native mobile features such as offline persistence and AI-assisted meal/workout generation.

## Getting started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the app**
   ```bash
   npx expo start
   ```
3. **Configure the AI endpoint**
   * By default the app calls `/.netlify/functions/grok` using the proxy from the web version.
   * Override the base URL or timeout via environment variables before starting Expo:
     ```bash
     export EXPO_PUBLIC_API_URL="https://your-api.example.com"
     export EXPO_PUBLIC_API_TIMEOUT=45000
     ```

## Project structure

```
src/
├── api/                # API clients (AI service + configuration)
├── components/         # UI components (shared, meals, workout, progress)
├── context/            # Global contexts (app state, theme)
├── data/               # Static data ported from the web version
├── navigation/         # Stack & tab navigators
├── screens/            # Auth, main tabs and modal screens
├── storage/            # AsyncStorage helpers + key constants
├── theme/              # Color, spacing and typography tokens
└── utils/              # Calculations & validation helpers
```

The reference structure mirrors the `AppStructure.txt` file. All missing modules listed there are now implemented.

## AI credentials

Enter your Grok credentials inside the settings screen. They are stored securely in `AsyncStorage` using the same key prefix as the web app and reused for:

* Meal and full-day generation (`MealGeneratorModal`).
* Workout generation (`WorkoutModal` and `WorkoutScreen`).
* Day reviews and shopping list helpers (future work).

## Data parity with the web app

* Base plan (`data/basePlan.js`), localized tips (`data/tips.js`) and weekly workouts (`data/workouts.js`) mirror the original `web_version/script.js` definitions.
* Storage keys are centralized in `storage/constants.js` so both the context and feature modules use the same prefixes.

## Testing

Run the usual Expo commands (`expo start`, `expo android`, `expo ios`) to verify the UI. No automated tests are included yet; rely on manual smoke tests for now.
