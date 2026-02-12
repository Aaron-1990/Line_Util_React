#!/bin/bash

# BLOQUE 3: Agent Verification Script
# Framework Hibrido v2.0

set -e

echo "=========================================="
echo "BLOQUE 3: Agent Verification"
echo "Framework Hibrido v2.0"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

# Function to check file
check_file() {
    local file=$1
    local name=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $name exists"
        ((PASS++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} - $name missing"
        ((FAIL++))
        return 1
    fi
}

# Function to check YAML structure
check_yaml_structure() {
    local file=$1
    local name=$2

    if grep -q "^name:" "$file" && \
       grep -q "^description:" "$file" && \
       grep -q "^expertise:" "$file" && \
       grep -q "^framework_compliance:" "$file" && \
       grep -q "^principles:" "$file" && \
       grep -q "^tools:" "$file" && \
       grep -q "^validation_commands:" "$file"; then
        echo -e "${GREEN}✅ PASS${NC} - $name has valid YAML structure"
        ((PASS++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} - $name missing required YAML fields"
        ((FAIL++))
        return 1
    fi
}

# Function to check framework compliance
check_framework_compliance() {
    local file=$1
    local name=$2

    if grep -q "BLOQUE 0:" "$file" && \
       grep -q "Contracts-first:" "$file" && \
       grep -q "NO WORKAROUNDS:" "$file" && \
       grep -q "Checkpoints:" "$file"; then
        echo -e "${GREEN}✅ PASS${NC} - $name follows Framework compliance"
        ((PASS++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} - $name missing Framework compliance markers"
        ((FAIL++))
        return 1
    fi
}

echo "1️⃣  Checking Capacitor Developer Agent..."
echo "----------------------------------------"
check_file "./claude-agents/capacitor-developer.yaml" "Capacitor Developer config"
if [ -f "./claude-agents/capacitor-developer.yaml" ]; then
    check_yaml_structure "./claude-agents/capacitor-developer.yaml" "Capacitor Developer"
    check_framework_compliance "./claude-agents/capacitor-developer.yaml" "Capacitor Developer"
fi
echo ""

echo "2️⃣  Checking Firebase Mobile Developer Agent..."
echo "----------------------------------------"
check_file "./claude-agents/firebase-mobile-developer.yaml" "Firebase Developer config"
if [ -f "./claude-agents/firebase-mobile-developer.yaml" ]; then
    check_yaml_structure "./claude-agents/firebase-mobile-developer.yaml" "Firebase Developer"
    check_framework_compliance "./claude-agents/firebase-mobile-developer.yaml" "Firebase Developer"
fi
echo ""

echo "3️⃣  Checking Supabase Mobile Developer Agent..."
echo "----------------------------------------"
check_file "./claude-agents/supabase-mobile-developer.yaml" "Supabase Developer config"
if [ -f "./claude-agents/supabase-mobile-developer.yaml" ]; then
    check_yaml_structure "./claude-agents/supabase-mobile-developer.yaml" "Supabase Developer"
    check_framework_compliance "./claude-agents/supabase-mobile-developer.yaml" "Supabase Developer"
fi
echo ""

echo "4️⃣  Checking Documentation..."
echo "----------------------------------------"
check_file "./claude-agents/README.md" "README documentation"
check_file "./claude-agents/IMPLEMENTATION_SUMMARY.md" "Implementation summary"
echo ""

# Final summary
echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="
echo -e "Passed: ${GREEN}${PASS}${NC}"
echo -e "Failed: ${RED}${FAIL}${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Deploy agents: mkdir -p ~/.claude/agents && cp ./claude-agents/*.yaml ~/.claude/agents/"
    echo "2. Verify: orchestrate --list-agents | grep -E '(capacitor|firebase|supabase)'"
    echo ""
    exit 0
else
    echo -e "${RED}⚠️  SOME CHECKS FAILED${NC}"
    echo "Please review the failures above."
    echo ""
    exit 1
fi
