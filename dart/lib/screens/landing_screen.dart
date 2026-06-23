import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/acls_state_manager.dart';
import 'mobile_dashboard_screen.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final stateManager = context.watch<AclsStateManager>();
    final profile = stateManager.userProfile;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        title: const Text("ACLS COMPANION LOBBY", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.0)),
        backgroundColor: const Color(0xFF1E293B),
        elevation: 1,
        actions: [
          IconButton(
            icon: Icon(stateManager.soundEnabled ? Icons.volume_up : Icons.volume_off, color: Colors.blueAccent),
            onPressed: stateManager.toggleSound,
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.amberAccent),
            onPressed: () {
              stateManager.resetSession();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("ACLS State Resynchronized")),
              );
            },
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            
            // Nepal Resuscitation Registry Emblem
            Center(
              child: Hero(
                tag: 'logo',
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: Colors.red.shade900.withOpacity(0.2),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.redAccent, width: 2),
                  ),
                  child: const Center(
                    child: Icon(Icons.favorite, color: Colors.redAccent, size: 54),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            
            const Text(
              "NEPAL RESUSCITATION REGISTRY",
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 18,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              "Clinical ACLS Decision Support Engine & Registry Integration",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            
            const Spacer(),

            // Practitioner Profile Box
            if (profile != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.blueAccent.withOpacity(0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.badge, color: Colors.blueAccent, size: 18),
                        SizedBox(width: 8),
                        Text(
                          "PRACTITONER CREDENTIALS ACTIVE",
                          style: TextStyle(color: Colors.blueAccent, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      profile.fullName.toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "${profile.profession.name.toUpperCase()} • ${profile.highestDegree}",
                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Council Registration No: ${profile.councilRegistration}",
                      style: TextStyle(color: Colors.grey[400], fontSize: 11, fontFamily: 'monospace'),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 24),

            // Defib Setup summary card
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B).withOpacity(0.5),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Defibrillator Type:", style: TextStyle(color: Colors.grey, fontSize: 12)),
                  Text(
                    "${stateManager.state.defibType} (${stateManager.state.selectedEnergy}J Selection)",
                    style: const TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // START CPR button
            SizedBox(
              height: 58,
              child: ElevatedButton.icon(
                onPressed: () {
                  stateManager.startCPR();
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const MobileDashboardScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 6,
                ),
                icon: const Icon(Icons.flash_on, size: 24),
                label: const Text(
                  "CRITICAL: START CPR PROCEDURES",
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                ),
              ),
            ),
            
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}
