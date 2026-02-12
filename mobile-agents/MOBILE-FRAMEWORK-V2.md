# Mobile Development Framework - Híbrido v2.0

> **Version:** 2.0 | **Last Updated:** 2026-02-11 | **Framework Type:** Mobile Development

---

## FRAMEWORK PRINCIPLES (MANDATORY)

### BLOQUE 0: Documentation-First Research
**Before ANY implementation, agents MUST:**
1. **Investigate official documentation** (React Native docs, Flutter.dev, Apple HIG, Material Design)
2. **Define contracts** (TypeScript interfaces, Dart classes, Swift protocols)
3. **Identify standard APIs** (no workarounds, no hacks)
4. **Document validation commands** (type-check, lint, build)

### Core Principles
1. **CONTRACTS-FIRST**: Define types/interfaces/protocols BEFORE implementation
2. **NO WORKAROUNDS**: If solution requires a "trick", STOP and find the standard way
3. **PLATFORM GUIDELINES**: Follow HIG (iOS), Material Design (Android), platform conventions
4. **SECURITY-FIRST**: Secure storage, certificate pinning, biometric auth, OWASP Mobile Top 10
5. **PERFORMANCE-FIRST**: 60fps animations, lazy loading, memory management, bundle optimization
6. **ACCESSIBILITY-FIRST**: WCAG 2.1 Level AA, screen readers, platform accessibility APIs
7. **OFFLINE-FIRST**: Local data persistence, sync strategies, conflict resolution

---

## AGENT ORCHESTRATION

### Mobile Development Agents

| Agent | Domain | BLOQUE 0 Focus | Validation |
|-------|--------|----------------|------------|
| `react-native-developer` | React Native (bare workflow) | React Native docs, Metro bundler | `npx tsc`, `npm run lint`, `npm run build` |
| `expo-developer` | Expo SDK (managed workflow) | Expo docs, EAS Build | `expo doctor`, `npx tsc`, `eas build` |
| `flutter-developer` | Flutter/Dart cross-platform | Flutter.dev, Dart docs | `flutter analyze`, `flutter build` |
| `swift-ios-developer` | Native iOS (Swift/SwiftUI) | Apple HIG, Swift docs | `xcodebuild`, `swiftlint` |
| `kotlin-android-developer` | Native Android (Kotlin/Jetpack) | Material Design, Android docs | `./gradlew build`, `ktlint` |
| `dotnet-maui-developer` | .NET MAUI (C#) | Microsoft docs, MAUI docs | `dotnet build`, `dotnet test` |
| `capacitor-developer` | Capacitor hybrid apps | Capacitor docs, Ionic docs | `npm run build`, `cap sync` |
| `firebase-backend-specialist` | Firebase BaaS | Firebase docs | `firebase deploy --only functions` |
| `supabase-backend-specialist` | Supabase BaaS | Supabase docs | `supabase db push`, `supabase test` |
| `mobile-code-reviewer` | Quality assurance | Platform guidelines, security | Detect workarounds, validate compliance |
| `mobile-test-engineer` | Testing (unit, integration, E2E) | Testing frameworks | `jest`, `detox`, `maestro` |
| `mobile-ux-designer` | UX/UI for mobile | HIG, Material Design | Figma prototypes, accessibility audit |

### Agent Protocol
1. **BLOQUE 0**: Investigate official docs, define contracts
2. **Propose**: Solution based on standard APIs (no workarounds)
3. **Implement**: With checkpoints after each feature
4. **Review**: `mobile-code-reviewer` validates compliance
5. **Test**: `mobile-test-engineer` verifies functionality

**Parallel Execution Example:**
```
User: "Add biometric auth to React Native app"

Invoke in parallel:
- react-native-developer (UI integration)
- firebase-backend-specialist (token validation)

Then sequentially:
- mobile-code-reviewer (security audit)
- mobile-test-engineer (E2E tests)
```

---

## ARCHITECTURE DECISIONS

### Stack Selection Rationale

| Stack | Market Share | Use When | Avoid When |
|-------|--------------|----------|------------|
| **React Native** | ~42% cross-platform | JS/TS team, fast iteration, large ecosystem | Performance-critical games, heavy native APIs |
| **Expo** | Subset of RN | Rapid prototyping, OTA updates, managed workflow | Need custom native modules, specific RN versions |
| **Flutter** | ~39% cross-platform | Beautiful UI, high performance, single codebase | Web-first apps, small team learning curve |
| **Swift/iOS Native** | 100% iOS native | Performance-critical iOS apps, platform-specific features | Cross-platform needed, limited resources |
| **Kotlin/Android Native** | 100% Android native | Performance-critical Android apps, Material You | Cross-platform needed, limited resources |
| **.NET MAUI** | ~8% cross-platform | Enterprise C# shops, Xamarin migration | No C# expertise, startup projects |
| **Capacitor** | ~6% hybrid | Existing web app, web skills leverage | Native performance needed |
| **Firebase** | De facto BaaS | Rapid backend setup, real-time features, Google ecosystem | Complex backend logic, multi-cloud |
| **Supabase** | Open-source BaaS | Postgres preference, open-source priority, EU data residency | Firestore preference, Google ecosystem |

### Trade-offs (What We Excluded)
- **Ionic**: Declining market share, overlaps with Capacitor
- **Cordova**: Legacy technology, replaced by Capacitor
- **NativeScript**: Niche market (~2%), small ecosystem
- **Xamarin**: Deprecated, replaced by .NET MAUI

---

## TECHNOLOGY STACK STANDARDS

### React Native Stack (Bare Workflow)
```typescript
// Package versions (as of 2026)
"react-native": "^0.74.0",
"typescript": "^5.4.0",
"@react-navigation/native": "^6.1.0",
"react-native-reanimated": "^3.10.0",
"zustand": "^4.5.0" // or Redux Toolkit

// State management: Zustand (simple) or Redux Toolkit (complex)
// Navigation: React Navigation v6
// Animations: Reanimated 3
// Storage: react-native-mmkv (fast), @react-native-async-storage/async-storage (simple)
```

### Expo Stack (Managed Workflow)
```typescript
// Expo SDK 51+ (2026)
"expo": "~51.0.0",
"expo-router": "~3.5.0", // File-based routing
"expo-secure-store": "~13.0.0",
"expo-local-authentication": "~14.0.0"

// Always use Expo SDK modules when available (more reliable than community modules)
// Use EAS Build for native builds, EAS Update for OTA
```

### Flutter Stack
```yaml
# pubspec.yaml (Flutter 3.22+)
dependencies:
  flutter: sdk: flutter
  provider: ^6.1.0 # or Riverpod, BLoC
  go_router: ^14.0.0
  dio: ^5.4.0 # HTTP client
  freezed: ^2.5.0 # Immutable models
  hive: ^2.2.0 # Fast local storage

# State management: Provider (simple), Riverpod (advanced), BLoC (enterprise)
# Code generation: freezed + json_serializable
```

### iOS Native Stack (Swift)
```swift
// Swift 5.10+, iOS 17+ deployment target
// UI: SwiftUI (preferred) or UIKit (legacy)
// Async: async/await, Combine
// Storage: CoreData (complex), SwiftData (simple), Realm (cross-platform)
// Networking: URLSession + Codable
```

### Android Native Stack (Kotlin)
```kotlin
// Kotlin 1.9+, minSdk 24 (Android 7.0)
// UI: Jetpack Compose (modern) or XML (legacy)
// Architecture: MVVM + Repository pattern
// DI: Hilt (recommended) or Koin
// Storage: Room (SQLite), DataStore (preferences)
// Networking: Retrofit + OkHttp + kotlinx.serialization
```

### .NET MAUI Stack (C#)
```xml
<!-- .NET 8+, MAUI 8.0+ -->
<PackageReference Include="CommunityToolkit.Mvvm" Version="8.2.0" />
<PackageReference Include="CommunityToolkit.Maui" Version="7.0.0" />

<!-- Architecture: MVVM with CommunityToolkit.Mvvm -->
<!-- Storage: SQLite-net-pcl, SecureStorage API -->
```

---

## SECURITY STANDARDS (MANDATORY)

All mobile agents MUST follow OWASP Mobile Top 10:

### 1. Secure Storage
- **iOS**: Keychain Services (never UserDefaults for secrets)
- **Android**: EncryptedSharedPreferences, Keystore
- **React Native**: react-native-keychain, expo-secure-store
- **Flutter**: flutter_secure_storage

### 2. Certificate Pinning
```typescript
// React Native example
import RNPinning from 'react-native-ssl-pinning';

RNPinning.fetch('https://api.example.com', {
  method: 'GET',
  sslPinning: {
    certs: ['sha256/AAAAAAAAAA...'] // SHA-256 of certificate
  }
});
```

### 3. Biometric Authentication
- **Must** fall back to device passcode
- **Must** validate on backend (biometrics are UI-only)
- **Must** use platform APIs (no third-party wrappers)

### 4. Code Obfuscation
- **iOS**: Built-in (bitcode)
- **Android**: ProGuard/R8 (MANDATORY for production)
- **React Native**: Hermes bytecode + ProGuard
- **Flutter**: --obfuscate --split-debug-info

### 5. Secure Communication
- **TLS 1.3** minimum
- **Certificate validation** enabled (never disable for "testing")
- **API keys** in environment variables, NOT hardcoded

---

## PERFORMANCE STANDARDS (MANDATORY)

### Frame Rate
- **60fps** for all animations (16.67ms per frame)
- **120fps** on ProMotion displays (8.33ms per frame)
- Use `Reanimated` (RN), `Animated` API carefully

### Bundle Size
- **React Native**: < 20MB (Android APK), < 30MB (iOS IPA)
- **Flutter**: < 15MB (release build with --split-debug-info)
- **Use code splitting**, lazy loading, dynamic imports

### Memory Management
- **Profile with**: Xcode Instruments (iOS), Android Profiler, React DevTools Profiler
- **Avoid**: Memory leaks (listeners, timers), retain cycles (closures)
- **Use**: Virtualized lists (FlatList, LazyColumn, ListView.builder)

### Startup Time
- **Cold start**: < 3 seconds (Android), < 2 seconds (iOS)
- **Techniques**: Splash screen, lazy initialization, preload critical data

---

## ACCESSIBILITY STANDARDS (MANDATORY)

### WCAG 2.1 Level AA Compliance
1. **Touch targets**: Minimum 44x44 points (iOS), 48x48 dp (Android)
2. **Color contrast**: 4.5:1 (normal text), 3:1 (large text)
3. **Screen reader support**:
   - iOS: VoiceOver
   - Android: TalkBack
   - Labels, hints, roles for ALL interactive elements

### Platform APIs
```typescript
// React Native
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Submit form"
  accessibilityHint="Double tap to submit"
  accessibilityRole="button"
>

// Flutter
Semantics(
  label: 'Submit form',
  hint: 'Double tap to submit',
  button: true,
  child: ElevatedButton(...)
)
```

---

## TESTING STANDARDS (MANDATORY)

### Test Pyramid
1. **Unit Tests** (70%): Business logic, utilities, state management
2. **Integration Tests** (20%): API calls, database, services
3. **E2E Tests** (10%): Critical user flows

### Testing Frameworks

| Platform | Unit | Integration | E2E |
|----------|------|-------------|-----|
| React Native | Jest + React Native Testing Library | Jest | Detox, Maestro |
| Expo | Jest + React Native Testing Library | Jest | Maestro |
| Flutter | flutter_test | flutter_test + mockito | integration_test, Patrol |
| iOS Native | XCTest | XCTest | XCUITest |
| Android Native | JUnit + Mockito | Espresso | Espresso, UI Automator |

### Coverage Requirements
- **Minimum**: 80% code coverage (unit + integration)
- **Critical paths**: 100% E2E coverage (login, checkout, payment)

---

## VALIDATION CHECKPOINTS

Each agent MUST run these checkpoints after implementation:

### React Native / Expo
```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint
# or: npx eslint . --ext .ts,.tsx

# Tests
npm test

# Build validation
npm run build # React Native
expo doctor && eas build --platform ios --profile preview # Expo
```

### Flutter
```bash
# Analysis
flutter analyze

# Type safety
dart analyze

# Tests
flutter test

# Build validation
flutter build apk --release
flutter build ios --release
```

### iOS Native
```bash
# Build
xcodebuild -workspace YourApp.xcworkspace -scheme YourApp -sdk iphoneos

# Lint
swiftlint

# Tests
xcodebuild test -workspace YourApp.xcworkspace -scheme YourApp -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Android Native
```bash
# Build
./gradlew assembleRelease

# Lint
./gradlew ktlintCheck

# Tests
./gradlew testDebugUnitTest
./gradlew connectedAndroidTest
```

### .NET MAUI
```bash
# Build
dotnet build -c Release

# Tests
dotnet test

# Lint (requires StyleCop)
dotnet format --verify-no-changes
```

---

## COMMON ANTI-PATTERNS (FORBIDDEN)

### ❌ DO NOT
1. **Disable SSL validation** (`trustAllCerts`, `allowUnsafeSSL`)
2. **Store secrets in code** (API keys, tokens in source)
3. **Use `var` in TypeScript** (use proper types)
4. **Ignore memory warnings** (profile and fix)
5. **Skip accessibility** (not optional)
6. **Use `any` type** (defeats TypeScript purpose)
7. **Hardcode colors/strings** (use theme, i18n)
8. **Block main thread** (use async, workers)
9. **Skip error handling** (every API call can fail)
10. **Use deprecated APIs** (check platform docs)

### ✅ DO
1. **Use official SDKs** (platform-provided modules)
2. **Follow platform guidelines** (HIG, Material Design)
3. **Test on real devices** (simulators miss issues)
4. **Profile performance** (before and after changes)
5. **Audit dependencies** (`npm audit`, `flutter pub outdated`)
6. **Version lock critical deps** (exact versions in production)
7. **Document complex logic** (why, not what)
8. **Use TypeScript strict mode** (`"strict": true`)
9. **Implement error boundaries** (graceful failures)
10. **Log crashes** (Sentry, Firebase Crashlytics)

---

## VERSION TRACKING

| Component | Version | Last Updated |
|-----------|---------|--------------|
| Framework | 2.0 | 2026-02-11 |
| React Native | 0.74+ | 2026 |
| Expo SDK | 51+ | 2026 |
| Flutter | 3.22+ | 2026 |
| iOS Deployment Target | 17.0+ | 2026 |
| Android minSdk | 24 (Android 7.0) | 2026 |
| .NET MAUI | 8.0+ | 2026 |

---

**End of Mobile Development Framework v2.0**
