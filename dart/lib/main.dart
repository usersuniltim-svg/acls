import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'state/acls_state_manager.dart';
import 'screens/onboarding_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AclsCompanionApp());
}

class AclsCompanionApp extends StatelessWidget {
  const AclsCompanionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AclsStateManager(),
      child: MaterialApp(
        title: 'Nepal Resuscitation Registry - ACLS Companion',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.blueAccent,
            brightness: Brightness.dark,
            background: const Color(0xFF0F172A),
            surface: const Color(0xFF1E293B),
          ),
          textTheme: const TextTheme(
            bodyLarge: TextStyle(color: Colors.white70),
            bodyMedium: TextStyle(color: Colors.grey),
          ),
        ),
        home: const OnboardingScreen(),
      ),
    );
  }
}
