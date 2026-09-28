from pathlib import Path
import re

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

# Import canonical case operations and remove the legacy bulk writer import.
if 'saveUserCaseToFirestore' not in text:
    text = re.sub(r'\n\s*syncSavedCasesToFirestore\s*', '\n', text, count=1)
    text = text.replace(
        "  syncUserProfileToFirestore,\n",
        "  syncUserProfileToFirestore,\n  subscribeToUserCases,\n  saveUserCaseToFirestore,\n  deleteUserCaseFromFirestore,\n",
        1,
    )

# Dedicated subscription ref.
if 'caseUnsubscribeRef' not in text:
    text = text.replace(
        "  const profileUnsubscribeRef = useRef<(() => void) | null>(null);\n",
        "  const profileUnsubscribeRef = useRef<(() => void) | null>(null);\n  const caseUnsubscribeRef = useRef<(() => void) | null>(null);\n",
        1,
    )

# Live canonical case subscription.
if 'caseUnsubscribeRef.current = subscribeToUserCases' not in text:
    anchor = "        const profileDocRef = doc(db, 'profiles', currentUser.uid);"
    subscription = """        if (caseUnsubscribeRef.current) {\n          caseUnsubscribeRef.current();\n          caseUnsubscribeRef.current = null;\n        }\n        caseUnsubscribeRef.current = subscribeToUserCases(currentUser.uid, (canonicalCases) => {\n          setSavedCases(canonicalCases);\n          try {\n            localStorage.setItem('acls_saved_cases', JSON.stringify(canonicalCases));\n          } catch (e) {}\n          setSyncStatus('synced');\n          setLastSyncedAt(Date.now());\n        }, () => {\n          setSyncStatus('offline');\n        });\n\n"""
    text = text.replace(anchor, subscription + anchor, 1)

# Auth-change cleanup.
cleanup_anchor = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n        profileUnsubscribeRef.current = null;\n      }\n      setUser(currentUser);"""
cleanup_replacement = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n        profileUnsubscribeRef.current = null;\n      }\n      if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n        caseUnsubscribeRef.current = null;\n      }\n      setUser(currentUser);"""
text = text.replace(cleanup_anchor, cleanup_replacement, 1)

# Effect cleanup.
unmount_anchor = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n      }\n    };"""
unmount_replacement = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n      }\n      if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n      }\n    };"""
text = text.replace(unmount_anchor, unmount_replacement, 1)

# Never reconcile/delete the entire cloud case collection from stale React state.
text = text.replace('await syncSavedCasesToFirestore(user.uid, savedCases);\n', '', 1)
text = text.replace('syncSavedCasesToFirestore(user.uid, updated)', 'saveUserCaseToFirestore(user.uid, newCase)', 1)
text = text.replace('syncSavedCasesToFirestore(user.uid, updated)', 'deleteUserCaseFromFirestore(user.uid, caseId)', 1)
text = text.replace('}, [user, profile, savedCases]);', '}, [user, profile]);', 1)

path.write_text(text, encoding='utf-8')
print('Canonical case UI migration attempted; source written.')
