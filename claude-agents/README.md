# BLOQUE 3: Hybrid & Specialized Agents

This directory contains the implementation of BLOQUE 3 from Framework Hibrido v2.0.

## 📁 Agent Configurations

### 3.1 Capacitor Developer (Elite)
**File:** `capacitor-developer.yaml`

World-class Capacitor expert specializing in:
- Web-to-native bridging with Capacitor 5+
- Official and community Capacitor plugins
- Native plugin development (Swift, Kotlin)
- PWA to native app conversion
- Performance optimization (<100ms bridge calls)
- Security (CSP, certificate pinning, secure storage)
- Accessibility (WCAG 2.1, platform screen readers)

**Validation Commands:**
```bash
npm run type-check
npm run build
npx cap sync
npx cap doctor
```

---

### 3.2 Firebase Mobile Developer (Elite)
**File:** `firebase-mobile-developer.yaml`

World-class Firebase expert specializing in:
- Firebase SDK (iOS, Android, Web, React Native, Flutter)
- Authentication (Email/Password, OAuth, Custom tokens)
- Firestore (data modeling, security rules, offline persistence)
- Cloud Functions (TypeScript, Python)
- Cloud Messaging (FCM, push notifications)
- Security (Security Rules, App Check)
- Emulator suite for local development

**Validation Commands:**
```bash
firebase emulators:start
firebase deploy --only functions
npm test
```

---

### 3.3 Supabase Mobile Developer (Elite)
**File:** `supabase-mobile-developer.yaml`

World-class Supabase expert specializing in:
- Supabase SDK (JavaScript, Dart, Swift, Kotlin)
- PostgreSQL (schema design, RLS policies, triggers)
- Authentication (Email/Password, OAuth, Magic Links)
- Realtime subscriptions (Postgres Changes, Broadcast, Presence)
- Edge Functions (Deno, TypeScript)
- Security (Row Level Security, API key management)

**Validation Commands:**
```bash
supabase db lint
supabase test db
supabase functions serve
supabase gen types typescript --local
```

---

## 🚀 Deployment Instructions

### Option 1: System-wide Installation (Recommended)

Move the agent files to the Claude configuration directory:

```bash
# Create the agents directory if it doesn't exist
mkdir -p ~/.claude/agents

# Copy agent configurations
cp ./claude-agents/*.yaml ~/.claude/agents/

# Verify installation
ls -la ~/.claude/agents/
```

### Option 2: Project-local Installation

Keep the agents in the project directory and configure your orchestration tool to use this path.

---

## ✅ Verification

After deployment, verify the agents are available:

```bash
# List all available agents
orchestrate --list-agents | grep -E "(capacitor|firebase|supabase)-"

# Should show:
# - capacitor-developer
# - firebase-mobile-developer
# - supabase-mobile-developer
```

---

## 🏗️ Framework Compliance

All agents follow Framework Hibrido v2.0 principles:

1. **BLOQUE 0 Compliance:** Read official documentation before implementation
2. **Contracts-first:** Define interfaces/schemas before coding
3. **NO WORKAROUNDS:** Use official APIs and SDKs only
4. **Checkpoints:** Run validation commands after changes

---

## 📚 Usage Examples

### Capacitor Developer
```bash
orchestrate capacitor-developer "Add camera plugin with image compression"
```

### Firebase Mobile Developer
```bash
orchestrate firebase-mobile-developer "Implement user authentication with email/password"
```

### Supabase Mobile Developer
```bash
orchestrate supabase-mobile-developer "Create RLS policies for user profiles table"
```

---

## 🔒 Security Best Practices

Each agent enforces platform-specific security:

- **Capacitor:** CSP headers, certificate pinning, secure storage
- **Firebase:** Security Rules, server-side validation, App Check
- **Supabase:** Row Level Security (RLS), Edge Function validation

---

## 📊 Success Criteria

- ✅ All three agent configurations created
- ✅ Valid YAML syntax
- ✅ Framework compliance documented
- ✅ Validation commands specified
- ✅ Deployment instructions provided

---

**Implementation Date:** 2026-02-11
**Framework Version:** Hibrido v2.0
**BLOQUE:** 3 - Hybrid & Specialized Agents
