from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

if 'subscribeToUserCases' in text and 'saveUserCaseToFirestore' in text and 'deleteUserCaseFromFirestore' in text:
    raise SystemExit('Canonical case UI migration already applied.')

old_import = """  testFirestoreConnection,\n  syncUserProfileToFirestore,\n  syncSavedCasesToFirestore \n} from './lib/firebase';"""
new_import = """  testFirestoreConnection,\n  syncUserProfileToFirestore,\n  subscribeToUserCases,\n  saveUserCaseToFirestore,\n  deleteUserCaseFromFirestore\n} from './lib/firebase';"""
if old_import not in text:
    raise SystemExit('Firebase import block not found')
text = text.replace(old_import, new_import, 1)

old_ref = "  const profileUnsubscribeRef = useRef<(() => void) | null>(null);\n"
new_ref = old_ref + "  const caseUnsubscribeRef = useRef<(() => void) | null>(null);\n"
if old_ref not in text:
    raise SystemExit('Profile unsubscribe ref not found')
text = text.replace(old_ref, new_ref, 1)

old_profile_cases = """            try {\n              localStorage.setItem('acls_user_profile', JSON.stringify(pData));\n              const map = new Map<string, SavedCase>();\n              if (Array.isArray(pData.savedCases)) {\n                pData.savedCases.forEach((c: SavedCase) => map.set(c.id, c));\n              }\n              const cachedCases = Array.from(map.values());\n              setSavedCases(cachedCases);\n              try {\n                localStorage.setItem('acls_saved_cases', JSON.stringify(cachedCases));\n              } catch (e) {}\n            } catch (e) {}\n            setSyncStatus('synced');"""
new_profile_cases = """            try {\n              localStorage.setItem('acls_user_profile', JSON.stringify(pData));\n              // Legacy profile.savedCases is migration input only. The live UI\n              // is driven by users/{uid}/cases through subscribeToUserCases().\n              if (Array.isArray(pData.savedCases) && pData.savedCases.length > 0) {\n                setSavedCases(prev => prev.length > 0 ? prev : pData.savedCases);\n              }\n            } catch (e) {}\n            setSyncStatus('synced');"""
if old_profile_cases not in text:
    raise SystemExit('Profile case cache block not found')
text = text.replace(old_profile_cases, new_profile_cases, 1)

anchor = """            setLoading(false);\n          } else {"""
subscription = """            if (Array.isArray(pData.savedCases) && pData.savedCases.length > 0) {\n              // One-time compatibility migration. Existing canonical records are\n              // merged safely by the repository without deleting other cases.\n              import('./lib/firebase').then(({ migrateLegacySavedCasesToFirestore }) => {\n                migrateLegacySavedCasesToFirestore(currentUser.uid, pData.savedCases).catch(() => {});\n              });\n            }\n            setLoading(false);\n          } else {"""
if anchor not in text:
    raise SystemExit('Profile loading anchor not found')
text = text.replace(anchor, subscription, 1)

# Insert canonical case subscription immediately after the profile listener setup block.
marker = """        profileUnsubscribeRef.current = onSnapshot(profileDocRef, (docSnap) => {"""
if marker not in text:
    raise SystemExit('Profile snapshot marker not found')
# Add a separate effect-like subscription just before the profile document reference.
case_sub = """        if (caseUnsubscribeRef.current) {\n          caseUnsubscribeRef.current();\n          caseUnsubscribeRef.current = null;\n        }\n        caseUnsubscribeRef.current = subscribeToUserCases(currentUser.uid, (canonicalCases) => {\n          setSavedCases(canonicalCases);\n          try {\n            localStorage.setItem('acls_saved_cases', JSON.stringify(canonicalCases));\n          } catch (e) {}\n          setSyncStatus('synced');\n          setLastSyncedAt(Date.now());\n        }, () => {\n          setSyncStatus('offline');\n        });\n\n"""
text = text.replace("        const profileDocRef = doc(db, 'profiles', currentUser.uid);\n", case_sub + "        const profileDocRef = doc(db, 'profiles', currentUser.uid);\n", 1)

# Cleanup case subscription on auth changes/unmount.
old_cleanup = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n        profileUnsubscribeRef.current = null;\n      }\n      setUser(currentUser);"""
new_cleanup = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n        profileUnsubscribeRef.current = null;\n      }\n      if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n        caseUnsubscribeRef.current = null;\n      }\n      setUser(currentUser);"""
if old_cleanup not in text:
    raise SystemExit('Auth cleanup block not found')
text = text.replace(old_cleanup, new_cleanup, 1)

old_unmount = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n      }\n    };"""
new_unmount = """      if (profileUnsubscribeRef.current) {\n        profileUnsubscribeRef.current();\n      }\n      if (caseUnsubscribeRef.current) {\n        caseUnsubscribeRef.current();\n      }\n    };"""
if old_unmount not in text:
    raise SystemExit('Auth unmount cleanup block not found')
text = text.replace(old_unmount, new_unmount, 1)

old_force = """      if (user?.uid) {\n        await syncSavedCasesToFirestore(user.uid, savedCases);\n        if (profile) {\n          await syncUserProfileToFirestore(user.uid, profile);\n        }\n      }"""
new_force = """      if (user?.uid && profile) {\n        // Case records are synchronized individually and observed through the\n        // canonical case subscription. Force sync only refreshes profile data.\n        await syncUserProfileToFirestore(user.uid, profile);\n      }"""
if old_force not in text:
    raise SystemExit('Force sync block not found')
text = text.replace(old_force, new_force, 1)

old_online_deps = """  }, [user, profile, savedCases]);"""
new_online_deps = """  }, [user, profile]);"""
if old_online_deps not in text:
    raise SystemExit('Online sync dependency block not found')
text = text.replace(old_online_deps, new_online_deps, 1)

old_save = """    const updated = [newCase, ...savedCases];\n    setSavedCases(updated);\n\n    try {\n      localStorage.setItem('acls_saved_cases', JSON.stringify(updated));\n    } catch (e) {}\n\n    if (user?.uid) {\n      setSyncStatus('syncing');\n      syncSavedCasesToFirestore(user.uid, updated)\n        .then((ok) => {\n          if (ok) {\n            setSyncStatus('synced');\n            setLastSyncedAt(Date.now());\n          } else {\n            setSyncStatus('offline');\n          }\n        })\n        .catch(() => setSyncStatus('offline'));\n    }\n\n    return true;"""
new_save = """    const updated = [newCase, ...savedCases];\n    setSavedCases(updated);\n\n    try {\n      localStorage.setItem('acls_saved_cases', JSON.stringify(updated));\n    } catch (e) {}\n\n    if (user?.uid) {\n      setSyncStatus('syncing');\n      saveUserCaseToFirestore(user.uid, newCase)\n        .then((ok) => {\n          if (ok) {\n            setSyncStatus('synced');\n            setLastSyncedAt(Date.now());\n          } else {\n            setSyncStatus('offline');\n          }\n        })\n        .catch(() => setSyncStatus('offline'));\n    }\n\n    return true;"""
if old_save not in text:
    raise SystemExit('Save case block not found')
text = text.replace(old_save, new_save, 1)

old_delete = """    if (user?.uid) {\n      setSyncStatus('syncing');\n      syncSavedCasesToFirestore(user.uid, updated)\n        .then((ok) => {\n          if (ok) {\n            setSyncStatus('synced');\n            setLastSyncedAt(Date.now());\n          } else {\n            setSyncStatus('offline');\n          }\n        })\n        .catch(() => setSyncStatus('offline'));\n    }\n  };"""
new_delete = """    if (user?.uid) {\n      setSyncStatus('syncing');\n      deleteUserCaseFromFirestore(user.uid, caseId)\n        .then((ok) => {\n          if (ok) {\n            setSyncStatus('synced');\n            setLastSyncedAt(Date.now());\n          } else {\n            setSyncStatus('offline');\n          }\n        })\n        .catch(() => setSyncStatus('offline'));\n    }\n  };"""
if old_delete not in text:
    raise SystemExit('Delete case block not found')
text = text.replace(old_delete, new_delete, 1)

path.write_text(text, encoding='utf-8')
print('Canonical case UI migration applied.')
