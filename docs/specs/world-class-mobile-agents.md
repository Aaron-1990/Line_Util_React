# World-Class Mobile Development Agents - System Implementation

**Version:** 1.0
**Created:** 2026-02-11
**Status:** Specification
**Framework:** Híbrido v2.0

---

## Executive Summary

Implementation of 9 specialized mobile development agents covering React Native, Flutter, .NET MAUI, iOS, Android, Capacitor, Firebase, Supabase, and Mobile DevOps. Each agent enforces Framework Híbrido v2.0 (BLOQUE 0, contracts-first, no workarounds).

---

## Objectives

1. ✅ Create 9 world-class mobile development agents
2. ✅ Each agent follows Framework Híbrido v2.0
3. ✅ BLOQUE 0 enforcement (official docs first, no workarounds)
4. ✅ Platform-specific validation commands
5. ✅ Comprehensive stack coverage (90%+ of mobile use cases)

---

## Mobile Agents to Implement

### 1. **react-native-developer**
- **Expertise:** React Native (Meta/Facebook stack)
- **Focus:** Cross-platform iOS/Android apps, Expo, Metro bundler
- **BLOQUE 0:** React Native official docs, Expo docs
- **Validation:** `npx react-native doctor`, `expo doctor`

### 2. **flutter-developer**
- **Expertise:** Flutter/Dart (Google stack)
- **Focus:** Cross-platform with native performance
- **BLOQUE 0:** Flutter official docs, Dart language spec
- **Validation:** `flutter doctor -v`, `flutter analyze`

### 3. **dotnet-maui-developer**
- **Expertise:** .NET MAUI (Microsoft stack)
- **Focus:** C# cross-platform, Xamarin evolution
- **BLOQUE 0:** .NET MAUI official docs, Microsoft Learn
- **Validation:** `dotnet build`, `dotnet-maui check`

### 4. **ios-developer**
- **Expertise:** Swift/SwiftUI (Apple native)
- **Focus:** iOS apps, App Store deployment
- **BLOQUE 0:** Apple Developer docs, Swift.org, HIG
- **Validation:** `xcodebuild -version`, `swiftlint`

### 5. **android-developer**
- **Expertise:** Kotlin/Jetpack Compose (Google native)
- **Focus:** Android apps, Play Store deployment
- **BLOQUE 0:** Android Developer docs, Kotlin docs
- **Validation:** `./gradlew build`, `./gradlew lint`

### 6. **capacitor-developer**
- **Expertise:** Capacitor (Ionic stack)
- **Focus:** Web-to-mobile bridge, hybrid apps
- **BLOQUE 0:** Capacitor official docs, Ionic docs
- **Validation:** `npx cap doctor`, `ionic info`

### 7. **firebase-mobile-developer**
- **Expertise:** Firebase (Google backend)
- **Focus:** Auth, Firestore, Storage, Cloud Functions
- **BLOQUE 0:** Firebase official docs, platform SDKs
- **Validation:** `firebase --version`, `firebase projects:list`

### 8. **supabase-mobile-developer**
- **Expertise:** Supabase (open-source Firebase alternative)
- **Focus:** PostgreSQL, Auth, Storage, Realtime
- **BLOQUE 0:** Supabase official docs, mobile SDKs
- **Validation:** `supabase --version`, `supabase status`

### 9. **mobile-devops-engineer**
- **Expertise:** CI/CD, App Store/Play Store deployment
- **Focus:** Fastlane, App Center, GitHub Actions
- **BLOQUE 0:** Platform deployment docs, CI/CD best practices
- **Validation:** `fastlane --version`, GitHub Actions config

---

## Framework Híbrido v2.0 Compliance

All agents MUST follow:

1. **BLOQUE 0: Investigation First**
   - Read official platform documentation
   - Define contracts/interfaces BEFORE implementation
   - Research standard APIs, NO custom workarounds

2. **Contracts-First Development**
   - Define TypeScript interfaces in `@shared/types/`
   - Create API contracts before implementation
   - Document expected inputs/outputs

3. **NO WORKAROUNDS Policy**
   - If solution requires a "trick", STOP
   - Research the official/standard approach
   - Consult platform documentation
   - Ask user if official approach is unclear

4. **Validation Commands**
   - Each agent must provide platform-specific validation
   - Run type checks, linters, doctors before completion
   - Verify builds succeed

---

## Success Criteria

- [x] All 9 agent files created in `.claude/agents/`
- [x] Each agent file follows markdown structure
- [x] Each agent enforces Framework Híbrido v2.0
- [x] BLOQUE 0 section defines investigation strategy
- [x] Platform-specific validation commands included
- [x] No workarounds policy stated explicitly

---

## Post-Implementation Testing

### Validation Commands
```bash
# List all agents
ls -la .claude/agents/

# Count mobile agents
ls .claude/agents/ | grep -E "(react-native|flutter|dotnet-maui|ios|android|capacitor|firebase|supabase|mobile-devops)" | wc -l
# Expected: 9

# Verify markdown structure
for agent in react-native-developer flutter-developer dotnet-maui-developer ios-developer android-developer capacitor-developer firebase-mobile-developer supabase-mobile-developer mobile-devops-engineer; do
  echo "Validating $agent..."
  cat .claude/agents/$agent.md
  echo "✓ $agent validated"
done
```

---

## Notes

- **Agent Format:** Markdown files (`.md`) following `electron-specialist.md` pattern
- **Framework Compliance:** ALL agents enforce Framework Híbrido v2.0
- **Validation:** Each agent has platform-specific validation commands
- **Stack Coverage:** Covers 90%+ of mobile development use cases
- **Extensibility:** Easy to add more agents (e.g., `unity-developer` for games)

---

**Designed by:** Aaron Zapata
**Framework:** Híbrido v2.0
**Status:** Ready for implementation
