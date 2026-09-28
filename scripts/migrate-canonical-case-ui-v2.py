from pathlib import Path
import re

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

if 'saveUserCaseToFirestore' in text and 'deleteUserCaseFromFirestore' in text and 'caseUnsubscribeRef' in text:
    raise SystemExit('Canonical case UI migration already applied.')

# Firebase imports: remove the legacy bulk case writer and add canonical operations.
text, n = re.subn(r'\n\s*syncSavedCasesToFirestore\s*', '\n', text, count=1)
if n == 0:
    print('Legacy bulk import already absent.')

anchor = "  syncUserProfileToFirestore,\n"
if 'saveUserCaseToFirestore' not in text:
    if anchor not in text:
        raise SystemExit('Could not locate Firebase import anchor')
    text = text.replace(anchor, anchor + "  subscribeToUserCases,\n  saveUserCaseToFirestore,\n  deleteUserCaseFromFirestore,\n", 1)

# Add a dedicated subscription ref.
if 'caseUnsubscribeRef' not in text:
    ref_pattern = r'(const profileUnsubscribeRef = useRef<\(\(\) => void\) \| null>\(null\);\n)'
    text, n = re.subn(ref_pattern, r'\1  const caseUnsubscribeRef = useRef<(() => void) | null>(null);\n', text, count=1)
    if n == 0:
        raise SystemExit('Could not locate profile unsubscribe ref')

# Subscribe to canonical cases as soon as an authenticated user is known.
if 'caseUnsubscribeRef.current = subscribeToUserCases' not in text:
    anchor = "        const profileDocRef = doc(db, 'profiles', currentUser.uid);"
    subscription = """        if (caseUnsubscribeRef.current) {\n          caseUnsubscribeRef.current();\n          caseUnsubscribeRef.current = null;\n        }\n        caseUnsubscribeRef.current = subscribeToUserCases(currentUser.uid, (canonicalCases) => {\n          setSavedCases(canonicalCases);\n          try {\n            localStorage.setItem('acls_saved_cases', JSON.stringify(canonicalCases));\n          } catch (e) {}\n          setSyncStatus('synced');\n          setLastSyncedAt(Date.now());\n        }, () => {\n          setSyncStatus('offline');\n        });\n\n"""
    if anchor not in text:
        raise SystemExit('Could not locate profile document anchor')
    text = text.replace(anchor, subscription + anchor, 1)

# Clean up canonical subscription whenever auth changes or the effect unmounts.
cleanup_anchor = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n        profileUnsubscribeRef.current = null;\n      }\n      setUser(currentUser);"""
cleanup_replacement = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n        profileUnsubscribeRef.current = null;\n      }\n      if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n        caseUnsubscribeRef.current = null;\n      }\n      setUser(currentUser);"""
if cleanup_anchor in text and 'caseUnsubscribeRef.current();\n        caseUnsubscribeRef.current = null;' not in text:
    text = text.replace(cleanup_anchor, cleanup_replacement, 1)

unmount_anchor = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n      }\n    };"""
unmount_replacement = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n      }\n      if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n      }\n    };"""
if unmount_anchor in text and 'if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n      }' not in text:
    text = text.replace(unmount_anchor, unmount_replacement, 1)

# Force sync must not reconcile the whole case list from potentially stale React state.
text = text.replace('await syncSavedCasesToFirestore(user.uid, savedCases);\n', '', 1)

# Save/delete become individual canonical writes. The first occurrence is the save path.
save_call = 'syncSavedCasesToFirestore(user.uid, updated)'
if save_call in text:
    text = text.replace(save_call, 'saveUserCaseToFirestore(user.uid, newCase)', 1)

# The remaining occurrence is the delete path.
delete_call = 'syncSavedCasesToFirestore(user.uid, updated)'
if delete_call in text:
    text = text.replace(delete_call, 'deleteUserCaseFromFirestore(user.uid, caseId)', 1)

# Avoid re-registering the online handler every time the case list changes.
text = text.replace('}, [user, profile, savedCases]);', '}, [user, profile]);', 1)

path.write_text(text, encoding='utf-8')
print('Canonical case UI migration v2 applied.')
