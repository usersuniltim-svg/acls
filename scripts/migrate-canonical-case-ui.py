from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

if 'saveUserCaseToFirestore' in text and 'deleteUserCaseFromFirestore' in text:
    raise SystemExit('Canonical case UI migration already applied.')

replacements = [
    (
        "  testFirestoreConnection,\n  syncUserProfileToFirestore,\n  syncSavedCasesToFirestore \n} from './lib/firebase';",
        "  testFirestoreConnection,\n  syncUserProfileToFirestore,\n  subscribeToUserCases,\n  saveUserCaseToFirestore,\n  deleteUserCaseFromFirestore\n} from './lib/firebase';",
        'firebase import',
    ),
    (
        "  const profileUnsubscribeRef = useRef<(() => void) | null>(null);\n",
        "  const profileUnsubscribeRef = useRef<(() => void) | null>(null);\n  const caseUnsubscribeRef = useRef<(() => void) | null>(null);\n",
        'case unsubscribe ref',
    ),
    (
        "        const profileDocRef = doc(db, 'profiles', currentUser.uid);\n",
        """        if (caseUnsubscribeRef.current) {\n          caseUnsubscribeRef.current();\n          caseUnsubscribeRef.current = null;\n        }\n        caseUnsubscribeRef.current = subscribeToUserCases(currentUser.uid, (canonicalCases) => {\n          setSavedCases(canonicalCases);\n          try {\n            localStorage.setItem('acls_saved_cases', JSON.stringify(canonicalCases));\n          } catch (e) {}\n          setSyncStatus('synced');\n          setLastSyncedAt(Date.now());\n        }, () => {\n          setSyncStatus('offline');\n        });\n\n        const profileDocRef = doc(db, 'profiles', currentUser.uid);\n""",
        'canonical case subscription',
    ),
    (
        """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n        profileUnsubscribeRef.current = null;\n      }\n      setUser(currentUser);""",
        """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n        profileUnsubscribeRef.current = null;\n      }\n      if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n        caseUnsubscribeRef.current = null;\n      }\n      setUser(currentUser);""",
        'auth cleanup',
    ),
    (
        """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n      }\n    };""",
        """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n      }\n      if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n      }\n    };""",
        'unmount cleanup',
    ),
    (
        """      if (user?.uid) {\n        await syncSavedCasesToFirestore(user.uid, savedCases);\n        if (profile) {\n          await syncUserProfileToFirestore(user.uid, profile);\n        }\n      }""",
        """      if (user?.uid && profile) {\n        await syncUserProfileToFirestore(user.uid, profile);\n      }""",
        'force sync',
    ),
    (
        "  }, [user, profile, savedCases]);",
        "  }, [user, profile]);",
        'online dependency',
    ),
    (
        """    const updated = [newCase, ...savedCases];\n    setSavedCases(updated);\n\n    try {\n      localStorage.setItem('acls_saved_cases', JSON.stringify(updated));\n    } catch (e) {}\n\n    if (user?.uid) {\n      setSyncStatus('syncing');\n      syncSavedCasesToFirestore(user.uid, updated)\n        .then((ok) => {\n          if (ok) {\n            setSyncStatus('synced');\n            setLastSyncedAt(Date.now());\n          } else {\n            setSyncStatus('offline');\n          }\n        })\n        .catch(() => setSyncStatus('offline'));\n    }\n\n    return true;""",
        """    const updated = [newCase, ...savedCases];\n    setSavedCases(updated);\n\n    try {\n      localStorage.setItem('acls_saved_cases', JSON.stringify(updated));\n    } catch (e) {}\n\n    if (user?.uid) {\n      setSyncStatus('syncing');\n      saveUserCaseToFirestore(user.uid, newCase)\n        .then((ok) => {\n          if (ok) {\n            setSyncStatus('synced');\n            setLastSyncedAt(Date.now());\n          } else {\n            setSyncStatus('offline');\n          }\n        })\n        .catch(() => setSyncStatus('offline'));\n    }\n\n    return true;""",
        'save case',
    ),
    (
        """    if (user?.uid) {\n      setSyncStatus('syncing');\n      syncSavedCasesToFirestore(user.uid, updated)\n        .then((ok) => {\n          if (ok) {\n            setSyncStatus('synced');\n            setLastSyncedAt(Date.now());\n          } else {\n            setSyncStatus('offline');\n          }\n        })\n        .catch(() => setSyncStatus('offline'));\n    }\n  };""",
        """    if (user?.uid) {\n      setSyncStatus('syncing');\n      deleteUserCaseFromFirestore(user.uid, caseId)\n        .then((ok) => {\n          if (ok) {\n            setSyncStatus('synced');\n            setLastSyncedAt(Date.now());\n          } else {\n            setSyncStatus('offline');\n          }\n        })\n        .catch(() => setSyncStatus('offline'));\n    }\n  };""",
        'delete case',
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f'Could not find {label}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Canonical case UI migration applied.')
